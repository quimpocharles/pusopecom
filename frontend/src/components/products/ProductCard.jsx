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
  } : {
    // Light-mode neutrals aligned to the ink scale (docs/design/DESIGN_TOKENS.md).
    // Star rating colors are left as the pre-existing amber/gray — a
    // widely-understood rating convention, not a decorative brand color,
    // so out of scope for this pass.
    name:           '#0E0E0E', // ink.900
    teamSport:      '#767676', // ink.500
    price:          '#0E0E0E', // ink.900
    priceStrike:    '#767676', // ink.500
    category:       '#767676', // ink.500
    learnMore:      '#767676', // ink.500
    starActive:     '#f59e0b',
    starInactive:   '#d1d5db',
    reviewCount:    '#767676', // ink.500
  };

  const effectivePrice = product.effectivePrice || product.salePrice || product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;

  const isTryOnEligible = product.tryOnEnabled === true;

  // "New" is computed from real data, never set manually — a fixed
  // 14-day recency window against the Product's actual createdAt, so the
  // label stays honest as time passes rather than needing to be
  // remembered and turned off later (DESIGN_TOKENS.md § Colors, merch.new).
  const NEW_WINDOW_DAYS = 14;
  const isNew = product.createdAt
    ? (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= NEW_WINDOW_DAYS
    : false;

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
    // One bordered box for the whole card — image and info share a single
    // outer edge, with a rule between them, instead of a floating image
    // above unbordered text (COMPONENT_SPECIFICATION.md § Panels, applied
    // here to a Product's own card).
    <Link to={`/products/${product.slug}`} className="group block border-2 border-ink-900">
      {/* Image */}
      <div
        className="relative bg-gray-100 overflow-hidden aspect-square"
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

        {/* Badges — a horizontal row, top-left. New/Sale/Virtual Try-On are
            real, repeatable, functionally meaningful commerce states —
            DESIGN_TOKENS.md's merch.* category, added after neutral-only
            badges proved hard to scan at a glance. New is computed from
            createdAt above, never set manually. */}
        <div className="absolute top-2 left-2 md:top-3 md:left-3 flex flex-row flex-nowrap items-center gap-1.5 md:gap-2 z-10">
          {isNew && (
            <span className="bg-merch-new text-white text-[10px] md:text-xs font-medium px-2 py-0.5 md:px-2.5 md:py-1 whitespace-nowrap">
              New
            </span>
          )}
          {hasDiscount && (
            <span className="bg-merch-sale text-white text-[10px] md:text-xs font-medium px-2 py-0.5 md:px-2.5 md:py-1 whitespace-nowrap">
              Sale
            </span>
          )}
          {isTryOnEligible && (
            <span className="bg-merch-tryon text-white text-[10px] md:text-xs font-medium px-2 py-0.5 md:px-2.5 md:py-1 flex items-center gap-1 whitespace-nowrap">
              <SparklesIcon className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" />
              <span className="md:hidden">AI Try-On</span>
              <span className="hidden md:inline">AI Try-On</span>
            </span>
          )}
        </div>

        {/* Sold Out marquee — a bottom strip, not a full-image dim, so the
            product photo stays visible; reuses the existing .animate-marquee
            keyframe (already powering Home.jsx's ticker) rather than adding
            a new dependency for the same effect. */}
        {product.totalStock === 0 && (
          <div className="absolute bottom-0 left-0 w-full bg-ink-900 text-white overflow-hidden z-10">
            <div className="animate-marquee-fast whitespace-nowrap flex py-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center gap-8 px-4 flex-shrink-0">
                  {[...Array(6)].map((_, j) => (
                    <span key={j} className="text-sm font-bold uppercase tracking-wider">
                      Sold Out
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buy Now Button on Hover */}
        {product.totalStock > 0 && onBuyNow && (
          <div className="absolute inset-x-0 bottom-0 p-3 z-10 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <button
              onClick={handleBuyNow}
              className="w-full btn-primary"
            >
              Buy Now
            </button>
          </div>
        )}
      </div>

      {/* Product Info — a label attached to the image, not floating text below it */}
      <div className="border-t-2 border-ink-900 p-3 space-y-1">
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
