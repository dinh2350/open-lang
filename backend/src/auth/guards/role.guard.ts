import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../authenticated-request.js';

/**
 * The Role guard: lets only Admins through and answers `403` to anyone else.
 * It runs after the global authentication guard, which loads the User from
 * the database on every request, so a demoted Admin loses access on their
 * next request whatever their Auth Token says.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // `user` is missing only on a @Public() route, which is never Admin-only.
    const { user } = context
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Only Admins can do this.');
    }
    return true;
  }
}
