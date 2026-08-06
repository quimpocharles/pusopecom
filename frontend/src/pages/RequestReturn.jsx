import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircleIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import orderService from '../services/orderService';
import returnService from '../services/returnService';
import { toTitleCase } from '../utils/text';

const REASONS = [
  'Wrong size',
  'Item damaged or defective',
  'Not as described',
  'Changed my mind',
  'Wrong item received',
  'Other',
];

// Enterprise Fulfillment Blueprint, Phase 2 — the customer-facing return
// request form (§7/§1). Mirrors the ownership rule routes/returns.js
// enforces server-side: a guest who knows the order number can file a
// return for it exactly like a logged-in owner can.
const RequestReturn = () => {
  const { orderNumber } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedQty, setSelectedQty] = useState({}); // orderItemId -> quantity
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    orderService.getOrderByNumber(orderNumber)
      .then((res) => setOrder(res.data))
      .catch(() => setError('Order not found'))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  const toggleItem = (itemId, maxQty) => {
    setSelectedQty((prev) => {
      const next = { ...prev };
      if (next[itemId]) delete next[itemId];
      else next[itemId] = maxQty;
      return next;
    });
  };

  const setQty = (itemId, qty, maxQty) => {
    setSelectedQty((prev) => ({ ...prev, [itemId]: Math.max(1, Math.min(qty, maxQty)) }));
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const res = await returnService.uploadPhotos(files);
      setPhotos((prev) => [...prev, ...res.data.map((p) => p.url)]);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (url) => setPhotos((prev) => prev.filter((p) => p !== url));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const items = Object.entries(selectedQty).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (items.length === 0) {
      setSubmitError('Select at least one item to return');
      return;
    }
    if (!reason) {
      setSubmitError('Please select a reason for your return');
      return;
    }

    setSubmitting(true);
    try {
      await returnService.create({ orderNumber, reason, description, photos, items });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Layout><LoadingSpinner /></Layout>;
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="container-custom py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-700 mb-4">{error || 'Order not found'}</h1>
          <Link to="/" className="btn-primary inline-block">Return to Home</Link>
        </div>
      </Layout>
    );
  }

  if (order.paymentStatus !== 'paid') {
    return (
      <Layout>
        <div className="container-custom py-12 text-center max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-700 mb-4">This order can&apos;t be returned</h1>
          <p className="text-gray-500 mb-6">Only paid orders are eligible for a return request.</p>
          <Link to={`/order/${orderNumber}`} className="btn-primary inline-block">Back to Order</Link>
        </div>
      </Layout>
    );
  }

  if (submitted) {
    return (
      <Layout>
        <div className="container-custom py-12 max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Return Request Submitted</h1>
          <p className="text-gray-600 mb-6">
            We&apos;ve received your request for order #{orderNumber}. Our team will review it and follow up by email.
          </p>
          <Link to={`/order/${orderNumber}`} className="btn-primary inline-block">Back to Order</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-custom py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">Request a Return</h1>
          <p className="text-gray-500 mb-8">Order #{orderNumber}</p>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="card p-6">
              <h2 className="font-bold mb-4">Select items to return</h2>
              <div className="space-y-3">
                {order.items.map((item) => {
                  const checked = Boolean(selectedQty[item._id]);
                  return (
                    <div key={item._id} className={`flex items-center gap-4 p-3 rounded-lg border ${checked ? 'border-primary-400 bg-primary-50/40' : 'border-gray-200'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(item._id, item.quantity)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{toTitleCase(item.name)}</p>
                        <p className="text-xs text-gray-500">Size: {item.size}{item.color ? ` · ${item.color}` : ''} · Purchased Qty: {item.quantity}</p>
                      </div>
                      {checked && item.quantity > 1 && (
                        <input
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={selectedQty[item._id]}
                          onChange={(e) => setQty(item._id, Number(e.target.value), item.quantity)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-bold mb-4">Reason for return</h2>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 bg-white"
              >
                <option value="">Select a reason…</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details (optional)"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="card p-6">
              <h2 className="font-bold mb-4">Photos (optional)</h2>
              <div className="flex flex-wrap gap-3 mb-3">
                {photos.map((url) => (
                  <div key={url} className="relative w-20 h-20">
                    <img src={url} alt="Return evidence" className="w-full h-full object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-0.5 shadow-sm"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:border-primary-400 hover:text-primary-500">
                  <PhotoIcon className="w-6 h-6" />
                  <span className="text-[10px] mt-1">{uploading ? 'Uploading…' : 'Add photo'}</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              </div>
              <p className="text-xs text-gray-400">Photos help our team review your request faster, especially for damage or defect claims.</p>
            </div>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => navigate(`/order/${orderNumber}`)} className="btn-outline">Cancel</button>
              <button type="submit" disabled={submitting || uploading} className="btn-primary disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Return Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default RequestReturn;
