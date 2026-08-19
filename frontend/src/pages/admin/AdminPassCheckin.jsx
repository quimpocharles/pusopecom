import { useEffect, useRef, useState, useCallback } from 'react';
import { QrCodeIcon, CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import passEventService from '../../services/passEventService';

// Camera-based QR scanning (@zxing/browser) plus a manual-entry fallback —
// gate staff often work on a phone, not every device/browser combination
// gets a reliable camera stream. Lookup and check-in are deliberately two
// separate calls (passEventService.lookupPass then .checkinPass), not one
// combined "scan = redeem" step: staff see who/what they're admitting
// before it's irreversibly marked checked_in, closing the classic
// "second scan of the same code somehow still went through" gap a single-
// step flow risks.
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
  const [actionError, setActionError] = useState('');

  const lookup = useCallback(async (qrToken) => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setPhase('looking_up');
    setActionError('');
    setJustConfirmed(false);
    try {
      const res = await passEventService.lookupPass(qrToken.trim());
      setPass(res.data);
      setNotFound(false);
    } catch {
      setPass(null);
      setNotFound(true);
    } finally {
      setPhase('result');
      isBusyRef.current = false;
    }
  }, []);

  useEffect(() => {
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
  }, []);

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
    isBusyRef.current = false;
  };

  const handleConfirmCheckin = async () => {
    if (!pass) return;
    setPhase('confirming');
    setActionError('');
    try {
      await passEventService.checkinPass(pass._id);
      setPass({ ...pass, status: 'checked_in', checkedInAt: new Date().toISOString() });
      setJustConfirmed(true);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to check in this pass.');
    } finally {
      setPhase('result');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pass Check-In</h1>
        <p className="text-sm text-gray-500 mt-1">Scan a fan's Pass QR code, or enter its code manually, to admit them at the gate.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera */}
        <div className="card overflow-hidden">
          <div className="relative aspect-square bg-ink-900">
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
            {phase === 'scanning' && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 border-2 border-white/70" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
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

          <form onSubmit={handleManualSubmit} className="p-4 flex gap-2">
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

        {/* Result */}
        <div className="card p-6">
          {phase === 'scanning' || phase === 'looking_up' ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
              <QrCodeIcon className="w-10 h-10 mb-3" />
              <p className="text-sm">Align a Pass QR code in the frame, or type its code on the left.</p>
            </div>
          ) : notFound ? (
            <div className="text-center py-8">
              <p className="text-lg font-bold text-red-600 mb-1">Not Found</p>
              <p className="text-sm text-gray-500 mb-6">No Pass matches that code.</p>
              <button onClick={reset} className="btn-primary">Scan Next</button>
            </div>
          ) : pass ? (
            <ResultCard pass={pass} justConfirmed={justConfirmed} actionError={actionError} confirming={phase === 'confirming'} onConfirm={handleConfirmCheckin} onReset={reset} />
          ) : null}
        </div>
      </div>
    </div>
  );
};

const STATUS_STYLE = {
  issued: { label: 'Ready to Admit', color: 'text-green-700' },
  checked_in: { label: 'Already Checked In', color: 'text-amber-600' },
  cancelled: { label: 'Cancelled — Do Not Admit', color: 'text-red-600' },
  refunded: { label: 'Refunded — Do Not Admit', color: 'text-red-600' },
};

const ResultCard = ({ pass, justConfirmed, actionError, confirming, onConfirm, onReset }) => {
  const style = STATUS_STYLE[pass.status] || { label: pass.status, color: 'text-gray-500' };
  const canCheckIn = pass.status === 'issued';

  return (
    <div>
      <p className={`text-lg font-bold mb-1 ${style.color}`}>
        {justConfirmed ? 'Checked In' : style.label}
      </p>
      {pass.status === 'checked_in' && pass.checkedInAt && !justConfirmed && (
        <p className="text-xs text-gray-500 mb-4">
          Checked in {new Date(pass.checkedInAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      )}

      <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
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
            {new Date(pass.passEvent.startsAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
        {pass.passEvent?.venue?.name && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            {pass.passEvent.venue.name}
          </div>
        )}
        <p className="text-xs font-mono text-gray-400 break-all">{pass.qrToken}</p>
      </div>

      {actionError && <p className="text-sm text-red-600 mt-4">{actionError}</p>}

      <div className="flex gap-3 mt-6">
        {canCheckIn && !justConfirmed && (
          <button onClick={onConfirm} disabled={confirming} className="btn-primary flex-1 disabled:opacity-50">
            {confirming ? 'Checking in…' : 'Confirm Check-In'}
          </button>
        )}
        <button onClick={onReset} className={canCheckIn && !justConfirmed ? 'btn-secondary' : 'btn-primary flex-1'}>
          Scan Next
        </button>
      </div>
    </div>
  );
};

export default AdminPassCheckin;
