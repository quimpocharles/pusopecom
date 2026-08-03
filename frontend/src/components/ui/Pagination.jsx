import PropTypes from 'prop-types';

/**
 * Pagination — extracted from Products.jsx's inline pagination block, the
 * only paginated-list precedent in the app before this. Same exact
 * behavior and styling (COMPONENT_SPECIFICATION.md § Pagination: current
 * page is type weight + underline, never a filled circle), now shared
 * across five call sites (Products, and the Account Orders/Wishlist/
 * Try-Ons/Notifications tabs) instead of duplicated per page.
 *
 * Deliberately just `page`/`totalPages`/`onPageChange` — how the caller
 * stores page state (URL search params, local state, etc.) stays the
 * caller's concern, not this component's.
 */
const Pagination = ({ page, totalPages, onPageChange, className = '' }) => {
  if (totalPages <= 1) return null;

  const goTo = (p) => {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange(p);
  };

  const pageNums = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
      pageNums.push(p);
    } else if (pageNums[pageNums.length - 1] !== '...') {
      pageNums.push('...');
    }
  }

  const btnBase = 'w-9 h-9 text-editorial-label tabular-nums transition-colors duration-150 flex items-center justify-center';
  const btnActive = 'font-bold text-ink-900 underline underline-offset-4 decoration-2';
  const btnInactive = 'font-medium text-ink-700 hover:text-ink-900';
  const btnDisabled = 'text-ink-200 cursor-not-allowed';

  return (
    <div className={`flex justify-center items-center gap-1.5 flex-wrap ${className}`.trim()}>
      <button
        onClick={() => goTo(page - 1)}
        disabled={page === 1}
        className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive} px-3`}
      >
        ‹
      </button>

      {pageNums.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-ink-500 text-editorial-label">…</span>
        ) : (
          <button
            key={p}
            onClick={() => goTo(p)}
            className={`${btnBase} ${page === p ? btnActive : btnInactive}`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => goTo(page + 1)}
        disabled={page === totalPages}
        className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive} px-3`}
      >
        ›
      </button>
    </div>
  );
};

Pagination.propTypes = {
  page: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default Pagination;
