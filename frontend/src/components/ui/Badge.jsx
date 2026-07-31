import PropTypes from 'prop-types';

/**
 * Badge — wraps the existing .badge / .badge-* classes defined in index.css.
 * These classes already exist in the stylesheet but, per the platform audit,
 * were not being consumed by any component — every "Sale" / "Try-On" style
 * tag on the site was hand-rolled instead. This component activates the
 * existing CSS rather than introducing anything new.
 */
const TONE_CLASS = {
  primary: 'badge-primary',
  secondary: 'badge-secondary',
  accent: 'badge-accent',
  success: 'badge-success',
};

const Badge = ({ tone = 'primary', className = '', children }) => {
  const toneClass = TONE_CLASS[tone] || TONE_CLASS.primary;
  const classes = ['badge', toneClass, className].filter(Boolean).join(' ');

  return <span className={classes}>{children}</span>;
};

Badge.propTypes = {
  /** Maps directly to an existing .badge-* class. */
  tone: PropTypes.oneOf(Object.keys(TONE_CLASS)),
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Badge;
