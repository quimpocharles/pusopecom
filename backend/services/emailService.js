import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// ── Brand tokens ──────────────────────────────────────────────────────────────
const BLACK     = '#0a0a0a';
const DARK      = '#1a1a1a';
const WHITE     = '#ffffff';
const MUTED     = 'rgba(255,255,255,0.55)';
const BORDER    = 'rgba(255,255,255,0.10)';
const LOGO_URL  = `${process.env.FRONTEND_URL}/puso-white.png`;

// ── Shared wrapper ─────────────────────────────────────────────────────────────
const getEmailTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Puso Pilipinas</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; background-color: #111111; font-family: Arial, Helvetica, sans-serif; }
    @media only screen and (max-width: 620px) {
      .wrapper { width: 100% !important; }
      .inner   { padding: 28px 20px !important; }
      .stat-td { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#111111;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table role="presentation" class="wrapper" width="600" cellpadding="0" cellspacing="0"
               style="background:${BLACK};border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:${BLACK};padding:32px 40px 24px;border-bottom:1px solid ${BORDER};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="background:#ffffff;border-radius:10px;padding:10px 18px;line-height:0;">
                    <img src="${LOGO_URL}" alt="Puso Pilipinas" width="120" height="auto"
                         style="display:block;" />
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                         color:rgba(255,255,255,0.35);">Sports Merchandise Store</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="inner" style="padding:36px 40px;color:${WHITE};">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${DARK};padding:24px 40px;border-top:1px solid ${BORDER};text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.35);letter-spacing:0.06em;">
                &copy; ${new Date().getFullYear()} Puso Pilipinas. All rights reserved.
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.20);">
                This email was sent from Puso Pilipinas Sports Merchandise Store.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>
`;

// ── Shared style snippets ─────────────────────────────────────────────────────
const h2 = (text) =>
  `<h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${WHITE};letter-spacing:-0.01em;">${text}</h2>`;

const p = (text, extraStyle = '') =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.65);${extraStyle}">${text}</p>`;

const divider = () =>
  `<div style="height:1px;background:${BORDER};margin:24px 0;"></div>`;

const pillButton = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr>
      <td style="background:${WHITE};border-radius:100px;">
        <a href="${href}"
           style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;
                  color:${BLACK};text-decoration:none;letter-spacing:0.02em;white-space:nowrap;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;

const smallLink = (href) =>
  `<p style="margin:8px 0 0;font-size:12px;text-align:center;color:rgba(255,255,255,0.30);">
     Or copy this link: <span style="word-break:break-all;color:rgba(255,255,255,0.50);">${href}</span>
   </p>`;

const label = (text) =>
  `<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;
             color:rgba(255,255,255,0.35);">${text}</p>`;

const value = (text) =>
  `<p style="margin:0 0 14px;font-size:15px;color:${WHITE};">${text}</p>`;

// ── Verification email ─────────────────────────────────────────────────────────
export const sendVerificationEmail = async (email, firstName, verificationToken) => {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const content = `
    ${h2(`Welcome, ${firstName}!`)}
    ${p('Thank you for registering with Puso Pilipinas. To complete your sign-up, please verify your email address.')}
    ${pillButton(url, 'Verify Email Address')}
    ${smallLink(url)}
    ${divider()}
    ${p('This link expires in <strong style="color:${WHITE}">24 hours</strong>. If you didn\'t create an account, you can safely ignore this email.', 'font-size:13px;')}
  `;

  await transporter.sendMail({
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email — Puso Pilipinas',
    html: getEmailTemplate(content),
  });
};

// ── Password reset email ───────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const content = `
    ${h2('Reset Your Password')}
    ${p(`Hi ${firstName}, we received a request to reset your Puso Pilipinas password.`)}
    ${pillButton(url, 'Reset Password')}
    ${smallLink(url)}
    ${divider()}
    ${p('This link expires in <strong style="color:rgba(255,255,255,0.80)">1 hour</strong>. If you didn\'t request a reset, your password remains unchanged.', 'font-size:13px;')}
  `;

  await transporter.sendMail({
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your Password — Puso Pilipinas',
    html: getEmailTemplate(content),
  });
};

// ── Shared order rendering (Order Confirmation + Phase 6's Payment Pending/
// Reminder/Failed emails all show the same items/address block) ──────────────
const orderItemsRows = (order) => order.items.map(item => `
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid ${BORDER};font-size:14px;color:rgba(255,255,255,0.80);">
      <span style="font-weight:600;color:${WHITE};">${item.name}</span><br>
      <span style="font-size:12px;color:rgba(255,255,255,0.40);">
        Size: ${item.size}${item.color ? ` &nbsp;/&nbsp; ${item.color}` : ''} &nbsp;&middot;&nbsp; Qty: ${item.quantity}
      </span>
    </td>
    <td style="padding:12px 0;border-bottom:1px solid ${BORDER};text-align:right;font-size:14px;
               font-weight:600;color:${WHITE};white-space:nowrap;">
      &#8369;${(item.price * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
    </td>
  </tr>
`).join('');

const orderAddressBlock = (order) => order.shippingMethod === 'venue_pickup' ? `
  ${label('Pick-Up Venue')}
  ${value(`${order.shippingAddress.city}<br><span style="color:rgba(255,255,255,0.50);font-size:13px;">${order.shippingAddress.address}</span>`)}
` : `
  ${label('Ship To')}
  ${value(`
    ${order.shippingAddress.fullName}<br>
    <span style="color:rgba(255,255,255,0.50);font-size:13px;">
      ${order.shippingAddress.phone}<br>
      ${order.shippingAddress.address}<br>
      ${order.shippingAddress.city}, ${order.shippingAddress.province} ${order.shippingAddress.zipCode}
    </span>
  `)}
`;

const orderShippingLabel = (order) => order.shippingMethod === 'venue_pickup'
  ? '<span style="color:#a78bfa;">FREE &nbsp;&middot;&nbsp; Venue Pick-Up</span>'
  : (order.shippingFee === 0
      ? '<span style="color:#34d399;">FREE</span>'
      : `&#8369;${order.shippingFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);

// ── Order confirmation email ───────────────────────────────────────────────────
export const sendOrderConfirmationEmail = async (email, order) => {
  const orderUrl = `${process.env.FRONTEND_URL}/order/${order.orderNumber}`;
  const itemsRows = orderItemsRows(order);
  const addressBlock = orderAddressBlock(order);
  const shippingLabel = orderShippingLabel(order);
  const isPickup = order.shippingMethod === 'venue_pickup';

  const content = `
    ${h2('Order Confirmed!')}
    ${p('Thank you for your order. We\'ve received it and are getting it ready.')}

    ${divider()}

    <!-- Meta row -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="width:50%;vertical-align:top;">
          ${label('Order Number')}
          ${value(`<span style="font-family:monospace;letter-spacing:0.04em;">${order.orderNumber}</span>`)}
        </td>
        <td style="width:50%;vertical-align:top;">
          ${label('Order Date')}
          ${value(new Date(order.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }))}
        </td>
      </tr>
    </table>

    <!-- Items -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${itemsRows}
      <!-- Subtotal -->
      <tr>
        <td style="padding:10px 0 4px;font-size:13px;color:rgba(255,255,255,0.45);">Subtotal</td>
        <td style="padding:10px 0 4px;text-align:right;font-size:13px;color:rgba(255,255,255,0.45);">
          &#8369;${order.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </td>
      </tr>
      <!-- Shipping -->
      <tr>
        <td style="padding:4px 0;font-size:13px;color:rgba(255,255,255,0.45);">Shipping</td>
        <td style="padding:4px 0;text-align:right;font-size:13px;">${shippingLabel}</td>
      </tr>
      <!-- Total -->
      <tr>
        <td style="padding:14px 0 0;border-top:1px solid ${BORDER};font-size:16px;font-weight:700;color:${WHITE};">
          Total
        </td>
        <td style="padding:14px 0 0;border-top:1px solid ${BORDER};text-align:right;font-size:16px;
                   font-weight:700;color:${WHITE};">
          &#8369;${order.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    </table>

    ${divider()}

    ${addressBlock}

    ${pillButton(orderUrl, 'View Order')}

    ${divider()}

    ${p(isPickup
      ? 'We\'ll notify you when your order is ready for pick-up. Please bring your order confirmation.'
      : 'We\'ll send you another email once your order ships.', 'font-size:13px;')}
  `;

  await transporter.sendMail({
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Order Confirmed — ${order.orderNumber}`,
    html: getEmailTemplate(content),
  });
};

// ── Payment Platform Redesign, Phase 6 ──────────────────────────────────────────
// Payment Pending — sent once, immediately at order creation. The original
// spec listed "Order Created" and "Payment Pending" as separate emails, but
// for every real order today those two events happen in the same request
// (checkout always starts a payment session) — sending two emails back to
// back for one moment would just be noise. One honest email covering both.
export const sendPaymentPendingEmail = async (email, order) => {
  const payUrl = `${process.env.FRONTEND_URL}/order/${order.orderNumber}`;
  const itemsRows = orderItemsRows(order);
  const addressBlock = orderAddressBlock(order);
  const shippingLabel = orderShippingLabel(order);

  const content = `
    ${h2('Complete Your Payment')}
    ${p('We\'ve saved your order and reserved your items — just finish payment to lock it in.')}

    ${divider()}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="width:50%;vertical-align:top;">
          ${label('Order Number')}
          ${value(`<span style="font-family:monospace;letter-spacing:0.04em;">${order.orderNumber}</span>`)}
        </td>
        <td style="width:50%;vertical-align:top;">
          ${label('Payment Method')}
          ${value(order.paymentMethod)}
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${itemsRows}
      <tr>
        <td style="padding:10px 0 4px;font-size:13px;color:rgba(255,255,255,0.45);">Shipping</td>
        <td style="padding:10px 0 4px;text-align:right;font-size:13px;">${shippingLabel}</td>
      </tr>
      <tr>
        <td style="padding:14px 0 0;border-top:1px solid ${BORDER};font-size:16px;font-weight:700;color:${WHITE};">Total</td>
        <td style="padding:14px 0 0;border-top:1px solid ${BORDER};text-align:right;font-size:16px;font-weight:700;color:${WHITE};">
          &#8369;${order.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    </table>

    ${divider()}
    ${addressBlock}
    ${pillButton(payUrl, 'Complete Payment')}
    ${divider()}
    ${p('Your items are reserved, not guaranteed forever — if payment isn\'t completed, the reservation eventually releases and someone else can buy them. We\'ll remind you before that happens.', 'font-size:13px;')}
  `;

  await transporter.sendMail({
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Complete Your Payment — ${order.orderNumber}`,
    html: getEmailTemplate(content),
  });
};

// Payment Reminder — one template, reused for every tier in
// lib/sendPaymentReminders.js's TIERS ('24h'/'6h'/'2h' remaining until the
// order's own retention deadline, not the 1-hour Maya session — see that
// file's comment for why).
export const sendPaymentReminderEmail = async (email, order, timeRemainingLabel) => {
  const payUrl = `${process.env.FRONTEND_URL}/order/${order.orderNumber}`;
  const content = `
    ${h2('Your Order Is Waiting')}
    ${p(`Order <strong style="color:${WHITE};font-family:monospace;">${order.orderNumber}</strong> still needs payment — you have <strong style="color:${WHITE};">${timeRemainingLabel}</strong> left before your reserved items are released.`)}
    ${pillButton(payUrl, 'Complete Payment')}
    ${smallLink(payUrl)}
    ${divider()}
    ${p(`Total due: <strong style="color:${WHITE};">&#8369;${order.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>`, 'font-size:13px;')}
  `;

  await transporter.sendMail({
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Reminder: Complete Payment (${timeRemainingLabel} left) — ${order.orderNumber}`,
    html: getEmailTemplate(content),
  });
};

// Payment Failed — covers both a real gateway failure and a lapsed session
// (`reason`: 'failed' | 'expired'). Same "this is recoverable" tone as
// OrderConfirmation.jsx's own pending-state copy (Phase 3) — never a dead
// end, the order and its reserved items are still there to pay for.
export const sendPaymentFailedEmail = async (email, order, reason) => {
  const payUrl = `${process.env.FRONTEND_URL}/order/${order.orderNumber}`;
  const isExpired = reason === 'expired';

  const content = `
    ${h2(isExpired ? 'Your Payment Session Expired' : "Payment Didn't Go Through")}
    ${p(isExpired
      ? 'No problem — your order wasn\'t lost. Generate a new payment link to finish checking out.'
      : 'No problem — your order is still here. Try completing payment again below.')}
    ${pillButton(payUrl, 'Try Again')}
    ${smallLink(payUrl)}
    ${divider()}
    ${p(`Order <strong style="color:${WHITE};font-family:monospace;">${order.orderNumber}</strong> &nbsp;&middot;&nbsp; &#8369;${order.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'font-size:13px;')}
  `;

  await transporter.sendMail({
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${isExpired ? 'Payment Session Expired' : 'Payment Failed'} — ${order.orderNumber}`,
    html: getEmailTemplate(content),
  });
};

// Order status update — one parameterized template for every post-payment
// fulfillment transition an admin sets via PATCH /:id/status, rather than
// five near-identical hand-written emails (processing/packed/shipped/
// delivered/cancelled/returned all share this exact shape — the second
// through sixth real use case, not a speculative abstraction).
const ORDER_STATUS_EMAIL_COPY = {
  processing: { title: 'Your Order Is Being Processed', body: 'We\'re getting your order ready.' },
  packed: { title: 'Your Order Has Been Packed', body: 'Your order is packed and will ship soon.' },
  shipped: { title: 'Your Order Has Shipped', body: 'Your order is on its way.' },
  delivered: { title: 'Your Order Was Delivered', body: 'Your order has arrived — enjoy!' },
  cancelled: { title: 'Your Order Was Cancelled', body: 'This order has been cancelled. Contact support if this seems wrong.' },
  returned: { title: 'Your Return Was Received', body: 'We\'ve received your returned order.' },
};

export const sendOrderStatusEmail = async (email, order, status) => {
  const copy = ORDER_STATUS_EMAIL_COPY[status];
  if (!copy) return; // not a status this email covers — caller already guards, this is defense in depth

  const orderUrl = `${process.env.FRONTEND_URL}/order/${order.orderNumber}`;
  const trackingLine = status === 'shipped' && order.trackingNumber
    ? p(`Tracking: <strong style="color:${WHITE};">${order.trackingNumber}</strong>${order.courier ? ` via ${order.courier}` : ''}`, 'font-size:13px;')
    : '';

  const content = `
    ${h2(copy.title)}
    ${p(copy.body)}
    ${trackingLine}
    ${pillButton(orderUrl, 'View Order')}
    ${divider()}
    ${p(`Order <strong style="color:${WHITE};font-family:monospace;">${order.orderNumber}</strong>`, 'font-size:13px;')}
  `;

  await transporter.sendMail({
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${copy.title} — ${order.orderNumber}`,
    html: getEmailTemplate(content),
  });
};

// ── Daily Business Report email ─────────────────────────────────────────────────
const money = (n) => `&#8369;${(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const sectionLabel = (text) =>
  `<p style="margin:28px 0 12px;font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:rgba(255,255,255,0.35);">${text}</p>`;

const statCard = (num, lbl, color = WHITE) => `
  <td style="background:#1a1a1a;border-radius:8px;padding:16px;text-align:center;border:1px solid ${BORDER};">
    <div style="font-size:24px;font-weight:700;color:${color};">${num}</div>
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);margin-top:4px;">${lbl}</div>
  </td>`;

const statRow = (...cards) => {
  const cells = cards.flatMap((c, i) => (i === 0 ? [c] : [`<td style="width:10px;"></td>`, c]));
  return `<tr>${cells.join('')}</tr>`;
};

// A simple two-column "label — right-aligned value" table, used for every
// breakdown section (products/organizations/payments/shipping/try-on) so
// the report doesn't need a bespoke table shape per section.
const breakdownTable = (rows, labelHeader, valueHeader) => {
  if (rows.length === 0) {
    return `<p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.25);">No data</p>`;
  }
  const body = rows.map(([label, val]) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:rgba(255,255,255,0.65);">${label}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BORDER};font-size:13px;text-align:right;font-weight:600;color:${WHITE};">${val}</td>
    </tr>`).join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <thead><tr style="background:#1a1a1a;">
        <th style="padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.30);">${labelHeader}</th>
        <th style="padding:7px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.30);">${valueHeader}</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
};

// Weekly/Monthly/Quarterly cover more than one day — a single "Monday,
// August 3, 2026" label would misrepresent what the report actually
// covers, so a multi-day period gets an explicit range instead.
function formatPeriodLabel(report) {
  const start = report.periodStart ?? report.date;
  const end = report.periodEnd ?? new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const isSingleDay = end.getTime() - start.getTime() <= 24 * 60 * 60 * 1000;

  if (isSingleDay) {
    return start.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  const lastDayCovered = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  return `${fmt(start)} – ${fmt(lastDayCovered)}`;
}

export const sendDailyBusinessReportEmail = async (recipients, report, title = 'Daily Business Report') => {
  const dateStr = formatPeriodLabel(report);

  const content = `
    ${h2(title)}
    ${p(dateStr, 'font-size:13px;')}
    ${divider()}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${statRow(
        statCard(money(report.sales.grossRevenue), 'Gross Revenue', '#34d399'),
        statCard(report.sales.orders, 'Orders')
      )}
      <tr><td colspan="3" style="height:10px;"></td></tr>
      ${statRow(
        statCard(money(report.sales.netRevenue), 'Net Revenue'),
        statCard(money(report.sales.avgOrderValue), 'Avg Order Value')
      )}
      <tr><td colspan="3" style="height:10px;"></td></tr>
      ${statRow(
        statCard(money(report.sales.shippingRevenue), 'Shipping Revenue'),
        statCard(money(report.sales.refundedAmount), 'Refunded', report.sales.refundedAmount > 0 ? '#f87171' : WHITE)
      )}
    </table>

    ${sectionLabel('Top Selling Products')}
    ${breakdownTable(report.products.topSelling.map((x) => [`${x.name} &times;${x.quantity}`, money(x.revenue)]), 'Product', 'Revenue')}

    ${sectionLabel('Product Health')}
    ${breakdownTable([
      ['No Sales Yesterday', report.products.noSalesCount],
      ['Low Stock', report.products.lowStock],
      ['Out of Stock', report.products.outOfStock],
    ], 'Metric', 'Count')}

    ${sectionLabel('Sales by Organization')}
    ${breakdownTable(report.organizations.byOrganization.map((x) => [x.name, money(x.revenue)]), 'Organization', 'Revenue')}

    ${sectionLabel('Sales by League')}
    ${breakdownTable(report.organizations.byLeague.map((x) => [x.name, money(x.revenue)]), 'League', 'Revenue')}

    ${sectionLabel('Customers')}
    ${breakdownTable([
      ['New Customers', report.customers.newCustomers],
      ['Returning Customers', report.customers.returningCustomers],
      ['Repeat Purchase Rate', `${report.customers.repeatPurchaseRate}%`],
    ], 'Metric', 'Value')}

    ${sectionLabel('Payments')}
    ${breakdownTable([
      ['Successful', report.payments.successful],
      ['Failed', report.payments.failed],
      ['Pending', report.payments.pending],
      ['Refunded', report.payments.refunded],
    ], 'Status', 'Count')}
    ${breakdownTable(report.payments.byMethod.map((x) => [x.method, x.count]), 'Method', 'Count')}

    ${sectionLabel('Shipping')}
    ${breakdownTable([
      ['Awaiting Shipment', report.shipping.awaitingShipment],
      ['In Transit', report.shipping.inTransit],
      ['Delivered', report.shipping.delivered],
    ], 'Status', 'Orders')}

    ${sectionLabel('Fit Check')}
    ${breakdownTable([
      ['Sessions', report.tryOn.sessions],
      ['Successful Generations', report.tryOn.successful],
      ['Failed Generations', report.tryOn.failed],
      ['Success Rate', `${report.tryOn.successRate}%`],
    ], 'Metric', 'Value')}
    ${breakdownTable(report.tryOn.mostTriedOn.map((x) => [x.productName ?? 'Unknown', x.count]), 'Product', 'Sessions')}

    ${divider()}
    ${p('Refund Requests and Support Issues are not shown — not yet tracked by the platform. Checkout Abandonment now has its own dedicated report (Admin &rarr; Reports &rarr; Checkout Recovery), not folded into this daily digest.', 'font-size:12px;color:rgba(255,255,255,0.35);')}
  `;

  await transporter.sendMail({
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: recipients.join(', '),
    subject: `${title} — ${dateStr}`,
    html: getEmailTemplate(content),
  });
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendPaymentPendingEmail,
  sendPaymentReminderEmail,
  sendPaymentFailedEmail,
  sendOrderStatusEmail,
  sendDailyBusinessReportEmail,
};
