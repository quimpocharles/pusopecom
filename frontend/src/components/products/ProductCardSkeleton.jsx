// Skeleton card for the product grid. Mirrors ProductCard's layout — an
// aspect-square image block plus name/team/price lines — so the first paint
// shows a believable grid skeleton immediately instead of a blank page
// (Products.jsx) while the products request is in flight. Uses a neutral
// pulse on the same gray the real card's image container uses, not a brand
// color, so it reads as "loading" rather than content.
const ProductCardSkeleton = () => (
  <div className="block border-2 border-ink-900 animate-pulse" aria-hidden="true">
    <div className="bg-gray-100 aspect-square" />
    <div className="border-t-2 border-ink-900 p-3 space-y-2">
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-200 rounded w-1/4" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  </div>
);

export default ProductCardSkeleton;
