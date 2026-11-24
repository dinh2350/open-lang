import { Banner } from '@astryxdesign/core/Banner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { Stack } from '@astryxdesign/core/Stack';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import type { ConversationSummary, ReportStatus } from '@open-lang/shared';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { useAuth } from '@/auth/auth-context';
import { formatDate, formatDuration } from './conversation-format';
import { fetchConversations } from './conversations-api';

const reportLabels: Record<ReportStatus | 'none', string> = {
  none: 'Chưa có',
  generating: 'Đang tạo',
  ready: 'Sẵn sàng',
  failed: 'Không tạo được',
};

/**
 * The Member's past Conversations, newest first, each linking to its Report.
 * Every Conversation is listed; there is no paging.
 */
export function HistoryPage() {
  const { user, authorizedFetch } = useAuth();
  const conversations = useQuery({
    // The key names the User, so a User who signs in on this tab never meets
    // what another User loaded here.
    queryKey: ['conversations', user?.id],
    queryFn: () => fetchConversations(authorizedFetch),
    // A refusal won't change on a retry.
    retry: false,
  });
  const captionId = useId();

  return (
    <Stack
      as="main"
      gap={6}
      padding={6}
      paddingBlockStart={10}
      maxWidth="56rem"
      style={{ marginInline: 'auto' }}
    >
      <Heading level={1}>Lịch sử học</Heading>
      {conversations.isPending && (
        <div role="status">
          <Text as="p" color="secondary">
            Đang tải lịch sử…
          </Text>
        </div>
      )}
      {conversations.error !== null && (
        <Banner
          status="error"
          role="alert"
          title="Không tải được lịch sử. Hãy thử lại sau."
        />
      )}
      {conversations.data?.conversations.length === 0 && (
        <EmptyState title="Bạn chưa có buổi học nào." headingLevel={2} />
      )}
      {conversations.data !== undefined &&
        conversations.data.conversations.length > 0 && (
          // Table wraps the <table> in a scroll region (role="group") that
          // takes its name from aria-labelledby, not from the caption.
          <Table verticalAlign="top" aria-labelledby={captionId}>
            {/* Astryx has no caption component; children mode puts this
                native caption straight into the <table>. */}
            <caption
              id={captionId}
              style={{
                captionSide: 'bottom',
                paddingBlockStart: 'var(--spacing-4)',
              }}
            >
              <Text type="supporting" color="secondary">
                Các buổi học của bạn, mới nhất trước.
              </Text>
            </caption>
            <TableHeader>
              <TableRow>
                <TableHeaderCell scope="col">Ngày</TableHeaderCell>
                <TableHeaderCell scope="col">Thời lượng</TableHeaderCell>
                <TableHeaderCell scope="col">Báo cáo</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.data.conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.roomName}
                  conversation={conversation}
                />
              ))}
            </TableBody>
          </Table>
        )}
    </Stack>
  );
}

function ConversationRow({
  conversation,
}: {
  readonly conversation: ConversationSummary;
}) {
  return (
    <TableRow>
      <TableHeaderCell scope="row">
        <Link
          href={`/conversations/${encodeURIComponent(conversation.roomName)}`}
        >
          <time dateTime={conversation.createdAt}>
            {formatDate(conversation.createdAt)}
          </time>
        </Link>
      </TableHeaderCell>
      <TableCell>{formatDuration(conversation.durationSeconds)}</TableCell>
      <TableCell>{reportLabels[conversation.reportStatus ?? 'none']}</TableCell>
    </TableRow>
  );
}
