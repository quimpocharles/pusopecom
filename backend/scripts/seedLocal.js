// Seeds a LOCAL database with enough realistic data for training-guide / screenshot work:
// real catalog products across categories, the Docs Admin / Docs Customer pair, and orders in
// three states (paid → awaiting picking, awaiting payment, shipped with courier + tracking).
//
// Run with `npm run db:local:seed` (see README "Local database"). Refuses to run against anything
// but localhost, so it can never write to production. Safe to re-run: every row is upserted.
import prisma from '../lib/prisma.js';
import * as productRepository from '../repositories/productRepository.js';
import * as userRepository from '../repositories/userRepository.js';

const { hostname } = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
  console.error(`Refusing to seed: DATABASE_URL points at ${hostname}, not localhost.`);
  process.exit(1);
}

const PASSWORD = 'PusoDocs2026!';
// Real catalog items with their public Cloudinary images, so local screenshots look like the live
// store. Stock figures are local-only.
const CDN = 'https://res.cloudinary.com/dzps2jbk3/image/upload';

const PRODUCTS = [
  {
    name: 'GILAS 2025 OVERSIZED SHIRT', slug: 'gilas-2025-oversized-shirt', category: 'jersey', sport: 'basketball',
    gender: 'unisex', league: 'Team Pilipinas', team: 'Gilas Pilipinas', price: 1499.67, featured: true, tryOnEnabled: true,
    description: 'Oversized shirt from the Gilas Pilipinas 2025 collection.',
    images: [`${CDN}/v1785729881/puso-shop/products/ihjyotsdhadw9g8yzg3o.jpg`],
    sizes: [{ size: 'S', stock: 8 }, { size: 'M', stock: 12 }, { size: 'L', stock: 10 }, { size: 'XL', stock: 6 }],
  },
  {
    name: 'Adamson University Classic Tee', slug: 'adamson-university-classic-tee', category: 'tshirt', sport: 'general',
    gender: 'unisex', league: 'UAAP', team: 'Adamson University', price: 800, tryOnEnabled: true,
    description: 'Classic Tee in Blue, officially licensed Adamson University UAAP merchandise.',
    images: [`${CDN}/v1785467092/puso-shop/products/x6qsl2ja0powrlmyocyz.jpg`],
    colors: [{ color: 'Blue', sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((size) => ({ size, stock: size === 'M' ? 0 : 5 })) }],
  },
  {
    name: 'Adamson University Long Sticker', slug: 'adamson-university-long-sticker', category: 'accessories', sport: 'general',
    gender: 'unisex', league: 'UAAP', team: 'Adamson University', price: 100,
    description: 'Long vinyl sticker, officially licensed Adamson University UAAP merchandise.',
    images: [`${CDN}/v1785467152/puso-shop/products/hmfofxacutscdamlxiup.jpg`],
    colors: [{ color: 'Blue', sizes: [{ size: 'One Size', stock: 30 }] }],
  },
  {
    name: 'Far Eastern University Cap', slug: 'far-eastern-university-cap', category: 'cap', sport: 'general',
    gender: 'unisex', league: 'UAAP', team: 'Far Eastern University', price: 950,
    description: 'Adjustable cap, officially licensed Far Eastern University UAAP merchandise.',
    images: [`${CDN}/v1785467135/puso-shop/products/zedyrtlnf6ckkktgynil.jpg`],
    colors: [{ color: 'Green/Yellow', sizes: [{ size: 'One Size', stock: 15 }] }],
  },
  {
    name: 'University of Santo Tomas Keychain', slug: 'university-of-santo-tomas-keychain', category: 'accessories', sport: 'general',
    gender: 'unisex', league: 'UAAP', team: 'University of Santo Tomas', price: 150,
    description: 'Keychain, officially licensed University of Santo Tomas UAAP merchandise.',
    images: [`${CDN}/v1785467193/puso-shop/products/qh7wqxwcm1mm5anx1kbl.jpg`],
    colors: [{ color: 'Yellow', sizes: [{ size: 'One Size', stock: 25 }] }],
  },
  {
    name: 'Pilipinas Jacket', slug: 'pilipinas-jacket', category: 'jacket', sport: 'general',
    gender: 'unisex', league: 'Team Pilipinas', team: 'Gilas Pilipinas', price: 3500, tryOnEnabled: true,
    description: 'Varsity-style Pilipinas jacket.',
    images: [`${CDN}/v1787908854/puso-shop/products/gddrit4n6hzwgwor5rtr.png`, `${CDN}/v1787908863/puso-shop/products/hqyovcxrz0hnxfbpeqcu.png`],
    sizes: [{ size: 'M', stock: 2 }, { size: 'L', stock: 1 }, { size: 'XL', stock: 0 }],
  },
];

async function upsertProduct(p) {
  const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
  return existing ?? productRepository.create(p);
}

async function upsertUser({ email, firstName, lastName, role, department }) {
  let user = await userRepository.findByEmail(email);
  if (!user) {
    user = await userRepository.create({
      email, password: PASSWORD, firstName, lastName, role,
      emailVerified: true, ageVerified: true, authProvider: 'local',
    });
  }
  const userId = user.id ?? user._id;
  if (department) {
    await prisma.staffProfile.upsert({
      where: { userId },
      update: { department, active: true },
      create: { userId, department, permissions: [], active: true },
    });
  }
  return userId;
}

const SHIP_TO = {
  shipToFullName: 'Docs Customer', shipToPhone: '09170000000', shipToCountry: 'Philippines',
  shipToAddress: '123 Sample Street', shipToCity: 'Quezon City', shipToProvince: 'Metro Manila',
  shipToRegion: 'National Capital Region (NCR)', shipToBarangay: 'Sample Barangay', shipToZipCode: '1100',
};

async function upsertOrder({ orderNumber, userId, lines, status, daysAgo }) {
  if (await prisma.order.findUnique({ where: { orderNumber } })) return;
  const at = (offsetMinutes = 0) => new Date(Date.now() - daysAgo * 86400000 + offsetMinutes * 60000);
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const shippingFee = 99;
  const paid = status !== 'awaiting_payment';

  const order = await prisma.order.create({
    data: {
      orderNumber, userId, email: 'docs-customer@pusostore.com', ...SHIP_TO,
      subtotal, shippingFee, total: subtotal + shippingFee, paymentMethod: 'epaygames', paymentChannel: 'QRPH',
      paymentStatus: paid ? 'paid' : 'pending', orderStatus: status,
      shippingMethod: 'standard', shippingRegion: '13', createdAt: at(),
      ...(status === 'shipped' && { courier: 'LBC', trackingNumber: 'LBC-DOCS-000123' }),
      items: { create: lines.map(({ product, ...l }) => ({ ...l, productId: product.id ?? product._id, name: product.name, image: product.images[0] })) },
      payments: { create: { provider: 'epaygames', status: paid ? 'succeeded' : 'pending', paidAt: paid ? at(5) : null, createdAt: at(1) } },
      events: {
        create: [
          { type: 'created', actor: 'customer', message: `Order placed with ${lines.length} item${lines.length > 1 ? 's' : ''}`, createdAt: at() },
          { type: 'payment_pending', actor: 'system', message: 'Checkout session created via epaygames', createdAt: at(1) },
          ...(paid ? [{ type: 'payment_succeeded', actor: 'system', message: 'Payment confirmed via epaygames', createdAt: at(5) }] : []),
        ],
      },
    },
  });

  if (!paid) return;
  const shipped = status === 'shipped';
  await prisma.shipment.create({
    data: {
      orderId: order.id, status: shipped ? 'in_transit' : 'awaiting_picking',
      ...(shipped && { courier: 'LBC', trackingNumber: 'LBC-DOCS-000123', packedAt: at(600), pickedUpAt: at(1440) }),
      events: {
        create: [
          { type: 'created', actor: 'system', message: 'Shipment created — awaiting picking', toStatus: 'awaiting_picking', createdAt: at(5) },
          ...(shipped ? [{ type: 'status_changed', actor: 'admin', message: 'Handed to LBC — in transit', fromStatus: 'picked_up', toStatus: 'in_transit', createdAt: at(1440) }] : []),
        ],
      },
    },
  });
}

const products = {};
for (const p of PRODUCTS) products[p.slug] = await upsertProduct(p);

// Same announcement-bar/marquee copy the live CMS carries, so the header looks like production.
for (const m of [
  { placement: 'announcement', text: 'FREE shipping on orders ₱2,000 and above 🇵🇭' },
  { placement: 'marquee', text: 'Try jerseys virtually before you buy' },
]) {
  if (!(await prisma.promoMessage.findFirst({ where: m }))) await prisma.promoMessage.create({ data: m });
}

await upsertUser({ email: 'docs-admin@pusostore.com', firstName: 'Docs', lastName: 'Admin', role: 'admin', department: 'executive' });
const customerId = await upsertUser({ email: 'docs-customer@pusostore.com', firstName: 'Docs', lastName: 'Customer', role: 'customer' });

await upsertOrder({
  orderNumber: 'PS-LOCAL-SHIPPED', userId: customerId, status: 'shipped', daysAgo: 3,
  lines: [{ product: products['gilas-2025-oversized-shirt'], size: 'M', quantity: 1, price: 1499.67 }],
});
await upsertOrder({
  orderNumber: 'PS-LOCAL-PAID', userId: customerId, status: 'paid', daysAgo: 1,
  lines: [
    { product: products['university-of-santo-tomas-keychain'], size: 'One Size', color: 'Yellow', quantity: 2, price: 150 },
    { product: products['far-eastern-university-cap'], size: 'One Size', color: 'Green/Yellow', quantity: 1, price: 950 },
  ],
});
await upsertOrder({
  orderNumber: 'PS-LOCAL-AWAITING', userId: customerId, status: 'awaiting_payment', daysAgo: 0,
  lines: [{ product: products['adamson-university-classic-tee'], size: 'L', color: 'Blue', quantity: 1, price: 800 }],
});

console.log(`Seeded local database: ${PRODUCTS.length} products, 2 accounts (password ${PASSWORD}), 3 orders.`);
await prisma.$disconnect();
