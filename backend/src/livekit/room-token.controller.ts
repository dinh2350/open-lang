import {
  roomTokenRequestSchema,
  type RoomTokenRequest,
  type RoomTokenResponse,
} from '@livekit-platform/shared';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RoomTokenService } from './room-token.service.js';

@Controller('token')
export class RoomTokenController {
  constructor(private readonly roomTokens: RoomTokenService) {}

  /** LiveKit's standard token endpoint, called by the frontend's token source. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  issueRoomToken(
    @Body({ schema: roomTokenRequestSchema }) request: RoomTokenRequest,
  ): Promise<RoomTokenResponse> {
    return this.roomTokens.issueRoomToken(request);
  }
}
