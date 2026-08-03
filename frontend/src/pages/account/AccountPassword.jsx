import { useState } from 'react';
import { useForm } from 'react-hook-form';
import useAuthStore from '../../store/authStore';
import authService from '../../services/authService';

// Moved verbatim out of the old Account.jsx's PasswordTab — same
// authService calls, no behavior change, just routed instead of
// state-switched.
const AccountPassword = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const hasSocialAuth = user?.authProvider !== 'local' && !user?.password;
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const newPassword = watch('newPassword');

  const onSubmit = async (data) => {
    setLoading(true);
    setMessage('');
    try {
      await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setMessage('Password updated successfully');
      reset();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
      <h3 className="font-semibold text-gray-900">
        {hasSocialAuth ? 'Set a Password' : 'Change Password'}
      </h3>

      {!hasSocialAuth && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
          <input
            type="password"
            {...register('currentPassword', { required: 'Current password is required' })}
            className="input-field"
          />
          {errors.currentPassword && <p className="text-red-600 text-sm mt-1">{errors.currentPassword.message}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
        <input
          type="password"
          {...register('newPassword', {
            required: 'New password is required',
            minLength: { value: 6, message: 'At least 6 characters' },
          })}
          className="input-field"
        />
        {errors.newPassword && <p className="text-red-600 text-sm mt-1">{errors.newPassword.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
        <input
          type="password"
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (val) => val === newPassword || 'Passwords do not match',
          })}
          className="input-field"
        />
        {errors.confirmPassword && <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>}
      </div>

      {message && (
        <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Saving...' : hasSocialAuth ? 'Set Password' : 'Change Password'}
      </button>
    </form>
  );
};

export default AccountPassword;
