import type { User } from '@open-lang/shared';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../authenticated-request.js';

/** The signed-in User calling a route. Only on routes that aren't `@Public()`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
