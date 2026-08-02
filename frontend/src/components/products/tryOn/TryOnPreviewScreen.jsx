import { TRYON_PRIMARY_BTN } from './tryOnButtonStyles';

/**
 * The confirmation step — a fan should never have their photo sent off
 * immediately after taking or choosing it. Both "Retake Photo" (back to
 * the camera) and "Choose Another Photo" (back to the file picker) are
 * offered together regardless of which source produced the current
 * preview, so switching acquisition method doesn't require backing out to
 * the entry screen first. Retake is hidden when there's no camera to
 * retake with.
 */
const TryOnPreviewScreen = ({ imageUrl, onUsePhoto, onRetake, onChooseAnother, cameraAvailable }) => (
  <div>
    <div className="relative w-full aspect-[3/4] border-2 border-ink-200 overflow-hidden bg-ink-900">
      <img src={imageUrl} alt="Your photo preview" className="w-full h-full object-cover" />
    </div>
    <div className="flex flex-col gap-2 mt-4">
      <button type="button" onClick={onUsePhoto} className={`${TRYON_PRIMARY_BTN} w-full px-6 py-3`}>
        Use Photo
      </button>
      <div className="flex gap-2">
        {cameraAvailable && (
          <button
            type="button"
            onClick={onRetake}
            className="flex-1 py-2.5 border-2 border-ink-200 text-ink-700 font-semibold text-sm hover:border-ink-900 hover:text-ink-900 transition-colors"
          >
            Retake Photo
          </button>
        )}
        <button
          type="button"
          onClick={onChooseAnother}
          className="flex-1 py-2.5 border-2 border-ink-200 text-ink-700 font-semibold text-sm hover:border-ink-900 hover:text-ink-900 transition-colors"
        >
          Choose Another Photo
        </button>
      </div>
    </div>
  </div>
);

export default TryOnPreviewScreen;
