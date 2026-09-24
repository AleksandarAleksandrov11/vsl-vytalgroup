// Datos del formulario: modelos por tipo de equipo, prefijos telefónicos y provincias.
// Solo contiene modelos que aparecen en el catálogo ADC Global Tech | VytalGroup 2026.

export const UNSURE = 'Aún no lo sé, quiero asesoramiento';

export const MODELS = {
  'Ecógrafo': [
    'Eco Wireless (VytaMeD)',
    'Acclarix AX8',
    'Acclarix AX3',
    'Acclarix LX9',
    'Acclarix AX2',
    'Acclarix AX9',
    'Acclarix LX3',
    'Acclarix LX25',
    'Acclarix GX9',
    'Acclarix LX85',
  ],
  'Diatermia / Tecar': [
    'Diatermia Multifunción (VytaMeD)',
    'Reatherm (I-Tech)',
    'Reacare (I-Tech)',
    'HR Tek / HR Tek SP (EME)',
  ],
  'Presoterapia': ['I-Press (I-Tech)'],
  'Otro equipo del catálogo': [
    'Physio Invasiva 2.0 (EasyTech)',
    'Superinductiva (VytaMeD)',
    'Ondas de choque (EME Shock Med / LiKAWAVE)',
    'Láser de alta potencia',
    'Camillas de fisioterapia',
  ],
};

export const PRODUCT_OF_MODEL = Object.fromEntries(
  Object.entries(MODELS).flatMap(([product, list]) => list.map((m) => [m, product]))
);

// ---------------------------------------------------------------- banderas
// Banderas simplificadas en SVG (sin emojis), lienzo 30 × 20.
const R = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const svg = (body) => `<svg class="dd__flag" viewBox="0 0 30 20" aria-hidden="true" preserveAspectRatio="none">${body}</svg>`;
const h3 = (a, b, c) => svg(R(0, 0, 30, 7, a) + R(0, 6.66, 30, 7, b) + R(0, 13.33, 30, 6.67, c));
const v3 = (a, b, c) => svg(R(0, 0, 10.2, 20, a) + R(10, 0, 10.2, 20, b) + R(20, 0, 10, 20, c));

const FLAGS = {
  ES: svg(R(0, 0, 30, 20, '#C60B1E') + R(0, 5, 30, 10, '#FFC400')),
  PT: svg(R(0, 0, 30, 20, '#DA291C') + R(0, 0, 12, 20, '#046A38') + '<circle cx="12" cy="10" r="3.6" fill="#FFE000"/>'),
  FR: v3('#002395', '#FFFFFF', '#ED2939'),
  IT: v3('#009246', '#FFFFFF', '#CE2B37'),
  DE: h3('#000000', '#DD0000', '#FFCE00'),
  LU: h3('#ED2939', '#FFFFFF', '#00A1DE'),
  BE: v3('#000000', '#FAE042', '#ED2939'),
  NL: h3('#AE1C28', '#FFFFFF', '#21468B'),
  GB: svg(R(0, 0, 30, 20, '#012169') + '<path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.6"/>' + R(12, 0, 6, 20, '#fff') + R(0, 7, 30, 6, '#fff') + R(13.2, 0, 3.6, 20, '#C8102E') + R(0, 8.2, 30, 3.6, '#C8102E')),
  US: svg(R(0, 0, 30, 20, '#FFFFFF') + [0, 2, 4, 6, 8, 10, 12].map((i) => R(0, i * 1.54, 30, 1.54, '#B22234')).join('') + R(0, 0, 13, 10.8, '#3C3B6E')),
  MX: svg(v3('#006847', '#FFFFFF', '#CE1126').replace(/^<svg[^>]*>|<\/svg>$/g, '') + '<circle cx="15" cy="10" r="2.4" fill="#8C5A2B"/>'),
  CO: svg(R(0, 0, 30, 10, '#FCD116') + R(0, 10, 30, 5, '#003893') + R(0, 15, 30, 5, '#CE1126')),
  AR: svg(h3('#74ACDF', '#FFFFFF', '#74ACDF').replace(/^<svg[^>]*>|<\/svg>$/g, '') + '<circle cx="15" cy="10" r="2" fill="#F6B40E"/>'),
  CL: svg(R(0, 0, 30, 20, '#D52B1E') + R(0, 0, 30, 10, '#FFFFFF') + R(0, 0, 10, 10, '#0039A6') + '<circle cx="5" cy="5" r="1.6" fill="#fff"/>'),
  PE: v3('#D91023', '#FFFFFF', '#D91023'),
  AD: v3('#10069F', '#FEDD00', '#D50032'),
  CH: svg(R(0, 0, 30, 20, '#DA291C') + R(13, 4, 4, 12, '#fff') + R(9, 8, 12, 4, '#fff')),
  IE: v3('#169B62', '#FFFFFF', '#FF883E'),
  AT: h3('#ED2939', '#FFFFFF', '#ED2939'),
  EC: svg(R(0, 0, 30, 10, '#FFD100') + R(0, 10, 30, 5, '#0072CE') + R(0, 15, 30, 5, '#EF3340') + '<circle cx="15" cy="10" r="2.2" fill="#6B4E16"/>'),
  UY: svg(R(0, 0, 30, 20, '#FFFFFF') + [1, 3, 5, 7].map((i) => R(0, i * 2.22, 30, 2.22, '#0038A8')).join('') + R(0, 0, 11, 11, '#FFFFFF') + '<circle cx="5.5" cy="5.5" r="2.6" fill="#FCD116"/>'),
  VE: svg(h3('#FFCC00', '#00247D', '#CF142B').replace(/^<svg[^>]*>|<\/svg>$/g, '') + '<path d="M9 11.5a6 6 0 0 1 12 0" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="1 1.2"/>'),
  BO: h3('#D52B1E', '#F9E300', '#007934'),
  PY: h3('#D52B1E', '#FFFFFF', '#0038A8'),
  CR: svg(R(0, 0, 30, 20, '#002B7F') + R(0, 3.33, 30, 13.34, '#FFFFFF') + R(0, 6.66, 30, 6.68, '#CE1126')),
  PA: svg(R(0, 0, 30, 20, '#FFFFFF') + R(15, 0, 15, 10, '#DA121A') + R(0, 10, 15, 10, '#072357') + '<circle cx="7.5" cy="5" r="1.8" fill="#072357"/><circle cx="22.5" cy="15" r="1.8" fill="#DA121A"/>'),
  XX: svg(R(0, 0, 30, 20, '#1B3350') + '<circle cx="15" cy="10" r="6" fill="none" stroke="#7FD8DA" stroke-width="1.2"/><path d="M9 10h12M15 4c2 1.8 2.8 3.8 2.8 6s-.8 4.2-2.8 6c-2-1.8-2.8-3.8-2.8-6S13 5.8 15 4z" fill="none" stroke="#7FD8DA" stroke-width="1"/>'),
};

// min/max: dígitos del número nacional (sin prefijo). trunk: se quita un 0 inicial.
// groups: agrupación visual al escribir.
export const COUNTRIES = [
  { iso: 'ES', name: 'España', dial: '34', min: 9, max: 9, groups: [3, 3, 3], lead: /^[6-9]/, ph: '612 345 678' },
  { iso: 'PT', name: 'Portugal', dial: '351', min: 9, max: 9, groups: [3, 3, 3], lead: /^[29]/, ph: '912 345 678' },
  { iso: 'FR', name: 'Francia', dial: '33', min: 9, max: 9, groups: [1, 2, 2, 2, 2], trunk: true, ph: '6 12 34 56 78' },
  { iso: 'IT', name: 'Italia', dial: '39', min: 6, max: 11, groups: [3, 3, 4], ph: '312 345 6789' },
  { iso: 'DE', name: 'Alemania', dial: '49', min: 7, max: 12, groups: [3, 4, 5], trunk: true, ph: '151 2345 6789' },
  { iso: 'LU', name: 'Luxemburgo', dial: '352', min: 6, max: 12, groups: [3, 3, 3], ph: '621 123 456' },
  { iso: 'BE', name: 'Bélgica', dial: '32', min: 8, max: 9, groups: [3, 2, 2, 2], trunk: true, ph: '470 12 34 56' },
  { iso: 'NL', name: 'Países Bajos', dial: '31', min: 9, max: 9, groups: [1, 4, 4], trunk: true, ph: '6 1234 5678' },
  { iso: 'GB', name: 'Reino Unido', dial: '44', min: 10, max: 10, groups: [4, 6], trunk: true, ph: '7400 123456' },
  { iso: 'US', name: 'Estados Unidos', dial: '1', min: 10, max: 10, groups: [3, 3, 4], ph: '201 555 0123' },
  { iso: 'MX', name: 'México', dial: '52', min: 10, max: 10, groups: [2, 4, 4], ph: '55 1234 5678' },
  { iso: 'CO', name: 'Colombia', dial: '57', min: 10, max: 10, groups: [3, 3, 4], ph: '321 123 4567' },
  { iso: 'AR', name: 'Argentina', dial: '54', min: 10, max: 11, groups: [2, 4, 4], trunk: true, ph: '11 2345 6789' },
  { iso: 'CL', name: 'Chile', dial: '56', min: 9, max: 9, groups: [1, 4, 4], ph: '9 1234 5678' },
  { iso: 'PE', name: 'Perú', dial: '51', min: 9, max: 9, groups: [3, 3, 3], ph: '912 345 678' },
  { iso: 'AD', name: 'Andorra', dial: '376', min: 6, max: 9, groups: [3, 3, 3], ph: '312 345' },
  { iso: 'CH', name: 'Suiza', dial: '41', min: 9, max: 9, groups: [2, 3, 2, 2], trunk: true, ph: '78 123 45 67' },
  { iso: 'IE', name: 'Irlanda', dial: '353', min: 9, max: 9, groups: [2, 3, 4], trunk: true, ph: '85 123 4567' },
  { iso: 'AT', name: 'Austria', dial: '43', min: 7, max: 13, groups: [3, 4, 6], trunk: true, ph: '664 123 4567' },
  { iso: 'EC', name: 'Ecuador', dial: '593', min: 8, max: 9, groups: [2, 3, 4], trunk: true, ph: '99 123 4567' },
  { iso: 'UY', name: 'Uruguay', dial: '598', min: 8, max: 8, groups: [2, 3, 3], trunk: true, ph: '94 123 456' },
  { iso: 'VE', name: 'Venezuela', dial: '58', min: 10, max: 10, groups: [3, 3, 4], trunk: true, ph: '412 123 4567' },
  { iso: 'BO', name: 'Bolivia', dial: '591', min: 8, max: 8, groups: [1, 3, 4], ph: '7 123 4567' },
  { iso: 'PY', name: 'Paraguay', dial: '595', min: 9, max: 9, groups: [3, 3, 3], trunk: true, ph: '961 123 456' },
  { iso: 'CR', name: 'Costa Rica', dial: '506', min: 8, max: 8, groups: [4, 4], ph: '8312 3456' },
  { iso: 'PA', name: 'Panamá', dial: '507', min: 7, max: 8, groups: [4, 4], ph: '6123 4567' },
  { iso: 'XX', name: 'Otro país', dial: '', min: 7, max: 15, groups: [3, 3, 3, 3, 3], ph: '+ prefijo y número' },
].map((c) => ({ ...c, flag: FLAGS[c.iso] }));

export const PROVINCES = [
  'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona',
  'Bizkaia', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ceuta', 'Ciudad Real', 'Córdoba',
  'Cuenca', 'Gipuzkoa', 'Girona', 'Granada', 'Guadalajara', 'Huelva', 'Huesca', 'Illes Balears', 'Jaén',
  'La Rioja', 'Las Palmas', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra',
  'Ourense', 'Palencia', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria',
  'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Zamora', 'Zaragoza',
];
// Nombres alternativos habituales para el buscador y el autocompletado del navegador
export const PROVINCE_ALIASES = {
  'A Coruña': 'la coruna coruna', 'Álava': 'araba', 'Alicante': 'alacant', 'Bizkaia': 'vizcaya',
  'Castellón': 'castello', 'Gipuzkoa': 'guipuzcoa', 'Girona': 'gerona', 'Illes Balears': 'baleares islas mallorca',
  'Lleida': 'lerida', 'Ourense': 'orense', 'Navarra': 'nafarroa', 'Valencia': 'valencia', 'Las Palmas': 'gran canaria canarias',
  'Santa Cruz de Tenerife': 'tenerife canarias', 'Asturias': 'oviedo', 'Cantabria': 'santander', 'La Rioja': 'logrono',
  'Murcia': 'region de murcia', 'Madrid': 'comunidad de madrid',
};
export const OUTSIDE_SPAIN = 'Fuera de España';

export const EMAIL_DOMAINS = [
  'gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'yahoo.com', 'yahoo.es',
  'icloud.com', 'live.com', 'msn.com', 'me.com', 'protonmail.com', 'telefonica.net', 'gmx.com',
];
