import logger from '../lib/logger.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { sendDailySalesEmail } from './emailService.js';

export const generateAndSendDailySalesReport = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    logger.warn('ADMIN_EMAIL not set, skipping daily sales report');
    return;
  }

  // Today's date range in Philippine time (UTC+8)
  const now = new Date();
  const phOffset = 8 * 60 * 60 * 1000;
  const phNow = new Date(now.getTime() + phOffset);
  const startOfDay = new Date(Date.UTC(
    phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate()
  ) - phOffset);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const dateFilter = { createdAt: { gte: startOfDay, lt: endOfDay } };

  // All orders created today
  const allOrders = await orderRepository.find({ where: dateFilter });

  // Paid orders only for revenue stats
  const paidOrders = allOrders.filter(o => o.paymentStatus === 'paid');

  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const totalItemsSold = paidOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, item) => s + item.quantity, 0), 0
  );
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  // Top 5 products by quantity from paid orders
  const productMap = new Map();
  for (const order of paidOrders) {
    for (const item of order.items) {
      const key = item.name;
      const existing = productMap.get(key) || { name: key, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.price * item.quantity;
      productMap.set(key, existing);
    }
  }
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Order status breakdown (all orders today)
  const ordersByStatus = { processing: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0 };
  for (const order of allOrders) {
    if (order.orderStatus in ordersByStatus) {
      ordersByStatus[order.orderStatus]++;
    }
  }

  // Payment status breakdown (all orders today)
  const paymentsByStatus = { paid: 0, pending: 0, failed: 0, refunded: 0 };
  for (const order of allOrders) {
    if (order.paymentStatus in paymentsByStatus) {
      paymentsByStatus[order.paymentStatus]++;
    }
  }

  // New customers registered today
  const newCustomers = await userRepository.count({ where: dateFilter });

  const report = {
    date: startOfDay,
    totalOrders: paidOrders.length,
    totalRevenue,
    totalItemsSold,
    avgOrderValue,
    topProducts,
    ordersByStatus,
    paymentsByStatus,
    newCustomers
  };

  await sendDailySalesEmail(adminEmail, report);
  logger.info({ adminEmail }, 'Daily sales report sent');
};
