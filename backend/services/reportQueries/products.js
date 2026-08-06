import * as orderRepository from '../../repositories/orderRepository.js';
import * as productRepository from '../../repositories/productRepository.js';
import { getDateFilter, groupBy } from '../../lib/reportQueryHelpers.js';

// Moved out of routes/reports.js (zero logic change) — see sales.js's
// header comment for why.
export async function computeProductsReport(query) {
  const dateFilter = getDateFilter(query);

  const paidOrders = await orderRepository.find({
    where: { paymentStatus: 'paid', ...dateFilter },
    include: { items: { include: { product: true } } },
  });
  const allItems = paidOrders.flatMap((o) => o.items);

  const productAgg = [...groupBy(allItems, (i) => i.product._id)].map(([, items]) => ({
    name: items[0].name,
    image: items[0].image,
    units: items.reduce((s, i) => s + i.quantity, 0),
    revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
  }));
  const bestSellers = [...productAgg].sort((a, b) => b.units - a.units).slice(0, 10);
  const worstSellers = [...productAgg].sort((a, b) => a.units - b.units).slice(0, 10);

  const salesByLeague = [...groupBy(allItems.filter((i) => i.product.league), (i) => i.product.league)]
    .map(([league, items]) => ({
      league,
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
      units: items.reduce((s, i) => s + i.quantity, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const salesByTeam = [...groupBy(allItems.filter((i) => i.product.team), (i) => i.product.team)]
    .map(([team, items]) => ({
      team,
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
      units: items.reduce((s, i) => s + i.quantity, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  const [outOfStock, lowStock, healthy, lowStockProducts] = await Promise.all([
    productRepository.count({ where: { active: true, totalStock: 0 } }),
    productRepository.count({ where: { active: true, totalStock: { gt: 0, lte: 5 } } }),
    productRepository.count({ where: { active: true, totalStock: { gt: 5 } } }),
    productRepository.find({
      where: { active: true, totalStock: { lte: 5 } },
      orderBy: { totalStock: 'asc' },
      take: 15,
    }),
  ]);

  return {
    bestSellers,
    worstSellers,
    salesByLeague,
    salesByTeam,
    stockLevels: { outOfStock, lowStock, healthy },
    lowStockProducts,
  };
}

export function productsReportToExportShape(data) {
  return {
    summary: [
      ['Out of Stock', data.stockLevels.outOfStock],
      ['Low Stock', data.stockLevels.lowStock],
      ['Healthy Stock', data.stockLevels.healthy],
    ],
    sheets: [
      {
        name: 'Best Sellers',
        columns: [{ header: 'Product', key: 'name' }, { header: 'Units', key: 'units' }, { header: 'Revenue', key: 'revenue' }],
        rows: data.bestSellers,
        totals: { units: true, revenue: true },
      },
      {
        name: 'Worst Sellers',
        columns: [{ header: 'Product', key: 'name' }, { header: 'Units', key: 'units' }, { header: 'Revenue', key: 'revenue' }],
        rows: data.worstSellers,
        totals: { units: true, revenue: true },
      },
      {
        name: 'By League',
        columns: [{ header: 'League', key: 'league' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
        rows: data.salesByLeague,
        totals: { revenue: true, units: true },
      },
      {
        name: 'By Team',
        columns: [{ header: 'Team', key: 'team' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
        rows: data.salesByTeam,
        totals: { revenue: true, units: true },
      },
      {
        name: 'Low Stock',
        columns: [{ header: 'Product', key: 'name' }, { header: 'Stock', key: 'totalStock' }],
        rows: data.lowStockProducts,
      },
    ],
  };
}

/**
 * The scheduled "Inventory Report" (Reports Module Redesign, Phase 3) is
 * a stock-focused subset of the same computeProductsReport data — best/
 * worst sellers and league/team breakdowns belong to the Sales/Products
 * workspace, not a report titled Inventory.
 */
export function inventoryReportToExportShape(data) {
  return {
    summary: [
      ['Out of Stock', data.stockLevels.outOfStock],
      ['Low Stock', data.stockLevels.lowStock],
      ['Healthy Stock', data.stockLevels.healthy],
    ],
    sheets: [
      {
        name: 'Low Stock',
        columns: [{ header: 'Product', key: 'name' }, { header: 'Stock', key: 'totalStock' }],
        rows: data.lowStockProducts,
      },
    ],
  };
}
