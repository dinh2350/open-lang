import {
  type ConversationDetail,
  type ConversationReport,
  type ConversationSummary,
  conversationSummarySchema,
  type NoteKind,
  type ReportStatus,
  type StoredNote,
} from '@open-lang/shared';
import { http, HttpResponse } from 'msw';
import { emailOfAuthorization, refusalOfAuthorization } from './auth-backend';

/**
 * A Conversation the fake backend holds, and what the Report looks like once
 * the Member asks for it.
 */
interface BackendConversation {
  /** The email of the User it belongs to; without one, every User's. */
  owner: string | undefined;
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
const notesByRoom = new Map<string, StoredNote[]>();
const notesRequests: string[] = [];
let notesFail = false;

/** A Conversation's summary, with the values a test does not name filled in. */
export function summaryOf(
  roomName: string,
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    roomName,
    createdAt: '2026-11-23T12:00:00.000Z',
    durationSeconds: 754,
    reportStatus: null,
    noteCount: 0,
    ...overrides,
  };
}

/** A Report with a short assessment and every fluency number set. */
export function reportOf(
  overrides: Partial<ConversationReport> = {},
): ConversationReport {
  return {
    assessment: {
      overview: 'Bạn trả lời rõ ràng và đúng ý.',
      strengths: ['Trả lời nhanh.'],
      improvements: ['Dùng thì quá khứ khi kể chuyện.'],
    },
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
  /** The email of the User it belongs to. Without it, it belongs to every User. */
  readonly owner?: string;
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
    owner,
    report = reportOf(),
    afterRequest = [['ready']],
  }: BackendConversationOptions = {},
): void {
  const ready = summary.reportStatus === 'ready';
  conversations.set(summary.roomName, {
    owner,
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

/**
 * A Note as the backend returns it, with the values a test does not name
 * filled in. A correction gets what the Member said unless the test says.
 */
export function noteOf(
  kind: NoteKind,
  english: string,
  overrides: Partial<StoredNote> = {},
): StoredNote {
  return {
    id: `note-${kind}-${english}`,
    kind,
    english,
    meaning: `Nghĩa của ${english}`,
    said: kind === 'correction' ? `Wrong ${english}` : null,
    createdAt: '2026-11-24T12:00:00.000Z',
    ...overrides,
  };
}

/** The Agent has written these Notes in the room so far, oldest first. */
export function backendHasNotes(
  roomName: string,
  notes: readonly StoredNote[],
): void {
  notesByRoom.set(roomName, [...notes]);
}

/** From now on, every Notes request fails with a server error. */
export function notesRequestsFail(): void {
  notesFail = true;
}

/** The `roomName` of every Notes request, oldest first. */
export function notesRequestsReceived(): readonly string[] {
  return notesRequests;
}

export function resetConversationsBackend(): void {
  conversations.clear();
  reportRequests.length = 0;
  detailRequests.length = 0;
  authorizations.length = 0;
  notesByRoom.clear();
  notesRequests.length = 0;
  notesFail = false;
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

/** The Conversation with this room name, when it is the requesting User's. */
function conversationOf(
  request: Request,
  roomName: string,
): BackendConversation | undefined {
  const conversation = conversations.get(roomName);
  const email = emailOfAuthorization(request.headers.get('Authorization'));
  return conversation?.owner === undefined || conversation.owner === email
    ? conversation
    : undefined;
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
 * The Notes of a room, oldest first. Like the Room Token request, a request
 * without an Auth Token goes through, because the Conversation page's own
 * specs render it without an AuthProvider.
 */
function answerNotes(request: Request, roomName: string): Response {
  const authorization = request.headers.get('Authorization');
  authorizations.push(authorization);
  const refusal =
    authorization === null ? undefined : refusalOfAuthorization(authorization);
  if (refusal !== undefined) {
    return refusal;
  }
  notesRequests.push(roomName);
  if (notesFail) {
    return HttpResponse.json(
      { statusCode: 500, message: 'Internal server error' },
      { status: 500 },
    );
  }
  if (
    conversations.has(roomName) &&
    conversationOf(request, roomName) === undefined
  ) {
    return HttpResponse.json(NO_SUCH_CONVERSATION, { status: 404 });
  }
  return HttpResponse.json({ notes: notesByRoom.get(roomName) ?? [] });
}

/**
 * The backend's Conversation API for the signed-in User: the list, one
 * Conversation, its Notes and a Report request. A Report request answers `generating`
 * and then shows the statuses the Conversation was set up with.
 */
export const conversationHandlers = [
  http.get('/api/conversations', ({ request }) => {
    return (
      guard(request) ??
      HttpResponse.json({
        conversations: [...conversations.keys()]
          .map((roomName) => conversationOf(request, roomName))
          .filter((conversation) => conversation !== undefined)
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
      const conversation = conversationOf(request, params.roomName);
      return conversation === undefined
        ? HttpResponse.json(NO_SUCH_CONVERSATION, { status: 404 })
        : HttpResponse.json(advance(conversation));
    },
  ),
  http.get<{ roomName: string }>(
    '/api/conversations/:roomName/notes',
    ({ request, params }) => answerNotes(request, params.roomName),
  ),
  http.post<{ roomName: string }>(
    '/api/conversations/:roomName/report',
    ({ request, params }) => {
      const refusal = guard(request);
      if (refusal !== undefined) {
        return refusal;
      }
      const conversation = conversationOf(request, params.roomName);
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
