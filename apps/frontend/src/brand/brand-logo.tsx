import { Link } from '@astryxdesign/core/Link';
import type { ReactElement } from 'react';
import { useThemeMode } from '@/theme/theme-mode-provider';
import markOnDark from './ol-mark-on-dark.png';
import markOnLight from './ol-mark-on-light.png';
import './brand-logo.css';

/**
 * The OL mark and the name Open Lang, as a link to the home page. The mark is
 * decorative, since the name beside it says it all. Its three dots are white
 * for a dark page and near-black for a light one, so each mode has its own
 * image.
 */
export function BrandLogo(): ReactElement {
  const { mode } = useThemeMode();
  return (
    <Link
      href="/"
      className="brand-logo-link"
      color="primary"
      size="xl"
      weight="bold"
    >
      <span className="brand-logo">
        <img
          className="brand-logo-mark"
          src={mode === 'dark' ? markOnDark : markOnLight}
          alt=""
          width={407}
          height={256}
        />
        {/* The space between the words is text, so the link is named "Open Lang". */}
        <span className="brand-logo-name">
          <span>Open</span> <span className="brand-logo-lang">Lang</span>
        </span>
      </span>
    </Link>
  );
}
