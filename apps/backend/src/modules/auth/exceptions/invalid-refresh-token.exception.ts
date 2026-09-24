import { AppException } from '../../../shared/errors/app-exception';

export class InvalidRefreshTokenException extends AppException {
  constructor() {
    super(
      'INVALID_REFRESH_TOKEN',
      'This refresh token is invalid, expired, or already revoked',
      401,
    );
  }
}
