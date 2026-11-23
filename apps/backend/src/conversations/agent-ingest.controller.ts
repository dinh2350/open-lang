import {
  missIngestSchema,
  turnIngestSchema,
  type MissIngest,
  type TurnIngest,
} from '@open-lang/shared';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { AgentOnly } from '../auth/decorators/agent-only.decorator.js';
import { ConversationsService } from './conversations.service.js';

/** Where the Agent reports what happens in a Conversation, found by its room. */
@AgentOnly()
@Controller('agent/conversations')
export class AgentIngestController {
  constructor(private readonly conversations: ConversationsService) {}

  /** A finished turn. The Agent may send one again; the latest values win. */
  @Post(':roomName/turns')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordTurn(
    @Param('roomName') roomName: string,
    @Body({ schema: turnIngestSchema }) turn: TurnIngest,
  ): Promise<void> {
    return this.conversations.recordTurn(roomName, turn);
  }

  /** A press of "I did not catch that". */
  @Post(':roomName/misses')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordMiss(
    @Param('roomName') roomName: string,
    @Body({ schema: missIngestSchema }) miss: MissIngest,
  ): Promise<void> {
    return this.conversations.recordMiss(roomName, miss);
  }

  /**
   * The end marker: the Agent has sent every turn and Miss of the
   * Conversation, so its Report may be written. A repeat keeps the first time.
   */
  @Post(':roomName/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordEnd(@Param('roomName') roomName: string): Promise<void> {
    return this.conversations.recordEnd(roomName);
  }
}
