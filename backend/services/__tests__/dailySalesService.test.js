import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/orderRepository.js', () => ({ find: vi.fn() }));
vi.mock('../../repositories/userRepository.js', () => ({ count: vi.fn() }));
vi.mock('../emailService.js', () => ({ sendDailySalesEmail: vi.fn().mockResolvedValue(undefined) }));

const orderRepository = await import('../../repositories/orderRepository.js');
const userRepository = await import('../../repositories/userRepository.js');
const emailService = await import('../emailService.js');
const { generateAndSendDailySalesReport } = await import('../dailySalesService.js');

const originalAdminEmail = process.env.ADMIN_EMAIL;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = 'admin@test.local';
});

describe('generateAndSendDailySalesReport', () => {
  it('skips sending when ADMIN_EMAIL is not configured', async () => {
    delete process.env.ADMIN_EMAIL;
    await generateAndSendDailySalesReport();
    expect(emailService.sendDailySalesEmail).not.toHaveBeenCalled();
    process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it('aggregates revenue, top products, and status breakdowns from paid orders only', async () => {
    orderRepository.find.mockResolvedValueOnce([
      {
        paymentStatus: 'paid', orderStatus: 'confirmed', total: 1000,
        items: [{ name: 'Jersey', quantity: 2, price: 400 }, { name: 'Cap', quantity: 1, price: 200 }],
      },
      {
        paymentStatus: 'paid', orderStatus: 'processing', total: 500,
        items: [{ name: 'Jersey', quantity: 1, price: 500 }],
      },
      {
        // pending — excluded from revenue/top-products, but still counted in the status breakdowns
        paymentStatus: 'pending', orderStatus: 'processing', total: 300,
        items: [{ name: 'Shorts', quantity: 1, price: 300 }],
      },
    ]);
    userRepository.count.mockResolvedValueOnce(3);

    await generateAndSendDailySalesReport();

    expect(emailService.sendDailySalesEmail).toHaveBeenCalledTimes(1);
    const [adminEmail, report] = emailService.sendDailySalesEmail.mock.calls[0];
    expect(adminEmail).toBe('admin@test.local');

    expect(report.totalOrders).toBe(2); // paid orders only
    expect(report.totalRevenue).toBe(1500);
    expect(report.totalItemsSold).toBe(4); // 2 + 1 + 1
    expect(report.avgOrderValue).toBe(750);
    expect(report.newCustomers).toBe(3);

    expect(report.topProducts[0]).toMatchObject({ name: 'Jersey', quantity: 3, revenue: 1300 });
    expect(report.topProducts.find((p) => p.name === 'Cap')).toMatchObject({ quantity: 1, revenue: 200 });
    expect(report.topProducts.find((p) => p.name === 'Shorts')).toBeUndefined(); // from the pending order — excluded

    expect(report.ordersByStatus).toEqual({ processing: 2, confirmed: 1, shipped: 0, delivered: 0, cancelled: 0 });
    expect(report.paymentsByStatus).toEqual({ paid: 2, pending: 1, failed: 0, refunded: 0 });
  });

  it('reports zeros cleanly when there are no orders today', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    userRepository.count.mockResolvedValueOnce(0);

    await generateAndSendDailySalesReport();

    const [, report] = emailService.sendDailySalesEmail.mock.calls[0];
    expect(report.totalOrders).toBe(0);
    expect(report.totalRevenue).toBe(0);
    expect(report.avgOrderValue).toBe(0);
    expect(report.topProducts).toEqual([]);
  });

  it('queries orderRepository with a createdAt range covering today in Philippine time', async () => {
    orderRepository.find.mockResolvedValueOnce([]);
    userRepository.count.mockResolvedValueOnce(0);

    await generateAndSendDailySalesReport();

    const [{ where }] = orderRepository.find.mock.calls[0];
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lt.getTime() - where.createdAt.gte.getTime()).toBe(24 * 60 * 60 * 1000);

    const [{ where: userWhere }] = userRepository.count.mock.calls[0];
    expect(userWhere.createdAt.gte.getTime()).toBe(where.createdAt.gte.getTime());
  });
});
