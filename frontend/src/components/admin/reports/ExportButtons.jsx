import { useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import reportService from '../../../services/reportService';

/**
 * Dropped into each report section's heading row. Downloads whatever the
 * section is currently showing — the same dateParams driving the on-screen
 * charts get passed straight through to the export endpoint, so a filtered
 * view and its export never disagree.
 */
const ExportButtons = ({ reportKey, dateParams }) => {
  const [exporting, setExporting] = useState(null); // 'csv' | 'xlsx' | null

  const handleExport = async (format) => {
    setExporting(format);
    try {
      await reportService.exportReport(reportKey, format, dateParams);
    } catch (error) {
      console.error(`Failed to export ${reportKey} report as ${format}:`, error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => handleExport('csv')}
        disabled={exporting !== null}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
        {exporting === 'csv' ? 'Exporting…' : 'CSV'}
      </button>
      <button
        onClick={() => handleExport('xlsx')}
        disabled={exporting !== null}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
        {exporting === 'xlsx' ? 'Exporting…' : 'Excel'}
      </button>
    </div>
  );
};

export default ExportButtons;
