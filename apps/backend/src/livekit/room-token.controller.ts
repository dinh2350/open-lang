import {
  roomTokenRequestSchema,
  type RoomTokenRequest,
  type RoomTokenResponse,
  type User,
} from '@open-lang/shared';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RoomTokenService } from './room-token.service.js';

@Controller('token')
export class RoomTokenController {
  constructor(private readonly roomTokens: RoomTokenService) {}

  /**
   * LiveKit's standard token endpoint, called by the frontend's token source
   * with the Auth Token of a signed-in User. The body must have the standard
   * request shape. Only `participant_metadata` is read, for the Member's
   * choice of Scenario and speed; the backend chooses every other field.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  issueRoomToken(
    @Body({ schema: roomTokenRequestSchema }) request: RoomTokenRequest,
    @CurrentUser() user: User,
  ): Promise<RoomTokenResponse> {
    return this.roomTokens.issueRoomToken(user, request);
  }
}
