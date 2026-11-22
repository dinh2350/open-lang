import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { toUser } from '../../users/user.mapper.js';
import { UsersService } from '../../users/users.service.js';
import { AuthTokenService } from '../auth-token.service.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';
import { PUBLIC_ROUTE } from '../decorators/public.decorator.js';
import { AccountLockedException } from '../exceptions/account-locked.exception.js';

const BEARER = /^Bearer (\S+)$/i;

/**
 * Applies to every route that isn't `@Public()`. It verifies the Auth Token
 * in the `Authorization: Bearer` header, then loads the User from the
 * database on every request, so the User's current Role always comes from
 * the database rather than from the token, and a User who was locked gets
 * `403` on their next request, even with an Auth Token issued before.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authTokens: AuthTokenService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authToken = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (authToken === undefined) {
      throw new UnauthorizedException();
    }
    const record = await this.users.findById(
      await this.authTokens.userIdOf(authToken),
    );
    if (record === null) {
      throw new UnauthorizedException();
    }
    if (record.locked) {
      throw new AccountLockedException();
    }
    request.user = toUser(record);
    return true;
  }
}
