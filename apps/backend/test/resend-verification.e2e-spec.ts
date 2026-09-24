import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('POST /auth/resend-verification (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should issue a fresh verification token for a real unverified account', async () => {
    const user = await seedUser(app, {
      role: Role.PLAYER,
      emailVerified: false,
    });

    await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: user.email })
      .expect(200);

    const tokens = await prisma.emailVerificationToken.findMany({
      where: { userId: user.id },
    });
    expect(tokens.length).toBeGreaterThanOrEqual(1);
  });

  it('should return 200 for an unknown email — no enumeration signal', async () => {
    await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: `nobody-${Date.now()}@example.com` })
      .expect(200);
  });

  it('should not create a token for an already-verified account', async () => {
    const user = await seedUser(app, {
      role: Role.PLAYER,
      emailVerified: true,
    });

    await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: user.email })
      .expect(200);

    const tokens = await prisma.emailVerificationToken.findMany({
      where: { userId: user.id },
    });
    expect(tokens).toHaveLength(0);
  });
});
