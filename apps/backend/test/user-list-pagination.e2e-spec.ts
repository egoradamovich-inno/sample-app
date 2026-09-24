import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Role, UserStatus } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

const SEED_COUNT = 10_000;
const PERFORMANCE_BUDGET_MS = 3_000;

describe('User list pagination at scale (e2e, NFR-002)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // Bulk-insert via createMany (single round trip) rather than 10k
    // individual creates — seeding speed isn't what's under test here.
    const passwordHash = await bcrypt.hash('Passw0rd!', 4);
    const users = Array.from({ length: SEED_COUNT }, () => ({
      email: `${randomUUID()}@perf-test.example.com`,
      passwordHash,
      role: Role.PLAYER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    }));
    await prisma.user.createMany({ data: users });
  }, 120_000);

  afterAll(async () => {
    // Same rationale as beforeAll's override: deleting 10k rows can exceed
    // Jest's default 5s hook timeout under full-suite DB contention, even
    // though the delete itself completes — this only widens the deadline.
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@perf-test.example.com' } },
    });
    await app.close();
  }, 120_000);

  it(`should load a paginated user list in under ${PERFORMANCE_BUDGET_MS}ms with ${SEED_COUNT} users`, async () => {
    const admin = await seedUser(app, { role: Role.SUPER_ADMIN });

    const start = Date.now();
    const response = await request(app.getHttpServer())
      .get('/admin/users')
      .query({ page: 1, pageSize: 20 })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const elapsedMs = Date.now() - start;

    const body = response.body as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(20);
    expect(body.total).toBeGreaterThanOrEqual(SEED_COUNT);
    expect(elapsedMs).toBeLessThan(PERFORMANCE_BUDGET_MS);
  }, 30_000);
});
