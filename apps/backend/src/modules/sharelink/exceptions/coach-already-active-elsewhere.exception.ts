import { AppException } from '../../../shared/errors/app-exception';

export class CoachAlreadyActiveElsewhereException extends AppException {
  constructor() {
    super(
      'COACH_ALREADY_ACTIVE_ELSEWHERE',
      'This coach is already active under a different trainer',
      409,
    );
  }
}
