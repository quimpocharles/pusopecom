import PropTypes from 'prop-types';

/**
 * EmptyState — wraps the "No products found" / "No orders found" pattern
 * already repeated, with minor variation, across Products.jsx,
 * AdminOrders.jsx, AdminUsers.jsx, AdminLeagues.jsx, AdminProducts.jsx, and
 * CartDrawer.jsx. Reproduces that pattern's existing spacing and color
 * tokens (text-center py-20, text-gray-500 text-lg, btn-secondary for the
 * optional action) rather than introducing anything new.
 */
const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction, className = '' }) => {
  return (
    <div className={`text-center py-20 ${className}`.trim()}>
      {Icon && <Icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />}
      <p className="text-gray-500 text-lg mb-2">{title}</p>
      {description && <p className="text-gray-400 text-sm mb-4">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-secondary mt-2">
          {actionLabel}
        </button>
      )}
    </div>
  );
};

EmptyState.propTypes = {
  /** An icon component, e.g. from @heroicons/react, rendered the same way StatsCard already renders its icon prop. */
  icon: PropTypes.elementType,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  actionLabel: PropTypes.node,
  onAction: PropTypes.func,
  className: PropTypes.string,
};

export default EmptyState;
