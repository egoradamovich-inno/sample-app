# Production image: NestJS backend serving both /api and the built frontend SPA
# as one process on one port (Constitution Principle III).

FROM node:22-slim AS builder

# bcrypt/sharp native build toolchain + OpenSSL for Prisma's query engine
# (same toolchain as apps/backend/Dockerfile.dev, for the same reason).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# npm workspaces: npm ci needs the root lockfile + every workspace's package.json.
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

RUN npm ci

# Only prisma/ (not the rest of apps/backend, and not prisma.config.ts) copied before
# `generate` — same reason as apps/backend/Dockerfile.dev: prisma.config.ts's
# `datasource: { url: env("DATABASE_URL") }` is evaluated eagerly the moment the Prisma CLI
# loads that config file, for any subcommand including `generate`, and DATABASE_URL is a
# real runtime value (K8s Secret) that doesn't exist at build time. Without prisma.config.ts
# present yet, the CLI falls back to reading prisma/schema.prisma directly, which doesn't
# eagerly need DATABASE_URL for `generate`. Verified by building this exact sequence: copying
# the full apps/backend tree (including prisma.config.ts) before `generate` reproducibly fails
# with "PrismaConfigEnvError: Missing required environment variable: DATABASE_URL".
COPY apps/backend/prisma ./apps/backend/prisma

# Run from apps/backend (matches how native db:init/db:setup invoke it) so engine paths are
# cwd-relative the same way they are natively.
RUN cd apps/backend && npx prisma generate
# On this Prisma version (6.19.3), `prisma generate` emits relative imports/exports with a
# ".ts" extension when run on Linux, but ".js" when run on Windows. The ".ts" form breaks at
# runtime (Node expects the compiled ".js" sibling, not the source ".ts"), causing a
# MODULE_NOT_FOUND for every generated/prisma/internal/*.ts import. Normalize back to ".js"
# (same fix as apps/backend/Dockerfile.dev).
RUN find apps/backend/generated/prisma -type f -name '*.ts' ! -name '*.d.ts' -print0 \
  | xargs -0 sed -i -E "s/(from [\"'])([^\"']+)\.ts([\"'])/\1\2.js\3/g"

# Now safe to bring in the rest of the source (including prisma.config.ts) — generate has
# already run, and prisma.config.ts is only eagerly read by prisma CLI invocations, not by
# `nest build`/`vite build` below.
COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

RUN npm run build --workspace apps/frontend
RUN npm run build --workspace apps/backend

# Drop devDependencies from the already-installed node_modules rather than a second
# `npm ci --omit=dev` — keeps bcrypt/sharp's native bindings (already compiled above) intact,
# since prune only removes packages, it doesn't rebuild the ones that remain.
RUN npm prune --omit=dev

FROM node:22-slim AS runtime

# Prisma's query engine binary needs OpenSSL + CA certs at runtime, same as at generate-time;
# no compiler toolchain needed here since node_modules' native bindings are copied prebuilt.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --shell /bin/bash appuser

# node:22-slim bundles npm 10.9.9, whose own vendored dependencies (brace-expansion,
# ip-address, pacote, picomatch, sigstore) carry HIGH-severity CVEs with real fixes
# available upstream — confirmed via a real Trivy scan and by upgrading and checking the
# actual bundled versions. The running app never invokes npm itself, but the migration
# Job's `npx prisma migrate deploy` (same image, different command) does need npm/npx
# present, so it's upgraded in place rather than removed.
RUN npm install -g npm@latest

WORKDIR /app/apps/backend

# node_modules lives at /app (one level above cwd): Node's module resolution walks up parent
# directories, so it's found from here the same way npm workspaces hoisting relies on.
COPY --from=builder /app/node_modules /app/node_modules
# main.ts resolves `uploads`/`public` as process.cwd()-relative paths, and process.cwd() here
# is /app/apps/backend — matching the existing native-dev and Dockerfile.dev convention
# (docker-entrypoint.sh does `cd "$(dirname "$0")"` before starting Nest for the same reason),
# not repo root.
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/generated ./generated
# prisma/schema.prisma + prisma/migrations: needed by the migration Job's
# `npx prisma migrate deploy`, which runs from this same image (data-model.md's Migration Job
# entity) — not needed by the app process itself, but this is the one image both run from.
COPY --from=builder /app/apps/backend/prisma ./prisma
# prisma.config.ts (schema/migrations paths, engine: classic) is what `npx prisma migrate
# deploy` actually reads — the deprecated package.json#prisma field is a fallback prisma warns
# about but doesn't require; this repo already uses prisma.config.ts.
COPY --from=builder /app/apps/backend/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/apps/frontend/dist ./public

RUN mkdir -p ./uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 3000
# Not dist/main.js: tsc's inferred rootDir spans both src/ and the backend-root
# prisma.config.ts, so compiled output preserves src/ as a subfolder (dist/src/main.js) rather
# than flattening it — verified by actually building and inspecting the image; this also means
# the repo's own package.json `start:prod` script ("node dist/main") is stale for the same
# reason, pre-existing and out of scope for this feature to fix.
CMD ["node", "dist/src/main.js"]
