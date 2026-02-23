import {
  FREE_SHIPPING_THRESHOLD,
  INTERNATIONAL_FLAT_RATE,
  DOMESTIC_RATES,
  COUNTRY_REGION_MAP,
  SHIPPING_METHODS,
} from '../config/shipping.js';

/**
 * Returns the domestic shipping rate for a Philippine region.
 *
 * @param {string} regionCode - PSGC region_code from select-philippines-address (e.g. "13")
 * @param {number} cartTotal  - Order subtotal in PHP
 * @returns {{ method: string, fee: number }}
 */
export function getDomesticRate(regionCode, cartTotal) {
  if (cartTotal >= FREE_SHIPPING_THRESHOLD) {
    return { method: SHIPPING_METHODS.DOMESTIC_FREE, fee: 0 };
  }

  // Direct lookup — regionCode matches DOMESTIC_RATES keys exactly.
  // Fall back to Mindanao rate (₱200) for any unrecognized / island region.
  const fee = DOMESTIC_RATES[regionCode] ?? 200;

  return { method: SHIPPING_METHODS.DOMESTIC_FLAT_RATE, fee };
}

/**
 * Returns the international shipping rate for a given country.
 *
 * @param {string} countryName - Full country name matching the countries dropdown (e.g. 'United States')
 * @returns {{ method: string, fee: number|null, region: string|null }}
 */
export function getInternationalRate(countryName) {
  const zone = COUNTRY_REGION_MAP[countryName] ?? null;

  if (!zone) {
    // Country exists in dropdown but has no mapped shipping zone — show "contact us"
    return { method: 'contact_us', fee: null, region: null };
  }

  return { method: SHIPPING_METHODS.INTERNATIONAL, fee: INTERNATIONAL_FLAT_RATE, region: zone };
}

/**
 * Returns true when the given slot is still open for selection (i.e. the
 * deadline — `deadlineHours` before the slot's start time in PHT — has not yet
 * passed).
 *
 * @param {{ pickupDate: string, pickupStartTime: string, enabled: boolean }} slot
 * @param {number} [deadlineHours=6]
 * @returns {boolean}
 */
export function isSlotActive(slot, deadlineHours = 6) {
  if (!slot.enabled || !slot.pickupDate || !slot.pickupStartTime) return false;

  const [year, month, day] = slot.pickupDate.split('-').map(Number);
  const [h, m] = slot.pickupStartTime.split(':').map(Number);

  // pickupDate + pickupStartTime are in PHT (UTC+8). Subtract 8h to get UTC.
  // Date.UTC handles out-of-range hours correctly (e.g. h=0 → prev day 16:00 UTC).
  const slotStartUtcMs = Date.UTC(year, month - 1, day, h - 8, m);
  const deadlineMs = slotStartUtcMs - deadlineHours * 3_600_000;

  return Date.now() < deadlineMs;
}

/**
 * Returns the venue pickup rate (always free).
 *
 * @returns {{ method: string, fee: number }}
 */
export function getVenuePickupRate() {
  return { method: SHIPPING_METHODS.VENUE_PICKUP, fee: 0 };
}

/**
 * Main shipping calculator.
 *
 * @param {object} params
 * @param {number}  params.cartTotal - Order subtotal in PHP
 * @param {string}  params.country   - Full country name from the dropdown (e.g. 'Philippines')
 * @param {string}  [params.region]  - PSGC region_code (only used when country is 'Philippines')
 * @param {boolean} [params.isPickup] - True when the customer selected venue pickup
 * @returns {{ method: string, fee: number|null, region?: string|null }}
 */
export function calculateShipping({ cartTotal, country, region, isPickup = false }) {
  if (isPickup && country === 'Philippines') {
    return getVenuePickupRate();
  }

  if (country === 'Philippines') {
    return getDomesticRate(region, cartTotal);
  }

  return getInternationalRate(country);
}
