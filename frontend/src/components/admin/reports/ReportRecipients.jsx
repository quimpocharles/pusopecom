import { useState, useEffect } from 'react';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import reportService from '../../../services/reportService';

// Who the Daily Business Report (5:00 AM Asia/Manila) gets emailed to.
// Deliberately flat — no role scoping, since RBAC for reports is a
// deferred, separate piece of work; every active recipient gets the same
// report.
const ReportRecipients = () => {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const fetchRecipients = () => {
    setLoading(true);
    reportService.getRecipients()
      .then((res) => setRecipients(res.data))
      .catch(() => setError('Failed to load recipients'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecipients();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError('');
    try {
      await reportService.addRecipient(email.trim());
      setEmail('');
      fetchRecipients();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add recipient');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (recipient) => {
    await reportService.setRecipientActive(recipient._id, !recipient.active);
    fetchRecipients();
  };

  const handleRemove = async (recipient) => {
    await reportService.removeRecipient(recipient._id);
    fetchRecipients();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-gray-900">Daily Business Report Recipients</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Sent every day at 5:00 AM (Philippine time). Only active recipients receive it.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <div className="w-5 h-5 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      ) : recipients.length === 0 ? (
        <p className="text-sm text-gray-400">No recipients configured yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {recipients.map((r) => (
            <li key={r._id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${r.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-900">{r.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(r)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-800"
                >
                  {r.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleRemove(r)}
                  className="text-gray-400 hover:text-red-600"
                  title="Remove"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReportRecipients;
