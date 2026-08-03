import { useState } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

// Shared Cloudinary-backed image field for admin forms — a URL input plus
// an upload button that POSTs to /api/upload and fills the URL in. First
// used by AdminCampaigns.jsx; extracted here once Featured Team and
// Partner Logos needed the exact same control (the second and third real
// use case, per the project's "no abstraction before that" rule).
const ImageField = ({ label, value, onChange }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(res.data.data.url);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://res.cloudinary.com/..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-xs font-medium text-gray-700 transition-colors whitespace-nowrap">
          <PhotoIcon className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Upload'}
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
      {value && <img src={value} alt="" className="mt-2 w-24 h-auto rounded-lg border border-gray-200" />}
    </div>
  );
};

export default ImageField;
