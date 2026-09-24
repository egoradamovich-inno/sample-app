import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { ShareLinkService } from '../src/modules/sharelink/sharelink.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('Family / child-profile associations (e2e)', () => {
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

  async function createParentWithSelfProfile() {
    const parent = await seedUser(app, { role: Role.PLAYER });
    await prisma.playerProfile.create({
      data: {
        userId: parent.id,
        parentUserId: parent.id,
        displayName: 'Parent Self',
        isChild: false,
      },
    });
    return parent;
  }

  describe('POST /players/child', () => {
    it('should create a child profile and validate age 1-18', async () => {
      const parent = await createParentWithSelfProfile();
      const tooOld = new Date();
      tooOld.setFullYear(tooOld.getFullYear() - 25);

      await request(app.getHttpServer())
        .post('/players/child')
        .set('Authorization', `Bearer ${parent.accessToken}`)
        .send({
          displayName: 'Too Old',
          birthDate: tooOld.toISOString(),
          gender: 'other',
        })
        .expect(400);
    });

    it('should signal trainerSelectionPrompt="single" when the parent has exactly one trainer', async () => {
      const parent = await createParentWithSelfProfile();
      const trainer = await seedUser(app, { role: Role.TRAINER });
      const link = await shareLinkService.generateStaticLink(
        trainer.id,
        trainer.id,
      );
      await request(app.getHttpServer())
        .post(`/join/${link.code}/register`)
        .set('Authorization', `Bearer ${parent.accessToken}`)
        .send({ associateMemberIds: ['self'] })
        .expect(201);

      const childBirthDate = new Date();
      childBirthDate.setFullYear(childBirthDate.getFullYear() - 10);

      const response = await request(app.getHttpServer())
        .post('/players/child')
        .set('Authorization', `Bearer ${parent.accessToken}`)
        .send({
          displayName: 'Kid One',
          birthDate: childBirthDate.toISOString(),
          gender: 'other',
        })
        .expect(201);

      expect(
        (response.body as { trainerSelectionPrompt: string })
          .trainerSelectionPrompt,
      ).toBe('single');
    });
  });

  describe('add/remove trainer association', () => {
    it('should add a trainer by code and then remove it, soft-deleting the association', async () => {
      const parent = await createParentWithSelfProfile();
      const trainer = await seedUser(app, { role: Role.TRAINER });
      const link = await shareLinkService.generateStaticLink(
        trainer.id,
        trainer.id,
      );

      const childBirthDate = new Date();
      childBirthDate.setFullYear(childBirthDate.getFullYear() - 8);
      const createChildResponse = await request(app.getHttpServer())
        .post('/players/child')
        .set('Authorization', `Bearer ${parent.accessToken}`)
        .send({
          displayName: 'Kid Two',
          birthDate: childBirthDate.toISOString(),
          gender: 'other',
        })
        .expect(201);
      const childId = (createChildResponse.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/players/${childId}/trainers`)
        .set('Authorization', `Bearer ${parent.accessToken}`)
        .send({ shareLinkCode: link.code })
        .expect(201);

      const created = await prisma.trainerPlayerAssociation.findFirst({
        where: { trainerId: trainer.id, playerProfileId: childId },
      });
      expect(created?.status).toBe('ACTIVE');

      const removeResponse = await request(app.getHttpServer())
        .delete(`/players/${childId}/trainers/${trainer.id}`)
        .set('Authorization', `Bearer ${parent.accessToken}`)
        .expect(200);
      expect(
        (removeResponse.body as { cancelledUpcomingRsvps: boolean })
          .cancelledUpcomingRsvps,
      ).toBe(true);

      const afterRemoval = await prisma.trainerPlayerAssociation.findFirst({
        where: { trainerId: trainer.id, playerProfileId: childId },
      });
      expect(afterRemoval?.status).toBe('REMOVED');
    });

    it('should 404 when trying to manage a child that does not belong to the caller', async () => {
      const parentA = await createParentWithSelfProfile();
      const parentB = await createParentWithSelfProfile();
      const trainer = await seedUser(app, { role: Role.TRAINER });

      const childBirthDate = new Date();
      childBirthDate.setFullYear(childBirthDate.getFullYear() - 8);
      const createChildResponse = await request(app.getHttpServer())
        .post('/players/child')
        .set('Authorization', `Bearer ${parentA.accessToken}`)
        .send({
          displayName: 'Kid Three',
          birthDate: childBirthDate.toISOString(),
          gender: 'other',
        })
        .expect(201);
      const childId = (createChildResponse.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/players/${childId}/trainers`)
        .set('Authorization', `Bearer ${parentB.accessToken}`)
        .send({ trainerId: trainer.id })
        .expect(404);
    });
  });
});
