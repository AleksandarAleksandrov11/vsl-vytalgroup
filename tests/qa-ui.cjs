// QA de interfaz y de las reglas del brief contra dist/ servido con las cabeceras de vercel.json.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 8081}`;
const SITE_URL = 'https://vsl-vytalgroup.vercel.app';
const results = [];
const ok = (cond, name, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  · ${extra}` : ''}`);
async function block(name, fn) {
  try { await fn(); } catch (err) { ok(false, `${name}: error en la prueba`, String(err.message).split('\n')[0]); }
}
const get = (p) => new Promise((resolve, reject) => {
  http.get(BASE + p, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
  }).on('error', reject);
});
const CONSENT = (marketing) => ({ v: 2, date: new Date().toISOString(), necessary: true, marketing });

async function page(b, { width = 1440, height = 900, mobile = false, reduced = false, consent = false, pixel = '' } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((c) => { try { if (c) localStorage.setItem('vg_consent', JSON.stringify(c)); } catch (e) { /* */ } }, consent === null ? null : CONSENT(consent));
  if (pixel) {
    await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.VG_CONFIG={SHEETS_ENDPOINT:"",META_PIXEL_ID:"${pixel}"};` }));
    await ctx.route(/facebook\.(net|com)/, (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.__fbok=1;' }));
  }
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  return { ctx, p, logs };
}
const scrollTo = (p, y) => p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
const scrollToSel = (p, s, off = 0) => p.evaluate(([s, off]) => { const el = document.querySelector(s); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: 'instant' }); }, [s, off]);

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  // ------------------------------------------------------------ minimalismo
  await block('Minimalismo', async () => {
    const { ctx, p, logs } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const s = await p.evaluate(() => ({
      sections: document.querySelectorAll('main > section').length,
      footers: document.querySelectorAll('body > footer').length,
      nav: document.querySelectorAll('nav').length,
      ids: [...document.querySelectorAll('main > section')].map((x) => x.id),
    }));
    ok(s.ids.join(',') === 'inicio,equipos,mas-equipos,por-que,dudas,asesoramiento' && s.footers === 1, 'Estructura: 6 secciones (sin testimonios ni sección de catálogo) y el footer', s.ids.join(', '));
    ok(s.nav === 0, 'Minimalismo: sin menú de navegación');
    // Palabras visibles del contenido: sin cabecera, footer, respuestas del acordeón, formulario ni la línea de confianza
    const words = await p.evaluate(() => {
      // Las descripciones de Más equipos (al pasar o tocar) cuentan como las respuestas del acordeón
      const skip = '.acc__panel, .cat__desc, #qf, .sr-only, .skip, .sprite, #cookie-banner, #cookie-panel, [data-mbar], script, style, [aria-hidden="true"]';
      const out = { main: 0, ticker: 0, chrome: 0 };
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const el = w.currentNode.parentElement;
        if (!el || el.closest(skip)) continue;
        if (!el.checkVisibility({ visibilityProperty: true })) continue;
        const n = w.currentNode.textContent.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
        out[el.closest('.ticker') ? 'ticker' : el.closest('main') ? 'main' : 'chrome'] += n;
      }
      return out;
    });
    ok(words.main <= 260, 'Minimalismo: unas 250 palabras visibles en las secciones (sin acordeón ni formulario)', `${words.main} en secciones · ${words.ticker} en la línea de confianza · ${words.chrome} en cabecera y footer`);
    // Un CTA por sección con el mismo texto; el catálogo es la única excepción
    const perSec = await p.$$eval('main > section:not(#asesoramiento)', (els) => els.map((sec) => `${sec.id}:${[...sec.querySelectorAll('[data-cta], .btn[data-catalog]')].map((a) => a.textContent.trim()).join('+')}`));
    const want = ['inicio:Quiero asesoramiento', 'equipos:Quiero asesoramiento', 'mas-equipos:Quiero asesoramiento+Descargar catálogo', 'por-que:Quiero asesoramiento', 'dudas:Quiero asesoramiento'];
    ok(perSec.join('|') === want.join('|'), 'CTA: "Quiero asesoramiento" en cada sección y "Descargar catálogo" junto a él en Más equipos', perSec.join(' | '));
    const cta = await p.$$eval('[data-cta]', (els) => [...new Set(els.map((e) => e.textContent.trim()))]);
    ok(cta.length === 1 && cta[0] === 'Quiero asesoramiento', 'CTA: texto de asesoramiento idéntico en todas partes (cabecera, secciones y barra móvil)', cta.join(' | '));
    const badges = await p.evaluate(() => [...document.querySelectorAll('[class]')].map((e) => String(e.className.baseVal ?? e.className)).filter((c) => /badge|chip|tag\b|pill|label--|ribbon/.test(c)));
    ok(!badges.length, 'Minimalismo: sin badges, chips ni etiquetas', badges.join(', '));
    const perCard = await p.$$eval('.card', (els) => els.map((c) => c.querySelectorAll('a, button').length));
    ok(perCard.length === 6 && perCard.every((n) => n === 1), 'Lo más pedido: 6 tarjetas (3 por categoría) con un solo botón', perCard.join(','));
    const html = await p.content();
    const gone = ['Ver ficha', 'También te equipamos', 'Cómo trabajamos', 'wa-float', 'Testimonio de ejemplo', 'tsts', 'data-ejemplo', 'Me interesa', 'Habla con Javier', 'No sé cuál elegir', 'ISO 13485', 'FDA', 'veterinari'].filter((x) => html.includes(x));
    ok(!gone.length, 'Contenido: nada de lo eliminado ni prohibido (ISO, FDA, veterinaria)', gone.join(', '));
    const qs = await p.$$eval('.acc__btn', (els) => els.map((e) => e.textContent.trim()));
    ok(qs.length === 5 && qs.includes('¿Solo vendéis ecógrafos y diatermias?'), 'Dudas: 5 preguntas, con "¿Solo vendéis ecógrafos y diatermias?"', qs.join(' · '));
    ok(!logs.length, 'Consola limpia (inicio)', logs.join(' / '));
    await ctx.close();
  });

  // ------------------------------------------------------------ hero en 375 × 667 y cabecera
  await block('Hero y cabecera móvil', async () => {
    const { ctx, p } = await page(b, { width: 375, height: 667, mobile: true });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const c = document.querySelector('.hero__cta').getBoundingClientRect(); const h = document.querySelector('[data-header]').getBoundingClientRect(); const t = document.querySelector('.h1').getBoundingClientRect(); return { cta: c.bottom, head: h.bottom, title: t.top }; });
    ok(r.cta <= 667 && r.title >= r.head, 'Hero: el botón se ve sin hacer scroll en 375 × 667 y la cabecera no tapa el titular', JSON.stringify(r));
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('[data-header]'), '::before').opacity === '0'), 'Cabecera: transparente al inicio');
    await scrollTo(p, 900); await p.waitForTimeout(200);
    await scrollTo(p, 1800); await p.waitForTimeout(700);
    ok(await p.evaluate(() => { const h = document.querySelector('[data-header]'); const r = h.getBoundingClientRect(); return r.top === 0 && r.bottom > 40 && getComputedStyle(h).position === 'fixed' && h.classList.contains('is-scrolled') && getComputedStyle(h, '::before').opacity === '1'; }), 'Cabecera móvil: fija y siempre visible al bajar, con fondo y desenfoque');
    await ctx.close();
  });

  // ------------------------------------------------------------ cabecera escritorio, segmentado, carrusel
  await block('Segmentado y tarjetas', async () => {
    const { ctx, p } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await scrollTo(p, 2000); await p.waitForTimeout(700);
    ok(await p.evaluate(() => { const h = document.querySelector('[data-header]'); return !h.classList.contains('is-hidden') && h.classList.contains('is-scrolled'); }), 'Cabecera escritorio: siempre visible y compacta al bajar');
    await scrollToSel(p, '#equipos'); await p.waitForTimeout(900);
    await p.focus('#tab-eco');
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(900);
    const st = await p.evaluate(() => ({
      sel: document.getElementById('tab-dia').getAttribute('aria-selected'),
      focus: document.activeElement.id,
      dia: getComputedStyle(document.getElementById('panel-dia')).visibility,
      eco: getComputedStyle(document.getElementById('panel-eco')).visibility,
      ind: getComputedStyle(document.querySelector('.seg__ind')).transform,
    }));
    ok(st.sel === 'true' && st.focus === 'tab-dia' && st.dia === 'visible' && st.eco === 'hidden' && st.ind !== 'none', 'Segmentado: teclado (flechas), panel activo e indicador deslizado', JSON.stringify(st));
    await p.keyboard.press('Home');
    await p.waitForTimeout(700);
    ok(await p.evaluate(() => document.getElementById('tab-eco').getAttribute('aria-selected') === 'true' && document.activeElement.id === 'tab-eco'), 'Segmentado: Inicio vuelve a Ecógrafos');
    await p.click('#tab-dia'); await p.waitForTimeout(800);
    const names = await p.$$eval('#panel-dia .card__name', (els) => els.map((e) => e.textContent.trim()));
    ok(names.join('|') === 'Diatermia Multifunción|Reatherm|HR Tek', 'Segmentado: clic muestra las 3 diatermias', names.join(', '));
    const cols = await p.evaluate(() => new Set([...document.querySelectorAll('#panel-dia .card')].map((c) => Math.round(c.getBoundingClientRect().top))).size);
    ok(cols === 1, 'Tarjetas: 3 columnas en escritorio');
    await ctx.close();
  });

  await block('Carrusel móvil', async () => {
    const { ctx, p } = await page(b, { width: 390, height: 844, mobile: true });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await scrollToSel(p, '#equipos'); await p.waitForTimeout(900);
    const r = await p.evaluate(() => { const t = document.querySelector('#panel-eco .cards'); const c = t.children; return { snap: getComputedStyle(t).scrollSnapType, first: Math.round(c[0].getBoundingClientRect().left), firstR: Math.round(c[0].getBoundingClientRect().right), second: Math.round(c[1].getBoundingClientRect().left), vw: innerWidth, dots: getComputedStyle(document.querySelector('#panel-eco .dots')).display }; });
    ok(r.snap.startsWith('x') && r.second >= r.vw && Math.abs(r.first - (r.vw - r.firstR)) <= 2 && r.dots === 'flex', 'Carrusel móvil: una tarjeta cada vez, centrada, sin asomar la siguiente, con puntos', JSON.stringify(r));
    await p.evaluate(() => { const t = document.querySelector('#panel-eco .cards'); t.scrollTo({ left: t.children[2].offsetLeft, behavior: 'instant' }); });
    await p.waitForTimeout(500);
    ok(await p.evaluate(() => [...document.querySelectorAll('#panel-eco .dots span')].findIndex((d) => d.classList.contains('is-on')) === 2), 'Carrusel: los puntos siguen la tarjeta visible');
    await p.evaluate(() => { const t = document.querySelector('#panel-eco .cards'); t.scrollTo({ left: 0, behavior: 'instant' }); });
    await p.waitForTimeout(300);
    await p.focus('#panel-eco .card:nth-child(3) .btn');
    await p.waitForTimeout(600);
    ok(await p.evaluate(() => { const r = document.querySelector('#panel-eco .card:nth-child(3)').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }), 'Carrusel: con teclado, la tarjeta enfocada entra en pantalla');
    await ctx.close();
  });

  // ------------------------------------------------------------ acordeón, conteo, barra móvil y WhatsApp único
  await block('Acordeón', async () => {
    const { ctx, p } = await page(b, { width: 390, height: 844, mobile: true });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await scrollToSel(p, '#dudas', 60); await p.waitForTimeout(900);
    await p.tap('#q1'); await p.waitForTimeout(800);
    ok((await p.getAttribute('#q1', 'aria-expanded')) === 'true' && await p.isVisible('#a1') && (await p.textContent('#a1')).includes('te recomendamos uno'), 'Acordeón: abre al tocar');
    const clean = await p.evaluate(() => [...document.querySelectorAll('.acc__item, .faq__more, #asesoramiento, .ft')].every((e) => !e.style.transform));
    ok(clean, 'Acordeón: la animación solo usa transform y termina limpia');
    await p.focus('#q2'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
    ok((await p.getAttribute('#q2', 'aria-expanded')) === 'true', 'Acordeón: teclado (Enter)');
    await p.keyboard.press('Space'); await p.waitForTimeout(700);
    ok((await p.getAttribute('#q2', 'aria-expanded')) === 'false' && await p.isHidden('#a2'), 'Acordeón: cierra con Espacio');
    const long = await p.$$eval('.acc__panel p', (els) => els.map((e) => e.textContent.split(/(?<=[.?!])\s+/).length));
    ok(long.every((n) => n <= 2), 'Dudas: respuestas de 2 frases como máximo', long.join(','));
    await ctx.close();
  });

  await block('Conteo y barra móvil', async () => {
    const { ctx, p } = await page(b, { width: 390, height: 844, mobile: true });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    ok(!(await p.evaluate(() => document.querySelector('[data-mbar]').classList.contains('is-on'))), 'Barra móvil: oculta en el hero');
    await scrollToSel(p, '#equipos', -200); await p.waitForTimeout(900);
    const on = await p.evaluate(() => { const m = document.querySelector('[data-mbar]'); const r = m.getBoundingClientRect(); return { on: m.classList.contains('is-on'), inert: m.inert, bottom: Math.round(r.bottom), vh: innerHeight, btns: m.querySelectorAll('a').length }; });
    ok(on.on && !on.inert && on.bottom <= on.vh && on.btns === 2, 'Barra móvil: aparece al pasar el hero (CTA + WhatsApp)', JSON.stringify(on));
    await scrollToSel(p, '.why__list', 200); await p.waitForTimeout(1600);
    ok((await p.$$eval('[data-count]', (els) => els.map((e) => e.textContent))).join(',') === '2,0', 'Conteo: 2 años y 0 sorpresas');
    await scrollToSel(p, '[data-faq-wa]', 300); await p.waitForTimeout(700);
    const waVisible = await p.evaluate(() => [...document.querySelectorAll('a[href*="wa.me"]')].filter((a) => { const r = a.getBoundingClientRect(); const s = getComputedStyle(a); return r.width && r.bottom > 0 && r.top < innerHeight && s.display !== 'none' && a.checkVisibility({ visibilityProperty: true }) && !a.closest('[inert]'); }).length);
    ok(waVisible === 1, 'WhatsApp: un solo enlace visible a la vez', `${waVisible} visibles`);
    await scrollToSel(p, '.fcard', 100); await p.waitForTimeout(900);
    ok(!(await p.evaluate(() => document.querySelector('[data-mbar]').classList.contains('is-on'))), 'Barra móvil: se oculta con el formulario en pantalla');
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(900);
    const foot = await p.evaluate(() => { const last = [...document.querySelectorAll('.ft li')].pop().getBoundingClientRect(); const m = document.querySelector('[data-mbar]'); const r = m.getBoundingClientRect(); return { last: Math.round(last.bottom), bar: m.classList.contains('is-on') ? Math.round(r.top) : 99999 }; });
    ok(foot.last <= foot.bar, 'Barra móvil: no tapa el final del footer', JSON.stringify(foot));
    await ctx.close();
  });

  // ------------------------------------------------------------ bloques nuevos de la v3
  await block('Línea de confianza y progreso', async () => {
    const { ctx, p } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const t = await p.evaluate(() => {
      const lists = document.querySelectorAll('.ticker__list');
      const tr = document.querySelector('.ticker__track');
      const hero = document.querySelector('#inicio').getBoundingClientRect();
      const tk = document.querySelector('.ticker').getBoundingClientRect();
      return { halfW: Math.round(tr.scrollWidth / 2), vw: innerWidth, lists: lists.length, dup: lists[1] && lists[1].getAttribute('aria-hidden'), same: lists[0].textContent === lists[1].textContent, anim: getComputedStyle(tr).animationName, inHero: tk.bottom <= hero.bottom + 1, items: [...lists[0].children].map((li) => li.textContent.trim().replace(/\s+/g, ' ')) };
    });
    ok(t.lists === 4 && t.dup === 'true' && t.same && t.anim === 'marquee' && t.inHero && t.halfW >= t.vw, 'Línea de confianza: bajo el hero, en bucle infinito sin huecos (media pista ≥ ancho de pantalla) y con las copias ocultas a lectores', `${t.items.join(' · ')} · media pista ${t.halfW}px`);
    const p0 = await p.evaluate(() => getComputedStyle(document.querySelector('.progress span')).transform);
    await scrollToSel(p, '#por-que'); await p.waitForTimeout(400);
    const p1 = await p.evaluate(() => { const s = document.querySelector('.progress span'); const r = s.getBoundingClientRect(); const hd = document.querySelector('[data-header]'); const h = hd.getBoundingClientRect(); const k = new DOMMatrix(getComputedStyle(hd, '::before').transform).d; return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), head: Math.round(h.top + h.height * k), bg: getComputedStyle(s).backgroundColor }; });
    ok(/matrix\(0,/.test(p0) && p1.w > 200 && p1.h === 2 && Math.abs(p1.top + 2 - p1.head) <= 2, 'Barra de progreso: 2 px en turquesa bajo la cabecera, crece al bajar', JSON.stringify(p1));
    await ctx.close();
  });

  await block('Más equipos', async () => {
    const { ctx, p } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await scrollToSel(p, '#mas-equipos'); await p.waitForTimeout(1400);
    const r = await p.evaluate(() => ({
      names: [...document.querySelectorAll('.cat__name')].map((e) => e.textContent.trim()),
      imgs: [...document.querySelectorAll('.cat img')].filter((i) => i.complete && i.naturalWidth > 0 && i.alt).length,
      cols: new Set([...document.querySelectorAll('.cat')].map((c) => Math.round(c.getBoundingClientRect().top))).size,
      note: document.querySelector('.more__note').textContent.trim(),
    }));
    ok(r.names.join('|') === 'Presoterapia|Ondas de choque|Magnetoterapia de alta intensidad|Láser de alta potencia|Electrólisis percutánea ecoguiada|Camillas de fisioterapia' && r.imgs === 6 && r.cols === 2, 'Más equipos: 6 categorías con imagen y nombre (3 columnas en escritorio)', r.names.join(', '));
    ok(r.note === 'Y más de 50 páginas de equipos en el catálogo.', 'Más equipos: nota del catálogo', r.note);
    const op = () => p.evaluate(() => [...document.querySelectorAll('.cat__desc')].map((d) => getComputedStyle(d).opacity).join(','));
    ok((await op()) === '0,0,0,0,0,0', 'Más equipos: descripción oculta al inicio');
    await p.hover('.cat:nth-child(4) .cat__btn'); await p.waitForTimeout(800);
    const hov = await p.evaluate(() => ({ op: getComputedStyle(document.querySelector('.cat:nth-child(4) .cat__desc')).opacity, scale: getComputedStyle(document.querySelector('.cat:nth-child(4) img')).scale, halo: getComputedStyle(document.querySelector('.cat:nth-child(4) .cat__btn'), '::after').opacity }));
    ok(hov.op === '1' && hov.scale === '1.04' && hov.halo === '1', 'Más equipos: al pasar el ratón, descripción, zoom 1,04 y halo', JSON.stringify(hov));
    await p.mouse.move(5, 5);
    await ctx.close();
    const { ctx: c2, p: m } = await page(b, { width: 390, height: 844, mobile: true });
    await m.goto(BASE + '/', { waitUntil: 'networkidle' });
    await scrollToSel(m, '#mas-equipos'); await m.waitForTimeout(1200);
    const cols = await m.evaluate(() => new Set([...document.querySelectorAll('.cat')].map((c) => Math.round(c.getBoundingClientRect().left))).size);
    await m.tap('.cat:nth-child(2) .cat__btn'); await m.waitForTimeout(700);
    const t1 = await m.evaluate(() => ({ exp: document.querySelector('.cat:nth-child(2) .cat__btn').getAttribute('aria-expanded'), op: getComputedStyle(document.querySelector('.cat:nth-child(2) .cat__desc')).opacity, txt: document.querySelector('.cat:nth-child(2) .cat__desc').textContent.trim() }));
    ok(cols === 2 && t1.exp === 'true' && t1.op === '1', 'Más equipos (móvil): 2 columnas y la descripción aparece al tocar', t1.txt);
    await m.tap('.cat:nth-child(3) .cat__btn'); await m.waitForTimeout(700);
    const t2 = await m.evaluate(() => [...document.querySelectorAll('.cat__btn')].map((x) => x.getAttribute('aria-expanded')).join(','));
    ok(t2 === 'false,false,true,false,false,false', 'Más equipos (móvil): solo una abierta a la vez', t2);
    await m.tap('.cat:nth-child(3) .cat__btn'); await m.waitForTimeout(300);
    ok((await m.getAttribute('.cat:nth-child(3) .cat__btn', 'aria-expanded')) === 'false', 'Más equipos (móvil): se cierra al volver a tocar');
    await c2.close();
  });

  await block('Comparador', async () => {
    const { ctx, p } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const before = await p.evaluate(() => ({ armed: document.querySelector('[data-cmp]').classList.contains('is-armed'), op: getComputedStyle(document.querySelector('.cmp tbody tr')).opacity, dash: getComputedStyle(document.querySelector('.cmp__check')).strokeDashoffset }));
    await scrollToSel(p, '[data-cmp]', 300); await p.waitForTimeout(2200);
    const after = await p.evaluate(() => ({
      rows: [...document.querySelectorAll('.cmp tbody tr')].map((tr) => [...tr.cells].map((c) => c.textContent.trim()).join(' → ')),
      head: [...document.querySelectorAll('.cmp thead th')].map((th) => th.textContent.trim()).join(' | '),
      op: [...document.querySelectorAll('.cmp tbody tr')].map((tr) => getComputedStyle(tr).opacity).join(','),
      dash: [...document.querySelectorAll('.cmp__check')].map((c) => getComputedStyle(c).strokeDashoffset).join(','),
      delays: [...document.querySelectorAll('.cmp tbody tr')].map((tr) => getComputedStyle(tr).transitionDelay.split(',')[0]).join(','),
    }));
    ok(after.head === 'Lo habitual | Con VytalGroup' && after.rows.length === 3, 'Comparador: 3 filas "Lo habitual" frente a "Con VytalGroup"', after.rows.join(' · '));
    ok(before.armed && before.op === '0' && before.dash === '24px' && after.op === '1,1,1' && after.dash === '0px,0px,0px' && after.delays === '0s,0.22s,0.44s', 'Comparador: filas una a una y checks dibujados con stroke-dashoffset', JSON.stringify({ before, op: after.op, dash: after.dash, delays: after.delays }));
    await ctx.close();
  });

  await block('Hero: escaparate', async () => {
    const { ctx, p, logs } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(2600);
    const r = await p.evaluate(() => {
      const img = document.querySelector('.stage__img');
      const pre = document.querySelector('link[rel="preload"][as="image"]');
      const hero = getComputedStyle(document.querySelector('#inicio'));
      return {
        alt: img.alt, prio: img.getAttribute('fetchpriority'), loaded: img.complete && img.naturalWidth > 0,
        preload: !!pre && /hero-vytamed/.test(pre.getAttribute('imagesrcset')),
        dark: /rgb\(1[0-9], 2[0-9], 4[0-9]\)|gradient/.test(hero.backgroundImage + hero.backgroundColor),
        h1: getComputedStyle(document.querySelector('.h1')).color,
        waves: [...document.querySelectorAll('.stage__wave')].map((w) => getComputedStyle(w).animationName).join(','),
        waveHidden: [...document.querySelectorAll('.stage__wave')].every((w) => w.getAttribute('aria-hidden') === 'true'),
        float: getComputedStyle(document.querySelector('.stage__device')).animationName,
        logo: getComputedStyle(document.querySelector('.hd .logo')).getPropertyValue('--logo-a').trim(),
        media: [...document.querySelectorAll('video, .reel')].length,
      };
    });
    ok(r.alt && r.prio === 'high' && r.loaded && r.preload, 'Hero: la diatermia es la imagen principal, precargada (LCP)', r.alt);
    ok(r.dark && r.h1 === 'rgb(255, 255, 255)' && r.logo.toUpperCase() === '#FFF', 'Hero: fondo oscuro, titular y logo de cabecera en blanco', JSON.stringify({ h1: r.h1, logo: r.logo }));
    ok(r.waves === 'wave,wave,wave' && r.waveHidden && r.float === 'floaty', 'Hero: ondas tipo ecografía en bucle y equipo flotando (decorativo, oculto a lectores)', `${r.waves} · ${r.float}`);
    ok(r.media === 0, 'Hero: sin fotos ni vídeos de clientes');
    await p.mouse.move(1300, 300, { steps: 4 }); await p.waitForTimeout(300);
    const sx = await p.evaluate(() => parseFloat(document.querySelector('[data-stage]').style.getPropertyValue('--sx')));
    ok(sx > 0.2, 'Hero: el equipo sigue un poco al cursor en escritorio', String(sx));
    ok(!logs.length, 'Hero: consola limpia', logs.join(' / '));
    await ctx.close();
  });

  // Mismo sistema en todos los dispositivos: titulares y CTA de sección centrados
  await block('Alineación', async () => {
    for (const [w, h, m] of [[390, 844, true], [1440, 900, false]]) {
      const { ctx, p } = await page(b, { width: w, height: h, mobile: m });
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      const r = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const off = (el) => { const b = el.getBoundingClientRect(); return Math.round(Math.abs((b.left + b.right) / 2 - vw / 2)); };
        const heads = [...document.querySelectorAll('main > section:not(#inicio) h2')].map((h) => [h.id, getComputedStyle(h).textAlign, off(h)]);
        const ctas = [...document.querySelectorAll('main > section:not(#inicio) .sec__cta, .why__foot')].map((c) => [c.closest('section').id, off(c)]);
        const hero = getComputedStyle(document.querySelector('.hero__copy')).textAlign;
        return { heads, ctas, hero };
      });
      const badH = r.heads.filter(([, ta, o]) => ta !== 'center' || o > 2);
      const badC = r.ctas.filter(([, o]) => o > 2);
      ok(!badH.length && !badC.length && r.hero === (m ? 'center' : 'start'), `Alineación ${w}px: titulares y CTA de sección centrados${m ? ', hero centrado' : ', hero a la izquierda'}`, JSON.stringify({ badH, badC, hero: r.hero }));
      await ctx.close();
    }
  });

  await block('Catálogo', async () => {
    const { ctx, p } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => {
      const a = document.querySelector('#mas-equipos .btn[data-catalog]');
      const cta = document.querySelector('#mas-equipos [data-cta]');
      const s = getComputedStyle(a);
      return { dl: a.hasAttribute('download'), href: a.getAttribute('href'), txt: a.textContent.trim(), bg: s.backgroundColor, color: s.color, sameRow: Math.abs(a.getBoundingClientRect().top - cta.getBoundingClientRect().top) < 2, hero: document.querySelector('.hero__more').getAttribute('href'), foot: !!document.querySelector('.ft a[href$="catalogo-vytalgroup-2026.pdf"]') };
    });
    ok(r.dl && /catalogo-vytalgroup-2026\.pdf$/.test(r.href) && r.txt === 'Descargar catálogo' && r.bg === 'rgb(11, 25, 41)' && r.color === 'rgb(255, 255, 255)' && r.sameRow, 'Catálogo: botón oscuro "Descargar catálogo" junto al CTA en Más equipos (descarga directa)', JSON.stringify(r));
    ok(r.hero === '#mas-equipos' && r.foot && !(await p.$('#catalogo')), 'Catálogo: sin sección propia; "Ver catálogo" lleva a Más equipos y el PDF sigue en el footer', r.hero);
    await ctx.close();
  });

  // ------------------------------------------------------------ fuentes, teclado y movimiento reducido
  await block('Fuentes', async () => {
    const { ctx, p } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const f = await p.evaluate(async () => { await document.fonts.ready; return { geist: document.fonts.check('560 32px Geist'), serif: document.fonts.check('italic 32px "Instrument Serif"'), h1: getComputedStyle(document.querySelector('.h1')).fontFamily, em: getComputedStyle(document.querySelector('.h1 em')).fontFamily, loaded: [...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family) }; });
    ok(f.geist && f.serif && f.h1.startsWith('Geist') && f.em.startsWith('"Instrument Serif"'), 'Fuentes: Geist e Instrument Serif cargadas', f.loaded.join(', '));
    const dist = path.resolve('dist');
    const textFiles = [];
    const walk = (d) => fs.readdirSync(d).forEach((n) => { const x = path.join(d, n); if (fs.statSync(x).isDirectory()) walk(x); else if (/\.(html|css|js|webmanifest)$/.test(n)) textFiles.push(x); });
    walk(dist);
    const trace = textFiles.filter((x) => /["'](Syne|Inter)["' ,]|family:\s*(Syne|Inter)\b|syne-|inter-\d/i.test(fs.readFileSync(x, 'utf8')));
    ok(!trace.length && !fs.readdirSync(path.join(dist, 'assets/fonts')).some((n) => /syne|inter/i.test(n)), 'Fuentes: ni rastro de Syne o Inter', trace.join(', '));
    // Teclado: salto al contenido, logo y CTA de la cabecera con foco visible
    await p.keyboard.press('Tab');
    await p.waitForTimeout(400);
    const f1 = await p.evaluate(() => ({ cls: document.activeElement.className, t: getComputedStyle(document.activeElement).transform }));
    await p.keyboard.press('Tab');
    await p.keyboard.press('Tab');
    const f3 = await p.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return { txt: a.textContent.trim(), outline: s.outlineStyle, w: s.outlineWidth }; });
    ok(f1.cls === 'skip' && f1.t === 'none' && f3.txt === 'Quiero asesoramiento' && f3.outline !== 'none', 'Teclado: salto al contenido, cabecera y foco visible', JSON.stringify([f1, f3]));
    await ctx.close();
  });

  await block('Movimiento reducido', async () => {
    const { ctx, p } = await page(b, { reduced: true });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({
      word: getComputedStyle(document.querySelector('.h1 .w > span')).transform,
      deal: [...document.querySelectorAll('.stage, .stage__device, .stage__wave, .stage__glow')].map((e) => getComputedStyle(e).animationName).filter((n) => n !== 'none').join(',') || 'none',
      rv: document.querySelectorAll('.rv').length,
      smooth: getComputedStyle(document.documentElement).scrollBehavior,
      marquee: [...document.querySelectorAll('.ticker__track')].map((t) => getComputedStyle(t).animationName).join(','),
      dups: [...document.querySelectorAll('.ticker__list[aria-hidden]')].every((l) => getComputedStyle(l).display === 'none'),
      split: document.querySelectorAll('[data-lines].is-split, .rvi, .cmp.is-armed').length,
      count: [...document.querySelectorAll('[data-count]')].map((e) => e.textContent).join(','),
    }));
    ok(r.word === 'none' && r.deal === 'none' && r.rv === 0 && r.split === 0 && r.smooth === 'auto', 'Movimiento reducido: sin animaciones de entrada ni desplazamiento suave', JSON.stringify(r));
    ok(r.marquee === 'none' && r.dups && r.count === '2,0', 'Movimiento reducido: línea de confianza quieta (sin copias) y cifras finales sin conteo', `${r.marquee} · ${r.count}`);
    await scrollToSel(p, '#por-que'); await p.waitForTimeout(400);
    await p.mouse.move(700, 400, { steps: 3 }); await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({ py: [...document.querySelectorAll('[data-parallax]')].some((i) => i.style.getPropertyValue('--py')) }));
    ok(!st.py, 'Movimiento reducido: sin parallax', JSON.stringify(st));
    const { ctx: c2, p: p2 } = await page(b, {});
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    const anim = await p2.evaluate(() => ({ deal: getComputedStyle(document.querySelector('.stage')).animationName, kb: getComputedStyle(document.querySelector('.stage__glow')).animationName, word: getComputedStyle(document.querySelector('.h1 .w > span')).animationName, rv: document.querySelectorAll('.rv').length, lines: document.querySelectorAll('[data-lines].is-split').length, rvi: document.querySelectorAll('.rvi').length }));
    ok(anim.deal === 'stage-in' && anim.kb === 'glow' && anim.word === 'word-up' && anim.rv > 5 && anim.lines >= 5 && anim.rvi >= 6, 'Animaciones: entrada del escaparate con halo que respira, titular por palabras, titulares por líneas y entradas al hacer scroll', JSON.stringify(anim));
    await scrollToSel(p2, '.why__photo', 100); await p2.waitForTimeout(400);
    const w = await p2.evaluate(() => ({ py: document.querySelector('.why__photo img').style.getPropertyValue('--py'), lines: new Set([...document.querySelectorAll('#por-que [data-lines] .w')].map((x) => x.style.getPropertyValue('--i'))).size, magnetic: document.querySelectorAll('[data-magnetic]').length }));
    ok(w.py && w.py !== '0.0px' && w.lines >= 1 && w.magnetic >= 6, 'Animaciones: parallax leve en escritorio y botones magnéticos', JSON.stringify(w));
    await c2.close();
    await ctx.close();
  });

  // ------------------------------------------------------------ CSP, cabeceras, URLs limpias y metadatos
  await block('CSP en consola', async () => {
    const { ctx, p, logs } = await page(b, { consent: true, pixel: '1234567890' });
    for (const u of ['/', '/aviso-legal', '/privacidad', '/cookies']) {
      await p.goto(BASE + u, { waitUntil: 'networkidle' });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
    }
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    ok(await p.evaluate(() => window.__fbok === 1), 'CSP: el píxel (con consentimiento) carga desde connect.facebook.net');
    const csp = logs.filter((l) => /Content Security Policy|Refused to/i.test(l));
    ok(!csp.length && !logs.length, 'CSP: cero errores en consola (landing, legales, fuentes, imágenes y píxel)', logs.join(' / '));
    await ctx.close();
  });

  await block('Cabeceras y URLs', async () => {
    const home = await get('/');
    const h = home.headers;
    ok(home.status === 200 && /default-src 'self'/.test(h['content-security-policy'] || '') && h['strict-transport-security'] && h['x-frame-options'] === 'SAMEORIGIN' && h['x-content-type-options'] === 'nosniff' && h['permissions-policy'], 'Cabeceras: seguridad y CSP de vercel.json');
    ok(/max-age=0, must-revalidate/.test(h['cache-control']), 'Caché: HTML sin caché (must-revalidate)', h['cache-control']);
    const html = home.body.toString();
    const img = html.match(/\/assets\/img\/[\w-]+\.[a-f0-9]{8}\.avif/)[0];
    const font = html.match(/\/assets\/fonts\/geist\.[a-f0-9]{8}\.woff2/)[0];
    const js = html.match(/\/assets\/js\/main\.[\w]+\.js/)[0];
    const hs = await Promise.all([img, font, js].map(get));
    ok(hs.every((r) => r.status === 200 && r.headers['cache-control'] === 'public, max-age=31536000, immutable'), 'Caché: /assets con hash, un año e immutable', [img, font, js].join(', '));
    const pdf = await get('/assets/docs/catalogo-vytalgroup-2026.pdf');
    ok(pdf.status === 200 && /attachment/.test(pdf.headers['content-disposition']) && pdf.headers['cache-control'] === 'public, max-age=604800' && pdf.body.slice(0, 5).toString() === '%PDF-', 'PDF: se descarga (attachment) con caché de 7 días', `${(pdf.body.length / 1024).toFixed(0)} KB`);
    const clean = await Promise.all(['/aviso-legal', '/privacidad', '/cookies'].map(get));
    ok(clean.every((r) => r.status === 200 && r.body.toString().includes('<h1')), 'URLs limpias: /aviso-legal, /privacidad y /cookies');
    const red = await Promise.all(['/privacidad.html', '/cookies/', '/index', '/index.html'].map(get));
    ok(red.map((r) => `${r.status} ${r.headers.location}`).join(' | ') === '308 /privacidad | 308 /cookies | 308 / | 308 /', 'URLs limpias: redirecciones .html, barra final e /index', red.map((r) => `${r.status} ${r.headers.location}`).join(' | '));
    const cfg = await get('/config.js');
    ok(/must-revalidate/.test(cfg.headers['cache-control']) && /SHEETS_ENDPOINT: ""/.test(cfg.body.toString()) && /META_PIXEL_ID: ""/.test(cfg.body.toString()), 'config.js: sin caché y con los dos valores vacíos');
    const vj = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    ok(vj.cleanUrls === true && vj.trailingSlash === false && vj.outputDirectory === 'dist', 'vercel.json: JSON válido, URLs limpias y salida dist/');
  });

  await block('Metadatos', async () => {
    const html = (await get('/')).body.toString();
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    const ogUrl = (html.match(/property="og:url" content="([^"]+)"/) || [])[1];
    const ogImg = (html.match(/property="og:image" content="([^"]+)"/) || [])[1];
    ok(canonical === `${SITE_URL}/` && ogUrl === `${SITE_URL}/`, 'Metadatos: canonical y og:url con SITE_URL', canonical);
    ok(ogImg && ogImg.startsWith(`${SITE_URL}/assets/brand/og-image.`), 'Metadatos: og:image absoluta con SITE_URL', ogImg);
    const local = await get(ogImg.replace(SITE_URL, ''));
    const jpg = local.body;
    const size = (() => { let i = 2; while (i < jpg.length) { const m = jpg[i + 1]; const len = jpg.readUInt16BE(i + 2); if (m >= 0xC0 && m <= 0xC2) return [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]; i += 2 + len; } return []; })();
    ok(local.status === 200 && size.join('x') === '1200x630', 'Metadatos: la imagen OG existe y mide 1200 × 630', size.join('x'));
    const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
    const desc = (html.match(/name="description" content="([^"]+)"/) || [])[1];
    // El title es el que propone el brief v3 (65 caracteres, cabe en el ancho de Google)
    ok(title && title.length <= 70 && desc && desc.length <= 160, 'Metadatos: title y description cortos', `${title} (${title.length}) · ${desc.length}`);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const faq = ld['@graph'].find((x) => x['@type'] === 'FAQPage');
    const org = ld['@graph'].find((x) => x['@type'] === 'Organization');
    ok(org && org.url === `${SITE_URL}/` && faq && faq.mainEntity.length === 5, 'Metadatos: JSON-LD Organization y FAQPage con 5 preguntas');
    const sitemap = (await get('/sitemap.xml')).body.toString();
    const robots = (await get('/robots.txt')).body.toString();
    ok(sitemap.includes(`<loc>${SITE_URL}/</loc>`) && sitemap.includes(`${SITE_URL}/privacidad`) && robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`), 'Metadatos: sitemap y robots con SITE_URL');
  });

  await block('Legales', async () => {
    const { ctx, p, logs } = await page(b, { width: 390, height: 844, mobile: true, consent: null });
    await p.goto(BASE + '/privacidad', { waitUntil: 'networkidle' });
    await p.waitForTimeout(900);
    ok(await p.isVisible('#cookie-banner'), 'Legales: aviso de cookies también en las páginas legales');
    await p.click('#cookie-banner [data-cookie="reject"]');
    await p.waitForTimeout(700);
    const pending = await p.$$eval('.pending', (els) => els.length);
    ok(pending >= 4, 'Legales: datos del titular vacíos y marcados para rellenar', `${pending} huecos`);
    await p.evaluate(() => document.querySelector('.ft [data-cookie-settings]').scrollIntoView());
    await p.click('.ft [data-cookie-settings]');
    await p.waitForTimeout(500);
    const sheet = await p.evaluate(() => { const d = document.getElementById('cookie-panel'); const r = d.querySelector('.cp__in').getBoundingClientRect(); return { open: d.open, bottom: Math.round(r.bottom), vh: innerHeight }; });
    ok(sheet.open && Math.abs(sheet.bottom - sheet.vh) <= 1, 'Legales: "Configurar cookies" abre el panel (hoja inferior en móvil)', JSON.stringify(sheet));
    await p.keyboard.press('Escape');
    ok(!logs.length, 'Legales: consola limpia', logs.join(' / '));
    await ctx.close();
  });

  await b.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} OK`);
  process.exit(fails ? 1 : 0);
})();
