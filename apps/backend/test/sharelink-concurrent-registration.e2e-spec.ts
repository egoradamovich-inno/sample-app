import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { ShareLinkService } from '../src/modules/sharelink/sharelink.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

const CONCURRENT_REGISTRATIONS = 100;
const PER_REQUEST_BUDGET_MS = 2_000;

describe('Concurrent ShareLink registration (e2e, NFR-004)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let shareLinkService: ShareLinkService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    shareLinkService = app.get(ShareLinkService);
  });

  afterAll(async () => {
    await app.close();
  });

  it(`should handle ${CONCURRENT_REGISTRATIONS} concurrent registrations against one STATIC link with no duplicate/lost associations`, async () => {
    const trainer = await seedUser(app, { role: Role.TRAINER });
    const link = await shareLinkService.generateStaticLink(
      trainer.id,
      trainer.id,
    );

    const start = Date.now();
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_REGISTRATIONS }, (_, i) =>
        request(app.getHttpServer())
          .post(`/join/${link.code}/register`)
          .send({
            email: `concurrent-${i}-${Date.now()}@example.com`,
            password: 'Passw0rd!',
            firstName: 'Concurrent',
            lastName: `User${i}`,
          }),
      ),
    );
    const elapsedMs = Date.now() - start;

    const successes = responses.filter((r) => r.status === 201);
    expect(successes).toHaveLength(CONCURRENT_REGISTRATIONS);
    expect(elapsedMs / CONCURRENT_REGISTRATIONS).toBeLessThan(
      PER_REQUEST_BUDGET_MS,
    );

    const linkRow = await prisma.shareLink.findUnique({
      where: { code: link.code },
    });
    const associations = await prisma.trainerPlayerAssociation.findMany({
      where: { trainerId: trainer.id, shareLinkId: linkRow?.id },
    });
    expect(associations).toHaveLength(CONCURRENT_REGISTRATIONS);
    expect(linkRow?.useCount).toBe(CONCURRENT_REGISTRATIONS);
  }, 60_000);
});
