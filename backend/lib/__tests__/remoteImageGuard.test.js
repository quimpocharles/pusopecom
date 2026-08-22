import { describe, it, expect } from 'vitest';
import { assertSafeRemoteImageUrl } from '../remoteImageGuard.js';

describe('assertSafeRemoteImageUrl — SSRF guard (Fit Check product image)', () => {
  const silent = { logger: null };

  it.each([
    ['Cloudinary res URL', 'https://res.cloudinary.com/demo/image/upload/v1/x.jpg', true],
    ['Cloudinary root domain', 'https://cloudinary.com/x.jpg', true],
    ['Subdomain of cloudinary.com', 'https://foo.cloudinary.com/x.jpg', true],
  ])('accepts %s', (_label, url, expected) => {
    expect(assertSafeRemoteImageUrl(url, silent)).toBe(expected);
  });

  it.each([
    ['http (non-TLS)', 'http://res.cloudinary.com/x.jpg'],
    ['cloud metadata IP (no host match)', 'https://169.254.169.254/latest/meta-data/'],
    ['localhost', 'https://localhost:5432'],
    ['internal hostname', 'https://internal-db.internal:5432/'],
    ['non-Cloudinary public host', 'https://example.com/img.jpg'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['empty string', ''],
    ['not a URL', 'not-a-url'],
  ])('rejects %s', (_label, url) => {
    expect(assertSafeRemoteImageUrl(url, silent)).toBe(false);
  });
});
