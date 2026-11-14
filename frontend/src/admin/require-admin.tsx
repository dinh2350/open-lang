import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/auth/auth-context';

/**
 * Shows its routes to Admins and sends anyone else to the Conversation page.
 * This only hides pages: the backend's Role guard decides who may manage
 * Users.
 */
export function RequireAdmin() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
}
