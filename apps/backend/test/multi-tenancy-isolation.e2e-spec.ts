import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { ShareLinkService } from '../src/modules/sharelink/sharelink.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('Multi-tenancy isolation (e2e)', () => {
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

  it("should never let Trainer A's token see Trainer B's roster — seeding real data for B first so an empty result can't hide a missing WHERE clause", async () => {
    const trainerA = await seedUser(app, { role: Role.TRAINER });
    const trainerB = await seedUser(app, { role: Role.TRAINER });

    // Seed real roster data for B — confirms a wrong scope would actually
    // surface B's real rows, not just coincidentally return an empty list.
    const parentB = await seedUser(app, { role: Role.PLAYER });
    const selfProfileB = await prisma.playerProfile.create({
      data: {
        userId: parentB.id,
        parentUserId: parentB.id,
        displayName: 'Bs Player',
        isChild: false,
      },
    });
    const linkB = await shareLinkService.generateStaticLink(
      trainerB.id,
      trainerB.id,
    );
    const linkBRow = await prisma.shareLink.findUnique({
      where: { code: linkB.code },
    });
    await prisma.trainerPlayerAssociation.create({
      data: {
        trainerId: trainerB.id,
        playerProfileId: selfProfileB.id,
        shareLinkId: linkBRow?.id,
      },
    });

    const rosterAsA = await request(app.getHttpServer())
      .get('/trainer/roster')
      .set('Authorization', `Bearer ${trainerA.accessToken}`)
      .expect(200);
    const rosterAsABody = rosterAsA.body as {
      items: { name: string }[];
    };

    expect(rosterAsABody.items.some((m) => m.name === 'Bs Player')).toBe(false);

    // Confirming B's own token DOES see it — proves the seed actually worked.
    const rosterAsB = await request(app.getHttpServer())
      .get('/trainer/roster')
      .set('Authorization', `Bearer ${trainerB.accessToken}`)
      .expect(200);
    const rosterAsBBody = rosterAsB.body as {
      items: { name: string }[];
    };
    expect(rosterAsBBody.items.some((m) => m.name === 'Bs Player')).toBe(true);
  });

  it("should 404 (not a cross-trainer 200) when Trainer A requests Trainer B's player availability", async () => {
    const trainerA = await seedUser(app, { role: Role.TRAINER });
    const trainerB = await seedUser(app, { role: Role.TRAINER });
    const parentB = await seedUser(app, { role: Role.PLAYER });
    const selfProfileB = await prisma.playerProfile.create({
      data: {
        userId: parentB.id,
        parentUserId: parentB.id,
        displayName: 'Bs Other Player',
        isChild: false,
      },
    });
    const linkB = await shareLinkService.generateStaticLink(
      trainerB.id,
      trainerB.id,
    );
    const linkBRow = await prisma.shareLink.findUnique({
      where: { code: linkB.code },
    });
    await prisma.trainerPlayerAssociation.create({
      data: {
        trainerId: trainerB.id,
        playerProfileId: selfProfileB.id,
        shareLinkId: linkBRow?.id,
      },
    });

    await request(app.getHttpServer())
      .get(`/availability/player/${selfProfileB.id}`)
      .set('Authorization', `Bearer ${trainerA.accessToken}`)
      .expect(404);
  });

  it("should not let Trainer A resend Trainer B's coach invite", async () => {
    const trainerA = await seedUser(app, { role: Role.TRAINER });
    const trainerB = await seedUser(app, { role: Role.TRAINER });
    const linkB = await shareLinkService.generateCoachInvite(
      trainerB.id,
      trainerB.id,
      `coach-${Date.now()}@example.com`,
    );
    const linkBRow = await prisma.shareLink.findUnique({
      where: { code: linkB.code },
    });

    await request(app.getHttpServer())
      .post(`/sharelinks/coach-invite/${linkBRow?.id}/resend`)
      .set('Authorization', `Bearer ${trainerA.accessToken}`)
      .expect(404);
  });
});
