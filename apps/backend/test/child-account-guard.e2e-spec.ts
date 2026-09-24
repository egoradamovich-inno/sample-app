import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { ShareLinkService } from '../src/modules/sharelink/sharelink.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('ChildAccountGuard route blocking (e2e)', () => {
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

  async function createParentWithChildLogin() {
    const parent = await seedUser(app, { role: Role.PLAYER });
    const childProfile = await prisma.playerProfile.create({
      data: {
        parentUserId: parent.id,
        displayName: 'Kid Account',
        isChild: true,
      },
    });
    const child = await seedUser(app, {
      role: Role.PLAYER,
      parentUserId: parent.id,
    });
    await prisma.playerProfile.update({
      where: { id: childProfile.id },
      data: { userId: child.id },
    });
    return { parent, child, childProfileId: childProfile.id };
  }

  it('should 403 CHILD_ACCOUNT_RESTRICTED when a child tries to create a child profile of their own', async () => {
    const { child } = await createParentWithChildLogin();

    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 5);

    const response = await request(app.getHttpServer())
      .post('/players/child')
      .set('Authorization', `Bearer ${child.accessToken}`)
      .send({
        displayName: 'Sub Child',
        birthDate: birthDate.toISOString(),
        gender: 'other',
      })
      .expect(403);

    expect((response.body as { errorCode: string }).errorCode).toBe(
      'CHILD_ACCOUNT_RESTRICTED',
    );
  });

  it('should 403 when a child tries to add a trainer to their own profile', async () => {
    const { child, childProfileId } = await createParentWithChildLogin();
    const trainer = await seedUser(app, { role: Role.TRAINER });
    const link = await shareLinkService.generateStaticLink(
      trainer.id,
      trainer.id,
    );

    await request(app.getHttpServer())
      .post(`/players/${childProfileId}/trainers`)
      .set('Authorization', `Bearer ${child.accessToken}`)
      .send({ shareLinkCode: link.code })
      .expect(403);
  });

  it('should 403 when a child tries to remove a trainer association', async () => {
    const { child, childProfileId } = await createParentWithChildLogin();
    const trainer = await seedUser(app, { role: Role.TRAINER });

    await request(app.getHttpServer())
      .delete(`/players/${childProfileId}/trainers/${trainer.id}`)
      .set('Authorization', `Bearer ${child.accessToken}`)
      .expect(403);
  });

  it('should 403 when a child tries to provision another child login', async () => {
    const { child, childProfileId } = await createParentWithChildLogin();

    await request(app.getHttpServer())
      .post(`/players/${childProfileId}/child-login`)
      .set('Authorization', `Bearer ${child.accessToken}`)
      .send({ email: `sub-${Date.now()}@example.com`, password: 'Passw0rd!' })
      .expect(403);
  });

  it('should allow the real parent (non-child) to perform the same actions', async () => {
    const { parent, childProfileId } = await createParentWithChildLogin();
    const trainer = await seedUser(app, { role: Role.TRAINER });
    const link = await shareLinkService.generateStaticLink(
      trainer.id,
      trainer.id,
    );

    await request(app.getHttpServer())
      .post(`/players/${childProfileId}/trainers`)
      .set('Authorization', `Bearer ${parent.accessToken}`)
      .send({ shareLinkCode: link.code })
      .expect(201);
  });

  it('should still let a child view their own profile info (GET /players) and edit basic profile fields', async () => {
    const { child } = await createParentWithChildLogin();

    await request(app.getHttpServer())
      .get('/players')
      .set('Authorization', `Bearer ${child.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/profile/me')
      .set('Authorization', `Bearer ${child.accessToken}`)
      .send({ firstName: 'Updated' })
      .expect(200);
  });
});
