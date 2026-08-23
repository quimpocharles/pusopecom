import { describe, it, expect } from 'vitest';
import { isDevHost, productionBaseUrl, PRODUCTION_HOST } from '../appUrl.js';

describe('isDevHost — detects development hosts', () => {
  it.each([
    ['http://localhost:5173', true],
    ['http://localhost:5001', true],
    ['https://localhost:5173', true],
    ['http://127.0.0.1:5173', true],
    ['https://isolated-old-crayon.ngrok-free.dev', true],
    ['https://something.ngrok.app', true],
    ['https://tunnel.ngrok.io/order/x', true],
    ['https://pusostore.com', false],
    ['https://pusostore.com/order/PS-1', false],
    ['https://mail.pusostore.com', false],
  ])('classifies %s as %s', (input, expected) => {
    expect(isDevHost(input)).toBe(expected);
  });

  it('is false for empty/non-string input', () => {
    expect(isDevHost('')).toBe(false);
    expect(isDevHost(undefined)).toBe(false);
    expect(isDevHost(null)).toBe(false);
  });
});

describe('productionBaseUrl — production never resolves to a dev host', () => {
  it('uses FRONTEND_URL as-is when it is a real domain', () => {
    expect(productionBaseUrl({ FRONTEND_URL: 'https://pusostore.com' })).toBe('https://pusostore.com');
  });

  it('falls back to the production host for a localhost FRONTEND_URL', () => {
    expect(productionBaseUrl({ FRONTEND_URL: 'http://localhost:5173' })).toBe(PRODUCTION_HOST);
  });

  it('falls back to the production host for an ngrok FRONTEND_URL', () => {
    expect(productionBaseUrl({ FRONTEND_URL: 'https://isolated-old-crayon.ngrok-free.dev' })).toBe(PRODUCTION_HOST);
  });

  it('falls back to the production host when FRONTEND_URL is unset', () => {
    expect(productionBaseUrl({})).toBe(PRODUCTION_HOST);
  });

  it('strips a trailing slash from a real domain', () => {
    expect(productionBaseUrl({ FRONTEND_URL: 'https://pusostore.com/' })).toBe('https://pusostore.com');
  });

  it('sanitizes a dev host in any environment — emails must never point at a dev tunnel', () => {
    // The email-link build path is used for real sends, not just production.
    // A dev tunnel (ngrok) or localhost is never a valid email destination,
    // so productionBaseUrl refuses it regardless of NODE_ENV.
    expect(productionBaseUrl({ FRONTEND_URL: 'https://dev.ngrok-free.dev' })).toBe(PRODUCTION_HOST);
  });
});
