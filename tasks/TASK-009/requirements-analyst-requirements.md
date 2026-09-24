# Docker Development Environment — Requirements

## Overview

Containerize the full local development stack for `accelerator-mini` — Postgres, the NestJS backend (`apps/backend`), and the Vite/React frontend (`apps/frontend`) — behind a single `docker compose up`, with hot-reload preserved for both apps. Today there is no Docker setup in this repo at all: Postgres is run ad hoc (a manually-started container observed on the host, e.g. `postgres:16` on port 5432), and the backend/frontend are run natively via the root workspace's `npm run dev:backend` / `dev:frontend` scripts.

## Source

User request via `/requirements-analyst "Docker Development Environment Implementation Plan"`. Scope narrowed through clarifying questions (see below) — no Confluence/external doc exists for this yet.

**Scope decisions from clarifying questions:**
- **Full stack in Docker**: Postgres + backend + frontend all containerized (not just the database).
- **Hot-reload is required** for both backend (`nest start --watch`) and frontend (`vite`) — file edits on the host must reflect in the running containers without a rebuild.
- **Dev-environment scope only** — no production-oriented multi-stage Dockerfiles in this task; that's explicitly deferred to a future task.
- **No additional services** — no mail-catcher, no pgAdmin, no Redis. Just Postgres + backend + frontend.

## Functional Requirements

1. **FR-001: `docker-compose.yml` at repo root** orchestrating three services — `postgres`, `backend`, `frontend` — startable with a single `docker compose up`.
   - Acceptance: a fresh clone of the repo, with only Docker installed (no local Node/Postgres), can run the full stack via `docker compose up` and reach a working login page in a browser.
   - Priority: High

2. **FR-002: Backend Dockerfile (dev target)** running `nest start --watch` inside the container, with the repo's `apps/backend` source bind-mounted from the host.
   - Acceptance: editing a `.ts` file under `apps/backend/src` on the host triggers a recompile and restart inside the container within a few seconds, no manual container restart needed.
   - Priority: High

3. **FR-003: Frontend Dockerfile (dev target)** running the Vite dev server inside the container, with `apps/frontend` bind-mounted, bound to `0.0.0.0` so it's reachable from the host browser.
   - Acceptance: editing a `.tsx` file on the host triggers Vite HMR in the browser without a manual refresh.
   - Priority: High

4. **FR-004: Postgres service** using the same major version already in ad-hoc use (`postgres:16`), with a named volume for data persistence across `docker compose down`/`up` cycles.
   - Acceptance: data survives a `docker compose down` (without `-v`) and a subsequent `up`; `docker compose down -v` gives a clean-slate database.
   - Priority: High

5. **FR-005: Database bootstrap on backend startup** — the backend container applies pending Prisma migrations (`prisma migrate deploy`) automatically before starting the dev server, so a fresh `docker compose up` ends with a ready-to-use, migrated database with no manual step.
   - Acceptance: on a brand-new named volume, `docker compose up` results in all tables existing (verified via `\dt` or an equivalent check) with no manual `npx prisma migrate deploy` required.
   - Open question (see Gap Analysis): should seed data (`db:seed`) also run automatically, or stay a manual opt-in step?
   - Priority: High

6. **FR-006: Container-internal service networking** — the backend's `DATABASE_URL` inside the container must resolve `postgres` as the hostname (the compose service name), not `localhost`, while host-side tooling (Prisma Studio, `psql`, a DB GUI) continues to reach the same database via the published `localhost:5432` port mapping.
   - Acceptance: the backend container connects successfully using the service-name hostname; a host-side `psql -h localhost -p 5432` also connects to the same database.
   - Priority: High

7. **FR-007: Native-module correctness across host/container platform boundary** — `apps/backend` depends on `bcrypt` and `sharp`, both native (compiled) modules. Bind-mounting the host's `node_modules` (e.g. built on Windows) directly into the Linux container would ship host-platform binaries into a container expecting Linux binaries, breaking at runtime. The backend (and frontend, for consistency) container must install its own `node_modules` inside the Linux image/volume, never bind-mount the host's.
   - Acceptance: `docker compose up` succeeds with no native-binding load errors (e.g. `bcrypt`/`sharp` `Error: invalid ELF header` or similar); changing a host-installed dependency version doesn't silently desync the container's copy without a rebuild.
   - Priority: High (this is a common silent-failure trap for this exact stack)

8. **FR-008: File-watching reliability on Docker Desktop for Windows** — this repo's dev host is Windows; Docker Desktop's default filesystem-event forwarding for bind mounts is known to be unreliable for some watch setups (chokidar/Vite/ts-node-dev), sometimes requiring `usePolling`/`CHOKIDAR_USEPOLLING=true`. The compose/Dockerfile setup must ensure hot-reload (FR-002/FR-003) actually fires reliably on this host OS, not just in principle.
   - Acceptance: hot-reload (FR-002, FR-003) is verified working on the actual Windows + Docker Desktop host this team develops on, not assumed from Linux-host documentation.
   - Priority: High

9. **FR-009: Environment variable management** — a documented, git-ignored `.env` (or per-service `.env`s) consumed by `docker-compose.yml`, with an `.env.example` committed to the repo (mirroring the existing `apps/backend/.env.example` convention) covering every variable the compose stack needs (`DATABASE_URL` components, `JWT_ACCESS_SECRET`, `NODE_ENV`, `VITE_API_BASE_URL`, exposed ports).
   - Acceptance: a new developer can `cp .env.example .env`, fill in nothing (or trivial placeholders), and run `docker compose up` successfully.
   - Priority: Medium

10. **FR-010: Convenience scripts** — root `package.json` scripts (matching the existing `dev:backend`/`dev:frontend`/`test:backend`/etc. naming convention) wrapping the common Docker Compose commands (e.g. `docker:up`, `docker:down`, `docker:logs`, `docker:reset-db`).
    - Acceptance: `npm run docker:up` from repo root is equivalent to the full `docker compose ...` invocation a developer would otherwise have to remember.
    - Priority: Low

## Non-Functional Requirements

1. **NFR-001: Time-to-productive** — a first-time `docker compose up` on a clean machine (Docker installed, repo cloned, `.env` copied) should reach a working, migrated, browsable full stack without any manual intervention beyond that single command.
   - Metric: zero manual steps between `docker compose up` and a working `localhost:<frontend-port>` login page.

2. **NFR-002: Hot-reload latency** — a source-file edit should be reflected (recompiled backend / HMR'd frontend) within a few seconds, comparable to today's native dev-server experience — this is the whole reason hot-reload was scoped in, so a regression here defeats the purpose.
   - Metric: perceptibly "instant" edit-to-reflected-change loop, no manual container restart in the common case.

3. **NFR-003: Isolation from host tooling** — the compose stack must not require anything installed on the host beyond Docker itself (no host Node/npm, no host Postgres) to reach a working state, while still allowing an already-Node-equipped developer to keep running things natively if they prefer (i.e. this is additive, not a replacement for the existing `npm run dev:*` workflow).
   - Metric: a machine with only Docker installed can fully develop against this stack.

4. **NFR-004: No port collisions with this repo's own existing ad-hoc setup** — a Postgres container was observed already running on the host at port 5432 (and another at 5445) outside this repo's control. The new compose-managed Postgres must not silently collide with those, either via a documented alternate host port or an explicit call-out that those ad-hoc containers should be stopped first.
   - Metric: `docker compose up` either succeeds cleanly or fails with an actionable port-conflict message, never a confusing "works some of the time" state.

## Business Rules

1. **BR-001**: No production Dockerfiles, multi-stage optimized builds, or deployment manifests are in scope for this task — dev-environment ergonomics only. A follow-up task should cover production images.
2. **BR-002**: No additional services (mail-catcher, pgAdmin, Redis, etc.) are in scope — only Postgres, backend, and frontend.
3. **BR-003**: The existing native `npm run dev:backend` / `dev:frontend` workflow must keep working unmodified — Docker is an additional, opt-in way to run the stack, not a replacement.

## Task Breakdown

### Compose Services

| Service | Image / Build | Ports (host:container) | Volumes | Purpose |
|---|---|---|---|---|
| `postgres` | `postgres:16` | `5432:5432` (or an alternate host port per NFR-004) | named volume for `/var/lib/postgresql/data` | Persistent dev database |
| `backend` | build from `apps/backend/Dockerfile.dev` | `3000:3000` | bind-mount `apps/backend` source (excluding `node_modules`); named volume for container-installed `node_modules` | NestJS API, hot-reload dev server |
| `frontend` | build from `apps/frontend/Dockerfile.dev` | `5173:5173` | bind-mount `apps/frontend` source (excluding `node_modules`); named volume for container-installed `node_modules` | Vite dev server, HMR |

### Dockerfiles

| File | Base Image | Purpose |
|---|---|---|
| `apps/backend/Dockerfile.dev` | `node:22-slim` (or repo's actual pinned Node version once confirmed) | Installs backend deps inside the image, runs `prisma migrate deploy` + `nest start --watch` |
| `apps/frontend/Dockerfile.dev` | `node:22-slim` | Installs frontend deps inside the image, runs `vite --host 0.0.0.0` |

### Supporting Config/Scripts

| File | Purpose |
|---|---|
| `docker-compose.yml` | Root orchestration file (FR-001) |
| `.env.example` (root, alongside/complementing `apps/backend/.env.example`) | Documents every compose-consumed variable (FR-009) |
| `.dockerignore` (per app) | Excludes `node_modules`, `dist`, `.git` etc. from build context |
| Root `package.json` script additions | `docker:up`, `docker:down`, `docker:logs`, `docker:reset-db` (FR-010) |

### Infra Tasks
- [ ] Write `docker-compose.yml` wiring all three services with correct `depends_on`/healthcheck ordering (backend should wait for Postgres to be *ready*, not just *started*)
- [ ] Write `apps/backend/Dockerfile.dev` with a `node_modules` volume strategy that avoids the host/container native-binary trap (FR-007)
- [ ] Write `apps/frontend/Dockerfile.dev` with the same `node_modules` volume strategy
- [ ] Add a migration-bootstrap step to backend container startup (FR-005)
- [ ] Verify/resolve Windows Docker Desktop file-watching reliability (FR-008) — may need `CHOKIDAR_USEPOLLING=true` / Vite `server.watch.usePolling`
- [ ] Add root `.env.example` covering the full compose stack
- [ ] Add root `package.json` convenience scripts

### Testing Tasks
- [ ] Fresh-clone smoke test: clean machine (or a scratch directory + fresh named volumes) → `docker compose up` → migrated DB + reachable login page, no manual steps
- [ ] Hot-reload verification: edit a backend `.ts` file and a frontend `.tsx` file while containers are running, confirm both reflect the change without a manual restart
- [ ] Data-persistence verification: `docker compose down` (no `-v`) then `up` again → prior data still present; `down -v` → clean slate
- [ ] Port-conflict behavior check against the host's pre-existing ad-hoc Postgres containers (NFR-004)

## Gap Analysis

- [ ] **Node version to pin** in the Dockerfiles isn't specified anywhere in the repo (no `engines` field, no CI config found). Assumed Node 22 LTS as a placeholder — needs confirmation during brainstorming/architecture, ideally matched to whatever version local developers already use.
- [ ] **Should Prisma seed data (`db:seed`) run automatically** on backend startup alongside `migrate deploy` (FR-005), or should seeding stay a manual, explicit step (e.g. via one of the FR-010 convenience scripts)? Auto-seeding is convenient for a fresh environment but could be surprising/unwanted on every restart.
- [ ] **Host port for Postgres**: keep `5432:5432` and expect the developer to stop conflicting ad-hoc containers first, or default this repo's compose Postgres to a non-standard host port (e.g. `55432:5432`) to sidestep the collision entirely? (NFR-004)
- [ ] **Convenience script mechanism**: root `package.json` scripts (matching existing `dev:*`/`test:*` naming) vs. a `Makefile` vs. relying on developers running `docker compose ...` directly. Leaning toward `package.json` scripts for consistency with the existing convention, but not yet confirmed.
- [ ] **CORS/cookie compatibility with containerized ports**: Epic-01's recently-added httpOnly-cookie auth uses `sameSite: 'lax'` cookies and `origin: true` CORS — this was validated working across different `localhost` ports (frontend/backend) during manual browser verification earlier, so containerizing onto different host ports should behave the same, but this should be explicitly re-verified once the containers exist rather than assumed.

## Next Steps (Suggested)

- `/brainstorm [TASK-009 context]` — work through the open gap-analysis questions above (Node version, auto-seed vs. manual, Postgres port strategy, convenience-script mechanism) before locking in a design.
- Alternative: `/architect [TASK-009 context]` if the gaps above are resolved quickly and a formal design pass isn't needed for what's fundamentally a tooling/infra task.
