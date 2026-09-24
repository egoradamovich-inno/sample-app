// Unit tests instantiate services (TokenService, JwtStrategy, ...) directly,
// without bootstrapping Nest's ConfigModule/dotenv loading. This mirrors what
// a real deploy's process env provides so those modules' fail-fast checks
// (see shared/config/jwt.constants.ts) don't trip during a normal test run —
// it is intentionally not a hardcoded fallback shipped in application code,
// only a test-time default confined to this setup file.
process.env.JWT_ACCESS_SECRET ??= 'unit-test-jwt-access-secret';
