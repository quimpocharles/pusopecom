import { forwardRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Button — the platform's three functional types, per
 * docs/design/COMPONENT_SPECIFICATION.md § Buttons: Primary (one
 * high-emphasis action per view), Secondary (bordered, lower priority),
 * Text (label only, lowest emphasis). No feature — including virtual
 * try-on — gets a bespoke variant of its own; use Primary for it like any
 * other primary action.
 *
 * Nothing in production currently imports this component (see
 * docs/design/MIGRATION_PLAN.md), so this variant set was free to change
 * without touching any page. The underlying `.btn-*` classes in index.css
 * are what real pages reference directly today.
 */
const VARIANT_CLASS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  text: 'btn-text',
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
  variant: PropTypes.oneOf(Object.keys(VARIANT_CLASS)),
  fullWidth: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Button;
