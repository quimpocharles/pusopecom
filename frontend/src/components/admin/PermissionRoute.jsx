import { Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { hasPermission, hasAnyPermission } from '../../utils/permissions';

/**
 * AdminRoute only checks role === 'admin' — same access for every
 * department. This is the per-page layer on top: nav already hides links
 * an account can't use, but a direct URL (typed, bookmarked, or an old
 * link) would otherwise still render the page and let its data calls 403
 * one at a time. Redirects to /admin (Dashboard) instead — the one page
 * every admin, regardless of department, is always allowed to see.
 */
const PermissionRoute = ({ permission, anyOf, children }) => {
  const user = useAuthStore((state) => state.user);
  const allowed = permission
    ? hasPermission(user, permission)
    : anyOf
      ? hasAnyPermission(user, anyOf)
      : true;

  if (!allowed) return <Navigate to="/admin" replace />;
  return children;
};

export default PermissionRoute;
