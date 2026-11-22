import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { PASSWORD, renderApp, submitCredentials } from './app';
import {
  authRequestsReceived,
  authTokensIssued,
  backendHasUser,
} from './auth-backend';
import { backend, roomTokenRequestAuthorizations } from './backend';
import { createUnconnectedRoom } from './unconnected-room';

describe('Signing in', () => {
  it('sends a signed-out person who opens the Conversation page to sign-in', async () => {
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Start' }),
    ).not.toBeInTheDocument();
  });

  it('signs in a User, who lands on the Conversation page', async () => {
    backendHasUser('ada@example.test', PASSWORD);
    renderApp('/');

    await submitCredentials('ada@example.test', PASSWORD, 'Sign in');

    expect(
      await screen.findByRole('heading', { name: 'Talk to the Agent' }),
    ).toBeVisible();
  });

  it('sends the Auth Token with every Room Token request', async () => {
    backendHasUser('ada@example.test', PASSWORD);
    const liveKit = createUnconnectedRoom();
    renderApp('/sign-in', liveKit.room);
    await submitCredentials('ada@example.test', PASSWORD, 'Sign in');

    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await screen.findByRole('status');

    expect(roomTokenRequestAuthorizations()).not.toHaveLength(0);
    expect(new Set(roomTokenRequestAuthorizations())).toEqual(
      new Set([`Bearer ${authTokensIssued()[0]}`]),
    );
  });

  it('shows one generic error for a wrong password and stays on sign-in', async () => {
    backendHasUser('ada@example.test', PASSWORD);
    renderApp('/sign-in');

    await submitCredentials(
      'ada@example.test',
      'not the right password',
      'Sign in',
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Wrong email or password.',
    );
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  it('asks for the password before sending anything', async () => {
    renderApp('/sign-in');

    await submitCredentials('ada@example.test', '', 'Sign in');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter your password.',
    );
    expect(authRequestsReceived()).toEqual([]);
  });

  it("shows the backend's message after too many attempts", async () => {
    backend.use(
      http.post('/api/auth/sign-in', () =>
        HttpResponse.json(
          {
            statusCode: 429,
            message: 'Too many attempts. Wait a minute, then try again.',
          },
          { status: 429 },
        ),
      ),
    );
    renderApp('/sign-in');

    await submitCredentials('ada@example.test', PASSWORD, 'Sign in');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Wait a minute, then try again.',
    );
  });

  it.each([
    ["can't be reached", () => HttpResponse.error()],
    ['fails', () => new HttpResponse(null, { status: 500 })],
  ])('shows a general error when the backend %s', async (_case, answer) => {
    backend.use(http.post('/api/auth/sign-in', answer));
    renderApp('/sign-in');

    await submitCredentials('ada@example.test', PASSWORD, 'Sign in');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Try again.',
    );
  });
});
