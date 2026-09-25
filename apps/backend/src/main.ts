// Must load before any other local import: AppModule's own import graph
// (AuthModule -> ... -> shared/config/jwt.constants.ts) reads process.env at
// *module-import* time to fail fast on a missing JWT_ACCESS_SECRET, which
// happens before ConfigModule.forRoot()'s dotenv loading would otherwise run.
import 'dotenv/config';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './shared/errors/app-exception.filter';
import { ValidationException } from './shared/errors/validation.exception';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());
  // LocalDiskStorage writes branding logos/profile photos under
  // process.cwd()/uploads; this is Express static middleware, so it sits
  // outside the Nest routing/guard chain and serves these files publicly —
  // deliberate for this codebase (unguessable UUID filenames), not an oversight.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  // Built frontend assets (Vite's dist/ output, copied to public/ in the
  // production image) served the same way — outside the Nest routing/guard
  // chain, like /uploads above. `index: false` defers serving index.html to
  // the SPA-fallback middleware below, so there is one place that decides
  // when to return it instead of two.
  app.useStaticAssets(join(process.cwd(), 'public'), { index: false });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/uploads')
    ) {
      res.sendFile(join(process.cwd(), 'public', 'index.html'));
    } else {
      next();
    }
  });
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Maps class-validator failures to the spec's VALIDATION_ERROR error
      // contract (readable message + field-level details) instead of Nest's
      // default HTTP_EXCEPTION-with-array-message shape.
      exceptionFactory: (errors) => new ValidationException(errors),
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
