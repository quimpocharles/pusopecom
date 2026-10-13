import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prisma from '../../lib/prisma.js';
import {
  evaluateExecutionPlan,
  parseArgs,
  collectFindings,
  hasBlockingFindings,
  PRODUCTION_EXECUTION_ENABLED,
} from '../auditRefundReadiness.mjs';

const TEST_URL = 'postgresql://user:secret@db.example.com:5432/railway_test';
const LOCAL_URL = 'postgresql://user:secret@localhost:5432/pusostore_local';
const PROD_URL = 'postgresql://user:secret@zephyr.proxy.rlwy.net:15608/railway';

describe('auditRefundReadiness — execution guards', () => {
  it('refuses without an explicit environment', () => {
    const plan = evaluateExecutionPlan({ databaseUrl: TEST_URL });
    expect(plan.allowed).toBe(false);
    expect(plan.reasons.join(' ')).toMatch(/--env must be one of/);
  });

  it('refuses a missing or unparseable DATABASE_URL', () => {
    expect(evaluateExecutionPlan({ env: 'test', confirmTest: true }).allowed).toBe(false);
    const bad = evaluateExecutionPlan({ env: 'test', confirmTest: true, databaseUrl: 'not-a-url' });
    expect(bad.allowed).toBe(false);
    expect(bad.reasons.join(' ')).toMatch(/not a valid URL/);
  });

  it('test execution requires --confirm-test AND a "_test" database name', () => {
    expect(evaluateExecutionPlan({ env: 'test', databaseUrl: TEST_URL }).allowed).toBe(false);
    expect(evaluateExecutionPlan({ env: 'test', confirmTest: true, databaseUrl: LOCAL_URL }).allowed).toBe(false);
    expect(evaluateExecutionPlan({ env: 'test', confirmTest: true, databaseUrl: TEST_URL }).allowed).toBe(true);
  });

  it('local execution requires --confirm-local AND a localhost database', () => {
    expect(evaluateExecutionPlan({ env: 'local', databaseUrl: LOCAL_URL }).allowed).toBe(false);
    expect(evaluateExecutionPlan({ env: 'local', confirmLocal: true, databaseUrl: TEST_URL }).allowed).toBe(false);
    expect(evaluateExecutionPlan({ env: 'local', confirmLocal: true, databaseUrl: LOCAL_URL }).allowed).toBe(true);
  });

  it('production stays disabled in this build even with every confirmation flag', () => {
    expect(PRODUCTION_EXECUTION_ENABLED).toBe(false);
    const plan = evaluateExecutionPlan({
      env: 'production', confirmProd: true, confirmProdTarget: 'railway', databaseUrl: PROD_URL,
    });
    expect(plan.allowed).toBe(false);
    expect(plan.reasons.join(' ')).toMatch(/production execution is disabled/);
  });

  it('production (when enabled) requires --confirm-prod AND the exact target name', () => {
    const base = { env: 'production', databaseUrl: PROD_URL, productionEnabled: true };
    expect(evaluateExecutionPlan(base).allowed).toBe(false);
    expect(evaluateExecutionPlan({ ...base, confirmProd: true, confirmProdTarget: 'wrong' }).allowed).toBe(false);
    expect(evaluateExecutionPlan({ ...base, confirmProd: true, confirmProdTarget: 'railway' }).allowed).toBe(true);
    // A test-named or localhost target can never be selected as production.
    expect(evaluateExecutionPlan({ env: 'production', databaseUrl: TEST_URL, productionEnabled: true, confirmProd: true, confirmProdTarget: 'railway_test' }).allowed).toBe(false);
  });

  it('parseArgs reads the flags the CLI uses', () => {
    const parsed = parseArgs(['--env=test', '--confirm-test', '--confirm-prod-target=railway_test']);
    expect(parsed.env).toBe('test');
    expect(parsed.confirmTest).toBe(true);
    expect(parsed.confirmProdTarget).toBe('railway_test');
    expect(parsed.confirmProd).toBe(false);
  });

  it('hasBlockingFindings trips on succeeded/over-refund/processing/duplicate-succeeded findings', () => {
    const base = {
      succeededRefunds: [], cumulativeOverRefundOrders: [],
      processingRefunds: [], duplicateSucceededReturnRefunds: [],
    };
    // No blocking findings at all → the script exits successfully.
    expect(hasBlockingFindings(base)).toBe(false);
    expect(hasBlockingFindings({ succeededRefunds: [{ refundId: 'r1' }], cumulativeOverRefundOrders: [] })).toBe(true);
    expect(hasBlockingFindings({ succeededRefunds: [], cumulativeOverRefundOrders: [{ orderNumber: 'PS-1' }] })).toBe(true);
    // A `processing` refund is release-blocking even though it is reported as manual investigation.
    expect(hasBlockingFindings({ ...base, processingRefunds: [{ refundId: 'p1' }] })).toBe(true);
    // Multiple succeeded refunds for one return are release-blocking on their own.
    expect(hasBlockingFindings({ ...base, duplicateSucceededReturnRefunds: [{ returnRequestId: 'rr1' }] })).toBe(true);
  });
});

describe('auditRefundReadiness — the script is read-only', () => {
  it('contains no write-capable Prisma/raw calls', () => {
    const source = readFileSync(fileURLToPath(new URL('../auditRefundReadiness.mjs', import.meta.url)), 'utf8');
    const forbidden = [
      /\.create\(/, /\.createMany\(/, /\.update\(/, /\.updateMany\(/,
      /\.delete\(/, /\.deleteMany\(/, /\.upsert\(/,
      /\$transaction/, /\$executeRaw/, /\$queryRaw/,
    ];
    for (const pattern of forbidden) {
      expect(source).not.toMatch(pattern);
    }
  });
});

describe('auditRefundReadiness — collectFindings (isolated test DB)', () => {
  const MARKER = `RefundAuditTest${Date.now()}`;
  let product;
  let fixture; // { orders, returnRequests, refunds }

  beforeAll(async () => {
    product = await prisma.product.create({
      data: {
        name: `${MARKER} Jersey`, slug: `${MARKER.toLowerCase()}-jersey`, description: 'x',
        price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
        totalStock: 50, sizes: { create: [{ size: 'M', stock: 50 }] },
      },
    });

    const makeOrder = async (suffix, total) => prisma.order.create({
      data: {
        orderNumber: `PS-${MARKER}-${suffix}`, email: 'refund-audit@example.com',
        shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
        shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
        subtotal: total, total, paymentStatus: 'paid', orderStatus: 'delivered',
        items: { create: [{ productId: product.id, name: product.name, price: 500, quantity: 2, size: 'M', image: 'x.jpg' }] },
      },
      include: { items: true },
    });

    const orders = {};
    const returnRequests = {};
    const refunds = {};

    // Overstated vs remaining attributable: attributable 1000, stored 1500.
    orders.over = await makeOrder('OVER', 1000);
    returnRequests.over = await prisma.returnRequest.create({
      data: { orderId: orders.over.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.over.items[0].id, quantity: 2 }] } },
    });
    refunds.over = await prisma.refund.create({ data: { orderId: orders.over.id, returnRequestId: returnRequests.over.id, amount: 1500, reason: 'overstated', status: 'pending' } });

    // Correct for its return: attributable(return qty1) 500, stored 500 — never flagged.
    orders.ok = await makeOrder('OK', 1000);
    returnRequests.ok = await prisma.returnRequest.create({
      data: { orderId: orders.ok.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.ok.items[0].id, quantity: 1 }] } },
    });
    refunds.ok = await prisma.refund.create({ data: { orderId: orders.ok.id, returnRequestId: returnRequests.ok.id, amount: 500, reason: 'fine', status: 'pending' } });

    // Retired /process casualty shape: failed + processedAt + no provider ref.
    orders.casualty = await makeOrder('CAS', 1000);
    refunds.casualty = await prisma.refund.create({
      data: { orderId: orders.casualty.id, amount: 1000, reason: 'cancel', status: 'failed', processedAt: new Date(), providerRefundReference: null },
    });

    // A succeeded refund (expected zero in production) → blocking.
    orders.succeeded = await makeOrder('SUC', 1000);
    refunds.succeeded = await prisma.refund.create({ data: { orderId: orders.succeeded.id, amount: 100, reason: 'legacy', status: 'succeeded', processedAt: new Date(), providerRefundReference: 'legacy-ref' } });

    // (F2) Cancellation refund over the order total (1500 > 1000) — flagged.
    orders.cancelOver = await makeOrder('COV', 1000);
    refunds.cancelOver = await prisma.refund.create({ data: { orderId: orders.cancelOver.id, amount: 1500, reason: 'cancel', status: 'pending' } });

    // (F2) Cancellation refund exactly at the total — valid, not flagged.
    orders.cancelOk = await makeOrder('COK', 1000);
    refunds.cancelOk = await prisma.refund.create({ data: { orderId: orders.cancelOk.id, amount: 1000, reason: 'cancel', status: 'pending' } });

    // (F2) Mixed-origin pending overage: cancel 400 + return 800 = 1200 > 1000 paid
    // (the return's attributable is 1000, so 800 alone is within its own ceiling).
    orders.mixed = await makeOrder('MIX', 1000);
    returnRequests.mixed = await prisma.returnRequest.create({
      data: { orderId: orders.mixed.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.mixed.items[0].id, quantity: 2 }] } },
    });
    refunds.mixedReturn = await prisma.refund.create({ data: { orderId: orders.mixed.id, returnRequestId: returnRequests.mixed.id, amount: 800, reason: 'return', status: 'pending' } });
    refunds.mixedCancel = await prisma.refund.create({ data: { orderId: orders.mixed.id, amount: 400, reason: 'cancel', status: 'pending' } });

    // (F3) Two pending/failed refunds for one return request.
    orders.dup = await makeOrder('DUP', 1000);
    returnRequests.dup = await prisma.returnRequest.create({
      data: { orderId: orders.dup.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.dup.items[0].id, quantity: 2 }] } },
    });
    refunds.dupA = await prisma.refund.create({ data: { orderId: orders.dup.id, returnRequestId: returnRequests.dup.id, amount: 300, reason: 'dup-a', status: 'pending' } });
    refunds.dupB = await prisma.refund.create({ data: { orderId: orders.dup.id, returnRequestId: returnRequests.dup.id, amount: 200, reason: 'dup-b', status: 'failed' } });

    // (F4) A refund_pending return with no Refund row.
    orders.noRefund = await makeOrder('NOREF', 1000);
    returnRequests.noRefund = await prisma.returnRequest.create({
      data: { orderId: orders.noRefund.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.noRefund.items[0].id, quantity: 1 }] } },
    });

    // (F5) Remaining attributable after a succeeded return refund:
    // attributable 1000 − succeeded 400 = 600 remaining; a pending 700 is overstated.
    orders.remaining = await makeOrder('REM', 1000);
    returnRequests.remaining = await prisma.returnRequest.create({
      data: { orderId: orders.remaining.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.remaining.items[0].id, quantity: 2 }] } },
    });
    refunds.remainingSucceeded = await prisma.refund.create({ data: { orderId: orders.remaining.id, returnRequestId: returnRequests.remaining.id, amount: 400, reason: 'prior', status: 'succeeded', processedAt: new Date(), providerRefundReference: 'prior-ref' } });
    refunds.remainingPending = await prisma.refund.create({ data: { orderId: orders.remaining.id, returnRequestId: returnRequests.remaining.id, amount: 700, reason: 'remaining', status: 'pending' } });

    // (F1) Two return requests on one order, two lines. R1's refund (line A)
    // is succeeded; R2's valid pending refund (line B, its own attributable 500)
    // must NOT be flagged — the order-wide remaining after R1 is still 500.
    orders.multi = await prisma.order.create({
      data: {
        orderNumber: `PS-${MARKER}-MULTI`, email: 'refund-audit@example.com',
        shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
        shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
        subtotal: 1000, total: 1000, paymentStatus: 'paid', orderStatus: 'delivered',
        items: { create: [
          { productId: product.id, name: `${product.name} A`, price: 500, quantity: 1, size: 'M', image: 'x.jpg' },
          { productId: product.id, name: `${product.name} B`, price: 500, quantity: 1, size: 'M', image: 'x.jpg' },
        ] },
      },
      include: { items: true },
    });
    const [multiLineA, multiLineB] = orders.multi.items;
    returnRequests.multiA = await prisma.returnRequest.create({
      data: { orderId: orders.multi.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: multiLineA.id, quantity: 1 }] } },
    });
    refunds.multiASucceeded = await prisma.refund.create({ data: { orderId: orders.multi.id, returnRequestId: returnRequests.multiA.id, amount: 500, reason: 'prior succeeded', status: 'succeeded', processedAt: new Date(), providerRefundReference: 'multi-a-ref' } });
    returnRequests.multiB = await prisma.returnRequest.create({
      data: { orderId: orders.multi.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: multiLineB.id, quantity: 1 }] } },
    });
    refunds.multiBPending = await prisma.refund.create({ data: { orderId: orders.multi.id, returnRequestId: returnRequests.multiB.id, amount: 500, reason: 'valid pending', status: 'pending' } });

    // (F2) A refund stuck in `processing` (retired /process shape) — must be
    // reported for manual investigation, never silently skipped.
    orders.processing = await makeOrder('PROC', 1000);
    refunds.processing = await prisma.refund.create({ data: { orderId: orders.processing.id, amount: 1000, reason: 'legacy process', status: 'processing', processedAt: new Date() } });

    // (F4) A pending refund whose return already has a succeeded refund — within
    // its ceiling, but permanently unrecordable under the duplicate-success guard.
    orders.dupSucceeded = await makeOrder('DSUC', 1000);
    returnRequests.dupSucceeded = await prisma.returnRequest.create({
      data: { orderId: orders.dupSucceeded.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.dupSucceeded.items[0].id, quantity: 2 }] } },
    });
    refunds.dupSucceededSucceeded = await prisma.refund.create({ data: { orderId: orders.dupSucceeded.id, returnRequestId: returnRequests.dupSucceeded.id, amount: 300, reason: 'prior', status: 'succeeded', processedAt: new Date(), providerRefundReference: 'ds-ref' } });
    refunds.dupSucceededPending = await prisma.refund.create({ data: { orderId: orders.dupSucceeded.id, returnRequestId: returnRequests.dupSucceeded.id, amount: 200, reason: 'stuck', status: 'pending' } });

    // (F4b) TWO succeeded refunds for one return request, order total NOT
    // exceeded (100 + 100 within 1000) — must still be release-blocking.
    orders.dupSucceededPair = await makeOrder('DSP', 1000);
    returnRequests.dupSucceededPair = await prisma.returnRequest.create({
      data: { orderId: orders.dupSucceededPair.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.dupSucceededPair.items[0].id, quantity: 1 }] } },
    });
    refunds.dupPairA = await prisma.refund.create({ data: { orderId: orders.dupSucceededPair.id, returnRequestId: returnRequests.dupSucceededPair.id, amount: 100, reason: 'succ-a', status: 'succeeded', processedAt: new Date(), providerRefundReference: 'dsp-a' } });
    refunds.dupPairB = await prisma.refund.create({ data: { orderId: orders.dupSucceededPair.id, returnRequestId: returnRequests.dupSucceededPair.id, amount: 100, reason: 'succ-b', status: 'succeeded', processedAt: new Date(), providerRefundReference: 'dsp-b' } });

    // (cumulativeReturnOverflow true-positive) One return (attributable 1000)
    // with two pending/failed refunds summing to 1400 > remaining attributable
    // 1000 — each individually within its own ceiling, so only the cumulative
    // check fires.
    orders.cumOver = await makeOrder('CUMOV', 1000);
    returnRequests.cumOver = await prisma.returnRequest.create({
      data: { orderId: orders.cumOver.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.cumOver.items[0].id, quantity: 2 }] } },
    });
    refunds.cumOverA = await prisma.refund.create({ data: { orderId: orders.cumOver.id, returnRequestId: returnRequests.cumOver.id, amount: 700, reason: 'over-a', status: 'pending' } });
    refunds.cumOverB = await prisma.refund.create({ data: { orderId: orders.cumOver.id, returnRequestId: returnRequests.cumOver.id, amount: 700, reason: 'over-b', status: 'failed' } });

    // Within-capacity equivalent: 900 total ≤ remaining 1000 → not flagged.
    orders.cumUnder = await makeOrder('CUMUN', 1000);
    returnRequests.cumUnder = await prisma.returnRequest.create({
      data: { orderId: orders.cumUnder.id, reason: 'Wrong size', status: 'refund_pending', items: { create: [{ orderItemId: orders.cumUnder.items[0].id, quantity: 2 }] } },
    });
    refunds.cumUnder = await prisma.refund.create({ data: { orderId: orders.cumUnder.id, returnRequestId: returnRequests.cumUnder.id, amount: 900, reason: 'ok', status: 'pending' } });

    fixture = { orders, returnRequests, refunds };
  }, 120000);

  afterAll(async () => {
    const orderIds = Object.values(fixture.orders).map((o) => o.id);
    await prisma.returnItem.deleteMany({ where: { returnRequest: { orderId: { in: orderIds } } } });
    await prisma.returnRequest.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  }, 120000);

  it('flags the overstated return refund, ignores the correct one, and detects casualties and succeeded rows', async () => {
    const findings = await collectFindings(prisma);

    const overstatedIds = findings.overstatedReturnRefunds.map((f) => f.refundId);
    expect(overstatedIds).toContain(fixture.refunds.over.id);
    expect(overstatedIds).not.toContain(fixture.refunds.ok.id);

    const over = findings.overstatedReturnRefunds.find((f) => f.refundId === fixture.refunds.over.id);
    expect(over.correctAmount).toBe(1000);
    expect(over.storedAmount).toBe(1500);
    expect(over.overstatedBy).toBe(500);

    expect(findings.processCasualties.map((c) => c.refundId)).toContain(fixture.refunds.casualty.id);
    expect(findings.succeededRefunds.map((s) => s.refundId)).toContain(fixture.refunds.succeeded.id);

    expect(hasBlockingFindings(findings)).toBe(true);
  }, 120000);

  it('flags cancellation ceilings, mixed-origin overage, duplicate candidates, orphan returns, and remaining value', async () => {
    const findings = await collectFindings(prisma);

    // F2 — cancellation refund over the order total (not equal to it).
    const cancelIds = findings.cancelRefundOverCeiling.map((f) => f.refundId);
    expect(cancelIds).toContain(fixture.refunds.cancelOver.id);
    expect(cancelIds).not.toContain(fixture.refunds.cancelOk.id);

    // F2 — all-origin cumulative overage on the mixed order, not on the valid cancel order.
    const cumulativeOrders = findings.cumulativeOrderOverflow.map((f) => f.orderNumber);
    expect(cumulativeOrders).toContain(fixture.orders.mixed.orderNumber);
    expect(cumulativeOrders).not.toContain(fixture.orders.cancelOk.orderNumber);

    // F3 — duplicate candidates for one return request.
    const dup = findings.duplicateReturnRefunds.find((f) => f.returnRequestId === fixture.returnRequests.dup.id);
    expect(dup).toBeTruthy();
    expect([...dup.refundIds].sort()).toEqual([fixture.refunds.dupA.id, fixture.refunds.dupB.id].sort());

    // F4 — refund_pending return with no refund row.
    expect(findings.refundPendingWithoutRefund.map((f) => f.returnRequestId)).toContain(fixture.returnRequests.noRefund.id);

    // F5 — remaining attributable value after a succeeded return refund.
    const remaining = findings.overstatedReturnRefunds.find((f) => f.refundId === fixture.refunds.remainingPending.id);
    expect(remaining).toBeTruthy();
    expect(remaining.correctAmount).toBe(600);
    expect(remaining.overstatedBy).toBe(100);

    // Valid records stay unflagged (duplicate candidates within their own ceiling).
    const overstatedIds = findings.overstatedReturnRefunds.map((f) => f.refundId);
    expect(overstatedIds).not.toContain(fixture.refunds.dupA.id);
    expect(overstatedIds).not.toContain(fixture.refunds.dupB.id);
  }, 120000);

  it('does not flag a valid pending refund on a different return of the same order (F1)', async () => {
    const findings = await collectFindings(prisma);

    const overstatedIds = findings.overstatedReturnRefunds.map((f) => f.refundId);
    expect(overstatedIds).not.toContain(fixture.refunds.multiBPending.id);
    // The order-wide cumulative return check stays clear too: 500 pending vs 500 remaining.
    expect(findings.cumulativeReturnOverflow.map((f) => f.orderNumber)).not.toContain(fixture.orders.multi.orderNumber);
  }, 120000);

  it('surfaces refunds stuck in processing for manual investigation (F2)', async () => {
    const findings = await collectFindings(prisma);

    expect(findings.processingRefunds.map((f) => f.refundId)).toContain(fixture.refunds.processing.id);
    // Never misclassified as succeeded (that would be an unevidenced money claim),
    // and never treated as a resolved record.
    expect(findings.succeededRefunds.map((f) => f.refundId)).not.toContain(fixture.refunds.processing.id);
    expect(findings.overstatedReturnRefunds.map((f) => f.refundId)).not.toContain(fixture.refunds.processing.id);
  }, 120000);

  it('surfaces a pending refund whose return already has a succeeded refund (F4)', async () => {
    const findings = await collectFindings(prisma);

    expect(findings.returnRefundWithSucceeded.map((f) => f.refundId)).toContain(fixture.refunds.dupSucceededPending.id);
    // Within its ceiling (attributable 1000 − succeeded 300 = 700 remaining ≥ 200),
    // so it must NOT be a "confirmed overstated" finding — it is manual-only.
    expect(findings.overstatedReturnRefunds.map((f) => f.refundId)).not.toContain(fixture.refunds.dupSucceededPending.id);
  }, 120000);

  it('blocks when a processing refund is present, even though it is classified as manual investigation (F2)', async () => {
    const findings = await collectFindings(prisma);

    // The processing refund is reported for manual investigation...
    expect(findings.processingRefunds.map((f) => f.refundId)).toContain(fixture.refunds.processing.id);
    // ...and its presence alone makes the script exit non-zero.
    expect(hasBlockingFindings(findings)).toBe(true);
  }, 120000);

  it('flags two succeeded refunds for one return as blocking even when the order total is not exceeded (F4b)', async () => {
    const findings = await collectFindings(prisma);

    const dup = findings.duplicateSucceededReturnRefunds.find((f) => f.returnRequestId === fixture.returnRequests.dupSucceededPair.id);
    expect(dup).toBeTruthy();
    expect([...dup.refundIds].sort()).toEqual([fixture.refunds.dupPairA.id, fixture.refunds.dupPairB.id].sort());

    // The order total (1000) is NOT exceeded by the two succeeded 100 refunds,
    // so this is not an over-refund order — the duplicate itself blocks release.
    expect(findings.cumulativeOverRefundOrders.map((f) => f.orderNumber)).not.toContain(fixture.orders.dupSucceededPair.orderNumber);
    expect(hasBlockingFindings(findings)).toBe(true);
  }, 120000);

  it('flags a return-refund total exceeding remaining attributable capacity, and not the within-capacity case (cumulativeReturnOverflow)', async () => {
    const findings = await collectFindings(prisma);

    const cumulativeOrders = findings.cumulativeReturnOverflow.map((f) => f.orderNumber);
    // 700 + 700 = 1400 pending/failed vs 1000 remaining attributable → flagged.
    expect(cumulativeOrders).toContain(fixture.orders.cumOver.orderNumber);
    // 900 pending vs 1000 remaining attributable → not flagged.
    expect(cumulativeOrders).not.toContain(fixture.orders.cumUnder.orderNumber);

    // Neither refund is individually overstated (each 700 ≤ its own 1000 ceiling),
    // so this specifically exercises the cumulative check.
    const overstatedIds = findings.overstatedReturnRefunds.map((f) => f.refundId);
    expect(overstatedIds).not.toContain(fixture.refunds.cumOverA.id);
    expect(overstatedIds).not.toContain(fixture.refunds.cumOverB.id);
  }, 120000);
});
