import type { ReactElement, ReactNode } from 'react';
import { useAuth } from './auth/auth-context';
import { SignOutButton } from './auth/sign-out-button';
import { ModeToggle } from './theme/mode-toggle';
import './app-header.css';

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
    <header className="app-header">
      {children}
      <ModeToggle />
      {user !== null && <SignOutButton />}
    </header>
  );
}
