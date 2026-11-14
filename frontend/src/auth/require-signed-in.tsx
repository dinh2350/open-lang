import { Navigate, Outlet } from 'react-router';
import { useAuth } from './auth-context';

/**
 * Shows its routes to a signed-in User and sends anyone else to sign-in.
 * This only hides pages: the backend decides who may do what.
 */
export function RequireSignedIn() {
  const { user } = useAuth();
  return user === null ? <Navigate to="/sign-in" replace /> : <Outlet />;
}
