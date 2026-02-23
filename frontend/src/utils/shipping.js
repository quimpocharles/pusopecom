// Frontend mirror of backend/lib/config/shipping.js
// Used for display-only rate calculations in the checkout UI.
// The authoritative calculation runs server-side on order creation.

export const FREE_SHIPPING_THRESHOLD = 2000; // PHP
export const INTERNATIONAL_FLAT_RATE = 2100; // PHP

// Keyed by PSGC region_code from select-philippines-address
export const DOMESTIC_RATES = {
  '13': 99,  // NCR (Metro Manila)
  '01': 150, // Ilocos Region
  '02': 150, // Cagayan Valley
  '03': 150, // Central Luzon
  '04': 150, // CALABARZON
  '17': 150, // MIMAROPA
  '05': 150, // Bicol Region
  '14': 150, // CAR
  '06': 180, // Western Visayas
  '07': 180, // Central Visayas
  '08': 180, // Eastern Visayas
  '09': 200, // Zamboanga Peninsula
  '10': 200, // Northern Mindanao
  '11': 200, // Davao Region
  '12': 200, // SOCCSKSARGEN
  '15': 200, // BARMM (formerly ARMM)
  '16': 200, // Caraga
};

// Flat map: country name string → shipping zone.
// Countries absent from this map fall through to contact_us.
export const COUNTRY_REGION_MAP = {
  Singapore: 'SEA', Malaysia: 'SEA', Thailand: 'SEA', Indonesia: 'SEA',
  Vietnam: 'SEA', Brunei: 'SEA', Cambodia: 'SEA', Laos: 'SEA',
  Myanmar: 'SEA', 'Timor-Leste': 'SEA',
  'United Arab Emirates': 'MIDDLE_EAST', 'Saudi Arabia': 'MIDDLE_EAST',
  Qatar: 'MIDDLE_EAST', Kuwait: 'MIDDLE_EAST', Bahrain: 'MIDDLE_EAST',
  Oman: 'MIDDLE_EAST', Jordan: 'MIDDLE_EAST', Lebanon: 'MIDDLE_EAST',
  'United States': 'NORTH_AMERICA', Canada: 'NORTH_AMERICA', Mexico: 'NORTH_AMERICA',
  Japan: 'EAST_ASIA', 'South Korea': 'EAST_ASIA', China: 'EAST_ASIA', Taiwan: 'EAST_ASIA',
  'United Kingdom': 'EUROPE', Germany: 'EUROPE', France: 'EUROPE', Italy: 'EUROPE',
  Spain: 'EUROPE', Netherlands: 'EUROPE', Belgium: 'EUROPE', Switzerland: 'EUROPE',
  Austria: 'EUROPE', Sweden: 'EUROPE', Norway: 'EUROPE', Denmark: 'EUROPE',
  Finland: 'EUROPE', Portugal: 'EUROPE', Ireland: 'EUROPE', Poland: 'EUROPE',
  Greece: 'EUROPE', 'Czech Republic': 'EUROPE', Romania: 'EUROPE', Hungary: 'EUROPE',
  Slovakia: 'EUROPE', Slovenia: 'EUROPE', Croatia: 'EUROPE', Bulgaria: 'EUROPE',
  Estonia: 'EUROPE', Latvia: 'EUROPE', Lithuania: 'EUROPE', Luxembourg: 'EUROPE',
  Malta: 'EUROPE', Cyprus: 'EUROPE', Iceland: 'EUROPE', Monaco: 'EUROPE',
  Liechtenstein: 'EUROPE', 'San Marino': 'EUROPE', 'Vatican City': 'EUROPE',
};

/** @returns {{ method: string, fee: number }} */
export function getDomesticRate(regionCode, cartTotal) {
  if (cartTotal >= FREE_SHIPPING_THRESHOLD) {
    return { method: 'domestic_free', fee: 0 };
  }
  const fee = DOMESTIC_RATES[regionCode] ?? 200;
  return { method: 'domestic_flat_rate', fee };
}

/** @returns {{ method: string, fee: number|null, zone: string|null }} */
export function getInternationalRate(countryName) {
  const zone = COUNTRY_REGION_MAP[countryName] ?? null;
  if (!zone) return { method: 'contact_us', fee: null, zone: null };
  return { method: 'international', fee: INTERNATIONAL_FLAT_RATE, zone };
}
