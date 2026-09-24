import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { AppExceptionFilter } from '../../src/shared/errors/app-exception.filter';
import { ValidationException } from '../../src/shared/errors/validation.exception';

/**
 * Mirrors main.ts's bootstrap exactly (cookie parser + static uploads +
 * global filter + validation pipe) — without this, e2e specs would exercise
 * a differently-configured app than what actually runs in production (no
 * cookie-based auth, no whitelist/forbidNonWhitelisted, no
 * AppException-shaped error bodies, no /uploads static serving).
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  app.use(cookieParser());
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new ValidationException(errors),
    }),
  );
  await app.init();
  return app;
}
