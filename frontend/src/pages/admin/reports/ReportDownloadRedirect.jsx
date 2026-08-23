import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowDownTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import reportService from '../../../services/reportService';

// Scheduled Report Email Redesign — the landing page a "Download Excel /
// CSV / PDF" link in a scheduled-report email points at. Deliberately thin:
// all it does is call the exact same authenticated
// reportService.downloadArchiveRun() the Report Archive tab's own download
// button already uses, so a click here is gated by the visitor's real admin
// session (JWT held client-side) exactly like every other admin page —
// nothing new to authorize, no signed URL, no token in the query string.
// This route sits inside the same PermissionRoute-gated /admin/reports
// subtree as the rest of Reports, so an unauthenticated or under-permissioned
// visitor is redirected before this component ever renders.
const ReportDownloadRedirect = () => {
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const format = searchParams.get('format') || 'xlsx';
  const [status, setStatus] = useState('downloading'); // 'downloading' | 'done' | 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    if (!runId) {
      setStatus('error');
      setError('This download link is missing a report reference.');
      return undefined;
    }

    reportService.downloadArchiveRun(runId, format)
      .then(() => {
        if (active) setStatus('done');
      })
      .catch(() => {
        if (active) {
          setStatus('error');
          setError('This report could not be downloaded — it may have been deleted, or the link may be out of date.');
        }
      });

    return () => { active = false; };
  }, [runId, format]);

  return (
    <div className="max-w-md mx-auto py-16 text-center">
      {status === 'downloading' && (
        <>
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Preparing your download…</p>
        </>
      )}
      {status === 'done' && (
        <>
          <ArrowDownTrayIcon className="w-10 h-10 text-primary-600 mx-auto mb-4" />
          <p className="text-gray-900 font-medium mb-1">Your download has started.</p>
          <p className="text-sm text-gray-500 mb-6">You can close this tab, or find every report in the archive below.</p>
          <Link to="/admin/reports/exports" className="btn-outline inline-block">
            Go to Report Archive
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <ExclamationTriangleIcon className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium mb-1">{error}</p>
          <p className="text-sm text-gray-500 mb-6">You can still browse every report from the archive.</p>
          <Link to="/admin/reports/exports" className="btn-outline inline-block">
            Go to Report Archive
          </Link>
        </>
      )}
    </div>
  );
};

export default ReportDownloadRedirect;
