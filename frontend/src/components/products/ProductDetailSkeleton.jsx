// Skeleton for ProductDetail's main section — an image block on the left and
// the product info (name, price, size selector, CTA, description) on the
// right, mirroring the real layout so a fan landing on a product from search
// or a nav link sees a stable, believable structure instead of a blank page
// while the product request is in flight. Uses a neutral pulse, never a brand
// color, so it reads clearly as "loading".
const ProductDetailSkeleton = () => (
  <div className="container-custom pt-4 pb-2" aria-busy="true" aria-label="Loading product">
    <div className="h-3 bg-gray-200 rounded w-40 mb-6 animate-pulse" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse">
      <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden" />
      <div className="space-y-5">
        <div className="h-8 bg-gray-200 rounded w-3/4" />
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-10 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-12 bg-gray-200 rounded w-full" />
      </div>
    </div>
  </div>
);

export default ProductDetailSkeleton;
