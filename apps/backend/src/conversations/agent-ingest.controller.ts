import {
  noteSchema,
  turnIngestSchema,
  type Note,
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

  /**
   * A Note the tutor wrote down. The Agent may send one again, and a
   * Conversation keeps only its first `MAX_NOTES_PER_CONVERSATION` Notes:
   * either way, nothing changes.
   */
  @Post(':roomName/notes')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordNote(
    @Param('roomName') roomName: string,
    @Body({ schema: noteSchema }) note: Note,
  ): Promise<void> {
    return this.conversations.recordNote(roomName, note);
  }

  /**
   * The end marker: the Agent has sent every turn and Note of the
   * Conversation, so its Report may be written. A repeat keeps the first time.
   */
  @Post(':roomName/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordEnd(@Param('roomName') roomName: string): Promise<void> {
    return this.conversations.recordEnd(roomName);
  }
}
