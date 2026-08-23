import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChunkErrorBoundary from '../ChunkErrorBoundary';
import { clearRecoveryGuard, clearPaymentInFlight, markPaymentInFlight, hasAlreadyAttemptedRecovery } from '../../../utils/staleChunkRecovery';

// React logs caught errors to the console even when an error boundary
// handles them — silence that expected noise per test, restore after.
let consoleErrorSpy;
beforeEach(() => {
  sessionStorage.clear();
  clearRecoveryGuard();
  clearPaymentInFlight();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  const originalLocation = window.location;
  delete window.location;
  window.location = { ...originalLocation, reload: vi.fn() };
});

function ThrowStaleChunkError() {
  throw new Error('Failed to fetch dynamically imported module: https://pusostore.com/assets/Checkout-abc123.js');
}

function ThrowOrdinaryError() {
  throw new Error("Cannot read properties of undefined (reading 'map')");
}

describe('ChunkErrorBoundary', () => {
  it('8. renders children normally when nothing throws — existing routing/startup behavior is unaffected', () => {
    render(
      <ChunkErrorBoundary>
        <div>Home page content</div>
      </ChunkErrorBoundary>
    );

    expect(screen.getByText('Home page content')).toBeTruthy();
  });

  it('1. a stale-chunk error triggers one automatic reload', () => {
    render(
      <ChunkErrorBoundary>
        <ThrowStaleChunkError />
      </ChunkErrorBoundary>
    );

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('6. if recovery was already attempted, the fallback UI is shown instead of reloading again', () => {
    // Simulate "we already tried once this cycle" — e.g. surviving from a
    // prior render in the same session.
    sessionStorage.setItem('puso-stale-chunk-reload-attempted', '1');

    render(
      <ChunkErrorBoundary>
        <ThrowStaleChunkError />
      </ChunkErrorBoundary>
    );

    expect(window.location.reload).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'We Just Updated Puso' })).toBeTruthy();
    expect(screen.getByText('Please refresh the page to continue.')).toBeTruthy();
  });

  it('7. the fallback "Refresh Page" action performs a normal hard reload', () => {
    sessionStorage.setItem('puso-stale-chunk-reload-attempted', '1');

    render(
      <ChunkErrorBoundary>
        <ThrowStaleChunkError />
      </ChunkErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Page' }));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('never uses technical language in the fallback copy', () => {
    sessionStorage.setItem('puso-stale-chunk-reload-attempted', '1');

    render(
      <ChunkErrorBoundary>
        <ThrowStaleChunkError />
      </ChunkErrorBoundary>
    );

    const bodyText = document.body.textContent.toLowerCase();
    for (const forbidden of ['mime type', 'javascript chunk', 'vite', 'deployment', 'module import']) {
      expect(bodyText).not.toContain(forbidden);
    }
  });

  it('3. an ordinary application error does not trigger the auto-reload — it propagates like it would with no boundary', () => {
    expect(() =>
      render(
        <ChunkErrorBoundary>
          <ThrowOrdinaryError />
        </ChunkErrorBoundary>
      )
    ).toThrow("Cannot read properties of undefined (reading 'map')");

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('declines to reload while a payment submission is in flight, and shows the fallback instead of hanging blank', () => {
    markPaymentInFlight();

    render(
      <ChunkErrorBoundary>
        <ThrowStaleChunkError />
      </ChunkErrorBoundary>
    );

    expect(window.location.reload).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'We Just Updated Puso' })).toBeTruthy();
    expect(hasAlreadyAttemptedRecovery()).toBe(false); // the one-shot guard itself was never consumed
  });
});
