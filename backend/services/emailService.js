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
const LOGO_URL  = `${process.env.FRONTEND_URL}/Logo.png`;

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
              <img src="${LOGO_URL}" alt="Puso Pilipinas" width="120" height="auto"
                   style="display:block;margin:0 auto 16px;" />
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

// ── Order confirmation email ───────────────────────────────────────────────────
export const sendOrderConfirmationEmail = async (email, order) => {
  const orderUrl = `${process.env.FRONTEND_URL}/order/${order.orderNumber}`;
  const isPickup  = order.shippingMethod === 'venue_pickup';

  const itemsRows = order.items.map(item => `
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

  const addressBlock = isPickup ? `
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

  const shippingLabel = isPickup
    ? '<span style="color:#a78bfa;">FREE &nbsp;&middot;&nbsp; Venue Pick-Up</span>'
    : (order.shippingFee === 0
        ? '<span style="color:#34d399;">FREE</span>'
        : `&#8369;${order.shippingFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);

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

// ── Daily sales email ──────────────────────────────────────────────────────────
export const sendDailySalesEmail = async (adminEmail, report) => {
  const dateStr = report.date.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const topProductsRows = report.topProducts.length > 0
    ? report.topProducts.map((p, i) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:rgba(255,255,255,0.40);">${i + 1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:rgba(255,255,255,0.80);">${p.name}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;text-align:center;color:rgba(255,255,255,0.80);">${p.quantity}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;text-align:right;font-weight:600;color:${WHITE};">
            &#8369;${p.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="4" style="padding:12px 10px;text-align:center;font-size:13px;color:rgba(255,255,255,0.25);">No products sold today</td></tr>`;

  const orderStatusRows = Object.entries(report.ordersByStatus).map(([status, count]) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid ${BORDER};font-size:13px;text-transform:capitalize;color:rgba(255,255,255,0.65);">${status}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BORDER};font-size:13px;text-align:right;font-weight:600;color:${WHITE};">${count}</td>
    </tr>
  `).join('');

  const paymentStatusRows = Object.entries(report.paymentsByStatus).map(([status, count]) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid ${BORDER};font-size:13px;text-transform:capitalize;color:rgba(255,255,255,0.65);">${status}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BORDER};font-size:13px;text-align:right;font-weight:600;color:${WHITE};">${count}</td>
    </tr>
  `).join('');

  const statCard = (num, lbl, color = WHITE) => `
    <td style="background:#1a1a1a;border-radius:8px;padding:16px;text-align:center;border:1px solid ${BORDER};">
      <div style="font-size:26px;font-weight:700;color:${color};">${num}</div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);margin-top:4px;">${lbl}</div>
    </td>`;

  const content = `
    ${h2('Daily Sales Summary')}
    ${p(dateStr, 'font-size:13px;')}

    ${divider()}

    <!-- Stat grid -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        ${statCard(`&#8369;${report.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Total Revenue', '#34d399')}
        <td style="width:10px;"></td>
        ${statCard(report.totalOrders, 'Paid Orders')}
      </tr>
      <tr><td colspan="3" style="height:10px;"></td></tr>
      <tr>
        ${statCard(report.totalItemsSold, 'Items Sold')}
        <td style="width:10px;"></td>
        ${statCard(`&#8369;${report.avgOrderValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Avg Order Value')}
      </tr>
    </table>

    ${divider()}

    <!-- Top products -->
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Top Selling Products</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <thead>
        <tr style="background:#1a1a1a;">
          <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.30);font-weight:600;">#</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.30);font-weight:600;">Product</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.30);font-weight:600;">Qty</th>
          <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.30);font-weight:600;">Revenue</th>
        </tr>
      </thead>
      <tbody>${topProductsRows}</tbody>
    </table>

    ${divider()}

    <!-- Status tables -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;width:48%;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Orders by Status</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${orderStatusRows}</table>
        </td>
        <td style="width:4%;"></td>
        <td style="vertical-align:top;width:48%;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Payment Status</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${paymentStatusRows}</table>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- New customers -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#1a1a1a;border-radius:8px;padding:14px 16px;border:1px solid ${BORDER};">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.35);">New Customers Today &nbsp;</span>
          <span style="font-size:20px;font-weight:700;color:${WHITE};">${report.newCustomers}</span>
        </td>
      </tr>
    </table>
  `;

  await transporter.sendMail({
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `Daily Sales Report — ${dateStr}`,
    html: getEmailTemplate(content),
  });
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendDailySalesEmail,
};
