import PropTypes from 'prop-types';

/**
 * Card — consolidates two card patterns that already exist independently
 * in the codebase:
 *
 *  - "bordered": the `bg-white rounded-xl border border-gray-200 p-6`
 *    wrapper duplicated identically between StatsCard.jsx and
 *    ReportCard.jsx (the exact duplication flagged in the design system
 *    audit).
 *  - "elevated": the existing `.card` class from index.css
 *    (bg-white rounded-2xl shadow-card, hover:shadow-card-hover),
 *    already used in OrderConfirmation.jsx and AdminPickup.jsx.
 *
 * No new visual style is introduced — both variants reproduce an existing,
 * already-shipping look exactly.
 */
const Card = ({
  variant = 'bordered',
  title,
  padding = 'p-6',
  className = '',
  children,
}) => {
  const base =
    variant === 'elevated'
      ? 'card'
      : 'bg-white rounded-xl border border-gray-200';

  const classes = [base, padding, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
};

Card.propTypes = {
  /** 'bordered' matches StatsCard/ReportCard's existing wrapper; 'elevated' matches the existing .card class. */
  variant: PropTypes.oneOf(['bordered', 'elevated']),
  title: PropTypes.node,
  /** Tailwind padding utility — defaults to p-6, matching every existing usage of both patterns except OrderConfirmation's p-8. */
  padding: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Card;
