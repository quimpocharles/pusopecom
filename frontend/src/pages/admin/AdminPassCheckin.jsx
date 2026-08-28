import { useEffect, useRef, useState, useCallback } from 'react';
import { QrCodeIcon, CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import passEventService from '../../services/passEventService';
import useCheckinSyncStore from '../../store/checkinSyncStore';
import { PH_TIME_ZONE } from '../../utils/manilaTime';

function formatRelativeTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

// Camera-based QR scanning (@zxing/browser) plus a manual-entry fallback —
// gate staff often work on a phone, not every device/browser combination
// gets a reliable camera stream. Lookup and check-in are deliberately two
// separate calls (passEventService.lookupPass then .checkinPass), not one
// combined "scan = redeem" step: staff see who/what they're admitting
// before it's irreversibly marked checked_in, closing the classic
// "second scan of the same code somehow still went through" gap a single-
// step flow risks.
//
// Offline support (300–5000 scans/event, real venue networks often worst
// during a pre-game rush): staff pick one event up front, which pre-syncs
// a read-only local snapshot of its passes (checkinSyncStore.js) for
// lookups with no signal. The check-in *write* itself always still goes
// through the real server call — a network failure queues it for retry
// rather than marking it checked-in on-device alone, since
// passRepository.transition's atomic CAS is what actually guarantees two
// gates can never both admit the same pass; nothing client-side can offer
// that guarantee on its own.
const AdminPassCheckin = () => {
  const videoRef = useRef(null);
  const stopCameraRef = useRef(null);
  const isBusyRef = useRef(false); // blocks re-entrant scans while a lookup/check-in is in flight

  const [manualToken, setManualToken] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [phase, setPhase] = useState('scanning'); // scanning | looking_up | result | confirming
  const [pass, setPass] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [queued, setQueued] = useState(false);
  const [offlineResult, setOfflineResult] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');

  const eventId = useCheckinSyncStore((s) => s.eventId);
  const eventName = useCheckinSyncStore((s) => s.eventName);
  const syncedAt = useCheckinSyncStore((s) => s.syncedAt);
  const pendingCount = useCheckinSyncStore((s) => s.pendingCheckins.length);
  const conflicts = useCheckinSyncStore((s) => s.conflicts);
  const syncing = useCheckinSyncStore((s) => s.syncing);
  const authExpired = useCheckinSyncStore((s) => s.authExpired);

  const scannerReady = !!eventId && !pickerOpen;

  // Online/offline tracking + auto-flush the queue the moment connectivity
  // returns, so a staff member doesn't have to remember to tap "Sync".
  useEffect(() => {
    const goOnline = () => { setIsOnline(true); useCheckinSyncStore.getState().flushQueue(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Load the event-picker list whenever it's actually visible — both when
  // explicitly opened via "Change" and on first load (no event picked
  // yet, so scannerReady is false without pickerOpen ever being toggled).
  useEffect(() => {
    if (scannerReady) return;
    let mounted = true;
    setPickerLoading(true);
    setPickerError('');
    passEventService.getUpcomingForCheckin()
      .then((res) => { if (mounted) setAvailableEvents(res.data); })
      .catch(() => { if (mounted) setPickerError('Failed to load events.'); })
      .finally(() => { if (mounted) setPickerLoading(false); });
    return () => { mounted = false; };
  }, [scannerReady]);

  const handlePickEvent = async (event) => {
    try {
      await useCheckinSyncStore.getState().syncEvent(event._id, event.name);
      setPickerOpen(false);
    } catch {
      // syncError is already set in the store — picker stays open so
      // staff can see it and retry.
    }
  };

  const lookup = useCallback(async (qrToken) => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setPhase('looking_up');
    setActionError('');
    setJustConfirmed(false);
    setQueued(false);
    const trimmed = qrToken.trim();
    try {
      const res = await passEventService.lookupPass(trimmed);
      setPass(res.data);
      setOfflineResult(false);
      setNotFound(false);
    } catch (err) {
      // No err.response means the request never reached the server (a
      // real network failure) — distinct from a genuine 404, which means
      // we're online and the code just isn't a real pass.
      const store = useCheckinSyncStore.getState();
      const local = !err.response && store.eventId ? store.lookupLocal(trimmed) : null;
      if (local) {
        setPass(local);
        setOfflineResult(true);
        setNotFound(false);
      } else {
        setPass(null);
        setNotFound(true);
      }
    } finally {
      setPhase('result');
      isBusyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!scannerReady) return;
    const video = videoRef.current;
    if (!video) return;
    let mounted = true;

    (async () => {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video,
          (result) => {
            if (result && mounted && phase === 'scanning') lookup(result.getText());
          }
        );
        if (mounted) stopCameraRef.current = () => controls.stop();
      } catch (err) {
        if (!mounted) return;
        setCameraError(
          /denied|NotAllowed|Permission/i.test(err?.message || '')
            ? 'Camera access was denied. Allow camera permission in your browser settings and reload.'
            : 'Could not start the camera. Manual entry still works below.'
        );
      }
    })();

    return () => { mounted = false; stopCameraRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerReady]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    lookup(manualToken);
  };

  const reset = () => {
    setPhase('scanning');
    setPass(null);
    setNotFound(false);
    setManualToken('');
    setActionError('');
    setQueued(false);
    setOfflineResult(false);
    isBusyRef.current = false;
  };

  // Only the successful-confirm (or queued) path auto-returns to scanning
  // — every other result (Not Found, Already Checked In, Cancelled/
  // Refunded, an error) needs a staff member to actually read it and
  // decide what to do next, so those still wait for a manual "Scan Next"
  // tap. At high scan volume, requiring that same manual tap after a
  // routine successful admission too was pure overhead.
  useEffect(() => {
    if (!justConfirmed && !queued) return;
    const timer = setTimeout(reset, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justConfirmed, queued]);

  const handleConfirmCheckin = async () => {
    if (!pass) return;
    setPhase('confirming');
    setActionError('');
    try {
      await passEventService.checkinPass(pass._id);
      setPass({ ...pass, status: 'checked_in', checkedInAt: new Date().toISOString() });
      setJustConfirmed(true);
    } catch (err) {
      if (!err.response) {
        // Network failure, not a real rejection — queue it. The pass is
        // treated as admitted from here (queueCheckin also marks the
        // local snapshot checked-in, so re-scanning it before syncing
        // correctly shows "already checked in," not a duplicate queue
        // entry), pending the real server confirmation.
        useCheckinSyncStore.getState().queueCheckin({ passId: pass._id, qrToken: pass.qrToken });
        setPass({ ...pass, status: 'checked_in' });
        setQueued(true);
      } else {
        setActionError(err.response?.data?.message || 'Failed to check in this pass.');
      }
    } finally {
      setPhase('result');
    }
  };

  return (
    <div>
      <div className="mb-3 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Pass Check-In</h1>
        <p className="hidden lg:block text-sm text-gray-500 mt-1">Scan a fan's Pass QR code, or enter its code manually, to admit them at the gate.</p>
      </div>

      {eventId && (
        <SyncBar
          eventName={eventName}
          syncedAt={syncedAt}
          pendingCount={pendingCount}
          conflictCount={conflicts.length}
          isOnline={isOnline}
          syncing={syncing}
          authExpired={authExpired}
          onChangeEvent={() => setPickerOpen(true)}
          onSyncNow={() => useCheckinSyncStore.getState().flushQueue()}
        />
      )}

      {!scannerReady ? (
        <EventPicker
          events={availableEvents}
          loading={pickerLoading}
          error={pickerError}
          onPick={handlePickEvent}
          onCancel={eventId ? () => setPickerOpen(false) : null}
        />
      ) : (
        /* Single column on mobile, camera above result, both compact enough
            to fit one phone screen without scrolling — most staff scanning
            passes at the gate are on a phone, and having to scroll down to
            see the result after every scan was the exact friction this
            layout removes. lg: reverts to the roomier side-by-side desktop
            layout, where screen space isn't the constraint. */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6">
          {/* Camera */}
          <div className="card overflow-hidden">
            <div className="relative h-64 sm:h-72 lg:aspect-square lg:h-auto bg-ink-900">
              <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
              {phase === 'scanning' && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-44 h-44 lg:w-56 lg:h-56 border-2 border-white/70" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
                </div>
              )}
              {phase === 'looking_up' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
                  <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  <p className="text-white text-sm font-medium">Looking up pass…</p>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                  <p className="text-white/70 text-sm">{cameraError}</p>
                </div>
              )}
            </div>

            <form onSubmit={handleManualSubmit} className="p-2 lg:p-4 flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Or enter the Pass code manually"
                disabled={phase === 'looking_up' || phase === 'confirming'}
                className="input-field text-sm font-mono flex-1"
              />
              <button type="submit" disabled={!manualToken.trim() || phase === 'looking_up'} className="btn-primary disabled:opacity-50">
                Look Up
              </button>
            </form>
          </div>

          {/* Result — background carries the outcome at a glance for gate
              staff scanning quickly: light blue for a check-in just
              confirmed or queued, red for a pass that's already been used
              (the exact case a text-color-only badge was too easy to miss
              mid-rush). */}
          <div className={
            justConfirmed || queued ? 'bg-blue-50 border-2 border-blue-200 rounded-editorial overflow-hidden p-3 lg:p-6'
            : pass?.status === 'checked_in' ? 'bg-red-50 border-2 border-red-300 rounded-editorial overflow-hidden p-3 lg:p-6'
            : 'card p-3 lg:p-6'
          }>
            {phase === 'scanning' || phase === 'looking_up' ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-4 lg:py-12">
                <QrCodeIcon className="w-8 h-8 lg:w-10 lg:h-10 mb-2 lg:mb-3" />
                <p className="text-sm">Align a Pass QR code in the frame, or type its code on the left.</p>
              </div>
            ) : notFound ? (
              <div className="text-center py-4 lg:py-8">
                <p className="text-lg font-bold text-red-600 mb-1">Not Found</p>
                <p className="text-sm text-gray-500 mb-4 lg:mb-6">
                  {!isOnline ? "No Pass matches that code in this device's offline copy." : 'No Pass matches that code.'}
                </p>
                <button onClick={reset} className="btn-primary">Scan Next</button>
              </div>
            ) : pass ? (
              <ResultCard
                pass={pass}
                justConfirmed={justConfirmed}
                queued={queued}
                offlineResult={offlineResult}
                syncedAt={syncedAt}
                actionError={actionError}
                confirming={phase === 'confirming'}
                onConfirm={handleConfirmCheckin}
                onReset={reset}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

const SyncBar = ({ eventName, syncedAt, pendingCount, conflictCount, isOnline, syncing, authExpired, onChangeEvent, onSyncNow }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-2 lg:p-3 bg-gray-50 border border-gray-200 text-xs lg:text-sm">
    <div className="flex items-center gap-2 min-w-0">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} title={isOnline ? 'Online' : 'Offline'} />
      <span className="font-semibold text-gray-900 truncate">{eventName}</span>
      {syncedAt && <span className="text-gray-400 hidden sm:inline">· synced {formatRelativeTime(syncedAt)}</span>}
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {pendingCount > 0 && <span className="text-amber-600 font-semibold">{pendingCount} pending</span>}
      {conflictCount > 0 && <span className="text-red-600 font-semibold">{conflictCount} conflict{conflictCount !== 1 ? 's' : ''}</span>}
      {authExpired && <span className="text-red-600 font-semibold">Sign in again to sync</span>}
      <button onClick={onSyncNow} disabled={syncing || !isOnline} className="btn-secondary text-xs px-2 py-1 disabled:opacity-40">
        {syncing ? 'Syncing…' : 'Sync'}
      </button>
      <button onClick={onChangeEvent} className="btn-secondary text-xs px-2 py-1">Change</button>
    </div>
  </div>
);

const EventPicker = ({ events, loading, error, onPick, onCancel }) => (
  <div className="card p-4 lg:p-6">
    <h2 className="text-lg font-bold mb-1">Choose an Event</h2>
    <p className="text-sm text-gray-500 mb-4">Pick which event you're checking passes in for — this downloads its passes for offline lookup.</p>
    {loading ? (
      <p className="text-sm text-gray-400 py-6 text-center">Loading events…</p>
    ) : error ? (
      <p className="text-sm text-red-600 py-6 text-center">{error}</p>
    ) : events.length === 0 ? (
      <p className="text-sm text-gray-400 py-6 text-center">No upcoming events on sale.</p>
    ) : (
      <div className="space-y-2">
        {events.map((e) => (
          <button
            key={e._id}
            onClick={() => onPick(e)}
            className="w-full text-left p-3 border border-gray-200 hover:border-ink-900 transition-colors"
          >
            <p className="font-semibold text-gray-900">{e.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {e.venue?.name}
              {e.startsAt && ` · ${new Date(e.startsAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: PH_TIME_ZONE })}`}
            </p>
          </button>
        ))}
      </div>
    )}
    {onCancel && (
      <button onClick={onCancel} className="btn-secondary w-full mt-4">Cancel</button>
    )}
  </div>
);

const STATUS_STYLE = {
  issued: { label: 'Ready to Admit', color: 'text-green-700' },
  checked_in: { label: 'Already Checked In', color: 'text-red-700' },
  cancelled: { label: 'Cancelled — Do Not Admit', color: 'text-red-600' },
  refunded: { label: 'Refunded — Do Not Admit', color: 'text-red-600' },
};

const ResultCard = ({ pass, justConfirmed, queued, offlineResult, syncedAt, actionError, confirming, onConfirm, onReset }) => {
  const style = STATUS_STYLE[pass.status] || { label: pass.status, color: 'text-gray-500' };
  const canCheckIn = pass.status === 'issued';
  const succeededLabel = queued ? 'Queued for Sync' : 'Checked In';

  return (
    <div>
      {offlineResult && !justConfirmed && !queued && (
        <p className="text-xs text-amber-600 font-semibold mb-2">
          Offline result — synced {syncedAt ? formatRelativeTime(syncedAt) : 'earlier'}, may not reflect other gates.
        </p>
      )}
      <p className={`text-base lg:text-lg font-bold mb-1 ${justConfirmed || queued ? 'text-blue-700' : style.color}`}>
        {justConfirmed || queued ? succeededLabel : style.label}
      </p>
      {queued && (
        <p className="text-xs text-gray-500 mb-2 lg:mb-4">Saved on this device — will confirm with the server once back online.</p>
      )}
      {pass.status === 'checked_in' && pass.checkedInAt && !justConfirmed && !queued && (
        <p className="text-xs text-gray-500 mb-2 lg:mb-4">
          Checked in {new Date(pass.checkedInAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: PH_TIME_ZONE })}
        </p>
      )}

      <div className="border-t border-gray-100 pt-2 mt-2 space-y-1.5 lg:pt-4 lg:mt-4 lg:space-y-3">
        <div>
          <p className="text-xs text-gray-500">Event</p>
          <p className="font-semibold text-gray-900">{pass.passEvent?.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tier</p>
          <p className="font-medium text-gray-900">{pass.passTier?.name}</p>
        </div>
        {pass.passEvent?.startsAt && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <CalendarDaysIcon className="w-4 h-4 flex-shrink-0" />
            {new Date(pass.passEvent.startsAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: PH_TIME_ZONE })}
          </div>
        )}
        {pass.passEvent?.venue?.name && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            {pass.passEvent.venue.name}
          </div>
        )}
        <p className="hidden lg:block text-xs font-mono text-gray-400 break-all">{pass.qrToken}</p>
      </div>

      {actionError && <p className="text-sm text-red-600 mt-2 lg:mt-4">{actionError}</p>}

      <div className="flex gap-3 mt-3 lg:mt-6">
        {canCheckIn && !justConfirmed && !queued && (
          <button onClick={onConfirm} disabled={confirming} className="btn-primary flex-1 disabled:opacity-50">
            {confirming ? 'Checking in…' : 'Confirm Check-In'}
          </button>
        )}
        <button onClick={onReset} className={canCheckIn && !justConfirmed && !queued ? 'btn-secondary' : 'btn-primary flex-1'}>
          Scan Next
        </button>
      </div>
    </div>
  );
};

export default AdminPassCheckin;
