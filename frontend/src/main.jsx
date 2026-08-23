import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { attemptStaleChunkRecovery } from './utils/staleChunkRecovery';
import './index.css';

// Production Stale Chunk Auto-Recovery — a backstop for a stale-chunk
// failure that never makes it through React's render cycle at all (so
// ChunkErrorBoundary, the primary path, never gets a chance to catch it).
// Installed before the app renders so it's active from the very first
// paint. Both a genuine uncaught exception (`error`) and an unhandled
// promise rejection (`unhandledrejection`) are covered, since a rejected
// dynamic import() can surface either way depending on the browser and
// exactly where the rejection escapes from.
function handleGlobalError(event) {
  const error = event.reason ?? event.error ?? event.message;
  if (attemptStaleChunkRecovery(error)) {
    event.preventDefault?.();
  }
}
window.addEventListener('error', handleGlobalError);
window.addEventListener('unhandledrejection', handleGlobalError);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
