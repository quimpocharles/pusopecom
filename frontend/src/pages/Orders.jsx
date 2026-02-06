import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StarIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import useAuthStore from '../store/authStore';
import orderService from '../services/orderService';
import productService from '../services/productService';
import SEO from '../components/common/SEO';

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
          <StarIcon className="w-6 h-6 text-yellow-400" />
        ) : (
          <StarOutline className="w-6 h-6 text-gray-300 hover:text-yellow-300" />
        )}
      </button>
    ))}
  </div>
);

const ReviewModal = ({ item, onClose, onSubmitted }) => {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const slug = item.product?.slug;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!slug) return;
    setSubmitting(true);
    setError('');
    try {
      await productService.createReview(slug, { rating, title, body });
      onSubmitted(item.product._id || item.product);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <img
              src={item.image}
              alt={item.name}
              className="w-12 h-12 object-cover rounded-lg"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900">Write a Review</h3>
              <p className="text-sm text-gray-500 truncate">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <StarSelect value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your experience"
              className="input-field"
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Review (optional)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you like or dislike?"
              className="input-field"
              rows={3}
              maxLength={2000}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Orders = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewedProductIds, setReviewedProductIds] = useState(new Set());
  const [reviewingItem, setReviewingItem] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (isAuthenticated && user) {
        try {
          const [ordersRes, reviewsRes] = await Promise.all([
            orderService.getUserOrders(user.id),
            productService.getMyReviewedProductIds().catch(() => ({ data: [] }))
          ]);
          setOrders(ordersRes.data);
          setReviewedProductIds(new Set(reviewsRes.data));
        } catch (error) {
          console.error('Failed to fetch orders:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [isAuthenticated, user]);

  const handleReviewSubmitted = (productId) => {
    setReviewedProductIds(prev => new Set([...prev, productId.toString()]));
    setReviewingItem(null);
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container-custom py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to view your orders</h1>
          <Link to="/login" className="btn-primary inline-block">
            Login
          </Link>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="My Orders" noIndex />
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold mb-8">My Orders</h1>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">You haven't placed any orders yet</p>
            <Link to="/products" className="btn-primary inline-block">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order._id} className="card p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Order Number</p>
                    <p className="font-bold text-lg">{order.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Order Date</p>
                    <p className="font-semibold">
                      {new Date(order.createdAt).toLocaleDateString('en-PH')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Payment Status</p>
                    <p className={`font-semibold capitalize ${
                      order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {order.paymentStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Order Status</p>
                    <p className="font-semibold capitalize">{order.orderStatus}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="font-bold text-primary-600">₱{order.total.toFixed(2)}</p>
                  </div>
                </div>

                {/* Show items with review buttons for delivered orders */}
                {order.orderStatus === 'delivered' && (
                  <div className="border-t pt-4 mb-4 space-y-3">
                    <p className="text-sm font-medium text-gray-700">Rate your items:</p>
                    {order.items.map((item, idx) => {
                      const productId = (item.product?._id || item.product)?.toString();
                      const hasReviewed = productId && reviewedProductIds.has(productId);

                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-500">
                              Size: {item.size}{item.color ? ` | ${item.color}` : ''}
                            </p>
                          </div>
                          {hasReviewed ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <StarIcon className="w-4 h-4" /> Reviewed
                            </span>
                          ) : (
                            <button
                              onClick={() => setReviewingItem(item)}
                              className="text-xs font-semibold text-primary-600 hover:text-primary-700 whitespace-nowrap border border-primary-200 rounded-xl px-3 py-1 hover:bg-primary-50 transition-colors"
                            >
                              Write a Review
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    {order.items.length} item{order.items.length > 1 ? 's' : ''}
                  </p>
                  <Link
                    to={`/order/${order.orderNumber}`}
                    className="text-primary-600 hover:text-primary-700 font-semibold"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewingItem && (
        <ReviewModal
          item={reviewingItem}
          onClose={() => setReviewingItem(null)}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </Layout>
  );
};

export default Orders;
