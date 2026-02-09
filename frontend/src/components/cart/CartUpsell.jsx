import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import productService from '../../services/productService';
import useCartStore from '../../store/cartStore';

const CartUpsell = ({ cartProductIds }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (cartProductIds.length === 0) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;
    const fetchRecs = async () => {
      setLoading(true);
      try {
        const res = await productService.getCartRecommendations(cartProductIds, 4);
        if (!cancelled) setRecommendations(res.data || []);
      } catch {
        if (!cancelled) setRecommendations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRecs();
    return () => { cancelled = true; };
  }, [cartProductIds.join(',')]);

  const handleAdd = (product) => {
    // Pick the first available size
    let size = null;
    let color = null;

    if (product.colors?.length > 0) {
      const colorObj = product.colors.find(c => c.sizes.some(s => s.stock > 0));
      if (colorObj) {
        color = colorObj.color;
        const sizeObj = colorObj.sizes.find(s => s.stock > 0);
        size = sizeObj?.size;
      }
    } else if (product.sizes?.length > 0) {
      const sizeObj = product.sizes.find(s => s.stock > 0);
      size = sizeObj?.size;
    }

    if (!size) return;
    addItem(product, size, 1, color);
  };

  if (loading || recommendations.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Buy it with</p>
      <div className="space-y-3">
        {recommendations.map((product) => {
          const price = product.salePrice || product.price;
          return (
            <div key={product._id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <Link
                  to={`/products/${product.slug}`}
                  className="text-sm font-semibold text-gray-900 hover:text-primary-600 block truncate"
                >
                  {product.name}
                </Link>
                <p className="text-sm text-gray-500 mt-0.5">
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
              <button
                onClick={() => handleAdd(product)}
                className="flex-shrink-0 bg-primary-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap"
              >
                Add - ₱{price.toLocaleString()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CartUpsell;
