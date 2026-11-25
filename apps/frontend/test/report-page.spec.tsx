import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD, renderApp } from './app';
import { browserIsSignedInAs } from './auth-backend';
import {
  backendHasConversation,
  backendHasNotes,
  type BackendConversationOptions,
  detailRequestsReceived,
  noteOf,
  reportOf,
  reportRequestsReceived,
  summaryOf,
} from './conversations-backend';
import type { ConversationSummary, StoredNote } from '@open-lang/shared';

const ADA = 'ada@example.test';
const ROOM = 'conversation-1';

const OVERVIEW = 'Bạn trả lời rõ ràng và đúng ý.';
const GENERATING = 'Đang tạo phần đánh giá…';
const FAILED = 'Không tạo được phần đánh giá. Ghi chú của bạn vẫn còn nguyên.';
const NO_NOTES = 'Chưa có ghi chú nào trong buổi này.';

/** Ada has this Conversation and these Notes, and opens its Report page. */
function openReport(
  summary: Partial<ConversationSummary>,
  options?: BackendConversationOptions,
  notes: readonly StoredNote[] = [],
): void {
  browserIsSignedInAs(ADA, PASSWORD);
  backendHasConversation(summaryOf(ROOM, summary), options);
  backendHasNotes(ROOM, notes);
  renderApp(`/conversations/${ROOM}`);
}

/** Opens the Gia sư đánh giá tab and returns its panel. */
async function openAssessment(): Promise<HTMLElement> {
  await userEvent.click(
    await screen.findByRole('tab', { name: 'Gia sư đánh giá' }),
  );
  return screen.getByRole('tabpanel', { name: 'Gia sư đánh giá' });
}

describe('Report page', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens on Đã học with the notes before the Report exists', async () => {
    openReport({}, { afterRequest: [['generating']] }, [
      noteOf('phrase', 'Could you walk me through it?'),
      noteOf('correction', 'I went home.', { said: 'I goed home.' }),
    ]);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Hôm nay bạn học được gì',
      }),
    ).toBeVisible();
    const tab = screen.getByRole('tab', { name: 'Đã học' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'Đã học' });
    expect(
      await within(panel).findByText('Could you walk me through it?'),
    ).toBeVisible();
    expect(
      within(panel).getByText('I goed home.').closest('del'),
    ).not.toBeNull();
    await waitFor(() => {
      expect(reportRequestsReceived()).toEqual([ROOM]);
    });
  });

  it('shows Chưa có ghi chú nào trong buổi này. when there are none', async () => {
    openReport({ reportStatus: 'ready' });

    const panel = await screen.findByRole('tabpanel', { name: 'Đã học' });

    expect(await within(panel).findByText(NO_NOTES)).toBeVisible();
  });

  it('a missed note shows under Câu nghe sót', async () => {
    openReport({ reportStatus: 'ready' }, {}, [
      noteOf('missed', "Let's circle back after lunch.", {
        meaning: 'Mình bàn lại sau bữa trưa nhé.',
      }),
    ]);

    const group = await screen.findByRole('region', {
      name: 'Câu nghe sót (1)',
    });

    expect(group).toHaveTextContent("Let's circle back after lunch.");
    expect(group).toHaveTextContent('Mình bàn lại sau bữa trưa nhé.');
  });

  it('heads the page with the number of notes, the duration and the date', async () => {
    openReport({ reportStatus: 'ready' }, {}, [
      noteOf('phrase', 'One.'),
      noteOf('word', 'two'),
    ]);

    expect(
      await screen.findByText('2 ghi chú · 13 phút · 23 thg 11, 2026'),
    ).toBeVisible();
  });

  it('Gia sư đánh giá shows overview, Làm tốt and Cần cải thiện when ready', async () => {
    openReport(
      { reportStatus: 'ready' },
      {
        report: reportOf({
          assessment: {
            overview: OVERVIEW,
            strengths: ['Trả lời nhanh.', 'Dùng từ đúng.'],
            improvements: ['Dùng thì quá khứ.'],
          },
        }),
      },
    );

    const panel = await openAssessment();

    expect(within(panel).getByText(OVERVIEW)).toBeVisible();
    const strengths = within(panel).getByRole('region', { name: 'Làm tốt' });
    expect(
      within(strengths)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Trả lời nhanh.', 'Dùng từ đúng.']);
    const improvements = within(panel).getByRole('region', {
      name: 'Cần cải thiện',
    });
    expect(improvements).toHaveTextContent('Dùng thì quá khứ.');
    expect(reportRequestsReceived()).toEqual([]);
  });

  it('leaves out Làm tốt and Cần cải thiện when their lists are empty', async () => {
    openReport(
      { reportStatus: 'ready' },
      {
        report: reportOf({
          assessment: { overview: OVERVIEW, strengths: [], improvements: [] },
        }),
      },
    );

    const panel = await openAssessment();

    expect(within(panel).getByText(OVERVIEW)).toBeVisible();
    expect(
      within(panel).queryByRole('region', { name: 'Làm tốt' }),
    ).not.toBeInTheDocument();
    expect(
      within(panel).queryByRole('region', { name: 'Cần cải thiện' }),
    ).not.toBeInTheDocument();
  });

  it('says there is not enough to assess when the assessment is empty', async () => {
    openReport(
      { reportStatus: 'ready' },
      {
        report: reportOf({
          assessment: { overview: '', strengths: [], improvements: [] },
        }),
      },
    );

    const panel = await openAssessment();

    expect(
      within(panel).getByText('Chưa có đủ nội dung để đánh giá.'),
    ).toBeVisible();
  });

  it('Gia sư đánh giá shows a spinner while generating', async () => {
    openReport({}, { afterRequest: [['generating']] });

    const panel = await openAssessment();

    expect(await within(panel).findByText(GENERATING)).toBeVisible();
  });

  it('asks for the Report once and looks again every two seconds until it is ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openReport({}, { afterRequest: [['generating', 'ready']] });

    const panel = await openAssessment();
    expect(await within(panel).findByText(GENERATING)).toBeVisible();
    await waitFor(() => {
      expect(reportRequestsReceived()).toEqual([ROOM]);
    });

    // The Report is polled every two seconds, not before.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });
    expect(within(panel).getByText(GENERATING)).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(await within(panel).findByText(OVERVIEW)).toBeVisible();
    expect(within(panel).queryByText(GENERATING)).not.toBeInTheDocument();
    const detailRequestsBefore = detailRequestsReceived().length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(detailRequestsReceived()).toHaveLength(detailRequestsBefore);
    expect(reportRequestsReceived()).toEqual([ROOM]);
  });

  it('a failed Report shows the banner on Gia sư đánh giá and the notes on Đã học', async () => {
    openReport({}, { afterRequest: [['failed']] }, [noteOf('word', 'blocker')]);

    const panel = await openAssessment();
    expect(await within(panel).findByText(FAILED)).toBeVisible();

    await userEvent.click(screen.getByRole('tab', { name: 'Đã học' }));

    const notes = screen.getByRole('tabpanel', { name: 'Đã học' });
    expect(within(notes).getByText('blocker')).toBeVisible();
  });

  it('Thử lại asks for the Report again', async () => {
    openReport({}, { afterRequest: [['failed'], ['generating', 'ready']] });

    const panel = await openAssessment();
    expect(await within(panel).findByText(FAILED)).toBeVisible();
    expect(reportRequestsReceived()).toEqual([ROOM]);

    await userEvent.click(
      within(panel).getByRole('button', { name: 'Thử lại' }),
    );

    expect(
      await within(panel).findByText(OVERVIEW, {}, { timeout: 5000 }),
    ).toBeVisible();
    expect(reportRequestsReceived()).toEqual([ROOM, ROOM]);
    expect(within(panel).queryByText(FAILED)).not.toBeInTheDocument();
  });

  it('shows the fluency line with an em dash for missing numbers', async () => {
    openReport(
      { reportStatus: 'ready' },
      {
        report: reportOf({
          fluency: {
            wordsPerMinute: null,
            talkRatio: 0.424,
            fillerWordsEstimate: 3,
            longestTurnSeconds: null,
          },
        }),
      },
    );

    const panel = await openAssessment();

    expect(panel).toHaveTextContent(
      '— từ/phút · bạn nói 42% thời gian · từ đệm khoảng 3 (ước lượng) · lượt dài nhất — giây',
    );
  });

  it('shows the fluency line with every number', async () => {
    openReport({ reportStatus: 'ready' });

    const panel = await openAssessment();

    expect(panel).toHaveTextContent(
      '96 từ/phút · bạn nói 42% thời gian · từ đệm khoảng 3 (ước lượng) · lượt dài nhất 12 giây',
    );
  });

  it('says the Conversation was not found when the backend answers 404', async () => {
    browserIsSignedInAs(ADA, PASSWORD);

    renderApp('/conversations/someone-elses-room');

    expect(
      await screen.findByText('Không tìm thấy buổi học này.'),
    ).toBeVisible();
    expect(reportRequestsReceived()).toEqual([]);
  });

  it('shows the nav links for a signed-in User', async () => {
    openReport({ reportStatus: 'ready' });
    await screen.findByRole('heading', { name: 'Hôm nay bạn học được gì' });

    const nav = screen.getByRole('navigation', { name: 'Chính' });

    expect(within(nav).getByRole('link', { name: 'Học' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(nav).getByRole('link', { name: 'Lịch sử' })).toHaveAttribute(
      'href',
      '/conversations',
    );
    await userEvent.click(within(nav).getByRole('link', { name: 'Lịch sử' }));
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Lịch sử học' }),
      ).toBeVisible();
    });
    expect(within(nav).getByRole('link', { name: 'Lịch sử' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
