import { AppException } from '../../../shared/errors/app-exception';

export class ShareLinkExhaustedException extends AppException {
  constructor() {
    super('SHARELINK_EXHAUSTED', 'This invite link has already been used', 400);
  }
}
