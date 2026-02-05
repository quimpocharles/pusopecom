import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

const ProductCard = ({ product, onBuyNow }) => {
  const [imgHovered, setImgHovered] = useState(false);

  const effectivePrice = product.effectivePrice || product.salePrice || product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;

  const isTryOnEligible = ['jersey', 'jerseys', 'tshirt', 'shirts', 'tops']
    .includes(product.category?.toLowerCase());

  // Primary image and hover image
  const primaryImage = product.images?.[0] || '/placeholder.jpg';
  const hoverImage = product.images?.[1]
    || primaryImage.replace(/placehold\.co\/600x600\/([A-Fa-f0-9]+)\/([A-Fa-f0-9]+)/, (_, bg, fg) => `placehold.co/600x600/${fg}/${bg}`);

  const handleBuyNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onBuyNow) {
      onBuyNow(product);
    }
  };

  // Category display label
  const categoryLabel = {
    jersey: 'Jersey',
    tshirt: 'T-Shirt',
    cap: 'Cap',
    shorts: 'Shorts',
    accessories: 'Accessory',
  }[product.category] || product.category;

  return (
    <Link to={`/products/${product.slug}`} className="group block">
      {/* Image Card */}
      <div
        className="relative bg-gray-100 rounded-2xl overflow-hidden aspect-square"
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
            <span className="bg-accent-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              Sale
            </span>
          )}
          {isTryOnEligible && (
            <span className="bg-primary-600 text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
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

      {/* Product Info — MoreLabs style rows */}
      <div className="mt-4 space-y-1">
        {/* Row 1: Name + Stars */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-gray-900 text-sm md:text-base leading-tight line-clamp-2 group-hover:text-primary-600 transition-colors">
            {product.name}
          </h3>
          {product.reviewCount > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`w-3 h-3 md:w-3.5 md:h-3.5 ${i < Math.round(product.avgRating) ? 'text-primary-600' : 'text-gray-200'}`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500 hidden sm:inline">{product.reviewCount} reviews</span>
            </div>
          )}
        </div>

        {/* Row 2: Team/variant + Price */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs md:text-sm text-gray-500 truncate">
            {product.team || product.sport}
          </p>
          <div className="flex items-baseline gap-1.5 flex-shrink-0">
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through">
                ₱{product.price?.toLocaleString()}
              </span>
            )}
            <span className="text-sm md:text-base font-semibold text-gray-900">
              ₱{effectivePrice?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Row 3: Category + learn more */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-gray-400">
            {categoryLabel}
          </p>
          <span className="text-xs font-medium text-gray-900 underline underline-offset-2 group-hover:text-primary-600 transition-colors">
            learn more
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
