import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { List, ListItem } from '@astryxdesign/core/List';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Stack } from '@astryxdesign/core/Stack';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Text } from '@astryxdesign/core/Text';
import type {
  Assessment,
  ConversationDetail,
  ConversationReport,
  Fluency,
  StoredNote,
} from '@open-lang/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { AssessmentIcon, NotebookIcon } from '@/icons';
import { NoteGroups } from '@/notes/note-groups';
import { formatDate, formatDuration, NO_VALUE } from './conversation-format';
import {
  ConversationNotFoundError,
  fetchConversation,
  fetchNotes,
  requestReport,
} from './conversations-api';

/** How often the Report is looked at again while the backend is making it. */
const POLL_MILLISECONDS = 2000;

function pollWhileGenerating(query: Query<ConversationDetail>): number | false {
  return query.state.data?.reportStatus === 'generating'
    ? POLL_MILLISECONDS
    : false;
}

/**
 * What the Member learned in one Conversation, in two tabs: the Notes the
 * tutor wrote (Đã học, shown first) and the tutor's short assessment (Gia sư
 * đánh giá). When the Conversation has no ready Report, the page asks the
 * backend to make it once, and looks again every two seconds while the
 * backend is making it. The Notes are there whatever the Report's status.
 */
export function ReportPage() {
  const { roomName = '' } = useParams();
  const { user, authorizedFetch } = useAuth();
  const queryClient = useQueryClient();
  // The keys name the User, so a User who signs in on this tab never meets
  // what another User loaded here.
  const queryKey = ['conversations', user?.id, roomName] as const;
  const conversation = useQuery({
    queryKey,
    queryFn: () => fetchConversation(authorizedFetch, roomName),
    refetchInterval: pollWhileGenerating,
    // A Conversation that is not found stays not found.
    retry: false,
  });
  const status = conversation.data?.reportStatus;
  // The Agent may send its last Notes as the room closes; while the Report
  // is being made they are looked at again too.
  const notes = useQuery({
    queryKey: [...queryKey, 'notes'] as const,
    queryFn: () => fetchNotes(authorizedFetch, roomName),
    refetchInterval: status === 'generating' ? POLL_MILLISECONDS : false,
    retry: false,
  });
  const report = useMutation({
    mutationFn: () => requestReport(authorizedFetch, roomName),
    // Returning the refetch keeps the request pending until the page shows
    // where the Report is now. The Notes, under the same key, are fetched again too.
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  const { mutate: askForReport } = report;
  const asked = useRef(false);
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
      gap={6}
      padding={6}
      paddingBlockStart={10}
      maxWidth="56rem"
      style={{ marginInline: 'auto' }}
    >
      <ReportContent
        conversation={conversation.data}
        error={conversation.error}
        notes={notes.data}
        notesFailed={notes.isError}
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
  /** The Conversation's Notes, oldest first, once they are loaded. */
  readonly notes: readonly StoredNote[] | undefined;
  readonly notesFailed: boolean;
  /** The backend is being asked to make the Report. */
  readonly isAsking: boolean;
  /** The backend could not be asked, or refused. */
  readonly askFailed: boolean;
  readonly onAskAgain: () => void;
}

/** The page's body for the state of the Conversation. */
function ReportContent({ conversation, error, ...rest }: ReportContentProps) {
  // A Conversation that is gone is never shown from an earlier answer.
  if (error instanceof ConversationNotFoundError) {
    return (
      <Banner
        status="error"
        role="alert"
        title="Không tìm thấy buổi học này."
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
  return <ReportTabs conversation={conversation} {...rest} />;
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

type ReportTab = 'learned' | 'assessment';

/** `{n} ghi chú · {duration} · {date}`; the count once the Notes are loaded. */
function summaryLine(
  conversation: ConversationDetail,
  notes: readonly StoredNote[] | undefined,
): string {
  return [
    notes === undefined ? null : `${String(notes.length)} ghi chú`,
    formatDuration(conversation.durationSeconds),
    formatDate(conversation.createdAt),
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

function ReportTabs({
  conversation,
  notes,
  notesFailed,
  isAsking,
  askFailed,
  onAskAgain,
}: Omit<ReportContentProps, 'error'> & {
  readonly conversation: ConversationDetail;
}) {
  const [tab, setTab] = useState<ReportTab>('learned');
  const learnedId = useId();
  const assessmentId = useId();
  return (
    <>
      <Stack gap={2}>
        <Heading level={1}>Hôm nay bạn học được gì</Heading>
        <Text as="p" color="secondary">
          {summaryLine(conversation, notes)}
        </Text>
      </Stack>
      <TabList
        role="tablist"
        hasDivider
        value={tab}
        onChange={(value) => {
          setTab(value === 'assessment' ? 'assessment' : 'learned');
        }}
      >
        <Tab
          value="learned"
          label="Đã học"
          panelId={learnedId}
          icon={<Icon icon={NotebookIcon} />}
        />
        <Tab
          value="assessment"
          label="Gia sư đánh giá"
          panelId={assessmentId}
          icon={<Icon icon={AssessmentIcon} />}
        />
      </TabList>
      <TabPanel id={learnedId} title="Đã học" isHidden={tab !== 'learned'}>
        <LearnedNotes notes={notes} failed={notesFailed} />
      </TabPanel>
      <TabPanel
        id={assessmentId}
        title="Gia sư đánh giá"
        isHidden={tab !== 'assessment'}
      >
        <AssessmentContent
          conversation={conversation}
          isAsking={isAsking}
          askFailed={askFailed}
          onAskAgain={onAskAgain}
        />
      </TabPanel>
    </>
  );
}

function TabPanel({
  id,
  title,
  isHidden,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly isHidden: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div id={id} role="tabpanel" aria-label={title} hidden={isHidden}>
      {children}
    </div>
  );
}

/** The Notes of the Conversation, grouped by kind. */
function LearnedNotes({
  notes,
  failed,
}: {
  readonly notes: readonly StoredNote[] | undefined;
  readonly failed: boolean;
}) {
  if (notes === undefined) {
    return failed ? (
      <Banner
        status="error"
        role="alert"
        title="Không tải được ghi chú. Hãy thử lại sau."
      />
    ) : (
      <div role="status" aria-label="Đang tải ghi chú">
        <Skeleton height={96} />
      </div>
    );
  }
  if (notes.length === 0) {
    return (
      <Text as="p" color="secondary">
        Chưa có ghi chú nào trong buổi này.
      </Text>
    );
  }
  return <NoteGroups notes={notes} headingLevel={2} />;
}

/** The tutor's assessment, or where it is while the backend makes it. */
function AssessmentContent({
  conversation,
  isAsking,
  askFailed,
  onAskAgain,
}: {
  readonly conversation: ConversationDetail;
  readonly isAsking: boolean;
  readonly askFailed: boolean;
  readonly onAskAgain: () => void;
}) {
  if (conversation.report !== null && conversation.reportStatus === 'ready') {
    return <ReadyAssessment report={conversation.report} />;
  }
  if (!isAsking && (conversation.reportStatus === 'failed' || askFailed)) {
    return (
      <Banner
        status="error"
        role="alert"
        title="Không tạo được phần đánh giá. Ghi chú của bạn vẫn còn nguyên."
        endContent={<Button label="Thử lại" size="sm" onClick={onAskAgain} />}
      />
    );
  }
  return (
    <div role="status">
      <Spinner size="lg" label="Đang tạo phần đánh giá…" />
    </div>
  );
}

function isEmpty({ overview, strengths, improvements }: Assessment): boolean {
  return overview === '' && strengths.length === 0 && improvements.length === 0;
}

function ReadyAssessment({ report }: { readonly report: ConversationReport }) {
  const { assessment, fluency } = report;
  return (
    <Stack gap={6}>
      {isEmpty(assessment) ? (
        <Text as="p" color="secondary">
          Chưa có đủ nội dung để đánh giá.
        </Text>
      ) : (
        <>
          {assessment.overview !== '' && (
            <Text as="p" size="lg">
              {assessment.overview}
            </Text>
          )}
          <AssessmentList title="Làm tốt" items={assessment.strengths} />
          <AssessmentList
            title="Cần cải thiện"
            items={assessment.improvements}
          />
        </>
      )}
      <AssessmentSection title="Trôi chảy">
        <FluencyLine fluency={fluency} />
      </AssessmentSection>
    </Stack>
  );
}

function AssessmentSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <Stack as="section" aria-labelledby={headingId} gap={3}>
      <Heading level={2} id={headingId}>
        {title}
      </Heading>
      {children}
    </Stack>
  );
}

/** A titled list of the assessment's items; nothing when there are none. */
function AssessmentList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <AssessmentSection title={title}>
      <List listStyle="disc">
        {items.map((item) => (
          <ListItem key={item} label={<Text>{item}</Text>} />
        ))}
      </List>
    </AssessmentSection>
  );
}

function wholeNumber(value: number | null): string {
  return value === null ? NO_VALUE : String(Math.round(value));
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
