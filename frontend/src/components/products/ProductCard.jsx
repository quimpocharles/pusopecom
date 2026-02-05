import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

const ProductCard = ({ product, onBuyNow }) => {
  const [imgHovered, setImgHovered] = useState(false);

  const effectivePrice = product.effectivePrice || product.salePrice || product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.salePrice) / product.price) * 100)
    : 0;

  const isTryOnEligible = ['jersey', 'jerseys', 'tshirt', 'shirts', 'tops']
    .includes(product.category?.toLowerCase());

  // Primary image and hover image
  const primaryImage = product.images?.[0] || '/placeholder.jpg';
  // If there's a second image use it, otherwise swap the placeholder color scheme
  const hoverImage = product.images?.[1]
    || primaryImage.replace(/placehold\.co\/600x600\/([A-Fa-f0-9]+)\/([A-Fa-f0-9]+)/, (_, bg, fg) => `placehold.co/600x600/${fg}/${bg}`);

  const handleBuyNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onBuyNow) {
      onBuyNow(product);
    }
  };

  return (
    <Link to={`/products/${product.slug}`} className="product-card group block">
      {/* Image Container */}
      <div
        className="product-card-image relative bg-gray-100"
        onMouseEnter={() => setImgHovered(true)}
        onMouseLeave={() => setImgHovered(false)}
      >
        {/* Primary Image */}
        <img
          src={primaryImage}
          alt={product.name}
          className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${
            imgHovered ? 'opacity-0' : 'opacity-100'
          }`}
          loading="lazy"
        />
        {/* Hover Image */}
        <img
          src={hoverImage}
          alt={`${product.name} alternate`}
          className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${
            imgHovered ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          {hasDiscount && (
            <span className="badge bg-accent-500 text-white text-xs">
              -{discountPercent}%
            </span>
          )}
          {isTryOnEligible && (
            <span className="badge bg-primary-600 text-white text-xs flex items-center gap-1">
              <SparklesIcon className="w-3 h-3" />
              Try-On
            </span>
          )}
        </div>

        {/* Out of Stock Overlay */}
        {product.totalStock === 0 && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <span className="text-gray-600 font-semibold text-sm">Out of Stock</span>
          </div>
        )}

        {/* Buy Now Button on Hover */}
        {product.totalStock > 0 && onBuyNow && (
          <div className="absolute inset-x-0 bottom-0 p-3 z-10 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <button
              onClick={handleBuyNow}
              className="w-full bg-white text-gray-900 py-2.5 rounded-full text-sm font-semibold shadow-lg hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              Buy Now
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          {product.team || product.sport}
        </p>

        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {product.name}
        </h3>

        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <StarIcon
              key={i}
              className={`w-3.5 h-3.5 ${i < 4 ? 'text-secondary-500' : 'text-gray-200'}`}
            />
          ))}
          <span className="text-xs text-gray-500 ml-1">4.0</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">
            ₱{effectivePrice?.toLocaleString()}
          </span>
          {hasDiscount && (
            <span className="text-sm text-gray-400 line-through">
              ₱{product.price?.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
