import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  regions,
  provinces,
  cities,
} from 'select-philippines-address';
import Layout from '../components/layout/Layout';
import AddressForm from '../components/address/AddressForm';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      phone: user?.phone || '',
      ageVerified: false,
      fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      country: 'Philippines',
      address: '',
      barangay: '',
      city: '',
      province: '',
      region: '',
      zipCode: '',
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      const isPH = data.country === 'Philippines';
      let regionText = data.region;
      let provinceText = data.province;
      let cityText = data.city;

      // Resolve PSGC codes to text names for PH addresses
      if (isPH && data.region) {
        const regionList = await regions();
        const provinceList = await provinces(data.region);
        const cityList = await cities(data.province);
        regionText = regionList.find(r => r.region_code === data.region)?.region_name || data.region;
        provinceText = provinceList.find(p => p.province_code === data.province)?.province_name || data.province;
        cityText = cityList.find(c => c.city_code === data.city)?.city_name || data.city;
      }

      await api.put('/auth/complete-profile', {
        phone: data.phone,
        ageVerified: data.ageVerified,
        address: {
          fullName: data.fullName,
          phone: data.phone,
          country: data.country,
          address: isPH ? data.address : data.address,
          city: cityText,
          province: provinceText,
          region: regionText,
          barangay: isPH ? data.barangay : undefined,
          zipCode: data.zipCode,
          isDefault: true
        }
      });

      await refreshUser();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/');
  };

  return (
    <Layout>
      <div className="container-custom py-12">
        <div className="max-w-lg mx-auto">
          <div className="card p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Complete Your Profile</h1>
              <p className="text-gray-500">Add your contact number and delivery address for a smoother checkout experience.</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Age Verification */}
              <div className="flex items-start gap-3">
                <input
                  id="ageVerified"
                  type="checkbox"
                  {...register('ageVerified', {
                    required: 'You must confirm you are at least 18 years old'
                  })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <label htmlFor="ageVerified" className="text-sm font-medium text-gray-700">
                    I confirm that I am at least 18 years old <span className="text-red-500">*</span>
                  </label>
                  {errors.ageVerified && (
                    <p className="text-red-600 text-sm mt-1">{errors.ageVerified.message}</p>
                  )}
                </div>
              </div>

              {/* Contact Number */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  {...register('phone', {
                    required: 'Contact number is required',
                    pattern: {
                      value: /^(09|\+639)\d{9}$/,
                      message: 'Please enter a valid Philippine mobile number'
                    }
                  })}
                  className="input-field"
                />
                {errors.phone && (
                  <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>
                )}
              </div>

              <hr className="my-6" />

              <h3 className="font-semibold text-gray-900">Delivery Address</h3>

              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  {...register('fullName', { required: 'Full name is required' })}
                  className="input-field"
                />
                {errors.fullName && (
                  <p className="text-red-600 text-sm mt-1">{errors.fullName.message}</p>
                )}
              </div>

              {/* Address Form Component */}
              <AddressForm
                register={register}
                errors={errors}
                setValue={setValue}
                watch={watch}
              />

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="btn-outline flex-1"
                >
                  Skip for Now
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1"
                >
                  {loading ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CompleteProfile;
