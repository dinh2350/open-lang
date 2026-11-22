import { randomUUID } from 'node:crypto';
import {
  conversationChoiceSchema,
  type ConversationChoice,
  type LiveKitEnv,
  type RoomTokenRequest,
  type RoomTokenResponse,
  type User,
} from '@open-lang/shared';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from 'livekit-server-sdk';
import { ConversationsService } from '../conversations/conversations.service.js';

const ROOM_TOKEN_TTL = '10m';

/**
 * The Member's choice of Scenario and speed, which the request carries as a
 * JSON string in the standard `participant_metadata` field. `400` when it is
 * missing, is not JSON, or is not a valid choice.
 */
function parseChoice(request: RoomTokenRequest): ConversationChoice {
  const invalid = new BadRequestException(
    'participant_metadata must be a JSON choice of Scenario and speed.',
  );
  if (request.participant_metadata === undefined) {
    throw invalid;
  }
  let json: unknown;
  try {
    json = JSON.parse(request.participant_metadata);
  } catch {
    throw invalid;
  }
  const choice = conversationChoiceSchema.safeParse(json);
  if (!choice.success) {
    throw invalid;
  }
  return choice.data;
}

@Injectable()
export class RoomTokenService {
  private readonly logger = new Logger(RoomTokenService.name);

  constructor(
    private readonly config: ConfigService<LiveKitEnv, true>,
    private readonly conversations: ConversationsService,
  ) {}

  /**
   * Issues a Room Token for a new Conversation of the User: a new room, the
   * User id as the participant identity, and a dispatch of the Agent with
   * the User's choice as its metadata. It takes nothing else from the
   * client's request, so a client can't join another room, pose as someone
   * else or dispatch another agent. The Conversation is recorded before the
   * token is returned.
   */
  async issueRoomToken(
    user: User,
    request: RoomTokenRequest,
  ): Promise<RoomTokenResponse> {
    const choice = parseChoice(request);
    const roomName = `conversation-${randomUUID()}`;
    await this.conversations.create(user, roomName, choice);

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
          metadata: JSON.stringify(choice),
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
