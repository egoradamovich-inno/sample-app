import { AppException } from '../../../shared/errors/app-exception';

export class ShareLinkNotFoundException extends AppException {
  constructor() {
    super('SHARELINK_NOT_FOUND', 'This invite link was not found', 404);
  }
}
