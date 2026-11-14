import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { adminRequestAuthorizations } from './admin-backend';
import {
  ADA,
  backendHasAdminAndMember,
  GRACE,
  openUsersPageAsAdmin,
  rowOf,
  signInAs,
} from './admin-page';
import { PASSWORD, renderApp } from './app';
import {
  authTokensIssued,
  backendHasUser,
  backendUsers,
  browserIsSignedInAs,
} from './auth-backend';
import { backend } from './backend';

function roleOnBackend(email: string) {
  return backendUsers().find((user) => user.email === email)?.role;
}

describe('Admin Users page', () => {
  it('shows an Admin the link to the Users page', async () => {
    backendHasAdminAndMember();
    renderApp('/sign-in');

    await signInAs(GRACE);

    expect(screen.getByRole('link', { name: 'Manage Users' })).toBeVisible();
  });

  it('hides the link from a Member', async () => {
    backendHasAdminAndMember();
    renderApp('/sign-in');

    await signInAs(ADA);

    expect(
      screen.queryByRole('link', { name: 'Manage Users' }),
    ).not.toBeInTheDocument();
  });

  it('sends a Member who opens the Users page to the Conversation page', async () => {
    browserIsSignedInAs(ADA, PASSWORD);

    renderApp('/admin/users');

    expect(
      await screen.findByRole('heading', { name: 'Talk to the Agent' }),
    ).toBeVisible();
    expect(adminRequestAuthorizations()).toEqual([]);
  });

  it("lists every User's email, Role and creation date, oldest first", async () => {
    await openUsersPageAsAdmin();

    const rows = within(await screen.findByRole('table')).getAllByRole('row');

    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/Email.*Role.*Created/),
      expect.stringMatching(new RegExp(`^${GRACE}.*Nov 1, 2026$`)),
      expect.stringMatching(new RegExp(`^${ADA}.*Nov 2, 2026$`)),
    ]);
    expect(
      within(await rowOf(GRACE)).getByRole('combobox', {
        name: `Role of ${GRACE}`,
      }),
    ).toHaveDisplayValue('Admin');
    expect(
      within(await rowOf(ADA)).getByRole('combobox', {
        name: `Role of ${ADA}`,
      }),
    ).toHaveDisplayValue('Member');
  });

  it("sends the Admin's Auth Token with every Admin API request", async () => {
    await openUsersPageAsAdmin();
    await screen.findByRole('table');

    expect(adminRequestAuthorizations()).not.toHaveLength(0);
    expect(new Set(adminRequestAuthorizations())).toEqual(
      new Set([`Bearer ${authTokensIssued()[0]}`]),
    );
  });

  it("changes another User's Role", async () => {
    await openUsersPageAsAdmin();
    const roleOfAda = within(await rowOf(ADA)).getByRole('combobox', {
      name: `Role of ${ADA}`,
    });

    await userEvent.selectOptions(roleOfAda, 'Admin');

    await vi.waitFor(() => {
      expect(roleOnBackend(ADA)).toBe('admin');
    });
    expect(roleOfAda).toHaveDisplayValue('Admin');
    expect(within(await rowOf(ADA)).queryByRole('alert')).toBeNull();
  });

  it("doesn't let an Admin change their own Role", async () => {
    await openUsersPageAsAdmin();

    const ownRole = within(await rowOf(GRACE)).getByRole('combobox', {
      name: `Role of ${GRACE}`,
    });

    expect(ownRole).toBeDisabled();
    expect(ownRole).toHaveAccessibleDescription(
      "You can't change your own Role.",
    );
  });

  it("shows a 409 inline, next to that User, and keeps the User's Role", async () => {
    backend.use(
      http.put('/api/admin/users/:id/role', () =>
        HttpResponse.json(
          { statusCode: 409, message: "You can't demote the last Admin." },
          { status: 409 },
        ),
      ),
    );
    backendHasUser(GRACE, PASSWORD, 'admin');
    backendHasUser(ADA, PASSWORD, 'admin');
    renderApp('/sign-in');
    await signInAs(GRACE);
    await userEvent.click(screen.getByRole('link', { name: 'Manage Users' }));
    const adaRow = await rowOf(ADA);

    await userEvent.selectOptions(
      within(adaRow).getByRole('combobox', { name: `Role of ${ADA}` }),
      'Member',
    );

    expect(await within(adaRow).findByRole('alert')).toHaveTextContent(
      "You can't demote the last Admin.",
    );
    expect(
      within(adaRow).getByRole('combobox', { name: `Role of ${ADA}` }),
    ).toHaveDisplayValue('Admin');
    expect(within(await rowOf(GRACE)).queryByRole('alert')).toBeNull();
  });

  it('shows a general error inline when changing a Role fails', async () => {
    backend.use(
      http.put(
        '/api/admin/users/:id/role',
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await openUsersPageAsAdmin();
    const adaRow = await rowOf(ADA);

    await userEvent.selectOptions(
      within(adaRow).getByRole('combobox', { name: `Role of ${ADA}` }),
      'Admin',
    );

    expect(await within(adaRow).findByRole('alert')).toHaveTextContent(
      'Something went wrong. Try again.',
    );
  });

  it("shows the backend's message when the Users can't be listed", async () => {
    backend.use(
      http.get('/api/admin/users', () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Only Admins can do this.' },
          { status: 403 },
        ),
      ),
    );
    backendHasAdminAndMember();
    renderApp('/sign-in');
    await signInAs(GRACE);

    await userEvent.click(screen.getByRole('link', { name: 'Manage Users' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only Admins can do this.',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
