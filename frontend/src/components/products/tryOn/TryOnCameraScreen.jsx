import { XMarkIcon, CameraIcon } from '@heroicons/react/24/outline';

/**
 * Presentational only — videoRef/canvasRef come from useCameraCapture, and
 * onCapture/onCancel are expected to call that hook's capture()/stop().
 * The video is mirrored for a natural "look in a mirror" feel; the CSS
 * transform only affects what's displayed — the hook's capture() draws the
 * real (unmirrored) stream frame to canvas.
 */
const TryOnCameraScreen = ({ videoRef, canvasRef, onCapture, onCancel }) => (
  <div>
    <div className="relative w-full aspect-[3/4] border-2 border-ink-200 overflow-hidden bg-ink-900">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-2 right-2 bg-white/90 p-2 rounded-full hover:bg-white transition-colors shadow-lg"
        aria-label="Cancel camera"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
    <button type="button" onClick={onCapture} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
      <CameraIcon className="w-5 h-5" />
      Capture Photo
    </button>
  </div>
);

export default TryOnCameraScreen;
