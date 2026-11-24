import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { reloadApp, signInAs } from './app';
import { backend } from './backend';
import { createUnconnectedRoom } from './unconnected-room';
import { findStatusMessage } from './status-message';

describe('Signing out', () => {
  it('signs the User out: they land on sign-in, and a reload keeps them signed out', async () => {
    await signInAs('ada@example.test');

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Sign out' }),
    ).not.toBeInTheDocument();
    reloadApp('/');
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
  });

  it('ends a running Conversation', async () => {
    const liveKit = createUnconnectedRoom();
    await signInAs('ada@example.test', liveKit.room);
    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    await findStatusMessage();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await screen.findByRole('heading', { name: 'Sign in' });
    await waitFor(() => {
      expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
    });
  });

  it('keeps the User signed in, and says so, when signing out fails', async () => {
    backend.use(
      http.post(
        '/api/auth/sign-out',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    await signInAs('ada@example.test');

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't sign out. Try again.",
    );
    expect(
      screen.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
    ).toBeVisible();
  });
});
