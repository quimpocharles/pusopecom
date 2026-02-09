import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  regions,
  provinces,
  cities,
} from 'select-philippines-address';
import Layout from '../components/layout/Layout';
import AddressForm from '../components/address/AddressForm';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import orderService from '../services/orderService';
import SEO from '../components/common/SEO';

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { items, getCartTotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const paymentCancelled = searchParams.get('payment') === 'cancelled';

  const defaultAddress = user?.addresses?.find(a => a.isDefault) || user?.addresses?.[0];

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      email: user?.email || '',
      fullName: defaultAddress?.fullName || (user ? `${user.firstName} ${user.lastName}` : ''),
      phone: defaultAddress?.phone || user?.phone || '',
      country: defaultAddress?.country || 'Philippines',
      address: defaultAddress?.address || '',
      city: '',
      province: '',
      region: '',
      barangay: '',
      zipCode: '',
      notes: ''
    }
  });

  if (items.length === 0 && !paymentCancelled) {
    navigate('/cart');
    return null;
  }

  const subtotal = getCartTotal();
  const shippingFee = 150;
  const total = subtotal + shippingFee;

  const dismissCancelledAlert = () => {
    setSearchParams({}, { replace: true });
  };

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

      const orderData = {
        email: data.email,
        items: items.map(item => ({
          product: item.product._id,
          name: item.product.name,
          price: item.price,
          quantity: item.quantity,
          size: item.size,
          ...(item.color && { color: item.color })
        })),
        shippingAddress: {
          fullName: data.fullName,
          phone: data.phone,
          country: data.country,
          address: data.address,
          city: cityText,
          province: provinceText,
          region: regionText,
          barangay: isPH ? data.barangay : undefined,
          zipCode: data.zipCode
        },
        notes: data.notes
      };

      const response = await orderService.createOrder(orderData);

      if (response.success && response.data.checkoutUrl) {
        clearCart();
        window.location.href = response.data.checkoutUrl;
      } else {
        setError('Failed to create checkout session. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <SEO title="Checkout" noIndex />
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        {/* Cancelled payment alert */}
        {paymentCancelled && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-6 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p>Your payment was cancelled. You can try again when ready.</p>
            </div>
            <button
              onClick={dismissCancelledAlert}
              className="text-amber-600 hover:text-amber-800 flex-shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Contact Information */}
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">Contact Information</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
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
                </div>
              </div>

              {/* Shipping Address */}
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">Shipping Address</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      {...register('fullName', { required: 'Full name is required' })}
                      className="input-field"
                    />
                    {errors.fullName && (
                      <p className="text-red-600 text-sm mt-1">{errors.fullName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      {...register('phone', { required: 'Phone number is required' })}
                      className="input-field"
                    />
                    {errors.phone && (
                      <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>
                    )}
                  </div>

                  {/* Address Form Component */}
                  <AddressForm
                    register={register}
                    errors={errors}
                    setValue={setValue}
                    watch={watch}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order Notes (Optional)
                    </label>
                    <textarea
                      {...register('notes')}
                      rows={3}
                      className="input-field"
                      placeholder="Special instructions for your order..."
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">Payment Method</h2>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-medium text-sm text-gray-900">Maya & GCash accepted</p>
                  <p className="text-xs text-gray-500 mt-1">You'll be redirected to complete payment securely</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full text-lg flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Processing...'
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                      Proceed to Payment
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-gray-400 mt-2">Secure checkout powered by Maya</p>
              </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="order-first lg:order-last">
            <div className="card p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={`${item.product._id}-${item.size}-${item.color || ''}`} className="flex gap-3 pb-3 border-b">
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.product.name}</p>
                      <p className="text-xs text-gray-600">
                        {item.color ? `${item.size} / ${item.color}` : `Size: ${item.size}`}
                      </p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₱{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-3 border-t">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>₱{shippingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary-600">₱{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
