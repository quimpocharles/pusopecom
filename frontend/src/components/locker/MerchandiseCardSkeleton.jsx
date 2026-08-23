// Skeleton for a Merchandise order card in the My Gear wallet. Mirrors
// MerchandiseCard: an item row (taller thumbnail reserved at 64px so the
// real image doesn't shift the row), then blocks for the delivery
// progression and the secondary info strip.
const MerchandiseCardSkeleton = () => (
  <div className="card overflow-hidden animate-pulse" aria-hidden="true">
    <div className="p-4 flex items-center gap-4">
      <div className="w-16 h-16 bg-ink-200/60 border border-ink-200 flex-shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-3 bg-ink-200/60 rounded w-3/4" />
        <div className="h-3 bg-ink-200/60 rounded w-1/2" />
      </div>
      <div className="space-y-2 text-right">
        <div className="h-3 bg-ink-200/60 rounded w-8 ml-auto" />
        <div className="h-3 bg-ink-200/60 rounded w-12 ml-auto" />
      </div>
    </div>
    <div className="border-t-2 border-ink-900 p-4 space-y-3">
      <div className="h-3 bg-ink-200/60 rounded w-24" />
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-ink-200/60 mx-auto" />
            <div className="h-2 bg-ink-200/60 rounded w-10 mx-auto" />
          </div>
        ))}
      </div>
    </div>
    <div className="border-t border-ink-200 p-4 flex items-center justify-between">
      <div className="h-3 bg-ink-200/60 rounded w-32" />
      <div className="h-3 bg-ink-200/60 rounded w-20" />
    </div>
  </div>
);

export default MerchandiseCardSkeleton;
