import { SCENARIOS } from '@open-lang/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScenarioPicker } from '@/conversation/scenario-picker';

describe('Scenario picker', () => {
  it('shows three Scenario cards and three speeds with the first Scenario and "Vừa" selected', () => {
    render(<ScenarioPicker onStart={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Luyện nói hôm nay' }),
    ).toBeVisible();
    expect(screen.getByText('Chọn một tình huống công sở.')).toBeVisible();
    const cards = screen.getAllByRole('checkbox');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(
      SCENARIOS.map((scenario) => scenario.title),
    );
    expect(cards[0]).toBeChecked();
    expect(cards[1]).not.toBeChecked();
    expect(cards[2]).not.toBeChecked();
    for (const scenario of SCENARIOS) {
      expect(screen.getByText(scenario.description)).toBeVisible();
    }
    expect(screen.getByText('Tốc độ Agent nói')).toBeVisible();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Chậm' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Vừa' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Bình thường' }),
    ).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
  });

  it('Bắt đầu passes the first Scenario and "Vừa" when the Member changes nothing', async () => {
    const onStart = vi.fn();
    render(<ScenarioPicker onStart={onStart} />);

    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith({
      scenarioId: 'daily-standup',
      speed: 0.85,
    });
  });

  it('Bắt đầu passes the chosen Scenario and speed', async () => {
    const onStart = vi.fn();
    render(<ScenarioPicker onStart={onStart} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Chậm' }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Gọi khách trễ hạn' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith({
      scenarioId: 'client-delay-call',
      speed: 0.7,
    });
    expect(
      screen.getByRole('checkbox', { name: 'Gọi khách trễ hạn' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Họp standup' }),
    ).not.toBeChecked();
  });

  it('keeps the Scenario selected when the Member presses its card again', async () => {
    render(<ScenarioPicker onStart={vi.fn()} />);

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Họp standup' }),
    );

    expect(screen.getByRole('checkbox', { name: 'Họp standup' })).toBeChecked();
  });
});
