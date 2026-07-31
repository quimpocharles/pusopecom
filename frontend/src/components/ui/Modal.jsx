import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import PropTypes from 'prop-types';

/**
 * Modal — consolidates the ad hoc `fixed inset-0 bg-black/50 ...` overlay
 * pattern already used across VirtualTryOn.jsx, CartDrawer.jsx's remove
 * confirmation, AdminProducts.jsx, and AdminLeagues.jsx into one component,
 * with the accessibility behavior the platform audit found none of those
 * had: Escape-to-close, a real focus trap, role="dialog", aria-modal, and
 * backdrop click-to-close.
 *
 * Visual styling is reproduced from the existing markup exactly — no new
 * classes are introduced. `size` maps to the three max-width values already
 * observed in the codebase (max-w-sm, max-w-md, max-w-lg).
 */
const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  full: 'max-w-2xl',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ open, onClose, title, size = 'md', className = '', children }) => {
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // Open/close side effects: lock body scroll, remember and restore focus.
  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    // Move focus into the panel once it's mounted.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const firstFocusable = panel.querySelector(FOCUSABLE_SELECTOR);
      (firstFocusable || panel).focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = '';
      // Restore focus to whatever triggered the modal.
      if (previouslyFocusedRef.current && previouslyFocusedRef.current.focus) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [open]);

  // Escape closes; Tab/Shift+Tab is trapped inside the panel.
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`bg-white rounded-xl w-full ${sizeClass} max-h-[90vh] overflow-y-auto ${className}`}
      >
        {title && (
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-bold text-lg">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
};

Modal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  /** Maps to an existing max-width value already used somewhere in the codebase. */
  size: PropTypes.oneOf(Object.keys(SIZE_CLASS)),
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Modal;
