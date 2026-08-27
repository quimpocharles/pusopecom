import { describe, it, expect, vi } from 'vitest';
import * as siteSettingsRepository from '../siteSettingsRepository.js';

function makeRow(overrides = {}) {
  return {
    id: 's1',
    tryOnAdVideoUrl: '',
    tryOnAdButtonText: 'Visit Playtime.ph',
    tryOnAdButtonUrl: 'https://www.playtime.ph/',
    fitCheckDailyLimitGuest: 1,
    fitCheckDailyLimitRegistered: 5,
    fitCheckDailyLimitPremium: 10,
    fitCheckGuestRetentionHours: 24,
    fitCheckBonusEnabled: true,
    fitCheckBonusProfileComplete: 1,
    fitCheckBonusEmailVerified: 1,
    fitCheckBonusFirstPurchase: 2,
    fitCheckTrendingWindowDays: 7,
    fitCheckTrendingLimit: 8,
    orderExpirationEnabled: true,
    orderRetentionHours: 48,
    defaultPaymentGateway: 'xendit',
    updatedByUserId: null,
    updatedByUser: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Phase 1 of the ePayGames evaluation (docs/decisions/0000-decision-log.md)
// — orders.js reads payment.defaultPaymentGateway instead of hardcoding
// 'xendit'. These are unit tests against an injected fake Prisma client
// (same style as reportRecipientRepository.test.js), not the real test
// database — orders.test.js's new "gateway selection" describe block
// covers the real-DB, end-to-end path instead.
describe('siteSettingsRepository — defaultPaymentGateway', () => {
  it('get() surfaces defaultPaymentGateway nested under payment, alongside its existing siblings', async () => {
    const findFirst = vi.fn().mockResolvedValue(makeRow());
    const client = { siteSettings: { findFirst } };

    const settings = await siteSettingsRepository.get({ client });

    expect(settings.payment).toEqual({
      orderExpirationEnabled: true,
      orderRetentionHours: 48,
      defaultPaymentGateway: 'xendit',
    });
  });

  it("get() on a freshly-created row (no settings saved yet) still surfaces the schema's 'xendit' default — preserving today's hardcoded behavior exactly", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue(makeRow());
    const client = { siteSettings: { findFirst, create } };

    const settings = await siteSettingsRepository.get({ client });

    expect(create).toHaveBeenCalledWith({ data: {}, include: expect.anything() });
    expect(settings.payment.defaultPaymentGateway).toBe('xendit');
  });

  it('update() changes only defaultPaymentGateway, leaving its payment siblings untouched (partial merge, not overwrite)', async () => {
    const findFirst = vi.fn().mockResolvedValue(makeRow({ orderRetentionHours: 72, orderExpirationEnabled: false }));
    const update = vi.fn().mockResolvedValue(
      makeRow({ orderRetentionHours: 72, orderExpirationEnabled: false, defaultPaymentGateway: 'epaygames' })
    );
    const client = { siteSettings: { findFirst, update } };

    const settings = await siteSettingsRepository.update(
      { payment: { defaultPaymentGateway: 'epaygames' } },
      { client }
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defaultPaymentGateway: 'epaygames',
          orderRetentionHours: 72,
          orderExpirationEnabled: false,
        }),
      })
    );
    expect(settings.payment).toEqual({
      orderExpirationEnabled: false,
      orderRetentionHours: 72,
      defaultPaymentGateway: 'epaygames',
    });
  });
});
