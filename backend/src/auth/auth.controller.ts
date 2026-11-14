import {
  registerRequestSchema,
  type AuthResponse,
} from '@livekit-platform/shared';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, type ValidRegisterRequest } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body({ schema: registerRequestSchema }) request: ValidRegisterRequest,
  ): Promise<AuthResponse> {
    return this.auth.register(request);
  }
}
