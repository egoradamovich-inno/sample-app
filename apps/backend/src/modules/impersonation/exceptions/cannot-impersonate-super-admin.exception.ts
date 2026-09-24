import { AppException } from '../../../shared/errors/app-exception';

export class CannotImpersonateSuperAdminException extends AppException {
  constructor() {
    super(
      'CANNOT_IMPERSONATE_SUPER_ADMIN',
      'Super Admin accounts cannot be impersonated',
      403,
    );
  }
}
