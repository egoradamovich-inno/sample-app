import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import sharp from 'sharp';
import { Role } from '../generated/prisma/enums';
import {
  StorageService,
  STORAGE_SERVICE,
} from '../src/shared/storage/storage.service';
import { createTestApp } from './utils/create-test-app';
import { seedUser } from './utils/seed-user.util';

describe('POST /profile/me/photo (e2e)', () => {
  let app: INestApplication<App>;
  let storage: StorageService;
  const uploadedUrls: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    storage = app.get<StorageService>(STORAGE_SERVICE);
  });

  afterAll(async () => {
    // Uploaded files are real writes to apps/backend/uploads/photos — clean
    // up after ourselves so repeated e2e runs don't accumulate test fixtures.
    await Promise.all(uploadedUrls.map((url) => storage.delete(url)));
    await app.close();
  });

  it('should persist the photo and serve it back over HTTP at the returned URL', async () => {
    const user = await seedUser(app, { role: Role.PLAYER });
    const png = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 200, g: 40, b: 40 },
      },
    })
      .png()
      .toBuffer();

    const uploadResponse = await request(app.getHttpServer())
      .post('/profile/me/photo')
      .set('Cookie', `access_token=${user.accessToken}`)
      .attach('photo', png, 'photo.png')
      .expect(200);

    const photoUrl = (uploadResponse.body as { photoUrl: string }).photoUrl;
    expect(photoUrl).toMatch(/^\/uploads\/photos\/.+\.png$/);
    uploadedUrls.push(photoUrl);
    // The thumbnail shares the base filename with a "-thumb" suffix — not
    // returned in the response DTO, but written alongside the full photo by
    // LocalDiskStorage.savePhoto, so it needs cleanup too.
    uploadedUrls.push(photoUrl.replace(/\.png$/, '-thumb.png'));

    // This is the actual regression check: main.ts's useStaticAssets mount
    // is what makes this 200 instead of 404 — LocalDiskStorage previously
    // wrote the file correctly but nothing exposed it over HTTP.
    const servedResponse = await request(app.getHttpServer())
      .get(photoUrl)
      .expect(200);

    expect(servedResponse.headers['content-type']).toMatch(/^image\/png/);
    expect((servedResponse.body as Buffer).length).toBeGreaterThan(0);
  });

  it('should 404 for a well-formed but nonexistent uploads path', async () => {
    await request(app.getHttpServer())
      .get('/uploads/photos/does-not-exist.png')
      .expect(404);
  });
});
