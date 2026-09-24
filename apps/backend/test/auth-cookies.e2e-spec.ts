import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('Auth httpOnly cookies (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Tokens are minted directly via seedUser()'s TokenService.issuePair() call
  // (the documented pattern this codebase already uses to avoid tripping the
  // 5/60s IP-keyed login throttle) and attached as a raw Cookie header —
  // this file only exercises *one* real /auth/login call, dedicated to
  // proving login's cookie-setting shape/attributes.

  it('should set httpOnly access_token and refresh_token cookies on login, alongside the unchanged JSON body', async () => {
    const email = `${Date.now()}-login@example.com`;
    const passwordHash = await bcrypt.hash('Passw0rd!', 4);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.PLAYER,
        emailVerified: true,
        profile: { create: { firstName: 'Cookie', lastName: 'Tester' } },
      },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Passw0rd!' })
      .expect(200);

    const body = response.body as {
      accessToken: string;
      refreshToken: string;
      user: { email: string };
    };
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.user.email).toBe(email);

    const setCookie = response.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toBeDefined();
    const accessCookie = setCookie.find((c) => c.startsWith('access_token='));
    const refreshCookie = setCookie.find((c) => c.startsWith('refresh_token='));
    expect(accessCookie).toBeDefined();
    expect(accessCookie).toMatch(/HttpOnly/i);
    expect(accessCookie).toMatch(/SameSite=Lax/i);
    expect(accessCookie).toMatch(/Path=\//i);
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
  });

  it('should authenticate a request using only the access_token cookie, with no Authorization header', async () => {
    const user = await seedUser(app, { role: Role.PLAYER });

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', [`access_token=${user.accessToken}`])
      .expect(200);

    expect((meResponse.body as { email: string }).email).toBe(user.email);
  });

  it('should refresh using only the refresh_token cookie, with no body', async () => {
    const user = await seedUser(app, { role: Role.PLAYER });

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refresh_token=${user.refreshToken}`])
      .send({})
      .expect(200);

    const body = refreshResponse.body as {
      accessToken: string;
      refreshToken: string;
    };
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');

    // The new access_token cookie set by this response authenticates too.
    const setCookie = refreshResponse.headers['set-cookie'] as unknown as
      string[] | undefined;
    const newAccessCookie = (setCookie ?? [])
      .find((c) => c.startsWith('access_token='))
      ?.split(';')[0];
    expect(newAccessCookie).toBeDefined();

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', [newAccessCookie as string])
      .expect(200);
    expect((meResponse.body as { email: string }).email).toBe(user.email);
  });

  it('should reject refresh with a 401-class error when neither body nor cookies carry a refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(401);
  });

  it('should clear both cookies on logout', async () => {
    const user = await seedUser(app, { role: Role.PLAYER });

    const logoutResponse = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', [`refresh_token=${user.refreshToken}`])
      .send({})
      .expect(204);

    const setCookie = logoutResponse.headers['set-cookie'] as unknown as
      string[] | undefined;
    expect(setCookie).toBeDefined();
    const clearedAccess = (setCookie ?? []).find((c) =>
      c.startsWith('access_token='),
    );
    const clearedRefresh = (setCookie ?? []).find((c) =>
      c.startsWith('refresh_token='),
    );
    expect(clearedAccess).toMatch(/access_token=;/);
    expect(clearedRefresh).toMatch(/refresh_token=;/);

    // The revoked refresh token can no longer be used to refresh.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refresh_token=${user.refreshToken}`])
      .send({})
      .expect(401);
  });

  describe('GET /auth/me', () => {
    it("should return the caller's identity in the documented shape", async () => {
      const user = await seedUser(app, { role: Role.PLAYER });

      const meResponse = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      const body = meResponse.body as {
        userId: string;
        email: string;
        role: string;
        parentUserId: string | null;
        impersonatedBy?: string;
      };
      expect(body.userId).toBe(user.id);
      expect(body.email).toBe(user.email);
      expect(body.role).toBe('PLAYER');
      expect(body.parentUserId).toBeNull();
      expect(body.impersonatedBy).toBeUndefined();
    });

    it('should still authenticate via the Authorization header for non-browser/API clients', async () => {
      const user = await seedUser(app, { role: Role.PLAYER });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
    });

    it('should reject an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });
});
