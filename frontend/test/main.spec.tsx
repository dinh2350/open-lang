import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('opens on sign-in, since a page load starts signed out', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import('@/main');

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/sign-in');
  });

  it('refuses to start when index.html has no #root element', async () => {
    document.body.innerHTML = '';

    await expect(import('@/main')).rejects.toThrow(
      'index.html has no #root element',
    );
  });
});
