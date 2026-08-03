import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import footerService from '../../services/footerService';

const SmallList = ({ title, description, items, fields, onAdd, onToggle, onDelete, addLabel }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(() => Object.fromEntries(fields.map((f) => [f.key, ''])));

  const handleAdd = async (e) => {
    e.preventDefault();
    await onAdd(form);
    setForm(Object.fromEntries(fields.map((f) => [f.key, ''])));
    setAdding(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
          <PlusIcon className="w-4 h-4" />
          {addLabel}
        </button>
      </div>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
          {fields.map((f) => (
            <input
              key={f.key}
              type="text"
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              required={f.required}
              className="flex-1 min-w-[120px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          ))}
          <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Add</button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">None yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item._id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-900 truncate">
                  {fields.map((f) => item[f.key]).filter(Boolean).join(' — ')}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => onToggle(item)} className="text-xs font-medium text-gray-500 hover:text-gray-800">
                  {item.active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => onDelete(item)} className="text-gray-400 hover:text-red-600">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const AdminFooter = () => {
  const [settings, setSettings] = useState({ companyDescription: '', copyrightText: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [links, setLinks] = useState([]);
  const [socialLinks, setSocialLinks] = useState([]);
  const [paymentIcons, setPaymentIcons] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [footerRes, linksRes, socialRes, paymentRes] = await Promise.all([
        footerService.getFooter(),
        footerService.getAllLinks(),
        footerService.getAllSocialLinks(),
        footerService.getAllPaymentIcons(),
      ]);
      setSettings({
        companyDescription: footerRes.data.settings.companyDescription || '',
        copyrightText: footerRes.data.settings.copyrightText || '',
      });
      setLinks(linksRes.data);
      setSocialLinks(socialRes.data);
      setPaymentIcons(paymentRes.data);
    } catch (err) {
      console.error('Failed to load footer content:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await footerService.updateSettings(settings);
    } catch (err) {
      console.error('Failed to save footer settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Footer</h1>
        <p className="text-sm text-gray-500 mt-1">Controls the content shown in the site's footer, on every page.</p>
      </div>

      <form onSubmit={handleSaveSettings} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Company Description &amp; Copyright</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Description</label>
          <textarea
            value={settings.companyDescription}
            onChange={(e) => setSettings({ ...settings, companyDescription: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Copyright Text</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">&copy; {new Date().getFullYear()}</span>
            <input
              type="text"
              value={settings.copyrightText}
              onChange={(e) => setSettings({ ...settings, copyrightText: e.target.value })}
              placeholder="Puso Pilipinas. All rights reserved."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">The year is added automatically — no need to include it here.</p>
        </div>
        <button type="submit" disabled={savingSettings} className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
          {savingSettings ? 'Saving...' : 'Save'}
        </button>
      </form>

      <SmallList
        title="Footer Links"
        description='Grouped by column (e.g. "Shop", "Legal").'
        items={links}
        fields={[
          { key: 'groupLabel', placeholder: 'Group (e.g. Shop)', required: true },
          { key: 'label', placeholder: 'Label', required: true },
          { key: 'destination', placeholder: 'Destination (/products)', required: true },
        ]}
        addLabel="Add Link"
        onAdd={async (form) => { await footerService.createLink({ ...form, displayOrder: links.length }); fetchAll(); }}
        onToggle={async (item) => { await footerService.updateLink(item._id, { active: !item.active }); fetchAll(); }}
        onDelete={async (item) => { await footerService.deleteLink(item._id); fetchAll(); }}
      />

      <SmallList
        title="Social Links"
        description="Platform names map to a matching icon automatically (facebook, instagram supported; others fall back to a generic icon)."
        items={socialLinks}
        fields={[
          { key: 'platform', placeholder: 'Platform (facebook)', required: true },
          { key: 'url', placeholder: 'https://...', required: true },
        ]}
        addLabel="Add Social Link"
        onAdd={async (form) => { await footerService.createSocialLink({ ...form, displayOrder: socialLinks.length }); fetchAll(); }}
        onToggle={async (item) => { await footerService.updateSocialLink(item._id, { active: !item.active }); fetchAll(); }}
        onDelete={async (item) => { await footerService.deleteSocialLink(item._id); fetchAll(); }}
      />

      <SmallList
        title="Payment Icons"
        description="Shown as a text list next to the copyright line."
        items={paymentIcons}
        fields={[{ key: 'label', placeholder: 'Label (Maya, GCash, Visa...)', required: true }]}
        addLabel="Add Payment Method"
        onAdd={async (form) => { await footerService.createPaymentIcon({ ...form, displayOrder: paymentIcons.length }); fetchAll(); }}
        onToggle={async (item) => { await footerService.updatePaymentIcon(item._id, { active: !item.active }); fetchAll(); }}
        onDelete={async (item) => { await footerService.deletePaymentIcon(item._id); fetchAll(); }}
      />
    </div>
  );
};

export default AdminFooter;
