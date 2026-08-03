import { useEffect, useState } from 'react';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Panel, ErrorState } from '../../components/ui';
import accountService from '../../services/accountService';

const FIELDS = [
  { key: 'authProvider', label: 'Sign-in Method' },
  { key: 'emailVerified', label: 'Email Verified' },
  { key: 'accountLocked', label: 'Account Locked' },
  { key: 'failedLoginAttempts', label: 'Failed Login Attempts' },
  { key: 'memberSince', label: 'Member Since' },
];

const formatValue = (key, value) => {
  if (key === 'memberSince') return new Date(value).toLocaleDateString('en-PH');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'authProvider') return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
};

// Read-only. No "active sessions" list — session revocation isn't built
// yet, so that's honestly absent from this panel rather than faked.
const AccountSecurity = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await accountService.getSecurity();
      setData(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error || !data) return <ErrorState description="Failed to load security info." onRetry={load} />;

  return (
    <Panel className="max-w-lg" padding="p-0">
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="flex justify-between items-center px-5 py-4 border-b border-gray-100 last:border-0">
          <span className="text-sm text-gray-600">{label}</span>
          <span className="text-sm font-medium text-gray-900">{formatValue(key, data[key])}</span>
        </div>
      ))}
    </Panel>
  );
};

export default AccountSecurity;
