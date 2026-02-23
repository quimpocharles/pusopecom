import { useState, useRef, useEffect } from 'react';
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
import api from '../services/api';
import { toTitleCase } from '../utils/text';
import SEO from '../components/common/SEO';

// ─── Delivery option card ────────────────────────────────────────────────────
const DeliveryCard = ({ selected, onClick, label, description, isFree, fee, note }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left border rounded-xl p-4 flex items-start gap-3 transition-all ${
      selected ? 'border-[#0a0a0a] bg-gray-50' : 'border-gray-200 hover:border-gray-400'
    }`}
  >
    <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
      selected ? 'border-[#0a0a0a]' : 'border-gray-300'
    }`}>
      {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#0a0a0a]" />}
    </span>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-sm text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      {note && <p className="text-xs text-gray-400 italic mt-1">{note}</p>}
    </div>
    <div className="flex-shrink-0 text-right">
      {isFree
        ? <span className="text-sm font-semibold text-green-600">FREE</span>
        : <span className="text-sm font-semibold text-gray-900">₱{Number(fee).toFixed(2)}</span>
      }
    </div>
  </button>
);

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { items, getCartTotal } = useCartStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const redirectingRef = useRef(false);
  const [error, setError] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('standard'); // 'standard' | slotId
  const [shippingOptions, setShippingOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

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

  const country = watch('country') || 'Philippines';
  const region  = watch('region')  || '';
  const subtotal = getCartTotal(); // hoisted above effects so it can be a dependency

  // Fetch shipping options from the server whenever country, region, or cart total changes.
  // Server auto-disables venue pickup if the pickup date has passed.
  useEffect(() => {
    setOptionsLoading(true);
    api.post('/shipping/options', { cartTotal: subtotal, country, region })
      .then(res => {
        if (res.data.success) {
          const opts = res.data.data.shippingOptions;
          setShippingOptions(opts);
          // Drop pickup selection if that slot is no longer available
          if (deliveryMethod !== 'standard') {
            const stillAvailable = opts.some(o => o.slotId === deliveryMethod);
            if (!stillAvailable) setDeliveryMethod('standard');
          }
        }
      })
      .catch(() => {})
      .finally(() => setOptionsLoading(false));
  }, [country, region, subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to standard delivery whenever the country changes
  useEffect(() => { setDeliveryMethod('standard'); }, [country]);

  const paymentCancelled = searchParams.get('payment') === 'cancelled';

  if (items.length === 0 && !paymentCancelled && !redirectingRef.current) {
    navigate('/products', { replace: true });
    return null;
  }

  if (redirecting) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-semibold text-gray-900">Redirecting to payment...</p>
        <p className="text-sm text-gray-500 mt-1">Please wait, do not close this page</p>
      </div>
    );
  }

  // Derive the currently-selected shipping option from the API response
  const standardOption  = shippingOptions.find(o => o.method !== 'venue_pickup') ?? null;
  const pickupSlots     = shippingOptions.filter(o => o.method === 'venue_pickup');
  const effectiveOption = deliveryMethod === 'standard'
    ? standardOption
    : (pickupSlots.find(o => o.slotId === deliveryMethod) ?? standardOption);
  const shippingFee = effectiveOption?.fee ?? null; // null → contact_us or still loading
  const total = shippingFee != null ? subtotal + shippingFee : null;

  const dismissCancelledAlert = () => {
    setSearchParams({}, { replace: true });
  };

  const onSubmit = async (data) => {
    if (effectiveOption?.method === 'contact_us') {
      setError('Please contact us to arrange shipping for your location before placing an order.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isPickup = deliveryMethod !== 'standard';
      const isPH = data.country === 'Philippines';
      let shippingAddress;

      if (isPickup) {
        // Pickup orders: use venue details from the selected slot option
        shippingAddress = {
          fullName: '(Venue Pickup)',
          phone: data.phone,
          country: 'Philippines',
          address: effectiveOption?.venueAddress || effectiveOption?.venueName || 'Venue Pickup',
          city: effectiveOption?.venueName || 'Venue',
          province: 'Metro Manila',
          region: 'National Capital Region (NCR)',
          zipCode: '0000',
        };
      } else {
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

        shippingAddress = {
          fullName: data.fullName,
          phone: data.phone,
          country: data.country,
          address: data.address,
          city: cityText,
          province: provinceText,
          region: regionText,
          barangay: isPH ? data.barangay : undefined,
          zipCode: data.zipCode,
        };
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
        shippingAddress,
        shippingFee: shippingFee ?? 0,
        shippingMethod: effectiveOption?.method ?? null,
        slotId: isPickup ? (effectiveOption?.slotId ?? null) : undefined,
        shippingRegion: isPickup ? null
          : data.country === 'Philippines' ? (data.region || null)
          : (standardOption?.region || null),
        notes: isPickup
          ? `VENUE PICKUP${data.notes ? ` — ${data.notes}` : ''}`
          : data.notes,
      };

      const response = await orderService.createOrder(orderData);

      if (response.success && response.data.checkoutUrl) {
        redirectingRef.current = true;
        setRedirecting(true);
        window.location.href = response.data.checkoutUrl;
      } else {
        setError('Failed to create checkout session. Please try again.');
      }
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.errors?.length) {
        setError(errData.errors.map(e => e.msg || e.message).join(', '));
      } else {
        setError(errData?.message || 'Failed to process checkout. Please try again.');
      }
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
                </div>
              </div>

              {/* Delivery Method */}
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">Delivery Method</h2>

                {optionsLoading ? (
                  /* Subtle skeleton while fetching — doesn't affect other sections */
                  <div className="space-y-3 animate-pulse">
                    <div className="h-16 bg-gray-100 rounded-xl" />
                    <div className="h-16 bg-gray-100 rounded-xl" />
                  </div>
                ) : standardOption?.method === 'contact_us' ? (
                  /* Country exists in dropdown but has no shipping coverage */
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                    <p className="font-semibold mb-1">Shipping quote required</p>
                    <p>
                      We currently ship to selected regions. For your location, please{' '}
                      <a
                        href="https://www.facebook.com/pusopilipinas"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-medium"
                      >
                        message us on Facebook
                      </a>{' '}
                      or email us and we will arrange a custom shipping quote.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Standard Delivery / International — always the first option */}
                    {standardOption && (
                      <DeliveryCard
                        key="standard"
                        selected={deliveryMethod === 'standard'}
                        onClick={() => setDeliveryMethod('standard')}
                        label={standardOption.label}
                        description={standardOption.description}
                        isFree={standardOption.isFree}
                        fee={standardOption.fee}
                      />
                    )}

                    {/* Venue Pickup — one card per active slot */}
                    {pickupSlots.map(slot => (
                      <DeliveryCard
                        key={slot.slotId}
                        selected={deliveryMethod === slot.slotId}
                        onClick={() => setDeliveryMethod(slot.slotId)}
                        label={slot.label}
                        description={slot.description}
                        isFree={slot.isFree}
                        fee={slot.fee}
                        note={slot.note}
                      />
                    ))}
                  </div>
                )}

                {/* International disclaimer */}
                {!optionsLoading && country !== 'Philippines' && standardOption?.method === 'international' && (
                  <p className="text-xs text-gray-400 mt-3">
                    International orders may be subject to import duties and customs fees charged by the destination country. These are the buyer's responsibility.
                  </p>
                )}
              </div>

              {/* Shipping Address — hidden when venue pickup is selected */}
              {deliveryMethod === 'standard' && <div className="card p-6">
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
              </div>}

              {/* Payment Method */}
              <div className="card p-6">
                <h2 className="text-xl font-bold mb-4">Payment Method</h2>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-medium text-sm text-gray-900">Maya, GCash & major credit/debit cards accepted</p>
                  <p className="text-xs text-gray-500 mt-1">Visa, Mastercard, JCB, Amex · You'll be redirected to complete payment securely</p>
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
                      <p className="font-semibold text-sm">{toTitleCase(item.product.name)}</p>
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
                  {optionsLoading
                    ? <span className="text-gray-300 animate-pulse">···</span>
                    : shippingFee === 0
                      ? <span className="text-green-600 font-semibold">FREE</span>
                      : shippingFee != null
                        ? <span>₱{shippingFee.toFixed(2)}</span>
                        : <span className="text-gray-400 text-sm">Contact us</span>
                  }
                </div>
                {total != null && (
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary-600">₱{total.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
