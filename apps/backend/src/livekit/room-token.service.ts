import { randomUUID } from 'node:crypto';
import type { LiveKitEnv, RoomTokenResponse, User } from '@open-lang/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from 'livekit-server-sdk';

const ROOM_TOKEN_TTL = '10m';

@Injectable()
export class RoomTokenService {
  private readonly logger = new Logger(RoomTokenService.name);

  constructor(private readonly config: ConfigService<LiveKitEnv, true>) {}

  /**
   * Issues a Room Token for a new Conversation of the User: a new room, the
   * User id as the participant identity, and a dispatch of the Agent. It
   * takes nothing from the client's request, so a client can't join another
   * room, pose as someone else or dispatch another agent.
   */
  async issueRoomToken(user: User): Promise<RoomTokenResponse> {
    const roomName = `conversation-${randomUUID()}`;

    const roomToken = new AccessToken(
      this.config.getOrThrow('LIVEKIT_API_KEY', { infer: true }),
      this.config.getOrThrow('LIVEKIT_API_SECRET', { infer: true }),
      { identity: user.id, ttl: ROOM_TOKEN_TTL },
    );
    roomToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    roomToken.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: this.config.getOrThrow('AGENT_NAME', { infer: true }),
        }),
      ],
    });

    this.logger.log({
      message: 'Issued Room Token',
      userId: user.id,
      roomName,
    });
    return {
      server_url: this.config.getOrThrow('LIVEKIT_URL', { infer: true }),
      participant_token: await roomToken.toJwt(),
    };
  }
}
