import {
  roomTokenRequestSchema,
  type RoomTokenRequest,
  type RoomTokenResponse,
  type User,
} from '@livekit-platform/shared';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/authentication.guard.js';
import { RoomTokenService } from './room-token.service.js';

@Controller('token')
export class RoomTokenController {
  constructor(private readonly roomTokens: RoomTokenService) {}

  /**
   * LiveKit's standard token endpoint, called by the frontend's token source
   * with the Auth Token of a signed-in User.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  issueRoomToken(
    @CurrentUser() user: User,
    @Body({ schema: roomTokenRequestSchema }) request: RoomTokenRequest,
  ): Promise<RoomTokenResponse> {
    return this.roomTokens.issueRoomToken(user, request);
  }
}
