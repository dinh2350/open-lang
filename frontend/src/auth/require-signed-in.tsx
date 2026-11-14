import { Navigate, Outlet } from 'react-router';
import { useAuth } from './auth-context';

/**
 * Shows its routes to a signed-in User and sends anyone else to sign-in.
 * On page load it waits until the refresh cookie has been tried. This only
 * hides pages: the backend decides who may do what.
 */
export function RequireSignedIn() {
  const { user, restoringSignIn } = useAuth();
  if (restoringSignIn) {
    return null;
  }
  return user === null ? <Navigate to="/sign-in" replace /> : <Outlet />;
}
