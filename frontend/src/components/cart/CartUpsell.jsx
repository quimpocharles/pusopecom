import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import productService from '../../services/productService';
import useCartStore from '../../store/cartStore';
import { toTitleCase } from '../../utils/text';

const CartUpsell = ({ cartProductIds }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  // Per-product selection state: { [productId]: { color, size } }
  const [selections, setSelections] = useState({});
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);

  useEffect(() => {
    if (cartProductIds.length === 0) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;
    const fetchRecs = async () => {
      setLoading(true);
      try {
        const res = await productService.getCartRecommendations(cartProductIds, 3);
        if (!cancelled) {
          const prods = res.data || [];
          setRecommendations(prods);
          // Pre-select color for color-variant products (first color with stock)
          const initial = {};
          prods.forEach((p) => {
            if (p.colors?.length > 0) {
              const firstColor = p.colors.find((c) => c.sizes.some((s) => s.stock > 0));
              initial[p._id] = { color: firstColor?.color || null, size: null };
            } else {
              initial[p._id] = { color: null, size: null };
            }
          });
          setSelections(initial);
        }
      } catch {
        if (!cancelled) setRecommendations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRecs();
    return () => { cancelled = true; };
  }, [cartProductIds.join(',')]);

  const setColor = (productId, color) => {
    setSelections((prev) => ({ ...prev, [productId]: { color, size: null } }));
  };

  const setSize = (productId, size) => {
    setSelections((prev) => ({ ...prev, [productId]: { ...prev[productId], size } }));
  };

  const handleAdd = (product) => {
    const sel = selections[product._id] || {};
    if (!sel.size) return;
    const sizeStock = sel.color
      ? product.colors?.find((c) => c.color === sel.color)?.sizes.find((s) => s.size === sel.size)?.stock ?? 0
      : product.sizes?.find((s) => s.size === sel.size)?.stock ?? 0;
    const inCart = cartItems.find(
      (item) => item.product._id === product._id && item.size === sel.size && (item.color || null) === (sel.color || null)
    )?.quantity ?? 0;
    if (inCart >= sizeStock) return;
    addItem(product, sel.size, 1, sel.color || null);
  };

  // Get available sizes for a product given current color selection
  const getSizes = (product, selectedColor) => {
    if (product.colors?.length > 0) {
      const colorObj = product.colors.find((c) => c.color === selectedColor);
      return colorObj?.sizes || [];
    }
    return product.sizes || [];
  };

  if (loading || recommendations.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Buy it with</p>
      <div className="space-y-3">
        {recommendations.map((product) => {
          const price = product.salePrice || product.price;
          const sel = selections[product._id] || {};
          const hasColors = product.colors?.length > 0;
          const sizes = getSizes(product, sel.color);
          const canAdd = !!sel.size;

          return (
            <div key={product._id} className="card p-3 flex flex-col gap-2">
              {/* Top row: image + name/price */}
              <div className="flex items-center gap-3">
                <Link
                  to={`/products/${product.slug}`}
                  className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100"
                >
                  <img
                    src={product.images?.[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/products/${product.slug}`}
                    className="text-sm font-semibold text-gray-900 hover:text-primary-600 block truncate"
                  >
                    {toTitleCase(product.name)}
                  </Link>
                  <p className="text-sm mt-0.5">
                    {product.salePrice ? (
                      <>
                        <span className="text-primary-600 font-semibold">₱{product.salePrice.toLocaleString()}</span>
                        <span className="line-through ml-1 text-gray-400">₱{product.price.toLocaleString()}</span>
                      </>
                    ) : (
                      <span className="font-semibold">₱{product.price.toLocaleString()}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Color swatches (if variant product) */}
              {hasColors && (
                <div className="flex flex-wrap gap-1.5">
                  {product.colors.map((c) => {
                    const hasStock = c.sizes.some((s) => s.stock > 0);
                    return (
                      <button
                        key={c.color}
                        onClick={() => hasStock && setColor(product._id, c.color)}
                        disabled={!hasStock}
                        title={c.color}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          sel.color === c.color ? 'border-primary-600 scale-110' : 'border-gray-300'
                        } ${!hasStock ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                        style={{ backgroundColor: c.hex || '#ccc' }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Size chips */}
              <div className="flex flex-wrap gap-1.5">
                {sizes.map((s) => {
                  const inStock = s.stock > 0;
                  return (
                    <button
                      key={s.size}
                      onClick={() => inStock && setSize(product._id, s.size)}
                      disabled={!inStock}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                        sel.size === s.size
                          ? 'bg-primary-600 text-white border-primary-600'
                          : inStock
                          ? 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                          : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed line-through'
                      }`}
                    >
                      {s.size}
                    </button>
                  );
                })}
              </div>

              {/* Add button */}
              <button
                onClick={() => handleAdd(product)}
                disabled={!canAdd}
                className={`w-full text-xs font-semibold py-2 rounded-xl transition-colors ${
                  canAdd
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {canAdd ? `Add to Cart — ₱${price.toLocaleString()}` : 'Select a size'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CartUpsell;
