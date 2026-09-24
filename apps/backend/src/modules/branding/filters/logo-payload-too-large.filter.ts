import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Multer/Nest's default response to a `FileInterceptor` `limits.fileSize`
 * breach is a 413 `PayloadTooLargeException`. The global `AppExceptionFilter`
 * would still render that cleanly (no unhandled crash), but as an
 * `HTTP_EXCEPTION`/413 shape rather than the spec's validation contract.
 * Scoped to the logo-upload route only — does not touch the shared/global
 * exception filter.
 */
@Catch(PayloadTooLargeException)
export class LogoPayloadTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(400).json({
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Logo file exceeds the 2MB size limit',
    });
  }
}
