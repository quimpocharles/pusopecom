import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { authService } from '../services/authService';
import Layout from '../components/layout/Layout';
import SEO from '../components/common/SEO';
import PasswordInput from '../components/common/PasswordInput';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      await authService.resetPassword(token, data.password);
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <SEO title="Reset Password" noIndex />
      <div className="container-custom py-12">
        <div className="max-w-md mx-auto">
          <div className="card p-8">
            <h1 className="text-3xl font-bold text-center mb-8">Reset Password</h1>

            {!token ? (
              <div>
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                  Invalid reset link. Please request a new password reset.
                </div>
                <Link to="/forgot-password" className="btn-primary w-full block text-center">
                  Request New Link
                </Link>
              </div>
            ) : success ? (
              <div>
                <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6">
                  Password reset successful! Redirecting to login...
                </div>
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
                  Go to Login
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <PasswordInput
                      id="password"
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters'
                        }
                      })}
                    />
                    {errors.password && (
                      <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password
                    </label>
                    <PasswordInput
                      id="confirmPassword"
                      {...register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: value => value === password || 'Passwords do not match'
                      })}
                    />
                    {errors.confirmPassword && (
                      <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full"
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
