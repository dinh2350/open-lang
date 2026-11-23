import {
  type ConversationDetail,
  type ConversationList,
  conversationDetailSchema,
  conversationListSchema,
  type ReportStatus,
  reportStatusSchema,
} from '@open-lang/shared';
import { z } from 'zod';
import type { AuthorizedFetch } from '@/auth/auth-context';

/** The backend has no Conversation with this room name for the signed-in User. */
export class ConversationNotFoundError extends Error {
  constructor(roomName: string) {
    super(`No Conversation ${roomName} for this User`);
    this.name = 'ConversationNotFoundError';
  }
}

const reportRequestResponseSchema = z.object({ status: reportStatusSchema });

function failed(path: string, response: Response): Error {
  return new Error(`${path} failed with status ${String(response.status)}`);
}

function conversationPath(roomName: string): string {
  return `/api/conversations/${encodeURIComponent(roomName)}`;
}

/** The signed-in User's Conversations, newest first. */
export async function fetchConversations(
  authorizedFetch: AuthorizedFetch,
): Promise<ConversationList> {
  const path = '/api/conversations';
  const response = await authorizedFetch(path);
  if (!response.ok) {
    throw failed(path, response);
  }
  return conversationListSchema.parse(await response.json());
}

/**
 * One of the signed-in User's Conversations, with its Report when there is
 * one. Throws ConversationNotFoundError when the backend answers `404`, as it
 * does for another User's Conversation too.
 */
export async function fetchConversation(
  authorizedFetch: AuthorizedFetch,
  roomName: string,
): Promise<ConversationDetail> {
  const path = conversationPath(roomName);
  const response = await authorizedFetch(path);
  if (response.status === 404) {
    throw new ConversationNotFoundError(roomName);
  }
  if (!response.ok) {
    throw failed(path, response);
  }
  return conversationDetailSchema.parse(await response.json());
}

/**
 * Asks the backend to make the Conversation's Report, which it does in the
 * background, and returns where the Report is now.
 */
export async function requestReport(
  authorizedFetch: AuthorizedFetch,
  roomName: string,
): Promise<ReportStatus> {
  const path = `${conversationPath(roomName)}/report`;
  const response = await authorizedFetch(path, { method: 'POST' });
  if (response.status === 404) {
    throw new ConversationNotFoundError(roomName);
  }
  if (!response.ok) {
    throw failed(path, response);
  }
  return reportRequestResponseSchema.parse(await response.json()).status;
}
