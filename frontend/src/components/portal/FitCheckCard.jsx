import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ArrowsRightLeftIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { Panel, Badge } from '../ui';
import ShareButton from '../products/ShareButton';
import useCartStore from '../../store/cartStore';

/**
 * The generated Fit Check result is the hero image — not the product photo
 * (the redesign's whole point: this used to function as an audit log).
 * Falls back to the product photo only in the rare case the durable
 * re-upload itself failed (generatedImageUrl stayed null) — see
 * routes/tryon.js's uploadGeneratedImage.
 */
const FitCheckCard = ({ tryOn, onFavoriteToggle, onDelete, onCompare }) => {
  const openQuickAdd = useCartStore((state) => state.openQuickAdd);
  const [busy, setBusy] = useState(false);

  const product = tryOn.product;
  const heroImage = tryOn.generatedImageUrl || tryOn.productImage;
  const imageMissing = !tryOn.generatedImageUrl && !tryOn.productImage;
  const canBuy = product && product.active && product.totalStock > 0;

  const handleFavorite = async () => {
    setBusy(true);
    try {
      await onFavoriteToggle(tryOn._id, !tryOn.favorited);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Delete this Fit Check? You can ask support to restore it later if you change your mind.')) {
      onDelete(tryOn._id);
    }
  };

  const handleDownload = async () => {
    if (!tryOn.generatedImageUrl) return;
    try {
      const response = await fetch(tryOn.generatedImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fit-check-${(tryOn.productName || 'puso').toLowerCase().replace(/\s+/g, '-')}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(tryOn.generatedImageUrl, '_blank');
    }
  };

  const productUrl = product ? `${window.location.origin}/products/${product.slug}` : window.location.href;

  return (
    <Panel padding="p-0" className="overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-gray-100">
        {imageMissing ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            Image unavailable
          </div>
        ) : (
          <img src={heroImage} alt={tryOn.productName} className="w-full h-full object-cover" />
        )}

        <button
          onClick={handleFavorite}
          disabled={busy}
          className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-full p-1.5 shadow disabled:opacity-50"
          aria-label={tryOn.favorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          {tryOn.favorited ? (
            <HeartIconSolid className="w-4 h-4 text-red-500" />
          ) : (
            <HeartIcon className="w-4 h-4 text-ink-900" />
          )}
        </button>

        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 items-start">
          <Badge tone={tryOn.success ? 'success' : 'secondary'}>
            {tryOn.success ? 'Succeeded' : 'Failed'}
          </Badge>
          {tryOn.purchased && <Badge tone="accent">Purchased</Badge>}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <p className="font-semibold text-gray-900 text-sm truncate">{tryOn.productName}</p>
        <div className="flex items-center justify-between mt-1 mb-3">
          <span className="text-sm font-semibold text-primary-600">
            {product ? `₱${(product.salePrice ?? product.price)?.toLocaleString()}` : 'Product unavailable'}
          </span>
          <span className="text-xs text-gray-400">{new Date(tryOn.createdAt).toLocaleDateString('en-PH')}</span>
        </div>

        {tryOn.purchased && tryOn.purchasedOrderNumber && (
          <Link
            to={`/order/${tryOn.purchasedOrderNumber}`}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 mb-3 inline-block"
          >
            View Order →
          </Link>
        )}

        <div className="mt-auto space-y-2">
          {product && (
            <div className="flex gap-2">
              {canBuy ? (
                <button onClick={() => openQuickAdd(product)} className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5">
                  <ShoppingBagIcon className="w-3.5 h-3.5" />
                  Buy Now
                </button>
              ) : (
                <Link to={`/products/${product.slug}`} className="btn-outline text-xs flex-1 text-center">
                  View Product
                </Link>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-1">
            {product && (
              <Link
                to={`/products/${product.slug}?tryOn=1`}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                title="Retry Fit Check"
                aria-label="Retry Fit Check"
              >
                <ArrowPathIcon className="w-4 h-4" />
              </Link>
            )}
            {product && (
              <button
                onClick={() => onCompare(tryOn)}
                disabled={!tryOn.generatedImageUrl}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Compare with product photo"
                aria-label="Compare with product photo"
              >
                <ArrowsRightLeftIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={!tryOn.generatedImageUrl}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Download"
              aria-label="Download image"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
            </button>
            <ShareButton title="My Fit Check on PusoStore" text={`Check out my Fit Check of ${tryOn.productName}!`} url={productUrl} />
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-full hover:bg-red-50 text-gray-500 hover:text-red-600"
              title="Delete"
              aria-label="Delete Fit Check"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
};

export default FitCheckCard;
