import prisma from '../lib/prisma.js';

/** Find-or-create singleton, same convention as siteSettingsRepository.get(). */
export async function get({ client = prisma } = {}) {
  let settings = await client.footerSettings.findFirst();
  if (!settings) {
    settings = await client.footerSettings.create({ data: {} });
  }
  return { _id: settings.id, companyDescription: settings.companyDescription, copyrightText: settings.copyrightText, updatedAt: settings.updatedAt };
}

export async function update(data, { client = prisma } = {}) {
  const existing = await get({ client });
  const settings = await client.footerSettings.update({ where: { id: existing._id }, data });
  return { _id: settings.id, companyDescription: settings.companyDescription, copyrightText: settings.copyrightText, updatedAt: settings.updatedAt };
}

export default { get, update };
