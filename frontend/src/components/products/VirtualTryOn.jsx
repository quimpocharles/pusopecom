import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, ArrowDownTrayIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import useCartStore from '../../store/cartStore';
import settingsService from '../../services/settingsService';
import useAuthStore from '../../store/authStore';
import { getSessionId } from '../../services/activityService';
import FitCheckQuotaBar from '../portal/FitCheckQuotaBar';
import fitCheckCampaignService from '../../services/fitCheckCampaignService';
import { useCameraCapture } from '../../hooks/useCameraCapture';
import { optimizeImage } from '../../utils/imageOptimization';
import { validateImage } from '../../utils/imageValidation';
import TryOnEntryScreen from './tryOn/TryOnEntryScreen';
import TryOnCameraScreen from './tryOn/TryOnCameraScreen';
import TryOnPreviewScreen from './tryOn/TryOnPreviewScreen';
import TryOnPreparingScreen from './tryOn/TryOnPreparingScreen';

/**
 * Orchestrates the image-acquisition flow (entry → camera/upload → preview
 * → prepare) and then hands off into the existing AI-generation flow
 * (loading → result), which is untouched below — same states
 * (`loading`/`generatedImage`), same endpoint, same error handling, same
 * loading UI. Acquisition concerns are split into their own modules
 * (useCameraCapture, imageOptimization, imageValidation, and the
 * tryOn/TryOn*Screen presentational components) rather than living here.
 */
const VirtualTryOn = ({ product, isOpen, onClose }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Unchanged from before this pass — the actual AI generation pipeline's
  // own state and flow.
  const [userImage, setUserImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const [ad, setAd] = useState({ videoUrl: '', buttonText: 'Visit Playtime.ph', buttonUrl: 'https://www.playtime.ph/' });
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0);
  const [sponsorship, setSponsorship] = useState(null);

  // Acquisition flow state — everything before an image is handed to
  // handleGenerate().
  const [phase, setPhase] = useState('entry'); // 'entry' | 'camera' | 'preview' | 'preparing'
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [preparingStage, setPreparingStage] = useState('preparing');

  const fileInputRef = useRef(null);
  const camera = useCameraCapture();

  useEffect(() => {
    if (!isOpen) return;
    settingsService.getSettings().then((res) => {
      if (res.data?.tryOnAd) setAd(res.data.tryOnAd);
    }).catch(() => {});
  }, [isOpen]);

  // Sponsored Fit Checks (Phase 3) — when an active campaign covers this
  // product, the daily allowance doesn't apply, so its display is replaced
  // rather than shown alongside a number that would be misleading here.
  useEffect(() => {
    if (!isOpen || !product?._id) {
      setSponsorship(null);
      return;
    }
    fitCheckCampaignService.getActiveForProduct(product._id)
      .then((res) => {
        setSponsorship(res.data);
        // Views (Phase 4) — counted once per badge render, matching how
        // "impression" is defined everywhere else this same read is used.
        if (res.data) fitCheckCampaignService.recordView(res.data._id);
      })
      .catch(() => setSponsorship(null));
  }, [isOpen, product?._id]);

  // Reset the acquisition flow (and release the camera) every time the
  // modal closes — it doesn't unmount between opens (isOpen just gates
  // what renders), so state would otherwise leak into the next open.
  useEffect(() => {
    if (!isOpen) {
      camera.stop();
      setPhase('entry');
      setPreviewUrl(null);
      setPreviewBlob(null);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Show blurred preview after 30s to signal "almost done"
  useEffect(() => {
    if (!loading) {
      setShowPreview(false);
      return;
    }
    const timer = setTimeout(() => setShowPreview(true), 30000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Simulate progress during loading
  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev < 30) return prev + 3;
          if (prev < 60) return prev + 2;
          if (prev < 85) return prev + 1;
          if (prev < 95) return prev + 0.5;
          return prev;
        });
      }, 500);
    } else {
      setLoadingProgress(100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // ── Acquisition handlers ──────────────────────────────────────────

  const handleTakePhoto = async () => {
    setError('');
    const opened = await camera.open();
    if (opened) {
      setPhase('camera');
    } else {
      // camera.error is set by the hook; surfaced via the shared error
      // banner below, with Upload Existing Photo still right there on the
      // entry screen — guides the user onward without interrupting anything.
      setError(camera.error || 'Camera unavailable. You can upload a photo instead.');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError("We couldn't read this file. Please choose a photo.");
      return;
    }
    setError('');
    setPreviewBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase('preview');
  };

  const handleCameraCapture = async () => {
    const blob = await camera.capture();
    camera.stop();
    if (!blob) {
      setError('Could not capture a photo. Please try again.');
      setPhase('entry');
      return;
    }
    setPreviewBlob(blob);
    setPreviewUrl(URL.createObjectURL(blob));
    setPhase('preview');
  };

  const handleCancelCamera = () => {
    camera.stop();
    setPhase('entry');
  };

  const handleRetake = async () => {
    setError('');
    const opened = await camera.open();
    setPhase(opened ? 'camera' : 'entry');
    if (!opened) setError(camera.error || 'Camera unavailable. You can upload a photo instead.');
  };

  const handleUsePhoto = async () => {
    setError('');
    setPhase('preparing');
    setPreparingStage('preparing');

    let finalBlob = previewBlob;
    try {
      setPreparingStage('optimizing');
      const { blob, canvas } = await optimizeImage(previewBlob);
      finalBlob = blob;

      setPreparingStage('validating');
      const validation = await validateImage(canvas);
      if (!validation.valid) {
        setError(validation.message);
        setPhase('preview');
        return;
      }
    } catch (err) {
      // Optimization failing is never fatal — fall back to the original
      // capture/upload rather than blocking the fan from trying it on.
      console.error('Image optimization failed, using original photo:', err);
    }

    setPreparingStage('starting');
    setUserImage(finalBlob);
    await handleGenerate(finalBlob);
  };

  // ── AI generation — unchanged pipeline below this point ─────────────

  const handleGenerate = async (imageOverride) => {
    const imageToSend = imageOverride ?? userImage;
    if (!imageToSend) {
      setError('Please add a photo first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('userImage', imageToSend);
      formData.append('productImageUrl', product.images[0]);
      formData.append('productName', product.name);
      if (product._id) formData.append('productId', product._id);
      // Guest identity for Fit Check's daily quota — ignored server-side
      // for a logged-in request, but required to key a guest's own
      // allowance rather than every guest sharing one global bucket.
      if (!isAuthenticated) formData.append('sessionId', getSessionId());

      const response = await api.post('/tryon', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 75000
      });

      if (response.data.success) {
        setGeneratedImage(response.data.image);
      } else {
        setError(response.data.message || 'Failed to generate image');
      }
    } catch (err) {
      console.error('Try-on error:', err);
      setError(
        err.response?.data?.message ||
        'Failed to generate try-on image. Please try again.'
      );
    } finally {
      setLoading(false);
      // Refetch — every real attempt consumes today's allowance whether it
      // succeeds or fails, so the count shown needs to move either way.
      setQuotaRefreshKey((k) => k + 1);
    }
  };

  if (!isOpen) return null;

  // Determine what to show in the main container
  const renderMainContent = () => {
    // Loading state
    if (loading) {
      return (
        <div className="w-full aspect-[3/4] flex flex-col rounded-xl overflow-hidden">
          {/* Upper Half: Progress or blurred preview */}
          {showPreview ? (
            <div className="flex-none relative flex items-center justify-center h-36 overflow-hidden">
              <img
                src={product.images[0]}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: 'blur(12px)', transform: 'scale(1.1)' }}
              />
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative flex flex-col items-center gap-1.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-white animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-white font-semibold text-sm drop-shadow">Almost ready...</p>
              </div>
            </div>
          ) : (
          <div className="flex-none flex flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 p-4 h-36">
            <div className="relative w-20 h-20 mb-2">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="50%" cy="50%" r="45%" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  stroke="url(#progressGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 * (1 - loadingProgress / 100)}
                  className="transition-all duration-500"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-800">{Math.round(loadingProgress)}%</span>
              </div>
            </div>
            <p className="text-gray-700 font-medium text-sm">Creating your look...</p>
          </div>
          )}

          {/* Lower Half: Ad video with overlaid CTA */}
          {ad.videoUrl && (
            <div className="flex-1 relative overflow-hidden">
              <video
                autoPlay
                loop
                muted
                playsInline
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: '100%',
                  width: 'auto',
                  maxWidth: 'none',
                }}
              >
                <source src={ad.videoUrl} type="video/mp4" />
              </video>
              {ad.buttonText && ad.buttonUrl && (
                <div className="absolute inset-x-0 bottom-4 flex justify-center">
                  <a
                    href={ad.buttonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white/90 hover:bg-white text-gray-900 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg backdrop-blur-sm"
                  >
                    {ad.buttonText}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Generated image (result)
    if (generatedImage) {
      return (
        <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden">
          <img
            src={generatedImage}
            alt="Virtual try-on result"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2">
            <a
              href={generatedImage}
              download={`tryon-${product.name.replace(/\s+/g, '-').toLowerCase()}.png`}
              className="flex items-center gap-1.5 bg-white/90 hover:bg-white px-3 py-2 rounded-full shadow-lg text-xs font-semibold text-gray-800 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Save
            </a>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <p className="text-white text-sm font-medium">Try-on complete!</p>
            <p className="text-white/70 text-xs mt-1">This is an AI-generated preview and may not reflect the actual fit.</p>
          </div>
        </div>
      );
    }

    // ── Acquisition phases ──────────────────────────────────────────
    if (phase === 'preparing') {
      return <TryOnPreparingScreen stage={preparingStage} />;
    }

    if (phase === 'camera') {
      return (
        <TryOnCameraScreen
          videoRef={camera.videoRef}
          canvasRef={camera.canvasRef}
          onCapture={handleCameraCapture}
          onCancel={handleCancelCamera}
        />
      );
    }

    if (phase === 'preview') {
      return (
        <TryOnPreviewScreen
          imageUrl={previewUrl}
          onUsePhoto={handleUsePhoto}
          onRetake={handleRetake}
          onChooseAnother={handleUploadClick}
          cameraAvailable={camera.hasCamera !== false}
        />
      );
    }

    return (
      <TryOnEntryScreen
        hasCamera={camera.hasCamera}
        onTakePhoto={handleTakePhoto}
        onUploadPhoto={handleUploadClick}
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center gap-3">
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-12 h-12 object-cover rounded-lg"
            />
            <div>
              <h2 className="font-bold text-lg">Fit Check</h2>
              <p className="text-gray-500 text-sm truncate max-w-[180px]">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {sponsorship ? (
          <div className="py-3 border-b text-center">
            <p className="text-sm font-semibold text-primary-700">
              Unlimited Fit Checks — Sponsored by {sponsorship.sponsorName}
            </p>
          </div>
        ) : (
          <FitCheckQuotaBar refreshKey={quotaRefreshKey} className="py-3 border-b" />
        )}

        {/* Main Content */}
        <div className="p-4">
          {renderMainContent()}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Error Message */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Action Button — only the post-generation states need one here;
              every acquisition-phase screen (entry/camera/preview) owns
              its own action buttons. */}
          {!loading && generatedImage && (
            <button
              onClick={() => {
                onClose();
                useCartStore.getState().openQuickAdd(product);
              }}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              <ShoppingCartIcon className="w-5 h-5" />
              Add to Cart
            </button>
          )}

          {/* Tips - only show on the entry screen */}
          {phase === 'entry' && !loading && !generatedImage && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">
                <span className="font-medium">Tip:</span> Use a clear front-facing photo for best results
              </p>
            </div>
          )}

          {/* Disclaimer — hidden during loading to give more space to the ad */}
          {!loading && <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 leading-relaxed">
              <span className="font-semibold">Disclaimer:</span> This is an AI-generated preview for visualization purposes only. Results may not accurately represent the actual product appearance, fit, or color. Sizing cannot be determined from this try-on. Please refer to our size chart for accurate measurements.
            </p>
          </div>}
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOn;
