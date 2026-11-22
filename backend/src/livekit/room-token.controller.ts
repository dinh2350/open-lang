import {
  roomTokenRequestSchema,
  type RoomTokenRequest,
  type RoomTokenResponse,
  type User,
} from '@open-live-agent/shared';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/authentication.guard.js';
import { RoomTokenService } from './room-token.service.js';

@Controller('token')
export class RoomTokenController {
  constructor(private readonly roomTokens: RoomTokenService) {}

  /**
   * LiveKit's standard token endpoint, called by the frontend's token source
   * with the Auth Token of a signed-in User. The body must have the standard
   * request shape, but the backend chooses every field itself.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  issueRoomToken(
    @Body({ schema: roomTokenRequestSchema }) ignoredRequest: RoomTokenRequest,
    @CurrentUser() user: User,
  ): Promise<RoomTokenResponse> {
    return this.roomTokens.issueRoomToken(user);
  }
}
