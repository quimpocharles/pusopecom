import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { XMarkIcon, ChevronDownIcon, MagnifyingGlassIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import ProductCard from '../components/products/ProductCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/ui/Pagination';
import useCartStore from '../store/cartStore';
import productService from '../services/productService';
import activityService from '../services/activityService';
import { toTitleCase } from '../utils/text';
import SEO from '../components/common/SEO';

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
  { key: 'sport', label: 'Sport', options: sportFilters },
  { key: 'category', label: 'Type', options: categoryFilters },
];

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'most-bought', label: 'Most Bought' },
  { value: 'trending', label: 'Trending' },
];

// Top-level identity tabs — replaces the old navbar's Shop All/Men/Women/
// Youth/Sale links, moved into the page's own landing area instead
// (EDITORIAL_LAYOUT_SYSTEM.md § Product Grid: category switches belong to
// the page they govern, not a persistent global bar).
const topTabs = [
  { key: 'all', label: 'Shop All' },
  { key: 'men', label: 'Men' },
  { key: 'women', label: 'Women' },
  { key: 'youth', label: 'Youth' },
  { key: 'sale', label: 'Sale' },
];

const Products = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const openQuickAdd = useCartStore((state) => state.openQuickAdd);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(() => !!searchParams.get('search'));
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const filtersRef = useRef(null);
  const sortRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Close any open dropdown on an outside click — a pointerdown listener so
  // the close happens before the option button's own click handler fires.
  useEffect(() => {
    if (!showFilters && !showSort && !showSearchBox) return;
    const handlePointerDown = (e) => {
      if (showFilters && filtersRef.current && !filtersRef.current.contains(e.target)) {
        setShowFilters(false);
      }
      if (showSort && sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSort(false);
      }
      if (showSearchBox && searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchBox(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showFilters, showSort, showSearchBox]);

  const gender = searchParams.get('gender') || '';
  const sport = searchParams.get('sport') || '';
  const league = searchParams.get('league') || '';
  const team = searchParams.get('team') || '';
  const category = searchParams.get('category') || '';
  const sale = searchParams.get('sale') || '';
  const search = searchParams.get('search') || '';
  const page = searchParams.get('page') || '1';
  const sort = searchParams.get('sort') || 'newest';

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
          ...(league && { league }),
          ...(team && { team }),
          ...(category && { category }),
          ...(sale && { sale }),
          ...(search && { search }),
          sort,
          page,
          limit: 24,
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
  }, [gender, sport, league, team, category, sale, search, sort, page]);

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

  const setSort = (value) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', value);
    newParams.set('page', '1');
    setSearchParams(newParams);
    setShowSort(false);
  };

  const clearFilters = () => {
    const newParams = new URLSearchParams();
    if (search) newParams.set('search', search);
    setSearchParams(newParams);
  };

  // Active top tab is derived from gender/sale, never stored separately —
  // one source of truth so the URL and the tab row can never disagree.
  const activeTab = sale ? 'sale' : ['men', 'women', 'youth'].includes(gender) ? gender : 'all';

  const setTopTab = (key) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('gender');
    newParams.delete('sale');
    if (key === 'men' || key === 'women' || key === 'youth') {
      newParams.set('gender', key);
    } else if (key === 'sale') {
      newParams.set('sale', 'true');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleBuyNow = (product) => {
    openQuickAdd(product);
  };

  // ── Search handlers — same pattern the header's search used to run
  // (debounced suggestions, keyboard nav), now scoped to this page's own
  // `search` param instead of navigating here from elsewhere.
  const openSearchBox = () => {
    setShowFilters(false);
    setShowSort(false);
    setShowSearchBox(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const closeSearchBox = () => {
    setShowSearchBox(false);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      navigate(`/products/${suggestions[selectedIndex].slug}`);
      return;
    }
    const newParams = new URLSearchParams(searchParams);
    if (searchTerm.trim()) {
      activityService.trackSearch(searchTerm.trim());
      newParams.set('search', searchTerm.trim());
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSelectedIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await productService.getSearchSuggestions(value.trim(), {
          ...(sport && { sport }),
          ...(league && { league }),
          ...(team && { team }),
          ...(category && { category }),
          ...(gender && { gender }),
          ...(sale && { sale }),
        });
        setSuggestions(res.data);
        setShowSuggestions(res.data.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') { closeSearchBox(); return; }
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, -1)); }
  };

  return (
    <Layout>
      <SEO
        title={search ? `Results for "${search}"` : sale ? 'Sale Items' : activeTab !== 'all' ? `Shop ${topTabs.find(t => t.key === activeTab)?.label}` : 'All Products'}
        description={search ? `Search results for "${search}" at Puso Pilipinas` : 'Browse authentic Philippine sports merchandise — jerseys, apparel, and accessories.'}
      />
      <div className="container-custom py-6 md:py-10">
        {/* Display headline — a real editorial arrival before the grid,
            not just a utilitarian label (EDITORIAL_DESIGN_LANGUAGE.md § Emotional Goals). */}
        <h1 className="text-4xl md:text-editorial-display font-bold text-ink-900 uppercase leading-none mb-6 md:mb-8">
          {search ? `Results for "${search}"` : sale ? 'Sale' : activeTab !== 'all' ? `Shop ${topTabs.find(t => t.key === activeTab)?.label}` : 'All Products'}
        </h1>

        {/* Top tabs — replaces the old navbar's Shop All/Men/Women/Youth/Sale
            links; lives in the landing area it governs instead of a global bar. */}
        <div className="flex items-center gap-6 mb-8 md:mb-12 border-b-2 border-ink-200 overflow-x-auto scrollbar-hide">
          {topTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTopTab(tab.key)}
              className={`pb-3 text-editorial-label font-semibold uppercase tracking-wide whitespace-nowrap transition-colors duration-150 border-b-2 -mb-0.5 ${
                activeTab === tab.key
                  ? 'text-ink-900 border-ink-900'
                  : 'text-ink-500 border-transparent hover:text-ink-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Secondary controls row — Filters / Sort By as a pair of bordered
            dropdown buttons (structural pattern only: our own tokens for
            color/type/radius, not the reference's). No product-count text —
            it only ate up space, especially on mobile where it pushed the
            controls toward overflow. */}
        <div className="flex items-center justify-end gap-3 mb-8 md:mb-10">
          {/* Filters + Sort By collapse into a single overflow icon on
              mobile while search is expanded — otherwise all three fight
              for the same narrow row. */}
          <div className={`items-center gap-3 ${showSearchBox ? 'hidden md:flex' : 'flex'}`}>
            {/* Filters */}
            <div className="relative" ref={filtersRef}>
              <button
                onClick={() => { setShowFilters(!showFilters); setShowSort(false); closeSearchBox(); }}
                className={`inline-flex items-center justify-between gap-8 px-5 py-2.5 border-2 border-ink-900 text-editorial-label font-bold uppercase tracking-wide transition-colors duration-150 ${
                  showFilters || hasFilters ? 'bg-ink-900 text-white' : 'bg-white text-ink-900'
                }`}
              >
                Filters
                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-150 ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              {showFilters && (
                <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border-2 border-ink-900 z-20 p-5 space-y-5">
                  {filterGroups.map((group) => {
                    const selected = getSelectedValues(searchParams.get(group.key));
                    return (
                      <div key={group.key}>
                        <p className="text-editorial-label font-bold text-ink-900 uppercase mb-2.5">{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.options.map((f) => {
                            const isActive = selected.includes(f.value);
                            return (
                              <button
                                key={f.value}
                                onClick={() => toggleFilter(group.key, f.value)}
                                className={`px-3 py-1.5 text-editorial-label font-medium border-2 transition-colors duration-150 ${
                                  isActive
                                    ? 'bg-ink-900 text-white border-ink-900'
                                    : 'bg-white text-ink-700 border-ink-200 hover:border-ink-900'
                                }`}
                              >
                                {f.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {hasFilters && (
                    <button onClick={clearFilters} className="flex items-center gap-1 text-editorial-label font-semibold text-ink-500 hover:text-ink-900 transition-colors">
                      <XMarkIcon className="w-3.5 h-3.5" />
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sort By */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => { setShowSort(!showSort); setShowFilters(false); closeSearchBox(); }}
                className="inline-flex items-center justify-between gap-8 px-5 py-2.5 border-2 border-ink-900 bg-white text-ink-900 text-editorial-label font-bold uppercase tracking-wide transition-colors duration-150"
              >
                Sort By
                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-150 ${showSort ? 'rotate-180' : ''}`} />
              </button>
              {showSort && (
                <div className="absolute left-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white border-2 border-ink-900 z-20 py-2">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSort(opt.value)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-editorial-label text-ink-900 hover:bg-ink-200/40 transition-colors"
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${sort === opt.value ? 'border-ink-900' : 'border-ink-200'}`}>
                        {sort === opt.value && <span className="w-2 h-2 rounded-full bg-ink-900" />}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Overflow icon — mobile only, replaces Filters/Sort By while
              search is expanded; tapping it (or the outside-click handler
              below) collapses search and brings the two buttons back. */}
          {showSearchBox && (
            <button
              onClick={closeSearchBox}
              className="md:hidden flex items-center justify-center p-2.5 border-2 border-ink-900 bg-white text-ink-900"
              aria-label="Show filter and sort options"
            >
              <EllipsisHorizontalIcon className="w-4 h-4" />
            </button>
          )}

          {/* Search — collapses to an icon-only card, expands to an
                input on click, matching the Filters/Sort By card treatment.
                Fills the rest of the row on mobile so it and the overflow
                icon span edge-to-edge instead of floating with a gap. */}
            <div className={`relative ${showSearchBox ? 'flex-1 md:flex-initial' : ''}`} ref={searchRef}>
              {showSearchBox ? (
                <form onSubmit={handleSearchSubmit} className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={handleSearchInput}
                    onKeyDown={handleSearchKeyDown}
                    aria-label="Search products"
                    className="w-full md:w-72 pl-4 pr-9 py-2.5 border-2 border-ink-900 text-editorial-label text-ink-900 placeholder-ink-500 bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      if (search) {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete('search');
                        newParams.set('page', '1');
                        setSearchParams(newParams);
                      }
                      closeSearchBox();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={openSearchBox}
                  className={`flex items-center justify-center p-2.5 border-2 border-ink-900 transition-colors duration-150 ${
                    search ? 'bg-ink-900 text-white' : 'bg-white text-ink-900'
                  }`}
                  aria-label="Search"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </button>
              )}

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border-2 border-ink-900 z-20 py-2 max-h-80 overflow-y-auto">
                  {suggestions.map((item, i) => (
                    <button
                      key={item.slug}
                      onClick={() => {
                        navigate(`/products/${item.slug}`);
                        closeSearchBox();
                        setSearchTerm('');
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${selectedIndex === i ? 'bg-ink-200/40' : 'hover:bg-ink-200/40'}`}
                    >
                      {item.image && (
                        <img src={item.image} alt="" className="w-10 h-10 object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-editorial-label font-medium text-ink-900 truncate">{toTitleCase(item.name)}</p>
                        <p className="text-editorial-label text-ink-500">
                          {item.salePrice ? (
                            <>
                              <span className="text-merch-sale font-semibold">₱{item.salePrice.toLocaleString()}</span>
                              <span className="line-through ml-1 text-ink-500">₱{item.price.toLocaleString()}</span>
                            </>
                          ) : (
                            <span className="font-semibold text-ink-900">₱{item.price.toLocaleString()}</span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} onBuyNow={handleBuyNow} />
              ))}
            </div>

            <Pagination
              page={Number(page)}
              totalPages={pagination.pages || 0}
              onPageChange={(p) => {
                const newParams = new URLSearchParams(searchParams);
                newParams.set('page', p.toString());
                setSearchParams(newParams);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="mt-10"
            />
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-ink-500 text-editorial-body mb-4">No products found</p>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-secondary">
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

    </Layout>
  );
};

export default Products;
