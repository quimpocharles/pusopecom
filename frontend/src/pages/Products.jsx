import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import ProductCard from '../components/products/ProductCard';
import CartDrawer from '../components/cart/CartDrawer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import productService from '../services/productService';

const sportFilters = [
  { value: 'basketball', label: 'Basketball' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'football', label: 'Football' },
];

const categoryFilters = [
  { value: 'jersey', label: 'Jerseys' },
  { value: 'tshirt', label: 'T-Shirts' },
  { value: 'cap', label: 'Caps' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'accessories', label: 'Accessories' },
];

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);

  const sport = searchParams.get('sport') || '';
  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const page = searchParams.get('page') || '1';

  const hasFilters = sport || category;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = {
          ...(sport && { sport }),
          ...(category && { category }),
          ...(search && { search }),
          page,
          limit: 12,
        };
        const response = await productService.getProducts(params);
        setProducts(response.data);
        setPagination(response.pagination);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [sport, category, search, page]);

  const toggleFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    // Toggle: if already selected, remove it; otherwise set it
    if (newParams.get(key) === value) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    const newParams = new URLSearchParams();
    if (search) newParams.set('search', search);
    setSearchParams(newParams);
  };

  const handleBuyNow = (product) => {
    setPendingProduct(product);
    setCartOpen(true);
  };

  return (
    <Layout>
      <div className="container-custom py-6 md:py-10">
        {/* Page Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-display-sm font-bold">
            {search ? `Results for "${search}"` : 'Shop All'}
          </h1>
        </div>

        {/* Filter Buttons */}
        <div className="mb-8 md:mb-10 space-y-4">
          {/* Sport Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Sport</span>
            {sportFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => toggleFilter('sport', f.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                  sport === f.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Type</span>
            {categoryFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => toggleFilter('category', f.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                  category === f.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Active filters + Clear */}
          {hasFilters && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-gray-500">{pagination.total || 0} results</span>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium ml-2"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : products.length > 0 ? (
          <>
            {!hasFilters && (
              <p className="text-sm text-gray-500 mb-4">{pagination.total || 0} products</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} onBuyNow={handleBuyNow} />
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('page', p.toString());
                      setSearchParams(newParams);
                    }}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-all duration-200 ${
                      Number(page) === p
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-4">No products found</p>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-secondary">
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => {
          setCartOpen(false);
          setPendingProduct(null);
        }}
        pendingProduct={pendingProduct}
      />
    </Layout>
  );
};

export default Products;
