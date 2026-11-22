import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { BackendEnv } from '../../config/env.schema.js';

const BEARER = /^Bearer (\S+)$/i;

/** A fixed-length digest, so keys of any length compare in constant time. */
const digest = (key: string): Buffer =>
  createHash('sha256').update(key).digest();

/**
 * Lets only the Agent through: the request must carry the shared
 * `AGENT_API_KEY` as `Authorization: Bearer`. It is the only check on an
 * `@AgentOnly()` route, which is `@Public()` for the Auth Token guard, so a
 * User's Auth Token never passes here, and the key is no Auth Token either.
 */
@Injectable()
export class AgentKeyGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(config: ConfigService<BackendEnv, true>) {
    this.expected = digest(config.getOrThrow('AGENT_API_KEY', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (key === undefined || !timingSafeEqual(digest(key), this.expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
