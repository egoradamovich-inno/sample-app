import { AppException } from '../../../shared/errors/app-exception';

export class DuplicateEmailException extends AppException {
  constructor() {
    super('DUPLICATE_EMAIL', 'Email already registered', 409);
  }
}
