import {
  registerRequestSchema,
  signInRequestSchema,
  type AuthResponse,
  type User,
} from '@livekit-platform/shared';
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
import {
  AuthService,
  type SignedIn,
  type ValidRegisterRequest,
  type ValidSignInRequest,
} from './auth.service.js';
import { CurrentUser, Public } from './authentication.guard.js';
import { setRefreshCookie } from './refresh-cookie.js';

/** Sets the refresh cookie and returns the body: the Auth Token and the User. */
function respondSignedIn(
  response: Response,
  { refreshToken, ...authResponse }: SignedIn,
): AuthResponse {
  setRefreshCookie(response, refreshToken);
  return authResponse;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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

  /** The current User. */
  @Get('me')
  currentUser(@CurrentUser() user: User): User {
    return user;
  }
}
