import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PhotoIcon, FilmIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import settingsService from '../../../services/settingsService';
import api from '../../../services/api';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useSettingsDirty } from '../../../components/admin/settings/SettingsDirtyContext';
import SettingsSaveBar from '../../../components/admin/settings/SettingsSaveBar';
import PlaceholderSection from '../../../components/admin/settings/PlaceholderSection';
import Toast from '../../../components/admin/settings/Toast';
import useToast from '../../../components/admin/settings/useToast';

const DEFAULTS = {
  tryOnAd: { videoUrl: '', buttonText: '', buttonUrl: '' },
  fitCheck: {
    dailyLimitGuest: 1,
    dailyLimitRegistered: 5,
    dailyLimitPremium: 10,
    guestRetentionHours: 24,
    trendingWindowDays: 7,
    trendingLimit: 8,
  },
  fitCheckBonus: { enabled: true, profileComplete: 1, emailVerified: 1, firstPurchase: 2 },
};

const FitCheckSettings = () => {
  const { setIsDirty } = useSettingsDirty();
  const { toast, showToast, dismissToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [meta, setMeta] = useState({ updatedAt: null, updatedBy: null });

  const [saved, setSaved] = useState(DEFAULTS);
  const [draft, setDraft] = useState(DEFAULTS);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => { setIsDirty(dirty); }, [dirty, setIsDirty]);

  const load = useCallback(async () => {
    try {
      const res = await settingsService.getSettings();
      const next = {
        tryOnAd: {
          videoUrl: res.data?.tryOnAd?.videoUrl || '',
          buttonText: res.data?.tryOnAd?.buttonText || '',
          buttonUrl: res.data?.tryOnAd?.buttonUrl || '',
        },
        fitCheck: {
          dailyLimitGuest: res.data?.fitCheck?.dailyLimitGuest ?? 1,
          dailyLimitRegistered: res.data?.fitCheck?.dailyLimitRegistered ?? 5,
          dailyLimitPremium: res.data?.fitCheck?.dailyLimitPremium ?? 10,
          guestRetentionHours: res.data?.fitCheck?.guestRetentionHours ?? 24,
          trendingWindowDays: res.data?.fitCheck?.trending?.windowDays ?? 7,
          trendingLimit: res.data?.fitCheck?.trending?.limit ?? 8,
        },
        fitCheckBonus: {
          enabled: res.data?.fitCheck?.bonus?.enabled ?? true,
          profileComplete: res.data?.fitCheck?.bonus?.profileComplete ?? 1,
          emailVerified: res.data?.fitCheck?.bonus?.emailVerified ?? 1,
          firstPurchase: res.data?.fitCheck?.bonus?.firstPurchase ?? 2,
        },
      };
      setSaved(next);
      setDraft(next);
      setMeta({ updatedAt: res.data?.updatedAt, updatedBy: res.data?.updatedBy });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      showToast('error', 'Failed to load Fit Check settings');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const setField = (group, field) => (value) => setDraft((d) => ({ ...d, [group]: { ...d[group], [field]: value } }));

  const handleImageUpload = async (e) => {
    // Kept for the Sponsored Experience video's poster-less nature — no
    // longer used for the (removed) homepage teaser image, only reachable
    // path today is the loading-ad video below.
    e.target.value = '';
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('video', file);
      const res = await api.post('/upload/video', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setField('tryOnAd', 'videoUrl')(res.data.data.url);
    } catch (error) {
      console.error('Video upload failed:', error);
      showToast('error', 'Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsService.updateSettings({
        tryOnAd: draft.tryOnAd,
        fitCheck: {
          dailyLimitGuest: draft.fitCheck.dailyLimitGuest,
          dailyLimitRegistered: draft.fitCheck.dailyLimitRegistered,
          dailyLimitPremium: draft.fitCheck.dailyLimitPremium,
          guestRetentionHours: draft.fitCheck.guestRetentionHours,
          trending: { windowDays: draft.fitCheck.trendingWindowDays, limit: draft.fitCheck.trendingLimit },
          bonus: draft.fitCheckBonus,
        },
      });
      setSaved(draft);
      setMeta({ updatedAt: res.data?.updatedAt, updatedBy: res.data?.updatedBy });
      showToast('success', 'Fit Check settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => setDraft(saved);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Fit Check</h2>
      <p className="text-sm text-gray-500 mb-6">Daily limits, rewards, the sponsored loading experience, and AI generation.</p>

      <div className="space-y-8">
        {/* Experience */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Experience</h3>
          <p className="text-xs text-gray-500 mb-4">How many Fit Checks each fan tier gets per day, and how long a guest's results are kept.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Guest / day</label>
              <input type="number" min="0" value={draft.fitCheck.dailyLimitGuest}
                onChange={(e) => setField('fitCheck', 'dailyLimitGuest')(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registered / day</label>
              <input type="number" min="0" value={draft.fitCheck.dailyLimitRegistered}
                onChange={(e) => setField('fitCheck', 'dailyLimitRegistered')(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Premium / day</label>
              <input type="number" min="0" value={draft.fitCheck.dailyLimitPremium}
                onChange={(e) => setField('fitCheck', 'dailyLimitPremium')(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              <p className="text-xs text-gray-500 mt-1">Reserved for Membership — not yet assignable to any account.</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Guest retention (hours)</label>
            <input type="number" min="1" value={draft.fitCheck.guestRetentionHours}
              onChange={(e) => setField('fitCheck', 'guestRetentionHours')(Number(e.target.value))}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            <p className="text-xs text-gray-500 mt-1">How long a guest's Fit Check stays before it's dropped, unless they register first.</p>
          </div>
        </section>

        {/* Trending */}
        <section className="pt-8 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Trending</h3>
          <p className="text-xs text-gray-500 mb-4">How far back the homepage's trending module looks, and how many products it shows.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Window (days)</label>
              <input type="number" min="1" value={draft.fitCheck.trendingWindowDays}
                onChange={(e) => setField('fitCheck', 'trendingWindowDays')(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Products shown</label>
              <input type="number" min="1" value={draft.fitCheck.trendingLimit}
                onChange={(e) => setField('fitCheck', 'trendingLimit')(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
          </div>
        </section>

        {/* Rewards */}
        <section className="pt-8 border-t border-gray-100">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h3 className="text-sm font-semibold text-gray-900">Rewards</h3>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={draft.fitCheckBonus.enabled}
                onChange={(e) => setField('fitCheckBonus', 'enabled')(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-gray-700">Enabled</span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-4">One-time bonus Fit Checks a fan earns for real milestones — added on top of their daily allowance, carried over until used.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Completing their profile</label>
              <input type="number" min="0" disabled={!draft.fitCheckBonus.enabled} value={draft.fitCheckBonus.profileComplete}
                onChange={(e) => setField('fitCheckBonus', 'profileComplete')(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verifying their email</label>
              <input type="number" min="0" disabled={!draft.fitCheckBonus.enabled} value={draft.fitCheckBonus.emailVerified}
                onChange={(e) => setField('fitCheckBonus', 'emailVerified')(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First purchase</label>
              <input type="number" min="0" disabled={!draft.fitCheckBonus.enabled} value={draft.fitCheckBonus.firstPurchase}
                onChange={(e) => setField('fitCheckBonus', 'firstPurchase')(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">To grant a one-off bonus to a specific fan, use "Grant Fit Checks" on their row in Users.</p>
        </section>

        {/* Sponsored Experience */}
        <section className="pt-8 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Sponsored Experience</h3>
          <p className="text-xs text-gray-500 mb-4">Shown in the lower half of the Fit Check modal while it's generating.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loading Video URL</label>
              <div className="flex gap-2">
                <input type="text" value={draft.tryOnAd.videoUrl}
                  onChange={(e) => setField('tryOnAd', 'videoUrl')(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="https://res.cloudinary.com/.../video.mp4" />
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm font-medium text-gray-700 transition-colors whitespace-nowrap">
                  <FilmIcon className="w-5 h-5" />
                  {uploadingVideo ? 'Uploading...' : 'Upload'}
                  <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" disabled={uploadingVideo} />
                </label>
              </div>
              {draft.tryOnAd.videoUrl && (
                <video src={draft.tryOnAd.videoUrl} className="mt-3 w-48 rounded-lg border border-gray-200" controls muted />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CTA Text</label>
                <input type="text" value={draft.tryOnAd.buttonText}
                  onChange={(e) => setField('tryOnAd', 'buttonText')(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Visit Playtime.ph" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination URL</label>
                <input type="text" value={draft.tryOnAd.buttonUrl}
                  onChange={(e) => setField('tryOnAd', 'buttonUrl')(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="https://www.playtime.ph/" />
              </div>
            </div>
          </div>
          <Link
            to="/admin/fit-check-campaigns"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            Sponsored Products (unlimited Fit Checks per campaign)
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </Link>
        </section>

        {/* AI Generation */}
        <section className="pt-8 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">AI Generation</h3>
          <PlaceholderSection
            title="Provider, timeout, queue, prompt & quality preset"
            description="Not yet configurable — the AI provider and generation parameters are currently fixed in code."
          />
        </section>
      </div>

      <SettingsSaveBar dirty={dirty} saving={saving} onSave={handleSave} onCancel={handleCancel} updatedAt={meta.updatedAt} updatedBy={meta.updatedBy} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default FitCheckSettings;
