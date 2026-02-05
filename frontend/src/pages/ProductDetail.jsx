import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  SparklesIcon,
  ChevronRightIcon,
  StarIcon as StarOutline,
  TruckIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import VirtualTryOn from '../components/products/VirtualTryOn';
import productService from '../services/productService';
import useCartStore from '../store/cartStore';

// Star rating display component
const Stars = ({ rating, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star}>
          {rating >= star ? (
            <StarSolid className={`${sizeClass} text-primary-600`} />
          ) : rating >= star - 0.5 ? (
            <StarSolid className={`${sizeClass} text-primary-600 opacity-50`} />
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
          <StarSolid className="w-6 h-6 text-primary-600" />
        ) : (
          <StarOutline className="w-6 h-6 text-gray-300 hover:text-primary-400" />
        )}
      </button>
    ))}
  </div>
);

const ProductDetail = () => {
  const { slug } = useParams();
  const addItem = useCartStore((state) => state.addItem);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [addedToCart, setAddedToCart] = useState(false);
  const [showTryOn, setShowTryOn] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPagination, setReviewPagination] = useState({});
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ author: '', email: '', rating: 5, title: '', body: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await productService.getProductBySlug(slug);
        setProduct(response.data);
        if (response.data.sizes.length > 0) {
          const inStock = response.data.sizes.find(s => s.stock > 0);
          setSelectedSize(inStock ? inStock.size : response.data.sizes[0].size);
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
    if (!selectedSize) {
      setError('Please select a size');
      return;
    }
    const sizeStock = product.sizes.find(s => s.size === selectedSize);
    if (!sizeStock || sizeStock.stock < quantity) {
      setError('Not enough stock available');
      return;
    }
    setError('');
    addItem(product, selectedSize, quantity);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.author.trim()) {
      setReviewError('Please enter your name');
      return;
    }
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
      setReviewForm({ author: '', email: '', rating: 5, title: '', body: '' });
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const isTryOnEligible = product &&
    ['jersey', 'jerseys', 'tshirt', 'shirts', 'tops'].includes(product.category?.toLowerCase());

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
  const selectedSizeStock = product.sizes.find(s => s.size === selectedSize)?.stock || 0;
  const categoryLabel = { jersey: 'Jersey', tshirt: 'T-Shirt', cap: 'Cap', shorts: 'Shorts', accessories: 'Accessory' }[product.category] || product.category;

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="container-custom pt-4 pb-2">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link to="/" className="hover:text-gray-600">Home</Link>
          <ChevronRightIcon className="w-3 h-3" />
          <Link to="/products" className="hover:text-gray-600">Shop</Link>
          <ChevronRightIcon className="w-3 h-3" />
          <span className="text-gray-600 truncate">{product.name}</span>
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
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {isTryOnEligible && (
                <button
                  onClick={() => setShowTryOn(true)}
                  className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm text-primary-700 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 shadow-md hover:bg-white transition-colors"
                >
                  <SparklesIcon className="w-4 h-4" />
                  Virtual Try-On
                </button>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                      selectedImage === index ? 'border-primary-600' : 'border-transparent hover:border-gray-300'
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
            {/* Team / Sport badge */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {product.team || product.sport} &middot; {categoryLabel}
            </p>

            {/* Product Name */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-3">
              {product.name}
            </h1>

            {/* Rating summary */}
            {reviewSummary && reviewSummary.reviewCount > 0 && (
              <button
                onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 mb-4 group"
              >
                <Stars rating={reviewSummary.avgRating} size="md" />
                <span className="text-sm text-gray-500 group-hover:text-primary-600 transition-colors">
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

            {/* Size Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Size</h3>
                {selectedSize && (
                  <span className="text-xs text-gray-400">{selectedSizeStock} in stock</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((sizeObj) => (
                  <button
                    key={sizeObj.size}
                    onClick={() => { setSelectedSize(sizeObj.size); setError(''); setQuantity(1); }}
                    disabled={sizeObj.stock === 0}
                    className={`min-w-[3rem] px-4 py-2.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                      selectedSize === sizeObj.size
                        ? 'bg-primary-600 text-white border-primary-600'
                        : sizeObj.stock === 0
                        ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                        : 'border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {sizeObj.size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quantity</h3>
              <div className="inline-flex items-center border border-gray-200 rounded-full">
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
              className={`w-full py-4 rounded-full font-semibold text-base transition-all duration-300 ${
                addedToCart
                  ? 'bg-green-600 text-white'
                  : product.totalStock === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]'
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
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="btn-secondary text-sm self-start md:self-auto"
              >
                {showReviewForm ? 'Cancel' : 'Write a Review'}
              </button>
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
                        <StarSolid className="w-3.5 h-3.5 text-primary-600" />
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-600 rounded-full transition-all duration-500"
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
                <h3 className="font-semibold text-gray-900 mb-4">Write Your Review</h3>
                <div className="space-y-4">
                  {/* Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                    <StarSelect value={reviewForm.rating} onChange={(v) => setReviewForm(p => ({ ...p, rating: v }))} />
                  </div>

                  {/* Name + Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={reviewForm.author}
                        onChange={(e) => setReviewForm(p => ({ ...p, author: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={reviewForm.email}
                        onChange={(e) => setReviewForm(p => ({ ...p, email: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={reviewForm.title}
                      onChange={(e) => setReviewForm(p => ({ ...p, title: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent resize-none"
                      placeholder="Tell others what you think about this product..."
                    />
                  </div>

                  {reviewError && <p className="text-sm text-accent-500">{reviewError}</p>}

                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="bg-primary-600 text-white px-8 py-3 rounded-full font-semibold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
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
                      className="text-sm font-medium text-primary-600 hover:text-primary-700 underline underline-offset-2"
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
