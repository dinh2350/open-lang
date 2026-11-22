import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { adminRequestAuthorizations } from './admin-backend';
import { ADA, openUsersPageAsAdmin, rowOf } from './admin-page';
import { PASSWORD } from './app';
import { passwordOnBackend } from './auth-backend';
import { backend } from './backend';
import { findStatusMessage } from './status-message';

const NEW_PASSWORD = 'a brand new password for Ada';

/** Opens the new password form in Ada's row, and returns her row. */
async function openAdasPasswordForm(): Promise<HTMLElement> {
  await openUsersPageAsAdmin();
  const adaRow = await rowOf(ADA);
  await userEvent.click(
    within(adaRow).getByRole('button', { name: `Set new password for ${ADA}` }),
  );
  return adaRow;
}

async function submitNewPassword(
  row: HTMLElement,
  password: string,
): Promise<void> {
  await userEvent.type(
    within(row).getByLabelText(`New password for ${ADA}`),
    password,
  );
  await userEvent.click(
    within(row).getByRole('button', { name: 'Save password' }),
  );
}

describe('Admin Users page: setting a new password', () => {
  it('sets a new password for a User, and says they are signed out everywhere', async () => {
    const adaRow = await openAdasPasswordForm();

    await submitNewPassword(adaRow, NEW_PASSWORD);

    expect(await findStatusMessage(adaRow)).toHaveTextContent(
      `New password set. ${ADA} is signed out everywhere.`,
    );
    expect(passwordOnBackend(ADA)).toBe(NEW_PASSWORD);
    expect(
      within(adaRow).queryByLabelText(`New password for ${ADA}`),
    ).not.toBeInTheDocument();
  });

  it('asks for at least 12 characters before sending anything', async () => {
    const adaRow = await openAdasPasswordForm();
    const adminRequestsBefore = adminRequestAuthorizations().length;

    await submitNewPassword(adaRow, 'too short');

    expect(within(adaRow).getByRole('alert')).toHaveTextContent(
      'Use at least 12 characters for the new password.',
    );
    expect(adminRequestAuthorizations()).toHaveLength(adminRequestsBefore);
    expect(passwordOnBackend(ADA)).toBe(PASSWORD);
  });

  it('shows a refusal inline, next to that User', async () => {
    backend.use(
      http.put('/api/admin/users/:id/password', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'No User has this id.' },
          { status: 404 },
        ),
      ),
    );
    const adaRow = await openAdasPasswordForm();

    await submitNewPassword(adaRow, NEW_PASSWORD);

    expect(await within(adaRow).findByRole('alert')).toHaveTextContent(
      'No User has this id.',
    );
    expect(
      within(adaRow).getByLabelText(`New password for ${ADA}`),
    ).toBeVisible();
  });

  it('closes the form without sending anything on Cancel', async () => {
    const adaRow = await openAdasPasswordForm();

    await userEvent.click(
      within(adaRow).getByRole('button', { name: 'Cancel' }),
    );

    expect(
      within(adaRow).queryByLabelText(`New password for ${ADA}`),
    ).not.toBeInTheDocument();
    expect(passwordOnBackend(ADA)).toBe(PASSWORD);
  });
});
