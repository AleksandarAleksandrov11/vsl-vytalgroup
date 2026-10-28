// Pruebas de la función de Vercel api/lead-capi.js (API de conversiones de Meta), sin salir a internet:
// fetch se sustituye por un doble que registra las llamadas a graph.facebook.com.
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import handler, { sha256, buildEvent } from '../api/lead-capi.js';

const results = [];
const ok = (c, n, x = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  · ${x}` : ''}`);
const hex = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

const calls = [];
let reply = () => ({ ok: true, status: 200, text: async () => '{"events_received":1}' });
globalThis.fetch = async (url, opts) => { calls.push({ url, opts, body: JSON.parse(opts.body) }); return reply(); };

const HOST = 'vsl.vytalgroupem.com';
function req(body, { origin = `https://${HOST}`, method = 'POST', headers = {} } = {}) {
  const r = Readable.from([typeof body === 'string' ? body : JSON.stringify(body)]);
  r.method = method;
  r.headers = { host: HOST, origin, 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Instagram 330.0', 'x-forwarded-for': '83.45.12.7, 10.0.0.1', ...headers };
  return r;
}
async function call(body, opts) {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(t) { this.body = t ? JSON.parse(t) : null; } };
  await handler(req(body, opts), res);
  return res;
}
const env = (vars) => { for (const k of ['META_CAPI_TOKEN', 'META_PIXEL_ID', 'META_TEST_EVENT_CODE', 'META_GRAPH_VERSION']) delete process.env[k]; Object.assign(process.env, vars); };
const lead = { event_id: '3f6c1e2a-8b4d-4c1e-9a77-0d2b5e6f7a81', nombre: '  Lucía  Martín ', telefono: '+34 612 345 678', email: '', country: 'ES', content_name: 'Acclarix AX8 (EDAN)', content_category: 'Ecógrafo', fbc: 'fb.1.1700000000000.IwAR0abc', fbp: 'fb.1.1700000000000.987654321', event_source_url: `https://${HOST}/?utm_source=meta&utm_content=BOFU%201` };

// 1. SHA-256: vectores conocidos
ok(sha256('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' && sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' && sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq') === '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1', 'SHA-256: vectores conocidos (hex de 64 caracteres)');

// 2. Sin token o sin ID no se hace nada
env({ META_PIXEL_ID: '1593490341777612' });
let r = await call(lead);
env({ META_CAPI_TOKEN: 'EAAtoken' });
const r2 = await call(lead);
ok(r.statusCode === 202 && r.body.sent === false && r.body.reason === 'sin-token' && r2.body.reason === 'sin-token' && !calls.length, 'Sin META_CAPI_TOKEN o sin META_PIXEL_ID: no llama a Meta y responde sin error', JSON.stringify(r.body));

// 3. Con token: el evento Lead que llega a Meta
env({ META_CAPI_TOKEN: 'EAA+token/x', META_PIXEL_ID: '1593490341777612' });
const before = Math.floor(Date.now() / 1000);
r = await call(lead);
const c = calls[0];
const e = c && c.body.data[0];
const u = e ? e.user_data : {};
ok(r.statusCode === 200 && r.body.sent && calls.length === 1 && c.url === 'https://graph.facebook.com/v26.0/1593490341777612/events?access_token=EAA%2Btoken%2Fx' && c.opts.method === 'POST' && !c.body.test_event_code, 'Con token: un POST a graph.facebook.com/v26.0/1593490341777612/events con el token codificado', c && c.url.replace(/access_token=.*/, 'access_token=…'));
ok(e && e.event_name === 'Lead' && e.event_id === lead.event_id && e.action_source === 'website' && e.event_time >= before && e.event_time <= before + 5 && e.event_source_url === lead.event_source_url, 'Evento: Lead con el mismo event_id que el píxel (deduplicación), hora en segundos y URL de la página');
ok(u.ph && u.ph[0] === hex('34612345678') && u.fn[0] === hex('lucía') && u.country[0] === hex('es') && !u.em, 'user_data: teléfono (cifras con prefijo), nombre de pila y país normalizados y con SHA-256', JSON.stringify(Object.keys(u)));
ok(u.client_ip_address === '83.45.12.7' && /Instagram/.test(u.client_user_agent) && u.fbc === lead.fbc && u.fbp === lead.fbp, 'user_data: IP (primera de x-forwarded-for) y navegador de la petición, fbc y fbp tal cual', `${u.client_ip_address} · ${u.fbc}`);
ok(!JSON.stringify(c.body).includes('612345678') && !JSON.stringify(c.body).includes('Lucía') && e.custom_data.content_name === 'Acclarix AX8 (EDAN)' && e.custom_data.content_category === 'Ecógrafo', 'Ni el teléfono ni el nombre viajan en claro; custom_data con modelo y equipo', JSON.stringify(e.custom_data));
const em = buildEvent({ ...lead, telefono: '', country: '', email: ' Lucia.Martin@Example.com ' }, req(lead)).user_data;
ok(em.em && em.em[0] === hex('lucia.martin@example.com') && !em.ph && !em.country, 'Por correo: em en minúsculas y con hash, sin teléfono ni país');

// 4. Si Meta falla, el usuario no lo nota
const errs = [];
const realError = console.error;
console.error = (m) => errs.push(String(m));
reply = () => ({ ok: false, status: 400, text: async () => '{"error":{"message":"Invalid OAuth access token"}}' });
const f1 = await call({ ...lead, event_id: 'evt-fallo-0001' });
reply = () => { throw new Error('getaddrinfo ENOTFOUND graph.facebook.com'); };
const f2 = await call({ ...lead, event_id: 'evt-fallo-0002' });
console.error = realError;
ok(f1.statusCode === 202 && f2.statusCode === 202 && f1.body.reason === 'error' && errs.length === 2 && /Invalid OAuth/.test(errs[0]), 'Fallo de Meta (HTTP 400 o red): responde 202 sin error para el usuario y queda en los logs de Vercel', errs.join(' / '));
reply = () => ({ ok: true, status: 200, text: async () => '{}' });

// 5. Pruebas, origen y validación
calls.length = 0;
const p = await call({ ...lead, nombre: 'PRUEBA' });
ok(p.body.reason === 'prueba' && !calls.length, 'Envío de prueba (nombre "PRUEBA"): no llega a Meta');
env({ META_CAPI_TOKEN: 'EAAtoken', META_PIXEL_ID: '1593490341777612', META_TEST_EVENT_CODE: 'TEST12345' });
await call(lead);
ok(calls[0] && calls[0].body.test_event_code === 'TEST12345', 'META_TEST_EVENT_CODE: los eventos se marcan para "Probar eventos"');
calls.length = 0;
const o1 = await call(lead, { origin: 'https://otra-web.example' });
const o2 = await call(lead, { origin: '' });
const g = await call(lead, { method: 'GET' });
const v = await call({ ...lead, event_id: '' });
const j = await call('no es json');
ok(o1.statusCode === 403 && o2.statusCode === 403 && g.statusCode === 405 && v.statusCode === 400 && j.statusCode === 400 && !calls.length, 'Solo desde la propia web, solo POST, con event_id y JSON válido', [o1, o2, g, v, j].map((x) => x.statusCode).join(','));

console.log(results.join('\n'));
const fails = results.filter((x) => x.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} OK`);
process.exit(fails ? 1 : 0);
