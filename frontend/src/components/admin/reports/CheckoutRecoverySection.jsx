import { useState, useEffect } from 'react';
import ReportCard from './ReportCard';
import ExportButtons from './ExportButtons';
import reportService from '../../../services/reportService';

// Payment Platform Redesign, Phase 7 — the metric the Daily Business Report
// email has flagged as "not yet tracked by the platform" since before this
// redesign started. Built off real Payment/OrderStatus data (Phases 1-2),
// not a placeholder.
const CheckoutRecoverySection = ({ dateParams }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [webhookHealth, setWebhookHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService.getCheckoutRecoveryReport(dateParams).then(res => {
      if (!cancelled) setData(res.data);
    }).catch(err => {
      console.error('Checkout recovery report error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams]);

  useEffect(() => {
    let cancelled = false;
    reportService.getWebhookHealth().then(res => {
      if (!cancelled) setWebhookHealth(res.data);
    }).catch(err => console.error('Webhook health error:', err));
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Checkout Recovery</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Checkout Recovery</h2>
        <ExportButtons reportKey="checkout-recovery" dateParams={dateParams} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Pending Orders</p>
          <p className="text-2xl font-bold text-yellow-600">{data.pendingOrders}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Recovered Payments</p>
          <p className="text-2xl font-bold text-green-600">{data.recoveredPayments}</p>
          <p className="text-xs text-gray-500">₱{data.revenueRecovered.toLocaleString()} recovered</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Recovery Rate</p>
          <p className="text-2xl font-bold text-blue-600">{data.recoveryRate}%</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Abandonment Rate</p>
          <p className="text-2xl font-bold text-red-600">{data.abandonmentRate}%</p>
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <ReportCard>
          <p className="text-sm text-gray-500">Avg Recovery Time</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.avgRecoveryTimeMinutes >= 60
              ? `${Math.round(data.avgRecoveryTimeMinutes / 60)}h`
              : `${data.avgRecoveryTimeMinutes}m`}
          </p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Expired Sessions</p>
          <p className="text-2xl font-bold text-gray-900">{data.expiredSessions}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Retry Count</p>
          <p className="text-2xl font-bold text-gray-900">{data.retryCount}</p>
        </ReportCard>
        <ReportCard>
          <p className="text-sm text-gray-500">Never Recovered</p>
          <p className="text-2xl font-bold text-gray-900">{data.neverRecovered}</p>
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard title="Payment Provider Success Rate">
          {data.providerBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400">No resolved payment attempts in this range.</p>
          ) : (
            <div className="space-y-3">
              {data.providerBreakdown.map((p) => (
                <div key={p.provider}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">{p.provider}</span>
                    <span className="text-sm text-gray-900 font-semibold">{p.succeeded}/{p.total} ({p.successRate}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${p.successRate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        <ReportCard title="Webhook Health">
          {webhookHealth ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Processed (last 24h)</dt>
                <dd className="font-semibold text-gray-900">{webhookHealth.processedLast24h}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Most Recent</dt>
                <dd className="font-semibold text-gray-900">
                  {webhookHealth.lastWebhookAt
                    ? new Date(webhookHealth.lastWebhookAt).toLocaleString('en-PH')
                    : 'None yet'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">Loading…</p>
          )}
        </ReportCard>
      </div>
    </div>
  );
};

export default CheckoutRecoverySection;
