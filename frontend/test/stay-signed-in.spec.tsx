import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { PASSWORD, reloadApp, renderApp, submitCredentials } from './app';
import {
  authRequestsReceived,
  authTokensIssued,
  backendHasUser,
} from './auth-backend';
import { backend, roomTokenRequestAuthorizations } from './backend';

const ONE_DAY = 24 * 60 * 60_000;

/** Moves the clock forward, for the app and the backend alike. */
function travelForward(milliseconds: number): void {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  vi.setSystemTime(Date.now() + milliseconds);
}

async function signInAs(email: string): Promise<void> {
  backendHasUser(email, PASSWORD);
  renderApp('/sign-in');
  await submitCredentials(email, PASSWORD, 'Sign in');
  await screen.findByRole('heading', { name: 'Talk to the Agent' });
}

describe('Staying signed in', () => {
  it('keeps a User signed in after a reload, without their password', async () => {
    await signInAs('ada@example.test');

    reloadApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Talk to the Agent' }),
    ).toBeVisible();
    expect(authRequestsReceived()).toEqual(['/api/auth/sign-in']);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByRole('status');
    expect(roomTokenRequestAuthorizations().at(-1)).toBe(
      `Bearer ${String(authTokensIssued().at(-1))}`,
    );
  });

  it('sends the person to sign-in after a reload more than 7 days later', async () => {
    await signInAs('ada@example.test');

    travelForward(8 * ONE_DAY);
    reloadApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
  });

  it("treats the person as signed out when the backend can't be reached on load", async () => {
    backend.use(http.post('/api/auth/refresh', () => HttpResponse.error()));

    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
  });
});
