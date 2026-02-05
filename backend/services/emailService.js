import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

const getEmailTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
      padding: 30px 20px;
      text-align: center;
      color: white;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 30px 20px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #DC2626;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .footer {
      background: #f8f8f8;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Puso Pilipinas</h1>
      <p style="margin: 5px 0 0 0;">Sports Merchandise Store</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Puso Pilipinas. All rights reserved.</p>
      <p>This email was sent to you from Puso Pilipinas Sports Merchandise Store.</p>
    </div>
  </div>
</body>
</html>
`;

export const sendVerificationEmail = async (email, firstName, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const content = `
    <h2>Welcome to Puso Pilipinas, ${firstName}!</h2>
    <p>Thank you for registering with us. We're excited to have you as part of our community!</p>
    <p>To complete your registration and start shopping, please verify your email address by clicking the button below:</p>
    <p style="text-align: center;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
    <p>This link will expire in 24 hours.</p>
    <p>If you didn't create an account with Puso Pilipinas, please ignore this email.</p>
  `;

  const mailOptions = {
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - Puso Pilipinas',
    html: getEmailTemplate(content)
  };

  await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const content = `
    <h2>Password Reset Request</h2>
    <p>Hi ${firstName},</p>
    <p>We received a request to reset your password for your Puso Pilipinas account.</p>
    <p>Click the button below to reset your password:</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666;">${resetUrl}</p>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
  `;

  const mailOptions = {
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your Password - Puso Pilipinas',
    html: getEmailTemplate(content)
  };

  await transporter.sendMail(mailOptions);
};

export const sendOrderConfirmationEmail = async (email, order) => {
  const orderUrl = `${process.env.FRONTEND_URL}/order/${order.orderNumber}`;

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <strong>${item.name}</strong><br>
        Size: ${item.size}<br>
        Quantity: ${item.quantity}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        ₱${(item.price * item.quantity).toFixed(2)}
      </td>
    </tr>
  `).join('');

  const content = `
    <h2>Order Confirmation</h2>
    <p>Thank you for your order!</p>
    <p>Your order has been received and is being processed.</p>
    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
    <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

    <h3>Order Details</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      ${itemsHtml}
      <tr>
        <td style="padding: 10px; border-top: 2px solid #ddd;"><strong>Subtotal</strong></td>
        <td style="padding: 10px; border-top: 2px solid #ddd; text-align: right;"><strong>₱${order.subtotal.toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px;">Shipping Fee</td>
        <td style="padding: 10px; text-align: right;">₱${order.shippingFee.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-top: 2px solid #ddd;"><strong>Total</strong></td>
        <td style="padding: 10px; border-top: 2px solid #ddd; text-align: right;"><strong>₱${order.total.toFixed(2)}</strong></td>
      </tr>
    </table>

    <h3>Shipping Address</h3>
    <p>
      ${order.shippingAddress.fullName}<br>
      ${order.shippingAddress.phone}<br>
      ${order.shippingAddress.address}<br>
      ${order.shippingAddress.city}, ${order.shippingAddress.province} ${order.shippingAddress.zipCode}
    </p>

    <p style="text-align: center; margin-top: 30px;">
      <a href="${orderUrl}" class="button">View Order Details</a>
    </p>

    <p>We'll send you another email when your order ships.</p>
    <p>If you have any questions, please don't hesitate to contact us.</p>
  `;

  const mailOptions = {
    from: `"Puso Pilipinas" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Order Confirmation - ${order.orderNumber}`,
    html: getEmailTemplate(content)
  };

  await transporter.sendMail(mailOptions);
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail
};
