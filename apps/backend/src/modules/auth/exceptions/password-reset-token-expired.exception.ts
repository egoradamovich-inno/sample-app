import { AppException } from '../../../shared/errors/app-exception';

export class PasswordResetTokenExpiredException extends AppException {
  constructor() {
    super(
      'PASSWORD_RESET_TOKEN_EXPIRED',
      'This password reset link has expired or was already used',
      400,
    );
  }
}
