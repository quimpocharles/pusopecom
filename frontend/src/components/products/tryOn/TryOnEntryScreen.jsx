import { CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { TRYON_PRIMARY_BTN } from './tryOnButtonStyles';

/**
 * The two-action entry point for acquiring a photo. Camera is primary
 * whenever a camera actually exists (checked via useCameraCapture's
 * enumerateDevices probe, not just API support) — which naturally covers
 * both the "mobile always prioritizes Take Photo" and "desktop with no
 * webcam promotes Upload" requirements from one signal, since virtually
 * every mobile device has a camera and a fair number of desktops don't.
 *
 * hasCamera === null means the device check hasn't resolved yet — both
 * options render at equal weight rather than flash from one emphasis to
 * another once it does.
 */
const TryOnEntryScreen = ({ hasCamera, onTakePhoto, onUploadPhoto, notice }) => {
  const cameraPrimary = hasCamera !== false;

  return (
    <div className="text-center">
      <h3 className="text-lg font-bold text-ink-900 mb-1">Ready to wear the PUSO?</h3>
      <p className="text-sm text-ink-500 mb-6">
        Take a photo or upload one to see yourself wearing your team's official merchandise.
      </p>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onTakePhoto}
          disabled={hasCamera === false}
          className={
            cameraPrimary
              ? 'btn-primary w-full flex flex-col items-center gap-1 py-4 disabled:opacity-40 disabled:cursor-not-allowed'
              : 'w-full flex flex-col items-center gap-1 py-4 border-2 border-ink-200 text-ink-500 disabled:opacity-40 disabled:cursor-not-allowed'
          }
        >
          <CameraIcon className="w-6 h-6" />
          <span className="font-semibold">Take Photo</span>
          <span className={`text-xs font-normal ${cameraPrimary ? 'text-white/70' : 'text-ink-500'}`}>
            The fastest way to preview your jersey.
          </span>
        </button>

        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          <span className="flex-1 h-px bg-ink-200" />
          OR
          <span className="flex-1 h-px bg-ink-200" />
        </div>

        <button
          type="button"
          onClick={onUploadPhoto}
          className={
            cameraPrimary
              ? 'w-full flex flex-col items-center gap-1 py-4 border-2 border-ink-200 text-ink-900 hover:border-ink-900 transition-colors'
              : `${TRYON_PRIMARY_BTN} w-full flex-col gap-1 py-4`
          }
        >
          <PhotoIcon className="w-6 h-6" />
          <span className="font-semibold">Upload Existing Photo</span>
          <span className={`text-xs font-normal ${cameraPrimary ? 'text-ink-500' : 'text-ink-900/70'}`}>
            Use a photo already on your device.
          </span>
        </button>
      </div>

      {notice && <p className="mt-4 text-xs text-ink-500">{notice}</p>}
    </div>
  );
};

export default TryOnEntryScreen;
