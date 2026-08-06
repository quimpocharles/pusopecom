import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import integrationsService from '../../../services/integrationsService';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

// Read-only, by design — this page never shows a secret value and never
// writes anything. It answers exactly one question an ops person actually
// has: "is this connected or not," sourced from real environment variable
// presence, not a guess.
const IntegrationsSettings = () => {
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    integrationsService.getStatus()
      .then((res) => setIntegrations(res.data))
      .catch(() => setError('Failed to load integration status'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Integrations</h2>
      <p className="text-sm text-gray-500 mb-6">Connection status for every external service the platform depends on. Read-only — configured via environment variables, never edited here.</p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
        {integrations.map((integration) => (
          <div key={integration.name} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">{integration.name}</p>
              <p className="text-xs text-gray-500">{integration.detail}</p>
            </div>
            {integration.connected ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                <CheckCircleIcon className="w-4 h-4" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                <XCircleIcon className="w-4 h-4" />
                Not Configured
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegrationsSettings;
