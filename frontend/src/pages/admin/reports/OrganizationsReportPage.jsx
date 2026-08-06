import { useState, useEffect, useMemo } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import DateRangeSelector, { getDateRange } from '../../../components/admin/reports/DateRangeSelector';
import ReportCard from '../../../components/admin/reports/ReportCard';
import HorizontalBarList from '../../../components/admin/reports/HorizontalBarList';
import ExportButtons from '../../../components/admin/reports/ExportButtons';
import reportService from '../../../services/reportService';

const formatPeso = (val) => `₱${Number(val).toLocaleString()}`;

// Queries exclusively the new Organization/Team model (Product.organizationId/
// teamId), never the legacy league/team text fields every other report
// still groups by — confirmed with the user as the deliberate choice, so
// results are correct from day one rather than propping up the flat-string
// model CLAUDE.md says never to fall back to.
const OrganizationsReportPage = () => {
  const [selectedPreset, setSelectedPreset] = useState('30d');
  const [dateRange, setDateRange] = useState(() => getDateRange('30d'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSelect = (preset, range) => {
    setSelectedPreset(preset);
    setDateRange(range);
  };

  const dateParams = useMemo(() => {
    const params = {};
    if (dateRange.startDate) params.startDate = dateRange.startDate;
    if (dateRange.endDate) params.endDate = dateRange.endDate;
    return params;
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService.getOrganizationsReport(dateParams).then((res) => {
      if (!cancelled) setData(res.data);
    }).catch((err) => {
      console.error('Organizations report error:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dateParams]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-gray-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { migration } = data;
  const migrationPct = migration.totalProductCount > 0
    ? Math.round((migration.migratedProductCount / migration.totalProductCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>
            {migration.migratedProductCount} of {migration.totalProductCount} active products ({migrationPct}%) are on the new Organization model —
            everything below reflects only that migrated slice. Sparse results are expected while migration continues, not a bug.
          </span>
        </div>
        <DateRangeSelector selected={selectedPreset} onSelect={handleSelect} />
      </div>

      <div className="flex justify-end">
        <ExportButtons reportKey="organizations" dateParams={dateParams} />
      </div>

      {/* Revenue by organization */}
      <ReportCard title="Revenue by Organization">
        {data.revenueByOrganization.length === 0 ? (
          <p className="text-sm text-gray-500">No revenue yet from organization-linked products in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="py-2 pr-4">Organization</th>
                  <th className="py-2 pr-4">Kind</th>
                  <th className="py-2 pr-4 text-right">Units</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.revenueByOrganization.map((o) => (
                  <tr key={o.organizationId}>
                    <td className="py-2 pr-4 font-medium text-gray-900">{o.name}</td>
                    <td className="py-2 pr-4 text-gray-500 capitalize">{o.kind}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{o.units}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{formatPeso(o.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard title="Top Institutions">
          <HorizontalBarList
            items={data.topInstitutions}
            labelKey="name"
            valueKey="revenue"
            formatValue={formatPeso}
            color="bg-blue-500"
          />
        </ReportCard>

        <ReportCard title="Top Leagues">
          <HorizontalBarList
            items={data.topLeagues}
            labelKey="name"
            valueKey="revenue"
            formatValue={formatPeso}
            color="bg-purple-500"
          />
          {data.topLeagues.length > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              A member institution's revenue counts toward every league it participates in — this is a ranking, not a summable total.
            </p>
          )}
        </ReportCard>
      </div>

      <ReportCard title="Top Teams">
        {data.topTeams.length === 0 ? (
          <p className="text-sm text-gray-500">No team-linked sales in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="py-2 pr-4">Team</th>
                  <th className="py-2 pr-4">Organization</th>
                  <th className="py-2 pr-4 text-right">Units</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.topTeams.map((t) => (
                  <tr key={t.teamId}>
                    <td className="py-2 pr-4 font-medium text-gray-900">{t.name}</td>
                    <td className="py-2 pr-4 text-gray-500">{t.organizationName || '—'}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{t.units}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{formatPeso(t.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard title="Most Followed">
          <HorizontalBarList
            items={data.topFollowed}
            labelKey="name"
            valueKey="followers"
            formatValue={(v) => `${v} follower${v === 1 ? '' : 's'}`}
            color="bg-pink-500"
          />
        </ReportCard>

        <ReportCard title="Fit Check Engagement">
          <HorizontalBarList
            items={data.fitCheckEngagement}
            labelKey="name"
            valueKey="attempts"
            formatValue={(v) => `${v} tries`}
            color="bg-teal-500"
          />
        </ReportCard>
      </div>
    </div>
  );
};

export default OrganizationsReportPage;
