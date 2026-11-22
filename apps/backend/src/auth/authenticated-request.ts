import type { User } from '@open-live-agent/shared';
import type { Request } from 'express';

/** A request that AuthenticationGuard let through: the signed-in User is on it. */
export interface AuthenticatedRequest extends Request {
  user: User;
}
