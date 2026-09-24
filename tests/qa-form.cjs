// QA del formulario, el consentimiento y el píxel contra dist/ y el Apps Script simulado (puerto 8090).
// El script de Meta se sustituye por un doble que registra las llamadas a fbq (no sale a internet).
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 8081}`;
const MOCK = 'http://localhost:8090';
const LOG = process.argv[2];
const results = [];
const ok = (cond, name, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  · ${extra}` : ''}`);
const readLog = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const posts = () => readLog().filter((r) => r.method === 'POST');
const PIXEL_STUB = `(function(){var c=window.__fb=window.__fb||[];var f=window.fbq;function cm(){c.push(Array.prototype.slice.call(arguments).map(function(x){return JSON.parse(JSON.stringify(x))}))}f.callMethod=cm;(f.queue||[]).forEach(function(a){cm.apply(null,a)});f.queue=[];document.cookie='_fbp=fb.1.1700000000000.987654321; path=/';})();`;
const UTM = '?utm_source=facebook&utm_campaign=test&fbclid=abc123';

async function open(b, { width = 1280, height = 900, mobile = false, endpoint = `${MOCK}/exec`, pixel = '1234567890', consent = null, query = '', slow = false }) {
  // En móvil se simula el navegador interno de Instagram en un iPhone
  const userAgent = mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0' : undefined;
  const ctx = await b.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, acceptDownloads: true, userAgent });
  await ctx.addInitScript(({ consent, slow }) => {
    try { if (consent !== null) localStorage.setItem('vg_consent', JSON.stringify({ v: 2, date: new Date().toISOString(), necessary: true, marketing: consent })); } catch (e) { /* */ }
    // Simula un bot que envía en menos de 3 s
    if (slow) { const real = performance.now.bind(performance); performance.now = () => Math.min(real(), 1000); }
  }, { consent, slow });
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.VG_CONFIG={SHEETS_ENDPOINT:${JSON.stringify(endpoint)},META_PIXEL_ID:${JSON.stringify(pixel)}};` }));
  const fbReq = [];
  await ctx.route(/facebook\.(net|com)/, (r) => { fbReq.push(r.request().url()); r.fulfill({ contentType: 'text/javascript', body: PIXEL_STUB }); });
  await ctx.route(/wa\.me/, (r) => r.fulfill({ contentType: 'text/html', body: '<p>wa</p>' }));
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await p.goto(BASE + '/' + query, { waitUntil: 'networkidle' });
  return { ctx, p, fbReq, logs };
}
const fb = (p) => p.evaluate(() => window.__fb || []);
const step = (p) => p.evaluate(() => document.querySelector('#qf .qf__step.is-active')?.dataset.step || null);
const toForm = async (p) => { await p.evaluate(() => document.querySelector('#asesoramiento').scrollIntoView()); await p.waitForTimeout(700); };

async function fillToEnd(p, { mobile, name = 'Laura Gómez', tel = '612345678', email = 'laura@gmail.com' } = {}) {
  const tap = (sel) => (mobile ? p.tap(sel) : p.click(sel));
  if ((await step(p)) === '1') {
    if (await p.isVisible('[data-picked-box]')) await p.click('.qf__step.is-active [data-next]');
    else await tap('.qf__step.is-active label.opt:has(input[value="Ecógrafo"])');
    await p.waitForTimeout(700);
  }
  await tap('.qf__step.is-active label.opt:has(input[value="Fisioterapeuta"])');
  await p.waitForTimeout(800);
  await tap('.qf__step.is-active label.opt:has(input[value="Lo antes posible"])');
  await p.waitForTimeout(800);
  await p.fill('#f-name', name);
  await p.press('#f-name', 'Enter');
  await p.waitForTimeout(600);
  await p.fill('#f-tel', tel);
  await p.press('#f-tel', 'Enter');
  await p.waitForTimeout(600);
  await p.fill('#f-email', email);
  await p.check('input[name="consent"]');
}

async function block(name, fn) {
  try { await fn(); } catch (err) { ok(false, `${name}: error en la prueba`, String(err.message).split('\n')[0]); }
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  // ------------------------------------------------------------ 1. Sin consentimiento no se carga nada de Meta
  await block('Sin consentimiento no se carga nada de Meta', async () => {
    const { ctx, p, fbReq, logs } = await open(b, { consent: null, width: 390, height: 844, mobile: true });
    await p.waitForTimeout(1200);
    ok(await p.isVisible('#cookie-banner'), 'Cookies: aparece el aviso en la primera visita');
    const btns = await p.$$eval('#cookie-banner button', (els) => els.map((e) => ({ t: e.textContent.trim(), c: e.className, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
    ok(btns.length === 3 && btns.map((x) => x.t).join('|') === 'Aceptar|Rechazar|Configurar' && new Set(btns.map((x) => `${x.c}${x.w}${x.h}`)).size === 1, 'Cookies: tres botones de igual peso', JSON.stringify(btns));
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('[data-mbar]')).transform !== 'none' || !document.querySelector('[data-mbar]').classList.contains('is-on')), 'Cookies: la barra móvil no se muestra con el aviso abierto');
    for (let y = 0; y < 6000; y += 500) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(80); }
    await p.click('#catalogo [data-catalog]').catch(() => {});
    await p.waitForTimeout(500);
    ok(fbReq.length === 0 && !(await p.evaluate(() => typeof window.fbq === 'function')), 'Tracking: nada de Facebook antes de aceptar (red interceptada)', fbReq.join(', '));
    // Configurar: el panel se abre con interruptor de marketing apagado; rechazar
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('#cookie-banner [data-cookie="config"]');
    await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.getElementById('cookie-panel').open) && !(await p.isChecked('[data-consent="marketing"]')), 'Cookies: panel con interruptor de marketing apagado');
    await p.click('[data-cookie="save"]');
    await p.waitForTimeout(700);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('vg_consent')));
    ok(saved && saved.marketing === false && fbReq.length === 0, 'Cookies: guardar sin marketing no carga el píxel');
    ok(await p.isHidden('#cookie-banner'), 'Cookies: el aviso se cierra tras decidir');
    ok(!logs.length, 'Consola limpia (sin consentimiento)', logs.join(' / '));
    await ctx.close();
  });

  // ------------------------------------------------------------ 2. Aceptar: PageView, ViewContent, DescargaCatalogo, Contact
  await block('Aceptar: PageView, ViewContent, DescargaCatalogo', async () => {
    const { ctx, p, fbReq, logs } = await open(b, { consent: null });
    await p.waitForTimeout(1300);
    await p.click('#cookie-banner [data-cookie="accept"]');
    await p.waitForTimeout(600);
    ok(fbReq.some((u) => u.includes('fbevents.js')), 'Tracking: el píxel se carga al aceptar');
    let calls = await fb(p);
    ok(calls.some((c) => c[0] === 'init' && c[1] === '1234567890') && calls.filter((c) => c[0] === 'track' && c[1] === 'PageView').length === 1, 'Tracking: init + PageView una vez');
    ok(!calls.some((c) => c[1] === 'ViewContent'), 'Tracking: sin ViewContent antes de ver los equipos');
    await p.click('#tab-dia');
    await p.evaluate(() => document.querySelector('#equipos').scrollIntoView());
    await p.waitForTimeout(900);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#equipos').scrollIntoView());
    await p.waitForTimeout(700);
    calls = await fb(p);
    const vc = calls.filter((c) => c[1] === 'ViewContent');
    ok(vc.length === 1 && vc[0][2].content_category === 'Diatermias', 'Tracking: ViewContent una vez, con la categoría activa', JSON.stringify(vc));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#catalogo [data-catalog]')]);
    ok(dl.suggestedFilename() === 'catalogo-vytalgroup-2026.pdf', 'Catálogo: se descarga el PDF', dl.suggestedFilename());
    await p.waitForTimeout(300);
    calls = await fb(p);
    ok(calls.filter((c) => c[0] === 'trackCustom' && c[1] === 'DescargaCatalogo').length === 1 && !calls.some((c) => c[1] === 'Lead'), 'Tracking: DescargaCatalogo (personalizado) y no es Lead');
    await p.evaluate(() => document.querySelector('[data-faq-wa]').scrollIntoView({ block: 'center' }));
    const [popup] = await Promise.all([p.context().waitForEvent('page'), p.click('[data-faq-wa]')]);
    await popup.close();
    calls = await fb(p);
    const contact = calls.filter((c) => c[1] === 'Contact');
    ok(contact.length === 1 && contact[0][2].content_category === 'dudas', 'Tracking: Contact al pulsar WhatsApp', JSON.stringify(contact));
    ok(!logs.length, 'Consola limpia (con consentimiento)', logs.join(' / '));
    await ctx.close();
  });

  // ------------------------------------------------------------ 3. Escritorio: "Lo quiero" + recorrido completo + UTM + doble clic
  await block('Escritorio: "Lo quiero" + recorrido completo + U', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, logs } = await open(b, { consent: true, query: UTM });
    await p.evaluate(() => document.querySelector('#equipos').scrollIntoView());
    await p.waitForTimeout(600);
    await p.click('[data-want="Acclarix AX8 (EDAN)"]');
    await p.waitForTimeout(1600);
    ok((await step(p)) === '1' && (await p.textContent('[data-picked]')) === 'Acclarix AX8' && await p.isHidden('[data-opts]'), 'Formulario: "Lo quiero" preselecciona el modelo en el paso 1', await p.textContent('[data-picked]'));
    const inView = await p.evaluate(() => { const r = document.querySelector('.fcard').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight * 0.5; });
    ok(inView, 'Formulario: "Lo quiero" lleva al formulario');
    ok(await p.evaluate(() => document.activeElement.matches('.qf__step.is-active [data-next]')), 'Formulario: foco en "Siguiente" tras llegar');
    ok(await p.isHidden('[data-back]'), 'Formulario: sin botón Atrás en el paso 1');
    ok((await p.getAttribute('.qf__bar', 'aria-valuetext')) === 'Paso 1 de 6', 'Formulario: 6 pasos (barra de progreso)');
    // "Cambiar" muestra las opciones
    await p.click('[data-change]');
    ok(await p.isVisible('[data-opts]') && await p.isChecked('input[name="equipo"][value="Ecógrafo"]'), 'Formulario: "Cambiar" vuelve a mostrar las opciones');
    await p.click('[data-want="Acclarix AX8 (EDAN)"]').catch(async () => { await p.evaluate(() => document.querySelector('[data-want="Acclarix AX8 (EDAN)"]').click()); });
    await p.waitForTimeout(1400);
    await p.click('.qf__step.is-active [data-next]');
    await p.waitForTimeout(600);
    ok((await step(p)) === '2', 'Formulario: avanza al paso 2');
    // Enter sin elegir → error
    await p.focus('.qf__step.is-active input[type=radio]');
    await p.keyboard.press('Enter');
    ok((await p.textContent('.qf__step.is-active [data-error]')) === 'Elige una opción.', 'Formulario: error si no se elige opción');
    // Teclado: espacio elige, Enter avanza (sin avance automático con flechas)
    await p.keyboard.press('Space');
    await p.waitForTimeout(400);
    ok((await step(p)) === '2', 'Formulario: con teclado no avanza solo');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(600);
    ok((await step(p)) === '3', 'Formulario: Enter avanza');
    await p.click('[data-back]');
    await p.waitForTimeout(600);
    ok((await step(p)) === '2' && await p.isChecked('input[name="perfil"][value="Fisioterapeuta"]') && await p.isVisible('.qf__step.is-active [data-next]'), 'Formulario: Atrás conserva la respuesta');
    await p.click('.qf__step.is-active label.opt:has(input[value="Clínica o centro"])');
    await p.waitForTimeout(800);
    ok((await step(p)) === '3', 'Formulario: avance automático al elegir con el ratón');
    await p.click('.qf__step.is-active label.opt:has(input[value="En 1 a 3 meses"])');
    await p.waitForTimeout(800);
    ok((await step(p)) === '4' && await p.evaluate(() => document.activeElement.id === 'f-name'), 'Formulario: paso 4 con foco en el nombre');
    await p.press('#f-name', 'Enter');
    ok((await p.textContent('#e-name')) === 'Escribe tu nombre.' && (await p.getAttribute('#f-name', 'aria-invalid')) === 'true', 'Validación: nombre obligatorio');
    await p.fill('#f-name', 'L');
    await p.press('#f-name', 'Enter');
    ok((await p.textContent('#e-name')) === 'Revisa tu nombre.', 'Validación: nombre demasiado corto');
    await p.fill('#f-name', 'Laura Gómez');
    ok((await p.textContent('#e-name')) === '', 'Validación: el error se borra al escribir');
    await p.press('#f-name', 'Enter');
    await p.waitForTimeout(600);
    ok((await step(p)) === '5', 'Formulario: Enter en el nombre avanza');
    // Teléfono
    ok((await p.textContent('.sel--prefix .sel__btn')).includes('+34'), 'Teléfono: +34 por defecto');
    await p.fill('#f-tel', '51234567');
    await p.press('#f-tel', 'Enter');
    ok((await p.textContent('#e-tel')).startsWith('Revisa el número'), 'Validación: número español incorrecto');
    await p.fill('#f-tel', '612345678');
    ok((await p.inputValue('#f-tel')) === '612 345 678', 'Teléfono: formato por grupos al escribir', await p.inputValue('#f-tel'));
    // Buscador de prefijos
    await p.click('.sel--prefix .sel__btn');
    await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.activeElement.matches('.sel--prefix .sel__search input')), 'Prefijo: el buscador recibe el foco');
    await p.keyboard.type('portu');
    await p.waitForTimeout(200);
    const opts = await p.$$eval('.sel--prefix .sel__opt', (els) => els.map((e) => e.textContent.trim()));
    ok(opts[0].startsWith('Portugal'), 'Prefijo: búsqueda por país', opts.join(' | '));
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    ok((await p.textContent('.sel--prefix .sel__btn')).includes('+351') && await p.evaluate(() => document.activeElement.id === 'f-tel'), 'Prefijo: Enter elige y vuelve al número');
    ok((await p.textContent('#e-tel')) === '' || !(await p.isVisible('#e-tel')), 'Teléfono: sin error visible tras cambiar de país');
    await p.press('#f-tel', 'Enter');
    ok((await step(p)) === '5' && (await p.textContent('#e-tel')).startsWith('Revisa'), 'Validación: el número se valida con las reglas del país');
    await p.click('.sel--prefix .sel__btn');
    await p.keyboard.type('34');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    ok((await p.textContent('.sel--prefix .sel__btn')).includes('+34'), 'Prefijo: búsqueda por número');
    await p.click('.sel--prefix .sel__btn');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(() => !document.querySelector('.sel--prefix').classList.contains('is-open') && document.activeElement.matches('.sel--prefix .sel__btn')), 'Prefijo: Escape cierra y devuelve el foco');
    await p.press('#f-tel', 'Enter');
    await p.waitForTimeout(600);
    ok((await step(p)) === '6', 'Formulario: paso 6 (email)');
    // Email
    await p.fill('#f-email', 'laura@gmial.com');
    await p.waitForTimeout(150);
    ok(await p.isVisible('[data-fix-email]'), 'Email: sugerencia de dominio (gmial → gmail)');
    await p.click('[data-fix-email]');
    ok((await p.inputValue('#f-email')) === 'laura@gmail.com', 'Email: la sugerencia corrige el dominio');
    await p.fill('#f-email', 'laura@');
    await p.click('[data-submit]');
    ok((await p.textContent('#e-email')) === 'Revisa el email.', 'Validación: email incorrecto');
    await p.fill('#f-email', 'laura@gmail.com');
    await p.click('[data-submit]');
    ok((await p.textContent('#e-consent')).startsWith('Necesito tu permiso') && !(await p.isChecked('input[name="consent"]')), 'Validación: casilla RGPD obligatoria y sin premarcar');
    ok(posts().length === 0 && !(await fb(p)).some((c) => c[1] === 'Lead'), 'Sin envío ni Lead antes de completar');
    await p.check('input[name="consent"]');
    // Doble clic rápido
    await p.dblclick('[data-submit]');
    await p.click('[data-submit]').catch(() => {});
    await p.waitForTimeout(1800);
    const sent = posts();
    ok(sent.length === 1, 'Envío: doble clic no duplica', `${sent.length} POST`);
    const d = sent[0] ? JSON.parse(sent[0].body) : {};
    ok(sent[0] && sent[0].ct.startsWith('text/plain'), 'Envío: Content-Type text/plain;charset=utf-8', sent[0] && sent[0].ct);
    const expect = { nombre: 'Laura Gómez', telefono: '+34 612 345 678', email: 'laura@gmail.com', equipo: 'Ecógrafo', modelo: 'Acclarix AX8 (EDAN)', perfil: 'Clínica o centro', plazo: 'En 1 a 3 meses', utm_source: 'facebook', utm_campaign: 'test', fbclid: 'abc123', website: '' };
    const wrong = Object.entries(expect).filter(([k, v]) => d[k] !== v).map(([k]) => `${k}=${d[k]}`);
    ok(!wrong.length, 'Envío: campos del formulario y UTM correctos', wrong.join(', '));
    const keys = ['nombre', 'telefono', 'email', 'equipo', 'modelo', 'perfil', 'plazo', 'consentimiento', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'fbc', 'fbp', 'referrer', 'landing_url', 'dispositivo', 'idioma', 'event_id'];
    ok(keys.every((k) => k in d), 'Envío: están todas las columnas de la hoja', keys.filter((k) => !(k in d)).join(', '));
    ok(/^fb\.1\.\d{13}\.abc123$/.test(d.fbc) && d.fbp === 'fb.1.1700000000000.987654321', 'Envío: fbc construido desde fbclid y fbp de la cookie', `${d.fbc} / ${d.fbp}`);
    ok(d.consentimiento && d.consentimiento.startsWith('Sí') && /^[0-9a-f-]{36}$/.test(d.event_id) && d.landing_url.includes('utm_source=facebook') && d.idioma && d.dispositivo.startsWith('Escritorio'), 'Envío: consentimiento, event_id, URL de entrada, idioma y dispositivo', `${d.dispositivo} · ${d.idioma}`);
    ok(await p.isVisible('[data-done]') && (await p.textContent('[data-done-title]')) === 'Gracias, Laura. Te escribo muy pronto.', 'Éxito: "Gracias, Laura. Te escribo muy pronto."');
    const wa = decodeURIComponent(await p.getAttribute('[data-done-wa]', 'href'));
    ok(wa.includes('soy Laura') && wa.includes('Acclarix AX8'), 'Éxito: WhatsApp con mensaje y producto', wa);
    ok(await p.isVisible('[data-done] [data-catalog]') && (await p.$$('[data-done] .btn')).length === 1, 'Éxito: un único botón y enlace al catálogo');
    const calls = await fb(p);
    const leads = calls.filter((c) => c[1] === 'Lead');
    ok(leads.length === 1 && leads[0][3] && leads[0][3].eventID === d.event_id, 'Tracking: Lead una vez tras el éxito, con eventID = event_id', JSON.stringify(leads));
    await p.click('[data-done-wa]').catch(() => {});
    await p.waitForTimeout(400);
    ok((await fb(p)).filter((c) => c[1] === 'Lead').length === 1, 'Tracking: Lead no se repite');
    ok(!logs.length, 'Consola limpia (envío correcto)', logs.join(' / '));
    await ctx.close();
  });

  // ------------------------------------------------------------ 4. Móvil: avance táctil, hoja inferior de prefijos, éxito
  await block('Móvil: avance táctil, hoja inferior de prefijos,', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, logs } = await open(b, { consent: false, width: 390, height: 844, mobile: true });
    await p.tap('.hero__cta');
    await p.waitForTimeout(1400);
    ok((await step(p)) === '1' && await p.isVisible('[data-opts]'), 'Móvil: el CTA del hero lleva al paso 1');
    await p.tap('.qf__step.is-active label.opt:has(input[value="Diatermia"])');
    await p.waitForTimeout(800);
    ok((await step(p)) === '2', 'Móvil: avance automático al tocar');
    await p.tap('.qf__step.is-active label.opt:has(input[value="Médico"])');
    await p.waitForTimeout(800);
    await p.tap('.qf__step.is-active label.opt:has(input[value="Solo miro"])');
    await p.waitForTimeout(800);
    await p.fill('#f-name', 'Marta');
    await p.tap('.qf__step.is-active [data-next]');
    await p.waitForTimeout(600);
    await p.tap('.sel--prefix .sel__btn');
    await p.waitForTimeout(700);
    const sheet = await p.evaluate(() => { const r = document.querySelector('.sel--prefix .sel__panel').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, focus: document.activeElement.className }; });
    ok(sheet.bottom <= sheet.vh + 1 && sheet.top > 0 && sheet.focus.includes('sel__list'), 'Móvil: prefijos en hoja inferior, sin abrir el teclado', JSON.stringify(sheet));
    await p.tap('.sel--prefix .sel__opt:has-text("Francia")');
    await p.waitForTimeout(600);
    ok((await p.textContent('.sel--prefix .sel__btn')).includes('+33'), 'Móvil: elegir Francia en la hoja');
    await p.fill('#f-tel', '0612345678');
    ok((await p.inputValue('#f-tel')) === '6 12 34 56 78', 'Teléfono: Francia quita el 0 y agrupa', await p.inputValue('#f-tel'));
    await p.tap('.qf__step.is-active [data-next]');
    await p.waitForTimeout(600);
    await p.fill('#f-email', 'marta@clinica.fr');
    await p.tap('input[name="consent"]');
    await p.tap('[data-submit]');
    await p.waitForTimeout(1600);
    const d = posts()[0] ? JSON.parse(posts()[0].body) : {};
    ok(d.telefono === '+33 6 12 34 56 78' && d.equipo === 'Diatermia' && d.modelo === 'Sin decidir' && d.dispositivo === 'Móvil · iOS · Instagram', 'Móvil: envío correcto (navegador de Instagram)', `${d.telefono} · ${d.modelo} · ${d.dispositivo}`);
    ok(await p.isVisible('[data-done]'), 'Móvil: pantalla de gracias');
    ok(!logs.length, 'Consola limpia (móvil)', logs.join(' / '));
    await ctx.close();
  });

  // ------------------------------------------------------------ 4b. Paso 1 ampliado: "Otro equipo" con desplegable propio
  await block('Paso 1: "Otro equipo"', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, logs } = await open(b, { consent: false });
    await toForm(p);
    await p.waitForTimeout(3100);
    const values = await p.$$eval('.qf__step.is-active input[name="equipo"]', (els) => els.map((e) => e.value));
    ok(values.join('|') === 'Ecógrafo|Diatermia|Presoterapia|Ondas de choque|Otro equipo', 'Paso 1: 5 opciones (Ecógrafo, Diatermia, Presoterapia, Ondas de choque, Otro equipo)', values.join(', '));
    ok(await p.isHidden('[data-other]'), 'Paso 1: el desplegable está oculto hasta elegir "Otro equipo"');
    await p.click('.qf__step.is-active label.opt:has(input[value="Otro equipo"])');
    await p.waitForTimeout(700);
    const st = await p.evaluate(() => ({ step: document.querySelector('#qf .qf__step.is-active').dataset.step, open: document.querySelector('#otro-panel').closest('.sel').classList.contains('is-open'), focus: document.activeElement.matches('#otro-panel input, #otro-list') }));
    ok(st.step === '1' && st.open && st.focus, 'Otro equipo: no avanza y abre el desplegable con el foco dentro', JSON.stringify(st));
    const opts = await p.$$eval('#otro-list .sel__opt', (els) => els.map((e) => e.textContent.trim()));
    ok(opts.join('|') === 'Magnetoterapia de alta intensidad|Láser de alta potencia|Electrólisis percutánea ecoguiada|Camillas de fisioterapia|Otro', 'Otro equipo: magnetoterapia, láser, electrólisis, camillas y otro', opts.join(', '));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.activeElement.matches('[data-other] .sel__btn')), 'Otro equipo: Escape cierra y devuelve el foco al botón');
    await p.click('.qf__step.is-active [data-next]');
    ok((await p.textContent('.qf__step.is-active [data-error]')) === 'Elige qué equipo buscas.', 'Otro equipo: pide elegir cuál antes de seguir');
    await p.click('[data-other] .sel__btn');
    await p.waitForTimeout(300);
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(800);
    ok((await step(p)) === '2' && (await p.textContent('[data-other] .sel__btn')).includes('Láser de alta potencia'), 'Otro equipo: con teclado elige "Láser de alta potencia" y avanza', await p.textContent('[data-other] .sel__btn'));
    await fillToEnd(p, { name: 'Ana Ruiz' });
    await p.click('[data-submit]');
    await p.waitForTimeout(1600);
    const d = posts()[0] ? JSON.parse(posts()[0].body) : {};
    ok(d.equipo === 'Láser de alta potencia' && d.modelo === '', 'Otro equipo: la hoja recibe la categoría elegida y sin modelo', `${d.equipo} · "${d.modelo}"`);
    const wa = decodeURIComponent(await p.getAttribute('[data-done-wa]', 'href'));
    ok(wa.includes('un láser de alta potencia'), 'Otro equipo: el WhatsApp de éxito nombra el equipo', wa);
    ok(!logs.length, 'Consola limpia (otro equipo)', logs.join(' / '));
    await ctx.close();
  });

  await block('Paso 1: Presoterapia', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p } = await open(b, { consent: false, width: 390, height: 844, mobile: true });
    await toForm(p);
    await p.waitForTimeout(3100);
    await p.tap('.qf__step.is-active label.opt:has(input[value="Presoterapia"])');
    await p.waitForTimeout(800);
    ok((await step(p)) === '2', 'Presoterapia: avance automático al tocar');
    await fillToEnd(p, { mobile: true, name: 'Pablo' });
    await p.tap('[data-submit]');
    await p.waitForTimeout(1600);
    const d = posts()[0] ? JSON.parse(posts()[0].body) : {};
    ok(d.equipo === 'Presoterapia' && d.modelo === '', 'Presoterapia: equipo en la hoja y sin modelo', `${d.equipo} · "${d.modelo}"`);
    await ctx.close();
  });

  // ------------------------------------------------------------ 5. Endpoint vacío: falla con elegancia y conserva los datos
  await block('Endpoint vacío: falla con elegancia y conserva l', async () => {
    const { ctx, p, logs } = await open(b, { consent: true, endpoint: '' });
    await toForm(p);
    await p.waitForTimeout(3100);
    await fillToEnd(p, {});
    await p.click('[data-submit]');
    await p.waitForTimeout(800);
    ok(await p.isVisible('[data-fail]') && await p.isHidden('[data-done]'), 'Endpoint vacío: mensaje de error amable');
    ok(logs.some((l) => l.includes('SHEETS_ENDPOINT')), 'Endpoint vacío: aviso en consola');
    ok(!(await fb(p)).some((c) => c[1] === 'Lead'), 'Endpoint vacío: sin Lead');
    const wa = decodeURIComponent(await p.getAttribute('[data-fail-wa]', 'href'));
    ok(wa.includes('soy Laura'), 'Endpoint vacío: WhatsApp como alternativa');
    await p.click('[data-retry]');
    await p.waitForTimeout(800);
    ok(await p.isVisible('[data-fail]') && (await p.inputValue('#f-email')) === 'laura@gmail.com' && (await p.inputValue('#f-name')) === 'Laura Gómez', 'Endpoint vacío: reintento sin perder los datos');
    await ctx.close();
  });

  // ------------------------------------------------------------ 6. Error del servidor
  await block('Error del servidor', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p } = await open(b, { consent: true, endpoint: `${MOCK}/exec?mode=fail` });
    await toForm(p);
    await p.waitForTimeout(3100);
    await fillToEnd(p, {});
    await p.click('[data-submit]');
    await p.waitForTimeout(1500);
    ok(posts().length === 1 && await p.isVisible('[data-fail]') && !(await fb(p)).some((c) => c[1] === 'Lead'), 'Error del servidor: aviso, sin gracias y sin Lead');
    await ctx.close();
  });

  // ------------------------------------------------------------ 7. Antispam: campo trampa y tiempo mínimo
  await block('Antispam: campo trampa y tiempo mínimo', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p } = await open(b, { consent: true });
    await toForm(p);
    await p.waitForTimeout(3100);
    await fillToEnd(p, {});
    await p.evaluate(() => { document.querySelector('input[name="website"]').value = 'http://spam.example'; });
    await p.click('[data-submit]');
    await p.waitForTimeout(1500);
    ok(posts().length === 0 && !(await fb(p)).some((c) => c[1] === 'Lead'), 'Antispam: con el campo trampa relleno no se envía ni hay Lead');
    await ctx.close();
  });
  await block('Antispam: campo trampa y tiempo mínimo', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p } = await open(b, { consent: true, slow: true });
    await toForm(p);
    await fillToEnd(p, {});
    await p.click('[data-submit]');
    await p.waitForTimeout(1500);
    ok(posts().length === 0, 'Antispam: un envío en menos de 3 s se descarta');
    await ctx.close();
  });

  await b.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} OK`);
  process.exit(fails ? 1 : 0);
})();
