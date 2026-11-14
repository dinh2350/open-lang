import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from 'livekit-client';
import { MemoryRouter } from 'react-router';
import { App } from '@/app';
import { createUnconnectedRoom } from './unconnected-room';

export const PASSWORD = 'correct horse battery staple';

/** Renders the whole app, signed out, as if the browser opened `path`. */
export function renderApp(
  path: string,
  room: Room = createUnconnectedRoom().room,
): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App room={room} />
    </MemoryRouter>,
  );
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
