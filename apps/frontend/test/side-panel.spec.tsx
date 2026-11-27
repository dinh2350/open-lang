import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SidePanel } from '@/conversation/side-panel';
import { useSidePanel } from '@/conversation/use-side-panel';

const TRANSCRIPT = 'Gia sư hỏi bạn đã ăn sáng chưa.';
const NOTES = 'Từ mới: breakfast.';
const ASIDE_NAME = 'Cuộc nói và ghi chú';

describe('useSidePanel', () => {
  it('opens the panel the Member clicked', () => {
    const { result } = renderHook(() => useSidePanel());
    expect(result.current.panel).toBeNull();

    act(() => {
      result.current.toggle('notes');
    });

    expect(result.current.panel).toBe('notes');
  });

  it('closes when the open panel is clicked again', () => {
    const { result } = renderHook(() => useSidePanel());
    act(() => {
      result.current.toggle('transcript');
    });
    expect(result.current.panel).toBe('transcript');

    act(() => {
      result.current.toggle('transcript');
    });

    expect(result.current.panel).toBeNull();
  });

  it('switches when the other panel is clicked', () => {
    const { result } = renderHook(() => useSidePanel());
    act(() => {
      result.current.toggle('transcript');
    });

    act(() => {
      result.current.toggle('notes');
    });

    expect(result.current.panel).toBe('notes');
  });

  it('close closes', () => {
    const { result } = renderHook(() => useSidePanel());
    act(() => {
      result.current.toggle('notes');
    });

    act(() => {
      result.current.close();
    });

    expect(result.current.panel).toBeNull();
  });
});

/**
 * A SidePanel next to a button of the page, to see what the panel leaves
 * alone. The two callbacks are spies.
 */
function renderSidePanel(
  props: Partial<ComponentProps<typeof SidePanel>> = {},
) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(
    <>
      <button type="button">Kết thúc</button>
      <SidePanel
        panel="transcript"
        onSelect={onSelect}
        onClose={onClose}
        noteCount={0}
        transcript={TRANSCRIPT}
        notes={NOTES}
        {...props}
      />
    </>,
  );
  return { onSelect, onClose };
}

describe('SidePanel', () => {
  it('is hidden while closed but keeps both panels in the document', () => {
    renderSidePanel({ panel: null });

    expect(
      screen.queryByRole('complementary', { name: ASIDE_NAME }),
    ).not.toBeInTheDocument();
    // A hidden element has no accessible name, so the name is read as is.
    const aside = screen.getByRole('complementary', { hidden: true });
    expect(aside).toHaveAttribute('aria-label', ASIDE_NAME);
    expect(aside).not.toBeVisible();
    expect(screen.getByText(TRANSCRIPT)).toBeInTheDocument();
    expect(screen.getByText(TRANSCRIPT)).not.toBeVisible();
    expect(screen.getByText(NOTES)).toBeInTheDocument();
    expect(screen.getByText(NOTES)).not.toBeVisible();
  });

  it('shows the selected tab and its panel only', () => {
    renderSidePanel({ panel: 'notes' });

    expect(
      screen.getByRole('complementary', { name: ASIDE_NAME }),
    ).toBeVisible();
    const notesTab = screen.getByRole('tab', { name: 'Ghi chú' });
    expect(notesTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Cuộc nói' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    const notesPanel = screen.getByRole('tabpanel', { name: 'Ghi chú' });
    expect(notesTab).toHaveAttribute('aria-controls', notesPanel.id);
    expect(notesPanel).toBeVisible();
    expect(screen.getByText(NOTES)).toBeVisible();
    expect(
      screen.queryByRole('tabpanel', { name: 'Cuộc nói' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(TRANSCRIPT)).not.toBeVisible();
  });

  it('shows the transcript when Cuộc nói is the selected tab', () => {
    renderSidePanel({ panel: 'transcript' });

    const transcriptTab = screen.getByRole('tab', { name: 'Cuộc nói' });
    expect(transcriptTab).toHaveAttribute('aria-selected', 'true');
    const transcriptPanel = screen.getByRole('tabpanel', { name: 'Cuộc nói' });
    expect(transcriptTab).toHaveAttribute('aria-controls', transcriptPanel.id);
    expect(screen.getByText(TRANSCRIPT)).toBeVisible();
    expect(screen.getByText(NOTES)).not.toBeVisible();
  });

  it('shows the note count on the Ghi chú tab', () => {
    renderSidePanel({ noteCount: 3 });

    const notesTab = screen.getByRole('tab', { name: /^Ghi chú/ });
    expect(notesTab).toHaveTextContent('3');
  });

  it('shows no count on the Ghi chú tab while there are no notes', () => {
    renderSidePanel({ noteCount: 0 });

    expect(screen.getByRole('tab', { name: 'Ghi chú' })).not.toHaveTextContent(
      '0',
    );
  });

  it('selecting the other tab calls onSelect', async () => {
    const { onSelect } = renderSidePanel({ panel: 'transcript' });

    await userEvent.click(screen.getByRole('tab', { name: 'Ghi chú' }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('notes');
  });

  it('selecting Cuộc nói from Ghi chú calls onSelect', async () => {
    const { onSelect } = renderSidePanel({ panel: 'notes' });

    await userEvent.click(screen.getByRole('tab', { name: 'Cuộc nói' }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('transcript');
  });

  it('Đóng calls onClose', async () => {
    const { onClose } = renderSidePanel();

    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape inside the panel calls onClose', async () => {
    const { onClose } = renderSidePanel();
    await userEvent.click(screen.getByRole('tab', { name: 'Cuộc nói' }));

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape outside the panel leaves it open', async () => {
    const { onClose } = renderSidePanel();
    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });
});

/** A line the Member can add to: it keeps its count only while mounted. */
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setCount((previous) => previous + 1);
      }}
    >
      {`Đếm ${String(count)}`}
    </button>
  );
}

/** What the page does: the hook drives the panel, a button opens the notes. */
function PanelWithHook() {
  const { panel, toggle, close } = useSidePanel();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          toggle('notes');
        }}
      >
        Mở ghi chú
      </button>
      <SidePanel
        panel={panel}
        onSelect={toggle}
        onClose={close}
        noteCount={2}
        transcript={<Counter />}
        notes={NOTES}
      />
    </>
  );
}

describe('SidePanel with useSidePanel', () => {
  it('opens, switches and closes without losing what the transcript holds', async () => {
    render(<PanelWithHook />);
    expect(
      screen.queryByRole('complementary', { name: ASIDE_NAME }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mở ghi chú' }));
    expect(screen.getByText(NOTES)).toBeVisible();

    await userEvent.click(screen.getByRole('tab', { name: 'Cuộc nói' }));
    await userEvent.click(screen.getByRole('button', { name: 'Đếm 0' }));
    expect(screen.getByRole('button', { name: 'Đếm 1' })).toBeVisible();
    expect(screen.getByText(NOTES)).not.toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(
      screen.queryByRole('complementary', { name: ASIDE_NAME }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mở ghi chú' }));
    await userEvent.click(screen.getByRole('tab', { name: /^Cuộc nói/ }));
    expect(screen.getByRole('button', { name: 'Đếm 1' })).toBeVisible();
  });
});
