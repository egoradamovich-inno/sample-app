import { AppException } from '../../../shared/errors/app-exception';

export class AccountDeactivatedException extends AppException {
  constructor() {
    super('ACCOUNT_DEACTIVATED', 'This account has been deactivated', 403);
  }
}
