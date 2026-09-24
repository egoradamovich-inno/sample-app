import { AppException } from '../../../shared/errors/app-exception';

export class EmailNotVerifiedException extends AppException {
  constructor() {
    super(
      'EMAIL_NOT_VERIFIED',
      'Please verify your email before logging in',
      403,
    );
  }
}
