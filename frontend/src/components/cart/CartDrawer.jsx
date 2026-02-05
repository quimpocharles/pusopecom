import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { XMarkIcon, MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import useCartStore from '../../store/cartStore';

const CartDrawer = ({ isOpen, onClose, pendingProduct }) => {
  const { items, addItem, removeItem, updateQuantity, getCartTotal } = useCartStore();
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);

  // Reset size and quantity when a new product opens the drawer
  useEffect(() => {
    if (pendingProduct) {
      setSelectedSize('');
      setQuantity(1);
      setSizeError(false);
    }
  }, [pendingProduct]);

  const hasSizes = pendingProduct?.sizes?.length > 0;
  const isSingleSize = pendingProduct?.sizes?.length === 1 && pendingProduct.sizes[0].size === 'One Size';

  // Max stock for the selected size
  const maxStock = selectedSize
    ? pendingProduct?.sizes?.find(s => s.size === selectedSize)?.stock || 99
    : 99;

  const handleAddToCart = () => {
    if (!pendingProduct) return;

    if (isSingleSize) {
      addItem(pendingProduct, 'One Size', quantity);
      return;
    }

    if (!selectedSize) {
      setSizeError(true);
      return;
    }

    addItem(pendingProduct, selectedSize, quantity);
    setSelectedSize('');
    setQuantity(1);
    setSizeError(false);
  };

  const effectivePrice = (product) => product.salePrice || product.price;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
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
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {pendingProduct.team || pendingProduct.sport}
                </p>
                <h3 className="font-semibold text-gray-900 text-sm truncate">
                  {pendingProduct.name}
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
                  >
                    <MinusIcon className="w-4 h-4 text-gray-500" />
                  </button>
                  <span className="px-5 text-sm font-semibold min-w-[3rem] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(maxStock, q + 1))}
                    className="p-2.5 hover:bg-gray-50 transition-colors"
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
              {items.map((item, index) => (
                <div key={`${item.product._id}-${item.size}`} className="flex gap-4">
                  <img
                    src={item.product.images?.[0] || '/placeholder.jpg'}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-xl bg-gray-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm truncate">
                      {item.product.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">Size: {item.size}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      ₱{item.price?.toLocaleString()}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-gray-200 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.product._id, item.size, item.quantity - 1)}
                          className="p-1.5 hover:bg-gray-50 transition-colors"
                        >
                          <MinusIcon className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <span className="px-3 text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product._id, item.size, item.quantity + 1)}
                          className="p-1.5 hover:bg-gray-50 transition-colors"
                        >
                          <PlusIcon className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.product._id, item.size)}
                        className="p-1.5 text-gray-400 hover:text-accent-500 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="text-xl font-bold text-gray-900">
                ₱{getCartTotal().toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-gray-400">Shipping calculated at checkout</p>
            <Link
              to="/cart"
              onClick={onClose}
              className="btn-primary w-full text-center"
            >
              View Cart & Checkout
            </Link>
            <button
              onClick={onClose}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 font-medium py-2"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;
