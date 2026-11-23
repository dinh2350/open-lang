import { Stack } from '@astryxdesign/core/Stack';
import type { ReactElement } from 'react';
import { useAuth } from '@/auth/auth-context';
import { NavLink } from '@/nav-link';

/** Links between the Conversation page and the history, for a signed-in User. */
export function AppNav(): ReactElement | null {
  const { user } = useAuth();
  if (user === null) {
    return null;
  }
  return (
    <Stack
      as="nav"
      aria-label="Chính"
      direction="horizontal"
      align="center"
      gap={4}
    >
      <NavLink href="/" end>
        Luyện nói
      </NavLink>
      <NavLink href="/conversations" end={false}>
        Lịch sử
      </NavLink>
    </Stack>
  );
}
