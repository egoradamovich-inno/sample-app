import { AppException } from '../../../shared/errors/app-exception';

export class VerificationTokenInvalidException extends AppException {
  constructor() {
    super(
      'VERIFICATION_TOKEN_INVALID',
      'This email verification link is invalid',
      400,
    );
  }
}
