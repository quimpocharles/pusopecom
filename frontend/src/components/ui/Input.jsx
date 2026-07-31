import { forwardRef, useId } from 'react';
import PropTypes from 'prop-types';

/**
 * Input — wraps the existing `.input-field` class and the label/error
 * markup pattern already used consistently across Login.jsx, Register.jsx,
 * Checkout.jsx, and Account.jsx (label: text-sm font-medium text-gray-700;
 * error: text-red-600 text-sm mt-1).
 *
 * Forwards its ref so it can be used directly with react-hook-form's
 * `{...register('field')}` spread, which is how every existing form on the
 * platform is wired — this component only works as a drop-in replacement
 * if that continues to work unchanged.
 */
const Input = forwardRef(function Input(
  { label, error, helperText, id, className = '', ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`input-field ${className}`.trim()}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-red-600 text-sm mt-1">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="text-gray-400 text-sm mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.propTypes = {
  label: PropTypes.node,
  /** Matches the existing errors.field.message pattern from react-hook-form usage. */
  error: PropTypes.node,
  helperText: PropTypes.node,
  id: PropTypes.string,
  className: PropTypes.string,
};

export default Input;
