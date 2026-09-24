# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Two things layered together:

1. **accelerator-mini** — the actual application: an npm-workspaces monorepo with `apps/backend` (NestJS 11 + Prisma 6.19 + PostgreSQL) and `apps/frontend` (React 19 + Vite 8 + Tailwind v4), a skill-based training/coaching platform (trainers, coaches, players, admin/impersonation).
2. **accelerator-core** — a skill-based extension framework for Claude Code itself (`.claude/agents`, `.claude/commands`, `.claude/skills`, `.claude/hooks`) that this session runs inside of. Policy rules for how agents must behave in this repo live in `AGENTS.md` — read it; it is enforced, not advisory.

## Commands

All commands below are run from the repo root and target a workspace via `--workspace`.

```bash
# Dev servers (native, no Docker)
npm run dev:backend          # nest start --watch (apps/backend)
npm run dev:frontend         # vite (apps/frontend)

# Tests
npm run test:backend         # jest, apps/backend
npm run test:frontend        # vitest --run, apps/frontend

# Single test
npx jest path/to/file.spec.ts --config apps/backend/package.json   # backend, one file
npx vitest run src/pages/LoginPage.test.tsx --root apps/frontend   # frontend, one file

# Lint
npm run lint:backend         # eslint --fix
npm run lint:frontend        # oxlint

# Build
npm run build:backend        # nest build
npm run build:frontend       # tsc -b && vite build

# Docker dev stack (Postgres + backend + frontend, hot-reload)
npm run docker:up            # start existing containers
npm run docker:up:build      # rebuild images and start (first run / after Dockerfile or dep changes)
npm run docker:down          # stop (keeps DB volume)
npm run docker:reset-db      # wipe DB volume and reseed
npm run docker:logs
npm run docker:seed          # run db:seed inside the running backend container

# Prisma (apps/backend)
npm run db:init --workspace apps/backend   # prisma migrate deploy
npm run db:seed --workspace apps/backend   # prisma db seed (ts-node prisma/seed.ts)
npm run db:setup --workspace apps/backend  # both
```

Backend test files are colocated as `*.spec.ts` next to the code they test (Jest `rootDir` is `src`, `testRegex` is `.*\.spec\.ts$`). Frontend test files are colocated as `*.test.tsx` next to components/pages. There's also `apps/backend/test/` for e2e (`npm run test:e2e --workspace apps/backend`).

Docker Compose reads a root `.env` (git-ignored, copy from `.env.example`) — **not** `.env.example` directly. `POSTGRES_HOST_PORT` defaults to `55432` (not `5432`) specifically to avoid colliding with a pre-existing local Postgres; don't "fix" it back to `5432`. See `docs/adr/ADR-001-containerized-dev-environment.md` for the full rationale (named `node_modules` volumes for cross-platform native binaries like `bcrypt`/`sharp`, polling-based watch for Windows bind mounts, auto-migrate+seed entrypoint).

## Backend architecture (`apps/backend/src`)

- Layered per-module: `<module>.controller.ts` → `<module>.service.ts` → `PrismaService` directly. There is **no separate repository layer** despite what some specs say — services call `this.prisma.<model>.*` inline (see `modules/users/user-admin.service.ts`). Don't introduce a repository abstraction unless asked; match the existing pattern.
- Modules live under `src/modules/<module>/` (auth, users, profile, coach-profile, player-profile, impersonation, availability, branding, camp-conversion, purchase-approval, sharelink, trainer-roster). Cross-cutting code is in `src/shared/` (guards, decorators, cookies, errors, prisma, storage, email, config).
- Global guard chain (order matters, see `app.module.ts`): `JwtAuthGuard` → `RolesGuard` → `ChildAccountGuard` → `ThrottlerGuard`. `JwtAuthGuard` populates `req.user` first; `RolesGuard` depends on it. Use `@Public()` to bypass auth on a route, `@Roles(Role.X)` to restrict it.
- Auth is cookie-based, not bearer-token-from-client: `main.ts` sets `credentials: true` CORS + `cookie-parser`; access/refresh tokens (and separate impersonation-session tokens) ride as httpOnly cookies. `apps/frontend/src/api/client.ts` relies on `withCredentials: true` and does the 401→refresh→retry dance itself — there's no client-readable token to attach manually.
- `main.ts` does `import 'dotenv/config'` as the very first line, before any local import — `AuthModule`'s import graph reads `process.env` at module-import time (`shared/config/jwt.constants.ts`) to fail fast on a missing `JWT_ACCESS_SECRET`, which happens before `ConfigModule.forRoot()`'s own dotenv loading would run.
- Global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform) with a custom `exceptionFactory` → `ValidationException`, and a global `AppExceptionFilter` — error responses follow that contract, not Nest's default.
- `/uploads` is served via Express static middleware (`useStaticAssets`), which sits **outside** the Nest guard chain — it's unauthenticated by design (filenames are UUID/timestamp-based, not guessable). Don't put anything sensitive under `uploads/`.
- Prisma schema: `apps/backend/prisma/schema.prisma`, generated client output is `apps/backend/generated/prisma` (not the default `node_modules/.prisma`). `Role` enum is `SUPER_ADMIN | TRAINER | COACH | PLAYER` — there is no `PARENT` role; parent/child accounts are both `PLAYER`, linked via `User.parentUserId` (self-relation) and mirrored on `PlayerProfile.parentUserId`.
- `prisma/seed.ts` **must stay idempotent** (`upsert` keyed on unique fields, empty `update: {}`) — the Docker entrypoint runs it on every container startup.

## Frontend architecture (`apps/frontend/src`)

- Routing in `App.tsx`: public routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/join/:code`, `/coach/public/:slug`) plus a `PrivateRoute` guard wrapping an `AppShell` layout that contains all authenticated routes (profile, players, coach, admin, trainer pages).
- `PrivateRoute` (`routes/PrivateRoute.tsx`) resolves auth asynchronously via `AuthContext` (a cookie-backed `GET /auth/me` check), not a synchronous localStorage read — it renders nothing while `isInitializing`, rather than bouncing a valid session to `/login` on refresh.
- `api/client.ts` is a shared axios instance (`baseURL: /api`, `withCredentials: true`) with a response interceptor that, on a single 401, calls `/auth/refresh` (de-duped across concurrent requests via a shared in-flight promise) and replays the original request once. Per-domain calls live in `api/endpoints/*.ts` (auth, admin-users, admin-impersonation, profile, coach, player-profiles, availability, branding, purchase-approvals, sharelinks, trainer-roster).
- Pages are organized by role under `pages/admin/`, `pages/coach/`, `pages/player/`, `pages/trainer/`, plus shared pages at `pages/` top level (login/register/password/verify/join).
- Vite dev server proxies `/api` (stripping the prefix) and `/uploads` to `VITE_PROXY_TARGET` (`vite.config.ts`), which defaults to `http://localhost:3000` for native dev and is overridden to `http://backend:3000` inside Docker via the `VITE_PROXY_TARGET` env var from `docker-compose.yml`. If the frontend container logs `ECONNREFUSED 127.0.0.1:3000`, it's running with a stale env — `docker compose up -d --force-recreate frontend`.

## Working in this repo as an agent

`AGENTS.md` has the enforceable rules; the highlights that aren't obvious from the code:

- Output files created by skills/agents must be prefixed with the skill name (`{skill-name}-{purpose}.md`); task docs go in zero-padded `tasks/TASK-{N}/` (check `tasks/.task-counter` first); permanent specs go in `specs/` and must be indexed in `specs/MANIFEST.md` (read it before writing new specs).
- Never read, write, or edit `.env`/`.env.*` files or anything under `secrets/` — this is enforced via `.claude/settings.json` deny rules (`Read`/`Edit`/`Write` on `.env*` are hard-blocked). If a Docker/env issue needs investigating, reason from `docker-compose.yml` and `.env.example` (tracked) and ask the user to check/edit their real `.env` themselves.
- Don't invent API routes, DTOs, or roles when writing specs/docs — verify against the actual controllers (`grep` for `@Get`/`@Post`/etc.) and `schema.prisma` before documenting them. This has bitten this repo before (a docs pass fabricated a `/users` REST surface and a nonexistent `PARENT` role that don't match the real `/admin/users`, `/profile/me`, `/admin/impersonation/*` routes and the actual `Role` enum).
- Run tests and lint for whichever workspace you touched before claiming a task done; don't skip pre-commit hooks or force-push.
