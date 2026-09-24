# System Architecture — accelerator-mini

npm-workspaces monorepo: `apps/backend` (NestJS 11 + Prisma 6.19 + Postgres) and `apps/frontend`
(React 19 + Vite 8 + Tailwind v4). Backend follows Layered Architecture
(Controller → Service → Repository) per module under `apps/backend/src/modules/<module>/`.

## Architecture Layers (baseline)

```
┌─────────────────────────────────────────────────────────┐
│ Presentation Layer (Controllers, DTOs)                   │
├─────────────────────────────────────────────────────────┤
│ Service Layer (Business Logic)                           │
├─────────────────────────────────────────────────────────┤
│ Data Access Layer (Repositories, Prisma entities)         │
└─────────────────────────────────────────────────────────┘
```

Dependency rules: Controller → Service → Repository only; any layer may use `shared/`; no
reverse dependencies (Repository → Service, Service → Controller are forbidden).

## Module Structure convention

```
apps/backend/src/modules/<module>/
├── <module>.module.ts
├── <module>.controller.ts
├── <module>.service.ts
├── <module>.repository.ts
├── dto/
└── entities/            # if applicable — schema lives in prisma/schema.prisma
```

---

### [TASK-009] Docker Development Environment (2026-07-23)

**Classification:** Cross-cutting dev-tooling/infra — this is **not** application code and does
not live under either app's `src/modules/`. It orchestrates both existing apps plus Postgres from
the repo root; the Controller/Service/Repository rules above are unaffected and unchanged.

**Placement decision:**

| Location | New/Changed files | Why here |
|---|---|---|
| Repo root | `docker-compose.yml`, `.env.example`, `.env` (gitignored), `package.json` (`docker:*` scripts) | Orchestration spans both apps + Postgres — no single app owns it |
| `apps/backend/` | `Dockerfile.dev`, `docker-entrypoint.sh`, `.dockerignore` | Per-app build definition stays with the app it builds |
| `apps/frontend/` | `Dockerfile.dev`, `.dockerignore`; edit `vite.config.ts` | Same; Vite proxy target becomes env-driven (`VITE_PROXY_TARGET`) instead of hardcoded `localhost:3000`, defaulting to the existing value so the native workflow (BR-003) is untouched |

**Pattern:** Multi-container Docker Compose (three services: `postgres`, `backend`, `frontend`),
dev-only. Hot-reload via host bind-mounts for source, combined with **named volumes shadowing
`node_modules`** so Linux-built native binaries (`bcrypt`, `sharp`) are never overwritten by
Windows-host binaries — this is the core architectural fix for FR-007, not an incidental detail.
No Controller/Service/Repository code changes; the only application-level touch is the
env-driven Vite proxy target.

**Key decisions:**

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Node base image | `node:22-slim` | Matches local dev Node (v22.16.0); glibc avoids Alpine/musl native-module pain |
| 2 | Seeding | Auto-seed every startup (`migrate deploy` → `db seed` in entrypoint) | `seed.ts` is already fully idempotent (upsert-keyed); gives zero-manual-step NFR-001. **Invariant going forward: seed.ts must stay upsert-only/re-runnable** |
| 3 | Postgres host port | `POSTGRES_HOST_PORT`, default `55432` | Avoids collision with pre-existing ad-hoc Postgres on 5432/5445 (NFR-004); container-internal networking always uses `postgres:5432` |
| 4 | Convenience scripts | Root `package.json` `docker:*` family | Matches existing `dev:*`/`test:*`/`build:*`/`lint:*` convention; no new host prerequisite beyond Docker |

Full service/volume/entrypoint layout, `.env` variable table, and Dockerfile sketches are
specified in `tasks/TASK-009/brainstorming-design.md` — treat that as the implementation-level
detail underneath these architectural decisions.

**Entity relationships:** None — no schema or Prisma entity changes.

**Security considerations:**
- [x] Authentication: unaffected — same httpOnly-cookie flow as Epic-01. CORS/cookie behavior
  (`sameSite: 'lax'`, `origin: true`) must be **re-verified** over containerized ports rather
  than assumed; this is a verification task, not an open design decision.
- [x] Secrets: dev-only, git-ignored root `.env`, placeholder values in committed `.env.example`;
  no real secrets committed. Seed accounts share a known dev password (`Qwerty!`) — acceptable
  for a local-only DB, already the case pre-containerization.
- [ ] Rate limiting / audit logging: not applicable — dev tooling doesn't add new request paths.
- Pre-existing `/uploads` unauthenticated-static-serving caveat (see
  `specs/docs-generator-implementation.md`) is unchanged by containerization.

**Scalability considerations:**
- Not applicable by design — this is a single-developer local dev environment (BR-001 explicitly
  excludes production/multi-stage images and deployment manifests). A follow-up task should cover
  production containerization.
- Named volumes (`pgdata`, `backend_node_modules`, `frontend_node_modules`) exist to fix the
  cross-platform native-module bug, not for performance/scale.

**Dependency rules impact:** None. This task wraps the existing layered backend in a container
runtime; it does not alter Controller → Service → Repository boundaries.

**Open verification items (carried from requirements — not architectural gaps):**
- Confirm `CHOKIDAR_USEPOLLING`/Vite `usePolling` actually fixes hot-reload on the team's real
  Windows + Docker Desktop build (FR-008).
- Re-verify CORS/cookie auth end-to-end through the containerized ports.
