import type { ReactElement, ReactNode } from 'react';
import { useAuth } from './auth/auth-context';
import { SignOutButton } from './auth/sign-out-button';
import { BrandLogo } from './brand/brand-logo';
import { ModeToggle } from './theme/mode-toggle';
import './app-header.css';

/**
 * The bar across the top of every page: the logo at the start, and at the
 * end the links passed in, the light or dark mode switch, and, while a User
 * is signed in, a way to sign out.
 */
export function AppHeader({
  children,
}: {
  readonly children?: ReactNode;
}): ReactElement {
  const { user } = useAuth();
  return (
    <header className="app-header">
      <BrandLogo />
      <div className="app-header-end">
        {children}
        <ModeToggle />
        {user !== null && <SignOutButton />}
      </div>
    </header>
  );
}
