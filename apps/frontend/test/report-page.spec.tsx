import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD, renderApp } from './app';
import { browserIsSignedInAs } from './auth-backend';
import {
  backendHasConversation,
  type BackendConversationOptions,
  detailRequestsReceived,
  reportOf,
  reportRequestsReceived,
  summaryOf,
} from './conversations-backend';
import type { ConversationSummary } from '@open-lang/shared';

const ADA = 'ada@example.test';
const ROOM = 'conversation-1';

/** Ada has this Conversation, and opens its Report page. */
function openReport(
  summary: Partial<ConversationSummary>,
  options?: BackendConversationOptions,
): void {
  browserIsSignedInAs(ADA, PASSWORD);
  backendHasConversation(summaryOf(ROOM, summary), options);
  renderApp(`/conversations/${ROOM}`);
}

describe('Report page', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks the backend to make the Report and shows the generating state, then the ready Report', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openReport(
      {},
      {
        afterRequest: [['generating', 'ready']],
        report: reportOf({
          grammarIssues: [
            { said: 'I goed', corrected: 'I went', reason: 'Quá khứ.' },
          ],
        }),
      },
    );

    expect(await screen.findByText('Đang tạo báo cáo…')).toBeVisible();
    await waitFor(() => {
      expect(reportRequestsReceived()).toEqual([ROOM]);
    });

    // The Report is polled every two seconds, not before.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });
    expect(screen.getByText('Đang tạo báo cáo…')).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(await screen.findByText('I went')).toBeVisible();
    expect(screen.queryByText('Đang tạo báo cáo…')).not.toBeInTheDocument();
    expect(reportRequestsReceived()).toEqual([ROOM]);
  });

  it('stops polling once the Report is ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openReport({}, { afterRequest: [['generating', 'ready']] });
    await screen.findByText('Đang tạo báo cáo…');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    await screen.findByRole('heading', { name: '1. Câu bạn nghe sót' });
    const detailRequestsBefore = detailRequestsReceived().length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(detailRequestsReceived()).toHaveLength(detailRequestsBefore);
    expect(reportRequestsReceived()).toEqual([ROOM]);
    expect(
      screen.getByRole('heading', { name: '1. Câu bạn nghe sót' }),
    ).toBeVisible();
  });

  it('does not ask for a Report that is already ready', async () => {
    openReport({ reportStatus: 'ready' });

    expect(
      await screen.findByRole('heading', { name: '1. Câu bạn nghe sót' }),
    ).toBeVisible();
    expect(reportRequestsReceived()).toEqual([]);
  });

  it('titles the Report with the duration and the date only, above three number cards', async () => {
    openReport(
      { reportStatus: 'ready' },
      {
        report: reportOf({
          listeningMisses: [
            {
              agentText: 'Could you repeat?',
              keyPhrases: [],
              explanation: 'Lời nhờ nhắc lại.',
            },
            {
              agentText: 'Say again.',
              keyPhrases: [],
              explanation: 'Nhắc lại.',
            },
          ],
          grammarIssues: [
            { said: 'I goed', corrected: 'I went', reason: 'Quá khứ.' },
          ],
        }),
      },
    );

    const title = await screen.findByRole('heading', { level: 1 });

    expect(title).toHaveTextContent(/^13 phút · 23 thg 11, 2026$/);
    const cards = screen.getByRole('group', { name: 'Tóm tắt' });
    expect(cards).toHaveTextContent('2câu nghe sót1lỗi ngữ pháp96từ/phút');
  });

  it('shows the missed sentences with key phrases in bold and the Vietnamese explanation', async () => {
    openReport(
      { reportStatus: 'ready' },
      {
        report: reportOf({
          listeningMisses: [
            {
              agentText: 'Could you walk me through the blockers, then?',
              keyPhrases: ['walk me through', 'THE BLOCKERS', 'blockers'],
              explanation:
                'Nghĩa là: hãy kể từng bước <b>về</b> các vướng mắc.',
            },
          ],
        }),
      },
    );

    const section = await screen.findByRole('region', {
      name: '1. Câu bạn nghe sót',
    });

    expect(section).toHaveTextContent(
      'Could you walk me through the blockers, then?',
    );
    const bold = [...section.querySelectorAll('strong')].map(
      (element) => element.textContent,
    );
    expect(bold).toEqual(['walk me through', 'the blockers']);
    // The explanation is plain text, never HTML.
    expect(
      within(section).getByText(
        'Nghĩa là: hãy kể từng bước <b>về</b> các vướng mắc.',
      ),
    ).toBeVisible();
    expect(section.querySelector('b')).toBeNull();
  });

  it('matches a key phrase as text, not as a pattern', async () => {
    openReport(
      { reportStatus: 'ready' },
      {
        report: reportOf({
          listeningMisses: [
            {
              agentText: 'Is it (really) done? a+b',
              keyPhrases: ['(really)', 'a+b', '.*'],
              explanation: 'x',
            },
          ],
        }),
      },
    );

    const section = await screen.findByRole('region', {
      name: '1. Câu bạn nghe sót',
    });

    expect(
      [...section.querySelectorAll('strong')].map((e) => e.textContent),
    ).toEqual(['(really)', 'a+b']);
  });

  it('shows each grammar issue with the wrong sentence struck, the correction and the reason', async () => {
    openReport(
      { reportStatus: 'ready' },
      {
        report: reportOf({
          grammarIssues: [
            {
              said: 'Yesterday I goed to the office.',
              corrected: 'Yesterday I went to the office.',
              reason: 'Go là động từ bất quy tắc: quá khứ là went.',
            },
          ],
        }),
      },
    );

    const section = await screen.findByRole('region', {
      name: '2. Lỗi ngữ pháp',
    });

    expect(
      within(section)
        .getByText('Yesterday I goed to the office.')
        .closest('del'),
    ).not.toBeNull();
    expect(
      within(section)
        .getByText('Yesterday I went to the office.')
        .closest('ins'),
    ).not.toBeNull();
    expect(
      within(section).getByText('Go là động từ bất quy tắc: quá khứ là went.'),
    ).toBeVisible();
  });

  it('tells which sentence is wrong and which is the correction, in words', async () => {
    openReport(
      { reportStatus: 'ready' },
      {
        report: reportOf({
          grammarIssues: [
            {
              said: 'Yesterday I goed to the office.',
              corrected: 'Yesterday I went to the office.',
              reason: 'Go là động từ bất quy tắc.',
            },
          ],
        }),
      },
    );

    const section = await screen.findByRole('region', {
      name: '2. Lỗi ngữ pháp',
    });

    const text = section.textContent;
    const said = text.indexOf('Bạn nói:');
    const wrong = text.indexOf('Yesterday I goed to the office.');
    const fix = text.indexOf('Sửa thành:');
    const corrected = text.indexOf('Yesterday I went to the office.');
    expect(said).toBeGreaterThanOrEqual(0);
    expect(wrong).toBeGreaterThan(said);
    expect(fix).toBeGreaterThan(wrong);
    expect(corrected).toBeGreaterThan(fix);
    expect(text.indexOf('Go là động từ bất quy tắc.')).toBeGreaterThan(
      corrected,
    );
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

    const section = await screen.findByRole('region', { name: '3. Trôi chảy' });

    expect(section).toHaveTextContent(
      '— từ/phút · bạn nói 42% thời gian · từ đệm khoảng 3 (ước lượng) · lượt dài nhất — giây',
    );
  });

  it('shows the fluency line with every number', async () => {
    openReport({ reportStatus: 'ready' });

    const section = await screen.findByRole('region', { name: '3. Trôi chảy' });

    expect(section).toHaveTextContent(
      '96 từ/phút · bạn nói 42% thời gian · từ đệm khoảng 3 (ước lượng) · lượt dài nhất 12 giây',
    );
  });

  it('shows the empty states', async () => {
    openReport({ reportStatus: 'ready' });

    const misses = await screen.findByRole('region', {
      name: '1. Câu bạn nghe sót',
    });
    expect(misses).toHaveTextContent('Bạn không bấm "Chưa nghe kịp" lần nào.');
    expect(
      screen.getByRole('region', { name: '2. Lỗi ngữ pháp' }),
    ).toHaveTextContent('Không tìm thấy lỗi ngữ pháp.');
  });

  it('says the Conversation was not found when the backend answers 404', async () => {
    browserIsSignedInAs(ADA, PASSWORD);

    renderApp('/conversations/someone-elses-room');

    expect(
      await screen.findByText('Không tìm thấy buổi học này.'),
    ).toBeVisible();
    expect(reportRequestsReceived()).toEqual([]);
  });

  it('shows a failed Report as an error, and Thử lại asks again', async () => {
    openReport({}, { afterRequest: [['failed'], ['generating', 'ready']] });

    expect(await screen.findByText('Không tạo được báo cáo.')).toBeVisible();
    expect(reportRequestsReceived()).toEqual([ROOM]);

    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(
      await screen.findByRole(
        'heading',
        { name: '1. Câu bạn nghe sót' },
        { timeout: 5000 },
      ),
    ).toBeVisible();
    expect(reportRequestsReceived()).toEqual([ROOM, ROOM]);
    expect(
      screen.queryByText('Không tạo được báo cáo.'),
    ).not.toBeInTheDocument();
  });

  it('shows the nav links for a signed-in User', async () => {
    openReport({ reportStatus: 'ready' });
    await screen.findByRole('heading', { name: '1. Câu bạn nghe sót' });

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
