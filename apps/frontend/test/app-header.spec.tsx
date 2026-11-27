import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp, signInAs } from './app';

/** The logo in the header, which is where the page keeps it. */
function logoInHeader(): HTMLElement {
  return within(screen.getByRole('banner')).getByRole('link', {
    name: 'Open Lang',
  });
}

describe('The header', () => {
  it('the header shows the logo on every page', async () => {
    renderApp('/sign-in');
    expect(logoInHeader()).toBeVisible();
    cleanup();

    await signInAs('ada@example.test');
    expect(logoInHeader()).toBeVisible();

    await userEvent.click(screen.getByRole('link', { name: 'Lịch sử' }));
    await screen.findByRole('heading', { name: 'Lịch sử học' });
    expect(logoInHeader()).toBeVisible();

    await userEvent.click(logoInHeader());
    expect(
      await screen.findByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
    ).toBeVisible();
  });
});
