import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useStickToBottom } from '@/conversation/use-stick-to-bottom';
import { layOutScrollBox } from './scroll-box';

/** A box that sticks to its bottom, and says whether it is at the bottom. */
function StickyBox({
  changeKey,
  isShown = true,
}: {
  readonly changeKey: unknown;
  readonly isShown?: boolean;
}) {
  const { ref, isAtBottom, scrollToBottom } = useStickToBottom(
    changeKey,
    isShown,
  );
  return (
    <>
      <div ref={ref} data-testid="box" />
      <p>{isAtBottom ? 'At the bottom' : 'Above the bottom'}</p>
      <button type="button" onClick={scrollToBottom}>
        Down
      </button>
    </>
  );
}

/**
 * A StickyBox with 1000px of content in a 200px box, scrolled to the top: its
 * bottom is at a `scrollTop` of 800, and 1100 once the content is 1300px.
 */
function renderStickyBox() {
  const { rerender } = render(<StickyBox changeKey="first" />);
  const box = screen.getByTestId('box');
  const layout = layOutScrollBox(box, 1000);
  return {
    box,
    layout,
    /** The lines change, in a box that is shown unless said otherwise. */
    changeKey: (changeKey: unknown, isShown = true) => {
      rerender(<StickyBox changeKey={changeKey} isShown={isShown} />);
    },
  };
}

describe('useStickToBottom', () => {
  it('scrolls to the bottom when the change key changes', () => {
    const { box, changeKey } = renderStickyBox();
    expect(box.scrollTop).toBe(0);

    changeKey('second');

    expect(box.scrollTop).toBe(800);
  });

  it('follows the content as it grows line by line', () => {
    const { box, layout, changeKey } = renderStickyBox();
    changeKey('second');

    layout.growTo(1300);
    changeKey('third');

    expect(box.scrollTop).toBe(1100);
  });

  it('stops following once the Member scrolls up', () => {
    const { layout, changeKey } = renderStickyBox();
    changeKey('second');
    expect(screen.getByText('At the bottom')).toBeVisible();

    layout.scrollTo(100);

    expect(screen.getByText('Above the bottom')).toBeVisible();
  });

  it('does not move the view when the change key changes while the Member has scrolled up', () => {
    const { box, layout, changeKey } = renderStickyBox();
    changeKey('second');
    layout.scrollTo(100);

    layout.growTo(1300);
    changeKey('third');

    expect(box.scrollTop).toBe(100);
    expect(screen.getByText('Above the bottom')).toBeVisible();
  });

  it('is at the bottom within 24px of it and not at the bottom beyond 24px', () => {
    const { layout } = renderStickyBox();
    const bottom = layout.bottom();

    layout.scrollTo(bottom - 24);
    expect(screen.getByText('At the bottom')).toBeVisible();

    layout.scrollTo(bottom - 25);
    expect(screen.getByText('Above the bottom')).toBeVisible();
  });

  it('follows again when the Member scrolls back down to the bottom', () => {
    const { box, layout, changeKey } = renderStickyBox();
    layout.scrollTo(100);
    expect(screen.getByText('Above the bottom')).toBeVisible();

    layout.scrollTo(layout.bottom());
    expect(screen.getByText('At the bottom')).toBeVisible();
    layout.growTo(1300);
    changeKey('second');

    expect(box.scrollTop).toBe(1100);
  });

  it('scrollToBottom goes to the bottom and follows again', async () => {
    const { box, layout, changeKey } = renderStickyBox();
    layout.scrollTo(100);
    expect(screen.getByText('Above the bottom')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Down' }));

    expect(box.scrollTop).toBe(800);
    expect(screen.getByText('At the bottom')).toBeVisible();
    layout.growTo(1300);
    changeKey('second');
    expect(box.scrollTop).toBe(1100);
  });

  it('scrolls to the bottom when it is shown after lines arrived while it was hidden', () => {
    const { box, layout, changeKey } = renderStickyBox();
    layout.hide();
    changeKey('second', false);
    layout.growTo(1300);
    changeKey('third', false);
    expect(box.scrollTop).toBe(0);

    layout.show();
    changeKey('third', true);

    expect(box.scrollTop).toBe(1100);
  });
});
