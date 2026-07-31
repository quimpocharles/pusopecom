import { forwardRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Button — wraps the existing .btn-* classes defined in index.css.
 * Does not introduce any new visual styling; every variant maps 1:1
 * to a class that already exists and is already in use across the app.
 */
const VARIANT_CLASS = {
  primary: 'btn-primary',
  primaryLight: 'btn-primary-light',
  secondary: 'btn-secondary',
  secondaryLight: 'btn-secondary-light',
  outline: 'btn-outline',
  gold: 'btn-gold',
  tryon: 'btn-tryon',
};

const Button = forwardRef(function Button(
  { variant = 'primary', fullWidth = false, className = '', children, ...rest },
  ref
) {
  const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.primary;
  const classes = [variantClass, fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} className={classes} {...rest}>
      {children}
    </button>
  );
});

Button.propTypes = {
  /** Maps directly to an existing .btn-* class — no new styling is introduced by adding a variant. */
  variant: PropTypes.oneOf(Object.keys(VARIANT_CLASS)),
  fullWidth: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Button;
