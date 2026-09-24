# ADR-001: Containerized Development Environment

## Status
Accepted

## Context

The `accelerator-mini` monorepo (NestJS backend + React frontend + Postgres) previously required manual setup steps:
- Ad-hoc Postgres instance on the developer's machine (port 5432 or 5445)
- `npm run dev:backend` and `npm run dev:frontend` run natively on the host
- Network configuration is implicit (hardcoded localhost:3000 in Vite, direct TCP connections)
- **Windows developers face cross-platform native-module mismatches**: `bcrypt` and `sharp` are prebuilt for Linux, but `node_modules` installed on Windows contains Windows binaries, causing failures when code runs in a Linux container (or vice versa)

This introduces friction in onboarding, limits environmental consistency, and is error-prone — developers must remember to start Postgres, set DATABASE_URL, run migrations, and seed the database manually.

## Decision

Introduce a **single-command, fully containerized development environment** using Docker Compose:

1. **Root `docker-compose.yml`** orchestrates three services: `postgres:16`, NestJS `backend`, React `frontend`
2. **Dev-only Dockerfile.dev files** for each app (lightweight, no multi-stage builds or production optimization)
3. **Hot-reload preserved**: Source code bind-mounted from the host; changes reflect immediately in running containers
4. **Auto-seeding on startup**: Backend entrypoint runs `prisma migrate deploy` and `db seed` before starting the server, ensuring zero-manual-step bootstrap
5. **Named volumes for node_modules**: Overlay the bind mounts so Linux-compiled binaries are never shadowed by host binaries — solving the native-module interop problem at its root
6. **Polling-based file watches**: Both Nest (via TSC) and Vite use polling to detect changes through Docker Desktop bind mounts on Windows
7. **Convenience scripts**: Root `package.json` includes `docker:up`, `docker:down`, `docker:logs`, `docker:reset-db`, `docker:seed` — no need to remember docker-compose syntax
8. **Native dev workflow unaffected**: `npm run dev:backend` and `dev:frontend` continue to work without changes for developers who prefer local execution

## Consequences

### Positive

- **Zero-friction onboarding**: `npm run docker:up:build` → browser at localhost:5173 with login ready; no separate Postgres setup, migration, or seed steps
- **Environmental consistency**: All developers run identical versions of Postgres, Node, and dependencies (binaries from image registry, not host)
- **Cross-platform native-module safety**: Named `node_modules` volumes eliminate Windows-vs-Linux binary mismatches for `bcrypt`, `sharp`, etc.
- **Hot-reload works reliably**: Polling watches ensure file detection works consistently on Docker Desktop, including for Windows hosts
- **Reversible**: Docker is additive; the native workflow is unaffected and available as a fallback
- **Simplifies CI/CD**: Future production deployment can reuse similar patterns (though production images will differ: multi-stage, optimized, secrets injected)

### Negative

- **Requires Docker Desktop installation** (non-negotiable for this approach; offsets by eliminating manual Postgres setup)
- **Polling watches add latency**: File-change detection can take 2–3 seconds vs. instant native fs events; acceptable for local dev, noticeable on a very-high-change-frequency file
- **Initial image build takes time**: `docker:up:build` downloads Node and Postgres base images and compiles dependencies; first run is ~2–5 minutes depending on network
- **Bind-mount performance on Windows**: Docker Desktop on Windows uses WSL2 / HYPER-V layer; file sync is slower than native; acceptable for typical edit-save cycles, potentially noticeable with large re-builds or many small file operations
- **Adds complexity to the codebase**: New .dockerignore files, Dockerfile.dev, entrypoint scripts, docker-compose.yml; developers must understand these to troubleshoot container issues

### Neutral

- **Port changes**: Postgres published to 55432 instead of 5432 (by default); configurable to avoid collisions with pre-existing instances
- **Seed accounts are ephemeral**: Dropped and regenerated on `docker:reset-db`; acceptable for dev, requires separate seeding strategy for staging/production

## References

- `specs/architect-architecture.md` — TASK-009 Docker architecture section
- `specs/docs-generator-implementation.md` — Docker development workflow, troubleshooting
- `docker-compose.yml` — Service definitions, volumes, environment configuration
- `apps/backend/Dockerfile.dev`, `apps/backend/docker-entrypoint.sh` — Backend container build and entrypoint
- `apps/frontend/Dockerfile.dev` — Frontend container build
- `apps/backend/prisma/seed.ts` — Auto-seeding logic (must remain idempotent)

## Invariants

1. **Seed script must be idempotent**: All writes in `seed.ts` must use `prisma.*.upsert()` with unique-field keys. This allows safe re-runs (e.g., on every container restart).
2. **Postgres port collision avoidance**: Default `POSTGRES_HOST_PORT` is 55432; must be overridable via `.env` for developers with non-standard setups.
3. **Node base image alignment**: `Dockerfile.dev` must use `node:22-slim` or later to match the local development Node version and avoid musl / glibc mismatches.
4. **Named volumes for native binaries**: Any `node_modules` must be a named volume (not bind-mounted) to preserve Linux-built native modules across Windows hosts.

## Decision Drivers

- **NFR-001** (Zero-manual-step bootstrap): Auto-seeding + health checks + dependencies
- **NFR-004** (Postgres port collision avoidance): Configurable `POSTGRES_HOST_PORT` with sensible default
- **FR-007** (Cross-platform native-module compatibility): Named volumes strategy
- **FR-008** (Reliable hot-reload on Windows): Polling-based file watches
- **BR-001** (Dev-only scope): No multi-stage, no production images in this ADR
- **BR-003** (Native workflow preservation): Docker is additive, not mandatory
