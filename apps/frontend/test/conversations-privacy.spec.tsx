import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { PASSWORD, renderApp, signInAs, submitCredentials } from './app';
import { backendHasUser, browserIsSignedInAs } from './auth-backend';
import { backend } from './backend';
import {
  backendHasConversation,
  reportOf,
  summaryOf,
} from './conversations-backend';

const ADA = 'ada@example.test';
const BEN = 'ben@example.test';
const ROOM = 'conversation-1';
const ADAS_SENTENCE = 'Ada said this wrong.';

/** The next request for the history or for a Report waits until `release()`. */
function backendAnswersLate(): { release: () => void } {
  let resolveGate: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
  backend.use(
    http.get('/api/conversations', async () => {
      await gate;
      return HttpResponse.json({ conversations: [] });
    }),
    http.get('/api/conversations/:roomName', async () => {
      await gate;
      return HttpResponse.json({ statusCode: 404 }, { status: 404 });
    }),
  );
  return {
    release: () => {
      resolveGate?.();
    },
  };
}

async function signOutAndSignInAs(email: string): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Sign in' });
  backendHasUser(email, PASSWORD);
  await submitCredentials(email, PASSWORD, 'Sign in');
  await screen.findByRole('heading', { name: 'Gia sư tiếng Anh của bạn' });
}

describe('Conversations of another User', () => {
  it("does not show the previous User's history to the next User on the same tab", async () => {
    await signInAs(ADA);
    backendHasConversation(summaryOf(ROOM), { owner: ADA });
    await userEvent.click(screen.getByRole('link', { name: 'Lịch sử' }));
    await screen.findByRole('table');
    await signOutAndSignInAs(BEN);
    const { release } = backendAnswersLate();

    await userEvent.click(screen.getByRole('link', { name: 'Lịch sử' }));

    try {
      expect(await screen.findByText('Đang tải lịch sử…')).toBeVisible();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    } finally {
      release();
    }
    expect(await screen.findByText('Bạn chưa có buổi học nào.')).toBeVisible();
  });

  it("does not show the previous User's Report to the next User on the same tab", async () => {
    await signInAs(ADA);
    backendHasConversation(summaryOf(ROOM, { reportStatus: 'ready' }), {
      owner: ADA,
      report: reportOf({
        grammarIssues: [
          { said: ADAS_SENTENCE, corrected: 'Ada said this.', reason: 'x' },
        ],
      }),
    });
    await userEvent.click(screen.getByRole('link', { name: 'Lịch sử' }));
    await userEvent.click(await screen.findByRole('link', { name: /2026/ }));
    await screen.findByText(ADAS_SENTENCE);
    await signOutAndSignInAs(BEN);
    // Ben's own Conversation happens to have the same room name.
    backendHasConversation(summaryOf(ROOM, { reportStatus: 'ready' }), {
      owner: BEN,
    });
    await userEvent.click(screen.getByRole('link', { name: 'Lịch sử' }));
    const link = await screen.findByRole('link', { name: /2026/ });
    const { release } = backendAnswersLate();

    await userEvent.click(link);

    try {
      expect(
        await screen.findByRole('status', { name: 'Đang tải báo cáo' }),
      ).toBeVisible();
      expect(screen.queryByText(ADAS_SENTENCE)).not.toBeInTheDocument();
    } finally {
      release();
    }
    expect(
      await screen.findByText('Không tìm thấy buổi học này.'),
    ).toBeVisible();
  });

  it('replaces a Report shown from an earlier visit with "not found" when the backend now answers 404', async () => {
    browserIsSignedInAs(ADA, PASSWORD);
    backendHasConversation(summaryOf(ROOM, { reportStatus: 'ready' }), {
      report: reportOf({
        grammarIssues: [
          { said: ADAS_SENTENCE, corrected: 'Ada said this.', reason: 'x' },
        ],
      }),
    });
    renderApp('/conversations');
    await userEvent.click(await screen.findByRole('link', { name: /2026/ }));
    await screen.findByText(ADAS_SENTENCE);
    await userEvent.click(screen.getByRole('link', { name: 'Lịch sử' }));
    const link = await screen.findByRole('link', { name: /2026/ });
    backend.use(
      http.get('/api/conversations/:roomName', () =>
        HttpResponse.json({ statusCode: 404 }, { status: 404 }),
      ),
    );

    await userEvent.click(link);

    expect(
      await screen.findByText('Không tìm thấy buổi học này.'),
    ).toBeVisible();
    expect(screen.queryByText(ADAS_SENTENCE)).not.toBeInTheDocument();
  });
});
