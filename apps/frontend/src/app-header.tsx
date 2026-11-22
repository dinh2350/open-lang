import type { ReactElement, ReactNode } from 'react';
import { useAuth } from './auth/auth-context';
import { SignOutButton } from './auth/sign-out-button';
import { ModeToggle } from './theme/mode-toggle';

/**
 * The top right of every page: the links passed in, the light or dark mode
 * switch, and, while a User is signed in, a way to sign out.
 */
export function AppHeader({
  children,
}: {
  readonly children?: ReactNode;
}): ReactElement {
  const { user } = useAuth();
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--spacing-4)',
        padding: 'var(--spacing-4)',
      }}
    >
      {children}
      <ModeToggle />
      {user !== null && <SignOutButton />}
    </header>
  );
}
