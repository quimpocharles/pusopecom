import PropTypes from 'prop-types';

/**
 * ErrorState — there is no single existing pattern for this in the
 * codebase today (the platform audit found only ad hoc inline error
 * messages), so this composes the layout shape already established by the
 * empty-state pattern with the error color token already used for form
 * validation errors across the app (text-red-600, from Login.jsx /
 * Register.jsx). No new color or spacing value is introduced.
 *
 * Deliberately distinct from EmptyState in intent: this is for "something
 * broke, try again," not "there's nothing here yet" — the action is a
 * retry, not a call to browse elsewhere.
 */
const ErrorState = ({ title = 'Something went wrong', description, onRetry, retryLabel = 'Try Again', className = '' }) => {
  return (
    <div className={`text-center py-20 ${className}`.trim()} role="alert">
      <p className="text-red-600 text-lg font-medium mb-2">{title}</p>
      {description && <p className="text-gray-400 text-sm mb-4">{description}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-outline mt-2">
          {retryLabel}
        </button>
      )}
    </div>
  );
};

ErrorState.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  onRetry: PropTypes.func,
  retryLabel: PropTypes.node,
  className: PropTypes.string,
};

export default ErrorState;
