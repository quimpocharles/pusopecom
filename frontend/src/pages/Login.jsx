import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import useAuthStore from '../store/authStore';
import Layout from '../components/layout/Layout';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';
import SocialDivider from '../components/auth/SocialDivider';
import SEO from '../components/common/SEO';
import PasswordInput from '../components/common/PasswordInput';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  // A scanner's entire admin surface is Pass Check-In — there's no other
  // page for them to legitimately land on, so this always wins over any
  // preserved destination (a ?redirect= or an AdminRoute bounce-from).
  const SCANNER_LANDING_PATH = '/admin/pass-checkin';
  const isScannerAdmin = (user) => user?.role === 'admin' && user?.staffProfile?.department === 'scanner';

  const getRedirectPath = (user) => {
    if (isScannerAdmin(user)) return SCANNER_LANDING_PATH;
    const searchParams = new URLSearchParams(location.search);
    const redirectParam = searchParams.get('redirect');
    if (redirectParam) return redirectParam;
    // `from` is the full location AdminRoute redirected from (see
    // AdminRoute.jsx) — pathname alone would drop query params a
    // destination needs (e.g. a report download's ?runId=&format=), so
    // reconstruct the full path+search, not just from.pathname.
    const from = location.state?.from;
    if (from?.pathname) return `${from.pathname}${from.search || ''}`;
    return '/';
  };

  // Check if profile needs completion — age verification, phone, and a
  // shipping address are customer/checkout requirements, meaningless for a
  // staff account (a scanner or Order Manager was never going to have a
  // shipping address), so admins are exempt entirely rather than getting
  // funneled through customer onboarding.
  const isProfileIncomplete = (user) => {
    if (user?.role === 'admin') return false;
    return !user?.ageVerified || !user?.phone || !user?.addresses?.length;
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      const response = await login(data);
      // Check if profile is incomplete
      if (isProfileIncomplete(response.user)) {
        navigate('/complete-profile', { replace: true });
      } else {
        navigate(getRedirectPath(response.user), { replace: true });
      }
    } catch (err) {
      if (err.response?.data?.accountLocked) {
        setError('locked');
      } else {
        setError(err.response?.data?.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSuccess = (user) => {
    // Check if profile is incomplete
    if (isProfileIncomplete(user)) {
      navigate('/complete-profile', { replace: true });
    } else {
      navigate(getRedirectPath(user), { replace: true });
    }
  };

  const handleSocialError = (message) => {
    setError(message);
  };

  return (
    <Layout>
      <SEO title="Sign In" noIndex />
      <div className="container-custom py-12">
        <div className="max-w-md mx-auto">
          <div className="card p-8">
            <h1 className="text-3xl font-bold text-center mb-8">Login</h1>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                {error === 'locked' ? (
                  <>
                    Your account has been locked due to too many failed login attempts.{' '}
                    <Link to="/forgot-password" className="font-semibold underline">
                      Reset your password
                    </Link>{' '}
                    to regain access.
                  </>
                ) : (
                  error
                )}
              </div>
            )}

            {/* Social Login */}
            <GoogleLoginButton
              onSuccess={handleSocialSuccess}
              onError={handleSocialError}
              disabled={loading}
            />

            <SocialDivider />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className="input-field"
                />
                {errors.email && (
                  <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <PasswordInput
                  id="password"
                  {...register('password', {
                    required: 'Password is required'
                  })}
                />
                {errors.password && (
                  <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <p className="text-center mt-6 text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-semibold">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
