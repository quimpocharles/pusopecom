import { useState, useEffect } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import settingsService from '../../services/settingsService';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [tryOn, setTryOn] = useState({
    title: '',
    image: '',
    productUrl: '',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await settingsService.getSettings();
        if (res.data?.tryOn) {
          setTryOn({
            title: res.data.tryOn.title || '',
            image: res.data.tryOn.image || '',
            productUrl: res.data.tryOn.productUrl || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTryOn((prev) => ({ ...prev, image: res.data.data.url }));
    } catch (error) {
      console.error('Upload failed:', error);
      setMessage({ type: 'error', text: 'Failed to upload image' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await settingsService.updateSettings({ tryOn });
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Site Settings</h1>

      <form onSubmit={handleSave} className="max-w-2xl space-y-8">
        {/* Try-On Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Homepage Try-On Section</h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={tryOn.title}
                onChange={(e) => setTryOn((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Try on the Gilas Pilipinas shirt!"
              />
            </div>

            {/* Image URL + Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image / GIF URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tryOn.image}
                  onChange={(e) => setTryOn((prev) => ({ ...prev, image: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="https://res.cloudinary.com/..."
                />
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm font-medium text-gray-700 transition-colors">
                  <PhotoIcon className="w-5 h-5" />
                  {uploading ? 'Uploading...' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              {tryOn.image && (
                <div className="mt-3">
                  <img
                    src={tryOn.image}
                    alt="Try-on preview"
                    className="w-40 h-auto rounded-lg border border-gray-200"
                  />
                </div>
              )}
            </div>

            {/* Product URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product URL</label>
              <input
                type="text"
                value={tryOn.productUrl}
                onChange={(e) => setTryOn((prev) => ({ ...prev, productUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="/products/gilas-pilipinas-t-shirt"
              />
              <p className="text-xs text-gray-500 mt-1">Path to the product page, e.g. /products/some-slug</p>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Save */}
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};

export default AdminSettings;
