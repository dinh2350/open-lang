import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BrandLogo } from '@/brand/brand-logo';
import { ThemeModeProvider } from '@/theme/theme-mode-provider';
import { deviceUses } from './device-mode';

function renderLogo(): { unmount: () => void } {
  return render(
    <MemoryRouter>
      <ThemeModeProvider>
        <BrandLogo />
      </ThemeModeProvider>
    </MemoryRouter>,
  );
}

/** The mark: an image with empty alt text has the role `presentation`. */
function markOf(link: HTMLElement): HTMLElement {
  return within(link).getByRole('presentation');
}

describe('BrandLogo', () => {
  it('links to the home page and is named Open Lang', () => {
    renderLogo();

    expect(screen.getByRole('link', { name: 'Open Lang' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows the mark made for a dark page in dark mode, and the one for a light page in light mode', () => {
    deviceUses('dark');
    const { unmount } = renderLogo();
    expect(
      markOf(screen.getByRole('link', { name: 'Open Lang' })).getAttribute(
        'src',
      ),
    ).toContain('ol-mark-on-dark');
    unmount();

    deviceUses('light');
    renderLogo();
    expect(
      markOf(screen.getByRole('link', { name: 'Open Lang' })).getAttribute(
        'src',
      ),
    ).toContain('ol-mark-on-light');
  });

  it('the mark is decorative', () => {
    renderLogo();

    expect(
      markOf(screen.getByRole('link', { name: 'Open Lang' })),
    ).toHaveAttribute('alt', '');
  });
});
