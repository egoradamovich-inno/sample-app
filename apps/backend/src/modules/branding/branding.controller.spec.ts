import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';
import { BrandingDto } from './dto/branding.dto';

/**
 * HTTP-level coverage for the logo upload route's file-size guard: the
 * multer size limit only actually engages once a real request body is
 * parsed, so this exercises the real FileInterceptor + scoped exception
 * filter rather than mocking them away.
 */
describe('BrandingController (logo upload size cap)', () => {
  let app: INestApplication<App>;
  let uploadLogo: jest.Mock;

  beforeEach(async () => {
    uploadLogo = jest.fn().mockImplementation(() => {
      const dto = new BrandingDto();
      dto.logoUrl = '/uploads/branding/new.png';
      dto.primaryColorHex = null;
      return Promise.resolve(dto);
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [BrandingController],
      providers: [
        {
          provide: BrandingService,
          useValue: {
            uploadLogo,
            getBranding: jest.fn(),
            updateBranding: jest.fn(),
            resolveTrainerIdForCaller: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // No guards are wired into this isolated testing module (those live on
    // AppModule via APP_GUARD), so stand in for the JWT-populated req.user
    // the real request pipeline would provide.
    app.use(
      (
        req: { user?: unknown },
        _res: unknown,
        next: (...args: unknown[]) => void,
      ) => {
        req.user = { userId: 'trainer-1', role: 'TRAINER', parentUserId: null };
        next();
      },
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an over-2MB upload with a clean 400 VALIDATION_ERROR, never an unhandled 413/500', async () => {
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 1);

    const response = await request(app.getHttpServer())
      .post('/trainer/branding/logo')
      .attach('logo', oversized, 'huge-logo.png');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
    });
    expect(uploadLogo).not.toHaveBeenCalled();
  });

  it('accepts an upload at/under the 2MB cap and reaches the service', async () => {
    const withinCap = Buffer.alloc(1024, 1);

    const response = await request(app.getHttpServer())
      .post('/trainer/branding/logo')
      .attach('logo', withinCap, 'logo.png');

    expect(response.status).toBe(201);
    expect(uploadLogo).toHaveBeenCalled();
  });
});
