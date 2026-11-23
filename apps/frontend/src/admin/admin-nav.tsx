import { Stack } from '@astryxdesign/core/Stack';
import { useAuth } from '@/auth/auth-context';
import { NavLink } from '@/nav-link';

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
    >
      <NavLink href="/" end>
        Conversation
      </NavLink>
      <NavLink href="/admin/users" end={false}>
        Manage Users
      </NavLink>
    </Stack>
  );
}
