import {
  type ConversationDetail,
  type ConversationReport,
  type ConversationSummary,
  conversationSummarySchema,
  type ReportStatus,
} from '@open-lang/shared';
import { http, HttpResponse } from 'msw';
import { refusalOfAuthorization } from './auth-backend';

/**
 * A Conversation the fake backend holds, and what the Report looks like once
 * the Member asks for it.
 */
interface BackendConversation {
  detail: ConversationDetail;
  /** The Report that `ready` shows. */
  report: ConversationReport;
  /**
   * What each detail request shows after a Report request, oldest request
   * first: the statuses the Report goes through. The last status stays.
   */
  afterRequest: ReportStatus[][];
  /** The statuses still to show after the latest Report request. */
  pending: ReportStatus[];
}

const conversations = new Map<string, BackendConversation>();
const reportRequests: string[] = [];
const detailRequests: string[] = [];
const authorizations: (string | null)[] = [];

/** A Conversation's summary, with the values a test does not name filled in. */
export function summaryOf(
  roomName: string,
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    roomName,
    scenarioId: 'daily-standup',
    speed: 0.85,
    createdAt: '2026-11-23T12:00:00.000Z',
    durationSeconds: 754,
    reportStatus: null,
    ...overrides,
  };
}

/** A Report with one of each section and every fluency number set. */
export function reportOf(
  overrides: Partial<ConversationReport> = {},
): ConversationReport {
  return {
    listeningMisses: [],
    grammarIssues: [],
    fluency: {
      wordsPerMinute: 96.4,
      talkRatio: 0.42,
      fillerWordsEstimate: 3,
      longestTurnSeconds: 11.6,
    },
    ...overrides,
  };
}

export interface BackendConversationOptions {
  /** The Report once it is ready. */
  readonly report?: ConversationReport;
  /**
   * The statuses each Report request goes through, as the detail shows them,
   * one list per request. A request after the last list repeats it. Without
   * it, a Report request ends `ready` at once.
   */
  readonly afterRequest?: readonly (readonly ReportStatus[])[];
}

/** The backend already has this Conversation for the signed-in User. */
export function backendHasConversation(
  summary: ConversationSummary,
  {
    report = reportOf(),
    afterRequest = [['ready']],
  }: BackendConversationOptions = {},
): void {
  const ready = summary.reportStatus === 'ready';
  conversations.set(summary.roomName, {
    detail: { ...summary, report: ready ? report : null },
    report,
    afterRequest: afterRequest.map((statuses) => [...statuses]),
    pending: [],
  });
}

/** The `roomName` of every Report request, oldest first. */
export function reportRequestsReceived(): readonly string[] {
  return reportRequests;
}

/** The `roomName` of every request for one Conversation, oldest first. */
export function detailRequestsReceived(): readonly string[] {
  return detailRequests;
}

/** The `Authorization` header of every Conversation API request, oldest first. */
export function conversationRequestAuthorizations(): readonly (
  string | null
)[] {
  return authorizations;
}

export function resetConversationsBackend(): void {
  conversations.clear();
  reportRequests.length = 0;
  detailRequests.length = 0;
  authorizations.length = 0;
}

const NO_SUCH_CONVERSATION = {
  statusCode: 404,
  message: 'No Conversation has this room name.',
};

/**
 * Records the request's `Authorization` header, and answers as the backend's
 * authentication guard would. Resolves to `undefined` when it may go through.
 */
function guard(request: Request): Response | undefined {
  const authorization = request.headers.get('Authorization');
  authorizations.push(authorization);
  return refusalOfAuthorization(authorization ?? '');
}

/** Moves the Report on to the next status the Member's request scripted. */
function advance(conversation: BackendConversation): ConversationDetail {
  const next = conversation.pending.shift();
  if (next !== undefined) {
    conversation.detail = {
      ...conversation.detail,
      reportStatus: next,
      report: next === 'ready' ? conversation.report : null,
    };
  }
  return conversation.detail;
}

/**
 * The backend's Conversation API for the signed-in User: the list, one
 * Conversation and a Report request. A Report request answers `generating`
 * and then shows the statuses the Conversation was set up with.
 */
export const conversationHandlers = [
  http.get('/api/conversations', ({ request }) => {
    return (
      guard(request) ??
      HttpResponse.json({
        conversations: [...conversations.values()]
          .map(({ detail }) => conversationSummarySchema.parse(detail))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      })
    );
  }),
  http.get<{ roomName: string }>(
    '/api/conversations/:roomName',
    ({ request, params }) => {
      const refusal = guard(request);
      if (refusal !== undefined) {
        return refusal;
      }
      detailRequests.push(params.roomName);
      const conversation = conversations.get(params.roomName);
      return conversation === undefined
        ? HttpResponse.json(NO_SUCH_CONVERSATION, { status: 404 })
        : HttpResponse.json(advance(conversation));
    },
  ),
  http.post<{ roomName: string }>(
    '/api/conversations/:roomName/report',
    ({ request, params }) => {
      const refusal = guard(request);
      if (refusal !== undefined) {
        return refusal;
      }
      const conversation = conversations.get(params.roomName);
      if (conversation === undefined) {
        return HttpResponse.json(NO_SUCH_CONVERSATION, { status: 404 });
      }
      reportRequests.push(params.roomName);
      if (conversation.detail.reportStatus === 'ready') {
        return HttpResponse.json({ status: 'ready' }, { status: 202 });
      }
      const index = Math.min(
        reportRequests.filter((name) => name === params.roomName).length - 1,
        conversation.afterRequest.length - 1,
      );
      conversation.pending = [...(conversation.afterRequest[index] ?? [])];
      conversation.detail = {
        ...conversation.detail,
        reportStatus: 'generating',
        report: null,
      };
      return HttpResponse.json({ status: 'generating' }, { status: 202 });
    },
  ),
];
