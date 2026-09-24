import { AppException } from '../../../shared/errors/app-exception';

export class InvalidCredentialsException extends AppException {
  constructor() {
    // Deliberately identical for "wrong password" and "unknown email" — no
    // enumeration signal.
    super('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }
}
