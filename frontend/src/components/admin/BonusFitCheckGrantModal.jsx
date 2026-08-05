import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Modal from '../ui/Modal';
import fitCheckBonusService from '../../services/fitCheckBonusService';

const REASON_LABEL = {
  profile_complete: 'Profile completed',
  email_verified: 'Email verified',
  first_purchase: 'First purchase',
  birthday: 'Birthday',
  referral: 'Referral',
  admin_grant: 'Manual grant',
  campaign: 'Campaign',
};

// Admin action, invoked from AdminUsers.jsx — grants bonus Fit Checks to one
// user and shows their existing grant ledger, so an admin can see whether
// this user already got, say, the profile-completion bonus before deciding
// to add more. Balance/history come from GET /admin/bonus-grants/:userId;
// the ledger is the source of truth, not anything cached in this component.
const BonusFitCheckGrantModal = ({ open, onClose, user }) => {
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState([]);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fitCheckBonusService.getGrants(user._id);
      setGrants(res.data.grants);
      setBalance(res.data.balance);
    } catch (err) {
      console.error('Failed to load bonus grants:', err);
      setError('Failed to load this user\'s grant history.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      setError(null);
      setAmount(1);
      setNote('');
      load();
    }
  }, [open, load]);

  const handleGrant = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await fitCheckBonusService.grantBonus({ userId: user._id, amount: Number(amount), note: note || undefined });
      setAmount(1);
      setNote('');
      await load();
    } catch (err) {
      console.error('Failed to grant Fit Checks:', err);
      setError(err.response?.data?.message || 'Failed to grant Fit Checks');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Bonus Fit Checks — ${user.firstName} ${user.lastName}`} size="lg">
      <div className="p-4 space-y-6">
        <div className="bg-primary-50 border border-primary-100 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-600">Current bonus balance</p>
          <p className="text-2xl font-bold text-primary-700">{balance}</p>
        </div>

        <form onSubmit={handleGrant} className="space-y-3">
          <div className="flex gap-3">
            <div className="w-28">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. UAAP Season 87 opening day giveaway"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Granting...' : 'Grant Bonus Fit Checks'}
          </button>
        </form>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Grant history</h3>
          {loading ? (
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          ) : grants.length === 0 ? (
            <p className="text-sm text-gray-500">No bonus Fit Checks granted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Used</th>
                    <th className="py-2 pr-4">Note</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grants.map((g) => (
                    <tr key={g.id}>
                      <td className="py-2 pr-4">{REASON_LABEL[g.reason] || g.reason}</td>
                      <td className="py-2 pr-4">{g.amount}</td>
                      <td className="py-2 pr-4">{g.consumedCount}</td>
                      <td className="py-2 pr-4 text-gray-500">{g.note || '—'}</td>
                      <td className="py-2 text-gray-500">{new Date(g.grantedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

BonusFitCheckGrantModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.shape({
    _id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
  }),
};

export default BonusFitCheckGrantModal;
