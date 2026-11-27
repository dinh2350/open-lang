import { fireEvent } from '@testing-library/react';

/** How tall the box on screen is; its content is taller or as tall. */
const BOX_HEIGHT = 200;

/**
 * Gives an element a scrollable box, as a browser would lay it out; jsdom has
 * no layout, so its `scrollHeight`, `clientHeight` and `scrollTop` are always
 * 0. The content is `contentHeight` tall and the box `BOX_HEIGHT`. `scrollTop`
 * stays between the top and the bottom, as in a browser, and a box that is
 * hidden has no height at all, so it cannot scroll.
 */
export function layOutScrollBox(box: Element, contentHeight: number) {
  let content = contentHeight;
  let top = 0;
  let isHidden = false;
  const bottom = () => (isHidden ? 0 : Math.max(content - BOX_HEIGHT, 0));
  Object.defineProperties(box, {
    scrollHeight: {
      configurable: true,
      get: () => (isHidden ? 0 : content),
    },
    clientHeight: {
      configurable: true,
      get: () => (isHidden ? 0 : BOX_HEIGHT),
    },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (to: number) => {
        top = Math.min(Math.max(to, 0), bottom());
      },
    },
  });
  return {
    /** The `scrollTop` that shows the end of the content. */
    bottom,
    /** Where the box is scrolled to now. */
    scrollTop: (): number => box.scrollTop,
    /** The content grows, as when a line is added; the view stays where it is. */
    growTo(height: number): void {
      content = height;
    },
    /** The box is hidden, as with `display: none`: it loses its height. */
    hide(): void {
      isHidden = true;
      top = 0;
    },
    /** The box is shown again, with the content it holds. */
    show(): void {
      isHidden = false;
    },
    /** The Member scrolls the box to `to`, and the browser reports it. */
    scrollTo(to: number): void {
      box.scrollTop = to;
      fireEvent.scroll(box);
    },
  };
}
