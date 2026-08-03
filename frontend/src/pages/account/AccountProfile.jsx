import { useState } from 'react';
import { useForm } from 'react-hook-form';
import useAuthStore from '../../store/authStore';
import authService from '../../services/authService';

// Moved verbatim out of the old Account.jsx's ProfileTab — same
// authService calls, no behavior change, just routed instead of
// state-switched.
const AccountProfile = () => {
  const { user, refreshUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setMessage('');
    try {
      await authService.updateProfile(data);
      await refreshUser();
      setMessage('Profile updated successfully');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
        <input type="email" value={user?.email || ''} disabled className="input-field bg-gray-50 text-gray-500" />
        <p className="text-xs text-gray-400 mt-1">
          {user?.authProvider === 'google' ? 'Google account' : 'Email/password account'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
          <input
            type="text"
            {...register('firstName', { required: 'Required' })}
            className="input-field"
          />
          {errors.firstName && <p className="text-red-600 text-sm mt-1">{errors.firstName.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
          <input
            type="text"
            {...register('lastName', { required: 'Required' })}
            className="input-field"
          />
          {errors.lastName && <p className="text-red-600 text-sm mt-1">{errors.lastName.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
        <input
          type="tel"
          placeholder="09XX XXX XXXX"
          {...register('phone')}
          className="input-field"
        />
      </div>

      {message && (
        <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
};

export default AccountProfile;
