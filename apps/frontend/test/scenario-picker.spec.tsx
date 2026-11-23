import { SCENARIOS } from '@open-lang/shared';
import { render, screen, within } from '@testing-library/react';
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
    const scenarios = within(
      screen.getByRole('radiogroup', { name: 'Tình huống' }),
    ).getAllByRole('radio');
    expect(scenarios).toHaveLength(SCENARIOS.length);
    for (const [index, scenario] of SCENARIOS.entries()) {
      expect(scenarios[index]).toHaveAccessibleName(scenario.title);
    }
    expect(scenarios[0]).toBeChecked();
    expect(scenarios[1]).not.toBeChecked();
    expect(scenarios[2]).not.toBeChecked();
    for (const scenario of SCENARIOS) {
      expect(screen.getByText(scenario.description)).toBeVisible();
    }
    expect(screen.getByText('Tốc độ Agent nói')).toBeVisible();
    expect(
      within(
        screen.getByRole('radiogroup', { name: 'Tốc độ Agent nói' }),
      ).getAllByRole('radio'),
    ).toHaveLength(3);
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
      screen.getByRole('radio', { name: 'Gọi khách trễ hạn' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith({
      scenarioId: 'client-delay-call',
      speed: 0.7,
    });
    expect(
      screen.getByRole('radio', { name: 'Gọi khách trễ hạn' }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Họp standup' }),
    ).not.toBeChecked();
  });

  it('starts with the Scenario and speed of initialChoice selected', async () => {
    const onStart = vi.fn();
    render(
      <ScenarioPicker
        onStart={onStart}
        initialChoice={{ scenarioId: 'client-delay-call', speed: 0.7 }}
      />,
    );

    expect(
      screen.getByRole('radio', { name: 'Gọi khách trễ hạn' }),
    ).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Chậm' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith({
      scenarioId: 'client-delay-call',
      speed: 0.7,
    });
  });
});
