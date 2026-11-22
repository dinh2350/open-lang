import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from 'livekit-client';
import { MemoryRouter } from 'react-router';
import { App } from '@/app';
import { loadFrontendConfig } from '@/config';
import { backendHasUser } from './auth-backend';
import { createUnconnectedRoom } from './unconnected-room';

export const PASSWORD = 'correct horse battery staple';

/**
 * Renders the whole app as if the browser opened `path`. Like a page load,
 * it starts with nothing in memory, so only a refresh cookie can sign the
 * User in. The app's settings are its defaults, as with an empty
 * `apps/frontend/.env`, unless the test sets them.
 */
export function renderApp(
  path: string,
  room: Room = createUnconnectedRoom().room,
  { agentJoinTimeoutMilliseconds } = loadFrontendConfig({}),
): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App
        room={room}
        agentJoinTimeoutMilliseconds={agentJoinTimeoutMilliseconds}
      />
    </MemoryRouter>,
  );
}

/** Reloads the page at `path`: the app loses everything it kept in memory. */
export function reloadApp(path: string): void {
  cleanup();
  renderApp(path);
}

/** Types an email and password into the sign-in or register form and submits it. */
export async function submitCredentials(
  email: string,
  password: string,
  submitButton: 'Sign in' | 'Register',
): Promise<void> {
  const user = userEvent.setup();
  if (email !== '') {
    await user.type(await screen.findByLabelText('Email'), email);
  }
  if (password !== '') {
    await user.type(screen.getByLabelText('Password'), password);
  }
  await user.click(screen.getByRole('button', { name: submitButton }));
}

/** A User signs in through the sign-in page and lands on the Conversation page. */
export async function signInAs(
  email: string,
  room: Room = createUnconnectedRoom().room,
): Promise<void> {
  backendHasUser(email, PASSWORD);
  renderApp('/sign-in', room);
  await submitCredentials(email, PASSWORD, 'Sign in');
  await screen.findByRole('heading', { name: 'Talk to the Agent' });
}
