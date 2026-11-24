import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PASSWORD, reloadApp, renderApp, submitCredentials } from './app';
import { backendHasUser } from './auth-backend';
import { deviceUses } from './device-mode';

describe('The mode toggle', () => {
  it('the sign-in page has a Dark mode switch, off when the device prefers light', async () => {
    deviceUses('light');
    renderApp('/sign-in');
    expect(
      await screen.findByRole('switch', { name: 'Dark mode' }),
    ).not.toBeChecked();
  });

  it('turning Dark mode on sets the page to dark', async () => {
    renderApp('/sign-in');
    await userEvent.click(
      await screen.findByRole('switch', { name: 'Dark mode' }),
    );
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('the choice survives a reload', async () => {
    renderApp('/sign-in');
    await userEvent.click(
      await screen.findByRole('switch', { name: 'Dark mode' }),
    );
    reloadApp('/sign-in');
    expect(
      await screen.findByRole('switch', { name: 'Dark mode' }),
    ).toBeChecked();
  });

  it('the first visit follows a dark device', async () => {
    deviceUses('dark');
    renderApp('/sign-in');
    expect(
      await screen.findByRole('switch', { name: 'Dark mode' }),
    ).toBeChecked();
  });

  it('the switch is reached and toggled with the keyboard', async () => {
    const user = userEvent.setup();
    renderApp('/sign-in');
    await screen.findByRole('switch', { name: 'Dark mode' });
    await user.tab();
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
  });

  it('the choice stays when a User signs in', async () => {
    renderApp('/sign-in');
    await userEvent.click(
      await screen.findByRole('switch', { name: 'Dark mode' }),
    );
    backendHasUser('ada@example.test', PASSWORD);
    await submitCredentials('ada@example.test', PASSWORD, 'Sign in');
    await screen.findByRole('heading', { name: 'Gia sư tiếng Anh của bạn' });
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
  });

  it('a validation error on the register page is still one alert beside the toggle', async () => {
    renderApp('/register');
    await submitCredentials('', '', 'Register');
    expect(await screen.findByRole('alert')).toBeVisible(); // findByRole throws when two match
  });
});
