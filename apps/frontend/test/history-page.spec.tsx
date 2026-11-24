import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { PASSWORD, renderApp } from './app';
import { browserIsSignedInAs } from './auth-backend';
import { backend } from './backend';
import {
  backendHasConversation,
  conversationRequestAuthorizations,
  reportOf,
  summaryOf,
} from './conversations-backend';

const ADA = 'ada@example.test';

describe('History page', () => {
  it('lists past Conversations, newest first', async () => {
    browserIsSignedInAs(ADA, PASSWORD);
    backendHasConversation(
      summaryOf('conversation-1', {
        createdAt: '2026-11-21T12:00:00.000Z',
        durationSeconds: 300,
        reportStatus: 'ready',
      }),
    );
    backendHasConversation(
      summaryOf('conversation-2', {
        createdAt: '2026-11-23T12:00:00.000Z',
        durationSeconds: 754,
        reportStatus: 'generating',
      }),
    );
    backendHasConversation(
      summaryOf('conversation-3', {
        createdAt: '2026-11-22T12:00:00.000Z',
        durationSeconds: null,
        reportStatus: null,
      }),
    );

    renderApp('/conversations');

    expect(
      await screen.findByRole('heading', { name: 'Lịch sử học' }),
    ).toBeVisible();
    const rows = within(await screen.findByRole('table')).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'NgàyThời lượngBáo cáo',
      '23 thg 11, 202613 phútĐang tạo',
      '22 thg 11, 2026—Chưa có',
      '21 thg 11, 20265 phútSẵn sàng',
    ]);
    expect(conversationRequestAuthorizations()).toEqual([
      expect.stringMatching(/^Bearer /),
    ]);
  });

  it('names the table, and the region it scrolls in, by its caption', async () => {
    browserIsSignedInAs(ADA, PASSWORD);
    backendHasConversation(summaryOf('conversation-1'));

    renderApp('/conversations');

    expect(
      await screen.findByRole('table', {
        name: 'Các buổi học của bạn, mới nhất trước.',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('group', {
        name: 'Các buổi học của bạn, mới nhất trước.',
      }),
    ).toBeVisible();
  });

  it('shows the empty state', async () => {
    browserIsSignedInAs(ADA, PASSWORD);

    renderApp('/conversations');

    expect(await screen.findByText('Bạn chưa có buổi học nào.')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says so when the history cannot be loaded', async () => {
    browserIsSignedInAs(ADA, PASSWORD);
    backend.use(
      http.get(
        '/api/conversations',
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    renderApp('/conversations');

    expect(
      await screen.findByText('Không tải được lịch sử. Hãy thử lại sau.'),
    ).toBeVisible();
  });

  it('links each row to its Report', async () => {
    browserIsSignedInAs(ADA, PASSWORD);
    backendHasConversation(
      summaryOf('conversation-7', { reportStatus: 'ready' }),
      {
        report: reportOf({
          grammarIssues: [
            {
              said: 'I goed',
              corrected: 'I went',
              reason: 'Quá khứ bất quy tắc.',
            },
          ],
        }),
      },
    );
    renderApp('/conversations');
    const row = (await screen.findByText('Sẵn sàng')).closest('tr');
    expect(row).not.toBeNull();

    await userEvent.click(
      within(row as HTMLElement).getByRole('link', { name: /23/ }),
    );

    expect(
      await screen.findByRole('heading', { name: /13 phút/ }),
    ).toBeVisible();
    expect(await screen.findByText('I went')).toBeVisible();
  });
});
