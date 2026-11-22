import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  ADA,
  GRACE,
  openUsersPageAsAdmin,
  rowOf,
  signInAs,
} from './admin-page';
import { PASSWORD, renderApp } from './app';
import {
  backendHasUser,
  changeLockedOnBackend,
  isLockedOnBackend,
} from './auth-backend';
import { backend } from './backend';

describe('Admin Users page: locking Users', () => {
  it('shows whether each User is locked', async () => {
    backendHasUser(GRACE, PASSWORD, 'admin');
    const ada = backendHasUser(ADA, PASSWORD);
    changeLockedOnBackend(ada.id, true);
    renderApp('/sign-in');
    await signInAs(GRACE);

    await userEvent.click(screen.getByRole('link', { name: 'Manage Users' }));

    expect(
      within(await rowOf(GRACE)).getByRole('cell', { name: /^Active/ }),
    ).toBeVisible();
    expect(
      within(await rowOf(ADA)).getByRole('cell', { name: /^Locked/ }),
    ).toBeVisible();
  });

  it('locks another User', async () => {
    await openUsersPageAsAdmin();
    const adaRow = await rowOf(ADA);

    await userEvent.click(
      within(adaRow).getByRole('button', { name: `Lock ${ADA}` }),
    );

    await vi.waitFor(() => {
      expect(isLockedOnBackend(ADA)).toBe(true);
    });
    expect(
      await within(adaRow).findByRole('button', { name: `Unlock ${ADA}` }),
    ).toBeVisible();
    expect(within(adaRow).getByRole('cell', { name: /^Locked/ })).toBeVisible();
  });

  it('unlocks a Locked User', async () => {
    await openUsersPageAsAdmin();
    const adaRow = await rowOf(ADA);
    await userEvent.click(
      within(adaRow).getByRole('button', { name: `Lock ${ADA}` }),
    );

    await userEvent.click(
      await within(adaRow).findByRole('button', { name: `Unlock ${ADA}` }),
    );

    await vi.waitFor(() => {
      expect(isLockedOnBackend(ADA)).toBe(false);
    });
    expect(
      await within(adaRow).findByRole('button', { name: `Lock ${ADA}` }),
    ).toBeVisible();
  });

  it("doesn't let an Admin lock themselves", async () => {
    await openUsersPageAsAdmin();

    const lockSelf = within(await rowOf(GRACE)).getByRole('button', {
      name: `Lock ${GRACE}`,
    });

    // Astryx keeps a disabled Button focusable, so it is aria-disabled.
    expect(lockSelf).toHaveAttribute('aria-disabled', 'true');
    expect(lockSelf).toHaveAccessibleDescription("You can't lock yourself.");
    await userEvent.click(lockSelf);
    expect(isLockedOnBackend(GRACE)).toBe(false);
  });

  it('shows a 409 inline, next to that User, and keeps them unlocked', async () => {
    backend.use(
      http.put('/api/admin/users/:id/locked', () =>
        HttpResponse.json(
          {
            statusCode: 409,
            message: "You can't lock the last unlocked Admin.",
          },
          { status: 409 },
        ),
      ),
    );
    await openUsersPageAsAdmin();
    const adaRow = await rowOf(ADA);
    const lockAda = within(adaRow).getByRole('button', { name: `Lock ${ADA}` });

    await userEvent.click(lockAda);

    expect(await within(adaRow).findByRole('alert')).toHaveTextContent(
      "You can't lock the last unlocked Admin.",
    );
    expect(lockAda).toHaveAccessibleDescription(
      "You can't lock the last unlocked Admin.",
    );
    expect(within(adaRow).getByRole('cell', { name: /^Active/ })).toBeVisible();
    expect(within(await rowOf(GRACE)).queryByRole('alert')).toBeNull();
  });
});
