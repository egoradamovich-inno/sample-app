import { HttpException } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ errorCode, message, details }, status);
  }
}
