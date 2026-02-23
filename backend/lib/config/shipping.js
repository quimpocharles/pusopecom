// Shipping configuration
// Region codes match select-philippines-address region_code values exactly.

export const FREE_SHIPPING_THRESHOLD = 2000; // PHP
export const INTERNATIONAL_FLAT_RATE = 2100; // PHP

// ---------------------------------------------------------------------------
// Domestic flat rates keyed by PSGC region_code
// Verified against select-philippines-address package output:
//   "13" → National Capital Region (NCR)
//   "01" → Region I (Ilocos Region)
//   "02" → Region II (Cagayan Valley)
//   "03" → Region III (Central Luzon)
//   "04" → Region IV-A (CALABARZON)
//   "17" → Region IV-B (MIMAROPA)
//   "05" → Region V (Bicol Region)
//   "14" → Cordillera Administrative Region (CAR)
//   "06" → Region VI (Western Visayas)
//   "07" → Region VII (Central Visayas)
//   "08" → Region VIII (Eastern Visayas)
//   "09" → Region IX (Zamboanga Peninsula)
//   "10" → Region X (Northern Mindanao)
//   "11" → Region XI (Davao Region)
//   "12" → Region XII (SOCCSKSARGEN)
//   "15" → BARMM (formerly ARMM)
//   "16" → Region XIII (Caraga)
// ---------------------------------------------------------------------------
export const DOMESTIC_RATES = {
  // Metro Manila — ₱99
  '13': 99,

  // Luzon — ₱150
  '01': 150, // Ilocos Region
  '02': 150, // Cagayan Valley
  '03': 150, // Central Luzon
  '04': 150, // CALABARZON
  '17': 150, // MIMAROPA
  '05': 150, // Bicol Region
  '14': 150, // CAR

  // Visayas — ₱180
  '06': 180, // Western Visayas
  '07': 180, // Central Visayas
  '08': 180, // Eastern Visayas

  // Mindanao — ₱200
  '09': 200, // Zamboanga Peninsula
  '10': 200, // Northern Mindanao
  '11': 200, // Davao Region
  '12': 200, // SOCCSKSARGEN
  '15': 200, // BARMM (formerly ARMM)
  '16': 200, // Caraga
};

// ---------------------------------------------------------------------------
// International country → shipping zone map.
// All zones charge INTERNATIONAL_FLAT_RATE (₱2,100).
// Countries not listed fall through to a "contact_us" fallback.
// ---------------------------------------------------------------------------
export const COUNTRY_REGION_MAP = {
  // SEA
  Singapore:    'SEA',
  Malaysia:     'SEA',
  Thailand:     'SEA',
  Indonesia:    'SEA',
  Vietnam:      'SEA',
  Brunei:       'SEA',
  Cambodia:     'SEA',
  Laos:         'SEA',
  Myanmar:      'SEA',
  'Timor-Leste': 'SEA',

  // Middle East
  'United Arab Emirates': 'MIDDLE_EAST',
  'Saudi Arabia':         'MIDDLE_EAST',
  Qatar:                  'MIDDLE_EAST',
  Kuwait:                 'MIDDLE_EAST',
  Bahrain:                'MIDDLE_EAST',
  Oman:                   'MIDDLE_EAST',
  Jordan:                 'MIDDLE_EAST',
  Lebanon:                'MIDDLE_EAST',

  // North America
  'United States': 'NORTH_AMERICA',
  Canada:          'NORTH_AMERICA',
  Mexico:          'NORTH_AMERICA',

  // East Asia
  Japan:        'EAST_ASIA',
  'South Korea': 'EAST_ASIA',
  China:        'EAST_ASIA',
  Taiwan:       'EAST_ASIA',

  // Europe
  'United Kingdom':  'EUROPE',
  Germany:           'EUROPE',
  France:            'EUROPE',
  Italy:             'EUROPE',
  Spain:             'EUROPE',
  Netherlands:       'EUROPE',
  Belgium:           'EUROPE',
  Switzerland:       'EUROPE',
  Austria:           'EUROPE',
  Sweden:            'EUROPE',
  Norway:            'EUROPE',
  Denmark:           'EUROPE',
  Finland:           'EUROPE',
  Portugal:          'EUROPE',
  Ireland:           'EUROPE',
  Poland:            'EUROPE',
  Greece:            'EUROPE',
  'Czech Republic':  'EUROPE',
  Romania:           'EUROPE',
  Hungary:           'EUROPE',
  Slovakia:          'EUROPE',
  Slovenia:          'EUROPE',
  Croatia:           'EUROPE',
  Bulgaria:          'EUROPE',
  Estonia:           'EUROPE',
  Latvia:            'EUROPE',
  Lithuania:         'EUROPE',
  Luxembourg:        'EUROPE',
  Malta:             'EUROPE',
  Cyprus:            'EUROPE',
  Iceland:           'EUROPE',
  Monaco:            'EUROPE',
  Liechtenstein:     'EUROPE',
  'San Marino':      'EUROPE',
  'Vatican City':    'EUROPE',
};

// ---------------------------------------------------------------------------
// Shipping method enum
// ---------------------------------------------------------------------------
export const SHIPPING_METHODS = {
  DOMESTIC_FLAT_RATE: 'domestic_flat_rate',
  DOMESTIC_FREE:      'domestic_free',
  INTERNATIONAL:      'international',
  VENUE_PICKUP:       'venue_pickup',
};
