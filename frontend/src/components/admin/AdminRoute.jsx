import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    // Preserve the originally-requested destination (path + query string —
    // e.g. a scheduled-report email's ?runId=&format=) so Login.jsx's
    // existing location.state?.from redirect-back logic can return the
    // admin here after they sign in, instead of dropping them on '/'.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
