import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('Admin user lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should walk create-trainer -> deactivate -> reactivate -> delete/anonymize, preserving historical joins', async () => {
    const admin = await seedUser(app, { role: Role.SUPER_ADMIN });
    const email = `trainer-${Date.now()}@example.com`;

    const createResponse = await request(app.getHttpServer())
      .post('/admin/users')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        businessName: 'Acme Academy',
        firstName: 'T',
        lastName: 'Rainer',
        email,
      })
      .expect(201);
    const trainerId = (createResponse.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/admin/users/${trainerId}/deactivate`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    let user = await prisma.user.findUnique({ where: { id: trainerId } });
    expect(user?.status).toBe('INACTIVE');

    await request(app.getHttpServer())
      .post(`/admin/users/${trainerId}/reactivate`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    user = await prisma.user.findUnique({ where: { id: trainerId } });
    expect(user?.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .post(`/admin/users/${trainerId}/delete`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ reason: 'GDPR request' })
      .expect(200);

    user = await prisma.user.findUnique({ where: { id: trainerId } });
    expect(user?.status).toBe('DELETED');
    expect(user?.email).toBe(`deleted_${trainerId}@example.com`);

    const profile = await prisma.profile.findUnique({
      where: { userId: trainerId },
    });
    expect(profile?.firstName).toBe('Deleted');
    expect(profile?.lastName).toBe('User');

    const deletionLog = await prisma.userDeletionLog.findFirst({
      where: { originalUserId: trainerId },
    });
    expect(deletionLog?.originalEmailBackup).toBe(email);

    // Deletion is permanent — deactivate/reactivate on a DELETED user must fail.
    await request(app.getHttpServer())
      .post(`/admin/users/${trainerId}/deactivate`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(409);
  });

  it('should reject a non-Super-Admin from hitting admin endpoints', async () => {
    const trainer = await seedUser(app, { role: Role.TRAINER });
    await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${trainer.accessToken}`)
      .expect(403);
  });
});
