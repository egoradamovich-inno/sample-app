import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login rate limiting (FR-007)', () => {
    it('should return 429 on the 6th login attempt from the same IP within 60s', async () => {
      const credentials = {
        email: 'throttle-test@example.com',
        password: 'wrong-password',
      };

      const responses = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send(credentials);
        responses.push(response.status);
      }

      // First 5 are evaluated normally (401 for bad credentials); the 6th
      // is rejected by the throttler before it ever reaches AuthService.
      expect(responses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(responses[5]).toBe(429);
    });
  });

  describe('ValidationPipe error contract (spec error catalog)', () => {
    it('should return errorCode VALIDATION_ERROR with field-level details for a malformed register body', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'short',
          firstName: '',
          lastName: '',
        })
        .expect(400);

      const body = response.body as {
        statusCode: number;
        errorCode: string;
        message: string;
        details: Record<string, string[]>;
      };

      expect(body.statusCode).toBe(400);
      expect(body.errorCode).toBe('VALIDATION_ERROR');
      expect(typeof body.message).toBe('string');
      expect(body.details.email).toBeInstanceOf(Array);
      expect(body.details.email.length).toBeGreaterThan(0);
      expect(body.details.password).toBeInstanceOf(Array);
      expect(body.details.firstName).toBeInstanceOf(Array);
    });

    it('should reject unknown fields via forbidNonWhitelisted with the same VALIDATION_ERROR shape', async () => {
      // /auth/register (not /auth/login) — the login throttle test above
      // already exhausts /auth/login's 5-per-60s quota for this suite run.
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'whitelist-test@example.com',
          password: 'Passw0rd!',
          firstName: 'A',
          lastName: 'B',
          isAdmin: true,
        })
        .expect(400);

      const body = response.body as { errorCode: string };
      expect(body.errorCode).toBe('VALIDATION_ERROR');
    });
  });
});
