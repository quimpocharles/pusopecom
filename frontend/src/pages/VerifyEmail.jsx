import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { authService } from '../services/authService';
import Layout from '../components/layout/Layout';
import SEO from '../components/common/SEO';
import LoadingSpinner from '../components/common/LoadingSpinner';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading | success | error
  const [error, setError] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid verification link. No token provided.');
      return;
    }

    const verify = async () => {
      try {
        await authService.verifyEmail(token);
        setStatus('success');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      } catch (err) {
        setStatus('error');
        setError(err.response?.data?.message || 'Email verification failed. The link may have expired.');
      }
    };

    verify();
  }, [token, navigate]);

  const onResend = async (data) => {
    setResendLoading(true);
    setResendSuccess(false);

    try {
      await authService.resendVerification(data.email);
      setResendSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Layout>
      <SEO title="Verify Email" noIndex />
      <div className="container-custom py-12">
        <div className="max-w-md mx-auto">
          <div className="card p-8">
            <h1 className="text-3xl font-bold text-center mb-8">Email Verification</h1>

            {status === 'loading' && (
              <div className="text-center">
                <LoadingSpinner />
                <p className="text-gray-600 mt-4">Verifying your email...</p>
              </div>
            )}

            {status === 'success' && (
              <div>
                <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6 text-center">
                  Email verified successfully! Redirecting to login...
                </div>
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold block text-center">
                  Go to Login
                </Link>
              </div>
            )}

            {status === 'error' && (
              <div>
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                  {error}
                </div>

                {resendSuccess ? (
                  <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6">
                    Verification email sent! Please check your inbox.
                  </div>
                ) : (
                  <>
                    <p className="text-gray-600 text-sm mb-4">
                      Enter your email to receive a new verification link.
                    </p>
                    <form onSubmit={handleSubmit(onResend)} className="space-y-4">
                      <div>
                        <input
                          type="email"
                          placeholder="Enter your email"
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
                        disabled={resendLoading}
                        className="btn-primary w-full"
                      >
                        {resendLoading ? 'Sending...' : 'Resend Verification Email'}
                      </button>
                    </form>
                  </>
                )}

                <p className="text-center mt-6 text-gray-600">
                  <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
                    Back to Login
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VerifyEmail;
