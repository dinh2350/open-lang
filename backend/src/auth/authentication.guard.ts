import type { User } from '@livekit-platform/shared';
import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountLockedException } from './account-locked.exception.js';
import { AuthTokenService } from './auth-token.service.js';
import { toUser } from './users.js';

const PUBLIC_ROUTE = Symbol('PublicRoute');

/** Lets people who aren't signed in call this route or controller. */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

interface AuthenticatedRequest extends Request {
  user: User;
}

/** The signed-in User calling a route. Only on routes that aren't `@Public()`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

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
    private readonly prisma: PrismaService,
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
    const record = await this.prisma.user.findUnique({
      where: { id: await this.authTokens.userIdOf(authToken) },
    });
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
