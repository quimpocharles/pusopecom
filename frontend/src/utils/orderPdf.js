import { orderStatusLabel } from './orderStatus';

// "Download Order Summary (PDF)" (Payment Platform Redesign, Phase 3) —
// generated client-side from data the page already has, no server round
// trip. Deliberately a plain, single-page summary (order number/date,
// items, totals, shipping address) rather than a styled receipt — the
// email confirmation is the receipt of record; this is a quick "I need
// this on paper/attached to an email" convenience.
//
// jsPDF is dynamically imported, not a top-level import: its bundle pulls
// in html2canvas/dompurify internally even though this file only uses
// basic text APIs (not tree-shakeable away), which was adding ~130KB
// gzipped to every visit of this page for a button most visitors never
// click. Deferred to the moment it's actually needed instead.
export async function downloadOrderSummaryPdf(order) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const marginX = 20;
  let y = 20;

  const line = (text, size = 11, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(text, marginX, y);
    y += size / 2 + 4;
  };

  line('PusoStore — Order Summary', 16, true);
  y += 2;
  line(`Order Number: ${order.orderNumber}`);
  line(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-PH')}`);
  line(`Payment Status: ${order.paymentStatus}`);
  line(`Order Status: ${orderStatusLabel(order.orderStatus)}`);
  y += 4;

  line('Items', 13, true);
  for (const item of order.items) {
    line(`${item.name}  (Size: ${item.size}${item.color ? `, ${item.color}` : ''})  x${item.quantity}  —  ₱${(item.price * item.quantity).toFixed(2)}`, 10);
  }
  y += 4;

  line('Shipping Address', 13, true);
  line(order.shippingAddress.fullName, 10);
  line(order.shippingAddress.phone, 10);
  line(order.shippingAddress.address, 10);
  line(`${order.shippingAddress.city}, ${order.shippingAddress.province} ${order.shippingAddress.zipCode}`, 10);
  y += 4;

  line('Total', 13, true);
  line(`Subtotal: ₱${order.subtotal.toFixed(2)}`, 10);
  line(`Shipping: ₱${order.shippingFee.toFixed(2)}`, 10);
  line(`Total: ₱${order.total.toFixed(2)}`, 12, true);

  doc.save(`${order.orderNumber}-summary.pdf`);
}

export default downloadOrderSummaryPdf;
