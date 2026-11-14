import { ACCOUNT_LOCKED } from '@livekit-platform/shared';
import { ForbiddenException } from '@nestjs/common';

/**
 * The `403` a Locked User gets. Its `errorCode` tells the frontend to show
 * the account locked message, unlike other `403`s.
 */
export class AccountLockedException extends ForbiddenException {
  constructor() {
    super('Your account is locked. Ask an Admin to unlock it.', {
      errorCode: ACCOUNT_LOCKED,
    });
  }
}
