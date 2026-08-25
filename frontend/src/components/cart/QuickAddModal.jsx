import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import useCartStore from '../../store/cartStore';
import Modal from '../ui/Modal';
import { toTitleCase } from '../../utils/text';

// Shelved — see the matching flag in ProductDetail.jsx: most products have
// exactly one color variant today, so the picker is dead UI more often than
// not. Selection still auto-picks the first in-stock color internally.
const COLOR_SELECTOR_ENABLED = false;

/**
 * A lightweight version of ProductDetail.jsx's own buying panel (same
 * color-swatch/size-button/quantity-stepper conventions), surfaced as a
 * modal so a fan can pick a real size from a product-card context (Home,
 * Products, Virtual Try-On) without leaving the page or losing their place
 * in a grid/carousel. "View full details" still links out to the real page
 * for anyone who wants photos, reviews, or a size chart.
 */
const QuickAddModal = () => {
  const { quickAddProduct: product, closeQuickAdd, addItem, openCart } = useCartStore();

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  // Auto-select the first in-stock color/size on open — mirrors
  // ProductDetail.jsx's own initial-selection logic — so there's usually
  // just one confirming click, while still leaving the choice visible and
  // changeable rather than adding silently.
  useEffect(() => {
    if (!product) return;
    setQuantity(1);
    setError('');
    if (product.colors?.length > 0) {
      const firstInStock = product.colors.find((c) => c.sizes.some((s) => s.stock > 0));
      const col = firstInStock || product.colors[0];
      setSelectedColor(col.color);
      const inStock = col.sizes.find((s) => s.stock > 0);
      setSelectedSize(inStock ? inStock.size : col.sizes[0]?.size || '');
    } else {
      setSelectedColor(null);
      const inStock = product.sizes?.find((s) => s.stock > 0);
      setSelectedSize(inStock ? inStock.size : product.sizes?.[0]?.size || '');
    }
  }, [product]);

  if (!product) return null;

  const hasColors = product.colors?.length > 0;
  const availableSizes = hasColors
    ? product.colors.find((c) => c.color === selectedColor)?.sizes || []
    : product.sizes || [];
  const isSingleSize = availableSizes.length === 1 && availableSizes[0].size === 'One Size';
  const selectedStock = availableSizes.find((s) => s.size === selectedSize)?.stock || 0;
  const effectivePrice = product.salePrice || product.price;

  const handleAddToCart = () => {
    if (hasColors && !selectedColor) {
      setError('Please select a color');
      return;
    }
    if (availableSizes.length > 0 && !selectedSize) {
      setError('Please select a size');
      return;
    }
    if (availableSizes.length > 0 && selectedStock < quantity) {
      setError('Not enough stock available');
      return;
    }

    addItem(product, selectedSize || 'One Size', quantity, selectedColor);
    closeQuickAdd();
    openCart();
  };

  return (
    <Modal open={!!product} onClose={closeQuickAdd} size="md">
      <div className="p-6">
        <div className="flex gap-4">
          <img
            src={product.images?.[0] || '/placeholder.jpg'}
            alt={product.name}
            className="w-24 h-24 object-cover rounded-xl bg-gray-100 flex-shrink-0"
            width={96}
            height={96}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              {product.team || product.sport}
            </p>
            <h3 className="font-semibold text-gray-900 leading-tight">
              {toTitleCase(product.name)}
            </h3>
            <p className="text-base font-bold text-gray-900 mt-1">
              ₱{effectivePrice?.toLocaleString()}
            </p>
          </div>
        </div>

        <hr className="border-gray-200 my-5" />

        {/* Color Selection */}
        {COLOR_SELECTOR_ENABLED && hasColors && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Color</h4>
              {selectedColor && <span className="text-xs text-gray-400">{selectedColor}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => {
                const colorInStock = c.sizes.some((s) => s.stock > 0);
                return (
                  <button
                    key={c._id || c.color}
                    onClick={() => {
                      setSelectedColor(c.color);
                      const inStock = c.sizes.find((s) => s.stock > 0);
                      setSelectedSize(inStock ? inStock.size : c.sizes[0]?.size || '');
                      setError('');
                    }}
                    disabled={!colorInStock}
                    title={c.color}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedColor === c.color
                        ? 'border-primary-600 ring-2 ring-primary-600 ring-offset-2'
                        : !colorInStock
                        ? 'border-gray-200 opacity-30 cursor-not-allowed'
                        : 'border-gray-200 hover:border-primary-600'
                    }`}
                    style={c.hex ? { backgroundColor: c.hex } : undefined}
                  >
                    {!c.hex && <span className="text-[10px] font-medium text-gray-600">{c.color.slice(0, 2)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size Selection */}
        {availableSizes.length > 0 && !isSingleSize && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Size</h4>
              {selectedSize && <span className="text-xs text-gray-400">{selectedStock} in stock</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((s) => {
                const unavailable = s.stock === 0;
                const isSelected = selectedSize === s.size;
                return (
                  <button
                    key={s.size}
                    onClick={() => { if (!unavailable) { setSelectedSize(s.size); setError(''); setQuantity(1); } }}
                    disabled={unavailable}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      isSelected
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : unavailable
                        ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                        : 'border-gray-200 text-gray-700 hover:border-primary-600'
                    }`}
                  >
                    {s.size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity + Add to Cart share one row — the stepper stays a fixed
            width, the button fills whatever's left. */}
        <div className="mb-2">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Quantity</h4>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center border border-gray-200 rounded-lg flex-shrink-0">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="p-2.5 hover:bg-gray-50 transition-colors"
                aria-label="Decrease quantity"
              >
                <MinusIcon className="w-4 h-4 text-gray-500" />
              </button>
              <span className="px-5 text-sm font-semibold min-w-[3rem] text-center">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(selectedStock || 99, q + 1))}
                disabled={availableSizes.length > 0 && quantity >= selectedStock}
                className="p-2.5 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Increase quantity"
              >
                <PlusIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <button onClick={handleAddToCart} className="btn-primary flex-1">
              Add to Cart
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-accent-500 mt-2">{error}</p>}

        <Link
          to={`/products/${product.slug}`}
          onClick={closeQuickAdd}
          className="block text-center text-sm text-gray-500 hover:text-gray-900 underline underline-offset-2 mt-3"
        >
          View full details
        </Link>
      </div>
    </Modal>
  );
};

export default QuickAddModal;
