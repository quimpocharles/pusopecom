import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { authService } from '../services/authService';
import Layout from '../components/layout/Layout';
import SEO from '../components/common/SEO';

const ForgotPassword = () => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      await authService.forgotPassword(data.email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <SEO title="Forgot Password" noIndex />
      <div className="container-custom py-12">
        <div className="max-w-md mx-auto">
          <div className="card p-8">
            <h1 className="text-3xl font-bold text-center mb-8">Forgot Password</h1>

            {success ? (
              <div>
                <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6">
                  If an account exists with that email, we've sent a password reset link. Please check your inbox.
                </div>
                <Link to="/login" className="btn-primary w-full block text-center">
                  Back to Login
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                    {error}
                  </div>
                )}

                <p className="text-gray-600 text-sm mb-6">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

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

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>

                <p className="text-center mt-6 text-gray-600">
                  <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
                    Back to Login
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ForgotPassword;
