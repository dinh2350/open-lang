import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StartPanel } from '@/conversation/start-panel';

describe('StartPanel', () => {
  it('StartPanel shows Bắt đầu and no pickers', () => {
    render(<StartPanel onStart={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Bấm Bắt đầu, rồi nói điều bạn cần: một từ, một câu, hay cả đoạn.',
      ),
    ).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText(/Tình huống/i)).toBeNull();
    expect(screen.queryByText(/tốc độ/i)).toBeNull();
  });

  it('StartPanel calls onStart once per press', async () => {
    const onStart = vi.fn();
    render(<StartPanel onStart={onStart} />);

    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    expect(onStart).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});
