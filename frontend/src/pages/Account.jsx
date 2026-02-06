import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  regions,
  provinces,
  cities,
} from 'select-philippines-address';
import Layout from '../components/layout/Layout';
import SEO from '../components/common/SEO';
import AddressForm from '../components/address/AddressForm';
import useAuthStore from '../store/authStore';
import authService from '../services/authService';

const tabs = [
  { id: 'profile', label: 'Profile' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'password', label: 'Password' },
];

// --- Profile Tab ---
const ProfileTab = ({ user, onUpdate }) => {
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
      await onUpdate();
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

// --- Addresses Tab ---
const AddressesTab = ({ user, onUpdate }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const addresses = user?.addresses || [];

  const handleDelete = async (addressId) => {
    if (!window.confirm('Delete this address?')) return;
    setLoading(true);
    try {
      await authService.deleteAddress(addressId);
      await onUpdate();
      setMessage('Address deleted');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (addressId) => {
    setLoading(true);
    try {
      await authService.updateAddress(addressId, { isDefault: true });
      await onUpdate();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <p className={`text-sm ${message.includes('deleted') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      {addresses.map((addr) => (
        <div key={addr._id} className="border border-gray-200 rounded-xl p-4 relative">
          {addr.isDefault && (
            <span className="absolute top-3 right-3 bg-primary-50 text-primary-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              Default
            </span>
          )}
          <p className="font-medium text-gray-900">{addr.fullName}</p>
          <p className="text-sm text-gray-600">{addr.address}</p>
          <p className="text-sm text-gray-600">
            {[addr.barangay, addr.city, addr.province].filter(Boolean).join(', ')}
          </p>
          <p className="text-sm text-gray-600">{addr.zipCode} {addr.country}</p>
          {addr.phone && <p className="text-sm text-gray-500 mt-1">{addr.phone}</p>}
          <div className="flex gap-3 mt-3">
            {!addr.isDefault && (
              <button
                onClick={() => handleSetDefault(addr._id)}
                disabled={loading}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Set as Default
              </button>
            )}
            <button
              onClick={() => handleDelete(addr._id)}
              disabled={loading}
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {addresses.length === 0 && !showForm && (
        <p className="text-gray-500 text-sm">No addresses saved yet.</p>
      )}

      {showForm ? (
        <AddAddressForm
          onSave={async () => {
            await onUpdate();
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button onClick={() => setShowForm(true)} className="btn-outline text-sm">
          + Add Address
        </button>
      )}
    </div>
  );
};

const AddAddressForm = ({ onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      fullName: '',
      phone: '',
      country: 'Philippines',
      region: '',
      province: '',
      city: '',
      barangay: '',
      zipCode: '',
      address: '',
      isDefault: false,
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');
    try {
      // Resolve PSGC codes to text for PH addresses
      if (data.country === 'Philippines' && data.region) {
        const [regionList, provinceList, cityList] = await Promise.all([
          regions(),
          provinces(data.region),
          cities(data.province),
        ]);
        data.region = regionList.find(r => r.region_code === data.region)?.region_name || data.region;
        data.province = provinceList.find(p => p.province_code === data.province)?.province_name || data.province;
        data.city = cityList.find(c => c.city_code === data.city)?.city_name || data.city;
      }

      await authService.addAddress(data);
      await onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add address');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">New Address</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
            <input type="text" {...register('fullName', { required: 'Required' })} className="input-field" />
            {errors.fullName && <p className="text-red-600 text-sm mt-1">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone <span className="text-red-500">*</span></label>
            <input type="tel" {...register('phone', { required: 'Required' })} className="input-field" />
            {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>}
          </div>
        </div>

        <AddressForm register={register} errors={errors} setValue={setValue} watch={watch} />

        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('isDefault')} className="rounded border-gray-300" />
          <span className="text-sm text-gray-700">Set as default address</span>
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary text-sm">
            {loading ? 'Saving...' : 'Save Address'}
          </button>
          <button type="button" onClick={onCancel} className="btn-outline text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

// --- Password Tab ---
const PasswordTab = ({ user }) => {
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

// --- Main Account Page ---
const Account = () => {
  const { user, isAuthenticated, refreshUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/account" replace />;
  }

  return (
    <Layout>
      <SEO title="Account Settings" noIndex />
      <div className="container-custom py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Account Settings</h1>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && <ProfileTab user={user} onUpdate={refreshUser} />}
        {activeTab === 'addresses' && <AddressesTab user={user} onUpdate={refreshUser} />}
        {activeTab === 'password' && <PasswordTab user={user} />}
      </div>
    </Layout>
  );
};

export default Account;
