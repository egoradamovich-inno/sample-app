import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException } from './app-exception';

interface ErrorResponseBody {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.buildBody(exception);
    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof AppException) {
      const status = exception.getStatus();
      return {
        statusCode: status,
        errorCode: exception.errorCode,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string }).message ?? exception.message);
      return {
        statusCode: status,
        errorCode: 'HTTP_EXCEPTION',
        message,
        details: undefined,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      details: undefined,
    };
  }
}
