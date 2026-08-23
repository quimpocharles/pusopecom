import { Component } from 'react';
import PropTypes from 'prop-types';
import {
  attemptStaleChunkRecovery,
  hasAlreadyAttemptedRecovery,
  isPaymentInFlight,
  isStaleChunkError,
} from '../../utils/staleChunkRecovery';

// Production Stale Chunk Auto-Recovery — deliberately plain, no design-
// system dependency, so it renders correctly even if the failure that
// triggered it took out other chunks (design tokens, icon libraries) too.
// Copy is intentionally non-technical — the customer should never need to
// understand MIME types, chunks, or deployments.
function StaleChunkFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">We Just Updated Puso</h1>
        <p className="text-gray-600 mb-6">Please refresh the page to continue.</p>
        {/* Explicit user action — always a plain, unconditional reload,
            regardless of the auto-recovery guard's state. */}
        <button onClick={() => window.location.reload()} className="btn-primary">
          Refresh Page
        </button>
      </div>
    </div>
  );
}

// Wraps App.jsx's <Suspense> — a rejected React.lazy() import is thrown
// during render and, with no error boundary above Suspense, previously had
// nowhere to be caught: it became an uncaught exception and the whole tree
// unmounted (the actual "Uncaught TypeError... vendor-react-*.js" console
// entries from the incident that prompted this). This boundary exists only
// to fix that specific stale-deployment failure mode — a non-stale-chunk
// error is deliberately rethrown on the next render, exactly as it would
// have behaved with no boundary here at all, so ordinary application bugs
// are neither hidden nor auto-reloaded.
class ChunkErrorBoundary extends Component {
  state = { status: 'ok', rethrow: null };

  static getDerivedStateFromError(error) {
    if (!isStaleChunkError(error)) {
      return { status: 'ok', rethrow: error };
    }
    // Computed with the exact same conditions attemptStaleChunkRecovery
    // (called from componentDidCatch, right after this) will itself use —
    // so render() and the actual reload decision can never disagree, even
    // when a payment submission is in flight or recovery already ran.
    const willReload = !hasAlreadyAttemptedRecovery() && !isPaymentInFlight();
    return { status: willReload ? 'recovering' : 'fallback', rethrow: null };
  }

  componentDidCatch(error) {
    if (isStaleChunkError(error)) {
      attemptStaleChunkRecovery(error);
    }
  }

  render() {
    if (this.state.rethrow) {
      throw this.state.rethrow;
    }
    if (this.state.status === 'recovering') {
      // A reload is already in flight — render nothing rather than flash
      // fallback UI for a page that's about to navigate away anyway.
      return null;
    }
    if (this.state.status === 'fallback') {
      return <StaleChunkFallback />;
    }
    return this.props.children;
  }
}

ChunkErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ChunkErrorBoundary;
