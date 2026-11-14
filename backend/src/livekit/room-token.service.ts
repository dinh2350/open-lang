import { randomUUID } from 'node:crypto';
import type {
  RoomTokenRequest,
  RoomTokenResponse,
  User,
} from '@livekit-platform/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from 'livekit-server-sdk';
import { LIVEKIT_CONFIG, type LiveKitConfig } from './livekit-config.js';

const ROOM_TOKEN_TTL = '10m';

@Injectable()
export class RoomTokenService {
  private readonly logger = new Logger(RoomTokenService.name);

  constructor(
    @Inject(LIVEKIT_CONFIG) private readonly liveKit: LiveKitConfig,
  ) {}

  /**
   * Issues a Room Token for a new Conversation of the User: a new room, the
   * User id as the participant identity, and a dispatch of the Agent. Every
   * field of the client's request is ignored, so a client can't join
   * another room, pose as someone else or call another agent.
   */
  async issueRoomToken(
    user: User,
    request: RoomTokenRequest,
  ): Promise<RoomTokenResponse> {
    const roomName = `conversation-${randomUUID()}`;

    const roomToken = new AccessToken(
      this.liveKit.apiKey,
      this.liveKit.apiSecret,
      { identity: user.id, ttl: ROOM_TOKEN_TTL },
    );
    roomToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    roomToken.roomConfig = new RoomConfiguration({
      agents: [new RoomAgentDispatch({ agentName: this.liveKit.agentName })],
    });

    this.logger.log({
      message: 'Issued Room Token',
      userId: user.id,
      roomName,
      ignoredClientFields: Object.keys(request),
    });
    return {
      server_url: this.liveKit.url,
      participant_token: await roomToken.toJwt(),
    };
  }
}
