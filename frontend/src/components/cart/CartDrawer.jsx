import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { XMarkIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import useCartStore from '../../store/cartStore';
import CartUpsell from './CartUpsell';
import FreeShippingBar from './FreeShippingBar';
import { toTitleCase } from '../../utils/text';

const CartDrawer = () => {
  const navigate = useNavigate();
  const {
    items, addItem, removeItem, updateQuantity, getCartTotal, getCartCount,
    isCartOpen, pendingProduct, closeCart
  } = useCartStore();

  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null); // { productId, size, color, name }

  // Reset size and quantity when a new product opens the drawer
  useEffect(() => {
    if (pendingProduct) {
      setSelectedSize('');
      setQuantity(1);
      setSizeError(false);
    }
  }, [pendingProduct]);

  // Lock body scroll when open
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isCartOpen]);

  const hasSizes = pendingProduct?.sizes?.length > 0;
  const isSingleSize = pendingProduct?.sizes?.length === 1 && pendingProduct.sizes[0].size === 'One Size';

  const maxStock = selectedSize
    ? pendingProduct?.sizes?.find(s => s.size === selectedSize)?.stock || 99
    : 99;

  const clearPending = () => {
    useCartStore.setState({ pendingProduct: null });
    setSelectedSize('');
    setQuantity(1);
    setSizeError(false);
  };

  const handleAddToCart = () => {
    if (!pendingProduct) return;

    if (isSingleSize) {
      addItem(pendingProduct, 'One Size', quantity);
      clearPending();
      return;
    }

    if (!selectedSize) {
      setSizeError(true);
      return;
    }

    addItem(pendingProduct, selectedSize, quantity);
    clearPending();
  };

  const handleCheckout = () => {
    closeCart();
    navigate('/checkout');
  };

  const effectivePrice = (product) => product.salePrice || product.price;
  const cartTotal = getCartTotal();
  const cartCount = getCartCount();
  const cartProductIds = [...new Set(items.map((item) => item.product._id))];

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
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-bold text-gray-900">Cart</h2>
            {cartCount > 0 && (
              <span className="text-sm text-gray-500">({cartCount} item{cartCount !== 1 ? 's' : ''})</span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close cart"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Pending Product - Size & Quantity Selection */}
        {pendingProduct && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <div className="flex gap-4">
              <img
                src={pendingProduct.images?.[0] || '/placeholder.jpg'}
                alt={pendingProduct.name}
                className="w-20 h-20 object-cover rounded-xl bg-gray-100"
                width={80}
                height={80}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {pendingProduct.team || pendingProduct.sport}
                </p>
                <h3 className="font-semibold text-gray-900 text-sm truncate">
                  {toTitleCase(pendingProduct.name)}
                </h3>
                <p className="text-sm font-bold text-gray-900 mt-1">
                  ₱{effectivePrice(pendingProduct)?.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-4">
              {/* Size Selector (skip for One Size) */}
              {hasSizes && !isSingleSize && (
                <>
                  <p className={`text-sm font-medium mb-2 ${sizeError ? 'text-accent-500' : 'text-gray-700'}`}>
                    {sizeError ? 'Please select a size' : 'Select Size'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pendingProduct.sizes.map((s) => (
                      <button
                        key={s.size}
                        onClick={() => {
                          setSelectedSize(s.size);
                          setSizeError(false);
                        }}
                        disabled={s.stock === 0}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          selectedSize === s.size
                            ? 'border-primary-600 bg-primary-600 text-white'
                            : s.stock === 0
                            ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                            : 'border-gray-200 text-gray-700 hover:border-primary-600'
                        }`}
                      >
                        {s.size}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Quantity Selector */}
              <div className={hasSizes && !isSingleSize ? 'mt-4' : ''}>
                <p className="text-sm font-medium text-gray-700 mb-2">Quantity</p>
                <div className="inline-flex items-center border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="p-2.5 hover:bg-gray-50 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <MinusIcon className="w-4 h-4 text-gray-500" />
                  </button>
                  <span className="px-5 text-sm font-semibold min-w-[3rem] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(maxStock, q + 1))}
                    className="p-2.5 hover:bg-gray-50 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <PlusIcon className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="btn-primary w-full mt-4 text-sm"
              >
                Add to Cart
              </button>
            </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 && !pendingProduct ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg mb-2">Your cart is empty</p>
              <p className="text-gray-400 text-sm">Add items to get started</p>
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
                          className="p-1.5 hover:bg-gray-50 transition-colors"
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
