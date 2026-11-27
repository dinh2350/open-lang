import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

/** How far above its bottom a box can be scrolled and still be at the bottom. */
const AT_BOTTOM_PIXELS = 24;

/**
 * Keeps a scrolling box on its newest content, like a chat. Attach `ref` to
 * the box. It follows the bottom until a scroll leaves it more than 24px
 * above the bottom: the Member scrolled up to read, and the view stays where
 * they put it, however much arrives. Scrolling back to the bottom, or
 * `scrollToBottom`, follows again.
 *
 * `changeKey` is what changes when there is new content: the box goes to the
 * bottom whenever it changes, while following. A box that is not `isShown`,
 * for instance hidden by a layout, cannot scroll; it goes to the bottom when
 * it is shown, if it is following. `isAtBottom` says whether the box is
 * following, for a button that scrolls back down.
 */
export function useStickToBottom(
  changeKey: unknown,
  isShown: boolean,
): {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly isAtBottom: boolean;
  readonly scrollToBottom: () => void;
} {
  const ref = useRef<HTMLDivElement>(null);
  // Read when the content changes, which can be before a render shows a scroll
  // that just happened, so it is a ref that the scroll updates at once.
  const isFollowing = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    const box = ref.current;
    if (box === null) {
      return;
    }
    const onScroll = () => {
      const distanceFromBottom =
        box.scrollHeight - box.scrollTop - box.clientHeight;
      const isNowAtBottom = distanceFromBottom <= AT_BOTTOM_PIXELS;
      isFollowing.current = isNowAtBottom;
      setIsAtBottom(isNowAtBottom);
    };
    box.addEventListener('scroll', onScroll);
    return () => {
      box.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const box = ref.current;
    if (box !== null && isShown && isFollowing.current) {
      box.scrollTop = box.scrollHeight;
    }
  }, [changeKey, isShown]);

  const scrollToBottom = useCallback(() => {
    const box = ref.current;
    if (box === null) {
      return;
    }
    box.scrollTop = box.scrollHeight;
    isFollowing.current = true;
    setIsAtBottom(true);
  }, []);

  return { ref, isAtBottom, scrollToBottom };
}
