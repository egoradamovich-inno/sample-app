# Docker Development Environment Design

> TASK-009 — brainstorming output. Resolves the four open gaps from
> `tasks/TASK-009/requirements-analyst-requirements.md` and specifies a concrete,
> conceptual design ready for `/writing-plans` to turn into an implementation plan.

## Problem Statement

`accelerator-mini` (an npm-workspaces monorepo: `apps/backend` — NestJS 11 + Prisma 6.19 +
Postgres; `apps/frontend` — React 19 + Vite 8 + Tailwind v4) has **no containerized dev
environment**. Postgres is run ad hoc (a manually-started `postgres:16` on host port 5432,
outside this repo's control), and the apps run natively via `npm run dev:backend` / `dev:frontend`.

Goal: a single `docker compose up` at repo root that stands up **Postgres + backend + frontend**
with **working hot-reload for both apps**, on a Windows 11 + Docker Desktop host, reaching a
migrated, seeded, browsable login page with **zero manual steps** — while leaving the existing
native `npm run dev:*` workflow untouched (Docker is additive, per BR-003).

Scope is **dev-only** (no production/multi-stage images — BR-001) with **no extra services**
(no pgAdmin/mailhog/Redis — BR-002).

## Resolved Decisions (the four gaps)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | **Node base image** | `node:22-slim` | Matches the local dev Node (`v22.16.0`), so containers behave like the machines developers already use. Debian-slim (glibc) builds `bcrypt`/`sharp` and ships the OpenSSL that Prisma's query engine needs, without Alpine/musl prebuilt-binary pain. Floats within the 22 line for security patches. |
| 2 | **Seeding** | **Auto-seed on every startup**: entrypoint runs `prisma migrate deploy` → `prisma db seed` before `nest start --watch` | Gives the literal "one command → fully populated, ready-to-use stack" experience (NFR-001). **Verified safe:** `apps/backend/prisma/seed.ts` is already fully idempotent — every write is a `prisma.*.upsert()` keyed on a unique field (`email`, `userId`, composite `trainerId_playerProfileId`) with `update: {}` no-ops. No code change needed. **Design invariant (must be enforced going forward): `seed.ts` must remain upsert-only / re-runnable** — an insert-only seed would break every restart under this choice. |
| 3 | **Postgres host port** | Overridable `POSTGRES_HOST_PORT`, **default `55432`** (published as `${POSTGRES_HOST_PORT:-55432}:5432`) | Avoids collision with the pre-existing ad-hoc `postgres:16` on 5432 (and the other on 5445) — NFR-004. `docker compose up` "just works" on this host without asking a developer to stop a container they didn't create. Container-internal networking is unaffected (backend always talks to `postgres:5432`). Overridable so anyone can set it back to `5432` if they prefer. |
| 4 | **Convenience scripts** | Root `package.json` `docker:*` scripts | Matches the existing `dev:*` / `test:*` / `build:*` convention already in root `package.json`; adds no new host prerequisite (npm is already present; `make` is **not** default on Windows — rejecting the Makefile option keeps NFR-003's "only Docker needed" spirit for the stack itself). |

## Proposed Solution (high level)

A root `docker-compose.yml` orchestrating three services — `postgres`, `backend`, `frontend` —
each app built from a dev-target Dockerfile (`Dockerfile.dev`). Source is **bind-mounted** from the
host for hot-reload, but each app's `node_modules` lives in a **named volume** (never bind-mounted),
so the Linux-compiled native modules (`bcrypt`, `sharp`) are never shadowed by host (Windows)
binaries. File watching uses **polling** to work reliably through Docker Desktop's Windows bind mounts.

## File Layout

```
accelerator-mini/
├─ docker-compose.yml            # NEW — root orchestration (FR-001)
├─ .env.example                  # NEW — root; documents every compose-consumed var (FR-009)
├─ .env                          # NEW (git-ignored) — developer's local copy
├─ package.json                  # EDIT — add docker:* scripts (FR-010)
├─ .gitignore                    # EDIT — ensure /.env is ignored
├─ apps/
│  ├─ backend/
│  │  ├─ Dockerfile.dev          # NEW — node:22-slim dev image (FR-002)
│  │  ├─ .dockerignore           # NEW — exclude node_modules, dist, .git, generated/
│  │  └─ docker-entrypoint.sh    # NEW — migrate deploy → db seed → nest start --watch (FR-005)
│  └─ frontend/
│     ├─ Dockerfile.dev          # NEW — node:22-slim dev image (FR-003)
│     ├─ .dockerignore           # NEW — exclude node_modules, dist, .git
│     └─ vite.config.ts          # EDIT — env-driven proxy target + polling watch (see below)
```

## Compose Services (conceptual)

### `postgres`
- **Image:** `postgres:16` (matches the version already in ad-hoc use — FR-004).
- **Ports:** `${POSTGRES_HOST_PORT:-55432}:5432`.
- **Env:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (from root `.env`).
- **Volume:** named volume `pgdata` → `/var/lib/postgresql/data` (persists across `down`/`up`;
  `down -v` wipes for a clean slate — FR-004).
- **Healthcheck:** `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` (interval ~5s, retries ~10).
  This is what `backend` waits on — it must wait for *ready*, not just *started*.

### `backend`
- **Build:** `apps/backend/Dockerfile.dev` (context is repo root or `apps/backend` — see Dockerfile
  note; needs `package.json`/lockfile + prisma schema at build time).
- **Ports:** `3000:3000` (backend listens on `process.env.PORT ?? 3000`).
- **Volumes:**
  - bind-mount `./apps/backend` → `/app` (source for hot-reload)
  - **named volume `backend_node_modules` → `/app/node_modules`** (overlays the bind mount so the
    container's own Linux-built deps win — the crux of the native-module fix, FR-007)
  - (if Prisma client is generated to `apps/backend/generated`, keep it inside the container too —
    see "Prisma generate" below)
- **Env:** `DATABASE_URL=postgresql://<user>:<pass>@postgres:5432/<db>?schema=public`
  (hostname is the **service name `postgres`**, not `localhost` — FR-006), `JWT_ACCESS_SECRET`,
  `NODE_ENV=development`, `PORT=3000`, `CHOKIDAR_USEPOLLING=true` (FR-008).
- **depends_on:** `postgres` with `condition: service_healthy`.
- **Command / entrypoint:** `docker-entrypoint.sh` (below).

### `frontend`
- **Build:** `apps/frontend/Dockerfile.dev`.
- **Ports:** `5173:5173`.
- **Volumes:**
  - bind-mount `./apps/frontend` → `/app`
  - **named volume `frontend_node_modules` → `/app/node_modules`** (same strategy; keeps parity and
    avoids host-binary bleed even though the frontend has no native deps today).
- **Env:** `VITE_PROXY_TARGET=http://backend:3000` (see Vite note), `CHOKIDAR_USEPOLLING=true`.
- **depends_on:** `backend` (ordering only; Vite can start before the API is up).
- **Command:** `vite --host 0.0.0.0` (must bind `0.0.0.0` to be reachable from the host browser —
  FR-003).

**Named volumes:** `pgdata`, `backend_node_modules`, `frontend_node_modules`.

## Dockerfile.dev approach (both apps)

Both use `node:22-slim`. Backend additionally needs build tooling for native modules.

**Backend `Dockerfile.dev` (sketch):**
1. `FROM node:22-slim`
2. Install OS build deps for native modules: `apt-get install -y --no-install-recommends python3 make g++ openssl` (bcrypt/sharp toolchain + Prisma's OpenSSL).
3. `WORKDIR /app`
4. Copy `package.json` + lockfile (+ `prisma/schema.prisma`), then `npm ci` **inside the image** — this populates `/app/node_modules` with Linux binaries. The named `backend_node_modules` volume is seeded from this image layer on first run.
5. `npx prisma generate` (so the generated client matches the container platform).
6. Copy entrypoint, `ENTRYPOINT ["./docker-entrypoint.sh"]`.

**Frontend `Dockerfile.dev` (sketch):** same shape minus the native-build apt packages and Prisma
step; `npm ci` then default to the Vite command.

### The native-module trap and how the volume strategy avoids it (FR-007)
- Bind-mounting `./apps/backend` → `/app` would, by itself, also overlay the host's
  `apps/backend/node_modules` (Windows-built `bcrypt`/`sharp` `.node` binaries) into the Linux
  container → `invalid ELF header` at runtime.
- Mounting the **named volume at `/app/node_modules`** shadows that path with the container's own
  `npm ci` output, so the Linux binaries always win. Host `node_modules` is never consulted.
- `.dockerignore` also excludes `node_modules` from the build context so the image build itself
  never copies host binaries.
- **Consequence to document:** because deps live in a volume, changing a dependency (editing
  `package.json`) requires a `docker compose build` (or `npm ci` in the container) — it will *not*
  auto-sync from the host. Captured as the `docker:reset-*` / rebuild story below.

## Backend entrypoint sequencing (FR-005)

`apps/backend/docker-entrypoint.sh` runs on container start, after Postgres is healthy:

```
1. npx prisma migrate deploy      # apply pending migrations (idempotent)
2. npx prisma db seed             # run seed.ts (idempotent upserts — decision #2)
3. exec nest start --watch        # dev server with hot-reload; exec so signals propagate
```

- Step 1 + 2 give NFR-001 (migrated + seeded with zero manual steps on a fresh volume).
- Because both are idempotent, re-running on every `up`/restart is safe and cheap.
- `exec` on step 3 makes `nest` PID 1 so `Ctrl-C` / `docker compose down` stops it cleanly.

## Vite config change (frontend hot-reload + API proxy)

`apps/frontend/vite.config.ts` today proxies `/api` and `/uploads` to a hardcoded
`http://localhost:3000`. Inside the frontend container, `localhost` is the frontend container
itself, so the proxy must target the backend **service name**.

- Make the proxy target env-driven: `target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000'`
  (default preserves the existing native workflow; compose sets it to `http://backend:3000`).
- Add polling to the watcher for Windows/Docker Desktop reliability:
  `server: { host: '0.0.0.0', watch: { usePolling: true } }` (host can also be passed via the
  `--host` CLI flag; polling is the key part for FR-008).

## Windows Docker Desktop file-watching mitigation (FR-008)

Docker Desktop on Windows does not reliably forward filesystem events across bind mounts, so
native inotify-based watchers miss edits. Mitigation:
- **Backend:** `CHOKIDAR_USEPOLLING=true` env (NestJS `--watch` uses chokidar under the hood).
- **Frontend:** `server.watch.usePolling: true` in `vite.config.ts` (+ `CHOKIDAR_USEPOLLING=true`
  as a belt-and-braces env).
- Polling costs some CPU but is the well-known reliable path on this host; acceptable for dev.
- **Must be verified on the real host**, not assumed (FR-008 acceptance) — see Testing.

## Environment variables (FR-009)

Root `.env.example` (committed) → `cp .env.example .env` (git-ignored) documents every
compose-consumed variable. Draft set:

| Variable | Example | Consumed by |
|----------|---------|-------------|
| `POSTGRES_USER` | `accelerator` | postgres, backend `DATABASE_URL` |
| `POSTGRES_PASSWORD` | `accelerator` | postgres, backend `DATABASE_URL` |
| `POSTGRES_DB` | `accelerator` | postgres, backend `DATABASE_URL` |
| `POSTGRES_HOST_PORT` | `55432` | postgres host port mapping |
| `DATABASE_URL` | `postgresql://accelerator:accelerator@postgres:5432/accelerator?schema=public` | backend (note: `postgres` hostname) |
| `JWT_ACCESS_SECRET` | `dev-secret-change-me` | backend (required at boot) |
| `NODE_ENV` | `development` | backend/frontend |
| `BACKEND_HOST_PORT` | `3000` | backend host mapping (optional convenience) |
| `FRONTEND_HOST_PORT` | `5173` | frontend host mapping (optional convenience) |
| `VITE_PROXY_TARGET` | `http://backend:3000` | frontend Vite proxy |

Acceptance: `cp .env.example .env` with the committed defaults is enough to `docker compose up`
successfully — no editing required for a local dev run.

## Root `package.json` convenience scripts (FR-010)

Add alongside existing `dev:*` scripts:

| Script | Wraps | Purpose |
|--------|-------|---------|
| `docker:up` | `docker compose up` | start the stack (add `-d` variant or document `--build`) |
| `docker:down` | `docker compose down` | stop, keep data |
| `docker:logs` | `docker compose logs -f` | tail all service logs |
| `docker:reset-db` | `docker compose down -v && docker compose up -d` | wipe pg volume → clean, re-migrated, re-seeded DB |
| `docker:seed` | `docker compose exec backend npx prisma db seed` | manual re-seed on demand (idempotent) |

(`docker:seed` is a convenience even though seeding is automatic — useful after manual DB edits.)

## Error Handling / edge cases

- **Port conflict:** default `55432` avoids the known 5432 collision; if a developer's chosen port
  is taken, compose fails fast with an actionable bind error (NFR-004) — overridable via
  `POSTGRES_HOST_PORT`.
- **Backend starts before DB ready:** prevented by `depends_on: service_healthy` + pg healthcheck.
- **Migrate/seed failure:** entrypoint should not swallow errors — a failed `migrate deploy` or
  `db seed` must exit non-zero so the container is visibly unhealthy rather than silently running
  an un-migrated app.
- **Dependency drift:** deps in a named volume don't auto-update from host `package.json` edits —
  documented; `docker:reset-*` / `docker compose build` is the intended refresh path.
- **Native binding load error** (`invalid ELF header` on bcrypt/sharp): the named-volume strategy
  is the fix; the smoke test explicitly checks this doesn't occur.

## Testing Strategy (verification, from requirements)

1. **Fresh-clone smoke test:** clean state (or fresh named volumes) → `docker compose up` →
   migrated + seeded DB, reachable login page at `localhost:5173`, no manual steps, no
   bcrypt/sharp ELF errors.
2. **Hot-reload:** edit a backend `.ts` and a frontend `.tsx` while running → backend recompiles/
   restarts and Vite HMRs, both within a few seconds, no manual restart — **verified on the actual
   Windows + Docker Desktop host** (FR-008).
3. **Data persistence:** `docker compose down` (no `-v`) then `up` → prior data present;
   `down -v` → clean slate.
4. **Port behavior:** confirm `55432` default coexists with the pre-existing ad-hoc 5432/5445
   containers (NFR-004).
5. **CORS/cookie re-verification:** Epic-01's httpOnly-cookie auth (`sameSite: 'lax'`, `origin:
   true` CORS) — re-verify login works end-to-end through the containerized ports rather than
   assuming (open item flagged in requirements).
6. **Native workflow intact:** `npm run dev:backend` / `dev:frontend` still work unchanged
   (BR-003).

## Security Considerations

- Dev-only secrets (`JWT_ACCESS_SECRET`, Postgres password) live in a git-ignored `.env` with
  obvious placeholder defaults in `.env.example`; no real secrets committed. This is explicitly a
  local dev environment — production secret handling is out of scope (BR-001).
- Seed accounts all share the dev password `Qwerty!` (already in `seed.ts`) — acceptable for a
  local-only DB; must never be reused outside dev.

## Open Questions

- **None blocking.** All four brainstorming gaps are resolved (table above). Remaining items are
  verification tasks, not design decisions: (a) confirm polling actually fixes hot-reload on the
  team's specific Docker Desktop/Windows build; (b) re-verify CORS/cookie auth through the
  containerized ports. Both belong in the implementation/verification plan, not here.
