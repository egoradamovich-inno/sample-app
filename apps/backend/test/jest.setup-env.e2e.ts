import { config } from 'dotenv';
import { resolve } from 'path';

// Runs before any e2e spec file (and therefore before its `import
// '../src/app.module'` chain) loads. This matters because
// shared/config/jwt.constants.ts now fails fast at *module-import* time if
// JWT_ACCESS_SECRET is unset — ConfigModule.forRoot()'s own dotenv loading
// happens too late to help, since it only runs once AppModule's decorator
// metadata is evaluated, which is *after* all of AppModule's own imports
// (AuthModule -> ... -> jwt.constants.ts) have already executed. Loading
// .env here, ahead of any spec file's imports, closes that ordering gap.
config({ path: resolve(__dirname, '../.env') });

// Local safety net only (never a substitute for a real .env in CI/deploy):
// keeps e2e specs runnable even if .env is missing JWT_ACCESS_SECRET.
process.env.JWT_ACCESS_SECRET ??= 'e2e-test-jwt-access-secret';
