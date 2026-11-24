import type { ReactElement, SVGProps } from 'react';

/**
 * The app's own line icons, for the glyphs Astryx's registry does not have.
 * Pass one to Astryx's `Icon` as its `icon`: Icon sizes and colors it, and
 * keeps it hidden from screen readers unless it gets a `label`. Each is a
 * 24px outline drawn with `currentColor`, like Astryx's own icons, so it
 * follows the text color in light and dark mode.
 */
type IconProps = Readonly<SVGProps<SVGSVGElement>>;

/** The outline every icon shares; the caller's props come after it. */
function LineIcon({
  children,
  ...props
}: IconProps & { readonly children: ReactElement | ReactElement[] }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** A microphone with a slash through it: the mic is off. */
export function MicrophoneOffIcon(props: IconProps): ReactElement {
  return (
    <LineIcon {...props}>
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v2a3 3 0 0 0 5.12 2.12" />
      <path d="M19 10v1a7 7 0 0 1-.78 3.22M16.95 16.95A7 7 0 0 1 5 11v-1" />
      <path d="M12 18v4m-4 0h8" />
      <path d="M3 3l18 18" />
    </LineIcon>
  );
}

/** A speech bubble with quotation marks: a good sentence to keep. */
export function PhraseIcon(props: IconProps): ReactElement {
  return (
    <LineIcon {...props}>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20.5l1.3-4.6A8 8 0 1 1 21 12z" />
      <path d="M9 10.5v2M9 10.5h1.5M14 10.5v2M14 10.5h1.5" />
    </LineIcon>
  );
}

/** An open book: a word or an expression. */
export function WordIcon(props: IconProps): ReactElement {
  return (
    <LineIcon {...props}>
      <path d="M12 6.5C10.5 5 8.5 4.5 3 4.5v14c5.5 0 7.5.5 9 2 1.5-1.5 3.5-2 9-2v-14c-5.5 0-7.5.5-9 2z" />
      <path d="M12 6.5v14" />
    </LineIcon>
  );
}

/** A pencil: a sentence put right. */
export function CorrectionIcon(props: IconProps): ReactElement {
  return (
    <LineIcon {...props}>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z" />
      <path d="M14.5 5.5l3 3" />
    </LineIcon>
  );
}

/** An ear: a sentence the Member did not hear. */
export function MissedIcon(props: IconProps): ReactElement {
  return (
    <LineIcon {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 3-2 4.5-3.5 5.5S12.5 17 12.5 19a2.5 2.5 0 0 1-5 0" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 5 0c0 1.2-1 1.8-1.7 2.3" />
    </LineIcon>
  );
}

/** A notebook with lines: the notes of a Conversation. */
export function NotebookIcon(props: IconProps): ReactElement {
  return (
    <LineIcon {...props}>
      <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M3 7h4M3 12h4M3 17h4M10 8h6M10 12h6M10 16h4" />
    </LineIcon>
  );
}

/** A clipboard with a check mark: how the Member did. */
export function AssessmentIcon(props: IconProps): ReactElement {
  return (
    <LineIcon {...props}>
      <path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <path d="M9 3h6v3H9z" />
      <path d="M9 13.5l2 2 4-4.5" />
    </LineIcon>
  );
}
