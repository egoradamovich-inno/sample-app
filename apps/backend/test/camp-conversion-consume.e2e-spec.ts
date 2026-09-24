import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { CampConversionService } from '../src/modules/camp-conversion/camp-conversion.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('Camp-conversion draft consume-and-associate (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let campConversionService: CampConversionService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    campConversionService = app.get(CampConversionService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registering with a draftToken invalidates the draft and associates the new account with the named trainer', async () => {
    const trainer = await seedUser(app, { role: Role.TRAINER });
    const email = `camp-${Date.now()}@example.com`;
    const { draftToken } = campConversionService.createPrefillDraft({
      firstName: 'Camp',
      lastName: 'Kid',
      email,
      trainerId: trainer.id,
      playerName: 'Camp Kid',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Passw0rd!',
        firstName: 'Camp',
        lastName: 'Kid',
        draftToken,
      })
      .expect(201);

    const createdUserId = (response.body as { id: string }).id;
    expect(createdUserId).toBeTruthy();

    const playerProfile = await prisma.playerProfile.findFirst({
      where: { userId: createdUserId },
    });
    expect(playerProfile).not.toBeNull();

    const association = await prisma.trainerPlayerAssociation.findFirst({
      where: { trainerId: trainer.id, playerProfileId: playerProfile?.id },
    });
    expect(association).not.toBeNull();

    // The draft must now be invalidated — the GET-for-prefill lookup 404s.
    await request(app.getHttpServer())
      .get(`/camp-conversion/draft/${draftToken}`)
      .expect(404);
  });

  it('a second registration attempt reusing the same (already-consumed) draftToken fails clearly, not with a 500', async () => {
    const trainer = await seedUser(app, { role: Role.TRAINER });
    const firstEmail = `camp-first-${Date.now()}@example.com`;
    const secondEmail = `camp-second-${Date.now()}@example.com`;
    const { draftToken } = campConversionService.createPrefillDraft({
      firstName: 'Camp',
      lastName: 'Kid',
      email: firstEmail,
      trainerId: trainer.id,
    });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: firstEmail,
        password: 'Passw0rd!',
        firstName: 'Camp',
        lastName: 'Kid',
        draftToken,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: secondEmail,
        password: 'Passw0rd!',
        firstName: 'Camp',
        lastName: 'Kid2',
        draftToken,
      });

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(500);

    // The account from the second attempt was still created (registration
    // itself is a separate, already-committed step) but must not have
    // picked up any trainer association since its draft consume failed.
    const secondUser = await prisma.user.findUnique({
      where: { email: secondEmail },
    });
    expect(secondUser).not.toBeNull();
    const secondPlayerProfile = await prisma.playerProfile.findFirst({
      where: { userId: secondUser?.id },
    });
    expect(secondPlayerProfile).toBeNull();
  });

  it('registering without a draftToken behaves exactly as before (no association attempted)', async () => {
    const email = `no-draft-${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Passw0rd!',
        firstName: 'Plain',
        lastName: 'User',
      })
      .expect(201);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
  });
});
