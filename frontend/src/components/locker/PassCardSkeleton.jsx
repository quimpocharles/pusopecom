// Skeleton for a Pass card in the Passes grid. Mirrors PassCard's structure
// — event artwork block, then a body with venue/date/type lines, then an
// explicitly reserved QR-sized square so the QR doesn't cause layout shift
// once it loads.
const PassCardSkeleton = () => (
  <div className="card overflow-hidden flex flex-col animate-pulse" aria-hidden="true">
    <div className="h-24 bg-ink-200/60" />
    <div className="p-4 space-y-3 flex-1">
      <div className="h-3 bg-ink-200/60 rounded w-2/3" />
      <div className="h-3 bg-ink-200/60 rounded w-3/4" />
      <div className="h-3 bg-ink-200/60 rounded w-1/2" />
      {/* Reserved QR space — fixed height so a real QR lands in the same box. */}
      <div className="flex justify-center py-1">
        <div className="w-28 h-28 bg-ink-200/40" />
      </div>
      <div className="h-9 bg-ink-200/60 rounded" />
    </div>
  </div>
);

export default PassCardSkeleton;
