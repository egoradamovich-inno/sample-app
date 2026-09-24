import { AppException } from '../../../shared/errors/app-exception';

export class PasswordResetTokenInvalidException extends AppException {
  constructor() {
    super(
      'PASSWORD_RESET_TOKEN_INVALID',
      'This password reset link is invalid',
      400,
    );
  }
}
