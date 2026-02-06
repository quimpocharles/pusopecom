import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import ProductCard from '../components/products/ProductCard';
import CartDrawer from '../components/cart/CartDrawer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import productService from '../services/productService';
import SEO from '../components/common/SEO';

const genderFilters = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'youth', label: 'Youth' },
  { value: 'unisex', label: 'Unisex' },
];

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

const filterGroups = [
  { key: 'gender', label: 'Gender', options: genderFilters },
  { key: 'sport', label: 'Sport', options: sportFilters },
  { key: 'category', label: 'Type', options: categoryFilters },
];

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [openFilterGroup, setOpenFilterGroup] = useState(null);

  const gender = searchParams.get('gender') || '';
  const sport = searchParams.get('sport') || '';
  const category = searchParams.get('category') || '';
  const sale = searchParams.get('sale') || '';
  const search = searchParams.get('search') || '';
  const page = searchParams.get('page') || '1';

  // Helper to get array of selected values from a comma-separated param
  const getSelectedValues = (param) => param ? param.split(',') : [];

  const hasFilters = gender || sport || category || sale;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = {
          ...(gender && { gender }),
          ...(sport && { sport }),
          ...(category && { category }),
          ...(sale && { sale }),
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
  }, [gender, sport, category, sale, search, page]);

  const toggleFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    const current = newParams.get(key);
    const values = current ? current.split(',') : [];

    if (values.includes(value)) {
      // Remove this value
      const updated = values.filter(v => v !== value);
      if (updated.length > 0) {
        newParams.set(key, updated.join(','));
      } else {
        newParams.delete(key);
      }
    } else {
      // Add this value
      values.push(value);
      newParams.set(key, values.join(','));
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
      <SEO
        title={search ? `Results for "${search}"` : sale ? 'Sale Items' : [gender, sport, category].filter(Boolean).join(' ').trim() || 'Shop All'}
        description={search ? `Search results for "${search}" at Puso Pilipinas` : 'Browse authentic Philippine sports merchandise — jerseys, apparel, and accessories.'}
      />
      <div className="container-custom py-6 md:py-10">
        {/* Page Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-display-sm font-bold">
            {search ? `Results for "${search}"` : sale ? 'Sale' : 'Shop All'}
          </h1>
        </div>

        {/* Filter Bar */}
        <div className="mb-8 md:mb-10 space-y-3">
          {/* Category labels row */}
          <div className="flex flex-wrap items-center gap-2">
            {filterGroups.map((group) => {
              const selected = getSelectedValues(searchParams.get(group.key));
              const count = selected.length;
              const isOpen = openFilterGroup === group.key;
              return (
                <button
                  key={group.key}
                  onClick={() => setOpenFilterGroup(isOpen ? null : group.key)}
                  className={`inline-flex items-center justify-between gap-3 min-w-[7rem] px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
                    isOpen
                      ? 'bg-gray-900 text-white border-gray-900'
                      : count > 0
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <span>{group.label}</span>
                  <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                    isOpen
                      ? 'bg-white text-gray-900'
                      : count > 0
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Clear filters */}
            {hasFilters && (
              <>
                <span className="text-sm text-gray-400 ml-1">{pagination.total || 0} results</span>
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                  Clear
                </button>
              </>
            )}
          </div>

          {/* Expanded options row */}
          {openFilterGroup && (
            <div className="flex flex-wrap items-center gap-2 animate-slide-down">
              {filterGroups.find(g => g.key === openFilterGroup)?.options.map((f) => {
                const selected = getSelectedValues(searchParams.get(openFilterGroup));
                const isActive = selected.includes(f.value);
                return (
                  <button
                    key={f.value}
                    onClick={() => toggleFilter(openFilterGroup, f.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
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
