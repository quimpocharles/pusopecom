import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, CameraIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

const VirtualTryOn = ({ product, isOpen, onClose }) => {
  const [userImage, setUserImage] = useState(null);
  const [userImagePreview, setUserImagePreview] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image must be less than 10MB');
        return;
      }
      setUserImage(file);
      setUserImagePreview(URL.createObjectURL(file));
      setGeneratedImage(null);
      setError('');
    }
  };

  const handleGenerate = async () => {
    if (!userImage) {
      setError('Please upload your photo first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('userImage', userImage);
      formData.append('productImageUrl', product.images[0]);
      formData.append('productName', product.name);
      if (product._id) formData.append('productId', product._id);

      const response = await api.post('/tryon', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 120000
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
    }
  };

  const handleReset = () => {
    setUserImage(null);
    setUserImagePreview(null);
    setGeneratedImage(null);
    setError('');
  };

  if (!isOpen) return null;

  const promoContent = [
    { title: "Free Shipping", description: "On orders over ₱2,000", icon: "🚚" },
    { title: "Authentic Jerseys", description: "100% official licensed", icon: "✓" },
    { title: "Easy Returns", description: "30-day hassle-free", icon: "↩️" }
  ];

  // Determine what to show in the main container
  const renderMainContent = () => {
    // Loading state
    if (loading) {
      return (
        <div className="w-full aspect-[3/4] flex flex-col rounded-xl overflow-hidden">
          {/* Upper Half: Progress */}
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 p-4">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-3">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
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
                <span className="text-xl sm:text-2xl font-bold text-gray-800">
                  {Math.round(loadingProgress)}%
                </span>
              </div>
            </div>
            <p className="text-gray-700 font-medium text-sm sm:text-base">Creating your look...</p>
          </div>

          {/* Lower Half: Promo */}
          <div className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 p-3 sm:p-4 flex flex-col justify-center">
            <p className="text-white/80 text-xs uppercase tracking-wider mb-2 text-center">
              While you wait...
            </p>
            <div className="space-y-2">
              {promoContent.map((promo, index) => (
                <div
                  key={index}
                  className="bg-white/20 backdrop-blur-sm rounded-lg p-2 sm:p-3 flex items-center gap-2 sm:gap-3"
                >
                  <span className="text-xl sm:text-2xl">{promo.icon}</span>
                  <div>
                    <p className="text-white font-semibold text-xs sm:text-sm">{promo.title}</p>
                    <p className="text-white/80 text-xs">{promo.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              onClick={handleReset}
              className="bg-white/90 p-2 rounded-full hover:bg-white transition-colors shadow-lg"
              title="Try another photo"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <p className="text-white text-sm font-medium">Try-on complete!</p>
          </div>
        </div>
      );
    }

    // User uploaded photo (ready to generate)
    if (userImagePreview) {
      return (
        <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden">
          <img
            src={userImagePreview}
            alt="Your photo"
            className="w-full h-full object-cover"
          />
          <button
            onClick={handleReset}
            className="absolute top-2 right-2 bg-white/90 p-2 rounded-full hover:bg-white transition-colors shadow-lg"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      );
    }

    // Empty state - upload prompt
    return (
      <div
        onClick={() => fileInputRef.current?.click()}
        className="w-full aspect-[3/4] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-all p-6"
      >
        <CameraIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mb-4" />
        <p className="text-gray-600 font-medium text-center mb-2">Upload Your Photo</p>
        <p className="text-sm text-gray-400 text-center">
          Front-facing photo with good lighting works best
        </p>
      </div>
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
              <h2 className="font-bold text-lg">Virtual Try-On</h2>
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

          {/* Action Button */}
          {!loading && (
            <button
              onClick={userImagePreview && !generatedImage ? handleGenerate : () => fileInputRef.current?.click()}
              disabled={loading}
              className="btn-primary w-full mt-4"
            >
              {generatedImage
                ? 'Try Another Photo'
                : userImagePreview
                  ? 'Generate Try-On'
                  : 'Upload Photo'
              }
            </button>
          )}

          {/* Tips - only show before upload */}
          {!userImagePreview && !loading && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">
                <span className="font-medium">Tip:</span> Use a clear front-facing photo for best results
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOn;
