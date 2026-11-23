import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { PASSWORD, renderApp, submitCredentials } from './app';
import {
  authRequestsReceived,
  authTokensIssued,
  backendHasUser,
  registeredEmails,
} from './auth-backend';
import { backend, roomTokenRequestAuthorizations } from './backend';
import { findStatusMessage } from './status-message';

describe('Registering', () => {
  it('registers a new person, who is signed in and lands on the Conversation page', async () => {
    renderApp('/');
    await userEvent.click(
      await screen.findByRole('link', { name: 'Register' }),
    );

    await submitCredentials('ada@example.test', PASSWORD, 'Register');

    expect(
      await screen.findByRole('heading', { name: 'Luyện nói hôm nay' }),
    ).toBeVisible();
    expect(registeredEmails()).toEqual(['ada@example.test']);

    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    await findStatusMessage();
    expect(roomTokenRequestAuthorizations().at(-1)).toBe(
      `Bearer ${authTokensIssued()[0]}`,
    );
  });

  it('asks for a password of at least 12 characters before sending anything', async () => {
    renderApp('/register');

    await submitCredentials('ada@example.test', 'abcdefghijk', 'Register');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Use at least 12 characters for your password.',
    );
    expect(authRequestsReceived()).toEqual([]);
  });

  it('asks for a valid email before sending anything', async () => {
    renderApp('/register');

    await submitCredentials('ada.example.test', PASSWORD, 'Register');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address.',
    );
    expect(authRequestsReceived()).toEqual([]);
  });

  it('says when the email already has an account', async () => {
    backendHasUser('ada@example.test', PASSWORD);
    renderApp('/register');

    await submitCredentials('ada@example.test', PASSWORD, 'Register');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists.',
    );
    expect(screen.getByRole('heading', { name: 'Register' })).toBeVisible();
  });

  it('disables the Register button while the request is pending, so a second click sends nothing', async () => {
    let registerRequests = 0;
    let answer = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });
    backend.use(
      http.post('/api/auth/register', async () => {
        registerRequests += 1;
        await held;
        return HttpResponse.json(
          {
            statusCode: 409,
            message: 'An account with this email already exists.',
          },
          { status: 409 },
        );
      }),
    );
    renderApp('/register');
    await submitCredentials('ada@example.test', PASSWORD, 'Register');
    const button = screen.getByRole('button', { name: 'Register' });

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
    await userEvent.click(button);
    expect(registerRequests).toBe(1);

    answer();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists.',
    );
    expect(registerRequests).toBe(1);
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('links back to sign-in', async () => {
    renderApp('/register');

    await userEvent.click(screen.getByRole('link', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
  });
});
