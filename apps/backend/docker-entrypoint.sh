#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[entrypoint] Applying pending Prisma migrations..."
npm run db:init

echo "[entrypoint] Seeding database (idempotent upserts)..."
npm run db:seed

echo "[entrypoint] Starting NestJS in watch mode..."
exec npx nest start --watch
