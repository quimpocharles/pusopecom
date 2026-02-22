import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { toTitleCase } from '../../utils/text';

const ProductCard = ({ product, onBuyNow, dark = false }) => {
  const [imgHovered, setImgHovered] = useState(false);

  const c = dark ? {
    name:           '#fff',
    teamSport:      'rgba(255,255,255,0.42)',
    price:          '#fff',
    priceStrike:    'rgba(255,255,255,0.30)',
    category:       'rgba(255,255,255,0.28)',
    learnMore:      'rgba(255,255,255,0.55)',
    starActive:     'rgba(255,255,255,0.75)',
    starInactive:   'rgba(255,255,255,0.12)',
    reviewCount:    'rgba(255,255,255,0.35)',
    swatchBorder:   '1px solid rgba(255,255,255,0.18)',
    swatchExtra:    'rgba(255,255,255,0.35)',
  } : {
    name:           '#111827',
    teamSport:      '#6b7280',
    price:          '#111827',
    priceStrike:    '#9ca3af',
    category:       '#9ca3af',
    learnMore:      '#6b7280',
    starActive:     '#f59e0b',
    starInactive:   '#d1d5db',
    reviewCount:    '#9ca3af',
    swatchBorder:   '1px solid rgba(0,0,0,0.10)',
    swatchExtra:    '#9ca3af',
  };

  const effectivePrice = product.effectivePrice || product.salePrice || product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;

  const isTryOnEligible = product.tryOnEnabled === true;

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
          width={600}
          height={600}
        />
        {/* Hover Image */}
        <img
          src={hoverImage}
          alt={`${product.name} alternate`}
          className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${
            imgHovered ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          width={600}
          height={600}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          {hasDiscount && (
            <span className="bg-accent-500 text-white text-xs font-medium px-2.5 py-1 rounded-lg">
              Sale
            </span>
          )}
          {isTryOnEligible && (
            <span className="bg-primary-600 text-white text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1">
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
              className="hover-fill hover-fill-navy w-full bg-white text-gray-900 py-2.5 rounded-xl text-sm font-semibold shadow-lg active:scale-[0.98] transition-all"
            >
              Buy Now
            </button>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="mt-4 space-y-1">
        {/* Color swatches */}
        {product.colors?.length > 0 && (
          <div className="flex items-center gap-1 mb-0.5">
            {product.colors.slice(0, 5).map((col) => (
              <span
                key={col._id || col.color}
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: col.hex || 'transparent', border: c.swatchBorder }}
                title={col.color}
              />
            ))}
            {product.colors.length > 5 && (
              <span className="text-[10px]" style={{ color: c.swatchExtra }}>+{product.colors.length - 5}</span>
            )}
          </div>
        )}

        {/* Row 1: Name + Stars */}
        <div className="flex items-start justify-between gap-3">
          <h3
            className="font-semibold text-sm md:text-base leading-tight line-clamp-2"
            style={{ color: c.name }}
          >
            {toTitleCase(product.name)}
          </h3>
          {product.reviewCount > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className="w-3 h-3 md:w-3.5 md:h-3.5"
                    style={{ color: i < Math.round(product.avgRating) ? c.starActive : c.starInactive }}
                  />
                ))}
              </div>
              <span className="text-xs hidden sm:inline" style={{ color: c.reviewCount }}>
                {product.reviewCount} reviews
              </span>
            </div>
          )}
        </div>

        {/* Row 2: Team/variant + Price */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs md:text-sm truncate" style={{ color: c.teamSport }}>
            {product.team || product.sport}
          </p>
          <div className="flex items-baseline gap-1.5 flex-shrink-0">
            {hasDiscount && (
              <span className="text-xs line-through" style={{ color: c.priceStrike }}>
                ₱{product.price?.toLocaleString()}
              </span>
            )}
            <span className="text-sm md:text-base font-semibold" style={{ color: c.price }}>
              ₱{effectivePrice?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Row 3: Category + learn more */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs" style={{ color: c.category }}>
            {categoryLabel}
          </p>
          <span
            className="text-xs font-medium underline underline-offset-2"
            style={{ color: c.learnMore }}
          >
            learn more
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
