import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PASSWORD, renderApp, submitCredentials } from './app';
import { backendHasUser } from './auth-backend';

export const GRACE = 'grace@example.test';
export const ADA = 'ada@example.test';

/** Grace is an Admin and Ada a Member, registered in that order. */
export function backendHasAdminAndMember(): void {
  backendHasUser(GRACE, PASSWORD, 'admin');
  backendHasUser(ADA, PASSWORD, 'member');
}

/** Signs in on the sign-in page, and waits for the Conversation page. */
export async function signInAs(email: string): Promise<void> {
  await submitCredentials(email, PASSWORD, 'Sign in');
  await screen.findByRole('heading', { name: 'Talk to the Agent' });
}

/** Grace, an Admin, signs in and opens the Users page, which lists Ada too. */
export async function openUsersPageAsAdmin(): Promise<void> {
  backendHasAdminAndMember();
  renderApp('/sign-in');
  await signInAs(GRACE);
  await userEvent.click(screen.getByRole('link', { name: 'Manage Users' }));
  await screen.findByRole('heading', { name: 'Users' });
}

/** The Users table row of the User with this email. */
export async function rowOf(email: string): Promise<HTMLElement> {
  const cell = await screen.findByRole('rowheader', {
    name: new RegExp(`^${email}`),
  });
  const row = cell.closest('tr');
  if (row === null) {
    throw new Error(`${email} has no table row`);
  }
  return row;
}

/**
 * Picks a Role in a User's Role control: Astryx's Selector is a combobox
 * button that opens a list of options.
 */
export async function chooseRole(
  combobox: HTMLElement,
  role: 'Member' | 'Admin',
): Promise<void> {
  await userEvent.click(combobox);
  await userEvent.click(await screen.findByRole('option', { name: role }));
}
