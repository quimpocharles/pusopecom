import { Link, useNavigate } from 'react-router-dom';
import { TrashIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import useCartStore from '../store/cartStore';

const Cart = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, getCartTotal } = useCartStore();

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container-custom py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
            <p className="text-gray-600 mb-8">Add some items to get started!</p>
            <Link to="/products" className="btn-primary inline-block">
              Shop Now
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const subtotal = getCartTotal();
  const shippingFee = 150;
  const total = subtotal + shippingFee;

  return (
    <Layout>
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {items.map((item) => (
                <div key={`${item.product._id}-${item.size}`} className="card p-4">
                  <div className="flex gap-4">
                    {/* Image */}
                    <Link
                      to={`/products/${item.product.slug}`}
                      className="w-24 h-24 flex-shrink-0 rounded overflow-hidden"
                    >
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </Link>

                    {/* Details */}
                    <div className="flex-1">
                      <Link
                        to={`/products/${item.product.slug}`}
                        className="font-semibold hover:text-primary-600 mb-1 block"
                      >
                        {item.product.name}
                      </Link>
                      <p className="text-sm text-gray-600 mb-2">
                        Size: {item.size}
                      </p>
                      <div className="flex items-center gap-4">
                        {/* Quantity */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product._id, item.size, item.quantity - 1)}
                            className="w-8 h-8 rounded border border-gray-300 hover:border-primary-600"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product._id, item.size, item.quantity + 1)}
                            className="w-8 h-8 rounded border border-gray-300 hover:border-primary-600"
                          >
                            +
                          </button>
                        </div>

                        {/* Price */}
                        <div className="flex-1 text-right">
                          <p className="font-bold text-primary-600">
                            ₱{(item.price * item.quantity).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-500">
                            ₱{item.price.toFixed(2)} each
                          </p>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeItem(item.product._id, item.size)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="card p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping Fee</span>
                  <span className="font-semibold">₱{shippingFee.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-lg text-primary-600">
                    ₱{total.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigate('/checkout')}
                className="btn-primary w-full mb-3"
              >
                Proceed to Checkout
              </button>

              <Link
                to="/products"
                className="block text-center text-primary-600 hover:text-primary-700 font-semibold"
              >
                Continue Shopping
              </Link>

              {subtotal >= 2000 && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded text-sm">
                  You qualify for free shipping!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Cart;
