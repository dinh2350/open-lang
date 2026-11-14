import type { ReactNode } from 'react';
import { useAuth } from './auth-context';
import { SignOutButton } from './sign-out-button';

/**
 * The top right of every page while a User is signed in: the links passed
 * in, then a way to sign out.
 */
export function SignedInHeader({
  children,
}: {
  readonly children?: ReactNode;
}) {
  const { user } = useAuth();
  if (user === null) {
    return null;
  }
  return (
    <header className="fixed top-0 right-0 flex items-start gap-4 p-4">
      {children}
      <SignOutButton />
    </header>
  );
}
