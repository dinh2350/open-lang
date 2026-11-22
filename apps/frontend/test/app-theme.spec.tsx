import { Button, TextInput } from '@astryxdesign/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppTheme } from '@/theme/app-theme';

describe('AppTheme', () => {
  it('renders Astryx components that Testing Library can query', () => {
    render(
      <AppTheme mode="light">
        <Button label="Save" />
        <TextInput label="Email" value="" />
      </AppTheme>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
    expect(screen.getByLabelText('Email')).toBeVisible();
  });

  it.each(['light', 'dark'] as const)('puts %s on the page root', (mode) => {
    render(
      <AppTheme mode={mode}>
        <Button label="Save" />
      </AppTheme>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', mode);
  });
});
