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
    ok(s.ids.join(',') === 'inicio,equipos,mas-equipos,por-que,catalogo,dudas,asesoramiento' && s.footers === 1, 'Estructura: las 7 secciones del brief (sin testimonios) y el footer', s.ids.join(', '));
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
    const want = ['inicio:Quiero asesoramiento', 'equipos:Quiero asesoramiento', 'mas-equipos:Quiero asesoramiento', 'por-que:Quiero asesoramiento', 'catalogo:Descargar catálogo', 'dudas:Quiero asesoramiento'];
    ok(perSec.join('|') === want.join('|'), 'CTA: uno por sección, "Quiero asesoramiento" en todas y "Descargar catálogo" en el catálogo', perSec.join(' | '));
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
    await scrollTo(p, 1200); await p.waitForTimeout(700);
    ok(await p.evaluate(() => document.querySelector('[data-header]').classList.contains('is-hidden') && document.querySelector('[data-header]').getBoundingClientRect().bottom <= 1), 'Cabecera móvil: se oculta al bajar');
    await scrollTo(p, 1000); await p.waitForTimeout(700);
    ok(await p.evaluate(() => { const h = document.querySelector('[data-header]'); return !h.classList.contains('is-hidden') && h.classList.contains('is-scrolled') && getComputedStyle(h, '::before').opacity === '1'; }), 'Cabecera móvil: reaparece al subir, con fondo y desenfoque');
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
    const r = await p.evaluate(() => { const t = document.querySelector('#panel-eco .cards'); const c = t.children; return { snap: getComputedStyle(t).scrollSnapType, second: Math.round(c[1].getBoundingClientRect().left), vw: innerWidth, dots: getComputedStyle(document.querySelector('#panel-eco .dots')).display }; });
    ok(r.snap.startsWith('x') && r.second < r.vw && r.dots === 'flex', 'Carrusel: scroll-snap, asoma la siguiente tarjeta y puntos visibles', JSON.stringify(r));
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
    ok((await p.getAttribute('#q1', 'aria-expanded')) === 'true' && await p.isVisible('#a1') && (await p.textContent('#a1')).includes('te recomiendo uno'), 'Acordeón: abre al tocar');
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
    ok((await p.$$eval('[data-count]', (els) => els.map((e) => e.textContent))).join(',') === '2,0,1', 'Conteo: 2 años, 0 sorpresas, 1 fisio');
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
      return { lists: lists.length, dup: lists[1] && lists[1].getAttribute('aria-hidden'), same: lists[0].textContent === lists[1].textContent, anim: getComputedStyle(tr).animationName, inHero: tk.bottom <= hero.bottom + 1, items: [...lists[0].children].map((li) => li.textContent.trim().replace(/\s+/g, ' ')) };
    });
    ok(t.lists === 2 && t.dup === 'true' && t.same && t.anim === 'marquee' && t.inHero, 'Línea de confianza: bajo el hero, en bucle y con la copia oculta a lectores', t.items.join(' · '));
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

  await block('Hero: tarjeta Clientes', async () => {
    const { ctx, p, logs } = await page(b, {});
    const media = [];
    let loaded = 0;
    p.on('request', (r) => { if (/\.(mp4|webm)$/.test(r.url())) media.push({ url: r.url().split('/').pop(), afterLoad: loaded > 0 }); });
    p.on('load', () => { loaded = Date.now(); });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const first = await p.evaluate(() => {
      const img = document.querySelector('.reel__card .reel__img');
      const pre = document.querySelector('link[rel="preload"][as="image"]');
      return { cards: document.querySelectorAll('.reel__card').length, alt: img.alt, prio: img.getAttribute('fetchpriority'), preload: !!pre && /cliente-diatermia/.test(pre.getAttribute('imagesrcset')), caps: [...document.querySelectorAll('.reel__cap')].map((c) => c.textContent.trim()), head: document.querySelector('.reel__head').textContent.trim().replace(/\s+/g, ' ') };
    });
    ok(first.cards === 3 && first.alt && first.prio === 'high' && first.preload, 'Hero: tarjeta "Clientes" con 3 fotos reales y la primera precargada (LCP)', first.caps.join(' · '));
    await p.waitForFunction(() => document.querySelector('.reel__card').classList.contains('is-playing'), null, { timeout: 12000 });
    const v = await p.evaluate(() => { const x = document.querySelector('.reel__video'); return { muted: x.muted, inline: x.playsInline, paused: x.paused, t: x.currentTime, src: x.currentSrc.split('/').pop(), hidden: x.getAttribute('aria-hidden'), bar: parseFloat(document.querySelector('.reel__bars i').style.getPropertyValue('--t')) }; });
    ok(v.muted && v.inline && !v.paused && v.hidden === 'true' && /^cliente-diatermia\.[a-f0-9]{8}\.webm$/.test(v.src), 'Hero: el vídeo real se reproduce en silencio dentro de la tarjeta (WebM con hash)', JSON.stringify(v));
    ok(media.length >= 1 && media.every((m) => m.afterLoad), 'Hero: el vídeo se pide después del evento load (no retrasa la carga)', media.map((m) => m.url).join(', '));
    await p.waitForTimeout(600);
    const bar = await p.evaluate(() => parseFloat(document.querySelector('.reel__bars i').style.getPropertyValue('--t')));
    ok(bar > v.bar, 'Hero: la barra de la historia avanza con el vídeo', `${v.bar.toFixed(3)} → ${bar.toFixed(3)}`);
    // Pausa (WCAG 2.2.2)
    await p.click('[data-reel-toggle]');
    await p.waitForTimeout(300);
    const pz = await p.evaluate(() => ({ label: document.querySelector('[data-reel-toggle]').getAttribute('aria-label'), paused: document.querySelector('.reel__video').paused, cls: document.querySelector('[data-reel]').classList.contains('is-paused'), t: document.querySelector('.reel__bars i').style.getPropertyValue('--t') }));
    await p.waitForTimeout(700);
    const t2 = await p.evaluate(() => document.querySelector('.reel__bars i').style.getPropertyValue('--t'));
    ok(pz.label === 'Reproducir' && pz.paused && pz.cls && pz.t === t2, 'Hero: el botón pausa el vídeo y la historia', JSON.stringify(pz));
    await p.click('[data-reel-toggle]');
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.querySelector('[data-reel-toggle]').getAttribute('aria-label') === 'Pausar' && !document.querySelector('.reel__video').paused), 'Hero: y la reanuda');
    // Pasar tocando los lados
    await p.mouse.move(5, 5);
    await p.evaluate(() => document.querySelector('[data-reel-next]').click());
    await p.waitForTimeout(900);
    const n1 = await p.evaluate(() => ({ front: [...document.querySelectorAll('.reel__card')].findIndex((c) => c.classList.contains('is-front')), ps: [...document.querySelectorAll('.reel__card')].map((c) => c.style.getPropertyValue('--p')).join(','), vpaused: document.querySelector('.reel__video').paused, bars: [...document.querySelectorAll('.reel__bars i')].map((i) => Number(i.style.getPropertyValue('--t')) > 0.999 ? 1 : 0).join(',') }));
    ok(n1.front === 1 && n1.ps === '2,0,1' && n1.vpaused && n1.bars.startsWith('1,0'), 'Hero: "Siguiente" pasa a la segunda tarjeta y pausa el vídeo', JSON.stringify(n1));
    await p.evaluate(() => document.querySelector('[data-reel-prev]').click());
    await p.waitForTimeout(900);
    const n0 = await p.evaluate(() => ({ front: [...document.querySelectorAll('.reel__card')].findIndex((c) => c.classList.contains('is-front')), vpaused: document.querySelector('.reel__video').paused }));
    ok(n0.front === 0 && !n0.vpaused, 'Hero: "Anterior" vuelve al vídeo y lo reanuda', JSON.stringify(n0));
    // Avance automático de las fotos (5 s)
    await p.evaluate(() => document.querySelector('[data-reel-next]').click());
    await p.waitForTimeout(5800);
    ok(await p.evaluate(() => document.querySelectorAll('.reel__card')[2].classList.contains('is-front')), 'Hero: las fotos avanzan solas cada 5 s');
    // Fuera de pantalla se pausa
    await scrollToSel(p, '#por-que'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.querySelector('[data-reel]').classList.contains('is-paused')), 'Hero: la historia se pausa fuera de pantalla');
    ok(!logs.length, 'Hero: consola limpia', logs.join(' / '));
    await ctx.close();
    // Ahorro de datos: no se descarga el vídeo
    const { ctx: c2, p: p2 } = await page(b, { width: 390, height: 844, mobile: true });
    await c2.addInitScript(() => { Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '4g' } }); });
    const media2 = [];
    p2.on('request', (r) => { if (/\.(mp4|webm)$/.test(r.url())) media2.push(r.url()); });
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(3500);
    ok(!media2.length && await p2.evaluate(() => !document.querySelector('.reel__video').getAttribute('src')), 'Hero: con ahorro de datos no se descarga el vídeo (se ve la foto)');
    await c2.close();
  });

  await block('Catálogo', async () => {
    const { ctx, p } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    ok(!(await p.evaluate(() => document.querySelector('[data-book]').classList.contains('is-open'))), 'Catálogo: la maqueta empieza cerrada');
    await scrollToSel(p, '#catalogo'); await p.waitForTimeout(1800);
    const r = await p.evaluate(() => {
      const a = document.querySelector('#catalogo .btn[data-catalog]');
      const tf = (s) => getComputedStyle(document.querySelector(s)).transform;
      return { open: document.querySelector('[data-book]').classList.contains('is-open'), cover: tf('.book__cover'), p3: tf('.book__page--3'), imgs: [...document.querySelectorAll('.book img')].filter((i) => i.complete && i.naturalWidth).length, meta: document.querySelector('.catalog__meta').textContent.trim(), dl: a.hasAttribute('download'), href: a.getAttribute('href'), txt: a.textContent.trim(), alt: document.querySelector('.catalog__actions .link').textContent.trim() };
    });
    ok(r.open && r.cover !== 'none' && r.p3 !== r.cover && r.imgs === 3, 'Catálogo: la maqueta se abre en abanico al entrar', `${r.cover} / ${r.p3}`);
    ok(r.meta === 'PDF · 53 páginas · Descarga directa' && r.dl && /catalogo-vytalgroup-2026\.pdf$/.test(r.href) && r.txt === 'Descargar catálogo' && r.alt === '¿Prefieres que te asesore?', 'Catálogo: datos del PDF, "Descargar catálogo" (descarga directa) y "¿Prefieres que te asesore?"', JSON.stringify({ meta: r.meta, href: r.href }));
    const box = await p.evaluate(() => { const r = document.querySelector('[data-book]').getBoundingClientRect(); return { x: r.left + r.width * 0.9, y: r.top + r.height * 0.2 }; });
    await p.mouse.move(box.x, box.y, { steps: 4 }); await p.waitForTimeout(500);
    const tilt = await p.evaluate(() => { const s = document.querySelector('.book__stack'); return { rx: s.style.getPropertyValue('--rx'), ry: s.style.getPropertyValue('--ry'), on: document.querySelector('[data-book]').classList.contains('is-tilting') }; });
    ok(tilt.on && parseFloat(tilt.ry) !== 0 && parseFloat(tilt.rx) !== 0, 'Catálogo: inclinación con el cursor (escritorio)', JSON.stringify(tilt));
    await ctx.close();
    const { ctx: c2, p: m } = await page(b, { width: 390, height: 844, mobile: true });
    await m.goto(BASE + '/', { waitUntil: 'networkidle' });
    await scrollToSel(m, '[data-cmp]', 200); await m.waitForTimeout(700);
    const onBefore = await m.evaluate(() => document.querySelector('[data-mbar]').classList.contains('is-on'));
    await scrollToSel(m, '#catalogo .btn[data-catalog]', 400); await m.waitForTimeout(700);
    const onCat = await m.evaluate(() => document.querySelector('[data-mbar]').classList.contains('is-on'));
    ok(onBefore && !onCat, 'Barra móvil: se oculta en el catálogo', JSON.stringify({ onBefore, onCat }));
    await c2.close();
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
      deal: getComputedStyle(document.querySelector('.reel__card')).animationName,
      rv: document.querySelectorAll('.rv').length,
      smooth: getComputedStyle(document.documentElement).scrollBehavior,
      marquee: [...document.querySelectorAll('.ticker__track')].map((t) => getComputedStyle(t).animationName).join(','),
      dups: [...document.querySelectorAll('.ticker__list[aria-hidden]')].every((l) => getComputedStyle(l).display === 'none'),
      reel: { paused: document.querySelector('[data-reel]').classList.contains('is-paused'), label: document.querySelector('[data-reel-toggle]').getAttribute('aria-label'), src: document.querySelector('.reel__video').getAttribute('src') },
      split: document.querySelectorAll('[data-lines].is-split, .rvi, .cmp.is-armed').length,
      count: [...document.querySelectorAll('[data-count]')].map((e) => e.textContent).join(','),
    }));
    ok(r.word === 'none' && r.deal === 'none' && r.rv === 0 && r.split === 0 && r.smooth === 'auto', 'Movimiento reducido: sin animaciones de entrada ni desplazamiento suave', JSON.stringify(r));
    ok(r.marquee === 'none' && r.dups && r.count === '2,0,1', 'Movimiento reducido: línea de confianza quieta (sin copia) y cifras finales sin conteo', `${r.marquee} · ${r.count}`);
    ok(r.reel.paused && r.reel.label === 'Reproducir' && !r.reel.src, 'Movimiento reducido: la tarjeta Clientes empieza en pausa y sin vídeo (se puede reproducir con el botón)', JSON.stringify(r.reel));
    await scrollToSel(p, '#catalogo'); await p.waitForTimeout(400);
    await p.mouse.move(700, 400, { steps: 3 }); await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({ open: document.querySelector('[data-book]').classList.contains('is-open'), tilt: document.querySelector('.book__stack').style.getPropertyValue('--ry'), py: [...document.querySelectorAll('[data-parallax]')].some((i) => i.style.getPropertyValue('--py')), tr: getComputedStyle(document.querySelector('.book__cover')).transitionProperty }));
    ok(st.open && !st.tilt && !st.py && !/transform/.test(st.tr), 'Movimiento reducido: maqueta ya abierta, sin inclinación ni parallax', JSON.stringify(st));
    const { ctx: c2, p: p2 } = await page(b, {});
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    const anim = await p2.evaluate(() => ({ deal: getComputedStyle(document.querySelector('.reel__card')).animationName, kb: getComputedStyle(document.querySelector('.reel__card.is-front .reel__img')).animationName, word: getComputedStyle(document.querySelector('.h1 .w > span')).animationName, rv: document.querySelectorAll('.rv').length, lines: document.querySelectorAll('[data-lines].is-split').length, rvi: document.querySelectorAll('.rvi').length }));
    ok(anim.deal === 'deal' && anim.kb === 'kenburns' && anim.word === 'word-up' && anim.rv > 5 && anim.lines >= 6 && anim.rvi >= 6, 'Animaciones: baraja de clientes que se reparte, zoom lento de la foto, titular por palabras, titulares por líneas y entradas al hacer scroll', JSON.stringify(anim));
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
