import { useState, useEffect } from 'react';
import ReportCard from './ReportCard';
import HorizontalBarList from './HorizontalBarList';
import reportService from '../../../services/reportService';

const formatPeso = (val) => `₱${Number(val).toLocaleString()}`;

const ProductsSection = ({ dateParams }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService.getProductsReport(dateParams).then(res => {
      if (!cancelled) setData(res.data);
    }).catch(err => {
      console.error('Products report error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Product Performance</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-6 bg-gray-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stockLevels } = data;
  const totalStock = stockLevels.outOfStock + stockLevels.lowStock + stockLevels.healthy;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Product Performance</h2>

      {/* Stock overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">{stockLevels.outOfStock}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Low Stock (&le;5)</p>
          <p className="text-2xl font-bold text-amber-600">{stockLevels.lowStock}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Healthy Stock</p>
          <p className="text-2xl font-bold text-green-600">{stockLevels.healthy}</p>
        </ReportCard>
      </div>

      {/* Best and worst sellers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard title="Best Sellers">
          <div className="space-y-3">
            {data.bestSellers.map((product, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                {product.image && (
                  <img src={product.image} alt="" className="w-8 h-8 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.units} units &middot; {formatPeso(product.revenue)}</p>
                </div>
              </div>
            ))}
            {data.bestSellers.length === 0 && (
              <p className="text-sm text-gray-500">No sales data</p>
            )}
          </div>
        </ReportCard>
        <ReportCard title="Worst Sellers">
          <div className="space-y-3">
            {data.worstSellers.map((product, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                {product.image && (
                  <img src={product.image} alt="" className="w-8 h-8 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.units} units &middot; {formatPeso(product.revenue)}</p>
                </div>
              </div>
            ))}
            {data.worstSellers.length === 0 && (
              <p className="text-sm text-gray-500">No sales data</p>
            )}
          </div>
        </ReportCard>
      </div>

      {/* League and team breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard title="Sales by League">
          <HorizontalBarList
            items={data.salesByLeague}
            labelKey="league"
            valueKey="revenue"
            formatValue={formatPeso}
            color="bg-purple-500"
          />
        </ReportCard>
        <ReportCard title="Sales by Team">
          <HorizontalBarList
            items={data.salesByTeam}
            labelKey="team"
            valueKey="revenue"
            formatValue={formatPeso}
            maxItems={15}
            color="bg-indigo-500"
          />
        </ReportCard>
      </div>

      {/* Low stock products */}
      {data.lowStockProducts.length > 0 && (
        <ReportCard title="Low Stock Products">
          <div className="space-y-2">
            {data.lowStockProducts.map((product) => (
              <div key={product._id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3 min-w-0">
                  {product.images?.[0] && (
                    <img src={product.images[0]} alt="" className="w-8 h-8 rounded object-cover" />
                  )}
                  <span className="text-sm text-gray-900 truncate">{product.name}</span>
                </div>
                <span className={`text-sm font-semibold ${product.totalStock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {product.totalStock} left
                </span>
              </div>
            ))}
          </div>
        </ReportCard>
      )}
    </div>
  );
};

export default ProductsSection;
