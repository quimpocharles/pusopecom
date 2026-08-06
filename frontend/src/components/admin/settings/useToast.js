import { useState, useCallback, useRef } from 'react';

// A minimal, reusable success/error toast — no toast library exists
// anywhere in this codebase yet, and pulling one in for a handful of
// Settings pages would be more than this needs. Auto-dismisses after 4s.
export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((type, message) => {
    clearTimeout(timerRef.current);
    setToast({ type, message });
    timerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const dismissToast = useCallback(() => {
    clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  return { toast, showToast, dismissToast };
}

export default useToast;
