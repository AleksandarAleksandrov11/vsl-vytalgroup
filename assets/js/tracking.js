// Meta Pixel centralizado y condicionado al consentimiento de marketing.
// · Sin META_PIXEL_ID en config.js no se carga nada.
// · El script de Meta no se descarga hasta aceptar "Marketing"; si se acepta más tarde,
//   se inicializa en ese momento; si se retira, deja de enviar eventos.
// · Eventos: PageView, ViewContent (una vez por sesión, al ver los equipos, con la categoría
//   activa), Lead (una sola vez y solo tras un envío correcto, con eventID = event_id de la
//   hoja), DescargaCatalogo (personalizado, no es un lead) y Contact (WhatsApp).

import { consentState } from './consent.js';

let allowed = false;
let loaded = false;
const pixelId = () => String((window.VG_CONFIG && window.VG_CONFIG.META_PIXEL_ID) || '').trim();

function ss(key, val) {
  try {
    if (val === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, val);
  } catch { /* almacenamiento no disponible */ }
  return null;
}

function loadPixel(id) {
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('set', 'autoConfig', false, id);
  window.fbq('init', id);
  window.fbq('track', 'PageView');
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
  const id = pixelId();
  const want = !!(c && c.marketing);
  if (!id) { allowed = false; return; }
  if (want) {
    allowed = true;
    if (!loaded) loadPixel(id);
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
}

function send(kind, name, params, eventID) {
  if (!allowed || !loaded || typeof window.fbq !== 'function') return false;
  if (eventID) window.fbq(kind, name, params || {}, { eventID });
  else window.fbq(kind, name, params || {});
  return true;
}

export const track = (name, params, eventID) => send('track', name, params, eventID);
export const trackCustom = (name, params, eventID) => send('trackCustom', name, params, eventID);

export function viewContent(category) {
  if (ss('vg_vc')) return true;
  const sent = track('ViewContent', { content_category: category, content_name: `Equipos: ${category}` });
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

export const catalogDownload = () => trackCustom('DescargaCatalogo', { content_name: 'Catálogo VytalGroup 2026' });
export const contact = (source) => track('Contact', { content_name: 'WhatsApp', content_category: source || 'web' });
