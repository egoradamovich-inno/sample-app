function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fail fast at boot rather than silently running on a public,
    // source-committed default — a misconfigured deploy must not start.
    throw new Error(
      `Missing required environment variable: ${name}. Set it in your .env ` +
        `(see .env.example) before starting the app.`,
    );
  }
  return value;
}

export const JWT_ACCESS_SECRET = getRequiredEnv('JWT_ACCESS_SECRET');
export const JWT_ACCESS_EXPIRES_IN = '15m';
export const JWT_ACCESS_EXPIRES_IN_SECONDS = 15 * 60;
export const JWT_REFRESH_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;
export const JWT_IMPERSONATION_REFRESH_EXPIRES_IN_MS = 60 * 60 * 1000;
