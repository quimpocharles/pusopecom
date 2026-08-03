import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { EventEmitter } from 'events';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const uploadStreamMock = vi.fn();
vi.mock('../../config/cloudinary.js', () => ({
  default: { uploader: { upload_stream: (...args) => uploadStreamMock(...args) } },
}));

const { default: uploadRouter } = await import('../upload.js');

const app = express();
app.use('/api/upload', uploadRouter);

beforeEach(() => {
  uploadStreamMock.mockReset();
});

// A minimal stand-in for what cloudinary.uploader.upload_stream returns —
// a writable stream. `end()` is wired by each test to either invoke the
// callback (the documented success/failure path) or emit 'error' directly
// on the stream (the path that previously had no listener and crashed the
// whole process — see upload.js's own comment on this fix).
function fakeStream(callback, { emitStreamError } = {}) {
  const emitter = new EventEmitter();
  emitter.end = () => {
    if (emitStreamError) {
      emitter.emit('error', emitStreamError);
    }
  };
  return emitter;
}

describe('POST /upload — a stream-level error must not crash the process', () => {
  it('passes disable_promises so cloudinary\'s internal Q deferred is never rejected unconsumed', async () => {
    // cloudinary@1.41.3's call_api() creates a Q.defer() per upload but never
    // exposes it for the streaming API — on error that deferred rejects with
    // no consumer, and Q's own unhandled-rejection tracker forwards that to
    // process's real 'unhandledRejection' independently of our callback,
    // which previously crashed the whole server (verified via a direct repro
    // against the real SDK, outside this test's mocked boundary).
    // disable_promises skips that bookkeeping so the leak can't happen.
    uploadStreamMock.mockImplementation((options, callback) => {
      expect(options.disable_promises).toBe(true);
      const stream = fakeStream(callback);
      const originalEnd = stream.end;
      stream.end = () => {
        callback(null, { secure_url: 'https://res.cloudinary.com/test.png', public_id: 'test' });
        originalEnd();
      };
      return stream;
    });

    const res = await request(app).post('/api/upload').attach('image', Buffer.from('fake-image-bytes'), 'test.png');

    expect(res.status).toBe(200);
  });

  it('responds 500 instead of throwing when Cloudinary emits "error" on the stream (e.g. a DNS failure)', async () => {
    uploadStreamMock.mockImplementation((options, callback) => {
      // Simulates getaddrinfo ENOTFOUND: the callback is never invoked,
      // only the stream's own 'error' event fires — exactly the shape that
      // crashed the server before stream.on('error', reject) was added.
      const dnsError = Object.assign(new Error('getaddrinfo ENOTFOUND api.cloudinary.com'), { code: 'ENOTFOUND' });
      return fakeStream(callback, { emitStreamError: dnsError });
    });

    const uncaughtHandler = vi.fn();
    process.once('uncaughtException', uncaughtHandler);
    process.once('unhandledRejection', uncaughtHandler);

    const res = await request(app).post('/api/upload').attach('image', Buffer.from('fake-image-bytes'), 'test.png');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(uncaughtHandler).not.toHaveBeenCalled();
  });

  it('still succeeds normally when Cloudinary resolves via the callback', async () => {
    uploadStreamMock.mockImplementation((options, callback) => {
      const stream = fakeStream(callback);
      const originalEnd = stream.end;
      stream.end = () => {
        callback(null, { secure_url: 'https://res.cloudinary.com/test.png', public_id: 'test' });
        originalEnd();
      };
      return stream;
    });

    const res = await request(app).post('/api/upload').attach('image', Buffer.from('fake-image-bytes'), 'test.png');

    expect(res.status).toBe(200);
    expect(res.body.data.url).toBe('https://res.cloudinary.com/test.png');
  });
});
