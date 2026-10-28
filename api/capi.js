// Función serverless de Vercel: envía eventos a Meta por la API de conversiones (servidor).
// · PageView (al cargar la página), ViewContent (una vez por sesión, al ver los equipos) y Lead (solo
//   después de que la hoja haya guardado la solicitud). Los llama el navegador con fetch y keepalive,
//   para todos los visitantes, acepten o no las cookies. Cada evento lleva el mismo event_id que el
//   del píxel cuando el píxel está cargado: Meta los deduplica.
// · IP y navegador se toman de la propia petición; fbc (cookie _fbc o construida desde el fbclid del
//   anuncio) y fbp, tal cual. En el Lead, además, teléfono, correo, nombre de pila y país con hash
//   SHA-256.
// · Variables de entorno de Vercel: META_CAPI_TOKEN (secreto) y META_PIXEL_ID (1593490341777612).
//   Opcionales: META_TEST_EVENT_CODE (para "Probar eventos") y META_GRAPH_VERSION.
// · Sin token o sin ID no hace nada. No se envían los Lead de prueba (nombre que empieza por "PRUEBA")
//   ni las visitas de robots, Lighthouse o navegadores automatizados. Si Meta falla, se registra en los
//   logs de Vercel y el usuario no nota nada.
// · No toca la hoja ni el Apps Script.
import { createHash } from 'node:crypto';

const GRAPH_VERSION = 'v26.0';
const MAX_BODY = 8 * 1024;
const EVENTS = ['PageView', 'ViewContent', 'Lead'];
// Robots, Lighthouse y navegadores automatizados (las pruebas): no son visitas
const BOT = /bot|crawl|spider|slurp|lighthouse|headless|phantom|python|curl|wget/i;

export const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Normalización de Meta: minúsculas y sin espacios; teléfono solo cifras con prefijo; nombre de pila
// sin signos; país en código ISO de 2 letras
export function userData(b, req, withPerson = true) {
  const u = {};
  if (!withPerson) b = { fbc: b.fbc, fbp: b.fbp };
  const ph = str(b.telefono, 40).replace(/\D/g, '');
  const em = str(b.email, 254).replace(/\s+/g, '').toLowerCase();
  const fn = (str(b.nombre, 80).toLowerCase().split(/\s+/)[0] || '').replace(/[^\p{L}\p{M}]/gu, '');
  const country = str(b.country, 2).toLowerCase();
  if (ph.length >= 8 && ph.length <= 15) u.ph = [sha256(ph)];
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(em)) u.em = [sha256(em)];
  if (fn) u.fn = [sha256(fn)];
  if (/^[a-z]{2}$/.test(country)) u.country = [sha256(country)];
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.headers['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || '';
  const ua = String(req.headers['user-agent'] || '').slice(0, 500);
  if (ip) u.client_ip_address = ip;
  if (ua) u.client_user_agent = ua;
  const fbc = str(b.fbc);
  const fbp = str(b.fbp);
  if (/^fb\.\d\.\d+\./.test(fbc)) u.fbc = fbc;
  if (/^fb\.\d\.\d+\./.test(fbp)) u.fbp = fbp;
  return u;
}

export function buildEvent(b, req, now = Date.now()) {
  const name = EVENTS.includes(b.event_name) ? b.event_name : 'Lead';
  const event = {
    event_name: name,
    event_time: Math.floor(now / 1000),
    event_id: str(b.event_id, 64),
    action_source: 'website',
    // Los datos personales (con hash) solo van en el Lead, que es cuando la persona los da
    user_data: userData(b, req, name === 'Lead'),
  };
  const custom = { content_name: str(b.content_name, 200), content_category: str(b.content_category, 200) };
  if (custom.content_name || custom.content_category) event.custom_data = custom;
  const url = str(b.event_source_url, 1000);
  if (/^https?:\/\//.test(url)) event.event_source_url = url;
  return event;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new Error('Petición demasiado grande');
  }
  return JSON.parse(raw || '{}');
}

const reply = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
};

// Solo desde la propia web: el Origin tiene que ser el mismo dominio que atiende la petición
function sameOrigin(req) {
  const origin = String(req.headers.origin || '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  try { return !!origin && new URL(origin).host === host; } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'Solo POST' });
  if (!sameOrigin(req)) return reply(res, 403, { ok: false, error: 'Origen no permitido' });
  const env = process.env;
  const token = String(env.META_CAPI_TOKEN || '').trim();
  const pixel = String(env.META_PIXEL_ID || '').replace(/\D/g, '');
  let b;
  try {
    b = await readBody(req);
  } catch {
    return reply(res, 400, { ok: false, error: 'Cuerpo no válido' });
  }
  if (!/^[\w-]{8,64}$/.test(str(b.event_id, 64))) return reply(res, 400, { ok: false, error: 'Falta event_id' });
  if (b.event_name !== undefined && !EVENTS.includes(b.event_name)) return reply(res, 400, { ok: false, error: 'Evento no permitido' });
  if (!token || !pixel) return reply(res, 202, { ok: true, sent: false, reason: 'sin-token' });
  if (BOT.test(String(req.headers['user-agent'] || '')) || !req.headers['user-agent']) return reply(res, 202, { ok: true, sent: false, reason: 'robot' });
  if (/^prueba\b/i.test(str(b.nombre, 80))) return reply(res, 202, { ok: true, sent: false, reason: 'prueba' });
  const body = { data: [buildEvent(b, req)] };
  const testCode = String(env.META_TEST_EVENT_CODE || '').trim();
  if (testCode) body.test_event_code = testCode;
  const version = String(env.META_GRAPH_VERSION || GRAPH_VERSION).trim();
  try {
    const r = await fetch(`https://graph.facebook.com/${version}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return reply(res, 200, { ok: true, sent: true });
  } catch (err) {
    console.error(`[capi] No se pudo enviar ${body.data[0].event_name} ${body.data[0].event_id} a Meta: ${err.message}`);
    return reply(res, 202, { ok: true, sent: false, reason: 'error' });
  }
}
