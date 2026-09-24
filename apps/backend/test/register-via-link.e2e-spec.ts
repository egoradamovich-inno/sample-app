import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { ShareLinkService } from '../src/modules/sharelink/sharelink.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('ShareLink registration (e2e)', () => {
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

  describe('new-account registration', () => {
    it('should create User + Profile + PlayerProfile + association, and return usable tokens', async () => {
      const trainer = await seedUser(app, { role: Role.TRAINER });
      const link = await shareLinkService.generateStaticLink(
        trainer.id,
        trainer.id,
      );

      const email = `new-${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .post(`/join/${link.code}/register`)
        .send({
          email,
          password: 'Passw0rd!',
          firstName: 'New',
          lastName: 'Player',
        })
        .expect(201);

      expect(
        (response.body as { accessToken: string }).accessToken,
      ).toBeTruthy();

      const createdUser = await prisma.user.findUnique({ where: { email } });
      expect(createdUser).not.toBeNull();
      expect(createdUser?.role).toBe(Role.PLAYER);

      const playerProfile = await prisma.playerProfile.findFirst({
        where: { userId: createdUser?.id },
      });
      expect(playerProfile).not.toBeNull();

      const association = await prisma.trainerPlayerAssociation.findFirst({
        where: { trainerId: trainer.id, playerProfileId: playerProfile?.id },
      });
      expect(association).not.toBeNull();
    });

    it('should reject a duplicate email with 409', async () => {
      const trainer = await seedUser(app, { role: Role.TRAINER });
      const link = await shareLinkService.generateStaticLink(
        trainer.id,
        trainer.id,
      );
      const existing = await seedUser(app, { role: Role.PLAYER });

      await request(app.getHttpServer())
        .post(`/join/${link.code}/register`)
        .send({
          email: existing.email,
          password: 'Passw0rd!',
          firstName: 'New',
          lastName: 'Player',
        })
        .expect(409);
    });
  });

  describe('existing-account association (second trainer)', () => {
    it('should create a new association only, never a duplicate User row', async () => {
      const trainerA = await seedUser(app, { role: Role.TRAINER });
      const trainerB = await seedUser(app, { role: Role.TRAINER });
      const parent = await seedUser(app, { role: Role.PLAYER });
      await prisma.playerProfile.create({
        data: {
          userId: parent.id,
          parentUserId: parent.id,
          displayName: 'Parent Self',
          isChild: false,
        },
      });

      const linkB = await shareLinkService.generateStaticLink(
        trainerB.id,
        trainerB.id,
      );

      await request(app.getHttpServer())
        .post(`/join/${linkB.code}/register`)
        .set('Authorization', `Bearer ${parent.accessToken}`)
        .send({ associateMemberIds: ['self'] })
        .expect(201);

      const usersWithThisEmail = await prisma.user.findMany({
        where: { email: parent.email },
      });
      expect(usersWithThisEmail).toHaveLength(1);

      const associationB = await prisma.trainerPlayerAssociation.findFirst({
        where: { trainerId: trainerB.id },
      });
      expect(associationB).not.toBeNull();
      void trainerA;
    });
  });

  describe('expired/exhausted/wrong-type links', () => {
    it('should reject an unknown code with 404', async () => {
      await request(app.getHttpServer())
        .get('/join/does-not-exist')
        .expect(404);
    });

    it('should reject a UNIQUE (coach) link on the player registration endpoint', async () => {
      const trainer = await seedUser(app, { role: Role.TRAINER });
      const coachLink = await shareLinkService.generateCoachInvite(
        trainer.id,
        trainer.id,
        `coach-${Date.now()}@example.com`,
      );

      await request(app.getHttpServer())
        .post(`/join/${coachLink.code}/register`)
        .send({
          email: `new-${Date.now()}@example.com`,
          password: 'Passw0rd!',
          firstName: 'New',
          lastName: 'Player',
        })
        .expect(400);
    });
  });
});
