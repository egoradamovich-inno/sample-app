# Docker Development Environment Implementation Plan

**Task:** TASK-009

> **For Claude:** Use `using-git-worktrees` to create isolated workspace, then implement with `coder` skill.

**Goal:** A single `docker compose up` at the repo root stands up Postgres + backend + frontend,
migrated, seeded, and browsable at `http://localhost:5173`, with hot-reload working for both apps,
while the existing native `npm run dev:backend` / `dev:frontend` workflow keeps working unchanged.

**Architecture:** Three Compose services (`postgres`, `backend`, `frontend`). Postgres uses a
named volume for data. Backend and frontend each build from a `Dockerfile.dev` (`node:22-slim`)
and run with the **whole repo bind-mounted** (`.:/app`) plus a **named volume shadowing
`/app/node_modules`**, so Linux-built native binaries (`bcrypt`, `sharp`) are never overwritten by
Windows-host binaries. The backend entrypoint runs `db:init` → `db:seed` (both idempotent) before
starting `nest --watch`; the frontend runs Vite bound to `0.0.0.0`. Both watchers use polling for
Windows/Docker Desktop reliability.

**Tech Stack:** Docker Compose, `node:22-slim`, existing NestJS 11 + Prisma 6.19 backend, existing
Vite 8 + React 19 frontend, npm workspaces.

**Prior design docs (read these for full rationale — this plan operationalizes them):**
`tasks/TASK-009/requirements-analyst-requirements.md`, `tasks/TASK-009/brainstorming-design.md`,
`specs/architect-architecture.md` (`[TASK-009]` section).

---

## Three decisions this plan makes that the design docs left open

The brainstorming doc explicitly flagged the Docker **build context** as unresolved ("context is
repo root or `apps/backend` — see Dockerfile note"). This plan resolves it, because this repo is
an **npm workspaces monorepo with a single root `package-lock.json`** — there is no per-app
lockfile, so `npm ci` for either app can only succeed with the whole workspace tree present.
Concretely, this plan uses:

1. **Build context = repo root** for both `Dockerfile.dev`s (not `apps/backend`/`apps/frontend`
   individually), so `npm ci` sees the real root `package-lock.json` and both workspace
   `package.json` files it references. This is why every Dockerfile below copies **all three**
   `package.json` files even though each Dockerfile "belongs" to one app.
2. **Bind mount = the whole repo** (`.:/app` in both `backend` and `frontend` services), not just
   the one app's folder — same reason (npm workspace hoisting means dependency resolution walks up
   to the root `node_modules`), plus it lets the backend entrypoint reuse the app's own existing
   `npm run db:init` / `db:seed` scripts unmodified.
3. **One root `.dockerignore`**, not one per app — a natural consequence of #1 (Docker reads a
   single `.dockerignore` at the build context root).

Everything else — `node:22-slim`, auto-seed on every startup, `55432` default Postgres port,
`docker:*` npm scripts, the `backend_node_modules`/`frontend_node_modules` volume strategy — is
unchanged from `specs/architect-architecture.md`.

**A real gotcha this plan builds in a fix for:** this is a Windows host, and `docker-entrypoint.sh`
will be bind-mounted (not just baked into the image), so if Git checks it out with CRLF line
endings, `set -euo pipefail` and even the shebang line will break at runtime — not just at build
time. Task 1 adds a `.gitattributes` rule to force LF for this file regardless of the developer's
local `core.autocrlf` setting.

---

### Task 1: Root `.gitattributes` and `.dockerignore`

**Files:**
- Create: `.gitattributes`
- Create: `.dockerignore`

**Step 1: Write `.gitattributes`**

```gitattributes
apps/backend/docker-entrypoint.sh text eol=lf
```

**Step 2: Write `.dockerignore`**

```
node_modules
**/node_modules
dist
**/dist
build
**/build
apps/backend/generated
apps/backend/uploads
coverage
**/coverage
.git
.worktrees
**/.env
**/.env.local
**/.env.*.local
```

**Step 3: Verify**

Run: `git check-attr text eol -- apps/backend/docker-entrypoint.sh`

Expected (once the file exists after Task 2 — come back and re-check after that task):
`apps/backend/docker-entrypoint.sh: text: set` and `apps/backend/docker-entrypoint.sh: eol: lf`

**Step 4: Commit**

```bash
git add .gitattributes .dockerignore
git commit -m "chore(docker): add gitattributes and dockerignore for TASK-009"
```

---

### Task 2: Backend entrypoint script

**Files:**
- Create: `apps/backend/docker-entrypoint.sh`

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[entrypoint] Applying pending Prisma migrations..."
npm run db:init

echo "[entrypoint] Seeding database (idempotent upserts)..."
npm run db:seed

echo "[entrypoint] Starting NestJS in watch mode..."
exec npx nest start --watch
```

- `cd "$(dirname "$0")"` makes every following command run with cwd `apps/backend` regardless of
  where Docker invokes the script from, so the existing `db:init`/`db:seed` scripts in
  `apps/backend/package.json` resolve their relative `prisma/` paths correctly.
- `npm run db:init` / `db:seed` reuse the app's own existing scripts (`prisma migrate deploy`,
  `prisma db seed`) verbatim — no new migration/seed logic, per the architecture decision that
  `apps/backend/prisma/seed.ts` is already upsert-idempotent.
- `exec` on the final line makes `nest` PID 1 so `docker compose down` / `Ctrl-C` stop it cleanly
  instead of leaving an orphaned child process.

**Step 2: Force LF line endings on disk right now**

Windows checkouts can silently reintroduce CRLF before `.gitattributes` normalizes it on the next
clone. Confirm the file you just wrote has no `\r`:

Run: `git show :apps/backend/docker-entrypoint.sh 2>/dev/null | file - ` (after staging) or open the
file in an editor and confirm line-ending mode shows "LF"/"Unix", not "CRLF".

**Step 3: Commit**

```bash
git add apps/backend/docker-entrypoint.sh
git commit -m "feat(docker): add backend container entrypoint (migrate, seed, watch)"
```

---

### Task 3: Backend `Dockerfile.dev`

**Files:**
- Create: `apps/backend/Dockerfile.dev`

**Step 1: Write the Dockerfile**

```dockerfile
FROM node:22-slim

# bcrypt/sharp native build toolchain + OpenSSL for Prisma's query engine
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# npm workspaces: npm ci needs the root lockfile + every workspace's package.json,
# even though this image only ever runs the backend.
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

RUN npm ci

COPY apps/backend/prisma ./apps/backend/prisma
RUN npx prisma generate --schema apps/backend/prisma/schema.prisma

COPY apps/backend/docker-entrypoint.sh ./apps/backend/docker-entrypoint.sh
RUN chmod +x ./apps/backend/docker-entrypoint.sh

ENTRYPOINT ["bash", "./apps/backend/docker-entrypoint.sh"]
```

- `bash` invokes the script directly (not via its own shebang), which avoids the kernel-level
  "bad interpreter" failure mode entirely as defense-in-depth on top of the `.gitattributes` fix.
- The real source tree (including this same `docker-entrypoint.sh`) arrives at runtime via the
  bind mount configured in Task 6 — this build-time copy only needs to exist so the image is
  self-contained and `chmod +x` has taken effect before the volume overlay.

**Step 2: Build in isolation to catch errors early (no compose yet)**

Run (from repo root): `docker build -f apps/backend/Dockerfile.dev -t accelerator-backend-dev .`

Expected: build succeeds, ends with the image ID; no `npm ci` or `prisma generate` errors.

**Step 3: Commit**

```bash
git add apps/backend/Dockerfile.dev
git commit -m "feat(docker): add backend dev Dockerfile"
```

---

### Task 4: Frontend `Dockerfile.dev`

**Files:**
- Create: `apps/frontend/Dockerfile.dev`

**Step 1: Write the Dockerfile**

```dockerfile
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

RUN npm ci

EXPOSE 5173

CMD ["npx", "vite", "--host", "0.0.0.0"]
```

- No native-module build toolchain needed (frontend has no `bcrypt`/`sharp`-style deps today).
- `CMD` is a sensible default; Task 6's compose file pins `working_dir` to `apps/frontend` so this
  runs from the right directory and picks up `vite.config.ts`.

**Step 2: Build in isolation**

Run (from repo root): `docker build -f apps/frontend/Dockerfile.dev -t accelerator-frontend-dev .`

Expected: build succeeds, ends with the image ID.

**Step 3: Commit**

```bash
git add apps/frontend/Dockerfile.dev
git commit -m "feat(docker): add frontend dev Dockerfile"
```

---

### Task 5: Frontend Vite config — env-driven proxy + polling

**Files:**
- Modify: `apps/frontend/vite.config.ts` (full current content shown below for reference)

Current content:

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
```

**Step 1: Replace the `server` block**

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    watch: { usePolling: true },
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/uploads': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
```

- Default (`VITE_PROXY_TARGET` unset) preserves today's native behavior exactly — `localhost:3000`
  — so `npm run dev:frontend` is unaffected (BR-003).
- `host: '0.0.0.0'` is harmless natively too (still reachable via `localhost:5173`); it's what
  makes the frontend container reachable from the host browser (FR-003).
- `watch.usePolling: true` is the Windows/Docker Desktop hot-reload mitigation (FR-008); costs some
  CPU but is a no-op correctness-wise for native dev.

**Step 2: Verify native dev still works**

Run: `npm run dev:frontend`

Expected: Vite starts on `http://localhost:5173/`, no config errors. Stop it (`Ctrl-C`) once
confirmed.

**Step 3: Commit**

```bash
git add apps/frontend/vite.config.ts
git commit -m "feat(frontend): make vite proxy target env-driven, add polling watch"
```

---

### Task 6: Root `docker-compose.yml`

**Files:**
- Create: `docker-compose.yml`

**Step 1: Write the compose file**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "${POSTGRES_HOST_PORT:-55432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile.dev
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      NODE_ENV: development
      PORT: 3000
      CHOKIDAR_USEPOLLING: "true"
    ports:
      - "${BACKEND_HOST_PORT:-3000}:3000"
    volumes:
      - .:/app
      - backend_node_modules:/app/node_modules
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile.dev
    working_dir: /app/apps/frontend
    command: ["npx", "vite", "--host", "0.0.0.0"]
    environment:
      VITE_PROXY_TARGET: ${VITE_PROXY_TARGET:-http://backend:3000}
      CHOKIDAR_USEPOLLING: "true"
    ports:
      - "${FRONTEND_HOST_PORT:-5173}:5173"
    volumes:
      - .:/app
      - frontend_node_modules:/app/node_modules
    depends_on:
      - backend

volumes:
  pgdata:
  backend_node_modules:
  frontend_node_modules:
```

Notes for whoever maintains this later:
- `backend` has **no** `working_dir` override — it keeps the image's default `/app` so the
  `ENTRYPOINT`'s relative path (`./apps/backend/docker-entrypoint.sh`, set in Task 3) resolves
  correctly. The entrypoint script itself `cd`s into `apps/backend`.
- `frontend` **does** set `working_dir: /app/apps/frontend` because its `command` is a bare
  `npx vite`, which needs to run from the directory containing `vite.config.ts`.
- `backend_node_modules` and `frontend_node_modules` are separate volumes even though both
  containers bind-mount the same repo root — each container gets its own independent
  `/app/node_modules` populated by its own image's `npm ci`, matching the isolation the
  architecture doc calls for. (Trade-off, and a deliberate one: because of npm workspace
  hoisting, `npm ci` in either image installs the *entire* workspace's dependencies, not just that
  app's — some duplication across the two volumes. Acceptable for a dev-only stack per BR-001;
  do not carry this into a future production compose file without reconsidering.)

**Step 2: Verify config parses**

Run: `docker compose config --quiet`

Expected: no output, exit code 0 (will fail here if `.env` doesn't exist yet — that's expected,
come back after Task 7).

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add root docker-compose orchestrating postgres, backend, frontend"
```

---

### Task 7: Root `.env.example`

**Files:**
- Create: `.env.example`

**Step 1: Write the file**

```
# Copy to .env (gitignored) and adjust if needed — these defaults work out of the box.

POSTGRES_USER=accelerator
POSTGRES_PASSWORD=accelerator
POSTGRES_DB=accelerator
POSTGRES_HOST_PORT=55432

# Must use the "postgres" service hostname, not localhost, for the backend container.
DATABASE_URL=postgresql://accelerator:accelerator@postgres:5432/accelerator?schema=public

JWT_ACCESS_SECRET=dev-secret-change-me

BACKEND_HOST_PORT=3000
FRONTEND_HOST_PORT=5173
VITE_PROXY_TARGET=http://backend:3000
```

**Step 2: Create your local `.env` and verify compose config resolves**

Run: `cp .env.example .env`
Run: `docker compose config --quiet`

Expected: exit code 0, no errors. (`.env` is already covered by the root `.gitignore`'s bare
`.env` pattern — no `.gitignore` edit needed; confirm with `git check-ignore -v .env`, expected
output pointing at the `.gitignore` line `.env`.)

**Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(docker): add root .env.example for compose stack"
```

(`.env` itself is never committed — verify it doesn't show up in `git status`.)

---

### Task 8: Root `package.json` convenience scripts

**Files:**
- Modify: `package.json`

Current `scripts` block:

```json
"scripts": {
  "dev:backend": "npm run start:dev --workspace apps/backend",
  "dev:frontend": "npm run dev --workspace apps/frontend",
  "test:backend": "npm test --workspace apps/backend",
  "test:frontend": "npm test --workspace apps/frontend -- --run",
  "build:backend": "npm run build --workspace apps/backend",
  "build:frontend": "npm run build --workspace apps/frontend",
  "lint:backend": "npm run lint --workspace apps/backend",
  "lint:frontend": "npm run lint --workspace apps/frontend"
}
```

**Step 1: Add `docker:*` scripts**

```json
"scripts": {
  "dev:backend": "npm run start:dev --workspace apps/backend",
  "dev:frontend": "npm run dev --workspace apps/frontend",
  "test:backend": "npm test --workspace apps/backend",
  "test:frontend": "npm test --workspace apps/frontend -- --run",
  "build:backend": "npm run build --workspace apps/backend",
  "build:frontend": "npm run build --workspace apps/frontend",
  "lint:backend": "npm run lint --workspace apps/backend",
  "lint:frontend": "npm run lint --workspace apps/frontend",
  "docker:up": "docker compose up",
  "docker:up:build": "docker compose up --build",
  "docker:down": "docker compose down",
  "docker:logs": "docker compose logs -f",
  "docker:reset-db": "docker compose down -v && docker compose up -d",
  "docker:seed": "docker compose exec backend npm run db:seed"
}
```

**Step 2: Verify**

Run: `npm run docker:up:build -- --help` is not meaningful for compose; instead sanity-check the
script is wired correctly:

Run: `node -e "console.log(require('./package.json').scripts['docker:up'])"`

Expected: prints `docker compose up`.

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat(docker): add docker:* convenience scripts to root package.json"
```

---

### Task 9: Fresh-clone smoke test (FR-001, NFR-001)

No new files — this is a verification task.

**Step 1: Stop any host-native dev servers and any ad-hoc Postgres containers on conflicting ports**
(the ad-hoc `postgres:16` on 5432 can keep running — this stack defaults to `55432` precisely to
avoid needing to stop it; only stop it if you deliberately changed `POSTGRES_HOST_PORT` to `5432`).

**Step 2: Bring the stack up from a clean state**

Run: `docker compose down -v` (safe even on first run) then `npm run docker:up:build`

Expected log sequence: `postgres` becomes healthy → `backend` logs `[entrypoint] Applying pending
Prisma migrations...` → `[entrypoint] Seeding database...` → Nest's normal startup banner →
`frontend` logs Vite's "ready in Xms" banner.

**Step 3: Verify the database was migrated**

Run: `docker compose exec postgres psql -U accelerator -d accelerator -c '\dt'`

Expected: a table listing including `User` (or your Prisma model names) — not an empty relation
list.

**Step 4: Verify the login page loads**

Open `http://localhost:5173` in a browser. Expected: the app's login page renders (no blank page,
no console network errors to `/api/...`).

**Step 5: No fixes should be needed if Tasks 1–8 were done correctly.** If `bcrypt`/`sharp` throw
`invalid ELF header` in the backend logs, stop and re-check Task 3/Task 6's volume config before
proceeding — this is exactly the failure mode the named-volume strategy exists to prevent.

No commit for this task (verification only).

---

### Task 10: Hot-reload verification (FR-002, FR-003, FR-008, NFR-002)

**Step 1: With the stack from Task 9 still running, edit a backend file**

Pick any existing controller, e.g. add a harmless comment or log line to a file under
`apps/backend/src/`, save it.

Expected: within a few seconds, `docker compose logs -f backend` shows Nest detecting the change
and restarting (`File change detected...` / recompile output), with no manual container restart.

**Step 2: Edit a frontend file**

Add a harmless visible change (e.g. a text tweak) to any `.tsx` under `apps/frontend/src/`, save
it.

Expected: the browser tab showing `localhost:5173` updates via HMR within a couple of seconds,
without a manual page refresh.

**Step 3: If either watcher does not fire**

Confirm `CHOKIDAR_USEPOLLING=true` is present in the container's env (`docker compose exec backend
printenv CHOKIDAR_USEPOLLING`) and that `apps/frontend/vite.config.ts`'s `watch.usePolling` from
Task 5 actually built into the running image (rebuild with `npm run docker:up:build` if you edited
Task 5 after the image was already built once).

No commit for this task (verification only) — revert your throwaway edits from Steps 1–2 once
confirmed working.

---

### Task 11: Data persistence verification (FR-004)

**Step 1:** With the stack running, note some existing seeded data (e.g. log into the app with a
seed account).

**Step 2:** Run: `docker compose down` (no `-v`) then `npm run docker:up`

Expected: same data still present (login still works with the same accounts) — the named
`pgdata` volume survived.

**Step 3:** Run: `docker compose down -v` then `npm run docker:up`

Expected: fresh migrate+seed cycle runs again from empty (visible in backend logs), confirming a
clean-slate reset works via `npm run docker:reset-db`.

No commit for this task (verification only).

---

### Task 12: Port-collision and native-workflow-intact verification (NFR-003, NFR-004, BR-003)

**Step 1:** Confirm the compose Postgres on `55432` doesn't collide with the pre-existing ad-hoc
Postgres containers on `5432`/`5445` — both should be able to run simultaneously.

Run: `docker ps` — expected: the ad-hoc containers and the compose-managed `postgres` service all
listed, no port-bind errors in `docker compose up` output.

**Step 2:** Stop the compose stack (`npm run docker:down`) and confirm the **native** workflow
still works unmodified.

Run (with `apps/backend/.env` set up per the existing pre-TASK-009 instructions in
`specs/docs-generator-implementation.md`): `npm run dev:backend` in one terminal, `npm run
dev:frontend` in another.

Expected: both start exactly as before this task, login page reachable at
`http://localhost:5173`, proxying to `localhost:3000` (the default when `VITE_PROXY_TARGET` is
unset) — confirming BR-003.

No commit for this task (verification only).

---

### Task 13: CORS/cookie re-verification through containerized ports

This re-checks the open item flagged in `requirements-analyst-requirements.md`'s Gap Analysis and
carried into `specs/architect-architecture.md`: Epic-01's httpOnly-cookie auth
(`sameSite: 'lax'`, `origin: true` CORS) was validated across different `localhost` ports
natively — confirm it still works when frontend and backend are two different **containers**
talking through their published host ports.

**Step 1:** With the compose stack up (Task 9), open `http://localhost:5173`, log in with a seeded
account through the UI.

**Step 2:** Confirm in browser DevTools → Application → Cookies that the auth cookie was set for
the correct domain, and that subsequent authenticated API calls (e.g. loading a dashboard page)
succeed (no 401s caused by the cookie not being sent/accepted).

**Step 3: If cookies are rejected**, check the backend's CORS origin configuration
(`apps/backend/src/main.ts` or wherever `enableCors` is configured) against the frontend's
actual origin as seen from the browser (`http://localhost:5173`) — this is a verification/possible
config-value task, not a new design decision; the CORS mechanism itself (`origin: true`,
`sameSite: 'lax'`) was already decided in Epic-01 and is not being redesigned here.

No commit for this task (verification only) unless Step 3 uncovers an actual config bug, in which
case: fix the specific CORS origin value, verify login again, then:

```bash
git add apps/backend/src/main.ts
git commit -m "fix(docker): verify/correct CORS origin for containerized frontend port"
```

---

## Definition of Done

- [ ] Tasks 1–8 committed (config/code)
- [ ] Task 9: fresh `docker compose up` reaches a migrated, seeded, browsable login page with zero
      manual steps
- [ ] Task 10: both backend and frontend hot-reload verified on the real Windows + Docker Desktop
      host (not assumed)
- [ ] Task 11: data persists across `down`/`up`; `down -v` gives a clean slate
- [ ] Task 12: no port collision with pre-existing ad-hoc Postgres containers; native
      `npm run dev:*` workflow still works unmodified
- [ ] Task 13: login + authenticated requests work end-to-end through the containerized ports
- [ ] No `bcrypt`/`sharp` `invalid ELF header` errors at any point
