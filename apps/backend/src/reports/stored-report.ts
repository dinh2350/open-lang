import {
  conversationReportSchema,
  type ConversationReport,
  type ReportStatus,
} from '@open-lang/shared';

/** A Report row as it is stored: its status and, once ready, its content. */
export interface StoredReportContent {
  readonly status: ReportStatus;
  readonly content: unknown;
}

/** A stored Report as the User may see it. */
export interface ReadableReport {
  readonly status: ReportStatus;
  readonly content: ConversationReport | null;
}

/**
 * Reads a stored Report. Ready content that breaks the Report's contract is
 * read as a failed Report with no content, so asking again writes it anew,
 * instead of failing every read. `broken` is true in that case.
 */
export function readStoredReport(
  report: StoredReportContent,
): ReadableReport & { readonly broken: boolean } {
  if (report.status !== 'ready') {
    return { status: report.status, content: null, broken: false };
  }
  const parsed = conversationReportSchema.safeParse(report.content);
  return parsed.success
    ? { status: 'ready', content: parsed.data, broken: false }
    : { status: 'failed', content: null, broken: true };
}
