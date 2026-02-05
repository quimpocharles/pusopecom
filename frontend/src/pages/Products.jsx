import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import ProductCard from '../components/products/ProductCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import productService from '../services/productService';

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});

  const sport = searchParams.get('sport') || '';
  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const page = searchParams.get('page') || '1';

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = {
          ...(sport && { sport }),
          ...(category && { category }),
          ...(search && { search }),
          page
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

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  return (
    <Layout>
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold mb-8">
          {search ? `Search results for "${search}"` : 'All Products'}
        </h1>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="card p-6 sticky top-24">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg">Filters</h2>
                {(sport || category) && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Sport Filter */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Sport</h3>
                <div className="space-y-2">
                  {['basketball', 'volleyball', 'football', 'general'].map((s) => (
                    <label key={s} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="sport"
                        checked={sport === s}
                        onChange={() => handleFilterChange('sport', s)}
                        className="mr-2"
                      />
                      <span className="capitalize">{s}</span>
                    </label>
                  ))}
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="sport"
                      checked={sport === ''}
                      onChange={() => handleFilterChange('sport', '')}
                      className="mr-2"
                    />
                    <span>All Sports</span>
                  </label>
                </div>
              </div>

              {/* Category Filter */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Category</h3>
                <div className="space-y-2">
                  {['jersey', 'tshirt', 'cap', 'shorts', 'accessories'].map((c) => (
                    <label key={c} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="category"
                        checked={category === c}
                        onChange={() => handleFilterChange('category', c)}
                        className="mr-2"
                      />
                      <span className="capitalize">{c}</span>
                    </label>
                  ))}
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="category"
                      checked={category === ''}
                      onChange={() => handleFilterChange('category', '')}
                      className="mr-2"
                    />
                    <span>All Categories</span>
                  </label>
                </div>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {loading ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="mb-4 text-gray-600">
                  {pagination.total || 0} products found
                </div>

                {products.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {products.map((product) => (
                        <ProductCard key={product._id} product={product} />
                      ))}
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                      <div className="flex justify-center gap-2 mt-8">
                        {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            onClick={() => handleFilterChange('page', p.toString())}
                            className={`px-4 py-2 rounded ${
                              Number(page) === p
                                ? 'bg-primary-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No products found</p>
                    <button
                      onClick={clearFilters}
                      className="btn-secondary mt-4"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Products;
