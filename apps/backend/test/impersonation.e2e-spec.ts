import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('Impersonation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should start impersonation, act as the target, then exit — restoring nothing on the admin's real session", async () => {
    const admin = await seedUser(app, { role: Role.SUPER_ADMIN });
    const trainer = await seedUser(app, { role: Role.TRAINER });

    const startResponse = await request(app.getHttpServer())
      .post(`/admin/impersonation/${trainer.id}/start`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const startBody = startResponse.body as {
      impersonatedUser: { id: string };
      accessToken: string;
      refreshToken: string;
    };
    expect(startBody.impersonatedUser.id).toBe(trainer.id);
    const impersonationAccessToken = startBody.accessToken;

    // The admin's OWN token still works unaffected — the dual-token handoff
    // never overwrote the admin's real session.
    await request(app.getHttpServer())
      .get('/admin/impersonation/history')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const openLog = await prisma.impersonationLog.findFirst({
      where: { adminId: admin.id, targetUserId: trainer.id },
    });
    expect(openLog?.endedAt).toBeNull();

    await request(app.getHttpServer())
      .post('/admin/impersonation/exit')
      .set('Authorization', `Bearer ${impersonationAccessToken}`)
      .expect(204);

    const closedLog = await prisma.impersonationLog.findUnique({
      where: { id: openLog?.id },
    });
    expect(closedLog?.endedAt).not.toBeNull();
    expect(closedLog?.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should reject impersonating another Super Admin', async () => {
    const admin = await seedUser(app, { role: Role.SUPER_ADMIN });
    const otherAdmin = await seedUser(app, { role: Role.SUPER_ADMIN });

    await request(app.getHttpServer())
      .post(`/admin/impersonation/${otherAdmin.id}/start`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(403);
  });

  describe('dual-cookie handoff', () => {
    it("should set only impersonation_* cookies on start, never touching the admin's own access_token/refresh_token cookies", async () => {
      const admin = await seedUser(app, { role: Role.SUPER_ADMIN });
      const trainer = await seedUser(app, { role: Role.TRAINER });

      const startResponse = await request(app.getHttpServer())
        .post(`/admin/impersonation/${trainer.id}/start`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        // Simulates the admin's browser already carrying its own session
        // cookie from an earlier login — start() must never overwrite it.
        .set('Cookie', [`access_token=${admin.accessToken}`])
        .expect(200);

      const setCookie = startResponse.headers['set-cookie'] as unknown as
        string[] | undefined;
      expect(setCookie).toBeDefined();
      const impersonationAccessCookie = (setCookie ?? []).find((c) =>
        c.startsWith('impersonation_access_token='),
      );
      const impersonationRefreshCookie = (setCookie ?? []).find((c) =>
        c.startsWith('impersonation_refresh_token='),
      );
      expect(impersonationAccessCookie).toBeDefined();
      expect(impersonationRefreshCookie).toBeDefined();
      // No Set-Cookie entry for the admin's own cookie names at all.
      expect((setCookie ?? []).some((c) => c.startsWith('access_token='))).toBe(
        false,
      );
      expect(
        (setCookie ?? []).some((c) => c.startsWith('refresh_token=')),
      ).toBe(false);
    });

    it('should still return accessToken/refreshToken in the JSON body for the impersonated session (non-browser/API contract)', async () => {
      const admin = await seedUser(app, { role: Role.SUPER_ADMIN });
      const trainer = await seedUser(app, { role: Role.TRAINER });

      const startResponse = await request(app.getHttpServer())
        .post(`/admin/impersonation/${trainer.id}/start`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      const body = startResponse.body as {
        accessToken: string;
        refreshToken: string;
      };
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('should authenticate as the impersonated user when both cookies are present, and fall back to the admin after exit', async () => {
      const admin = await seedUser(app, { role: Role.SUPER_ADMIN });
      const trainer = await seedUser(app, { role: Role.TRAINER });

      const startResponse = await request(app.getHttpServer())
        .post(`/admin/impersonation/${trainer.id}/start`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      const setCookie = startResponse.headers[
        'set-cookie'
      ] as unknown as string[];
      const impersonationAccessCookie = setCookie
        .find((c) => c.startsWith('impersonation_access_token='))
        ?.split(';')[0] as string;

      // Both the admin's real cookie and the impersonation cookie are
      // present at once (the realistic browser state) — the impersonation
      // cookie must win.
      const meWhileImpersonating = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [
          `access_token=${admin.accessToken}`,
          impersonationAccessCookie,
        ])
        .expect(200);
      const impersonatedIdentity = meWhileImpersonating.body as {
        userId: string;
        impersonatedBy?: string;
      };
      expect(impersonatedIdentity.userId).toBe(trainer.id);
      expect(impersonatedIdentity.impersonatedBy).toBe(admin.id);

      const exitResponse = await request(app.getHttpServer())
        .post('/admin/impersonation/exit')
        .set('Cookie', [
          `access_token=${admin.accessToken}`,
          impersonationAccessCookie,
        ])
        .expect(204);

      const exitSetCookie = exitResponse.headers['set-cookie'] as unknown as
        string[] | undefined;
      expect(
        (exitSetCookie ?? []).some((c) =>
          c.startsWith('impersonation_access_token=;'),
        ),
      ).toBe(true);
      expect(
        (exitSetCookie ?? []).some((c) =>
          c.startsWith('impersonation_refresh_token=;'),
        ),
      ).toBe(true);
      // The admin's own cookie is never cleared by exit.
      expect(
        (exitSetCookie ?? []).some((c) => c.startsWith('access_token=')),
      ).toBe(false);

      // After exit, only the admin's original cookie remains — it still
      // authenticates as the admin, with no separate "restore" step.
      const meAfterExit = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [`access_token=${admin.accessToken}`])
        .expect(200);
      const adminIdentity = meAfterExit.body as {
        userId: string;
        impersonatedBy?: string;
      };
      expect(adminIdentity.userId).toBe(admin.id);
      expect(adminIdentity.impersonatedBy).toBeUndefined();
    });
  });

  it('should close the open ImpersonationLog on logout mid-impersonation', async () => {
    const admin = await seedUser(app, { role: Role.SUPER_ADMIN });
    const trainer = await seedUser(app, { role: Role.TRAINER });

    const startResponse = await request(app.getHttpServer())
      .post(`/admin/impersonation/${trainer.id}/start`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const impersonationRefreshToken = (
      startResponse.body as { refreshToken: string }
    ).refreshToken;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: impersonationRefreshToken })
      .expect(204);

    const log = await prisma.impersonationLog.findFirst({
      where: { adminId: admin.id, targetUserId: trainer.id },
      orderBy: { startedAt: 'desc' },
    });
    expect(log?.endedAt).not.toBeNull();
  });
});
