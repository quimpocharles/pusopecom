import mongoose from 'mongoose';

const siteSettingsSchema = new mongoose.Schema({
  tryOn: {
    title: { type: String, default: 'Try on the Gilas Pilipinas shirt!' },
    image: { type: String, default: '' },
    productUrl: { type: String, default: '/products/gilas-pilipinas-t-shirt' }
  }
}, { timestamps: true });

siteSettingsSchema.statics.get = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);

export default SiteSettings;
