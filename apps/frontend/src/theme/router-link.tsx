import type { ComponentProps, ReactElement } from 'react';
import { Link } from 'react-router';

type RouterLinkProps = Omit<ComponentProps<typeof Link>, 'to'> & {
  readonly href: string;
};

/**
 * What Astryx's `Link` renders through `LinkProvider`: react-router's `Link`,
 * so a click changes the route without loading the page. Astryx hands over
 * `href`; react-router wants `to`.
 */
export function RouterLink({ href, ...props }: RouterLinkProps): ReactElement {
  return <Link to={href} {...props} />;
}
