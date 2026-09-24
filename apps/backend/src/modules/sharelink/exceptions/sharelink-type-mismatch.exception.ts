import { AppException } from '../../../shared/errors/app-exception';

export class ShareLinkTypeMismatchException extends AppException {
  constructor() {
    super(
      'SHARELINK_TYPE_MISMATCH',
      'This link cannot be used for player registration',
      400,
    );
  }
}
