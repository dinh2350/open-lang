import { Link } from '@astryxdesign/core/Link';
import { Stack } from '@astryxdesign/core/Stack';
import type { ReactElement } from 'react';
import { useMatch } from 'react-router';
import { useAuth } from '@/auth/auth-context';

/**
 * A link in the admin nav. The link to the page you are on says so with
 * `aria-current="page"`, as react-router's `NavLink` did, and shows in the
 * primary text color without an underline.
 */
function AdminNavLink({
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

/** Links between the Conversation page and the admin Users page, for Admins only. */
export function AdminNav() {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return null;
  }
  return (
    <Stack
      as="nav"
      aria-label="Admin"
      direction="horizontal"
      align="center"
      gap={4}
      minHeight="2.25rem"
    >
      <AdminNavLink href="/" end>
        Conversation
      </AdminNavLink>
      <AdminNavLink href="/admin/users" end={false}>
        Manage Users
      </AdminNavLink>
    </Stack>
  );
}
