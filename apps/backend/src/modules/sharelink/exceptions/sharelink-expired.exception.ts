import { AppException } from '../../../shared/errors/app-exception';

export class ShareLinkExpiredException extends AppException {
  constructor() {
    super('SHARELINK_EXPIRED', 'This invite link has expired', 400);
  }
}
