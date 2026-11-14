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
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  AuthService,
  type ValidRegisterRequest,
  type ValidSignInRequest,
} from './auth.service.js';
import { CurrentUser, Public } from './authentication.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body({ schema: registerRequestSchema }) request: ValidRegisterRequest,
  ): Promise<AuthResponse> {
    return this.auth.register(request);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(
    @Body({ schema: signInRequestSchema }) request: ValidSignInRequest,
  ): Promise<AuthResponse> {
    return this.auth.signIn(request);
  }

  /** The current User. */
  @Get('me')
  currentUser(@CurrentUser() user: User): User {
    return user;
  }
}
