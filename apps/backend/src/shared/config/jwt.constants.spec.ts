// Re-requiring the module under test (rather than a static top-level import)
// is deliberate here: `jest.resetModules()` + a fresh `require()` is the only
// way to observe the module-load-time throw for different process.env states
// within a single test file.
function requireFreshJwtConstants(): typeof import('./jwt.constants') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./jwt.constants') as typeof import('./jwt.constants');
}

describe('jwt.constants', () => {
  const ORIGINAL_SECRET = process.env.JWT_ACCESS_SECRET;

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.JWT_ACCESS_SECRET;
    } else {
      process.env.JWT_ACCESS_SECRET = ORIGINAL_SECRET;
    }
    jest.resetModules();
  });

  it('should throw a clear startup error instead of falling back to a hardcoded default when JWT_ACCESS_SECRET is unset', () => {
    delete process.env.JWT_ACCESS_SECRET;
    jest.resetModules();

    expect(() => requireFreshJwtConstants()).toThrow(
      /Missing required environment variable: JWT_ACCESS_SECRET/,
    );
  });

  it('should throw when JWT_ACCESS_SECRET is set to an empty string', () => {
    process.env.JWT_ACCESS_SECRET = '';
    jest.resetModules();

    expect(() => requireFreshJwtConstants()).toThrow(
      /Missing required environment variable: JWT_ACCESS_SECRET/,
    );
  });

  it('should export the configured secret when JWT_ACCESS_SECRET is set', () => {
    process.env.JWT_ACCESS_SECRET = 'a-real-secret';
    jest.resetModules();

    const { JWT_ACCESS_SECRET } = requireFreshJwtConstants();
    expect(JWT_ACCESS_SECRET).toBe('a-real-secret');
  });
});
