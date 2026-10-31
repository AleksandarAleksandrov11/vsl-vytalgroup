// QA del formulario, el consentimiento, el píxel y la apertura de WhatsApp contra dist/ y el Apps Script
// simulado (puerto 8090). El script de Meta se sustituye por un doble que registra las llamadas a fbq
// (no sale a internet) y wa.me se intercepta para ver a dónde se navega y cuándo.
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 8081}`;
const MOCK = 'http://localhost:8090';
const LOG = process.argv[2];
const results = [];
const ok = (cond, name, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  · ${extra}` : ''}`);
const readLog = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const posts = () => readLog().filter((r) => r.method === 'POST');
// Contrato con la hoja: el formulario envía al Apps Script exactamente estos campos, en este orden,
// los mismos que antes de la v10. Si cambian, esta prueba falla: la hoja y el Apps Script no se tocan.
const SHEET_CONTRACT = ['nombre', 'telefono', 'email', 'perfil', 'equipo', 'modelo', 'consentimiento', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'event_id', 'website'];
// Code.gs tal y como está desplegado (no se modifica desde la web)
const CODE_GS_SHA256 = 'c4055212fffe7776c3a877563687ca90608135a2ec50a5ade11f670765b8b54d';
const PIXEL_STUB = `(function(){var c=window.__fb=window.__fb||[];var f=window.fbq;function cm(){var a=Array.prototype.slice.call(arguments).map(function(x){return JSON.parse(JSON.stringify(x))});c.push(a);if(window.__rec)window.__rec(JSON.stringify(a))}f.callMethod=cm;(f.queue||[]).forEach(function(a){cm.apply(null,a)});f.queue=[];document.cookie='_fbp=fb.1.1700000000000.987654321; path=/';})();`;
const UTM = '?utm_source=facebook&utm_campaign=test&fbclid=abc123';

const UA = {
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};
async function open(b, { width = 1280, height = 900, mobile = false, ua = 'instagram', endpoint = `${MOCK}/exec`, pixel = '1234567890', consent = null, query = '', slow = false, locale }) {
  // En móvil se simula un iPhone: por defecto el navegador interno de Instagram
  const userAgent = mobile ? UA[ua] : undefined;
  const ctx = await b.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, userAgent, locale });
  // Registro de fbq y de las visitas a wa.me que sobrevive a la navegación
  const rec = [];
  const wa = [];
  // Eventos por servidor (función de Vercel /api/capi): srv = todos, capi = solo los Lead
  const capi = [];
  const srv = [];
  await ctx.route('**/api/capi', (r) => { const x = { t: Date.now(), body: JSON.parse(r.request().postData() || '{}'), method: r.request().method() }; srv.push(x); if (x.body.event_name === 'Lead') capi.push(x); r.continue(); });
  await ctx.exposeBinding('__rec', (_, a) => { rec.push({ t: Date.now(), c: JSON.parse(a) }); });
  await ctx.addInitScript(({ consent, slow }) => {
    try { if (consent !== null) localStorage.setItem('vg_consent', JSON.stringify({ v: 2, date: new Date().toISOString(), necessary: true, marketing: consent })); } catch (e) { /* */ }
    // Simula un bot que envía en menos de 3 s
    if (slow) { const real = performance.now.bind(performance); performance.now = () => Math.min(real(), 1000); }
  }, { consent, slow });
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.VG_CONFIG={SHEETS_ENDPOINT:${JSON.stringify(endpoint)},META_PIXEL_ID:${JSON.stringify(pixel)}};` }));
  const fbReq = [];
  await ctx.route(/facebook\.(net|com)/, (r) => { fbReq.push(r.request().url()); r.fulfill({ contentType: 'text/javascript', body: PIXEL_STUB }); });
  await ctx.route(/wa\.me/, (r) => { if (r.request().isNavigationRequest()) wa.push({ t: Date.now(), url: r.request().url(), main: (() => { try { return r.request().frame() === p.mainFrame(); } catch { return false; } })() }); r.fulfill({ contentType: 'text/html', body: '<p>wa</p>' }); });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await p.goto(BASE + '/' + query, { waitUntil: 'networkidle' });
  return { ctx, p, fbReq, logs, rec, wa, capi, srv };
}
const fb = (p) => p.evaluate(() => window.__fb || []);
const step = (p) => p.evaluate(() => document.querySelector('#qf .qf__step.is-active')?.dataset.step || null);
const toForm = async (p) => { await p.evaluate(() => document.querySelector('#asesoramiento').scrollIntoView()); await p.waitForTimeout(700); };
const waMsg = (url) => new URL(url).searchParams.get('text');
const leadsIn = (rec) => rec.filter((x) => x.c[1] === 'Lead');

async function fillToEnd(p, { mobile, name = 'Laura Gómez', tel = '612345678', perfil = 'Fisioterapeuta' } = {}) {
  const tap = (sel) => (mobile ? p.tap(sel) : p.click(sel));
  if ((await step(p)) === '1') {
    await tap('.qf__step.is-active label.opt:has(input[value="Ecógrafo"])');
    await p.waitForTimeout(700);
  }
  if ((await step(p)) === '2') {
    await tap(`.qf__step.is-active label.opt:has(input[value="${perfil}"])`);
    await p.waitForTimeout(700);
  }
  if ((await step(p)) === '3') {
    await p.fill('#f-name', name);
    await p.press('#f-name', 'Enter');
    await p.waitForTimeout(500);
  }
  await p.fill('#f-tel', tel);
}

async function block(name, fn) {
  try { await fn(); } catch (err) { ok(false, `${name}: error en la prueba`, String(err.message).split('\n')[0]); }
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  // ------------------------------------------------------------ 1. Sin consentimiento no se carga nada de Meta
  await block('Sin consentimiento no se carga nada de Meta', async () => {
    const { ctx, p, fbReq, logs, srv } = await open(b, { consent: null, width: 390, height: 844, mobile: true, query: UTM });
    await p.waitForTimeout(1200);
    ok(await p.isVisible('#cookie-banner'), 'Cookies: aparece el aviso en la primera visita');
    const hero = await p.evaluate(() => { const c = document.querySelector('.hero__cta').getBoundingClientRect(); const k = document.getElementById('cookie-banner').getBoundingClientRect(); return { cta: Math.round(c.bottom), ck: Math.round(k.top) }; });
    ok(hero.cta < hero.ck, 'Cookies: el aviso no tapa el botón del hero (390 × 844)', JSON.stringify(hero));
    const pv = srv.filter((x) => x.body.event_name === 'PageView');
    ok(pv.length === 1 && /^[0-9a-f-]{36}$/.test(pv[0].body.event_id) && /^fb\.1\.\d{13}\.abc123$/.test(pv[0].body.fbc) && pv[0].body.event_source_url.startsWith(BASE + '/?utm_source=facebook') && !('nombre' in pv[0].body), 'API de conversiones: PageView por servidor al cargar, sin aceptar cookies, con event_id, la URL y fbc construido desde el fbclid', JSON.stringify(pv[0] && pv[0].body).slice(0, 160));
    const btns = await p.$$eval('#cookie-banner button', (els) => els.map((e) => ({ t: e.textContent.trim(), c: e.className, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
    ok(btns.length === 3 && btns.map((x) => x.t).join('|') === 'Rechazar|Aceptar|Configurar' && new Set(btns.slice(0, 2).map((x) => `${x.c}${x.w}${x.h}`)).size === 1 && /\blink\b/.test(btns[2].c), 'Cookies: Rechazar y Aceptar con el mismo peso y Configurar como enlace', JSON.stringify(btns));
    const ck = await p.evaluate(() => { const r = document.getElementById('cookie-banner').getBoundingClientRect(); return { h: Math.round(r.height), bottom: Math.round(r.bottom), vh: innerHeight }; });
    ok(ck.h <= 150 && ck.bottom <= ck.vh, 'Cookies: aviso compacto en móvil (390 px)', JSON.stringify(ck));
    await p.evaluate(() => document.querySelector('#equipos').scrollIntoView());
    await p.waitForTimeout(1000);
    const bar = await p.evaluate(() => { const m = document.querySelector('[data-mbar]'); const r = m.getBoundingClientRect(); const k = document.getElementById('cookie-banner').getBoundingClientRect(); return { on: m.classList.contains('is-on'), barTop: Math.round(r.top), vh: innerHeight, ckBottom: Math.round(k.bottom), ckVisible: !document.getElementById('cookie-banner').hidden }; });
    ok(bar.on && bar.ckVisible && bar.ckBottom <= bar.barTop && Math.round(bar.barTop) < bar.vh, 'Cookies: con el aviso abierto la barra móvil sigue a la vista y el aviso queda encima, sin taparla', JSON.stringify(bar));
    for (let y = 0; y < 6000; y += 500) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(80); }
    await p.waitForTimeout(500);
    const vcs = srv.filter((x) => x.body.event_name === 'ViewContent');
    ok(vcs.length === 1 && vcs[0].body.content_category === 'Ecógrafos' && /^[0-9a-f-]{36}$/.test(vcs[0].body.event_id) && srv.filter((x) => x.body.event_name === 'PageView').length === 1, 'API de conversiones: ViewContent por servidor una vez por sesión al ver los equipos, sin aceptar cookies', JSON.stringify(vcs.map((x) => x.body.content_category)));
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

  // ------------------------------------------------------------ 2. Aceptar: PageView, ViewContent, Contact; sin catálogo público
  await block('Aceptar: PageView, ViewContent, Contact', async () => {
    const { ctx, p, fbReq, logs, srv } = await open(b, { consent: null });
    await p.waitForTimeout(1300);
    await p.click('#cookie-banner [data-cookie="accept"]');
    await p.waitForTimeout(600);
    ok(fbReq.some((u) => u.includes('fbevents.js')), 'Tracking: el píxel se carga al aceptar');
    let calls = await fb(p);
    const pvPix = calls.filter((c) => c[0] === 'track' && c[1] === 'PageView');
    const pvSrv = srv.filter((x) => x.body.event_name === 'PageView');
    ok(calls.some((c) => c[0] === 'init' && c[1] === '1234567890') && pvPix.length === 1 && pvSrv.length === 1 && pvPix[0][3] && pvPix[0][3].eventID === pvSrv[0].body.event_id, 'Tracking: al aceptar, init + PageView una vez con el mismo event_id que ya se envió por servidor (deduplicación)', JSON.stringify({ pixel: pvPix[0] && pvPix[0][3], servidor: pvSrv[0] && pvSrv[0].body.event_id }));
    ok(!calls.some((c) => c[1] === 'ViewContent'), 'Tracking: sin ViewContent antes de ver los equipos');
    // Se cambia de pestaña sin desplazar la página: la sección aún no se ha visto
    await p.evaluate(() => document.getElementById('tab-dia').click());
    await p.evaluate(() => document.querySelector('#equipos').scrollIntoView());
    await p.waitForTimeout(900);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#equipos').scrollIntoView());
    await p.waitForTimeout(700);
    calls = await fb(p);
    const vc = calls.filter((c) => c[1] === 'ViewContent');
    const vcSrv = srv.filter((x) => x.body.event_name === 'ViewContent');
    ok(vc.length === 1 && vc[0][2].content_category === 'Diatermias' && vcSrv.length === 1 && vc[0][3] && vc[0][3].eventID === vcSrv[0].body.event_id && vcSrv[0].body.content_category === 'Diatermias', 'Tracking: ViewContent una vez, con la categoría activa, por el píxel y por servidor con el mismo event_id', JSON.stringify({ pixel: vc[0] && vc[0][3], servidor: vcSrv.map((x) => x.body.event_id) }));
    const pdf = await fetch(`${BASE}/assets/docs/catalogo-vytalgroup-2026.pdf`, { redirect: 'manual' });
    ok(pdf.status === 301 && pdf.headers.get('location') === '/#asesoramiento', 'Catálogo: el PDF ya no es público (301 a /#asesoramiento)', `${pdf.status} ${pdf.headers.get('location')}`);
    const html = await p.content();
    ok(!/\.pdf|data-catalog[^-]|DescargaCatalogo|Descargar cat/i.test(html), 'Catálogo: ningún enlace de descarga en la página');
    calls = await fb(p);
    ok(!calls.some((c) => c[1] === 'DescargaCatalogo') && !(await p.$('[data-catalog-ask], [data-catalog]')), 'Catálogo: ni botón de catálogo ni DescargaCatalogo');
    const faq = await p.evaluate(() => { const a = document.querySelector('[data-faq-ask]'); return { t: a.textContent.trim(), href: a.getAttribute('href'), want: a.hasAttribute('data-want') }; });
    ok(faq.t === '¿Otra duda? Déjanos tu WhatsApp y te la resolvemos' && faq.href === '#asesoramiento' && !faq.want, 'FAQ: "¿Otra duda? Déjanos tu WhatsApp y te la resolvemos" lleva al formulario sin preselección', JSON.stringify(faq));
    await p.evaluate(() => document.querySelector('[data-faq-ask]').scrollIntoView({ block: 'center' }));
    await p.click('[data-faq-ask]');
    await p.waitForTimeout(1600);
    ok((await step(p)) === '1' && !(await p.$('input[name="equipo"]:checked')), 'FAQ: llega al paso 1 sin nada elegido');
    await p.focus('input[name="equipo"][value="Diatermia"]');
    await p.keyboard.press('Enter');
    await p.click('.qf__step.is-active label.opt:has(input[value="Ecógrafo"])');
    await p.waitForTimeout(800);
    await p.click('[data-back]');
    await p.waitForTimeout(500);
    await p.click('.qf__step.is-active [data-next]');
    await p.waitForTimeout(600);
    calls = await fb(p);
    const funnel = calls.filter((c) => c[0] === 'trackCustom').map((c) => `${c[1]}${JSON.stringify(c[2])}`);
    ok(funnel.join(' ') === 'FormStart{} FormError{"step":1,"field":"equipo"} FormStep{"step":2}', 'Embudo: FormStart una vez, FormError con paso y campo y FormStep 2 una vez (aunque se vuelva a entrar)', funnel.join(' '));
    ok(!calls.some((c) => c[1] === 'Contact' || c[1] === 'Lead'), 'Tracking: ni Contact ni Lead antes de enviar');
    ok(!logs.length, 'Consola limpia (con consentimiento)', logs.join(' / '));
    await ctx.close();
  });

  // ------------------------------------------------------------ 3. Escritorio: "Lo quiero" + recorrido completo + UTM + doble clic
  await block('Escritorio: "Lo quiero" + recorrido completo + U', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, logs, rec, wa: waNav, capi } = await open(b, { consent: true, query: UTM });
    const popups = [];
    ctx.on('page', (pg) => popups.push(pg));
    await p.evaluate(() => document.querySelector('#equipos').scrollIntoView());
    await p.waitForTimeout(600);
    await p.click('[data-want="Acclarix AX8 (EDAN)"]');
    await p.waitForTimeout(1600);
    ok((await step(p)) === '2' && (await p.textContent('[data-picked]')) === 'Acclarix AX8', 'Formulario: "Lo quiero" salta al perfil con el modelo elegido', await p.textContent('[data-picked]'));
    const inView = await p.evaluate(() => { const r = document.querySelector('.fcard').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight * 0.5; });
    ok(inView, 'Formulario: "Lo quiero" lleva al formulario');
    ok(await p.evaluate(() => document.activeElement.name === 'perfil'), 'Formulario: foco en la primera opción de perfil tras llegar');
    ok((await p.getAttribute('.qf__bar', 'aria-valuetext')) === 'Paso 2 de 4' && (await p.textContent('[data-count-step]')) === '2/4' && await p.isVisible('[data-back]'), 'Formulario: 4 pasos con progreso (2/4)');
    const qs = await p.$$eval('.qf__step', (els) => els.map((e) => e.querySelector('.qf__q').textContent.trim()));
    const fields = await p.$$eval('#qf input[name]:not([type=hidden]):not([name=website])', (els) => [...new Set(els.map((e) => e.name))]);
    ok(qs.join('|') === '¿Qué equipo te interesa?|¿Cuál es tu perfil?|¿Cómo te llamas?|¿A qué WhatsApp te escribimos?' && fields.join(',') === 'equipo,perfil,nombre,telefono,email', 'Formulario: 4 preguntas (qué te interesa, perfil, nombre y WhatsApp o correo), sin casilla de consentimiento', `${qs.join(' / ')} · ${fields.join(', ')}`);
    const perfiles = await p.$$eval('input[name="perfil"]', (els) => els.map((e) => e.value));
    ok(perfiles.join('|') === 'Clínica|Fisioterapeuta|Médico|Otro', 'Perfil: Clínica, Fisioterapeuta, Médico u Otro (los de siempre)', perfiles.join(', '));
    // "Cambiar" vuelve al paso 1 con el equipo marcado y conserva el modelo si no se cambia
    await p.click('[data-change]');
    await p.waitForTimeout(500);
    ok((await step(p)) === '1' && await p.isChecked('input[name="equipo"][value="Ecógrafo"]'), 'Formulario: "Cambiar" vuelve al paso 1 con el equipo marcado');
    await p.click('.qf__step.is-active [data-next]');
    await p.waitForTimeout(600);
    ok((await step(p)) === '2' && (await p.textContent('[data-picked]')) === 'Acclarix AX8', 'Formulario: "Siguiente" mantiene el modelo de la tarjeta');
    // Perfil: con teclado, Enter sin elegir avisa; al elegir con el ratón avanza solo
    ok(await p.isHidden('.qf__step.is-active [data-next]'), 'Perfil: "Siguiente" oculto hasta elegir');
    await p.focus('input[name="perfil"][value="Clínica"]');
    await p.keyboard.press('Enter');
    ok((await step(p)) === '2' && (await p.textContent('.qf__step.is-active [data-error]')) === 'Elige una opción.', 'Perfil: pide elegir antes de seguir');
    await p.click('.qf__step.is-active label.opt:has(input[value="Fisioterapeuta"])');
    await p.waitForTimeout(700);
    ok((await step(p)) === '3' && await p.evaluate(() => document.activeElement.id === 'f-name') && (await p.textContent('[data-count-step]')) === '3/4', 'Perfil: al elegir avanza solo al nombre (3/4)');
    // Volver atrás conserva la respuesta
    await p.click('[data-back]');
    await p.waitForTimeout(500);
    ok((await step(p)) === '2' && await p.isChecked('input[name="perfil"][value="Fisioterapeuta"]') && await p.isVisible('.qf__step.is-active [data-next]'), 'Perfil: al volver sigue marcado');
    await p.click('.qf__step.is-active [data-next]');
    await p.waitForTimeout(500);
    // Validación del nombre
    await p.press('#f-name', 'Enter');
    ok((await p.textContent('#e-name')) === 'Escribe tu nombre.' && (await p.getAttribute('#f-name', 'aria-invalid')) === 'true', 'Validación: nombre obligatorio');
    await p.fill('#f-name', 'L');
    await p.press('#f-name', 'Enter');
    ok((await p.textContent('#e-name')) === 'Revisa tu nombre.', 'Validación: nombre demasiado corto');
    await p.fill('#f-name', 'Laura Gómez');
    ok((await p.textContent('#e-name')) === '', 'Validación: el error se borra al escribir');
    await p.press('#f-name', 'Enter');
    await p.waitForTimeout(500);
    ok((await step(p)) === '4' && await p.evaluate(() => document.activeElement.id === 'f-tel') && (await p.textContent('[data-count-step]')) === '4/4', 'Formulario: Enter en el nombre pasa al WhatsApp (4/4)');
    // Teléfono
    ok((await p.textContent('.sel--prefix .sel__btn')).includes('+34'), 'Teléfono: +34 por defecto');
    await p.fill('#f-tel', '51234567');
    await p.press('#f-tel', 'Enter');
    ok((await p.textContent('#e-tel')).startsWith('Revisa el número'), 'Validación: número español incorrecto');
    await p.fill('#f-tel', '612345678');
    ok((await p.inputValue('#f-tel')) === '612 345 678' && (await p.textContent('#e-tel')) === '', 'Teléfono: formato por grupos y el error se borra al escribir', await p.inputValue('#f-tel'));
    // Buscador de prefijos. Se pulsa con el ratón en su sitio, como una persona: p.click() desplaza antes
    // la página para "ver" el botón y, con el scroll suave de la web, a veces se lleva el panel fuera de pantalla.
    { const bb = await p.locator('.sel--prefix .sel__btn').boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    await p.waitForTimeout(400);
    const panel = await p.evaluate(() => { const r = document.querySelector('.sel--prefix .sel__panel').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, focus: document.activeElement.matches('.sel--prefix .sel__search input') }; });
    ok(panel.focus && panel.top >= 0 && panel.bottom <= panel.vh, 'Prefijo: el desplegable se ve entero y el buscador recibe el foco', JSON.stringify(panel));
    await p.keyboard.type('portu');
    await p.waitForTimeout(200);
    const opts = await p.$$eval('.sel--prefix .sel__opt', (els) => els.map((e) => e.textContent.trim()));
    ok(opts[0].startsWith('Portugal'), 'Prefijo: búsqueda por país', opts.join(' | '));
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    ok((await p.textContent('.sel--prefix .sel__btn')).includes('+351') && await p.evaluate(() => document.activeElement.id === 'f-tel'), 'Prefijo: Enter elige y vuelve al número');
    await p.click('[data-submit]');
    ok((await step(p)) === '4' && (await p.textContent('#e-tel')).startsWith('Revisa'), 'Validación: el número se valida con las reglas del país');
    await p.click('.sel--prefix .sel__btn');
    await p.keyboard.type('34');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    ok((await p.textContent('.sel--prefix .sel__btn')).includes('+34'), 'Prefijo: búsqueda por número');
    // Ratón: la opción bajo el cursor se resalta y es la que elige Enter
    await p.click('.sel--prefix .sel__btn');
    await p.waitForTimeout(300);
    const third = p.locator('.sel--prefix .sel__opt').nth(2);
    await third.hover();
    await p.waitForTimeout(150);
    const hov = await p.evaluate(() => { const o = document.querySelectorAll('.sel--prefix .sel__opt')[2]; return { active: o.classList.contains('is-active'), bg: getComputedStyle(o).backgroundColor, name: o.textContent.trim() }; });
    ok(hov.active && hov.bg !== 'rgba(0, 0, 0, 0)', 'Prefijo: la opción bajo el ratón se resalta', JSON.stringify(hov));
    await p.keyboard.press('Escape');
    ok(await p.evaluate(() => !document.querySelector('.sel--prefix').classList.contains('is-open') && document.activeElement.matches('.sel--prefix .sel__btn')), 'Prefijo: Escape cierra y devuelve el foco');
    // Aviso legal en lugar de casilla
    const legal = await p.evaluate(() => { const l = document.querySelector('.qf__step.is-active .qf__legal'); const a = l && l.querySelector('a'); return l && { t: l.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), after: !!(document.querySelector('[data-submit]').compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING) }; });
    ok(legal && legal.t === 'Al enviar aceptas la política de privacidad y que VytalGroup te contacte sobre tu solicitud.' && legal.href === '/privacidad' && legal.after && !(await p.$('input[name="consent"]')), 'Consentimiento: aviso de texto bajo el botón con enlace a /privacidad (sin casilla)', legal && legal.t);
    ok((await p.textContent('[data-submit]')).trim() === 'Enviar y abrir WhatsApp', 'Botón: "Enviar y abrir WhatsApp" con WhatsApp');
    ok(posts().length === 0 && !capi.length && !(await fb(p)).some((c) => c[1] === 'Lead'), 'Sin envío ni Lead (píxel ni servidor) antes de completar');
    // Doble clic rápido
    await p.dblclick('[data-submit]');
    await p.click('[data-submit]').catch(() => {});
    await p.waitForTimeout(1800);
    const sent = posts();
    ok(sent.length === 1, 'Envío: doble clic no duplica', `${sent.length} POST`);
    const d = sent[0] ? JSON.parse(sent[0].body) : {};
    ok(sent[0] && sent[0].ct.startsWith('text/plain'), 'Envío: Content-Type text/plain;charset=utf-8', sent[0] && sent[0].ct);
    const expect = { nombre: 'Laura Gómez', telefono: '+34 612 345 678', email: '', perfil: 'Fisioterapeuta', equipo: 'Ecógrafo', modelo: 'Acclarix AX8 (EDAN)', utm_source: 'facebook', utm_campaign: 'test', website: '' };
    const wrong = Object.entries(expect).filter(([k, v]) => d[k] !== v).map(([k]) => `${k}=${d[k]}`);
    ok(!wrong.length, 'Envío: campos del formulario (con el perfil) y UTM correctos', wrong.join(', '));
    // Contrato con la hoja
    const gs = fs.readFileSync('integrations/apps-script/Code.gs');
    const keys = Object.keys(d).join(',');
    ok(keys === SHEET_CONTRACT.join(','), 'Contrato con la hoja: el formulario envía exactamente los mismos campos que antes (ni uno más ni uno menos)', keys);
    ok(require('crypto').createHash('sha256').update(gs).digest('hex') === CODE_GS_SHA256, 'Apps Script: Code.gs sin cambios (el mismo que está desplegado)');
    ok(/^Sí · \d{4}-\d{2}-\d{2}T/.test(d.consentimiento) && /^[0-9a-f-]{36}$/.test(d.event_id), 'Envío: consentimiento ("Sí · fecha", como siempre) y event_id', d.consentimiento);
    ok(await p.isVisible('[data-done]') && (await p.textContent('[data-done-title]')) === 'Gracias, Laura. Te abrimos WhatsApp para que nos escribas ya.', 'Éxito: "Gracias, Laura. Te abrimos WhatsApp para que nos escribas ya."');
    const wa = waMsg(await p.getAttribute('[data-done-wa]', 'href'));
    ok(wa === 'Hola, soy Laura Gómez. Acabo de pedir asesoramiento en la web.\nMe interesa: Acclarix AX8 (EDAN).\nPerfil: Fisioterapeuta.' && (await p.getAttribute('[data-done-wa]', 'href')).startsWith('https://wa.me/34616372644?text='), 'Éxito: WhatsApp al +34 616 372 644 con el mensaje de tres líneas', JSON.stringify(wa));
    // Escritorio: no se navega fuera; se abre WhatsApp en otra pestaña solo si el navegador lo permite
    await p.waitForTimeout(1000);
    ok(p.url().startsWith(BASE) && !waNav.some((x) => x.main), 'Escritorio: la página no se va a WhatsApp (sin redirección)', p.url());
    ok(popups.length <= 1 && (!popups.length || popups[0].url().startsWith('https://wa.me/34616372644?text=')), 'Escritorio: como mucho una pestaña nueva con WhatsApp Web', `${popups.length} pestañas`);
    ok((await p.textContent('[data-done-wa]')).trim() === 'Abrir WhatsApp Web' && await p.isHidden('[data-go]') && (await p.$$('[data-done] .btn')).length === 1, 'Escritorio: botón grande "Abrir WhatsApp Web" y sin indicador de apertura');
    const autoC = (await fb(p)).filter((c) => c[1] === 'Contact');
    ok(autoC.length === (popups.length ? 1 : 0) && (!autoC.length || autoC[0][2].content_category === 'gracias-auto'), 'Tracking: Contact "gracias-auto" solo si se abrió la pestaña', JSON.stringify(autoC));
    for (const x of popups.splice(0)) await x.close();
    ok(await p.isVisible('[data-done] [data-again]') && (await p.textContent('[data-again]')) === 'Enviar otra solicitud', 'Éxito: enlace "Enviar otra solicitud"');
    const calls = await fb(p);
    const leads = calls.filter((c) => c[1] === 'Lead');
    ok(leads.length === 1 && leads[0][3] && leads[0][3].eventID === d.event_id, 'Tracking: Lead una vez tras el éxito, con eventID = event_id', JSON.stringify(leads));
    const iMatch = calls.findIndex((c) => c[0] === 'init' && c[2]);
    ok(iMatch >= 0 && JSON.stringify(calls[iMatch]) === JSON.stringify(['init', '1234567890', { fn: 'laura', ph: '34612345678', country: 'es' }]) && iMatch < calls.indexOf(leads[0]), 'Coincidencia avanzada: fbq init con fn, ph y country normalizados, justo antes del Lead', JSON.stringify(calls[iMatch]));
    ok(leads[0][2].content_name === 'Acclarix AX8 (EDAN)' && leads[0][2].content_category === 'Ecógrafo', 'Lead: content_name con el modelo y content_category con el equipo', JSON.stringify(leads[0][2]));
    const sv = capi[0] && capi[0].body;
    ok(capi.length === 1 && capi[0].method === 'POST' && sv.event_id === d.event_id && sv.nombre === 'Laura Gómez' && sv.telefono === '+34 612 345 678' && sv.email === '' && sv.country === 'ES' && sv.content_name === 'Acclarix AX8 (EDAN)' && sv.content_category === 'Ecógrafo' && /^fb\.1\.\d{13}\.abc123$/.test(sv.fbc) && sv.fbp === 'fb.1.1700000000000.987654321' && sv.event_source_url.startsWith(BASE + '/'), 'Lead por servidor: una llamada a /api/capi tras guardar, con el mismo event_id, los datos del lead, fbc y fbp', JSON.stringify(sv && { id: sv.event_id === d.event_id, fbc: sv.fbc, country: sv.country }));
    ok(/fetch\('\/api\/capi', \{ method: 'POST', keepalive: true/.test(fs.readFileSync('assets/js/tracking.js', 'utf8')) && /serverEvent\('Lead'/.test(fs.readFileSync('assets/js/form.js', 'utf8')), 'Eventos por servidor: fetch con keepalive (llegan aunque se abra WhatsApp)');
    const [tab] = await Promise.all([ctx.waitForEvent('page'), p.click('[data-done-wa]')]);
    await p.waitForTimeout(300);
    await tab.close();
    popups.splice(0);
    const btnC = (await fb(p)).filter((c) => c[1] === 'Contact' && c[2].content_category === 'gracias-boton');
    ok((await fb(p)).filter((c) => c[1] === 'Lead').length === 1 && btnC.length === 1, 'Tracking: el botón registra Contact "gracias-boton" y Lead no se repite', JSON.stringify(btnC));
    // Otra solicitud: paso 1 con un event_id nuevo; se conservan perfil, nombre y teléfono
    await p.click('[data-again]');
    await p.waitForTimeout(600);
    const again = await p.evaluate(() => ({ done: document.querySelector('[data-done]').hidden, finished: document.querySelector('#qf').classList.contains('is-finished'), equipo: !!document.querySelector('input[name="equipo"]:checked'), perfil: document.querySelector('input[name="perfil"]:checked')?.value, name: document.querySelector('#f-name').value, focus: document.activeElement.name }));
    ok((await step(p)) === '1' && again.done && !again.finished && !again.equipo && again.focus === 'equipo' && (await p.getAttribute('.qf__bar', 'aria-valuetext')) === 'Paso 1 de 4' && await p.isVisible('.qf__nav'), 'Otra solicitud: vuelve al paso 1 sin equipo marcado y con el foco en la pregunta', JSON.stringify(again));
    ok(again.perfil === 'Fisioterapeuta' && again.name === 'Laura Gómez' && (await p.inputValue('#f-tel')) === '612 345 678', 'Otra solicitud: conserva perfil, nombre y WhatsApp');
    await p.click('.qf__step.is-active label.opt:has(input[value="Diatermia"])');
    await p.waitForTimeout(700);
    ok((await step(p)) === '2' && (await p.textContent('[data-picked]')) === 'Diatermia' && await p.isVisible('.qf__step.is-active [data-next]'), 'Otra solicitud: el equipo nuevo sustituye al modelo anterior');
    await p.click('.qf__step.is-active [data-next]');
    await p.waitForTimeout(600);
    await p.press('#f-name', 'Enter');
    await p.waitForTimeout(500);
    await p.click('[data-submit]');
    await p.waitForTimeout(1500);
    const sent2 = posts();
    const d2 = sent2[1] ? JSON.parse(sent2[1].body) : {};
    ok(sent2.length === 2 && d2.equipo === 'Diatermia' && d2.modelo === 'Sin decidir' && d2.nombre === 'Laura Gómez' && d2.telefono === '+34 612 345 678' && d2.perfil === 'Fisioterapeuta' && /^[0-9a-f-]{36}$/.test(d2.event_id) && d2.event_id !== d.event_id, 'Otra solicitud: segundo envío con el equipo nuevo y otro event_id', `${sent2.length} POST · ${d2.equipo} · ${d2.event_id}`);
    const leads2 = (await fb(p)).filter((c) => c[1] === 'Lead');
    ok(await p.isVisible('[data-done]') && leads2.length === 2 && leads2[1][3] && leads2[1][3].eventID === d2.event_id, 'Otra solicitud: gracias otra vez y un Lead por solicitud, cada uno con su event_id', JSON.stringify(leads2.map((c) => c[3])));
    // "Lo quiero" después del gracias empieza otra solicitud con ese modelo
    await p.evaluate(() => document.querySelector('#equipos').scrollIntoView());
    await p.waitForTimeout(600);
    await p.click('[data-want="Acclarix LX9 (EDAN)"]');
    await p.waitForTimeout(1600);
    ok((await step(p)) === '2' && await p.isHidden('[data-done]') && (await p.textContent('[data-picked]')) === 'Acclarix LX9' && await p.isChecked('input[name="equipo"][value="Ecógrafo"]'), '"Lo quiero" tras el gracias: otra solicitud con el modelo de la tarjeta', await p.textContent('[data-picked]'));
    ok(posts().length === 2 && (await fb(p)).filter((c) => c[1] === 'Lead').length === 2 && leadsIn(rec).length === 2 && capi.length === 2 && capi[1].body.event_id === d2.event_id, '"Pedir asesoramiento" tras el gracias: no envía nada por sí solo (un Lead por servidor por solicitud)');
    ok(p.url().startsWith(BASE) && !waNav.some((x) => x.main), 'Escritorio: en ningún momento se navega a wa.me en la misma pestaña');
    ok(!logs.length, 'Consola limpia (envío correcto)', logs.join(' / '));
    await ctx.close();
  });

  // ------------------------------------------------------------ 4. Móvil: avance táctil, hoja inferior de prefijos, éxito
  await block('Móvil: avance táctil, hoja inferior de prefijos,', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, logs } = await open(b, { consent: false, width: 390, height: 844, mobile: true });
    await p.tap('.hero__cta');
    await p.waitForTimeout(1400);
    ok((await step(p)) === '1' && await p.isVisible('.qf__step.is-active [data-opts]') && (await p.getAttribute('.qf__bar', 'aria-valuetext')) === 'Paso 1 de 4', 'Móvil: el CTA del hero lleva al paso 1 de 4');
    await p.tap('.qf__step.is-active label.opt:has(input[value="Diatermia"])');
    await p.waitForTimeout(800);
    ok((await step(p)) === '2' && (await p.textContent('[data-picked]')) === 'Diatermia', 'Móvil: avance automático al tocar y resumen del equipo');
    await p.tap('.qf__step.is-active label.opt:has(input[value="Clínica"])');
    await p.waitForTimeout(800);
    ok((await step(p)) === '3', 'Móvil: el perfil también avanza al tocar');
    await p.fill('#f-name', 'Marta');
    await p.tap('.qf__step.is-active [data-next]');
    await p.waitForTimeout(700);
    ok((await step(p)) === '4', 'Móvil: "Siguiente" en el nombre lleva al WhatsApp');
    await p.tap('.sel--prefix .sel__btn');
    await p.waitForTimeout(700);
    const sheet = await p.evaluate(() => { const r = document.querySelector('.sel--prefix .sel__panel').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, focus: document.activeElement.className }; });
    ok(sheet.bottom <= sheet.vh + 1 && sheet.top > 0 && sheet.focus.includes('sel__list'), 'Móvil: prefijos en hoja inferior, sin abrir el teclado', JSON.stringify(sheet));
    await p.tap('.sel--prefix .sel__opt:has-text("Francia")');
    await p.waitForTimeout(600);
    ok((await p.textContent('.sel--prefix .sel__btn')).includes('+33'), 'Móvil: elegir Francia en la hoja');
    await p.fill('#f-tel', '0612345678');
    ok((await p.inputValue('#f-tel')) === '6 12 34 56 78', 'Teléfono: Francia quita el 0 y agrupa', await p.inputValue('#f-tel'));
    await p.tap('[data-submit]');
    await p.waitForURL(/wa\.me/, { timeout: 5000 }).catch(() => {});
    const d = posts()[0] ? JSON.parse(posts()[0].body) : {};
    ok(d.telefono === '+33 6 12 34 56 78' && d.equipo === 'Diatermia' && d.perfil === 'Clínica' && d.modelo === 'Sin decidir', 'Móvil: envío correcto (navegador de Instagram)', `${d.telefono} · ${d.perfil} · ${d.modelo}`);
    ok(p.url().startsWith('https://wa.me/34616372644?text=') && waMsg(p.url()) === 'Hola, soy Marta. Acabo de pedir asesoramiento en la web.\nMe interesa: Diatermia.\nPerfil: Clínica.', 'Móvil: tras enviar se abre WhatsApp con el mensaje', p.url().slice(0, 60));
    ok(!logs.length, 'Consola limpia (móvil)', logs.join(' / '));
    await ctx.close();
  });

  // ------------------------------------------------------------ 4a. Móvil: WhatsApp se abre solo (Safari de iPhone y navegador de Instagram)
  for (const ua of ['safari', 'instagram']) {
    await block(`WhatsApp automático (${ua})`, async () => {
      fs.writeFileSync(LOG, '');
      const { ctx, p, logs, rec, wa, capi } = await open(b, { consent: true, width: 390, height: 844, mobile: true, ua, pixel: '111111111,222222222', query: '?utm_source=meta&utm_medium=paid&utm_campaign=CERRAR&utm_content=BOFU%201' });
      await toForm(p);
      await p.waitForTimeout(3100);
      await p.tap('.qf__step.is-active label.opt:has(input[value="Ondas de choque"])');
      await p.waitForTimeout(800);
      ok((await step(p)) === '2' && (await p.textContent('[data-picked]')) === 'Ondas de choque', `Móvil ${ua}: elegir el equipo avanza al perfil`);
      await fillToEnd(p, { mobile: true, name: 'Nuria Campos Vela', perfil: 'Médico' });
      const t0 = Date.now();
      await p.tap('[data-submit]');
      await p.waitForSelector('[data-done]:not([hidden])', { timeout: 5000 });
      const mid = await p.evaluate(() => ({ title: document.querySelector('[data-done-title]').textContent, go: !document.querySelector('[data-go]').hidden, btn: document.querySelector('[data-done-wa]').textContent.trim(), text: document.querySelector('[data-done-text]').textContent }));
      ok(mid.title === 'Gracias, Nuria. Te abrimos WhatsApp para que nos escribas ya.' && mid.go && mid.btn === 'Abrir WhatsApp' && mid.text === 'Si no se abre solo, toca aquí.', `Móvil ${ua}: gracias con indicador "Abriendo WhatsApp" y botón de respaldo`, JSON.stringify(mid));
      await p.waitForURL(/wa\.me/, { timeout: 5000 }).catch(() => {});
      const nav = wa.filter((x) => x.main);
      const lead = leadsIn(rec);
      const d = posts()[0] ? JSON.parse(posts()[0].body) : {};
      ok(posts().length === 1 && Object.keys(d).join(',') === SHEET_CONTRACT.join(',') && d.equipo === 'Ondas de choque' && d.modelo === '' && d.perfil === 'Médico' && d.utm_content === 'BOFU 1', `Móvil ${ua}: la hoja recibe los campos de siempre, con el equipo, el perfil y la campaña`, `${d.equipo} · "${d.modelo}" · ${d.utm_content}`);
      ok(nav.length === 1 && waMsg(nav[0].url) === 'Hola, soy Nuria Campos Vela. Acabo de pedir asesoramiento en la web.\nMe interesa: Ondas de choque.\nPerfil: Médico.' && nav[0].url.startsWith('https://wa.me/34616372644?text='), `Móvil ${ua}: navega a wa.me con el texto correcto`, nav[0] && waMsg(nav[0].url));
      const inits = rec.filter((x) => x.c[0] === 'init' && x.c[2]);
      ok(inits.map((x) => x.c[1]).join() === '111111111,222222222' && JSON.stringify(inits[0].c[2]) === JSON.stringify({ fn: 'nuria', ph: '34612345678', country: 'es' }) && capi.length === 1 && capi[0].body.event_id === d.event_id, `Móvil ${ua}: coincidencia avanzada en cada píxel y Lead por servidor con el mismo event_id aunque se abra WhatsApp`, `${inits.length} init · ${capi.length} servidor`);
      ok(lead.length === 1 && nav[0] && nav[0].t - lead[0].t >= 800 && nav[0].t - t0 >= 1500 && nav[0].t - t0 < 4000, `Móvil ${ua}: Lead una vez y al menos 800 ms antes de abrir WhatsApp`, nav[0] && lead[0] && `${nav[0].t - lead[0].t} ms tras Lead · ${nav[0].t - t0} ms tras enviar`);
      const contact = rec.filter((x) => x.c[1] === 'Contact');
      ok(contact.length === 1 && contact[0].c[2].content_category === 'gracias-auto' && nav[0] && contact[0].t < nav[0].t, `Móvil ${ua}: Contact "gracias-auto" antes de salir`, JSON.stringify(contact.map((x) => x.c[2])));
      // Volver desde WhatsApp: se ve el gracias y no se reenvía nada
      await p.goBack({ waitUntil: 'load' }).catch(() => {});
      await p.waitForTimeout(2500);
      const back = await p.evaluate(() => ({ url: location.href, done: !!document.querySelector('[data-done]:not([hidden])'), go: document.querySelector('[data-go]') && !document.querySelector('[data-go]').hidden }));
      ok(back.url.startsWith(BASE) && back.done && !back.go && posts().length === 1 && leadsIn(rec).length === 1 && wa.filter((x) => x.main).length === 1, `Móvil ${ua}: al volver se ve el gracias, sin reenviar ni repetir Lead ni volver a abrir WhatsApp`, JSON.stringify({ ...back, posts: posts().length, leads: leadsIn(rec).length }));
      ok(!logs.filter((l) => !/wa\.me/.test(l)).length, `Consola limpia (WhatsApp ${ua})`, logs.join(' / '));
      await ctx.close();
    });
  }

  // ------------------------------------------------------------ 4a'. Móvil: el botón de respaldo cancela la apertura automática
  await block('WhatsApp: botón de respaldo', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, rec, wa } = await open(b, { consent: true, width: 390, height: 844, mobile: true, ua: 'safari' });
    await toForm(p);
    await p.waitForTimeout(3100);
    await fillToEnd(p, { mobile: true, name: 'Irene' });
    await p.tap('[data-submit]');
    await p.waitForSelector('[data-done]:not([hidden])', { timeout: 5000 });
    const [tab] = await Promise.all([ctx.waitForEvent('page'), p.tap('[data-done-wa]')]);
    await p.waitForTimeout(2200);
    const c = rec.filter((x) => x.c[1] === 'Contact').map((x) => x.c[2].content_category);
    ok(tab.url().startsWith('https://wa.me/34616372644') && !wa.some((x) => x.main) && p.url().startsWith(BASE) && c.filter((x) => x === 'gracias-boton').length === 1 && c.filter((x) => x === 'gracias-auto').length <= 1 && leadsIn(rec).length === 1, 'Móvil: tocar "Abrir WhatsApp" abre WhatsApp una sola vez (Contact "gracias-boton") y cancela la apertura automática', c.join());
    await ctx.close();
  });

  // ------------------------------------------------------------ 4a'''. Sin lead parcial: nada sale antes de pulsar Enviar
  await block('Sin lead parcial', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, capi } = await open(b, { consent: true, width: 390, height: 844, mobile: true });
    await toForm(p);
    await p.waitForTimeout(3100);
    await fillToEnd(p, { mobile: true, name: 'Sergio Alba', tel: '622334455' });
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
    await p.waitForTimeout(1200);
    ok(posts().length === 0 && !capi.length && !/sendBeacon|Parcial/.test(fs.readFileSync('assets/js/form.js', 'utf8')), 'Sin lead parcial: con el WhatsApp escrito y la pestaña en segundo plano no se envía nada a la hoja ni a Meta');
    await ctx.close();
  });

  // ------------------------------------------------------------ 4a'''''. Perfil "Otro": profesión escrita a mano, obligatoria
  await block('Perfil Otro', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, logs, wa } = await open(b, { consent: false, width: 390, height: 844, mobile: true });
    await toForm(p);
    await p.waitForTimeout(3100);
    await p.tap('.qf__step.is-active label.opt:has(input[value="Ecógrafo"])'); await p.waitForTimeout(800);
    ok(await p.isHidden('[data-perfil-other]'), 'Perfil Otro: el campo de la profesión está oculto hasta elegir "Otro"');
    await p.tap('.qf__step.is-active label.opt:has(input[value="Otro"])'); await p.waitForTimeout(900);
    const st = await p.evaluate(() => ({ step: document.querySelector('#qf .qf__step.is-active').dataset.step, shown: !document.querySelector('[data-perfil-other]').hidden, focus: document.activeElement.id, label: document.querySelector('label[for="f-perfil-otro"]').textContent.trim(), ph: document.getElementById('f-perfil-otro').placeholder, max: document.getElementById('f-perfil-otro').maxLength }));
    ok(st.step === '2' && st.shown && st.focus === 'f-perfil-otro' && st.label === '¿Cuál es tu profesión?' && st.ph === 'Ej.: osteópata, podólogo' && st.max === 40, 'Perfil Otro: al tocar "Otro" no avanza, se abre "¿Cuál es tu profesión?" con el foco (teclado abierto)', JSON.stringify(st));
    await p.tap('.qf__step.is-active [data-next]'); await p.waitForTimeout(300);
    ok((await step(p)) === '2' && (await p.textContent('#e-perfil-otro')) === 'Escribe tu profesión.' && (await p.getAttribute('#f-perfil-otro', 'aria-invalid')) === 'true', 'Perfil Otro: obligatorio, no deja seguir sin escribirla');
    await p.fill('#f-perfil-otro', 'x'); await p.tap('.qf__step.is-active [data-next]'); await p.waitForTimeout(300);
    ok((await p.textContent('#e-perfil-otro')) === 'Revisa tu profesión.', 'Perfil Otro: al menos 2 letras');
    await p.fill('#f-perfil-otro', '  Osteópata   deportivo ');
    ok((await p.textContent('#e-perfil-otro')) === '', 'Perfil Otro: el error se borra al escribir');
    await p.press('#f-perfil-otro', 'Enter'); await p.waitForTimeout(700);
    ok((await step(p)) === '3', 'Perfil Otro: Enter (o Siguiente) pasa al nombre');
    await p.tap('[data-back]'); await p.waitForTimeout(600);
    ok((await step(p)) === '2' && await p.isVisible('#f-perfil-otro') && (await p.inputValue('#f-perfil-otro')) === '  Osteópata   deportivo ', 'Perfil Otro: al volver se conserva lo escrito');
    await p.tap('.qf__step.is-active label.opt:has(input[value="Médico"])'); await p.waitForTimeout(900);
    ok((await step(p)) === '3' && await p.isHidden('[data-perfil-other]'), 'Perfil Otro: elegir otro perfil esconde el campo y avanza solo, como siempre');
    await p.tap('[data-back]'); await p.waitForTimeout(600);
    await p.tap('.qf__step.is-active label.opt:has(input[value="Otro"])'); await p.waitForTimeout(600);
    await p.tap('.qf__step.is-active [data-next]'); await p.waitForTimeout(700);
    await p.fill('#f-name', 'Rosa Vidal'); await p.press('#f-name', 'Enter'); await p.waitForTimeout(600);
    await p.fill('#f-tel', '622334455');
    await p.tap('[data-submit]');
    await p.waitForURL(/wa\.me/, { timeout: 5000 }).catch(() => {});
    const d = posts()[0] ? JSON.parse(posts()[0].body) : {};
    ok(posts().length === 1 && Object.keys(d).join(',') === SHEET_CONTRACT.join(',') && d.perfil === 'Otro: Osteópata deportivo', 'Perfil Otro: la hoja lo recibe en el mismo campo Perfil ("Otro: Osteópata deportivo"), sin campos nuevos', d.perfil);
    const nav = wa.filter((x) => x.main);
    ok(nav[0] && waMsg(nav[0].url) === 'Hola, soy Rosa Vidal. Acabo de pedir asesoramiento en la web.\nMe interesa: Ecógrafo.\nPerfil: Osteópata deportivo.', 'Perfil Otro: el WhatsApp dice "Perfil: Osteópata deportivo."', nav[0] && waMsg(nav[0].url));
    ok(!logs.filter((l) => !/wa\.me/.test(l)).length, 'Consola limpia (perfil Otro)', logs.join(' / '));
    await ctx.close();
  });

  // ------------------------------------------------------------ 4a''. Prefijo según el idioma del navegador
  await block('Prefijo por idioma', async () => {
    const { ctx, p } = await open(b, { consent: false, locale: 'es-MX' });
    await toForm(p);
    const mx = await p.textContent('.sel--prefix .sel__btn', { timeout: 5000 });
    await ctx.close();
    const { ctx: ctx2, p: p2 } = await open(b, { consent: false, locale: 'en-US' });
    await toForm(p2);
    const es = await p2.textContent('.sel--prefix .sel__btn', { timeout: 5000 });
    await ctx2.close();
    ok(mx.includes('+52') && es.includes('+34'), 'Teléfono: prefijo según el idioma del navegador (es-MX → +52) y +34 si no es español de otro país', `${mx.trim()} · ${es.trim()}`);
  });

  // ------------------------------------------------------------ 4b. Paso 1 ampliado: "Otro equipo" con desplegable propio
  await block('Paso 1: "Otro equipo"', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, logs } = await open(b, { consent: false });
    await toForm(p);
    await p.waitForTimeout(3100);
    const values = await p.$$eval('.qf__step.is-active input[name="equipo"]', (els) => els.map((e) => e.value));
    ok(values.join('|') === 'Ecógrafo|Diatermia|Presoterapia|Ondas de choque|Otro equipo', 'Paso 1: las 5 opciones de siempre (Ecógrafo, Diatermia, Presoterapia, Ondas de choque, Otro equipo)', values.join(', '));
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
    // Con el botón cerca del borde inferior se abre hacia arriba y se ve entero; el ratón resalta la opción
    await p.evaluate(() => { const r = document.querySelector('[data-other] .sel__btn').getBoundingClientRect(); window.scrollBy(0, r.bottom - innerHeight + 60); });
    await p.waitForTimeout(400);
    await p.click('[data-other] .sel__btn');
    await p.waitForTimeout(500);
    const up = await p.evaluate(() => { const root = document.querySelector('[data-other] .sel'); const r = root.querySelector('.sel__panel').getBoundingClientRect(); return { up: root.classList.contains('is-up'), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
    ok(up.up && up.top >= 0 && up.bottom <= up.vh, 'Desplegable: cerca del borde inferior se abre hacia arriba (dropup) y se ve entero', JSON.stringify(up));
    await p.locator('#otro-list .sel__opt').nth(3).hover();
    await p.waitForTimeout(150);
    const hv = await p.evaluate(() => { const o = document.querySelectorAll('#otro-list .sel__opt')[3]; return { active: o.classList.contains('is-active'), bg: getComputedStyle(o).backgroundColor, cursor: getComputedStyle(o).cursor }; });
    ok(hv.active && hv.bg !== 'rgba(0, 0, 0, 0)' && hv.cursor === 'pointer', 'Desplegable: la opción bajo el ratón se resalta', JSON.stringify(hv));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
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
    const wa = waMsg(await p.getAttribute('[data-done-wa]', 'href'));
    ok(wa.includes('\nMe interesa: Láser de alta potencia.\n'), 'Otro equipo: el WhatsApp de éxito nombra el equipo', wa);
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
    ok(d.equipo === 'Presoterapia' && d.modelo === '' && d.perfil === 'Fisioterapeuta', 'Presoterapia: equipo en la hoja y sin modelo', `${d.equipo} · "${d.modelo}" · ${d.perfil}`);
    await ctx.close();
  });

  // ------------------------------------------------------------ 4c. "Prefiero por correo"
  await block('Prefiero por correo', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, logs, wa: waNav } = await open(b, { consent: true, width: 390, height: 844, mobile: true });
    await toForm(p);
    await p.waitForTimeout(3100);
    await p.tap('.qf__step.is-active label.opt:has(input[value="Ecógrafo"])'); await p.waitForTimeout(700);
    await p.tap('.qf__step.is-active label.opt:has(input[value="Médico"])'); await p.waitForTimeout(700);
    await p.fill('#f-name', 'Pablo Ruiz'); await p.press('#f-name', 'Enter'); await p.waitForTimeout(600);
    const sw = await p.evaluate(() => { const l = document.querySelector('.qf__step.is-active [data-switch="email"]'); const r = l.getBoundingClientRect(); const t = document.querySelector('.tel').getBoundingClientRect(); return { txt: l.textContent.trim(), below: r.top >= t.bottom, h: Math.round(r.height), ul: getComputedStyle(l).textDecorationLine }; });
    ok(sw.txt === 'Prefiero por correo' && sw.below && sw.h >= 44 && sw.ul === 'underline', 'Correo: enlace "Prefiero por correo" debajo del WhatsApp', JSON.stringify(sw));
    await p.tap('[data-switch="email"]'); await p.waitForTimeout(600);
    const st = await p.evaluate(() => { const e = document.getElementById('f-email'); return { q: document.querySelector('[data-contact="email"] .qf__q').textContent, telHidden: document.querySelector('[data-contact="tel"]').hidden, focus: document.activeElement.id, count: document.querySelector('[data-count-step]').textContent, lab: document.querySelector('.qf__step.is-active').getAttribute('aria-labelledby'), type: e.type, ac: e.autocomplete, im: e.inputMode, back: document.querySelector('.qf__step.is-active [data-switch="tel"]').textContent.trim() }; });
    ok((await p.textContent('[data-submit]')).trim() === 'Enviar', 'Correo: el botón dice "Enviar"');
    ok(st.q === '¿A qué correo te escribimos?' && st.telHidden && st.focus === 'f-email' && st.count === '4/4' && st.lab === 'q-email' && st.type === 'email' && st.ac === 'email' && st.im === 'email' && st.back === 'Prefiero por WhatsApp', 'Correo: abre la misma pregunta para el correo (4/4), con teclado de correo y foco en el campo', JSON.stringify(st));
    await p.tap('[data-submit]'); await p.waitForTimeout(200);
    ok((await p.textContent('#e-email')) === 'Escribe tu correo.' && (await p.getAttribute('#f-email', 'aria-invalid')) === 'true', 'Correo: obligatorio');
    const bad = [];
    for (const v of ['pablo', 'pablo@', 'pablo@gmail', '@gmail.com', 'pablo..ruiz@gmail.com', '.pablo@gmail.com', 'pablo.@gmail.com', 'pablo@gmail..com', 'pablo@-gmail.com', 'pablo@gmail.c', 'pa(blo@gmail.com', 'pablo@gma_il.com']) {
      await p.fill('#f-email', v); await p.tap('[data-submit]'); await p.waitForTimeout(80);
      if ((await p.textContent('#e-email')) !== 'Revisa el correo: debe ser como nombre@correo.com.') bad.push(v);
    }
    ok(!bad.length && posts().length === 0, 'Correo: formatos incorrectos rechazados (sin arroba, sin dominio, puntos seguidos o en los extremos, extensión corta, caracteres raros)', bad.join(', ') || '12 casos');
    await p.fill('#f-email', '  pablo ruiz@gmail.com ');
    ok((await p.inputValue('#f-email')) === 'pabloruiz@gmail.com' && (await p.textContent('#e-email')) === '', 'Correo: sin espacios, ni al escribir ni al pegar, y el error se borra', await p.inputValue('#f-email'));
    await p.tap('[data-switch="tel"]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !document.querySelector('[data-contact="tel"]').hidden && document.querySelector('[data-contact="email"]').hidden && document.activeElement.id === 'f-tel'), 'Correo: "Prefiero por WhatsApp" vuelve al teléfono');
    await p.tap('[data-switch="email"]'); await p.waitForTimeout(500);
    ok((await p.inputValue('#f-email')) === 'pabloruiz@gmail.com', 'Correo: al volver se conserva lo escrito');
    // Dominio mal escrito: se avisa una vez antes de enviar
    await p.fill('#f-email', 'Pablo@GMIAL.com');
    await p.press('#f-email', 'Enter'); await p.waitForTimeout(300);
    const hint = await p.evaluate(() => ({ shown: !document.querySelector('[data-email-hint]').hidden, txt: document.querySelector('[data-email-hint]').textContent.replace(/\s+/g, ' ').trim(), val: document.getElementById('f-email').value }));
    ok(hint.shown && hint.txt === '¿Querías decir pablo@gmail.com?' && hint.val === 'pablo@gmial.com' && posts().length === 0, 'Correo: pasa a minúsculas y avisa de un dominio mal escrito antes de enviar', JSON.stringify(hint));
    await p.tap('[data-email-fix]'); await p.waitForTimeout(200);
    ok((await p.inputValue('#f-email')) === 'pablo@gmail.com' && await p.isHidden('[data-email-hint]'), 'Correo: un toque corrige el dominio');
    await p.tap('[data-submit]'); await p.waitForTimeout(2600);
    const d = posts()[0] ? JSON.parse(posts()[0].body) : {};
    ok(posts().length === 1 && d.email === 'pablo@gmail.com' && d.telefono === '' && d.perfil === 'Médico' && d.nombre === 'Pablo Ruiz', 'Correo: se envía con el correo y sin teléfono', `${d.email} · "${d.telefono}" · ${d.perfil}`);
    ok(await p.isVisible('[data-done]') && (await p.textContent('[data-done-title]')) === 'Gracias, Pablo. Te escribimos en menos de 24 horas.', 'Correo: "Gracias, Pablo. Te escribimos en menos de 24 horas."');
    ok(p.url().startsWith(BASE) && !waNav.length && await p.isHidden('[data-go]'), 'Correo: no se abre WhatsApp solo', p.url());
    ok((await p.textContent('[data-done-text]')) === '¿Prefieres hablar ya?' && (await p.textContent('[data-done-wa]')).trim() === 'Escríbenos por WhatsApp', 'Correo: ofrece "¿Prefieres hablar ya? Escríbenos por WhatsApp"');
    ok((await fb(p)).filter((c) => c[1] === 'Lead').length === 1, 'Correo: Lead una vez tras el éxito');
    ok(!logs.length, 'Consola limpia (correo)', logs.join(' / '));
    await ctx.close();
  });
  // Un dominio que no se parece a ninguno habitual no molesta
  await block('Correo: dominio propio', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p } = await open(b, { consent: false });
    await toForm(p);
    await p.waitForTimeout(3100);
    await fillToEnd(p, { name: 'Ana' }).catch(() => {});
    await p.click('[data-switch="email"]'); await p.waitForTimeout(400);
    await p.fill('#f-email', 'recepcion@clinica-fisio-ana.es');
    await p.click('[data-submit]'); await p.waitForTimeout(1600);
    const d = posts()[0] ? JSON.parse(posts()[0].body) : {};
    ok(await p.isHidden('[data-email-hint]') && d.email === 'recepcion@clinica-fisio-ana.es', 'Correo: con un dominio propio no hay aviso y se envía a la primera', d.email);
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
    ok(await p.isVisible('[data-fail]') && (await p.inputValue('#f-tel')) === '612 345 678' && (await p.inputValue('#f-name')) === 'Laura Gómez', 'Endpoint vacío: reintento sin perder los datos');
    await ctx.close();
  });

  // ------------------------------------------------------------ 6. Error del servidor
  await block('Error del servidor', async () => {
    fs.writeFileSync(LOG, '');
    const { ctx, p, capi } = await open(b, { consent: true, endpoint: `${MOCK}/exec?mode=fail` });
    await toForm(p);
    await p.waitForTimeout(3100);
    await fillToEnd(p, {});
    await p.click('[data-submit]');
    await p.waitForTimeout(1500);
    ok(posts().length === 1 && await p.isVisible('[data-fail]') && !(await fb(p)).some((c) => c[1] === 'Lead') && !capi.length, 'Error del servidor: aviso, sin gracias y sin Lead (ni por píxel ni por servidor)');
    const failMsg = waMsg(await p.getAttribute('[data-fail-wa]', 'href'));
    ok(failMsg === 'Hola, soy Laura Gómez. He intentado pedir asesoramiento en la web y no se ha enviado.\nMe interesa: Ecógrafo.\nPerfil: Fisioterapeuta.\nMi WhatsApp: +34 612 345 678.', 'Error del servidor: "Escribir por WhatsApp" con todos los datos del formulario', JSON.stringify(failMsg));
    const [tab] = await Promise.all([ctx.waitForEvent('page'), p.click('[data-fail-wa]')]);
    await tab.close();
    const c = (await fb(p)).filter((x) => x[1] === 'Contact');
    ok(c.length === 1 && c[0][2].content_category === 'error-envio', 'Error del servidor: Contact con content_category "error-envio"', JSON.stringify(c));
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
