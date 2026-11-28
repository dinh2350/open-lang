import { randomUUID } from 'node:crypto';
import type { LiveKitEnv, RoomTokenResponse, User } from '@open-lang/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from 'livekit-server-sdk';
import { ConversationsService } from '../conversations/conversations.service.js';
import { LearnerService } from '../learner/learner.service.js';

const ROOM_TOKEN_TTL = '10m';

@Injectable()
export class RoomTokenService {
  private readonly logger = new Logger(RoomTokenService.name);

  constructor(
    private readonly config: ConfigService<LiveKitEnv, true>,
    private readonly conversations: ConversationsService,
    private readonly learner: LearnerService,
  ) {}

  /**
   * Issues a Room Token for a new Conversation of the User: a new room, the
   * User id as the participant identity, and a dispatch of the Agent whose
   * metadata is the User's learner brief, when the User has items. It takes
   * nothing from the client's request, so a client can't join another room,
   * pose as someone else, dispatch another agent or choose the metadata.
   * The Conversation is recorded before the token is returned. A User's
   * earlier Conversations that were not processed yet are taken in the
   * background, so a missed end marker is made up for at the next one.
   */
  async issueRoomToken(user: User): Promise<RoomTokenResponse> {
    const roomName = `conversation-${randomUUID()}`;
    await this.conversations.create(user, roomName);
    const metadata = await this.briefMetadataOf(user);
    // Not awaited: the User does not wait for the model; it never rejects.
    void this.learner.processPending(user.id);

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
          metadata,
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

  /**
   * The User's brief as the dispatch metadata, or undefined when the User has
   * no items or the brief could not be built: the Conversation goes ahead
   * without it. Only the User id is logged, never what the User learned.
   */
  private async briefMetadataOf(user: User): Promise<string | undefined> {
    try {
      const brief = await this.learner.briefFor(user.id);
      return brief.items.length > 0 ? JSON.stringify(brief) : undefined;
    } catch {
      this.logger.warn({
        message: 'Could not build the learner brief; dispatching without it',
        userId: user.id,
      });
      return undefined;
    }
  }
}
