import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PASSWORD, renderApp, submitCredentials } from './app';
import {
  ACCOUNT_LOCKED_MESSAGE,
  backendHasUser,
  changeLockedOnBackend,
} from './auth-backend';

describe('A Locked User', () => {
  it('sees the account locked message when they sign in with the right password', async () => {
    const ada = backendHasUser('ada@example.test', PASSWORD);
    changeLockedOnBackend(ada.id, true);
    renderApp('/sign-in');

    await submitCredentials('ada@example.test', PASSWORD, 'Sign in');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      ACCOUNT_LOCKED_MESSAGE,
    );
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  it('lands on sign-in with the account locked message when a request finds them locked', async () => {
    const grace = backendHasUser('grace@example.test', PASSWORD, 'admin');
    backendHasUser('ada@example.test', PASSWORD);
    renderApp('/sign-in');
    await submitCredentials('grace@example.test', PASSWORD, 'Sign in');
    await userEvent.click(
      await screen.findByRole('link', { name: 'Manage Users' }),
    );
    const roleOfAda = await screen.findByRole('combobox', {
      name: 'Role of ada@example.test',
    });

    // Another Admin locks Grace while her Users page is open.
    changeLockedOnBackend(grace.id, true);
    await userEvent.selectOptions(roleOfAda, 'Admin');

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(ACCOUNT_LOCKED_MESSAGE);
  });
});
