// Refund readiness audit — STRICTLY READ-ONLY.
//
// Inspects pre-existing refund data before the manual-refund workflow is used
// in production. It performs no writes of any kind (no row mutation, no
// transaction, no migration, no repair, no notification, no payment call) — see
// the guard test in scripts/__tests__/auditRefundReadiness.test.js, which fails
// if any write-capable Prisma call pattern ever appears in this file.
//
// Financial source of truth is the SAME code production uses: lib/refundMath.js
// (promo-scope-aware, centavo-exact). Rough SQL is never treated as a finding.
//
// Execution is gated by an explicit environment selection plus matching
// confirmation flags, and the database target is validated BEFORE any client is
// constructed or any query is issued. Production execution is hard-disabled in
// this build. Run with an explicit env file, never the default:
//
//   node --env-file=.env.test scripts/auditRefundReadiness.mjs --env=test --confirm-test
//
// Never prints credentials or the full connection URL.

import { pathToFileURL } from 'node:url';
import * as refundMath from '../lib/refundMath.js';

// Hard kill switch. Production execution stays disabled until a later, separately
// approved change flips this — `--confirm-prod` alone is never sufficient.
export const PRODUCTION_EXECUTION_ENABLED = false;

export const ENVIRONMENTS = Object.freeze(['test', 'local', 'production']);

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Parse only the database name and host out of a connection URL. Never returns the URL itself. */
export function parseTargetDatabase(databaseUrl) {
  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL is not set');
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  const host = parsed.hostname || '';
  if (!dbName) throw new Error('DATABASE_URL has no database name');
  return { dbName, host };
}

/**
 * Decide whether execution is allowed for the selected environment. Pure and
 * DB-free so it can be unit-tested. Returns the parsed target plus the reasons
 * execution was refused (empty when allowed).
 */
export function evaluateExecutionPlan({
  env,
  databaseUrl,
  confirmTest = false,
  confirmLocal = false,
  confirmProd = false,
  confirmProdTarget = '',
  productionEnabled = PRODUCTION_EXECUTION_ENABLED,
} = {}) {
  const reasons = [];
  if (!ENVIRONMENTS.includes(env)) {
    reasons.push(`--env must be one of: ${ENVIRONMENTS.join(', ')}`);
  }

  let target;
  try {
    target = parseTargetDatabase(databaseUrl);
  } catch (error) {
    reasons.push(error.message);
  }
  if (!target || reasons.length > 0) {
    return {
      allowed: false,
      environment: env ?? null,
      dbName: target?.dbName ?? null,
      host: target?.host ?? null,
      reasons,
    };
  }

  const { dbName, host } = target;
  const isLocalHost = LOCAL_HOSTS.has(host);
  const isTestName = /_test$/i.test(dbName);

  if (env === 'test') {
    if (!confirmTest) reasons.push('test execution requires --confirm-test');
    if (!isTestName) reasons.push(`test execution requires a database whose name ends with "_test" (got "${dbName}")`);
  } else if (env === 'local') {
    if (!confirmLocal) reasons.push('local execution requires --confirm-local');
    if (!isLocalHost) reasons.push('local execution requires a localhost database');
  } else {
    // production
    if (!productionEnabled) reasons.push('production execution is disabled in this build (PRODUCTION_EXECUTION_ENABLED is false)');
    if (!confirmProd) reasons.push('production execution requires --confirm-prod');
    if (confirmProdTarget !== dbName) reasons.push('production execution requires --confirm-prod-target=<database name> matching the target exactly');
    if (isTestName) reasons.push('refusing: a "_test" database cannot be selected as production');
    if (isLocalHost) reasons.push('refusing: a localhost database cannot be selected as production');
  }

  return { allowed: reasons.length === 0, environment: env, dbName, host, reasons };
}

/** Parse the CLI flags. Unknown flags are ignored. */
export function parseArgs(argv = []) {
  const args = {
    env: undefined,
    confirmTest: false,
    confirmLocal: false,
    confirmProd: false,
    confirmProdTarget: '',
  };
  for (const raw of argv) {
    const eq = raw.indexOf('=');
    const key = eq === -1 ? raw : raw.slice(0, eq);
    const value = eq === -1 ? '' : raw.slice(eq + 1);
    if (key === '--env') args.env = value;
    else if (key === '--confirm-test') args.confirmTest = true;
    else if (key === '--confirm-local') args.confirmLocal = true;
    else if (key === '--confirm-prod') args.confirmProd = true;
    else if (key === '--confirm-prod-target') args.confirmProdTarget = value;
  }
  return args;
}

/** True when a report contains a release-blocking finding. */
export function hasBlockingFindings(findings) {
  return (findings?.succeededRefunds?.length ?? 0) > 0
    || (findings?.cumulativeOverRefundOrders?.length ?? 0) > 0
    // A `processing` refund has an unknown external money state — release-blocking
    // (it is reported as manual investigation, but the run cannot be signed off
    // until Finance reconciles it).
    || (findings?.processingRefunds?.length ?? 0) > 0
    // More than one succeeded refund for a single return is a financial
    // inconsistency regardless of the order total.
    || (findings?.duplicateSucceededReturnRefunds?.length ?? 0) > 0;
}

/**
 * Read-only collection of the checks. Returns actionable findings and separates
 * *confirmed* discrepancies from records that need manual investigation (a
 * return whose items no longer resolve, duplicate candidates, a refund stuck in
 * `processing`, a pending refund for an already-refunded return, or a
 * refund_pending return with no refund row). Uses lib/refundMath.js as the
 * single source of financial truth; nothing is silently skipped — an
 * unresolvable record lands in a manual-investigation bucket.
 */
export async function collectFindings(prisma) {
  const findings = {
    overstatedReturnRefunds: [],
    cumulativeReturnOverflow: [],
    cancelRefundOverCeiling: [],
    cumulativeOrderOverflow: [],
    duplicateReturnRefunds: [],
    duplicateSucceededReturnRefunds: [],
    returnRefundWithSucceeded: [],
    processingRefunds: [],
    refundPendingWithoutRefund: [],
    returnRefundManualReview: [],
    cancelRefundManualReview: [],
    processCasualties: [],
    succeededRefunds: [],
    cumulativeOverRefundOrders: [],
  };

  const orderCache = new Map();
  async function loadOrder(orderId) {
    if (orderCache.has(orderId)) return orderCache.get(orderId);
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    orderCache.set(orderId, order);
    return order;
  }

  const attributionCache = new Map();
  async function attributionFor(orderId) {
    if (attributionCache.has(orderId)) return attributionCache.get(orderId);
    const order = await loadOrder(orderId);
    const promoCode = order?.promoCodeId
      ? await prisma.promoCode.findUnique({ where: { id: order.promoCodeId }, include: { products: true, passEvents: true } })
      : null;
    const passes = await prisma.pass.findMany({ where: { orderId } });
    const merchandiseLines = refundMath.buildMerchandiseLines(order?.items ?? []);
    const passLines = refundMath.buildPassLines(passes);
    const attributablePaid = order
      ? refundMath.attributableMerchandisePaid({ merchandiseLines, passLines, discountAmount: order.discountAmount ?? 0, promoCode })
      : 0;
    const context = { order, promoCode, merchandiseLines, passLines, attributablePaid };
    attributionCache.set(orderId, context);
    return context;
  }

  // Succeeded sums per order — the baseline for what remains refundable.
  const [succeededAllGroups, succeededReturnGroups] = await Promise.all([
    prisma.refund.groupBy({ by: ['orderId'], where: { status: 'succeeded' }, _sum: { amount: true } }),
    prisma.refund.groupBy({ by: ['orderId'], where: { status: 'succeeded', returnRequestId: { not: null } }, _sum: { amount: true } }),
  ]);
  const succeededAllCentavosByOrder = new Map(succeededAllGroups.map((g) => [g.orderId, refundMath.toCentavos(g._sum.amount || 0)]));
  const succeededReturnCentavosByOrder = new Map(succeededReturnGroups.map((g) => [g.orderId, refundMath.toCentavos(g._sum.amount || 0)]));

  // The set of return requests that already have a succeeded refund — used below
  // to surface pending/failed refunds for the same return that can never be
  // recorded (the record route's duplicate-success guard rejects them) — and the
  // full rows, used to detect more than one succeeded refund for one return.
  const succeededReturnRows = await prisma.refund.findMany({
    where: { status: 'succeeded', returnRequestId: { not: null } },
    select: { id: true, orderId: true, returnRequestId: true, amount: true },
  });
  const succeededReturnRequestIds = new Set(succeededReturnRows.map((refund) => refund.returnRequestId));

  // (F4b) More than one SUCCEEDED refund for one return request is a blocking
  //       financial-reconciliation finding regardless of the order total — only
  //       one refund per return may ever be recorded. Reported with identifiers
  //       (return request, order number, refund ids, total) and no customer PII.
  const succeededByReturnRequest = new Map();
  for (const refund of succeededReturnRows) {
    if (!succeededByReturnRequest.has(refund.returnRequestId)) succeededByReturnRequest.set(refund.returnRequestId, []);
    succeededByReturnRequest.get(refund.returnRequestId).push(refund);
  }
  for (const [returnRequestId, list] of succeededByReturnRequest) {
    if (list.length > 1) {
      const order = await loadOrder(list[0].orderId);
      findings.duplicateSucceededReturnRefunds.push({
        returnRequestId,
        orderNumber: order?.orderNumber ?? null,
        refundIds: list.map((refund) => refund.id),
        totalStored: refundMath.fromCentavos(list.reduce((sum, refund) => sum + refundMath.toCentavos(refund.amount), 0)),
      });
    }
  }

  const pendingFailedRefunds = await prisma.refund.findMany({ where: { status: { in: ['pending', 'failed'] } } });
  const returnRefunds = pendingFailedRefunds.filter((refund) => refund.returnRequestId);
  const cancelRefunds = pendingFailedRefunds.filter((refund) => !refund.returnRequestId);

  // (F3) Duplicate candidates for one return request — the app records at most
  //     one, so any extra pending/failed row is a manual-investigation signal.
  const returnByReturnRequest = new Map();
  for (const refund of returnRefunds) {
    if (!returnByReturnRequest.has(refund.returnRequestId)) returnByReturnRequest.set(refund.returnRequestId, []);
    returnByReturnRequest.get(refund.returnRequestId).push(refund);
  }
  for (const [returnRequestId, list] of returnByReturnRequest) {
    if (list.length > 1) {
      const order = await loadOrder(list[0].orderId);
      findings.duplicateReturnRefunds.push({
        returnRequestId,
        orderNumber: order?.orderNumber ?? null,
        refundIds: list.map((refund) => refund.id),
        statuses: list.map((refund) => refund.status),
        totalStored: refundMath.fromCentavos(list.reduce((sum, refund) => sum + refundMath.toCentavos(refund.amount), 0)),
      });
    }
  }

  // (F4) A pending/failed refund whose return request already has a succeeded
  //     refund can never be recorded — the record route's duplicate-success
  //     guard (RETURN_ALREADY_REFUNDED) rejects it — even when its own amount is
  //     within the ceiling. Surface each one for manual resolution rather than
  //     leaving it silently stuck in the queue.
  for (const refund of returnRefunds) {
    if (!succeededReturnRequestIds.has(refund.returnRequestId)) continue;
    const order = await loadOrder(refund.orderId);
    findings.returnRefundWithSucceeded.push({
      refundId: refund.id,
      status: refund.status,
      returnRequestId: refund.returnRequestId,
      orderNumber: order?.orderNumber ?? null,
      amount: refund.amount,
    });
  }

  // (a) Pending/failed RETURN-origin refunds: stored amount vs the REMAINING
  //     promo-aware attributable value (attributable return amount minus
  //     succeeded return-origin refunds already recorded).
  const returnByOrder = new Map();
  for (const refund of returnRefunds) {
    if (!returnByOrder.has(refund.orderId)) returnByOrder.set(refund.orderId, []);
    returnByOrder.get(refund.orderId).push(refund);
    try {
      const context = await attributionFor(refund.orderId);
      const returnRequest = await prisma.returnRequest.findUnique({
        where: { id: refund.returnRequestId },
        include: { items: true },
      });
      if (!context.order || !returnRequest) {
        findings.returnRefundManualReview.push({
          refundId: refund.id,
          status: refund.status,
          reason: !context.order ? 'order not found' : 'return request not found',
        });
        continue;
      }
      const attributableReturnCentavos = refundMath.attributableReturnAmount({
        merchandiseLines: context.merchandiseLines,
        passLines: context.passLines,
        discountAmount: context.order.discountAmount ?? 0,
        promoCode: context.promoCode,
        returnItems: returnRequest.items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.quantity })),
      });
      const succeededReturnCentavos = succeededReturnCentavosByOrder.get(refund.orderId) ?? 0;
      // The order-wide remaining attributable capacity after succeeded
      // return-origin refunds — the exact ceiling the record/adjust routes
      // enforce (order-wide, not per-return). This return's own attributable
      // value bounds it from above, so the effective remaining ceiling is the
      // tighter of the two. Subtracting order-wide succeeded refunds straight
      // from THIS return's value (the previous behaviour) double-counts when a
      // different return on the same order was the one refunded, and falsely
      // flags a valid refund.
      const orderWideRemainingCentavos = Math.max(0, context.attributablePaid - succeededReturnCentavos);
      const remainingReturnCentavos = Math.min(attributableReturnCentavos, orderWideRemainingCentavos);
      const storedCentavos = refundMath.toCentavos(refund.amount);
      if (storedCentavos > remainingReturnCentavos) {
        findings.overstatedReturnRefunds.push({
          refundId: refund.id,
          status: refund.status,
          orderNumber: context.order.orderNumber,
          storedAmount: refund.amount,
          correctAmount: refundMath.fromCentavos(remainingReturnCentavos),
          overstatedBy: refundMath.fromCentavos(storedCentavos - remainingReturnCentavos),
        });
      }
    } catch (error) {
      findings.returnRefundManualReview.push({
        refundId: refund.id,
        status: refund.status,
        reason: `could not evaluate: ${error.message}`,
      });
    }
  }

  // Same-origin cumulative: pending+failed return refunds vs remaining
  // attributable value (not the full value).
  for (const [orderId, refunds] of returnByOrder) {
    const context = attributionCache.get(orderId);
    if (!context?.order) continue;
    const succeededReturnCentavos = succeededReturnCentavosByOrder.get(orderId) ?? 0;
    const remaining = Math.max(0, context.attributablePaid - succeededReturnCentavos);
    const totalCentavos = refunds.reduce((sum, r) => sum + refundMath.toCentavos(r.amount), 0);
    if (totalCentavos > remaining) {
      findings.cumulativeReturnOverflow.push({
        orderNumber: context.order.orderNumber,
        pendingFailedTotal: refundMath.fromCentavos(totalCentavos),
        attributablePaid: refundMath.fromCentavos(remaining),
      });
    }
  }

  // (F2) Cancellation-origin pending/failed refunds vs the order-level ceiling.
  for (const refund of cancelRefunds) {
    const order = await loadOrder(refund.orderId);
    if (!order) {
      findings.cancelRefundManualReview.push({ refundId: refund.id, status: refund.status, reason: 'order not found' });
      continue;
    }
    const storedCentavos = refundMath.toCentavos(refund.amount);
    const orderTotalCentavos = refundMath.toCentavos(order.total);
    if (storedCentavos > orderTotalCentavos) {
      findings.cancelRefundOverCeiling.push({
        refundId: refund.id,
        status: refund.status,
        orderNumber: order.orderNumber,
        storedAmount: refund.amount,
        orderTotal: order.total,
        overBy: refundMath.fromCentavos(storedCentavos - orderTotalCentavos),
      });
    }
  }

  // (F2) All-origin cumulative pending+failed vs the remaining amount paid.
  const pendingFailedByOrder = new Map();
  for (const refund of pendingFailedRefunds) {
    if (!pendingFailedByOrder.has(refund.orderId)) pendingFailedByOrder.set(refund.orderId, []);
    pendingFailedByOrder.get(refund.orderId).push(refund);
  }
  for (const [orderId, refunds] of pendingFailedByOrder) {
    const order = await loadOrder(orderId);
    if (!order) continue; // individual refunds of an unloadable order are surfaced above
    const succeededAllCentavos = succeededAllCentavosByOrder.get(orderId) ?? 0;
    const remainingOrderCentavos = Math.max(0, refundMath.toCentavos(order.total) - succeededAllCentavos);
    const totalCentavos = refunds.reduce((sum, r) => sum + refundMath.toCentavos(r.amount), 0);
    if (totalCentavos > remainingOrderCentavos) {
      findings.cumulativeOrderOverflow.push({
        orderNumber: order.orderNumber,
        pendingFailedTotal: refundMath.fromCentavos(totalCentavos),
        orderTotal: order.total,
        remainingOrder: refundMath.fromCentavos(remainingOrderCentavos),
      });
    }
  }

  // (F4) Returns at refund_pending with no Refund row at all.
  const refundPendingReturns = await prisma.returnRequest.findMany({
    where: { status: 'refund_pending' },
    select: { id: true, orderId: true },
  });
  if (refundPendingReturns.length > 0) {
    const withRefund = await prisma.refund.findMany({
      where: { returnRequestId: { in: refundPendingReturns.map((r) => r.id) } },
      select: { returnRequestId: true },
    });
    const hasRefund = new Set(withRefund.map((r) => r.returnRequestId));
    for (const rr of refundPendingReturns) {
      if (!hasRefund.has(rr.id)) {
        const order = await loadOrder(rr.orderId);
        findings.refundPendingWithoutRefund.push({ returnRequestId: rr.id, orderNumber: order?.orderNumber ?? null });
      }
    }
  }

  // (b) Retired /process casualties: marked failed with a processedAt but no
  //     provider refund reference — the old automated route's failure shape.
  //     Needs manual/provider verification (money may or may not have moved).
  const casualties = await prisma.refund.findMany({
    where: { status: 'failed', processedAt: { not: null }, providerRefundReference: null },
    include: { order: { select: { orderNumber: true } } },
  });
  findings.processCasualties = casualties.map((refund) => ({
    refundId: refund.id,
    orderNumber: refund.order?.orderNumber ?? null,
    amount: refund.amount,
    processedAt: refund.processedAt,
  }));

  // (b2) Refunds stuck in `processing` — a legal RefundStatus the retired
  //     automated /process route could leave behind (ADR-012 notes its claim
  //     step could even flip an already-recorded refund back to `processing`).
  //     Neither /record nor /adjust will touch a processing refund, so it is
  //     stuck, and the external money state is unknown: surface each one for
  //     provider verification. This script never changes status.
  const processingRefunds = await prisma.refund.findMany({
    where: { status: 'processing' },
    include: { order: { select: { orderNumber: true } } },
  });
  findings.processingRefunds = processingRefunds.map((refund) => ({
    refundId: refund.id,
    orderNumber: refund.order?.orderNumber ?? null,
    amount: refund.amount,
    providerRefundReference: refund.providerRefundReference,
    processedAt: refund.processedAt,
  }));

  // (c) Any succeeded refunds (expected zero pre-deploy) require Finance
  //     reconciliation against provider statements.
  const succeeded = await prisma.refund.findMany({
    where: { status: 'succeeded' },
    include: { order: { select: { orderNumber: true, total: true } } },
  });
  findings.succeededRefunds = succeeded.map((refund) => ({
    refundId: refund.id,
    orderNumber: refund.order?.orderNumber ?? null,
    amount: refund.amount,
    providerRefundReference: refund.providerRefundReference,
    processedAt: refund.processedAt,
  }));

  // (d) Orders whose cumulative succeeded refunds exceed the amount paid.
  for (const [orderId, succeededCentavos] of succeededAllCentavosByOrder) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, total: true } });
    if (!order) continue;
    if (succeededCentavos > refundMath.toCentavos(order.total)) {
      findings.cumulativeOverRefundOrders.push({
        orderNumber: order.orderNumber,
        refundedTotal: refundMath.fromCentavos(succeededCentavos),
        orderTotal: order.total,
      });
    }
  }

  return findings;
}

function printReport(findings, log) {
  const line = (label, rows, render) => {
    log.log(`\n${label}: ${rows.length}`);
    for (const row of rows) log.log(`  - ${render(row)}`);
  };

  line('CONFIRMED — overstated pending/failed return refunds (vs remaining attributable)', findings.overstatedReturnRefunds,
    (f) => `refund ${f.refundId} (order ${f.orderNumber}, ${f.status}): stored ₱${f.storedAmount} vs remaining attributable ₱${f.correctAmount} — overstated by ₱${f.overstatedBy}. Correct via POST /admin/refunds/:id/adjust BEFORE any external payment: use the explicit amount ₱${f.correctAmount}; use (recompute) only if the return's full attributable value (what recompute produces) does not exceed this remaining ceiling — after a succeeded refund it usually does, and recompute is rejected.`);
  line('CONFIRMED — orders whose pending+failed return refunds exceed remaining attributable value', findings.cumulativeReturnOverflow,
    (f) => `order ${f.orderNumber}: ₱${f.pendingFailedTotal} pending/failed vs ₱${f.attributablePaid} remaining attributable.`);
  line('CONFIRMED — cancellation refunds exceeding the order total', findings.cancelRefundOverCeiling,
    (f) => `refund ${f.refundId} (order ${f.orderNumber}, ${f.status}): ₱${f.storedAmount} vs order total ₱${f.orderTotal} — over by ₱${f.overBy}.`);
  line('CONFIRMED — orders whose pending+failed refunds exceed the remaining amount paid', findings.cumulativeOrderOverflow,
    (f) => `order ${f.orderNumber}: ₱${f.pendingFailedTotal} pending/failed vs ₱${f.remainingOrder} remaining of ₱${f.orderTotal} paid.`);
  line('BLOCKING — succeeded refunds requiring Finance reconciliation', findings.succeededRefunds,
    (f) => `refund ${f.refundId} (order ${f.orderNumber}): ₱${f.amount}, provider ref ${f.providerRefundReference ?? '(none)'}, processedAt ${f.processedAt ?? '(none)'}.`);
  line('BLOCKING — orders whose succeeded refunds exceed the amount paid', findings.cumulativeOverRefundOrders,
    (f) => `order ${f.orderNumber}: refunded ₱${f.refundedTotal} vs paid ₱${f.orderTotal}.`);
  line('BLOCKING — multiple succeeded refunds for one return request', findings.duplicateSucceededReturnRefunds,
    (f) => `return ${f.returnRequestId} (order ${f.orderNumber}): ${f.refundIds.length} succeeded refunds (${f.refundIds.join(', ')}), ₱${f.totalStored} total — only one refund per return may exist. Reconcile with Finance before proceeding.`);
  line('MANUAL INVESTIGATION — duplicate refunds for one return request', findings.duplicateReturnRefunds,
    (f) => `return ${f.returnRequestId} (order ${f.orderNumber}): ${f.refundIds.length} refunds (${f.statuses.join(', ')}), ₱${f.totalStored} total. Only one can be recorded.`);
  line('MANUAL INVESTIGATION — pending/failed refunds whose return already has a succeeded refund', findings.returnRefundWithSucceeded,
    (f) => `refund ${f.refundId} (${f.status}) for return ${f.returnRequestId} (order ${f.orderNumber}): ₱${f.amount}. This return is already refunded — the record route will reject it (duplicate success) even within the ceiling; resolve it manually.`);
  line('MANUAL INVESTIGATION (RELEASE-BLOCKING) — refunds stuck in "processing" (external payment state unknown)', findings.processingRefunds,
    (f) => `refund ${f.refundId} (order ${f.orderNumber}): ₱${f.amount}, provider ref ${f.providerRefundReference ?? '(none)'}, processedAt ${f.processedAt ?? '(none)'}. Neither /record nor /adjust will touch a processing refund — verify with the provider whether money moved before treating it as not-sent; do not mark it succeeded without evidence.`);
  line('MANUAL INVESTIGATION — refund_pending returns with no refund row', findings.refundPendingWithoutRefund,
    (f) => `return ${f.returnRequestId} (order ${f.orderNumber}) is refund_pending with no Refund row.`);
  line('MANUAL INVESTIGATION — retired /process casualties (failed + processedAt + no provider ref)', findings.processCasualties,
    (f) => `refund ${f.refundId} (order ${f.orderNumber}): ₱${f.amount}, processedAt ${f.processedAt}. Verify with the provider whether money actually moved before treating it as not-sent.`);
  line('MANUAL INVESTIGATION — return refunds that could not be evaluated', findings.returnRefundManualReview,
    (f) => `refund ${f.refundId} (${f.status}): ${f.reason}.`);
  line('MANUAL INVESTIGATION — cancellation refunds that could not be evaluated', findings.cancelRefundManualReview,
    (f) => `refund ${f.refundId} (${f.status}): ${f.reason}.`);

  const blocking = hasBlockingFindings(findings);
  log.log(`\n${blocking ? 'RESULT: BLOCKING findings present — do not enable manual recording until reconciled.' : 'RESULT: no blocking findings.'}`);
}

export async function main(argv = process.argv.slice(2), { env = process.env, log = console } = {}) {
  const parsed = parseArgs(argv);
  const plan = evaluateExecutionPlan({ env: parsed.env, databaseUrl: env.DATABASE_URL, ...parsed });

  log.log('Refund readiness audit — READ-ONLY (no writes)');
  log.log(`  selected environment : ${plan.environment ?? '(none)'}`);
  log.log(`  target database      : ${plan.dbName ?? '(unresolved)'}`);
  log.log('  target host          : (not printed)');

  if (!plan.allowed) {
    log.error('\nRefusing to run:');
    for (const reason of plan.reasons) log.error(`  - ${reason}`);
    return { ran: false, reasons: plan.reasons };
  }

  // Only after the target is validated do we construct a client. The URL is
  // passed explicitly so the validated target is the one queried.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } }, log: ['error'] });
  try {
    const findings = await collectFindings(prisma);
    printReport(findings, log);
    return { ran: true, findings };
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((result) => {
      if (!result || result.ran === false) process.exitCode = 1;
      else if (hasBlockingFindings(result.findings)) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error?.message || error);
      process.exitCode = 1;
    });
}

export default { evaluateExecutionPlan, parseTargetDatabase, parseArgs, collectFindings, hasBlockingFindings, main };
