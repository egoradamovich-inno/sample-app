import { AppException } from '../../../shared/errors/app-exception';

export class VerificationTokenExpiredException extends AppException {
  constructor() {
    super(
      'VERIFICATION_TOKEN_EXPIRED',
      'This email verification link has expired or was already used',
      400,
    );
  }
}
