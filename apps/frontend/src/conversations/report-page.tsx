import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import {
  type ConversationDetail,
  type ConversationReport,
  type Fluency,
  type GrammarIssue,
  type ListeningMiss,
  SPEED_LABELS,
} from '@open-lang/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import {
  formatDate,
  formatDuration,
  NO_VALUE,
  scenarioTitle,
} from './conversation-format';
import {
  ConversationNotFoundError,
  fetchConversation,
  requestReport,
} from './conversations-api';
import { splitKeyPhrases } from './key-phrases';

/** How often the Report is looked at again while the backend is making it. */
const POLL_MILLISECONDS = 2000;

// Text has no success color; the theme's status text token gives one.
const successTextStyle = { color: 'var(--color-text-success)' } as const;

function pollWhileGenerating(query: Query<ConversationDetail>): number | false {
  return query.state.data?.reportStatus === 'generating'
    ? POLL_MILLISECONDS
    : false;
}

/**
 * The Report of one Conversation, on one scrolling page. When the Conversation
 * has no ready Report, the page asks the backend to make it once, and looks
 * again every two seconds while the backend is making it.
 */
export function ReportPage() {
  const { roomName = '' } = useParams();
  const { user, authorizedFetch } = useAuth();
  const queryClient = useQueryClient();
  // The key names the User, so a User who signs in on this tab never meets
  // what another User loaded here.
  const queryKey = ['conversations', user?.id, roomName] as const;
  const conversation = useQuery({
    queryKey,
    queryFn: () => fetchConversation(authorizedFetch, roomName),
    refetchInterval: pollWhileGenerating,
    // A Conversation that is not found stays not found.
    retry: false,
  });
  const report = useMutation({
    mutationFn: () => requestReport(authorizedFetch, roomName),
    // Returning the refetch keeps the request pending until the page shows
    // where the Report is now.
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  const { mutate: askForReport } = report;
  const asked = useRef(false);
  const status = conversation.data?.reportStatus;
  const mustAsk = conversation.data !== undefined && status !== 'ready';

  // Once per visit, ask for a Report that is not there yet.
  useEffect(() => {
    if (mustAsk && !asked.current) {
      asked.current = true;
      askForReport();
    }
  }, [mustAsk, askForReport]);

  return (
    <Stack
      as="main"
      gap={8}
      padding={6}
      paddingBlockStart={10}
      maxWidth="56rem"
      style={{ marginInline: 'auto' }}
    >
      <ReportContent
        conversation={conversation.data}
        error={conversation.error}
        isAsking={report.isPending || (mustAsk && report.isIdle)}
        askFailed={report.isError}
        onAskAgain={askForReport}
      />
    </Stack>
  );
}

interface ReportContentProps {
  readonly conversation: ConversationDetail | undefined;
  readonly error: Error | null;
  /** The backend is being asked to make the Report. */
  readonly isAsking: boolean;
  /** The backend could not be asked, or refused. */
  readonly askFailed: boolean;
  readonly onAskAgain: () => void;
}

/** The page's body for the state of the Conversation and its Report. */
function ReportContent({
  conversation,
  error,
  isAsking,
  askFailed,
  onAskAgain,
}: ReportContentProps) {
  // A Conversation that is gone is never shown from an earlier answer.
  if (error instanceof ConversationNotFoundError) {
    return (
      <Banner
        status="error"
        role="alert"
        title="Không tìm thấy buổi luyện này."
      />
    );
  }
  if (conversation === undefined) {
    return error === null ? (
      <ReportLoading />
    ) : (
      <Banner
        status="error"
        role="alert"
        title="Không tải được báo cáo. Hãy thử lại sau."
      />
    );
  }
  if (conversation.report !== null && conversation.reportStatus === 'ready') {
    return (
      <ReadyReport conversation={conversation} report={conversation.report} />
    );
  }
  if (!isAsking && (conversation.reportStatus === 'failed' || askFailed)) {
    return (
      <Banner
        status="error"
        role="alert"
        title="Không tạo được báo cáo."
        endContent={<Button label="Thử lại" size="sm" onClick={onAskAgain} />}
      />
    );
  }
  return (
    <div role="status">
      <Spinner size="lg" label="Đang tạo báo cáo…" />
    </div>
  );
}

function ReportLoading() {
  return (
    <div role="status" aria-label="Đang tải báo cáo">
      <Stack gap={4}>
        <Skeleton width="60%" height={32} />
        <Skeleton height={96} />
        <Skeleton height={160} />
      </Stack>
    </div>
  );
}

function wholeNumber(value: number | null): string {
  return value === null ? NO_VALUE : String(Math.round(value));
}

function ReadyReport({
  conversation,
  report,
}: {
  readonly conversation: ConversationDetail;
  readonly report: ConversationReport;
}) {
  const { listeningMisses, grammarIssues, fluency } = report;
  return (
    <>
      <Heading level={1}>
        {`${scenarioTitle(conversation.scenarioId)} · ${formatDuration(conversation.durationSeconds)} · ${formatDate(conversation.createdAt)} · ${SPEED_LABELS[conversation.speed]}`}
      </Heading>
      <Grid
        role="group"
        aria-label="Tóm tắt"
        columns={{ minWidth: 140, max: 3 }}
        gap={4}
      >
        <NumberCard
          value={String(listeningMisses.length)}
          label="câu nghe sót"
        />
        <NumberCard value={String(grammarIssues.length)} label="lỗi ngữ pháp" />
        <NumberCard
          value={wholeNumber(fluency.wordsPerMinute)}
          label="từ/phút"
        />
      </Grid>
      <ReportSection title="1. Câu bạn nghe sót">
        {listeningMisses.length === 0 ? (
          <Text as="p" color="secondary">
            {'Bạn không bấm "Chưa nghe kịp" lần nào.'}
          </Text>
        ) : (
          listeningMisses.map((miss) => (
            <ListeningMissCard key={miss.agentText} miss={miss} />
          ))
        )}
      </ReportSection>
      <ReportSection title="2. Lỗi ngữ pháp">
        {grammarIssues.length === 0 ? (
          <Text as="p" color="secondary">
            Không tìm thấy lỗi ngữ pháp.
          </Text>
        ) : (
          grammarIssues.map((issue) => (
            <GrammarIssueCard key={issue.said} issue={issue} />
          ))
        )}
      </ReportSection>
      <ReportSection title="3. Trôi chảy">
        <FluencyLine fluency={fluency} />
      </ReportSection>
    </>
  );
}

function NumberCard({
  value,
  label,
}: {
  readonly value: string;
  readonly label: string;
}) {
  return (
    <Card>
      <Stack gap={1}>
        <Text size="3xl" weight="semibold" hasTabularNumbers>
          {value}
        </Text>
        <Text type="supporting" color="secondary">
          {label}
        </Text>
      </Stack>
    </Card>
  );
}

function ReportSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <Stack as="section" aria-labelledby={headingId} gap={4}>
      <Heading level={2} id={headingId}>
        {title}
      </Heading>
      {children}
    </Stack>
  );
}

/** What the Agent said that the Member missed, with its key phrases in bold. */
function ListeningMissCard({ miss }: { readonly miss: ListeningMiss }) {
  const pieces = splitKeyPhrases(miss.agentText, miss.keyPhrases);
  return (
    <Card>
      <Stack gap={2}>
        <Text as="p">
          <span lang="en">
            {pieces.map(({ text, isKeyPhrase }, index) =>
              isKeyPhrase ? (
                <strong key={`${String(index)}-${text}`}>{text}</strong>
              ) : (
                text
              ),
            )}
          </span>
        </Text>
        <Text as="p" color="secondary">
          {miss.explanation}
        </Text>
      </Stack>
    </Card>
  );
}

/** A sentence the Member said wrong, struck through, then the fix and why. */
function GrammarIssueCard({ issue }: { readonly issue: GrammarIssue }) {
  return (
    <Card>
      <Stack gap={2}>
        <Stack gap={0.5}>
          <Text type="supporting" color="secondary">
            Bạn nói:
          </Text>
          <Text as="p" color="secondary">
            <del lang="en">{issue.said}</del>
          </Text>
        </Stack>
        <Stack gap={0.5}>
          <Text type="supporting" color="secondary">
            Sửa thành:
          </Text>
          <Text as="p" weight="semibold" style={successTextStyle}>
            <ins lang="en">{issue.corrected}</ins>
          </Text>
        </Stack>
        <Text as="p" color="secondary">
          {issue.reason}
        </Text>
      </Stack>
    </Card>
  );
}

/** The fluency numbers on one line; a number that could not be measured is a dash. */
function FluencyLine({ fluency }: { readonly fluency: Fluency }) {
  const talkPercent =
    fluency.talkRatio === null ? null : fluency.talkRatio * 100;
  return (
    <Text as="p">
      {`${wholeNumber(fluency.wordsPerMinute)} từ/phút · bạn nói ${wholeNumber(talkPercent)}% thời gian · từ đệm khoảng ${String(fluency.fillerWordsEstimate)} (ước lượng) · lượt dài nhất ${wholeNumber(fluency.longestTurnSeconds)} giây`}
    </Text>
  );
}
