import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Layout from '../components/layout/Layout';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import orderService from '../services/orderService';

const Checkout = () => {
  const navigate = useNavigate();
  const { items, getCartTotal, clearCart } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: user?.email || '',
      fullName: user ? `${user.firstName} ${user.lastName}` : '',
      phone: user?.phone || ''
    }
  });

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const subtotal = getCartTotal();
  const shippingFee = 150;
  const total = subtotal + shippingFee;

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');

    try {
      const orderData = {
        email: data.email,
        items: items.map(item => ({
          product: item.product._id,
          name: item.product.name,
          price: item.price,
          quantity: item.quantity,
          size: item.size
        })),
        shippingAddress: {
          fullName: data.fullName,
          phone: data.phone,
          address: data.address,
          city: data.city,
          province: data.province,
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
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      {...register('address', { required: 'Address is required' })}
                      className="input-field"
                    />
                    {errors.address && (
                      <p className="text-red-600 text-sm mt-1">{errors.address.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        {...register('city', { required: 'City is required' })}
                        className="input-field"
                      />
                      {errors.city && (
                        <p className="text-red-600 text-sm mt-1">{errors.city.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Province *
                      </label>
                      <input
                        type="text"
                        {...register('province', { required: 'Province is required' })}
                        className="input-field"
                      />
                      {errors.province && (
                        <p className="text-red-600 text-sm mt-1">{errors.province.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      {...register('zipCode', { required: 'ZIP code is required' })}
                      className="input-field"
                    />
                    {errors.zipCode && (
                      <p className="text-red-600 text-sm mt-1">{errors.zipCode.message}</p>
                    )}
                  </div>

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

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full text-lg"
              >
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </form>
          </div>

          {/* Order Summary */}
          <div>
            <div className="card p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={`${item.product._id}-${item.size}`} className="flex gap-3 pb-3 border-b">
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.product.name}</p>
                      <p className="text-xs text-gray-600">Size: {item.size}</p>
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
