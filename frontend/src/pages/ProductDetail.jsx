import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  SparklesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  StarIcon as StarOutline,
  TruckIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import VirtualTryOn from '../components/products/VirtualTryOn';
import ShareButton from '../components/products/ShareButton';
import { TRYON_PRIMARY_BTN } from '../components/products/tryOn/tryOnButtonStyles';
import productService from '../services/productService';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import activityService from '../services/activityService';
import { toTitleCase } from '../utils/text';
import SEO from '../components/common/SEO';

// Star rating display component
const Stars = ({ rating, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star}>
          {rating >= star ? (
            <StarSolid className={`${sizeClass} text-yellow-400`} />
          ) : rating >= star - 0.5 ? (
            <StarSolid className={`${sizeClass} text-yellow-400 opacity-50`} />
          ) : (
            <StarOutline className={`${sizeClass} text-gray-300`} />
          )}
        </span>
      ))}
    </div>
  );
};

// Interactive star selector for review form
const StarSelect = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={() => onChange(star)}
        className="focus:outline-none"
      >
        {star <= value ? (
          <StarSolid className="w-6 h-6 text-yellow-400" />
        ) : (
          <StarOutline className="w-6 h-6 text-gray-300 hover:text-yellow-300" />
        )}
      </button>
    ))}
  </div>
);

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

// Shelved: almost every product today has exactly one color variant, so the
// swatch picker is dead UI more often than not. Selection/stock logic below
// still runs on the auto-picked first in-stock color regardless — only the
// picker itself is hidden. Flip back on once color variants are common
// enough to be worth a fan's attention.
const COLOR_SELECTOR_ENABLED = false;

// Returns the full size list to display, merging standard sizes with DB sizes.
// Sizes not in DB or with 0 stock are marked as unavailable.
const getDisplaySizes = (availableSizes) => {
  if (!availableSizes?.length) return [];
  const dbMap = new Map(availableSizes.map(s => [s.size, s.stock]));
  const extraSizes = availableSizes
    .map(s => s.size)
    .filter(s => !STANDARD_SIZES.includes(s));
  return [...STANDARD_SIZES, ...extraSizes].map(size => ({
    size,
    stock: dbMap.get(size) ?? 0,
  }));
};

const SIZE_CHARTS = {
  tops: {
    label: 'Tops (Jersey / T-Shirt)',
    headers: ['Size', 'Shoulder (in)', 'Chest (in)', 'Body Length (in)'],
    rows: [
      ['XS',  '16.5', '18.5', '26'],
      ['S',   '18',   '20.5', '27'],
      ['M',   '18.5', '21',   '27.5'],
      ['L',   '19.5', '22',   '28'],
      ['XL',  '20',   '23.5', '30'],
      ['2XL', '21',   '24',   '31.5'],
      ['3XL', '22.5', '25.5', '32'],
    ],
  },
  shorts: {
    label: 'Shorts',
    headers: ['Size', 'Waist (in)', 'Hips (in)', 'Length (in)'],
    rows: [
      ['XS',   '24–26', '32–34', '17'],
      ['S',    '27–29', '35–37', '18'],
      ['M',    '30–32', '38–40', '19'],
      ['L',    '33–35', '41–43', '20'],
      ['XL',   '36–38', '44–46', '21'],
      ['XXL',  '39–41', '47–49', '22'],
    ],
  },
  caps: {
    label: 'Caps',
    headers: ['Size', 'Head Circumference (cm)'],
    rows: [
      ['S/M',      '54–57'],
      ['L/XL',     '58–61'],
      ['One Size', 'Adjustable'],
    ],
  },
};

const getSizeChart = (category) => {
  if (category === 'shorts') return SIZE_CHARTS.shorts;
  if (category === 'cap') return SIZE_CHARTS.caps;
  return SIZE_CHARTS.tops;
};

const SizeChartModal = ({ category, onClose }) => {
  const chart = getSizeChart(category);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Size Guide</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-gray-500 mb-4">{chart.label} — all measurements are approximate.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {chart.headers.map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 first:rounded-l-lg last:rounded-r-lg">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className={`px-3 py-2.5 text-sm ${j === 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Tip: For jerseys, we recommend sizing up for a looser fit.
          </p>
        </div>
      </div>
    </div>
  );
};

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addItem = useCartStore((state) => state.addItem);
  const { user, isAuthenticated } = useAuthStore();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [addedToCart, setAddedToCart] = useState(false);
  const [showTryOn, setShowTryOn] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPagination, setReviewPagination] = useState({});
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', body: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await productService.getProductBySlug(slug);
        setProduct(response.data);
        activityService.trackView(response.data._id);
        const p = response.data;
        if (p.colors?.length > 0) {
          const firstInStock = p.colors.find(c => c.sizes.some(s => s.stock > 0));
          const col = firstInStock || p.colors[0];
          setSelectedColor(col.color);
          const inStock = col.sizes.find(s => s.stock > 0);
          setSelectedSize(inStock ? inStock.size : col.sizes[0]?.size || '');
        } else if (p.sizes.length > 0) {
          const inStock = p.sizes.find(s => s.stock > 0);
          setSelectedSize(inStock ? inStock.size : p.sizes[0].size);
        }
      } catch (err) {
        console.error('Failed to fetch product:', err);
        setError('Product not found');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [slug]);

  // Auto-opens Virtual Try-On when arriving via a `?tryOn=1` link — the
  // homepage AI Try-On section's CTA "links directly to the AI Try-On
  // experience" rather than just to the product page, without duplicating
  // the modal-mounting logic that already lives here.
  useEffect(() => {
    if (product?.tryOnEnabled && searchParams.get('tryOn') === '1') {
      setShowTryOn(true);
    }
  }, [product, searchParams]);

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await productService.getReviews(slug, { page: reviewPage, limit: 5 });
        setReviews(prev => reviewPage === 1 ? response.data : [...prev, ...response.data]);
        setReviewSummary(response.summary);
        setReviewPagination(response.pagination);
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
      }
    };
    if (slug) fetchReviews();
  }, [slug, reviewPage]);

  const handleAddToCart = () => {
    if (product.colors?.length > 0 && !selectedColor) {
      setError('Please select a color');
      return;
    }
    if (!selectedSize) {
      setError('Please select a size');
      return;
    }

    let sizeStock;
    if (product.colors?.length > 0 && selectedColor) {
      const colorObj = product.colors.find(c => c.color === selectedColor);
      sizeStock = colorObj?.sizes.find(s => s.size === selectedSize);
    } else {
      sizeStock = product.sizes.find(s => s.size === selectedSize);
    }

    if (!sizeStock || sizeStock.stock < quantity) {
      setError('Not enough stock available');
      return;
    }
    setError('');
    addItem(product, selectedSize, quantity, selectedColor);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewError('');
    try {
      await productService.createReview(slug, reviewForm);
      // Refresh reviews
      const response = await productService.getReviews(slug, { page: 1, limit: 5 });
      setReviews(response.data);
      setReviewSummary(response.summary);
      setReviewPagination(response.pagination);
      setReviewPage(1);
      setShowReviewForm(false);
      setReviewForm({ rating: 5, title: '', body: '' });
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const isTryOnEligible = product?.tryOnEnabled;

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20"><LoadingSpinner /></div>
      </Layout>
    );
  }

  if (error && !product) {
    return (
      <Layout>
        <div className="container-custom py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-700 mb-4">{error}</h1>
          <Link to="/products" className="btn-secondary">Back to Shop</Link>
        </div>
      </Layout>
    );
  }

  const effectivePrice = product.salePrice || product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;
  const hasColors = product.colors?.length > 0;
  const selectedColorObj = hasColors ? product.colors.find(c => c.color === selectedColor) : null;
  const availableSizes = hasColors && selectedColorObj ? selectedColorObj.sizes : product.sizes;
  const selectedSizeStock = availableSizes.find(s => s.size === selectedSize)?.stock || 0;
  const colorImage = selectedColorObj?.image;
  const displayImages = colorImage ? [colorImage, ...product.images.filter(img => img !== colorImage)] : product.images;
  const categoryLabel = { jersey: 'Jersey', tshirt: 'T-Shirt', cap: 'Cap', shorts: 'Shorts', accessories: 'Accessory' }[product.category] || product.category;
  const genderLabel = { men: "Men's", women: "Women's", youth: 'Youth', unisex: 'Unisex' }[product.gender] || '';

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    offers: {
      '@type': 'Offer',
      price: effectivePrice,
      priceCurrency: 'PHP',
      availability: product.totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    ...(product.reviewCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.avgRating,
        reviewCount: product.reviewCount,
      },
    }),
  };

  return (
    <Layout>
      <SEO
        title={toTitleCase(product.name)}
        description={product.description?.slice(0, 160)}
        ogImage={product.images?.[0]}
        ogType="product"
        jsonLd={productJsonLd}
      />
      {/* Back button + Breadcrumb */}
      <div className="container-custom pt-4 pb-2 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Back
        </button>
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link to="/" className="hover:text-gray-600">Home</Link>
          <ChevronRightIcon className="w-3 h-3" />
          <Link to="/products" className="hover:text-gray-600">Shop</Link>
          {product.gender && product.gender !== 'unisex' && (
            <>
              <ChevronRightIcon className="w-3 h-3" />
              <Link to={`/products?gender=${product.gender}`} className="hover:text-gray-600">
                {{ men: "Men's", women: "Women's", youth: 'Youth' }[product.gender]}
              </Link>
            </>
          )}
          <ChevronRightIcon className="w-3 h-3" />
          <span className="text-gray-600 truncate">{toTitleCase(product.name)}</span>
        </nav>
      </div>

      {/* Main Product Section */}
      <section className="container-custom pb-16 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16">

          {/* Left — Image Gallery */}
          <div>
            {/* Main Image */}
            <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3 relative">
              <img
                src={displayImages[selectedImage] || product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {isTryOnEligible && (
                <button
                  onClick={() => setShowTryOn(true)}
                  className={`${TRYON_PRIMARY_BTN} absolute bottom-4 left-4 gap-1.5 px-4 py-2`}
                >
                  <SparklesIcon className="w-4 h-4" />
                  Virtual Try-On
                </button>
              )}
            </div>

            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {displayImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                      selectedImage === index ? 'border-[#0a0a0a]' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img src={image} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right — Product Info */}
          <div className="lg:pt-2">
            {/* Team / Sport badge + Share */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {product.team || product.sport} &middot; {genderLabel && <>{genderLabel} &middot; </>}{categoryLabel}
              </p>
              <ShareButton
                title={product.name}
                text={`Check out ${toTitleCase(product.name)} on PusoStore!`}
                url={`${window.location.origin}/products/${product.slug}`}
              />
            </div>

            {/* Product Name */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-3">
              {toTitleCase(product.name)}
            </h1>

            {/* Rating summary */}
            {reviewSummary && reviewSummary.reviewCount > 0 && (
              <button
                onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 mb-4 group"
              >
                <Stars rating={reviewSummary.avgRating} size="md" />
                <span className="text-sm text-gray-500 group-hover:text-gray-900 transition-colors">
                  {reviewSummary.avgRating} ({reviewSummary.reviewCount} review{reviewSummary.reviewCount !== 1 ? 's' : ''})
                </span>
              </button>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-2xl md:text-3xl font-bold text-gray-900">
                ₱{effectivePrice.toLocaleString()}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    ₱{product.price.toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-accent-500">
                    Save {product.discountPercentage}%
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-8">
              {product.description}
            </p>

            {/* Divider */}
            <hr className="border-gray-200 mb-6" />

            {/* Color Selection */}
            {COLOR_SELECTOR_ENABLED && hasColors && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Color</h3>
                  {selectedColor && (
                    <span className="text-xs text-gray-400">{selectedColor}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((colorObj) => {
                    const colorInStock = colorObj.sizes.some(s => s.stock > 0);
                    return (
                      <button
                        key={colorObj._id}
                        onClick={() => {
                          setSelectedColor(colorObj.color);
                          setSelectedImage(0);
                          const inStock = colorObj.sizes.find(s => s.stock > 0);
                          setSelectedSize(inStock ? inStock.size : colorObj.sizes[0]?.size || '');
                          setQuantity(1);
                          setError('');
                        }}
                        disabled={!colorInStock}
                        title={colorObj.color}
                        className={`w-10 h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                          selectedColor === colorObj.color
                            ? 'border-[#0a0a0a] ring-2 ring-[#0a0a0a] ring-offset-2'
                            : !colorInStock
                            ? 'border-gray-200 opacity-30 cursor-not-allowed'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                        style={colorObj.hex ? { backgroundColor: colorObj.hex } : undefined}
                      >
                        {!colorObj.hex && (
                          <span className="text-[10px] font-medium text-gray-600">{colorObj.color.slice(0, 2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selection — hidden for sizeless products (caps, stickers, etc.) */}
            {availableSizes.length > 0 && (() => {
              const displaySizes = getDisplaySizes(availableSizes);
              return (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-gray-900">Size</h3>
                      <button
                        onClick={() => setShowSizeChart(true)}
                        className="text-xs text-gray-900 hover:text-gray-700 underline underline-offset-2 transition-colors"
                      >
                        Size Guide
                      </button>
                    </div>
                    {selectedSize && (
                      <span className="text-xs text-gray-400">{selectedSizeStock} in stock</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displaySizes.map((sizeObj) => {
                      const unavailable = sizeObj.stock === 0;
                      const isSelected = selectedSize === sizeObj.size;
                      return (
                        <button
                          key={sizeObj.size}
                          onClick={() => { if (!unavailable) { setSelectedSize(sizeObj.size); setError(''); setQuantity(1); } }}
                          disabled={unavailable}
                          className={`relative min-w-[3rem] px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 overflow-hidden ${
                            isSelected
                              ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                              : unavailable
                              ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                              : 'border-gray-200 text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          {sizeObj.size}
                          {unavailable && (
                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="absolute w-[130%] h-px bg-gray-300 rotate-[-35deg]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Quantity */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quantity</h3>
              <div className="inline-flex items-center border border-gray-200 rounded-xl">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(selectedSizeStock, quantity + 1))}
                  disabled={quantity >= selectedSizeStock}
                  className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors disabled:text-gray-300"
                >
                  +
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-accent-500 mb-4">{error}</p>
            )}

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={product.totalStock === 0 || selectedSizeStock === 0}
              className={`w-full py-4 rounded-xl font-semibold text-base transition-all duration-300 ${
                addedToCart
                  ? 'bg-green-600 text-white'
                  : product.totalStock === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'hover-fill hover-fill-dark bg-[#0a0a0a] text-white active:scale-[0.98]'
              }`}
            >
              {addedToCart ? 'Added to Cart ✓' : product.totalStock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-gray-100">
              {[
                { icon: TruckIcon, label: 'Free shipping over ₱2,000' },
                { icon: ArrowPathIcon, label: '30-day easy returns' },
                { icon: ShieldCheckIcon, label: '100% authentic' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <item.icon className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                  <p className="text-xs text-gray-400 leading-tight">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="border-t border-gray-100 bg-gray-50">
        <div className="container-custom py-12 md:py-20">
          <div className="max-w-4xl mx-auto">
            {/* Reviews Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Customer Reviews</h2>
                {reviewSummary && reviewSummary.reviewCount > 0 ? (
                  <div className="flex items-center gap-3">
                    <Stars rating={reviewSummary.avgRating} size="lg" />
                    <span className="text-lg font-semibold">{reviewSummary.avgRating}</span>
                    <span className="text-sm text-gray-500">
                      based on {reviewSummary.reviewCount} review{reviewSummary.reviewCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No reviews yet. Be the first!</p>
                )}
              </div>
              {isAuthenticated ? (
                <button
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="btn-secondary text-sm self-start md:self-auto"
                >
                  {showReviewForm ? 'Cancel' : 'Write a Review'}
                </button>
              ) : (
                <Link
                  to={`/login?redirect=/products/${slug}`}
                  className="btn-secondary text-sm self-start md:self-auto"
                >
                  Log in to Review
                </Link>
              )}
            </div>

            {/* Rating Distribution */}
            {reviewSummary && reviewSummary.reviewCount > 0 && (
              <div className="mb-10 p-6 bg-white rounded-2xl">
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviewSummary.distribution[star] || 0;
                    const pct = reviewSummary.reviewCount > 0 ? (count / reviewSummary.reviewCount) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-6 text-right">{star}</span>
                        <StarSolid className="w-3.5 h-3.5 text-yellow-400" />
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0a0a0a] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Review Form */}
            {showReviewForm && (
              <form onSubmit={handleSubmitReview} className="mb-10 p-6 bg-white rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Write Your Review</h3>
                  <p className="text-sm text-gray-500">Posting as <span className="font-medium text-gray-700">{user?.name || user?.email}</span></p>
                </div>
                <div className="space-y-4">
                  {/* Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                    <StarSelect value={reviewForm.rating} onChange={(v) => setReviewForm(p => ({ ...p, rating: v }))} />
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={reviewForm.title}
                      onChange={(e) => setReviewForm(p => ({ ...p, title: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] focus:border-transparent"
                      placeholder="Summarize your experience"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Review</label>
                    <textarea
                      rows={4}
                      value={reviewForm.body}
                      onChange={(e) => setReviewForm(p => ({ ...p, body: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] focus:border-transparent resize-none"
                      placeholder="Tell others what you think about this product..."
                    />
                  </div>

                  {reviewError && <p className="text-sm text-accent-500">{reviewError}</p>}

                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="hover-fill hover-fill-dark bg-[#0a0a0a] text-white px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            )}

            {/* Review List */}
            {reviews.length > 0 ? (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review._id} className="p-6 bg-white rounded-2xl">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Stars rating={review.rating} size="sm" />
                          {review.verified && (
                            <span className="text-xs text-green-600 font-medium">Verified Purchase</span>
                          )}
                        </div>
                        {review.title && (
                          <h4 className="font-semibold text-gray-900 text-sm">{review.title}</h4>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {review.body && (
                      <p className="text-sm text-gray-600 leading-relaxed mb-2">{review.body}</p>
                    )}
                    <p className="text-xs text-gray-400">{review.author}</p>
                  </div>
                ))}

                {/* Load more */}
                {reviewPagination.page < reviewPagination.pages && (
                  <div className="text-center pt-4">
                    <button
                      onClick={() => setReviewPage(p => p + 1)}
                      className="text-sm font-medium text-gray-900 hover:text-gray-700 underline underline-offset-2"
                    >
                      Show more reviews
                    </button>
                  </div>
                )}
              </div>
            ) : !showReviewForm && (
              <p className="text-center text-gray-400 py-8">No reviews yet</p>
            )}
          </div>
        </div>
      </section>

      {/* Size Chart Modal */}
      {showSizeChart && (
        <SizeChartModal
          category={product.category}
          onClose={() => setShowSizeChart(false)}
        />
      )}

      {/* Virtual Try-On Modal */}
      {product && (
        <VirtualTryOn
          product={product}
          isOpen={showTryOn}
          onClose={() => setShowTryOn(false)}
        />
      )}
    </Layout>
  );
};

export default ProductDetail;
