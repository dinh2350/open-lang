import {
  registerRequestSchema,
  signInRequestSchema,
  type AuthResponse,
  type User,
} from '@open-lang/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { RefreshTokenService } from '../refresh-tokens/refresh-token.service.js';
import { AUTH_PATH } from '../routes.js';
import { AuthService } from './auth.service.js';
import type {
  SignedIn,
  ValidRegisterRequest,
  ValidSignInRequest,
} from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import {
  clearRefreshCookie,
  RefreshTokenCookie,
  setRefreshCookie,
} from './refresh-cookie.js';

/** Sets the refresh cookie and returns the body: the Auth Token and the User. */
function respondSignedIn(
  response: Response,
  { refreshToken, ...authResponse }: SignedIn,
): AuthResponse {
  setRefreshCookie(response, refreshToken);
  return authResponse;
}

@Controller(AUTH_PATH)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body({ schema: registerRequestSchema }) request: ValidRegisterRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return respondSignedIn(response, await this.auth.register(request));
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body({ schema: signInRequestSchema }) request: ValidSignInRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return respondSignedIn(response, await this.auth.signIn(request));
  }

  /** Signs the User in again with the refresh cookie instead of a password. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @RefreshTokenCookie() refreshToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return respondSignedIn(response, await this.auth.refresh(refreshToken));
  }

  /**
   * Signs out this browser: revokes the refresh token in the cookie and
   * clears the cookie. It needs no Auth Token, so a User whose Auth Token
   * expired can still sign out.
   */
  @Public()
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(
    @RefreshTokenCookie() refreshToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.refreshTokens.revoke(refreshToken);
    clearRefreshCookie(response);
  }

  /** The current User. */
  @Get('me')
  currentUser(@CurrentUser() user: User): User {
    return user;
  }
}
