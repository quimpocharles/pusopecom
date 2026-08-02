import { useState, useRef, useEffect } from 'react';
import { ShareIcon, LinkIcon, CheckIcon } from '@heroicons/react/24/outline';

/**
 * On mobile/supporting browsers, tapping Share goes straight to the native
 * share sheet (navigator.share) — no custom UI at all. Everywhere else it
 * opens a small dropdown with Copy Link plus direct share-intent links for
 * the platforms actually relevant to this audience (Facebook and WhatsApp
 * are the dominant sharing channels in the Philippines; X covers the rest).
 * Styled to match ProductDetail.jsx's own existing (pre-migration) look —
 * rounded-xl/shadow-card, not the newer ink/paper editorial tokens — so it
 * doesn't read as a mismatched drive-by restyle of an unmigrated page.
 */
const SHARE_TARGETS = (url, text) => [
  { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { label: 'X', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
];

const ShareButton = ({ title, text, url }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleShareClick = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // Cancelling the native share sheet also rejects the promise —
        // not an error worth surfacing.
      }
      return;
    }
    setOpen((v) => !v);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable or blocked by permissions — no further
      // fallback; the share-intent links below still work.
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleShareClick}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        aria-haspopup={canNativeShare ? undefined : 'true'}
        aria-expanded={canNativeShare ? undefined : open}
      >
        <ShareIcon className="w-4 h-4" />
        Share
      </button>

      {!canNativeShare && open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-gray-100 shadow-card z-20 py-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
          >
            {copied ? <CheckIcon className="w-4 h-4 text-green-600" /> : <LinkIcon className="w-4 h-4" />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <div className="h-px bg-gray-100 my-1" />
          {SHARE_TARGETS(url, text).map((target) => (
            <a
              key={target.label}
              href={target.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Share on {target.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShareButton;
