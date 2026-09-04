import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');

// Every test gets a fresh module instance (vi.resetModules + a dynamic
// re-import) rather than one shared top-level import — unlike
// xenditGateway.js/mayaGateway.js, this gateway caches its bearer token in
// module-level state (cachedToken), and reusing one imported instance
// across tests would let an earlier test's cached token silently leak into
// a later one, throwing off both the mocked-call ordering and the
// caching/expiry assertions below. A fresh module per test makes every
// test's starting state (no cached token) explicit and order-independent.
let epaygamesGateway;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  epaygamesGateway = await import('../epaygamesGateway.js');
  process.env.EPAYGAMES_USERNAME = 'test-merchant';
  process.env.EPAYGAMES_PASSWORD = 'test-password';
});

afterEach(() => {
  vi.useRealTimers();
});

function makeOrder(overrides = {}) {
  return {
    orderNumber: 'PS-20260827-ABCDEF',
    total: 1044,
    email: 'buyer@test.local',
    user: null,
    // A real ePayGames provider channel_code (confirmed against the real
    // sandbox 2026-08-27), not an internal GCASH/MAYA vocabulary — Phase
    // 4/5's dispatch passes getChannels()'s own codes straight through to
    // the frontend and back, so this is what a real order actually carries.
    paymentChannel: 'PAYMAYA_QR',
    shippingAddress: {
      fullName: 'Juan Dela Cruz',
      phone: '09171234567',
      address: '123 Rizal St',
      city: 'Quezon City',
      province: 'Metro Manila',
      zipCode: '1100',
    },
    items: [{ name: 'Jersey', quantity: 1, product: 'prod-1', price: 999, size: 'M' }],
    ...overrides,
  };
}

function mockToken(token = 'tok_1', expiresIn = 3600) {
  return { data: { message: 'Successfully authenticated.', data: { token, type: 'Bearer', expires_in: expiresIn } } };
}

function mockTransaction(overrides = {}) {
  return {
    data: {
      message: 'Transaction has been successfully generated.',
      data: {
        reference_no: 'PS-20260827-ABCDEF#aaaaaaaaaaaa',
        status: 'pending',
        web_payment_url: 'https://l-stg.epayg.link/abc123',
        is_expired: false,
        amount: 1044,
        ...overrides,
      },
    },
  };
}

describe('epaygamesGateway — token creation and caching', () => {
  it('creates a token once and reuses it for a second call within its lifetime', async () => {
    axios.post
      .mockResolvedValueOnce(mockToken())
      .mockResolvedValueOnce(mockTransaction({ reference_no: 'PS-1#aaa' }))
      .mockResolvedValueOnce(mockTransaction({ reference_no: 'PS-1#bbb' }));

    await epaygamesGateway.createCheckoutSession(makeOrder());
    await epaygamesGateway.createCheckoutSession(makeOrder());

    const tokenCalls = axios.post.mock.calls.filter(([url]) => url.includes('/token/create'));
    expect(tokenCalls).toHaveLength(1);
    expect(axios.post).toHaveBeenCalledTimes(3); // 1 token + 2 generate
  });

  it('requests a fresh token once the cached one is past its documented ~55-minute reuse window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));

    axios.post
      .mockResolvedValueOnce(mockToken('tok_1', 3600))
      .mockResolvedValueOnce(mockTransaction());
    await epaygamesGateway.createCheckoutSession(makeOrder());

    // 56 minutes later — past the 5-minute refresh margin on a 60-minute token.
    vi.setSystemTime(new Date('2030-01-01T00:56:00Z'));

    axios.post
      .mockResolvedValueOnce(mockToken('tok_2', 3600))
      .mockResolvedValueOnce(mockTransaction());
    await epaygamesGateway.createCheckoutSession(makeOrder());

    const tokenCalls = axios.post.mock.calls.filter(([url]) => url.includes('/token/create'));
    expect(tokenCalls).toHaveLength(2);
  });

  it('never logs the raw username/password on an authentication failure', async () => {
    const authError = new Error('Request failed with status code 401');
    authError.response = { status: 401, data: { message: 'Unauthenticated.' } };
    authError.config = { data: JSON.stringify({ username: 'test-merchant', password: 'super-secret' }) };
    axios.post.mockRejectedValueOnce(authError);

    await expect(epaygamesGateway.createCheckoutSession(makeOrder())).rejects.toThrow('Failed to authenticate with ePayGames');
  });
});

describe('epaygamesGateway.createCheckoutSession', () => {
  // '__' (not Xendit/Maya's shared '#') — confirmed 2026-08-28 against the
  // real sandbox that a '#' in reference_no breaks ePayGames' own hosted-
  // checkout page (deferred/load 500s), while '__' does not.
  it('sends a reference_no built from the order number plus a per-attempt suffix, using ePayGames\' own \'__\' delimiter (not Xendit/Maya\'s shared \'#\')', async () => {
    axios.post
      .mockResolvedValueOnce(mockToken())
      .mockResolvedValueOnce(mockTransaction({ reference_no: 'ignored-in-request-assert' }))
      .mockResolvedValueOnce(mockTransaction({ reference_no: 'ignored-in-request-assert' }));

    const order = makeOrder();
    await epaygamesGateway.createCheckoutSession(order);
    await epaygamesGateway.createCheckoutSession(order);

    const generateCalls = axios.post.mock.calls.filter(([url]) => url.includes('/transactions/generate'));
    const [firstRef, secondRef] = generateCalls.map(([, body]) => body.reference_no);

    expect(firstRef.startsWith(`${order.orderNumber}__`)).toBe(true);
    expect(secondRef.startsWith(`${order.orderNumber}__`)).toBe(true);
    expect(firstRef).not.toBe(secondRef);
  });

  it('never generates a \'#\' anywhere in the reference_no — that delimiter is confirmed to break ePayGames\' own hosted-checkout page', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder());

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.reference_no).not.toContain('#');
  });

  it('sends the order amount and the chosen channel_code', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder({ total: 2500, paymentChannel: 'PAYMAYA_QR' }));

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.amount).toBe(2500);
    expect(body.channel_code).toBe('PAYMAYA_QR');
  });

  // Regression test (2026-09-04): a real checkout 500'd because Generate
  // Transaction was sent WITHOUT these customer fields and ePayGames
  // rejected it 422 ('The email field is required. (and 8 more errors)').
  // All 9 must be present, sourced from the order's own email and nested
  // shippingAddress — never a second customer model.
  it('sends all 9 customer fields ePayGames requires, sourced from order.email and order.shippingAddress', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder({
      email: 'buyer@test.local',
      shippingAddress: {
        fullName: 'Juan Dela Cruz',
        phone: '09171234567',
        address: '123 Rizal St',
        city: 'Quezon City',
        province: 'Metro Manila',
        zipCode: '1100',
        country: 'Philippines',
      },
    }));

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.email).toBe('buyer@test.local');
    expect(body.mobile_number).toBe('09171234567');
    expect(body.first_name).toBe('Juan');
    expect(body.last_name).toBe('Dela Cruz');
    expect(body.address).toBe('123 Rizal St');
    expect(body.city).toBe('Quezon City');
    expect(body.state).toBe('Metro Manila');
    expect(body.zip_code).toBe('1100');
    expect(body.country_code).toBe('PH');
  });

  it('keeps a multi-word last name intact when splitting fullName', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder({
      shippingAddress: { fullName: 'Maria Clara Santos', phone: '09170000000', country: 'Philippines' },
    }));

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.first_name).toBe('Maria');
    expect(body.last_name).toBe('Clara Santos');
  });

  it('maps a non-Philippines checkout country name to its ISO-2 code (Singapore -> SG)', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder({
      shippingAddress: { fullName: 'Jane Doe', phone: '1234', country: 'Singapore' },
    }));

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.country_code).toBe('SG');
  });

  // Regression test (2026-09-04): a real Japan checkout 422'd on
  // country_code because 'Japan' was passed through unchanged instead of
  // being mapped to 'JP'. The country field is a full name drawn from the
  // fixed catalog in lib/config/shipping.js's COUNTRY_REGION_MAP, so the
  // gateway maps every one of those names to its ISO-2 code.
  it('maps Japan to JP (the country name that 422\'d a real checkout)', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder({
      shippingAddress: { fullName: 'Taro Yamada', phone: '09012345678', country: 'Japan' },
    }));

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.country_code).toBe('JP');
  });

  it('leaves an already-valid ISO-2 code unchanged, normalized to uppercase', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder({
      shippingAddress: { fullName: 'Jane Doe', phone: '1234', country: 'jp' },
    }));

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.country_code).toBe('JP');
  });

  it('returns null for a country name outside the checkout catalog rather than guessing a code', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder({
      shippingAddress: { fullName: 'Jane Doe', phone: '1234', country: 'Atlantis' },
    }));

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.country_code).toBeNull();
  });

  // Regression test (2026-08-27): a real sandbox call proved PAYMAYA_QR
  // never round-tripped correctly before this fix — the removed
  // CHANNEL_CODE_MAP only recognized internal 'GCASH'/'MAYA' keys, but
  // Phase 4/5's frontend actually submits ePayGames' own channel_code
  // (e.g. 'PAYMAYA_QR', sourced live from getChannels()) as paymentChannel.
  it('passes ePayGames\' own real provider channel_code straight through, unmodified — the actual round trip a live checkout performs', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder({ paymentChannel: 'PAYMAYA_QR' }));

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.channel_code).toBe('PAYMAYA_QR');
  });

  it('also passes through any other real provider code untranslated (BAYAD, PAYANDGO, PALAWANPAY_OTC — all confirmed live in the real sandbox catalog, none of which the old static map ever knew about)', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(mockTransaction());

    await epaygamesGateway.createCheckoutSession(makeOrder({ paymentChannel: 'PALAWANPAY_OTC' }));

    const [, body] = axios.post.mock.calls.find(([url]) => url.includes('/transactions/generate'));
    expect(body.channel_code).toBe('PALAWANPAY_OTC');
  });

  it('rejects a missing/empty payment channel before ever calling ePayGames, rather than guessing one', async () => {
    await expect(epaygamesGateway.createCheckoutSession(makeOrder({ paymentChannel: '' }))).rejects.toThrow();
    expect(axios.post).not.toHaveBeenCalled();

    await expect(epaygamesGateway.createCheckoutSession(makeOrder({ paymentChannel: undefined }))).rejects.toThrow();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('returns the real reference_no/web_payment_url as paymentReference/redirectUrl', async () => {
    axios.post
      .mockResolvedValueOnce(mockToken())
      .mockResolvedValueOnce(mockTransaction({ reference_no: 'PS-20260827-ABCDEF#deadbeef0000', web_payment_url: 'https://l-stg.epayg.link/xyz' }));

    const result = await epaygamesGateway.createCheckoutSession(makeOrder());
    expect(result.paymentReference).toBe('PS-20260827-ABCDEF#deadbeef0000');
    expect(result.redirectUrl).toBe('https://l-stg.epayg.link/xyz');
  });

  it('surfaces the real, per-transaction expires_at as an optional Date, unlike Xendit/Maya', async () => {
    axios.post
      .mockResolvedValueOnce(mockToken())
      .mockResolvedValueOnce(mockTransaction({ expires_at: '2026-09-01T10:00:06+08:00' }));

    const result = await epaygamesGateway.createCheckoutSession(makeOrder());
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.toISOString()).toBe(new Date('2026-09-01T10:00:06+08:00').toISOString());
  });

  it('omits expiresAt entirely when ePayGames does not return one, preserving the existing gateway interface', async () => {
    const noExpiry = mockTransaction();
    delete noExpiry.data.data.expires_at;
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce(noExpiry);

    const result = await epaygamesGateway.createCheckoutSession(makeOrder());
    expect('expiresAt' in result).toBe(false);
  });

  it('throws rather than returning a session when the response is missing the redirect URL or reference', async () => {
    axios.post.mockResolvedValueOnce(mockToken()).mockResolvedValueOnce({ data: { data: { status: 'pending' } } });

    await expect(epaygamesGateway.createCheckoutSession(makeOrder())).rejects.toThrow();
  });

  it('on an ambiguous failure (no response / 5xx), looks up the same reference_no before ever resubmitting', async () => {
    const timeoutError = new Error('timeout of 10000ms exceeded');
    // No .response — a genuine network-level failure, the documented
    // "ambiguous" case per ePayGames' own Safe-Retry Rule.

    axios.post
      .mockResolvedValueOnce(mockToken())
      .mockRejectedValueOnce(timeoutError); // the ambiguous generate call
    axios.get.mockResolvedValueOnce({
      // Real sandbox shape (confirmed 2026-08-27): the list is nested under
      // data.data.transactions, not data.data directly.
      data: { data: { transactions: [{ reference_no: 'found-existing', status: 'pending', web_payment_url: 'https://l-stg.epayg.link/found', is_expired: false }] } },
    });

    const result = await epaygamesGateway.createCheckoutSession(makeOrder());

    expect(result.paymentReference).toBe('found-existing');
    // Confirmed found via lookup — must NOT have resubmitted a second generate call.
    const generateCalls = axios.post.mock.calls.filter(([url]) => url.includes('/transactions/generate'));
    expect(generateCalls).toHaveLength(1);
  });

  it('resubmits with the SAME reference_no, exactly once, only after the lookup confirms the original attempt never landed', async () => {
    const timeoutError = new Error('socket hang up');

    axios.post
      .mockResolvedValueOnce(mockToken())
      .mockRejectedValueOnce(timeoutError) // ambiguous first attempt
      .mockResolvedValueOnce(mockTransaction({ reference_no: 'PS-retry#confirmed' })); // the safe resubmit
    axios.get.mockResolvedValueOnce({ data: { data: { transactions: [] } } }); // lookup: confirmed not to exist

    const result = await epaygamesGateway.createCheckoutSession(makeOrder());

    expect(result.paymentReference).toBe('PS-retry#confirmed');
    const generateCalls = axios.post.mock.calls.filter(([url]) => url.includes('/transactions/generate'));
    expect(generateCalls).toHaveLength(2);
    // The retry must reuse the identical reference_no — a fresh one would
    // defeat the whole point of the idempotency guarantee.
    expect(generateCalls[0][1].reference_no).toBe(generateCalls[1][1].reference_no);
  });

  it('does NOT look up or retry on a definite (4xx) rejection — surfaces the error directly', async () => {
    const validationError = new Error('Request failed with status code 422');
    validationError.response = { status: 422, data: { message: 'The given data was invalid.' } };
    axios.post.mockResolvedValueOnce(mockToken()).mockRejectedValueOnce(validationError);

    await expect(epaygamesGateway.createCheckoutSession(makeOrder())).rejects.toThrow();
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('epaygamesGateway.getPaymentStatus', () => {
  // Every mock below wraps its transaction(s) in { transactions: [...] } —
  // the real sandbox response shape for GET /v1/biller/transactions,
  // confirmed directly 2026-08-27. The list is not a bare array under
  // data.data the way it was originally (and wrongly) assumed to be; that
  // mismatch was a real bug (lookupTransactionByReference silently always
  // returned null) fixed alongside these test updates.
  it('normalizes completed to succeeded', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({ data: { data: { transactions: [{ reference_no: 'ref-1', status: 'completed', is_expired: false }] } } });

    const result = await epaygamesGateway.getPaymentStatus('ref-1');
    expect(result.status).toBe('succeeded');
  });

  it('normalizes pending to pending', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({ data: { data: { transactions: [{ reference_no: 'ref-1', status: 'pending', is_expired: false }] } } });

    const result = await epaygamesGateway.getPaymentStatus('ref-1');
    expect(result.status).toBe('pending');
  });

  it('normalizes cancelled (is_expired: false) to failed — genuine failure/cancellation, indistinguishable per ePayGames\' own documented limitation', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({ data: { data: { transactions: [{ reference_no: 'ref-1', status: 'cancelled', is_expired: false }] } } });

    const result = await epaygamesGateway.getPaymentStatus('ref-1');
    expect(result.status).toBe('failed');
  });

  it('normalizes cancelled (is_expired: true) to expired — the one lever ePayGames documents for splitting this apart', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({ data: { data: { transactions: [{ reference_no: 'ref-1', status: 'cancelled', is_expired: true }] } } });

    const result = await epaygamesGateway.getPaymentStatus('ref-1');
    expect(result.status).toBe('expired');
  });

  it('never treats an unrecognized/unknown status as paid — falls through to pending', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({ data: { data: { transactions: [{ reference_no: 'ref-1', status: 'something_new_and_undocumented' }] } } });

    const result = await epaygamesGateway.getPaymentStatus('ref-1');
    expect(result.status).toBe('pending');
  });

  it('treats an empty lookup result (no matching transaction) as pending, never as a terminal state', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({ data: { data: { transactions: [] } } });

    const result = await epaygamesGateway.getPaymentStatus('ref-unknown');
    expect(result.status).toBe('pending');
  });

  it('treats a malformed/missing transactions field as pending rather than throwing — never assumes the response is well-formed', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await epaygamesGateway.getPaymentStatus('ref-unknown');
    expect(result.status).toBe('pending');
  });

  it('preserves the gateway\'s own amount and reference_no untouched in raw, for the amount/reference cross-checks a later webhook phase will need', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({
      data: { data: { transactions: [{ reference_no: 'ref-amt', status: 'completed', is_expired: false, amount: 777.5 }] } },
    });

    const result = await epaygamesGateway.getPaymentStatus('ref-amt');
    expect(result.raw.reference_no).toBe('ref-amt');
    expect(result.raw.amount).toBe(777.5);
  });

  it('wraps a transport-level failure in a clean, generic error rather than leaking the raw axios error', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));

    await expect(epaygamesGateway.getPaymentStatus('ref-1')).rejects.toThrow('Failed to retrieve checkout status');
  });
});

describe('epaygamesGateway.issueRefund', () => {
  it('throws EpaygamesRefundNotSupportedError rather than faking success or silently no-op-ing', async () => {
    await expect(epaygamesGateway.issueRefund('ref-1', 500, 'REQUESTED_BY_CUSTOMER'))
      .rejects.toBeInstanceOf(epaygamesGateway.EpaygamesRefundNotSupportedError);
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('epaygamesGateway.getChannels', () => {
  it('normalizes the documented channel list, never hardcoding a static catalog', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({
      data: {
        data: [
          { name: 'Maya', slug: 'paymaya', code: 'PAYMAYA_QR', logo: 'https://cdn.eplayment.co/x.jpg', is_web_payment: true, is_disabled: false },
          { name: 'GCash', slug: 'gcash-trn', code: 'GCASH_TRN', logo: 'https://cdn.eplayment.co/y.png', is_web_payment: true, is_disabled: true },
        ],
      },
    });

    const channels = await epaygamesGateway.getChannels();
    expect(channels).toEqual([
      { code: 'PAYMAYA_QR', name: 'Maya', slug: 'paymaya', logo: 'https://cdn.eplayment.co/x.jpg', isDisabled: false },
      { code: 'GCASH_TRN', name: 'GCash', slug: 'gcash-trn', logo: 'https://cdn.eplayment.co/y.png', isDisabled: true },
    ]);
  });

  it('throws a clean error on a transport failure', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockRejectedValueOnce(new Error('network error'));

    await expect(epaygamesGateway.getChannels()).rejects.toThrow('Failed to retrieve payment channels');
  });
});

describe('epaygamesGateway.calculateFee', () => {
  it('normalizes the live fee-calculation response', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({
      data: { data: { subtotal_amount: 1000, service_fee: 0, total_amount: 1000 } },
    });

    const result = await epaygamesGateway.calculateFee('GCASH_QRPH', 1000);
    expect(result).toMatchObject({ subtotal: 1000, fee: 0, total: 1000 });

    const [, config] = axios.get.mock.calls[0];
    expect(config.params).toEqual({ channel_code: 'GCASH_QRPH', amount: 1000 });
  });

  it('throws rather than trusting a response missing total_amount', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockResolvedValueOnce({ data: { data: {} } });

    await expect(epaygamesGateway.calculateFee('GCASH_QRPH', 1000)).rejects.toThrow();
  });

  it('throws a clean error on a transport failure', async () => {
    axios.post.mockResolvedValueOnce(mockToken());
    axios.get.mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(epaygamesGateway.calculateFee('GCASH_QRPH', 1000)).rejects.toThrow('Failed to calculate channel fee');
  });
});
