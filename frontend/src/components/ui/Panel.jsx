import PropTypes from 'prop-types';

/**
 * Panel — replaces Card, per docs/design/DESIGN_SYSTEM.md § Panels
 * ("Card is retired as a concept, not just a name"). One flat, bordered
 * treatment — no "elevated" variant, no shadow, no hover elevation —
 * instead of the old bordered/elevated split.
 *
 * Renders the shared `.card` class defined in index.css, the same class
 * real pages (Checkout, OrderConfirmation, AdminPickup, and others) already
 * reference directly via className="card". Panel and every direct `.card`
 * usage now resolve to the identical treatment, from one definition.
 */
const Panel = ({ title, padding = 'p-6', className = '', children }) => {
  const classes = ['card', padding, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {title && (
        <h3 className="text-editorial-title font-semibold text-ink-900 mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
};

Panel.propTypes = {
  title: PropTypes.node,
  /** Tailwind padding utility — defaults to p-6, matching the majority of existing `.card` usage. */
  padding: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Panel;
