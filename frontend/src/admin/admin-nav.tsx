import { NavLink } from 'react-router';
import { useAuth } from '@/auth/auth-context';

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? 'text-foreground font-medium'
    : 'text-muted-foreground hover:text-foreground underline';

/** Links between the Conversation page and the admin Users page, for Admins only. */
export function AdminNav() {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return null;
  }
  return (
    <nav
      aria-label="Admin"
      className="fixed top-0 right-0 flex gap-4 p-4 text-sm"
    >
      <NavLink to="/" end className={linkClassName}>
        Conversation
      </NavLink>
      <NavLink to="/admin/users" className={linkClassName}>
        Manage Users
      </NavLink>
    </nav>
  );
}
