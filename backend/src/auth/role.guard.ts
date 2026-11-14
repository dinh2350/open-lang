import type { User } from '@livekit-platform/shared';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

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
      .getRequest<Request & { user?: User }>();
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Only Admins can do this.');
    }
    return true;
  }
}

/** Restricts a controller or route to Admins. */
export const AdminOnly = () => UseGuards(RoleGuard);
