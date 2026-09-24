# Build Process, Deployment, and Tooling

This document covers the build, test, and development workflow for both backend (NestJS) and frontend (React + Vite), plus operational gotchas that have resulted in actual incidents during environment setup and local development.

## Backend (`apps/backend`)

NestJS application with Jest unit tests, e2e tests against a live PostgreSQL database, and Prisma for ORM.

| Command | Purpose | Notes |
|---------|---------|-------|
| `npm install` | Install dependencies | Run from repo root; uses npm workspaces |
| `npm run start:dev` | Watch-mode development server | Nest CLI watches `src/` and rebuilds; runs on port 3000 by default |
| `npm test` | Unit tests (ts-jest) | Runs `*.spec.ts` files from `src/` only; uses mocked `PrismaService`; no live database required |
| `npm test -- path/to/file.spec.ts` | Single unit test | Useful for focused test runs during development |
| `npm run test:e2e` | E2E tests against live database | Runs `test/*.e2e-spec.ts`; spins up real Nest app against **live PostgreSQL** via `DATABASE_URL`; not included in `npm test` |
| `npm run build` | TypeScript compilation | Runs `nest build` (emits to `dist/`); this is the real `tsc` compile, not ts-jest; do not skip before treating work as done |
| `npm run lint` | ESLint with auto-fix | Lints `src/`, `test/`, and related paths; see Gotchas section for `dist/` interference |

## Frontend (`apps/frontend`)

React with Vite bundler, Vitest for unit tests, Tailwind for styling.

| Command | Purpose | Notes |
|---------|---------|-------|
| `npm install` | Install dependencies | Run from repo root; uses npm workspaces |
| `npm run dev` | Vite dev server | Runs on port 5173 by default; includes HMR; requires `/api` and `/uploads` proxy entries (see Gotchas) |
| `npm test -- --run` | Unit tests (Vitest + RTL) | `--run` flag prevents watch mode; omit `--run` for interactive mode |
| `npm test -- --run path/to/File.test.tsx` | Single unit test | Useful during component development |
| `npm run build` | Production build | Runs `tsc -b && vite build` (not equivalent to `tsc --noEmit`); emits to `dist/` |
| `npm run lint` | oxlint with auto-fix | Lints TypeScript and JSX; single-pass, no watch mode |

## Database Setup

Prisma manages migrations and seeding.

| Command | Purpose | Notes |
|---------|---------|-------|
| `npm run db:init` | Apply migrations | Runs `prisma migrate deploy`; correct for brand-new databases (does not require `--interactive`); tracks applied migrations in `_prisma_migrations` table |
| `npm run db:seed` | Populate initial data | Runs `prisma db seed` → `apps/backend/prisma/seed.ts`; idempotent (uses `upsert`); creates one test account per role (SUPER_ADMIN, TRAINER, COACH, PLAYER) plus a parent/child pair; all passwords are `Qwerty!` |
| `npm run db:setup` | Bootstrap fresh database | Runs `db:init` then `db:seed` in sequence; the standard "new checkout" sequence |

**Prerequisite:** `DATABASE_URL` must be set in `apps/backend/.env` before running any database command. This file is `.gitignore`d and per-checkout (not shared across worktrees); create it with a PostgreSQL connection string.

## Gotchas

### 1. Vite dev-server requires `/api` proxy configuration

**Symptom:** Every API call from the browser returns 404; network tab shows requests to `http://localhost:5173/api/...` instead of the backend port.

**Root cause:** `apps/backend` has no global prefix (`app.setGlobalPrefix()` not called), so backend routes mount bare (e.g., `/auth/login`, not `/api/auth/login`). Meanwhile, `apps/frontend/src/api/client.ts` issues requests with a baseURL of `/api` — this is correct for production (where a reverse proxy or same-origin host handles the rewrite), but Vite's dev server doesn't forward that traffic anywhere without explicit configuration.

**Fix:** Add a proxy entry to `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

This rewrites `/api/auth/login` → `http://localhost:3000/auth/login` before sending the request downstream.

### 2. `/uploads` directory requires both backend static-file serving and a Vite proxy entry

**Symptom:** Image requests to `/uploads/...` return 200 with `Content-Type: text/html` and the SPA `index.html` content; images don't load.

**Root cause:** Two independent defects:

1. **Backend missing static-file middleware:** `apps/backend/src/main.ts` never registered static-file serving. `LocalDiskStorage` (in `apps/backend/src/shared/storage/`) correctly writes branding logos and profile photos to `process.cwd()/uploads/`, but nothing exposed that directory over HTTP until `app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })` was added to `main.ts`.

2. **Vite missing `/uploads` proxy:** Even with the backend serving `/uploads`, Vite's dev server also needs an explicit proxy entry. Without it, requests to `:5173/uploads/...` fall through to Vite's SPA fallback (which rewrites all non-asset requests to `index.html` to support client-side routing), returning a 200 with HTML instead of a 404.

**Fix:** Add to `apps/backend/src/main.ts`:

```typescript
import { join } from 'path';
// ... in the bootstrap function:
app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
```

Add to `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/uploads': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      // Note: no rewrite here — backend serves the path verbatim
    },
  },
}
```

**Security note:** `useStaticAssets` is Express middleware that sits outside the Nest routing/guard chain, so files under `/uploads` are served unauthenticated. This is a deliberate tradeoff: filenames are `{uuid-or-trainerId}-{timestamp}[.ext]`, not fully guessable. This is acceptable for branding logos and profile photos specifically — do not place other sensitive files under `/uploads` without reviewing access-control implications.

---

## Docker Development Workflow ([TASK-009])

**Starting the containerized stack:** Run from repo root:

```bash
npm run docker:up           # Start Postgres + backend + frontend (existing containers, fast startup)
npm run docker:up:build     # Fresh build (use after Dockerfile.dev or dependencies change)
npm run docker:down         # Stop and remove all containers (preserves data volume)
npm run docker:reset-db     # Down, delete data volume, up — fresh DB with seed data
npm run docker:logs         # View logs from all services (Ctrl+C to detach)
npm run docker:seed         # Run db:seed in the running backend container
```

**Architecture:**

- Root `docker-compose.yml` orchestrates three services: `postgres:16`, `backend` (NestJS), `frontend` (React+Vite).
- Each app has a `Dockerfile.dev` (dev-only, never for production) in its directory.
- **Hot-reload via source bind-mount**: Changes to `src/` are reflected in running containers immediately (Nest watch and Vite HMR).
- **Named volumes for node_modules**: `backend_node_modules` and `frontend_node_modules` overlay the bind mounts, ensuring Linux-compiled native binaries (`bcrypt`, `sharp`) are never shadowed by host (Windows) binaries — critical for cross-platform native-module interop (FR-007, TASK-009).
- **Polling watch**: Both services use file-polling watches (`TSC_WATCHFILE: PriorityPollingInterval`, Vite `poll: true`) to work reliably on Docker Desktop for Windows, which doesn't natively support fs events through bind mounts.
- **Auto-seeding**: The backend entrypoint (`docker-entrypoint.sh`) runs `prisma migrate deploy` then `db seed` before starting the server, ensuring every stack startup is production-ready (idempotent `seed.ts` with upsert-only writes).
- **Postgres host port**: Published on `POSTGRES_HOST_PORT` (default `55432`), overridable in `.env` to avoid clashing with pre-existing ad-hoc Postgres (NFR-004); internal container networking always uses the service name `postgres:5432`.
- **JWT secret**: `JWT_ACCESS_SECRET` defaults to `dev-secret-change-me` in `.env`, appropriate only for local dev (replace in staging/production).

**Env vars (root `.env`, git-ignored; see `.env.example` for all keys):**

| Variable | Purpose | Default | Overridable |
|----------|---------|---------|-------------|
| `POSTGRES_USER` | Postgres user | `accelerator` | Yes, via `.env` |
| `POSTGRES_PASSWORD` | Postgres password | `accelerator` | Yes, via `.env` |
| `POSTGRES_DB` | Database name | `accelerator` | Yes, via `.env` |
| `POSTGRES_HOST_PORT` | Port published to host | `55432` | Yes, via `.env` |
| `DATABASE_URL` | Full connection string | Derived from `POSTGRES_*` vars | Yes (takes precedence if set) |
| `JWT_ACCESS_SECRET` | Auth token secret | `dev-secret-change-me` | Yes, via `.env` |
| `BACKEND_HOST_PORT` | Backend published port | `3000` | Yes, via `.env` |

**First-time setup:**

```bash
git clone <repo>
cd accelerator-mini
npm install
npm run docker:up:build     # Build images and start all three services
# Wait for "postgres healthy" message (~10s)
# Visit http://localhost:5173 — should see login page with seed accounts ready
```

**Seed accounts (all with password `Qwerty!`):**

| Email | Role |
|-------|------|
| `admin@example.com` | SUPER_ADMIN |
| `trainer@example.com` | TRAINER |
| `coach@example.com` | COACH |
| `player@example.com` | PLAYER (adult, family root) |
| `child.player@example.com` | PLAYER (child, `parentUserId` → `player@example.com`) |

All created via `apps/backend/prisma/seed.ts` (upsert-only, safe to re-run).

**Troubleshooting:**

- **Container won't start:** Check logs with `docker logs <container_id>` or `npm run docker:logs`.
- **Hot-reload not working:** Verify `TSC_WATCHFILE`/`TSC_WATCHDIRECTORY` and Vite `poll` config are set; polling must be enabled for Windows bind mounts.
- **Database locked:** Stop backend (`docker compose stop backend`), then run `npm run docker:reset-db` to wipe and reseed.
- **Port conflict (e.g., 3000 already in use):** Set `BACKEND_HOST_PORT=3001` in `.env` (and adjust frontend Vite proxy accordingly if using native dev instead of docker).
- **Windows-specific native-module errors:** The named `node_modules` volumes fix this; if you still get glibc/musl mismatches, ensure `Dockerfile.dev` uses `node:22-slim` (not Alpine).

**Keeping seed.ts safe:** The auto-seed feature relies on `seed.ts` being idempotent (upsert-only). This is a design invariant: any new seed additions must use `prisma.*.upsert()` with unique-field keys and empty `update: {}` blocks. Never convert seed logic to insert-only.

### 3. `prisma db seed` fails under bare `ts-node` unless `experimentalResolver` is configured

**Symptom:** `npm run db:seed` fails with `Cannot find module './internal/class.js'` even though the file doesn't exist.

**Root cause:** `apps/backend/prisma/schema.prisma` uses the newer `prisma-client` generator with `output = "../generated/prisma"`. This emits internal cross-references using NodeNext-style `.js`-extension imports (e.g., `client.ts` imports `./internal/class.js`) while only ever emitting `.ts` files on disk — the `.js` files don't exist.

- Jest works around this via `moduleNameMapper` (in `package.json`'s jest config: `"^(\\.{1,2}/.*)\\.js$": "$1"`) — rewrites `.js` imports to `.ts` files at runtime.
- `nest build` / `nest start` work around it because the real `tsc` emit understands the NodeNext `.js`-means-`.ts` convention and produces real compiled `.js` files in `dist/`.
- Bare `ts-node` (which is what `prisma db seed` runs, per the `"prisma": { "seed": "ts-node prisma/seed.ts" }` in `package.json`) has neither compensation.

**Fix:** Add `ts-node` configuration to `apps/backend/tsconfig.json`:

```json
{
  "compilerOptions": { /* ... */ },
  "ts-node": {
    "transpileOnly": true,
    "experimentalResolver": true
  }
}
```

The `experimentalResolver` flag enables experimental ESM/CommonJS resolution logic in ts-node, fixing the `.js` → `.ts` rewrite issue for Prisma's generated imports.

### 4. Fresh database bootstrap procedure

**Symptom:** First attempt to run e2e tests or the app against a fresh PostgreSQL instance fails with migration errors or missing seed data.

**Procedure:** Requires `DATABASE_URL` set in `apps/backend/.env` first.

```bash
npm run db:setup
```

This runs `db:init` (applies every migration in `apps/backend/prisma/migrations/` in order, tracked via the `_prisma_migrations` table) followed by `db:seed` (idempotent, via `upsert`-by-email, creates test accounts for each role).

**Why not `prisma migrate dev`?** That command is designed for iterative schema development with an always-available dev database. This project uses hand-authored migrations (matching the SQL comment-header format in `apps/backend/prisma/migrations/`), not generated ones. `prisma migrate deploy` is the correct command for applying an existing migration stack to a fresh database (which includes CI/CD contexts where interactive prompts are not acceptable).

### 5. `nest build` only type-checks `src/`, not `test/`

**Symptom:** `npm run build` passes; `npm test` passes; a raw `npx tsc --noEmit` run (or your IDE's language server) reports type errors in `*.spec.ts` or `*.e2e-spec.ts` files.

**Root cause:** `apps/backend/tsconfig.build.json` (which `nest build` uses) extends `tsconfig.json` but explicitly excludes `test/` and `**/*spec.ts`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["test", "**/*spec.ts"]
}
```

Meanwhile, ts-jest (used by `npm test`) transpiles each file individually and is more lenient about missing types. A raw project-wide `npx tsc --noEmit -p tsconfig.json` has no such exclusion and will catch type errors in test files that `npm run build` silently ignores.

**Implication:** Do not assume "build is green" means zero type errors exist. Check which `tsconfig` actually ran. For a complete pre-commit check: run both `npm run build` (uses `tsconfig.build.json`) and `npx tsc --noEmit` (uses `tsconfig.json`).

### 6. Dead `baseUrl` in TypeScript configuration (minor cleanup note)

`apps/backend/tsconfig.json` previously contained a `baseUrl: "./"` with no corresponding `paths` mapping that ever used it. Newer TypeScript versions flag this as deprecated. This has been removed rather than suppressed via `ignoreDeprecations` — the cleanup is already applied if you're reading this.

---

## Quick-start checklist

1. Clone/pull latest code; enter repo root.
2. `npm install` (installs both workspaces).
3. Set up `apps/backend/.env` with `DATABASE_URL=postgresql://...` (gitignored, per-checkout).
4. `npm run db:setup` (apply migrations + seed test data).
5. In one terminal, from the repo root: `npm run dev:backend`.
6. In another terminal, from the repo root: `npm run dev:frontend`.
7. Open `http://localhost:5173` in a browser.

Root-level convenience scripts (defined in the repo root `package.json`, run from repo root):
- `npm run dev:backend` / `npm run dev:frontend`
- `npm run test:backend` / `npm run test:frontend`
- `npm run build:backend` / `npm run build:frontend`
- `npm run lint:backend` / `npm run lint:frontend`

Equivalent per-package commands (run from inside `apps/backend` or `apps/frontend`): `npm run start:dev`, `npm test`, `npm run test:e2e` (backend only, requires live DB), `npm run build`, `npm run lint`.
