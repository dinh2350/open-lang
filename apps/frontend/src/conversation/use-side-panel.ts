import { useCallback, useState } from 'react';

/** The two panels of the side panel. */
export type PanelId = 'transcript' | 'notes';

/**
 * Which panel of the side panel is open, if any. The panel starts closed.
 * `toggle` is what a button or a tab for `clicked` does: it opens that panel,
 * closes it when it is the open one, and switches to it when the other one is
 * open.
 */
export function useSidePanel(): {
  readonly panel: PanelId | null;
  readonly toggle: (clicked: PanelId) => void;
  readonly close: () => void;
} {
  const [panel, setPanel] = useState<PanelId | null>(null);
  const toggle = useCallback((clicked: PanelId) => {
    setPanel((open) => (open === clicked ? null : clicked));
  }, []);
  const close = useCallback(() => {
    setPanel(null);
  }, []);
  return { panel, toggle, close };
}
