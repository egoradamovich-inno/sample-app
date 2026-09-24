# Project: accelerator-mini

npm-workspaces monorepo for a NestJS + React training/coaching platform: `apps/backend`
(NestJS 11 + Prisma 6.19 + Postgres) and `apps/frontend` (React 19 + Vite 8 + Tailwind v4).

## Specs Index

| File | Purpose | Depends On | Last Updated |
|------|---------|------------|--------------|
| architect-architecture.md | System design, components, data flow | - | 2026-07-23 |
| api-designer-spec.md | Endpoints, schemas, authentication | architect-architecture | - |
| frontend-design-spec.md | Pages, components, state management | architect-architecture, api-designer-spec | - |
| docs-generator-implementation.md | Build process, deployment, tooling | - | 2026-07-23 |

## Key Decisions

- Backend: Layered Architecture (Controller → Service → Repository) per module under `apps/backend/src/modules/`.
- [TASK-009] Local dev environment is containerized via root `docker-compose.yml` (Postgres + backend + frontend), dev-only — see architect-architecture.md.

## Tech Stack

- Backend: NestJS 11, Prisma 6.19, PostgreSQL 16
- Frontend: React 19, Vite 8, Tailwind v4
- Dev tooling: Docker Compose (Postgres + backend + frontend), Node 22-slim base image ([TASK-009])

---

*This manifest is updated automatically by architect, api-designer, and frontend-design skills.*
*See `../spec-desc.md` for specification structure guidelines.*
