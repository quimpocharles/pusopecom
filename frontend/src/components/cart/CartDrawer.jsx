import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { XMarkIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import useCartStore from '../../store/cartStore';
import usePassCartStore from '../../store/passCartStore';
import CartUpsell from './CartUpsell';
import FreeShippingBar from './FreeShippingBar';
import { toTitleCase } from '../../utils/text';

// Returns stock for a given cart item using the product data stored at add-time
const getItemStock = (item) => {
  if (item.color && item.product.colors?.length > 0) {
    const colorObj = item.product.colors.find((c) => c.color === item.color);
    return colorObj?.sizes.find((s) => s.size === item.size)?.stock ?? 99;
  }
  return item.product.sizes?.find((s) => s.size === item.size)?.stock ?? 99;
};

const CartDrawer = () => {
  const navigate = useNavigate();
  const {
    items, removeItem, updateQuantity, getCartTotal, getCartCount,
    isCartOpen, requestedTab, closeCart
  } = useCartStore();
  const {
    event: passEvent, selections: passSelections, setQuantity: setPassQuantity,
    getPassCount, getPassTotal
  } = usePassCartStore();

  const [removeConfirm, setRemoveConfirm] = useState(null); // { productId, size, color, name }
  // One drawer, one open/close (cartStore.isCartOpen), two tabs inside —
  // a single Cart button opens this; which sub-cart it lands on defaults to
  // whichever actually has something in it (favoring Merchandise on a tie,
  // including both-empty), unless the caller requested a specific tab via
  // openCart(tab) — e.g. PassEventDetail's "View Cart" always wants Passes.
  const [activeTab, setActiveTab] = useState('merch'); // 'merch' | 'passes'

  // Lock body scroll when open, and re-pick the default tab each time the
  // drawer opens (not on every selections change while it's already open,
  // so switching tabs mid-browse doesn't get overridden underneath the user).
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
      setActiveTab(requestedTab || (items.length === 0 && passSelections.length > 0 ? 'passes' : 'merch'));
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCartOpen]);

  const handleCheckout = () => {
    closeCart();
    navigate('/checkout');
  };

  const cartTotal = getCartTotal();
  const cartCount = getCartCount();
  const cartProductIds = [...new Set(items.map((item) => item.product._id))];
  const passCount = getPassCount();
  const passTotal = getPassTotal();

  return (
    <>
      {/* Backdrop */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Cart</h2>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close cart"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs — Passes and Merchandise never check out together
            (ADR-011 addendum), so each tab is a fully separate list/total/
            checkout, not a merged view. */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('merch')}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              activeTab === 'merch' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Merchandise{cartCount > 0 ? ` (${cartCount})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('passes')}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              activeTab === 'passes' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Passes{passCount > 0 ? ` (${passCount})` : ''}
          </button>
        </div>

        {activeTab === 'merch' ? (
          <>
            {/* Merchandise Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-gray-400 text-lg mb-2">Your cart is empty</p>
                  <p className="text-gray-400 text-sm mb-6">Add items to get started</p>
                  <Link to="/products" onClick={closeCart} className="btn-primary inline-flex">
                    View Products
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={`${item.product._id}-${item.size}-${item.color || ''}`} className="flex gap-4">
                      <Link
                        to={`/products/${item.product.slug}`}
                        onClick={closeCart}
                        className="flex-shrink-0"
                      >
                        <img
                          src={item.product.images?.[0] || '/placeholder.jpg'}
                          alt={item.product.name}
                          className="w-20 h-20 object-cover rounded-xl bg-gray-100"
                          width={80}
                          height={80}
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/products/${item.product.slug}`}
                          onClick={closeCart}
                          className="font-semibold text-gray-900 text-sm truncate block hover:text-primary-600"
                        >
                          {toTitleCase(item.product.name)}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.color ? `${item.size} / ${item.color}` : `Size: ${item.size}`}
                        </p>
                        <p className="text-sm font-bold text-gray-900 mt-1">
                          ₱{item.price?.toLocaleString()}
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center border border-gray-200 rounded-lg">
                            <button
                              onClick={() => {
                                if (item.quantity === 1) {
                                  setRemoveConfirm({ productId: item.product._id, size: item.size, color: item.color, name: item.product.name });
                                } else {
                                  updateQuantity(item.product._id, item.size, item.color, item.quantity - 1);
                                }
                              }}
                              className="p-1.5 hover:bg-gray-50 transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <MinusIcon className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            <span className="px-3 text-sm font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product._id, item.size, item.color, item.quantity + 1)}
                              disabled={item.quantity >= getItemStock(item)}
                              className="p-1.5 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Increase quantity"
                            >
                              <PlusIcon className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                          </div>
                          <button
                            onClick={() => setRemoveConfirm({ productId: item.product._id, size: item.size, color: item.color, name: item.product.name })}
                            className="text-sm text-gray-400 hover:text-accent-500 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upsell Section */}
              {items.length > 0 && (
                <CartUpsell cartProductIds={cartProductIds} />
              )}
            </div>

            {/* Footer — Checkout */}
            {items.length > 0 && (
              <div className="border-t border-gray-100 space-y-0">
                <FreeShippingBar cartTotal={cartTotal} country="Philippines" />
                <div className="px-6 py-4 space-y-3">
                <button
                  onClick={handleCheckout}
                  className="btn-primary w-full text-center"
                >
                  Checkout &middot; ₱{cartTotal.toLocaleString()}
                </button>
                <p className="text-xs text-gray-400 text-center">Shipping & taxes calculated at checkout</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Pass Selections — scoped to one event at a time */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {passSelections.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-gray-400 text-lg mb-2">No Passes yet</p>
                  <p className="text-gray-400 text-sm mb-6">Buy a Pass to a game or event to see it here.</p>
                  <Link to="/events" onClick={closeCart} className="btn-primary inline-flex">
                    Browse Events
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {passEvent && (
                    <Link
                      to={`/events/${passEvent.slug}`}
                      onClick={closeCart}
                      className="block font-semibold text-gray-900 text-sm hover:text-primary-600"
                    >
                      {passEvent.name}
                    </Link>
                  )}
                  {passSelections.map((s) => (
                    <div key={s.tierId} className="flex gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{s.tierName}</p>
                        <p className="text-sm font-bold text-gray-900 mt-1">₱{s.price?.toLocaleString()}</p>

                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center border border-gray-200 rounded-lg">
                            <button
                              onClick={() => setPassQuantity({ _id: s.tierId, name: s.tierName, price: s.price }, s.quantity - 1)}
                              className="p-1.5 hover:bg-gray-50 transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <MinusIcon className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            <span className="px-3 text-sm font-medium">{s.quantity}</span>
                            <button
                              onClick={() => setPassQuantity({ _id: s.tierId, name: s.tierName, price: s.price }, s.quantity + 1)}
                              className="p-1.5 hover:bg-gray-50 transition-colors"
                              aria-label="Increase quantity"
                            >
                              <PlusIcon className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                          </div>
                          <button
                            onClick={() => setPassQuantity({ _id: s.tierId, name: s.tierName, price: s.price }, 0)}
                            className="text-sm text-gray-400 hover:text-accent-500 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer — Checkout */}
            {passSelections.length > 0 && (
              <div className="border-t border-gray-100 px-6 py-4 space-y-3">
                <button
                  onClick={handleCheckout}
                  className="btn-primary w-full text-center"
                >
                  Checkout &middot; ₱{passTotal.toLocaleString()}
                </button>
                <p className="text-xs text-gray-400 text-center">Checked out separately from Merchandise</p>
              </div>
            )}
          </>
        )}
      </div>
      {/* Remove Item Confirmation Modal */}
      {removeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Item</h3>
            <p className="text-sm text-gray-600 mb-6">
              Remove <span className="font-medium">{toTitleCase(removeConfirm.name)}</span> from your cart?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRemoveConfirm(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  removeItem(removeConfirm.productId, removeConfirm.size, removeConfirm.color);
                  setRemoveConfirm(null);
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CartDrawer;
