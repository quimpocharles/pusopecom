import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusIcon, TrashIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import productService from '../../services/productService';
import leagueService from '../../services/leagueService';

const CATEGORIES = ['jersey', 'tshirt', 'cap', 'shorts', 'accessories'];
const SPORTS = ['basketball', 'volleyball', 'football', 'general'];
const GENDERS = ['men', 'women', 'youth', 'unisex'];
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'One Size'];

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  price: '',
  salePrice: '',
  category: 'jersey',
  sport: 'basketball',
  gender: 'unisex',
  league: '',
  team: '',
  player: '',
  images: [''],
  sizes: [{ size: 'M', stock: 0 }],
  colors: [],
  useColors: false,
  featured: false,
  active: true,
};

const AdminProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(emptyForm);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingColorIdx, setUploadingColorIdx] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const colorFileInputRefs = useRef({});

  useEffect(() => {
    if (isEdit) {
      const fetchProduct = async () => {
        try {
          const res = await productService.getProductById(id);
          const p = res.data;
          const hasColorVariants = p.colors?.length > 0;
          setForm({
            name: p.name || '',
            slug: p.slug || '',
            description: p.description || '',
            price: p.price || '',
            salePrice: p.salePrice || '',
            category: p.category || 'jersey',
            sport: p.sport || 'basketball',
            gender: p.gender || 'unisex',
            league: p.league || '',
            team: p.team || '',
            player: p.player || '',
            images: p.images?.length ? p.images : [''],
            sizes: p.sizes?.length ? p.sizes.map(s => ({ size: s.size, stock: s.stock })) : [{ size: 'M', stock: 0 }],
            colors: hasColorVariants ? p.colors.map(c => ({
              color: c.color,
              hex: c.hex || '',
              image: c.image || '',
              sizes: c.sizes.map(s => ({ size: s.size, stock: s.stock })),
            })) : [],
            useColors: hasColorVariants,
            featured: p.featured || false,
            active: p.active !== false,
          });
        } catch (err) {
          console.error('Failed to load product:', err);
          setError('Failed to load product');
        } finally {
          setLoading(false);
        }
      };
      fetchProduct();
    }
  }, [id, isEdit]);

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const res = await leagueService.getLeagues();
        setLeagues(res.data);
      } catch (err) {
        console.error('Failed to load leagues:', err);
      }
    };
    fetchLeagues();
  }, []);

  const filteredLeagues = useMemo(
    () => leagues.filter((l) => l.sport === form.sport),
    [leagues, form.sport]
  );

  const selectedLeague = useMemo(
    () => filteredLeagues.find((l) => l.name === form.league),
    [filteredLeagues, form.league]
  );

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };
      if (name === 'name' && !isEdit) {
        updated.slug = generateSlug(value);
      }
      if (name === 'sport') {
        updated.league = '';
        updated.team = '';
      }
      if (name === 'league') {
        updated.team = '';
      }
      return updated;
    });
  };

  const handleImageChange = (index, value) => {
    setForm((prev) => {
      const images = [...prev.images];
      images[index] = value;
      return { ...prev, images };
    });
  };

  const addImage = () => setForm((prev) => ({ ...prev, images: [...prev.images, ''] }));
  const removeImage = (index) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleImageUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      for (const file of files) {
        const res = await productService.uploadImage(file);
        if (res.success) {
          setForm((prev) => ({
            ...prev,
            images: [...prev.images.filter(Boolean), res.data.url],
          }));
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleColorImageUpload = async (colorIdx, file) => {
    if (!file) return;
    setUploadingColorIdx(colorIdx);
    setError('');
    try {
      const res = await productService.uploadImage(file);
      if (res.success) {
        handleColorChange(colorIdx, 'image', res.data.url);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload color image');
    } finally {
      setUploadingColorIdx(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) handleImageUpload(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSizeChange = (index, field, value) => {
    setForm((prev) => {
      const sizes = [...prev.sizes];
      sizes[index] = { ...sizes[index], [field]: field === 'stock' ? Number(value) : value };
      return { ...prev, sizes };
    });
  };

  const addSize = () => setForm((prev) => ({ ...prev, sizes: [...prev.sizes, { size: 'M', stock: 0 }] }));
  const removeSize = (index) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index),
    }));
  };

  // Color variant handlers
  const addColorVariant = () => {
    setForm((prev) => ({
      ...prev,
      colors: [...prev.colors, { color: '', hex: '#000000', image: '', sizes: [{ size: 'M', stock: 0 }] }],
    }));
  };

  const removeColorVariant = (index) => {
    setForm((prev) => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }));
  };

  const handleColorChange = (index, field, value) => {
    setForm((prev) => {
      const colors = [...prev.colors];
      colors[index] = { ...colors[index], [field]: value };
      return { ...prev, colors };
    });
  };

  const handleColorSizeChange = (colorIdx, sizeIdx, field, value) => {
    setForm((prev) => {
      const colors = [...prev.colors];
      const sizes = [...colors[colorIdx].sizes];
      sizes[sizeIdx] = { ...sizes[sizeIdx], [field]: field === 'stock' ? Number(value) : value };
      colors[colorIdx] = { ...colors[colorIdx], sizes };
      return { ...prev, colors };
    });
  };

  const addColorSize = (colorIdx) => {
    setForm((prev) => {
      const colors = [...prev.colors];
      colors[colorIdx] = { ...colors[colorIdx], sizes: [...colors[colorIdx].sizes, { size: 'M', stock: 0 }] };
      return { ...prev, colors };
    });
  };

  const removeColorSize = (colorIdx, sizeIdx) => {
    setForm((prev) => {
      const colors = [...prev.colors];
      colors[colorIdx] = { ...colors[colorIdx], sizes: colors[colorIdx].sizes.filter((_, i) => i !== sizeIdx) };
      return { ...prev, colors };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        ...form,
        price: Number(form.price),
        salePrice: form.salePrice ? Number(form.salePrice) : undefined,
        images: form.images.filter(Boolean),
      };

      if (form.useColors) {
        payload.colors = form.colors.filter(c => c.color).map(c => ({
          color: c.color,
          hex: c.hex || undefined,
          image: c.image || undefined,
          sizes: c.sizes.filter(s => s.size),
        }));
        payload.sizes = [];
      } else {
        payload.sizes = form.sizes.filter((s) => s.size);
        payload.colors = [];
      }

      delete payload.useColors;
      if (!payload.salePrice) delete payload.salePrice;

      if (isEdit) {
        await productService.updateProduct(id, payload);
      } else {
        await productService.createProduct(payload);
      }

      navigate('/admin/products');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save product';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? 'Edit Product' : 'Add Product'}
      </h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input
              type="text"
              name="slug"
              value={form.slug}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
              <input
                type="number"
                name="salePrice"
                value={form.salePrice}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="Leave empty for no sale"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Classification */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Classification</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
              <select
                name="sport"
                value={form.sport}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">League</label>
              <select
                name="league"
                value={form.league}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">No league</option>
                {filteredLeagues.map((l) => (
                  <option key={l._id} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              {selectedLeague ? (
                <select
                  name="team"
                  value={form.team}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select team</option>
                  {selectedLeague.teams.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="team"
                  value={form.team}
                  onChange={handleChange}
                  placeholder="e.g. Gilas Pilipinas"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Player</label>
              <input
                type="text"
                name="player"
                value={form.player}
                onChange={handleChange}
                placeholder="e.g. Kai Sotto"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Images</h2>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleImageUpload(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ArrowUpTrayIcon className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-500">Drag & drop images here or click to browse</span>
                <span className="text-xs text-gray-400">Max 5MB per image</span>
              </div>
            )}
          </div>

          {/* Thumbnail grid */}
          {form.images.filter(Boolean).length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {form.images.map((url, i) =>
                url ? (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* URL fallback */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Or paste image URLs</span>
              <button
                type="button"
                onClick={addImage}
                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Add URL
              </button>
            </div>
            {form.images.map((url, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleImageChange(i, e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {form.images.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sizes & Stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Sizes & Stock</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useColors}
                onChange={(e) => {
                  const useColors = e.target.checked;
                  setForm((prev) => ({
                    ...prev,
                    useColors,
                    colors: useColors && prev.colors.length === 0
                      ? [{ color: '', hex: '#000000', image: '', sizes: [{ size: 'M', stock: 0 }] }]
                      : prev.colors,
                  }));
                }}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Use color variants</span>
            </label>
          </div>

          {!form.useColors ? (
            <>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addSize}
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <PlusIcon className="w-4 h-4" /> Add Size
                </button>
              </div>

              {form.sizes.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <select
                    value={s.size}
                    onChange={(e) => handleSizeChange(i, 'size', e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={s.stock}
                    onChange={(e) => handleSizeChange(i, 'stock', e.target.value)}
                    min="0"
                    placeholder="Stock"
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {form.sizes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSize(i)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addColorVariant}
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <PlusIcon className="w-4 h-4" /> Add Color
                </button>
              </div>

              {form.colors.map((colorVar, ci) => (
                <div key={ci} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={colorVar.color}
                      onChange={(e) => handleColorChange(ci, 'color', e.target.value)}
                      placeholder="Color name (e.g. Home White)"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="color"
                      value={colorVar.hex || '#000000'}
                      onChange={(e) => handleColorChange(ci, 'hex', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                      title="Pick color"
                    />
                    <button
                      type="button"
                      onClick={() => removeColorVariant(ci)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Color image upload */}
                  <div className="space-y-2">
                    {colorVar.image ? (
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
                          <img src={colorVar.image} alt={colorVar.color || 'Color'} className="w-full h-full object-cover" />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleColorChange(ci, 'image', '')}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={uploadingColorIdx === ci}
                        onClick={() => colorFileInputRefs.current[ci]?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <input
                          ref={(el) => (colorFileInputRefs.current[ci] = el)}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files[0]) handleColorImageUpload(ci, e.target.files[0]);
                            e.target.value = '';
                          }}
                        />
                        {uploadingColorIdx === ci ? (
                          <div className="w-3.5 h-3.5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                        )}
                        {uploadingColorIdx === ci ? 'Uploading...' : 'Upload image'}
                      </button>
                      <span className="text-xs text-gray-400">or</span>
                      <input
                        type="url"
                        value={colorVar.image}
                        onChange={(e) => handleColorChange(ci, 'image', e.target.value)}
                        placeholder="Paste URL"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="pl-4 border-l-2 border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 uppercase">Sizes</span>
                      <button
                        type="button"
                        onClick={() => addColorSize(ci)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        + Add Size
                      </button>
                    </div>
                    {colorVar.sizes.map((s, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <select
                          value={s.size}
                          onChange={(e) => handleColorSizeChange(ci, si, 'size', e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          {SIZE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={s.stock}
                          onChange={(e) => handleColorSizeChange(ci, si, 'stock', e.target.value)}
                          min="0"
                          placeholder="Stock"
                          className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        {colorVar.sizes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColorSize(ci, si)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Options */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Options</h2>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="featured"
                checked={form.featured}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || uploading || uploadingColorIdx !== null}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminProductForm;
