import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { PASSWORD } from './app';
import { browserIsSignedInAs, refreshesRequested } from './auth-backend';
import { backend, TEST_LIVEKIT_URL } from './backend';

describe('The app', () => {
  beforeEach(() => {
    vi.resetModules();
    // On load the page prepares its connection: livekit-client checks that
    // the LiveKit server answers over HTTP.
    backend.use(
      http.head(TEST_LIVEKIT_URL.replace(/^ws/, 'http'), () =>
        HttpResponse.text(''),
      ),
    );
  });

  it('opens on sign-in when the browser holds no refresh cookie', async () => {
    window.history.replaceState(null, '', '/');
    document.body.innerHTML = '<div id="root"></div>';

    await import('@/main');

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/sign-in');
  });

  it('opens on the Conversation page when the browser holds a valid refresh cookie, and refreshes only once', async () => {
    browserIsSignedInAs('ada@example.test', PASSWORD);
    window.history.replaceState(null, '', '/');
    document.body.innerHTML = '<div id="root"></div>';

    await import('@/main');

    expect(
      await screen.findByRole('heading', { name: 'Talk to the Agent' }),
    ).toBeVisible();
    // StrictMode runs effects twice; a second refresh would send a cookie
    // the first one already rotated, which signs the User out everywhere.
    expect(refreshesRequested()).toBe(1);
  });

  it('refuses to start, naming the variable, when VITE_AGENT_JOIN_TIMEOUT_MS is not a number of milliseconds', async () => {
    vi.stubEnv('VITE_AGENT_JOIN_TIMEOUT_MS', 'soon');
    onTestFinished(() => {
      vi.unstubAllEnvs();
    });
    document.body.innerHTML = '<div id="root"></div>';

    await expect(import('@/main')).rejects.toThrow(
      /Invalid frontend settings:[\s\S]*VITE_AGENT_JOIN_TIMEOUT_MS/,
    );
  });

  it('refuses to start when index.html has no #root element', async () => {
    document.body.innerHTML = '';

    await expect(import('@/main')).rejects.toThrow(
      'index.html has no #root element',
    );
  });
});
