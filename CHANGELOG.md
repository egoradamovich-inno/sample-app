# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-07-23

First release of the actual Training Platform application (user management, authentication, and a containerized dev environment) on top of the accelerator-core skill framework.

### Added
- **Epic-01: User Management & Authentication** (2e48d34)
  - NestJS `auth` module: JWT-based authentication with httpOnly refresh tokens
  - NestJS `users` module: Multi-role user management (SUPER_ADMIN, TRAINER, COACH, PLAYER)
  - NestJS `profile` module: User profile management with avatar/branding logo uploads
  - NestJS `coach-profile`, `player-profile` modules: Role-specific profile extensions
  - React authentication flow: Login/logout pages, protected routes via role-based guards
  - Idempotent seed accounts for all roles (emails provided in docs)
- **TASK-009: Docker Development Environment**
  - Root `docker-compose.yml` orchestrating Postgres 16 + NestJS backend + React frontend (e564d03)
  - Dev-only Dockerfile.dev, entrypoint, and dockerignore for the backend (51e008c)
  - Dev-only Dockerfile.dev for the frontend (2f2ba5b)
  - Frontend Vite proxy target made env-driven (`VITE_PROXY_TARGET`) for containerized backend discovery (1f4dfd1)
  - Root npm scripts: `docker:up`, `docker:up:build`, `docker:down`, `docker:logs`, `docker:reset-db`, `docker:seed` (fc2a0e9)
  - Named volumes for `node_modules` to preserve Linux-compiled native binaries across Windows hosts
  - Polling-based file watches (TSC + Vite) for reliable hot-reload on Docker Desktop for Windows

### Fixed
- Fix Prisma query-engine volume, generate cwd, and tsc watch polling in the Docker dev stack (5ee09cc)
- Add fallback defaults for Postgres/backend env vars so the stack runs without a hand-written `.env` (ae7fa0f)
- Derive `DATABASE_URL` from `POSTGRES_USER`/`PASSWORD`/`DB` by default, so the two can't drift out of sync (6d50986)

### Changed
- Documented the Docker development workflow, seed data reference, and troubleshooting guide in `specs/docs-generator-implementation.md`
- Documented TASK-009 Docker architecture decisions and rationale in `specs/architect-architecture.md`; added `docs/adr/ADR-001-containerized-dev-environment.md`
- Added a project-level `CLAUDE.md` with commands and architecture guidance

### Deployment Notes
- Dev environment now fully containerized; native `npm run dev:*` workflow remains unaffected and supported
- Postgres host port defaults to 55432 (avoids collision with pre-existing ad-hoc Postgres)
- Database is automatically migrated and seeded on first stack startup
- All seed accounts use `Qwerty!` password — change in staging/production seed logic

## [1.1.0] - 2026-05-18

### Added
- Add context graph — MOC-based skill navigation across 4 workflow phases (3ae9432)
- Add graphs for command > agent > skill flow (3fbebda)
- Add harness engineering: stabilization cycle, Definition of Done, golden principles, and automated hooks (bc975f0)
- Add WCAG accessibility skill — 30 rules across 8 categories (3ae9432)
- Add browser-verify skill (f36b5f6)
- Add review-pr skill (2d9ec09)
- Add ctx7 CLI skill and README (f081526)
- Add RTK, high-performance CLI proxy that reduces LLM token consumption by 60-90% (6ab0c22)

### Changed
- Update skill-creator with evals and benchmarking (b7d05f5)
- Update agent-browser (84516af)
- Replace MCP usage with CLI+Skill approach (7721cb4)

### Fixed
- Fix table appearance (62c17dd)
- Fix brainstorm to ask about libraries (68df0e0)
- Fix agent-browser to use CLI (624b262)

### Removed
- Remove prompt enhancer (1aa103a)

## [1.0.0] - 2026-02-10

### Added
- Add task management system (4d6da8e)
- Add new documentation system and flow (a8ca446)
- Add changelog/release skill (d712cc5)
- Add React best practices skill (8135458)
- Add git worktrees support (f08ed46)
- Add document generation capabilities (86a4fdf)
- Add task tool integration in commands (94fde83)
- Add updated agent configurations (a2d4edc)
- Include project-generator in flow (e1416b3)
- Add new flow without orchestration (71f7071)
- Add README (dd8064f)
- Add release workflow and skill updates (ee0e08f)

### Fixed
- Fix folder structure (f566ece)
- Fix lint spec descriptions (1aa3cf1)
- Fix manifest path resolution (5360449)
- Fix absolute paths (493d639)
- Fix worktree variant selection (853b0e4)
- Simplify commands (67c6841)
- Remove unnecessary commands (c0a595d)
- Fix lint issues (1e44a91)
