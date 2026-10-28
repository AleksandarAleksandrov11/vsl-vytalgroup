// Meta Pixel centralizado y condicionado al consentimiento de marketing.
// · Sin META_PIXEL_ID en config.js no se carga nada.
// · El script de Meta no se descarga hasta aceptar "Marketing"; si se acepta más tarde,
//   se inicializa en ese momento; si se retira, deja de enviar eventos.
// · Eventos: PageView, ViewContent (una vez por sesión, al ver los equipos, con la categoría
//   activa), Lead (una sola vez y solo tras un envío correcto, con eventID = event_id de la
//   hoja; antes se actualizan los datos de coincidencia avanzada) y Contact (WhatsApp).
// · Embudo del formulario (eventos personalizados, no se optimiza con ellos): FormStart y FormStep
//   (una vez por sesión y paso) y FormError (cada error de validación).
// · API de conversiones (función de Vercel /api/capi): PageView al cargar, ViewContent una vez por
//   sesión y Lead tras guardar, para todos los visitantes. Si el píxel está o llega a estar cargado,
//   usa el mismo event_id y Meta los deduplica. fetch con keepalive: no bloquea nada y, sin
//   META_CAPI_TOKEN en Vercel, la función no envía nada.

import { consentState } from './consent.js';
import { getAttribution } from './attribution.js';

let allowed = false;
let loaded = false;
// Admite uno o varios píxeles separados por comas (p. ej. el de la agencia y el del cliente).
// Solo cifras: si al pegar el ID se cuelan espacios o comillas, se ignoran
const pixelIds = () => String((window.VG_CONFIG && window.VG_CONFIG.META_PIXEL_ID) || '')
  .split(/[,;\s]+/).map((v) => v.replace(/\D/g, '')).filter(Boolean);

function ss(key, val) {
  try {
    if (val === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, val);
  } catch { /* almacenamiento no disponible */ }
  return null;
}

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

// Evento por servidor: fbc (cookie _fbc o construida desde el fbclid guardado al aterrizar) y fbp
export function serverEvent(name, eventId, extra = {}) {
  const a = getAttribution();
  const body = { event_name: name, event_id: eventId, event_source_url: location.href.slice(0, 1000), fbc: a.fbc || '', fbp: a.fbp || '', ...extra };
  try {
    // Se lee la respuesta (es mínima) para que el navegador dé la petición por terminada
    fetch('/api/capi', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.text()).catch(() => {});
  } catch { /* sin conexión */ }
}

// PageView de esta carga: el mismo event_id por servidor y, si se acepta, por el píxel
const pageViewId = uuid();

function loadPixel(ids) {
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  ids.forEach((id) => {
    window.fbq('set', 'autoConfig', false, id);
    window.fbq('init', id);
  });
  window.fbq('track', 'PageView', {}, { eventID: pageViewId });
  loaded = true;
}

function clearMetaCookies() {
  const host = location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  ['_fbp', '_fbc'].forEach((name) => domains.forEach((d) => {
    document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
  }));
}

function apply(c) {
  const ids = pixelIds();
  const want = !!(c && c.marketing);
  if (!ids.length) { allowed = false; return; }
  if (want) {
    allowed = true;
    if (!loaded) loadPixel(ids);
    else window.fbq('consent', 'grant');
  } else {
    allowed = false;
    if (loaded) {
      window.fbq('consent', 'revoke');
      clearMetaCookies();
    }
  }
}

export function initTracking() {
  window.addEventListener('vg:consent', (e) => apply(e.detail));
  apply(consentState());
  serverEvent('PageView', pageViewId);
}

function send(kind, name, params, eventID) {
  if (!allowed || !loaded || typeof window.fbq !== 'function') return false;
  if (eventID) window.fbq(kind, name, params || {}, { eventID });
  else window.fbq(kind, name, params || {});
  return true;
}

export const track = (name, params, eventID) => send('track', name, params, eventID);
export const trackCustom = (name, params, eventID) => send('trackCustom', name, params, eventID);

// ViewContent: una vez por sesión por servidor (con o sin cookies) y por el píxel cuando esté cargado,
// los dos con el mismo event_id. Devuelve true cuando ya no queda nada por enviar.
let vcServer = false;
export function viewContent(category) {
  const params = { content_category: category, content_name: `Equipos: ${category}` };
  let id = ss('vg_vc_id');
  if (!id) {
    id = uuid();
    ss('vg_vc_id', id);
  }
  if (!vcServer && !ss('vg_vc_srv')) {
    vcServer = true;
    ss('vg_vc_srv', '1');
    serverEvent('ViewContent', id, params);
  }
  if (ss('vg_vc')) return true;
  const sent = track('ViewContent', params, id);
  if (sent) ss('vg_vc', '1');
  return sent;
}

const leads = new Set();
export function lead(eventId, contentName, category) {
  if (!eventId || leads.has(eventId) || ss(`vg_lead_${eventId}`)) return;
  leads.add(eventId);
  ss(`vg_lead_${eventId}`, '1');
  track('Lead', { content_name: contentName, content_category: category }, eventId);
}

// Coincidencia avanzada: con los datos ya normalizados (minúsculas, solo cifras con prefijo, país ISO);
// el píxel los cifra antes de enviarlos
export function matchUser(data) {
  if (!allowed || !loaded || typeof window.fbq !== 'function') return false;
  pixelIds().forEach((id) => window.fbq('init', id, data));
  return true;
}

const once = (key, fn) => { if (!ss(key) && fn()) ss(key, '1'); };
export const formStart = () => once('vg_fs', () => trackCustom('FormStart', {}));
export const formStep = (step) => once(`vg_fstep_${step}`, () => trackCustom('FormStep', { step }));
export const formError = (step, field) => trackCustom('FormError', { step, field });

export const contact = (source) => track('Contact', { content_name: 'WhatsApp', content_category: source || 'web' });
