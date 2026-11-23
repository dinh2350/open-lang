import { Link } from '@astryxdesign/core/Link';
import type { ReactElement } from 'react';
import { useMatch } from 'react-router';

/**
 * A link in a nav. The link to the page you are on says so with
 * `aria-current="page"`, as react-router's `NavLink` did, and shows in the
 * primary text color without an underline.
 */
export function NavLink({
  href,
  end,
  children,
}: {
  readonly href: string;
  /** Only the exact path is this page, not the paths under it. */
  readonly end: boolean;
  readonly children: string;
}): ReactElement {
  const isActive = useMatch({ path: href, end }) !== null;
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      color={isActive ? 'primary' : 'accent'}
      weight={isActive ? 'medium' : 'normal'}
      hasUnderline={!isActive}
    >
      {children}
    </Link>
  );
}
