import type {
  ConversationDetail,
  ConversationList,
  NoteList,
  ReportStatus,
  User,
} from '@open-lang/shared';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ReportService } from '../reports/report.service.js';
import { ConversationsService } from './conversations.service.js';

/** The signed-in User's own Conversations and their Reports. */
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly reports: ReportService,
  ) {}

  /** The User's Conversations, newest first. */
  @Get()
  async list(@CurrentUser() user: User): Promise<ConversationList> {
    return { conversations: await this.conversations.list(user) };
  }

  /** `404` when the room is not the User's Conversation. */
  @Get(':roomName')
  get(
    @CurrentUser() user: User,
    @Param('roomName') roomName: string,
  ): Promise<ConversationDetail> {
    return this.conversations.get(user, roomName);
  }

  /** The Notes the tutor wrote in the room's Conversation, oldest first. `404` when the room is not the User's. */
  @Get(':roomName/notes')
  async notes(
    @CurrentUser() user: User,
    @Param('roomName') roomName: string,
  ): Promise<NoteList> {
    return { notes: await this.conversations.listNotes(user, roomName) };
  }

  /**
   * Starts the Report, which is written in the background: poll the
   * Conversation for its status. `404` when the room is not the User's.
   */
  @Post(':roomName/report')
  @HttpCode(HttpStatus.ACCEPTED)
  async startReport(
    @CurrentUser() user: User,
    @Param('roomName') roomName: string,
  ): Promise<{ status: ReportStatus }> {
    return { status: await this.reports.start(user, roomName) };
  }
}
