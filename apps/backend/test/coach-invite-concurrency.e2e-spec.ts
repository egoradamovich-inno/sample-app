import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { ShareLinkService } from '../src/modules/sharelink/sharelink.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('Coach invite — single-trainer constraint under concurrency (e2e)', () => {
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

  it('races two concurrent accepts for the SAME already-active coach against a different trainer, resolving cleanly with no 500 and exactly one surviving CoachProfile', async () => {
    const trainerA = await seedUser(app, { role: Role.TRAINER });
    const trainerB = await seedUser(app, { role: Role.TRAINER });
    const coach = await seedUser(app, { role: Role.COACH });

    // Coach is already active under Trainer A *before* the race starts —
    // this is the precondition the single-trainer re-check exists to
    // enforce, not something the race itself produces.
    await prisma.coachProfile.create({
      data: { userId: coach.id, trainerId: trainerA.id },
    });

    const linkB = await shareLinkService.generateCoachInvite(
      trainerB.id,
      trainerB.id,
      coach.email,
    );

    const [resultA, resultB] = await Promise.allSettled([
      request(app.getHttpServer())
        .post(`/join/${linkB.code}/accept-coach`)
        .set('Authorization', `Bearer ${coach.accessToken}`)
        .send({}),
      request(app.getHttpServer())
        .post(`/join/${linkB.code}/accept-coach`)
        .set('Authorization', `Bearer ${coach.accessToken}`)
        .send({}),
    ]);

    const statuses = [resultA, resultB].map((r) =>
      r.status === 'fulfilled' ? r.value.status : -1,
    );

    // Never a 500. The single-trainer re-check runs inside the same
    // transaction as the link claim, so a request that fails that check
    // rolls its claim back too (a rejected attempt must not burn the
    // trainer's one-time invite) — both concurrent attempts are therefore
    // free to independently claim the link and each cleanly hit the
    // single-trainer rejection (409), rather than one of them instead
    // seeing an already-exhausted link.
    expect(statuses).toEqual([409, 409]);

    for (const result of [resultA, resultB]) {
      if (result.status === 'fulfilled') {
        expect((result.value.body as { errorCode?: string }).errorCode).toBe(
          'COACH_ALREADY_ACTIVE_ELSEWHERE',
        );
      }
    }

    const coachProfiles = await prisma.coachProfile.findMany({
      where: { userId: coach.id },
    });
    expect(coachProfiles).toHaveLength(1);
    expect(coachProfiles[0].trainerId).toBe(trainerA.id);
  });

  it('races two brand-new registrations for the same not-yet-existing email against two different trainers — exactly one succeeds, the other gets a clean DuplicateEmailException, never a 500', async () => {
    const trainerA = await seedUser(app, { role: Role.TRAINER });
    const trainerB = await seedUser(app, { role: Role.TRAINER });
    const coachEmail = `coach-${Date.now()}@example.com`;

    const linkA = await shareLinkService.generateCoachInvite(
      trainerA.id,
      trainerA.id,
      coachEmail,
    );
    const linkB = await shareLinkService.generateCoachInvite(
      trainerB.id,
      trainerB.id,
      coachEmail,
    );

    const payload = {
      email: coachEmail,
      password: 'Passw0rd!',
      firstName: 'Con',
      lastName: 'Current',
    };

    const [resultA, resultB] = await Promise.allSettled([
      request(app.getHttpServer())
        .post(`/join/${linkA.code}/accept-coach`)
        .send(payload),
      request(app.getHttpServer())
        .post(`/join/${linkB.code}/accept-coach`)
        .send(payload),
    ]);

    const statuses = [resultA, resultB]
      .map((r) => (r.status === 'fulfilled' ? r.value.status : -1))
      .sort();

    // Exactly one succeeds (201); the other must never be a raw 500 — the
    // P2002 on User.email now resolves to a clean DuplicateEmailException.
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses).not.toContain(500);

    const coachUser = await prisma.user.findUnique({
      where: { email: coachEmail },
    });
    expect(coachUser).not.toBeNull();

    const coachProfiles = await prisma.coachProfile.findMany({
      where: { userId: coachUser?.id },
    });
    expect(coachProfiles).toHaveLength(1);
  });
});
