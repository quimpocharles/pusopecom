import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PhotoIcon } from '@heroicons/react/24/outline';

/**
 * A native <input type="range"> drives the comparison, sized and positioned
 * to cover the whole image (not just a thin track) — dragging or tapping
 * anywhere on the photo moves the divider. That single element also gives
 * this its keyboard support (arrow keys), touch/swipe support, and
 * role="slider" + aria-valuenow/min/max semantics for free, rather than
 * hand-rolling pointer-event math and ARIA to match. Starts at 50% and only
 * ever moves on real interaction — no autoplay, no entrance animation.
 *
 * beforeImage/afterImage are CMS-supplied and may be unset (no Campaign
 * configured yet, or an admin cleared one). Renders a neutral placeholder
 * panel rather than falling back to a stock photo — there's no real
 * "customer in a plain shirt" / "AI Try-On result" pair available without
 * one actually being uploaded, and showing an unrelated photo in that role
 * would misrepresent what the feature does.
 *
 * beforeLabel/afterLabel are the on-image visual badges only ("You" /
 * "Game Day" reads as an emotional before/after, not a technical diff) —
 * the range input's own aria-label/aria-valuetext deliberately do NOT
 * reuse them. "Drag to reveal you and game day" would be genuinely
 * confusing read aloud; the accessible description stays plain regardless
 * of whatever marketing copy the visual badges carry.
 */
const Placeholder = ({ label }) => (
  <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] text-white/25">
    <PhotoIcon className="w-8 h-8" />
    <span className="text-[10px] uppercase tracking-wide">{label} image not set</span>
  </div>
);

const BeforeAfterSlider = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  aspectClassName = 'aspect-[4/5]',
}) => {
  const [position, setPosition] = useState(50);

  return (
    <div className={`relative ${aspectClassName} border-2 border-white/15 overflow-hidden bg-[#1a1a1a] select-none`}>
      {/* After — full base layer */}
      {afterImage ? (
        <img
          src={afterImage}
          alt="After — wearing the official jersey"
          className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
          draggable={false}
          width={800}
          height={1000}
          loading="lazy"
        />
      ) : (
        <Placeholder label={afterLabel} />
      )}

      {/* Before — clipped to the current position from the left */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {beforeImage ? (
          <img
            src={beforeImage}
            alt="Before — without the jersey"
            className="absolute inset-0 w-full h-full object-cover object-top"
            draggable={false}
            width={800}
            height={1000}
            loading="lazy"
          />
        ) : (
          <Placeholder label={beforeLabel} />
        )}
      </div>

      {/* Divider line + flat square handle — purely visual, driven by position */}
      <div
        className="absolute inset-y-0 pointer-events-none"
        style={{ left: `${position}%`, transform: 'translateX(-1px)' }}
      >
        <div className="w-0.5 h-full bg-white" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-white border-2 border-ink-900 flex items-center justify-center gap-0.5">
          <ChevronLeftIcon className="w-3 h-3 text-ink-900" />
          <ChevronRightIcon className="w-3 h-3 text-ink-900" />
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-white/70 bg-black/40 px-2 py-1 pointer-events-none">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-white/70 bg-black/40 px-2 py-1 pointer-events-none">
        {afterLabel}
      </span>

      {/* The actual control — invisible, covers the whole image */}
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label="Before and after comparison — drag to reveal how you'd look wearing the jersey"
        aria-valuetext={`${position}% revealed`}
        className="absolute inset-0 w-full h-full m-0 opacity-0 cursor-ew-resize appearance-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
      />
    </div>
  );
};

export default BeforeAfterSlider;
