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
    ok(s.ids.join(',') === 'inicio,garantias,equipos,mas-equipos,por-que,dudas,asesoramiento' && s.footers === 1, 'Estructura: hero, franja de garantías, 5 secciones y el footer', s.ids.join(', '));
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
    const perSec = await p.$$eval('main > section:not(#asesoramiento):not(#garantias)', (els) => els.map((sec) => `${sec.id}:${[...sec.querySelectorAll('[data-cta], .btn[data-catalog]')].map((a) => a.textContent.trim()).join('+')}`));
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
    ok(qs.join('|') === '¿Cuál me conviene?|¿Qué garantía tienen?|¿Y el mantenimiento?|¿Están certificados?|¿Enviáis fuera de España?|¿Qué pasa cuando envío el formulario?', 'Dudas: 6 preguntas, sin "¿Solo vendéis...?" y con garantía y qué pasa al enviar', qs.join(' · '));
    const nc = await p.evaluate(() => [...document.querySelectorAll('body *:not(script):not(style)')].filter((e) => e.children.length === 0 && /no comerciales/i.test(e.textContent)).length + (/no comerciales/i.test(document.head.innerHTML) ? 1 : 0));
    ok(nc === 0, 'Texto: "Fisioterapeutas te asesoran" sin "no comerciales" (web y metadatos)', `${nc}`);
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

  // ------------------------------------------------------------ móvil: nada ensancha la página (cabecera y barra nunca se cortan)
  // Se simula un navegador sin overflow: clip (Safari < 16 y algunos navegadores internos) y el texto
  // del sistema al 130 %: si algo se saliera por la derecha, la cabecera y la barra fija se alargarían
  // y su botón derecho quedaría cortado.
  await block('Sin desbordes horizontales', async () => {
    const bad = [];
    for (const w of [320, 360, 375, 390, 412, 430, 768, 1024]) {
      for (const zoom of [100, 130]) {
        const { ctx, p } = await page(b, { width: w, height: 800, mobile: w < 1024 });
        await p.goto(BASE + '/', { waitUntil: 'networkidle' });
        if (zoom !== 100) await p.addStyleTag({ content: `html { font-size: ${zoom}% !important; }` });
        await p.evaluate(() => document.querySelectorAll('*').forEach((el) => { const c = getComputedStyle(el); if (c.overflowX === 'clip' || c.overflowY === 'clip') el.style.overflow = 'visible'; }));
        // Interacciones que mueven cosas en horizontal: pestañas, carrusel y acordeón
        await p.evaluate(() => { document.querySelector('#tab-dia').click(); });
        await p.waitForTimeout(250);
        await p.evaluate(() => { document.querySelector('#tab-eco').click(); const t = document.querySelector('#cards-eco'); t.scrollTo({ left: t.children[1].offsetLeft, behavior: 'instant' }); document.querySelector('#q6').click(); });
        await p.waitForTimeout(900);
        await p.evaluate(() => window.scrollTo({ top: document.querySelector('#por-que').offsetTop, behavior: 'instant' }));
        await p.waitForTimeout(700);
        const r = await p.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const btn = document.querySelector('.hd .btn').getBoundingClientRect();
          const logo = document.querySelector('.hd__logo').getBoundingClientRect();
          const bar = document.querySelector('[data-mbar]');
          const wa = bar.querySelector('.mbar__wa').getBoundingClientRect();
          const cta = bar.querySelector('.mbar__cta');
          const barOn = getComputedStyle(bar).display !== 'none' && bar.classList.contains('is-on');
          return { sw: document.documentElement.scrollWidth, vw, hdR: Math.round(btn.right), gap: Math.round(btn.left - logo.right), txtFits: document.querySelector('.hd .btn').scrollWidth <= Math.ceil(btn.width) + 1, barOn, waR: Math.round(wa.right), ctaFits: cta.scrollWidth <= cta.clientWidth + 1 };
        });
        const fine = r.sw <= r.vw && r.hdR <= r.vw && r.gap >= 8 && r.txtFits && (!r.barOn || (r.waR <= r.vw && r.ctaFits));
        if (!fine) bad.push(`${w}px ${zoom}% ${JSON.stringify(r)}`);
        await ctx.close();
      }
    }
    ok(!bad.length, 'Móvil: nada ensancha la página (320 a 1024 px, texto al 100 y 130 %, sin overflow: clip); cabecera y barra fija nunca se cortan', bad.join(' | ') || '16 casos');
  });

  await block('Solo WebP', async () => {
    const { ctx, p } = await page(b, { width: 390, height: 844, mobile: true });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } });
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => ({ imgs: [...document.querySelectorAll('img')].flatMap((i) => [i.currentSrc || i.src, ...(i.srcset || '').split(',').map((x) => x.trim().split(' ')[0]).filter(Boolean)]).map((u) => u.split('/').pop()), avif: document.documentElement.outerHTML.includes('avif') }));
    const files = fs.readdirSync(path.resolve('dist/assets/img'));
    ok(!r.avif && r.imgs.length >= 14 && r.imgs.every((x) => /\.webp$/.test(x)) && files.every((x) => /\.webp$/.test(x)), 'Imágenes: todas en WebP (fotos de producto, categorías, hero y Javier)', `${new Set(r.imgs).size} archivos usados · ${files.length} en dist`);
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
    ok(await p.evaluate(() => !document.querySelector('.carousel, .carousel__nav, .carousel__btn, [data-dir]')), 'Carrusel: sin flechas (se pasa deslizando, con puntos)');
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

  await block('Barra móvil', async () => {
    const { ctx, p } = await page(b, { width: 390, height: 844, mobile: true });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    ok(!(await p.evaluate(() => document.querySelector('[data-mbar]').classList.contains('is-on'))), 'Barra móvil: oculta en el hero');
    await scrollToSel(p, '#equipos', -200); await p.waitForTimeout(900);
    const on = await p.evaluate(() => { const m = document.querySelector('[data-mbar]'); const r = m.getBoundingClientRect(); return { on: m.classList.contains('is-on'), inert: m.inert, bottom: Math.round(r.bottom), vh: innerHeight, btns: m.querySelectorAll('a').length }; });
    ok(on.on && !on.inert && on.bottom <= on.vh && on.btns === 2, 'Barra móvil: aparece al pasar el hero (CTA + WhatsApp)', JSON.stringify(on));
    await scrollToSel(p, '[data-faq-wa]', 300); await p.waitForTimeout(700);
    const waVisible = await p.evaluate(() => [...document.querySelectorAll('a[href*="wa.me"]')].filter((a) => { const r = a.getBoundingClientRect(); const s = getComputedStyle(a); return r.width && r.bottom > 0 && r.top < innerHeight && s.display !== 'none' && a.checkVisibility({ visibilityProperty: true }) && !a.closest('[inert]'); }).length);
    ok(waVisible === 1, 'WhatsApp: un solo enlace visible a la vez', `${waVisible} visibles`);
    await scrollToSel(p, '.fcard', 100); await p.waitForTimeout(900);
    ok(!(await p.evaluate(() => document.querySelector('[data-mbar]').classList.contains('is-on'))), 'Barra móvil: se oculta con el formulario en pantalla');
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(900);
    const foot = await p.evaluate(() => { const last = document.querySelector('.ft__word-in').getBoundingClientRect(); const m = document.querySelector('[data-mbar]'); const r = m.getBoundingClientRect(); return { last: Math.round(last.bottom), bar: m.classList.contains('is-on') ? Math.round(r.top) : 99999, noWa: m.classList.contains('no-wa') }; });
    ok(foot.last <= foot.bar, 'Barra móvil: no tapa el final del footer (ni el nombre en grande)', JSON.stringify(foot));
    await p.evaluate(() => document.querySelector('[data-ft-wa]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(700);
    ok(await p.evaluate(() => document.querySelector('[data-mbar]').classList.contains('no-wa')), 'Barra móvil: sin icono de WhatsApp con el WhatsApp del pie a la vista');
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
      const sec = document.querySelector('#garantias');
      const tk = sec.getBoundingClientRect();
      const li = lists[0].children[0];
      return { halfW: Math.round(tr.scrollWidth / 2), vw: innerWidth, lists: lists.length, dup: lists[1] && lists[1].getAttribute('aria-hidden'), same: lists[0].textContent === lists[1].textContent, anim: getComputedStyle(tr).animationName, own: !sec.closest('#inicio') && sec.tagName === 'SECTION' && !!sec.getAttribute('aria-label'), below: Math.abs(tk.top - hero.bottom) <= 1, fold: tk.bottom <= innerHeight + 1, bg: getComputedStyle(sec).backgroundColor, h: Math.round(tk.height), strong: parseFloat(getComputedStyle(li.querySelector('strong')).fontSize), txt: parseFloat(getComputedStyle(li).fontSize), icons: [...lists[0].querySelectorAll('.ticker__ico use')].map((u) => u.getAttribute('href')), items: [...lists[0].children].map((x) => x.textContent.trim().replace(/\s+/g, ' ')) };
    });
    ok(t.own && t.below && t.fold && t.bg === 'rgb(255, 255, 255)', 'Garantías: sección propia bajo el hero, con fondo propio, visible en la primera pantalla', JSON.stringify({ own: t.own, below: t.below, fold: t.fold, bg: t.bg, h: t.h }));
    ok(t.icons.length === 6 && new Set(t.icons).size === 6 && t.strong >= 18 && t.txt >= 16 && t.h >= 84, 'Garantías: más grande, textos más grandes y un icono distinto en cada una', JSON.stringify({ icons: t.icons, strong: t.strong, txt: t.txt, h: t.h }));
    ok(t.lists === 4 && t.dup === 'true' && t.same && t.anim === 'marquee' && t.halfW >= t.vw, 'Garantías: en bucle infinito sin huecos (media pista ≥ ancho de pantalla) y con las copias ocultas a lectores', `${t.items.join(' · ')} · media pista ${t.halfW}px`);
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
    for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
      const { ctx: c3, p: q } = await page(b, { width: w, height: h, mobile: m });
      await q.goto(BASE + '/', { waitUntil: 'networkidle' });
      const t = await q.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const box = document.querySelector('.cmp');
        const r = box.getBoundingClientRect();
        const cs = getComputedStyle(box);
        const col = getComputedStyle(document.querySelector('.cmp tbody td + td')).backgroundColor;
        const ta = [...document.querySelectorAll('.cmp th, .cmp td')].map((c) => getComputedStyle(c).textAlign);
        return { off: Math.round(Math.abs((r.left + r.right) / 2 - vw / 2)), w: Math.round(r.width), bg: cs.backgroundColor, radius: parseFloat(cs.borderTopLeftRadius), col, center: ta.every((x) => x === 'center') };
      });
      ok(t.off <= 2 && t.bg !== 'rgba(0, 0, 0, 0)' && t.radius >= 20 && t.col !== 'rgba(0, 0, 0, 0)' && t.center, `Comparador ${w}px: tabla minimalista centrada, con fondo y la columna de VytalGroup resaltada`, JSON.stringify(t));
      await c3.close();
    }
    ok(before.armed && before.op === '0' && before.dash === '24px' && after.op === '1,1,1' && after.dash === '0px,0px,0px' && after.delays === '0s,0.22s,0.44s', 'Comparador: filas una a una y checks dibujados con stroke-dashoffset', JSON.stringify({ before, op: after.op, dash: after.dash, delays: after.delays }));
    await ctx.close();
  });

  await block('Hero: foto de fondo', async () => {
    for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
      const { ctx, p, logs } = await page(b, { width: w, height: h, mobile: m });
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      await p.waitForTimeout(1600);
      const r = await p.evaluate(() => {
        const img = document.querySelector('.hero__bg img');
        const bg = document.querySelector('.hero__bg');
        const hero = document.querySelector('#inicio');
        const veil = getComputedStyle(hero, '::before');
        const box = bg.getBoundingClientRect();
        const hb = hero.getBoundingClientRect();
        return {
          alt: img.getAttribute('alt'), hidden: bg.getAttribute('aria-hidden'), prio: img.getAttribute('fetchpriority'),
          loaded: img.complete && img.naturalWidth > 0, src: img.currentSrc.split('/').pop(),
          preload: [...document.querySelectorAll('link[rel="preload"][as="image"]')].map((l) => l.getAttribute('media')).join(' | '),
          cover: getComputedStyle(img).objectFit === 'cover' && Math.abs(box.width - hb.width) < 2 && Math.abs(box.height - hb.height) < 2,
          veil: /linear-gradient/.test(veil.backgroundImage) && /rgba\(8, 20, 34/.test(veil.backgroundImage),
          filter: getComputedStyle(img).filter,
          h1: getComputedStyle(document.querySelector('.h1')).color,
          logo: getComputedStyle(document.querySelector('.hd .logo')).getPropertyValue('--logo-a').trim(),
          media: document.querySelectorAll('#inicio video, .reel, .stage, .hero__visual').length,
          anim: [...document.querySelectorAll('#inicio *')].map((e) => getComputedStyle(e).animationName).filter((n) => n !== 'none' && n !== 'word-up' && n !== 'fade-up' && n !== 'marquee'),
          tall: Math.round(hb.height) >= Math.min(innerHeight, 980) - document.querySelector('#garantias').offsetHeight - 2,
        };
      });
      ok(r.alt === '' && r.hidden === 'true' && r.prio === 'high' && r.loaded && /hero-fondo-(m-600|960|1600)/.test(r.src) && r.preload === '(max-width: 899px) | (min-width: 900px)', `Hero ${w}px: foto de clínica de fondo (decorativa), prioritaria y precargada por tamaño`, r.src);
      ok(r.cover && r.veil && r.filter === 'none' && r.tall, `Hero ${w}px: la foto cubre todo el hero, velo marino encima y difuminado ya en el archivo (sin filter)`, JSON.stringify({ cover: r.cover, veil: r.veil, filter: r.filter, tall: r.tall }));
      ok(r.h1 === 'rgb(255, 255, 255)' && r.logo.toUpperCase() === '#FFF', `Hero ${w}px: titular y logo de cabecera en blanco`, JSON.stringify({ h1: r.h1, logo: r.logo }));
      ok(r.media === 0 && !r.anim.length, `Hero ${w}px: solo foto, sin equipo recortado, ondas, vídeos ni fotos de clientes`, r.anim.join(','));
      ok(!logs.length, `Hero ${w}px: consola limpia`, logs.join(' / '));
      await ctx.close();
    }
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
      // Excepción en escritorio: el titular de Javier va a la derecha de su foto, alineado a la izquierda
      const badH = r.heads.filter(([id, ta, o]) => !(!m && id === 'why-title') && (ta !== 'center' || o > 2));
      const badC = r.ctas.filter(([, o]) => o > 2);
      ok(!badH.length && !badC.length && r.hero === (m ? 'center' : 'start'), `Alineación ${w}px: titulares y CTA de sección centrados${m ? ', hero centrado' : ', hero a la izquierda'}`, JSON.stringify({ badH, badC, hero: r.hero }));
      const why = await p.evaluate(() => {
        const box = (s) => document.querySelector(s).getBoundingClientRect();
        const ph = box('.why__photo'); const t = box('#why-title'); const st = box('.why__story'); const cmp = box('.cmp'); const grid = box('.why__grid');
        const story = document.querySelector('.why__story');
        return {
          right: t.left >= ph.right + 20 && st.left >= ph.right + 20,
          below: ph.top >= st.bottom - 2,
          stats: document.querySelectorAll('.why__list, #por-que [data-count]').length,
          // Medido sin las entradas al hacer scroll (que desplazan un poco la foto hasta que aparece)
          gap: document.querySelector('.cmp').offsetTop - (document.querySelector('.why__grid').offsetTop + document.querySelector('.why__grid').offsetHeight),
          between: [...document.querySelectorAll('#por-que .wrap > *')].map((e) => e.className.split(' ')[0]).join(','),
          ta: [getComputedStyle(document.querySelector('#why-title')).textAlign, getComputedStyle(story).textAlign],
          lines: story.innerHTML.split('<br>').map((x) => x.trim()),
          borders: [...document.querySelectorAll('.cmp__table td, .cmp__table th, .cmp__table tr')].map((e) => { const c = getComputedStyle(e); return [c.borderTopWidth, c.borderBottomWidth].join(' '); }).filter((x) => x !== '0px 0px').length,
        };
      });
      if (m) ok(why.below && why.ta.join() === 'center,center', `Por qué ${w}px: titular e historia centrados y la foto debajo`, JSON.stringify(why));
      else ok(why.right && why.ta.join() === 'left,left', `Por qué ${w}px: titular e historia a la derecha de la foto, alineados a la izquierda`, JSON.stringify(why));
      ok(!why.stats && why.between === 'why__grid,cmp,why__foot' && why.gap >= 24 && why.gap <= 64, `Por qué ${w}px: sin las cifras; de la foto se pasa directo a la tabla`, JSON.stringify({ stats: why.stats, between: why.between, gap: why.gap }));
      ok(why.lines.length === 2 && why.lines[1] === 'Monté VytalGroup para que no te engañen.' && !why.borders, `Por qué ${w}px: historia en dos líneas y sin líneas separadoras en el comparador`, JSON.stringify({ lines: why.lines, borders: why.borders }));
      await ctx.close();
    }
  });

  await block('Pie', async () => {
    for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
      const { ctx, p, logs } = await page(b, { width: w, height: h, mobile: m });
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      const before = await p.evaluate(() => { const wd = document.querySelector('[data-word]'); return { armed: wd.classList.contains('is-armed'), op: getComputedStyle(wd.querySelector('span')).opacity }; });
      await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
      await p.waitForTimeout(2200);
      const r = await p.evaluate(() => {
        const ft = document.querySelector('.ft');
        const vw = document.documentElement.clientWidth;
        const logo = ft.querySelector('.ft__logo .logo').getBoundingClientRect();
        const heads = [...ft.querySelectorAll('.ft__h')].map((x) => x.textContent.trim());
        const cols = [...ft.querySelectorAll('.ft__col')].map((c) => [c.querySelector('.ft__h').textContent.trim(), c.querySelectorAll('li').length]);
        const wd = ft.querySelector('.ft__word-in');
        const wr = wd.getBoundingClientRect();
        const spans = [...wd.querySelectorAll('span')];
        const last = [...ft.children].pop();
        return {
          logoH: Math.round(logo.height), heads, cols,
          hSize: parseFloat(getComputedStyle(ft.querySelector('.ft__h')).fontSize),
          links: [...ft.querySelectorAll('a[href], button')].map((a) => a.getAttribute('href') || a.textContent.trim()),
          word: wd.textContent, hidden: wd.closest('[aria-hidden="true"]') !== null, isLast: last.classList.contains('ft__word'),
          fill: Math.round((wr.width / (document.querySelector('.ft .wrap').clientWidth - parseFloat(getComputedStyle(document.querySelector('.ft .wrap')).paddingLeft) * 2)) * 100),
          fs: parseFloat(getComputedStyle(wd).fontSize), inView: wr.top < innerHeight && wr.bottom > 0,
          done: spans.every((x) => getComputedStyle(x).opacity === '1' && getComputedStyle(x).transform === 'none'),
          delays: [spans[0], spans[9]].map((x) => getComputedStyle(x).transitionDelay),
          colors: [getComputedStyle(spans[0]).color, getComputedStyle(spans[5]).color],
          sw: document.documentElement.scrollWidth, vw,
        };
      });
      ok(r.logoH >= 30 && r.heads.join('|') === 'Contacto|Equipos|Legal|Síguenos' && r.hSize <= 13 && r.cols.map((c) => c[1]).join(',') === '3,4,4,1', `Pie ${w}px: logo grande y columnas con título pequeño (Contacto, Equipos, Legal, Síguenos)`, JSON.stringify({ logoH: r.logoH, cols: r.cols, hSize: r.hSize }));
      ok(['tel:+34616372644', 'mailto:vytalkinetech@gmail.com', 'https://www.instagram.com/fisioruiz_/', '#equipos', '#mas-equipos', '/assets/docs/catalogo-vytalgroup-2026.pdf', '#asesoramiento', '/aviso-legal', '/privacidad', '/cookies', 'Configurar cookies'].every((x) => r.links.includes(x)) && r.links.some((x) => /wa\.me/.test(x)), `Pie ${w}px: teléfono, WhatsApp, correo, Instagram, equipos, catálogo, asesoramiento y legales`, r.links.length + ' enlaces');
      ok(before.armed && before.op === '0' && r.word === 'VytalGroup' && r.hidden && r.isLast && r.fill >= 94 && r.fill <= 101 && r.inView && r.done && r.delays[0] === '0s' && r.delays[1] === '0.495s' && r.colors[0] !== r.colors[1] && r.sw <= r.vw, `Pie ${w}px: "VytalGroup" en grande a todo el ancho al final, con las letras que suben una a una al llegar`, JSON.stringify({ before, fill: r.fill, fs: r.fs, done: r.done, delays: r.delays, colors: r.colors }));
      ok(!logs.length, `Pie ${w}px: consola limpia`, logs.join(' / '));
      await ctx.close();
    }
    const { ctx, p, logs } = await page(b, { width: 390, height: 844, mobile: true });
    await p.goto(BASE + '/privacidad', { waitUntil: 'networkidle' });
    await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await p.waitForTimeout(2000);
    const l = await p.evaluate(() => ({ hrefs: [...document.querySelectorAll('.ft a')].map((a) => a.getAttribute('href')).filter((h) => h.includes('#')), icons: [...document.querySelectorAll('.ft use')].every((u) => document.querySelector(u.getAttribute('href'))), done: [...document.querySelectorAll('.ft__word-in span')].every((x) => getComputedStyle(x).opacity === '1') }));
    ok(l.hrefs.join(',') === '/#equipos,/#mas-equipos,/#asesoramiento' && l.icons && l.done && !logs.length, 'Pie en las páginas legales: mismo pie, enlaces a la página principal, iconos y nombre animado', JSON.stringify(l));
    await ctx.close();
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
      deal: [...document.querySelectorAll('.hero__lead, .hero__actions, .ticker')].map((e) => getComputedStyle(e).animationName).filter((n) => n !== 'none').join(',') || 'none',
      rv: document.querySelectorAll('.rv').length,
      smooth: getComputedStyle(document.documentElement).scrollBehavior,
      marquee: [...document.querySelectorAll('.ticker__track')].map((t) => getComputedStyle(t).animationName).join(','),
      dups: [...document.querySelectorAll('.ticker__list[aria-hidden]')].every((l) => getComputedStyle(l).display === 'none'),
      split: document.querySelectorAll('[data-lines].is-split, .rvi, .cmp.is-armed').length,
      ftword: [...document.querySelectorAll('.ft__word-in span')].map((e) => getComputedStyle(e).opacity + getComputedStyle(e).transform).join('|'),
      armed: document.querySelector('[data-word]').classList.contains('is-armed'),
    }));
    ok(r.word === 'none' && r.deal === 'none' && r.rv === 0 && r.split === 0 && r.smooth === 'auto', 'Movimiento reducido: sin animaciones de entrada ni desplazamiento suave', JSON.stringify(r));
    ok(r.marquee === 'none' && r.dups && !r.armed && r.ftword.split('|').every((x) => x === '1none'), 'Movimiento reducido: garantías quietas (sin copias) y el nombre del pie visible sin animar', `${r.marquee} · ${r.armed}`);
    await scrollToSel(p, '#por-que'); await p.waitForTimeout(400);
    await p.mouse.move(700, 400, { steps: 3 }); await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({ py: [...document.querySelectorAll('[data-parallax]')].some((i) => i.style.getPropertyValue('--py')) }));
    ok(!st.py, 'Movimiento reducido: sin parallax', JSON.stringify(st));
    const { ctx: c2, p: p2 } = await page(b, {});
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    const anim = await p2.evaluate(() => ({ deal: [...document.querySelectorAll('.hero__lead, .hero__actions, .ticker')].map((e) => getComputedStyle(e).animationName).join(','), word: getComputedStyle(document.querySelector('.h1 .w > span')).animationName, rv: document.querySelectorAll('.rv').length, lines: document.querySelectorAll('[data-lines].is-split').length, rvi: document.querySelectorAll('.rvi').length }));
    ok(anim.deal === 'fade-up,fade-up,fade-up' && anim.word === 'word-up' && anim.rv > 5 && anim.lines >= 5 && anim.rvi >= 6, 'Animaciones: titular por palabras, entrada suave del resto del hero, titulares por líneas y entradas al hacer scroll', JSON.stringify(anim));
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
    const img = html.match(/\/assets\/img\/[\w-]+\.[a-f0-9]{8}\.webp/)[0];
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
    const visibleQs = [...html.matchAll(/class="acc__btn"[^>]*>([^<]+)</g)].map((x) => x[1]);
    ok(org && org.url === `${SITE_URL}/` && faq && faq.mainEntity.length === 6 && faq.mainEntity.map((q) => q.name).join('|') === visibleQs.join('|'), 'Metadatos: JSON-LD Organization y FAQPage con las mismas 6 preguntas que la web');
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
