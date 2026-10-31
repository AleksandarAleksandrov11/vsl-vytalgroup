// QA de interfaz y de las reglas del brief contra dist/ servido con las cabeceras de vercel.json.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 8081}`;
const SITE_URL = 'https://vsl.vytalgroupem.com';
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
    ok(s.ids.join(',') === 'inicio,garantias,equipos,comparativa,mas-equipos,por-que,dudas,asesoramiento' && s.footers === 1, 'Estructura: hero, franja de garantías, Lo más pedido, la comparativa justo después, Más equipos, Javier, Dudas, formulario y footer', s.ids.join(', '));
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
    // v10: + línea de confianza y firma de Javier en el hero, "¿No sabes cuál elegir?" y "¿Otra duda?";
    // v18: + financiación en las 6 tarjetas, microtexto y prueba social (datos confirmados)
    ok(words.main <= 330, 'Minimalismo: menos de 330 palabras visibles en las secciones (sin acordeón ni formulario)', `${words.main} en secciones · ${words.ticker} en la línea de confianza · ${words.chrome} en cabecera y footer`);
    // Un CTA por sección con el mismo texto (en Más equipos, solo el de asesoramiento)
    const perSec = await p.$$eval('main > section:not(#asesoramiento):not(#garantias)', (els) => els.map((sec) => `${sec.id}:${[...sec.querySelectorAll('[data-cta], .btn[data-catalog-ask], .btn[data-catalog]')].map((a) => a.textContent.trim()).join('+')}`));
    const want = ['inicio:Pedir asesoramiento gratis', 'equipos:Pedir asesoramiento gratis', 'comparativa:Pedir asesoramiento gratis', 'mas-equipos:Pedir asesoramiento gratis', 'por-que:Pedir asesoramiento gratis', 'dudas:Pedir asesoramiento gratis'];
    ok(perSec.join('|') === want.join('|'), 'CTA: "Pedir asesoramiento gratis" en cada sección, uno solo por sección', perSec.join(' | '));
    const cta = await p.$$eval('[data-cta]', (els) => [...new Set(els.map((e) => e.getAttribute('aria-label') || e.textContent.trim()))]);
    ok(cta.length === 1 && cta[0] === 'Pedir asesoramiento gratis', 'CTA: texto de asesoramiento idéntico en todas partes (cabecera, secciones, pie y barra móvil)', cta.join(' | '));
    const cards = await p.$$eval('.card .btn', (els) => [...new Set(els.map((e) => e.textContent.trim()))]);
    ok(cards.join() === 'Pedir asesoramiento', 'Tarjetas: botón "Pedir asesoramiento" (antes "Lo quiero")', cards.join(' | '));
    const badges = await p.evaluate(() => [...document.querySelectorAll('[class]')].map((e) => String(e.className.baseVal ?? e.className)).filter((c) => /badge|chip|tag\b|pill|label--|ribbon/.test(c)));
    ok(!badges.length, 'Minimalismo: sin badges, chips ni etiquetas', badges.join(', '));
    const perCard = await p.$$eval('.card', (els) => els.map((c) => c.querySelectorAll('a, button').length));
    ok(perCard.length === 6 && perCard.every((n) => n === 1), 'Lo más pedido: 6 tarjetas (3 por categoría) con un solo botón', perCard.join(','));
    const html = await p.content();
    const gone = ['Ver ficha', 'También te equipamos', 'Cómo trabajamos', 'wa-float', 'Testimonio de ejemplo', 'tsts', 'data-ejemplo', 'Me interesa', 'Habla con Javier', 'No sé cuál elegir', 'ISO 13485', 'FDA', 'veterinari'].filter((x) => html.includes(x));
    ok(!gone.length, 'Contenido: nada de lo eliminado ni prohibido (ISO, FDA, veterinaria)', gone.join(', '));
    const qs = await p.$$eval('.acc__btn', (els) => els.map((e) => e.textContent.trim()));
    ok(qs.join('|') === '¿Cuánto cuesta?|¿Se puede financiar?|¿Cuál me conviene?|¿Qué garantía tienen?|¿Y el mantenimiento?|¿Están certificados?|¿Enviáis fuera de España?|¿Qué pasa cuando envío el formulario?', 'Dudas: 8 preguntas, "¿Cuánto cuesta?" y "¿Se puede financiar?" las primeras y qué pasa al enviar la última', qs.join(' · '));
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
          const cta = bar.querySelector('.mbar__cta');
          const barOn = getComputedStyle(bar).display !== 'none' && bar.classList.contains('is-on');
          return { sw: document.documentElement.scrollWidth, vw, hdR: Math.round(btn.right), gap: Math.round(btn.left - logo.right), txtFits: document.querySelector('.hd .btn').scrollWidth <= Math.ceil(btn.width) + 1, barOn, ctaR: Math.round(cta.getBoundingClientRect().right), ctaFits: cta.scrollWidth <= cta.clientWidth + 1 };
        });
        const fine = r.sw <= r.vw && r.hdR <= r.vw && r.gap >= 8 && r.txtFits && (!r.barOn || (r.ctaR <= r.vw && r.ctaFits));
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
    ok((await p.getAttribute('#q1', 'aria-expanded')) === 'true' && await p.isVisible('#a1') && (await p.textContent('#a1')).includes('presupuesto por escrito'), 'Acordeón: abre al tocar');
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
    const on = await p.evaluate(() => { const m = document.querySelector('[data-mbar]'); const r = m.getBoundingClientRect(); const a = m.querySelectorAll('a, button'); const c = a[0].getBoundingClientRect(); return { on: m.classList.contains('is-on'), inert: m.inert, bottom: Math.round(r.bottom), vh: innerHeight, btns: a.length, txt: a[0].textContent.trim(), href: a[0].getAttribute('href'), w: Math.round(c.width), vw: innerWidth }; });
    ok(on.on && !on.inert && on.bottom <= on.vh && on.btns === 1 && on.txt === 'Pedir asesoramiento gratis' && on.href === '#asesoramiento' && on.w >= on.vw - 2 * 16, 'Barra móvil: aparece al pasar el hero, con un único botón a todo el ancho "Pedir asesoramiento gratis"', JSON.stringify(on));
    let waSeen = 0;
    for (let y = 0; y < 12000; y += 400) {
      await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await p.waitForTimeout(40);
      waSeen += await p.evaluate(() => [...document.querySelectorAll('a[href]')].filter((a) => /wa\.me|api\.whatsapp|^tel:|^mailto:|instagram\.com/.test(a.getAttribute('href')) && a.checkVisibility({ visibilityProperty: true }) && a.getBoundingClientRect().width > 0).length);
    }
    ok(waSeen === 0, 'Sin fugas: ningún WhatsApp, teléfono, correo ni Instagram visible antes de enviar (toda la página)', `${waSeen}`);
    await scrollToSel(p, '.fcard', 100); await p.waitForTimeout(900);
    ok(!(await p.evaluate(() => document.querySelector('[data-mbar]').classList.contains('is-on'))), 'Barra móvil: se oculta con el formulario en pantalla');
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(900);
    const foot = await p.evaluate(() => { const last = document.querySelector('.ft__word-in').getBoundingClientRect(); const m = document.querySelector('[data-mbar]'); const r = m.getBoundingClientRect(); return { last: Math.round(last.bottom), bar: m.classList.contains('is-on') ? Math.round(r.top) : 99999, noWa: m.classList.contains('no-wa') }; });
    ok(foot.last <= foot.bar, 'Barra móvil: no tapa el final del footer (ni el nombre en grande)', JSON.stringify(foot));
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
    ok(t.icons.length === 7 && new Set(t.icons).size === 7 && t.items.includes('Menos de 24 h de respuesta') && t.items.includes('8 clínicas y 2 clubes equipados') && !t.items.some((x) => /sorpresas|páginas/.test(x)) && t.strong >= 18 && t.txt >= 16 && t.h >= 84, 'Garantías: 7 garantías (con "Menos de 24 h de respuesta" y "8 clínicas y 2 clubes equipados", sin "0 sorpresas"), textos grandes y un icono distinto en cada una', JSON.stringify({ items: t.items, icons: t.icons, strong: t.strong, txt: t.txt, h: t.h }));
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
    ok(r.note === '¿Buscas otro equipo? Pregúntanos: trabajamos con más de 50 modelos.', 'Más equipos: nota "¿Buscas otro equipo?"', r.note);
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
    ok(after.head === 'Otras marcas | VytalGroup' && after.rows.length === 5, 'Comparador: 5 filas, "Otras marcas" frente a "VytalGroup"', after.rows.join(' · '));
    for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
      const { ctx: c3, p: q } = await page(b, { width: w, height: h, mobile: m });
      await q.goto(BASE + '/', { waitUntil: 'networkidle' });
      const t = await q.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const sec = document.querySelector('#comparativa');
        const box = sec.querySelector('.cmp');
        const r = box.getBoundingClientRect();
        const cs = getComputedStyle(box);
        const bgOf = (el) => { const c = getComputedStyle(el); return c.backgroundImage !== 'none' ? c.backgroundImage : c.backgroundColor; };
        const col = getComputedStyle(sec.querySelector('.cmp tbody td + td')).backgroundColor;
        const title = sec.querySelector('h2');
        const icons = [sec.querySelectorAll('.cmp__x').length, sec.querySelectorAll('.cmp__check').length];
        return {
          title: title.textContent.replace(/\s+/g, ' ').trim(), lead: !!sec.querySelector('.vs__lead, .sec__head p'), cta: sec.querySelector('[data-cta]').textContent.trim(),
          th: [...sec.querySelectorAll('th')].map((x) => [x.textContent, getComputedStyle(x).textAlign, getComputedStyle(x).textTransform].join(':')),
          rowsH: [...sec.querySelectorAll('tbody tr')].map((r) => Math.round(r.getBoundingClientRect().height)),
          bg: bgOf(sec), why: bgOf(document.querySelector('#por-que')), faq: bgOf(document.querySelector('#dudas')),
          off: Math.round(Math.abs((r.left + r.right) / 2 - vw / 2)), w: Math.round(r.width), card: cs.backgroundColor, radius: parseFloat(cs.borderTopLeftRadius), col, icons,
          after: sec.previousElementSibling.id, before: sec.nextElementSibling.id,
        };
      });
      ok(t.title === '¿Por qué elegir VytalGroup?' && !t.lead && t.cta === 'Pedir asesoramiento gratis' && t.after === 'equipos' && t.before === 'mas-equipos', `Comparativa ${w}px: "¿Por qué elegir VytalGroup?" justo después de Lo más pedido, sin subtítulo y con CTA`, JSON.stringify({ title: t.title, after: t.after, before: t.before }));
      ok(t.th.join('|') === 'Otras marcas:center:uppercase|VytalGroup:center:uppercase', `Comparativa ${w}px: cabeceras centradas, "OTRAS MARCAS" y "VYTALGROUP"`, t.th.join(' | '));
      if (!m) ok(t.w >= 900 && Math.max(...t.rowsH.slice(0, 4)) - Math.min(...t.rowsH.slice(0, 4)) <= 1, `Comparativa ${w}px: tabla más grande, con todas las filas en una línea y a la misma altura`, JSON.stringify({ w: t.w, rows: t.rowsH }));
      ok(/gradient/.test(t.bg) && t.bg !== t.why && t.bg !== t.faq, `Comparativa ${w}px: fondo propio (turquesa claro), distinto del de Javier y del de Dudas`, t.bg.slice(0, 60));
      ok(t.off <= 2 && t.w <= 960 && t.card === 'rgb(255, 255, 255)' && t.radius >= 20 && t.col !== 'rgba(0, 0, 0, 0)' && t.icons.join() === '5,5', `Comparativa ${w}px: tabla centrada, en tarjeta blanca, con aspas, checks y la columna de VytalGroup resaltada`, JSON.stringify({ off: t.off, w: t.w, col: t.col, icons: t.icons }));
      await c3.close();
    }
    ok(before.armed && before.op === '0' && before.dash === '24px' && after.op === '1,1,1,1,1' && after.dash === '0px,0px,0px,0px,0px' && after.delays === '0s,0.16s,0.32s,0.48s,0.64s', 'Comparador: filas una a una y checks dibujados con stroke-dashoffset', JSON.stringify({ before, op: after.op, dash: after.dash, delays: after.delays }));
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
          peek: document.querySelector('#equipos').getBoundingClientRect().top < innerHeight,
        };
      });
      ok(r.alt === '' && r.hidden === 'true' && r.prio === 'high' && r.loaded && /hero-fondo-(m-600|960|1600)/.test(r.src) && r.preload === '(max-width: 899px) | (min-width: 900px)', `Hero ${w}px: foto de clínica de fondo (decorativa), prioritaria y precargada por tamaño`, r.src);
      ok(r.cover && r.veil && r.filter === 'none' && (m ? r.peek : r.tall), `Hero ${w}px: la foto cubre todo el hero, velo marino encima y difuminado ya en el archivo (sin filter)${m ? '; Lo más pedido asoma en la primera pantalla' : ''}`, JSON.stringify({ cover: r.cover, veil: r.veil, filter: r.filter, tall: r.tall, peek: r.peek }));
      ok(r.h1 === 'rgb(255, 255, 255)' && r.logo.toUpperCase() === '#FFF', `Hero ${w}px: titular y logo de cabecera en blanco`, JSON.stringify({ h1: r.h1, logo: r.logo }));
      ok(r.media === 0 && !r.anim.length, `Hero ${w}px: solo foto, sin equipo recortado, ondas, vídeos ni fotos de clientes`, r.anim.join(','));
      ok(!logs.length, `Hero ${w}px: consola limpia`, logs.join(' / '));
      await ctx.close();
    }
  });

  // Titular según la campaña (utm_content / utm_campaign o ?v=), sin parpadeo ni saltos (CLS 0)
  await block('Hero por campaña', async () => {
    const H = {
      base: ['Equipos médicos de alta calidad. Sin letra pequeña.', 'Ecógrafos, diatermias y todo lo que tu clínica necesita. Te asesoran fisioterapeutas.'],
      eco: ['¿Vas a comprar un ecógrafo? Antes, hablemos.', 'Fisioterapeutas te ayudan a elegir el que necesitas. Y te decimos cuál no.'],
      mofu2: ['¿Ecógrafo portátil o de carro?', 'Cuéntanos cómo trabajas y te decimos cuál encaja contigo.'],
      bofu1: ['Asesoramiento sin compromiso.', '10 minutos para saber qué equipo tiene sentido para ti.'],
      bofu2: ['Todo por escrito. Sin sorpresas.', 'Qué incluye, qué garantía tiene y cuánto cuesta el mantenimiento, antes de pagar.'],
    };
    const cases = [
      ['sin-utm', '', 'base'],
      ['tofu1', '?utm_source=meta&utm_medium=paid&utm_campaign=DESCUBRIR&utm_term=Fisios&utm_content=TOFU%201', 'eco'],
      ['tofu3', '?utm_source=meta&utm_campaign=DESCUBRIR&utm_content=TOFU%203', 'eco'],
      ['descubrir', '?utm_source=meta&utm_campaign=DESCUBRIR', 'eco'],
      ['mofu2', '?utm_source=meta&utm_medium=paid&utm_campaign=CERRAR&utm_content=MOFU%202', 'mofu2'],
      ['bofu1', '?utm_source=meta&utm_medium=paid&utm_campaign=CERRAR&utm_content=BOFU%201', 'bofu1'],
      ['bofu2', '?utm_source=meta&utm_medium=paid&utm_campaign=CERRAR&utm_content=BOFU%202', 'bofu2'],
      ['v-bofu2', '?v=bofu2', 'bofu2'],
    ];
    const bad = [];
    const dir = path.join('tests', 'output', 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    for (const [w, h, m] of [[390, 844, true], [1440, 900, false]]) {
      for (const [name, q, v] of cases) {
        const { ctx, p, logs } = await page(b, { width: w, height: h, mobile: m });
        await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
        await p.goto(BASE + '/' + q, { waitUntil: 'networkidle' });
        await p.waitForTimeout(1800);
        const r = await p.evaluate(() => {
          const vis = (sel) => [...document.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent.replace(/\s+/g, ' ').trim());
          return { h1: vis('#hero-title .hv'), lead: vis('.hero__lead .hv'), cls: Math.round(window.__cls * 1000) / 1000, cl: document.documentElement.className };
        });
        if (r.h1.join('|') !== H[v][0] || r.lead.join('|') !== H[v][1] || r.cls > 0.001 || logs.length) bad.push(`${w}px ${name}: ${JSON.stringify(r)} ${logs.join(' / ')}`);
        if (['sin-utm', 'tofu1', 'mofu2', 'bofu1', 'bofu2'].includes(name)) await p.screenshot({ path: path.join(dir, `hero-${name}-${w}.png`) });
        await ctx.close();
      }
    }
    ok(!bad.length, 'Hero por campaña: TOFU y DESCUBRIR "¿Vas a comprar un ecógrafo?", MOFU 2, BOFU 1 y BOFU 2 con su titular, sin UTM el de siempre; CLS 0 en 390 y 1440 px', bad.join(' | ') || `${cases.length * 2} casos`);
    // Con una variante, el AX8 pasa a la primera tarjeta de Lo más pedido
    const { ctx, p } = await page(b, { width: 390, height: 844, mobile: true });
    await p.goto(BASE + '/?utm_content=BOFU%201', { waitUntil: 'networkidle' });
    const first = await p.evaluate(() => document.querySelector('#panel-eco .card .card__name').textContent.trim());
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const same = await p.evaluate(() => document.documentElement.className.includes('v-bofu1'));
    await ctx.close();
    const { ctx: c2, p: p2 } = await page(b, { width: 390, height: 844, mobile: true });
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    const firstBase = await p2.evaluate(() => document.querySelector('#panel-eco .card .card__name').textContent.trim());
    await c2.close();
    ok(/AX8/.test(first) && !/AX8/.test(firstBase) && same, 'Lo más pedido: con campaña, el AX8 va primero (y la variante se mantiene en la sesión); sin campaña, el orden de siempre', `${first} · ${firstBase}`);
  });

  // Datos confirmados por Aleks: financiación (Hotmart y Klarna) y prueba social (8 clínicas y 2 clubes)
  await block('Financiación y prueba social', async () => {
    const FIN = 'Financiación disponible con Hotmart y Klarna';
    const MICRO = 'Asesoramiento gratis · Financiación con Hotmart y Klarna';
    const SOCIAL = 'Ya hemos equipado 8 clínicas y 2 clubes de alto rendimiento';
    const txt = (el) => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    for (const [w, h, m] of [[390, 844, true], [1440, 900, false]]) {
      const { ctx, p, logs } = await page(b, { width: w, height: h, mobile: m });
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      await p.waitForTimeout(1800);
      const r = await p.evaluate(({ FIN }) => {
        const t = (el) => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
        const box = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return Math.round(b.bottom); };
        const cards = [...document.querySelectorAll('.card')];
        return {
          micro: t(document.querySelector('.hero__micro')), social: t(document.querySelector('.hero__social')),
          order: [...document.querySelector('.hero__copy').children].map((e) => e.className.split(' ')[0]).filter((c) => /hero__(actions|micro|social|trust)/.test(c)).join(','),
          cta: box('.hero__cta'), soc: box('.hero__social'), vh: innerHeight,
          fin: cards.map((c) => t(c.querySelector('.card__fin'))), finPos: cards.every((c) => { const f = c.querySelector('.card__fin'); return f && f.previousElementSibling.matches('.card__data') && f.nextElementSibling.matches('.btn'); }),
          lead: t(document.querySelector('#asesoramiento .lead__social')), leadBefore: !!(document.querySelector('#asesoramiento .lead__social').compareDocumentPosition(document.querySelector('.fcard')) & Node.DOCUMENT_POSITION_FOLLOWING),
          qfMicro: t(document.querySelector('.qf__micro')), qfAfter: !!(document.querySelector('[data-submit]').compareDocumentPosition(document.querySelector('.qf__micro')) & Node.DOCUMENT_POSITION_FOLLOWING),
          finHero: getComputedStyle(document.querySelector('.hero__fin')).display,
        };
      }, { FIN });
      ok(r.micro === MICRO && r.social === SOCIAL && r.order === 'hero__actions,hero__micro,hero__social,hero__trust', `Hero ${w}px: bajo el CTA "${MICRO}" y la prueba social "${SOCIAL}"`, `${r.order}`);
      ok(r.cta <= r.vh && r.soc <= r.vh, `Hero ${w}px: el CTA y la prueba social se ven en la primera pantalla (sin empujar el CTA)`, JSON.stringify({ cta: r.cta, social: r.soc, vh: r.vh }));
      ok(r.fin.length === 6 && r.fin.every((x) => x === FIN) && r.finPos, `Tarjetas ${w}px: "${FIN}" en las 6, bajo los datos y encima del botón`);
      ok(r.lead === SOCIAL && r.leadBefore && r.qfMicro === MICRO && r.qfAfter, `Asesoramiento ${w}px: prueba social justo encima del formulario y "${MICRO}" bajo el botón de enviar`);
      ok(r.finHero === 'none' && !logs.length, `Hero ${w}px: sin campaña de cierre, el subtítulo no habla de financiación; consola limpia`, logs.join(' / '));
      await ctx.close();
    }
    // Anuncios de cierre (CERRAR: MOFU 1, MOFU 2, BOFU 1, BOFU 2): el subtítulo añade la financiación
    const bad = [];
    for (const [q, want] of [['?utm_campaign=CERRAR&utm_content=MOFU%201', true], ['?utm_campaign=CERRAR&utm_content=MOFU%202', true], ['?utm_campaign=CERRAR&utm_content=BOFU%201', true], ['?utm_campaign=CERRAR&utm_content=BOFU%202', true], ['?utm_campaign=CERRAR', true], ['?utm_campaign=DESCUBRIR&utm_content=TOFU%201', false], ['?utm_campaign=DESCUBRIR', false], ['', false]]) {
      const { ctx, p } = await page(b, { width: 390, height: 844, mobile: true });
      await p.goto(BASE + '/' + q, { waitUntil: 'networkidle' });
      const lead = await p.evaluate(() => [...document.querySelector('.hero__lead').childNodes].filter((n) => n.nodeType === 1 && getComputedStyle(n).display !== 'none').map((n) => n.textContent).join('').trim());
      if (/Y puedes financiarlo con Hotmart o Klarna\.$/.test(lead) !== want) bad.push(`${q || 'sin UTM'}: ${lead}`);
      await ctx.close();
    }
    ok(!bad.length, 'Hero: en los anuncios de CERRAR el subtítulo termina con "Y puedes financiarlo con Hotmart o Klarna."; en DESCUBRIR y sin UTM, no', bad.join(' | ') || '8 casos');
    // FAQ y sin datos inventados
    const { ctx, p } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const f = await p.evaluate(() => ({ q: document.querySelector('#q8').textContent.trim(), a: document.querySelector('#a8 p').textContent.trim(), html: document.documentElement.outerHTML, imgs: [...document.querySelectorAll('img')].map((i) => `${i.src} ${i.alt}`).join(' ') }));
    ok(f.q === '¿Se puede financiar?' && f.a === 'Sí, puedes financiar tu equipo con Hotmart o Klarna. En el asesoramiento te explicamos las opciones según el equipo que elijas.', 'Dudas: "¿Se puede financiar?" con la respuesta confirmada');
    const forbidden = ['0 sorpresas', '53 páginas', 'cuota', 'intereses', 'TAE', 'meses sin', 'testimonio', 'opiniones de clientes'].filter((x) => f.html.toLowerCase().includes(x.toLowerCase()));
    ok(!forbidden.length && !/hotmart|klarna/i.test(f.imgs) && (f.html.match(/8 clínicas y 2 clubes/g) || []).length === 6, 'Sin datos sin confirmar: ni cuotas, intereses o plazos, ni testimonios, ni logos de Hotmart o Klarna; "8 clínicas y 2 clubes" solo con esas cifras', forbidden.join(', '));
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
          gap: document.querySelector('.why__foot').offsetTop - (document.querySelector('.why__grid').offsetTop + document.querySelector('.why__grid').offsetHeight),
          cmpInWhy: !!document.querySelector('#por-que .cmp'),
          between: [...document.querySelectorAll('#por-que .wrap > *')].map((e) => e.className.split(' ')[0]).join(','),
          ta: [getComputedStyle(document.querySelector('#why-title')).textAlign, getComputedStyle(story).textAlign],
          lines: story.innerHTML.split('<br>').map((x) => x.trim()),
          borders: [...document.querySelectorAll('.cmp__table td, .cmp__table th, .cmp__table tr')].map((e) => { const c = getComputedStyle(e); return [c.borderTopWidth, c.borderBottomWidth].join(' '); }).filter((x) => x !== '0px 0px').length,
        };
      });
      if (m) ok(why.below && why.ta.join() === 'center,center', `Por qué ${w}px: titular e historia centrados y la foto debajo`, JSON.stringify(why));
      else ok(why.right && why.ta.join() === 'left,left', `Por qué ${w}px: titular e historia a la derecha de la foto, alineados a la izquierda`, JSON.stringify(why));
      ok(!why.stats && !why.cmpInWhy && why.between === 'why__grid,why__foot' && why.gap >= 40 && why.gap <= 72, `Por qué ${w}px: titular, historia, foto, firma y CTA (sin cifras ni tabla)`, JSON.stringify({ stats: why.stats, between: why.between, gap: why.gap }));
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
          legal: [...ft.querySelectorAll('a[href^="/"]')].map((a) => `${a.getAttribute('href')}:${a.target}:${a.rel}`),
          logo: ft.querySelector('.ft__logo').getAttribute('href'),
          cta: (ft.querySelector('.ft__cta') || {}).textContent,
          word: wd.textContent, hidden: wd.closest('[aria-hidden="true"]') !== null, isLast: last.classList.contains('ft__word'),
          fill: Math.round((wr.width / (document.querySelector('.ft .wrap').clientWidth - parseFloat(getComputedStyle(document.querySelector('.ft .wrap')).paddingLeft) * 2)) * 100),
          fs: parseFloat(getComputedStyle(wd).fontSize), inView: wr.top < innerHeight && wr.bottom > 0,
          done: spans.every((x) => getComputedStyle(x).opacity === '1' && getComputedStyle(x).transform === 'none'),
          delays: [spans[0], spans[9]].map((x) => getComputedStyle(x).transitionDelay),
          colors: [getComputedStyle(spans[0]).color, getComputedStyle(spans[5]).color],
          sw: document.documentElement.scrollWidth, vw,
        };
      });
      ok(r.logoH >= 30 && r.heads.join('|') === 'Equipos|Legal' && r.hSize <= 13 && r.cols.map((c) => c[1]).join(',') === '3,4' && r.cta === 'Pedir asesoramiento gratis' && r.logo === '#inicio', `Pie ${w}px: logo (sube al inicio), claim, CTA "Pedir asesoramiento gratis" y columnas Equipos y Legal`, JSON.stringify({ logoH: r.logoH, cols: r.cols, hSize: r.hSize, cta: r.cta }));
      // Única salida permitida en el pie: el crédito de la agencia, en otra pestaña (la landing sigue abierta)
      const credit = await p.evaluate(() => { const a = document.querySelector('.ft__bottom a[data-credit]'); return a && `${a.getAttribute('href')}:${a.target}:${a.rel}`; });
      ok(r.links.join(',') === '#inicio,#asesoramiento,#equipos,#mas-equipos,#asesoramiento,/aviso-legal,/privacidad,/cookies,Configurar cookies,https://www.aasmarketing.com/' && r.legal.every((x) => x.endsWith(':_blank:noopener')) && credit === 'https://www.aasmarketing.com/:_blank:noopener', `Pie ${w}px: sin teléfono, WhatsApp, correo ni Instagram; legales y crédito de AAS Marketing en pestaña nueva`, r.links.join(' '));
      ok(before.armed && before.op === '0' && r.word === 'VytalGroup' && r.hidden && r.isLast && r.fill >= 94 && r.fill <= 101 && r.inView && r.done && r.delays[0] === '0s' && r.delays[1] === '0.495s' && r.colors[0] !== r.colors[1] && r.sw <= r.vw, `Pie ${w}px: "VytalGroup" en grande a todo el ancho al final, con las letras que suben una a una al llegar`, JSON.stringify({ before, fill: r.fill, fs: r.fs, done: r.done, delays: r.delays, colors: r.colors }));
      ok(!logs.length, `Pie ${w}px: consola limpia`, logs.join(' / '));
      await ctx.close();
    }
    const { ctx, p, logs } = await page(b, { width: 390, height: 844, mobile: true });
    await p.goto(BASE + '/privacidad', { waitUntil: 'networkidle' });
    await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await p.waitForTimeout(2000);
    const l = await p.evaluate(() => ({ hrefs: [...document.querySelectorAll('.ft a')].map((a) => a.getAttribute('href')).filter((h) => h.includes('#')), icons: [...document.querySelectorAll('.ft use')].every((u) => document.querySelector(u.getAttribute('href'))), done: [...document.querySelectorAll('.ft__word-in span')].every((x) => getComputedStyle(x).opacity === '1') }));
    ok(l.hrefs.join(',') === '/#asesoramiento,/#equipos,/#mas-equipos,/#asesoramiento' && l.icons && l.done && !logs.length, 'Pie en las páginas legales: mismo pie, enlaces a la página principal, iconos y nombre animado', JSON.stringify(l));
    await ctx.close();
  });

  await block('Titular del formulario', async () => {
    const bad = [];
    for (const [w, h, m] of [[320, 640, true], [360, 780, true], [390, 844, true], [768, 1024, true], [1024, 768, false], [1440, 900, false]]) {
      const { ctx, p } = await page(b, { width: w, height: h, mobile: m });
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      await scrollToSel(p, '#asesoramiento'); await p.waitForTimeout(1600);
      const r = await p.evaluate(async () => {
        await document.fonts.ready;
        const t = document.getElementById('form-title');
        const tr = t.getBoundingClientRect();
        const card = document.querySelector('.fcard').getBoundingClientRect();
        const social = document.querySelector('#asesoramiento .lead__social').getBoundingClientRect();
        const faq = document.querySelector('#dudas .faq__more').getBoundingClientRect();
        const eq = document.querySelector('#dudas');
        return { lines: Math.round(tr.height / parseFloat(getComputedStyle(t).lineHeight)), fits: tr.left >= 0 && tr.right <= document.documentElement.clientWidth && t.scrollWidth <= t.clientWidth + 1, gap: Math.round(card.top - social.bottom), toSocial: Math.round(social.top - tr.bottom), fromFaq: Math.round(tr.top - faq.bottom), sec: parseFloat(getComputedStyle(eq).paddingTop) };
      });
      if (r.lines !== 1 || !r.fits || r.gap > 40 || r.toSocial > 40 || r.fromFaq > r.sec * 1.8) bad.push(`${w}px ${JSON.stringify(r)}`);
      await ctx.close();
    }
    ok(!bad.length, 'Formulario: "Cuéntanos qué necesitas." en una línea (320 a 1440 px), la prueba social y el formulario justo debajo, sin el hueco blanco con Dudas', bad.join(' | ') || '6 anchos');
  });

  // Solo Más equipos (la cuadrícula) se funde arriba con la comparativa; el resto de secciones,
  // incluidas Javier y la comparativa, mantienen su corte recto
  await block('Transiciones entre secciones', async () => {
    for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
      const { ctx, p } = await page(b, { width: w, height: h, mobile: m });
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      const r = await p.evaluate(() => {
        const sec = document.getElementById('mas-equipos');
        const a = getComputedStyle(sec, '::after');
        const cols = a.backgroundImage.match(/rgba?\([^)]*\)/g) || [];
        const straight = ['por-que', 'comparativa', 'dudas', 'asesoramiento', 'equipos'].map((id) => [id, getComputedStyle(document.getElementById(id), '::after').content]);
        const full = ['por-que', 'comparativa'].map((id) => { const el = document.getElementById(id); const b = el.getBoundingClientRect(); return [id, Math.round(b.width), getComputedStyle(el).borderTopLeftRadius]; });
        return { first: cols[0], last: cols[cols.length - 1], body: getComputedStyle(document.body).backgroundColor, h: parseFloat(a.height), pad: parseFloat(getComputedStyle(sec).paddingTop), straight, full, vw: document.documentElement.clientWidth, ft: getComputedStyle(document.querySelector('.ft'), '::after').content };
      });
      ok(r.first === 'rgb(210, 235, 235)' && /, 0\)$/.test(r.last) && r.h <= r.pad + 1 && r.h >= 60, `Secciones ${w}px: Más equipos (la cuadrícula) se funde arriba con el color de la comparativa, dentro de su margen`, JSON.stringify({ first: r.first, h: r.h, pad: r.pad }));
      ok(r.straight.every(([, c]) => c === 'none') && r.ft === 'none', `Secciones ${w}px: Javier, la comparativa, Dudas, el formulario y el pie con corte recto`, JSON.stringify(r.straight));
      ok(r.full.every(([, wd, rad]) => wd === r.vw && rad === '0px'), `Secciones ${w}px: Por qué VytalGroup y la comparativa ocupan todo el ancho`, JSON.stringify(r.full));
      await ctx.close();
    }
  });

  // Panel de cookies: se abre y se cierra limpio, sin que asome ninguna barra de scroll
  await block('Panel de cookies', async () => {
    for (const [w, h, m] of [[1280, 720, false], [390, 844, true], [844, 390, true]]) {
      const { ctx, p } = await page(b, { width: w, height: h, mobile: m, consent: null });
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      await p.waitForTimeout(1400);
      await p.evaluate(() => {
        window.__f = [];
        const d = document.getElementById('cookie-panel');
        const inn = d.querySelector('.cp__in');
        const t0 = performance.now();
        const tick = () => {
          window.__f.push({ scroll: d.scrollTop + inn.scrollTop, box: getComputedStyle(d).overflow !== 'visible' && d.scrollHeight > d.clientHeight, inner: inn.scrollHeight > inn.clientHeight, y: scrollY });
          if (performance.now() - t0 < 800) requestAnimationFrame(tick);
        };
        document.querySelector('#cookie-banner [data-cookie="config"]').addEventListener('click', () => requestAnimationFrame(tick), { once: true });
      });
      const y0 = await p.evaluate(() => scrollY);
      await p.click('#cookie-banner [data-cookie="config"]');
      await p.waitForTimeout(900);
      const f = await p.evaluate(() => window.__f);
      const st = await p.evaluate(() => { const d = document.getElementById('cookie-panel'); const r = d.querySelector('.cp__in').getBoundingClientRect(); return { open: d.open, focus: document.activeElement.matches('[data-consent="marketing"]'), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
      const dirty = f.filter((x) => x.scroll || x.box || x.inner || x.y !== y0).length;
      ok(st.open && st.focus && !dirty && st.top >= 0 && st.bottom <= st.vh + 1 && (!m || w > h || Math.abs(st.bottom - st.vh) <= 1), `Cookies ${w}×${h}: el panel se abre limpio (sin barra de scroll ni saltos en ${f.length} fotogramas)${m && w < h ? ', como hoja desde abajo' : ''}`, JSON.stringify({ dirty, ...st }));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(80);
      const mid = await p.evaluate(() => ({ open: document.getElementById('cookie-panel').open, closing: document.getElementById('cookie-panel').classList.contains('is-closing') }));
      await p.waitForTimeout(500);
      const end = await p.evaluate(() => ({ open: document.getElementById('cookie-panel').open, closing: document.getElementById('cookie-panel').classList.contains('is-closing') }));
      ok(mid.open && mid.closing && !end.open && !end.closing, `Cookies ${w}×${h}: Escape lo cierra con animación y queda cerrado`, JSON.stringify({ mid, end }));
      // Reabrir tras cerrar: vuelve a abrirse y no se cierra solo
      await p.click('#cookie-banner [data-cookie="config"]');
      await p.waitForTimeout(700);
      ok(await p.evaluate(() => document.getElementById('cookie-panel').open), `Cookies ${w}×${h}: se puede volver a abrir`);
      await p.click('[data-cpanel-close]');
      await p.waitForTimeout(500);
      await ctx.close();
    }
  });

  await block('Catálogo', async () => {
    const { ctx, p } = await page(b, {});
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => ({ btns: [...document.querySelectorAll('#mas-equipos a.btn, #mas-equipos button.btn')].map((a) => a.textContent.trim()), hero: document.querySelector('.hero__more').getAttribute('href'), heroTxt: document.querySelector('.hero__more').textContent.trim(), pdf: /\.pdf\b|download|catálogo completo|Pídenos el catálogo/i.test(document.body.innerHTML) }));
    ok(r.btns.join() === 'Pedir asesoramiento gratis', 'Más equipos ("Todo lo que tu clínica necesita"): solo el CTA de asesoramiento', r.btns.join(' | '));
    ok(r.hero === '#equipos' && r.heroTxt === 'Ver equipos' && !r.pdf && !(await p.$('#catalogo')), 'Catálogo: ningún PDF ni descarga; el enlace del hero es "Ver equipos" (a #equipos)', JSON.stringify({ hero: r.hero, pdf: r.pdf }));
    await ctx.close();
  });

  // ------------------------------------------------------------ sin fugas: un solo camino (el formulario)
  await block('Sin fugas', async () => {
    // 1) Código fuente: WhatsApp, teléfono, correo e Instagram solo donde se permite
    const PAT = /wa\.me|api\.whatsapp|tel:[+\d]|mailto:|instagram\.com/g;
    const found = [];
    const scan = (file, allow) => {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(PAT)) {
        const line = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index));
        if (!allow(line, src, m.index)) found.push(`${file}: ${line.trim().slice(0, 90)}`);
      }
    };
    const inLd = (src, i) => { const a = src.lastIndexOf('<script type="application/ld+json">', i); return a >= 0 && src.indexOf('</script>', a) > i; };
    scan('index.html', (line, src, i) => inLd(src, i) || /data-done-wa|data-fail-wa/.test(line));
    fs.readdirSync('assets/js').filter((f) => f.endsWith('.js')).forEach((f) => scan(`assets/js/${f}`, (line) => f === 'form.js' && /^const WA = 'https:\/\/wa\.me\/34616372644\?text=';$/.test(line.trim())));
    // Legales: los datos de contacto del titular y de derechos (texto legal), nada más
    for (const f of ['aviso-legal.html', 'privacidad.html', 'cookies.html', 'scripts/assets/gen_legal.py']) scan(f, (line) => /<dd><a href="(mailto|tel):|ejercer tus derechos/.test(line));
    ok(!found.length, 'Sin fugas (código): wa.me, api.whatsapp, tel:, mailto: e instagram.com solo en el gracias, el error, el JSON-LD y el texto legal', found.join(' | ') || 'limpio');
    // 2) Página servida: todos los enlaces son internos, legales en pestaña nueva o el WhatsApp de después de enviar
    const { ctx, p } = await page(b, { width: 390, height: 844, mobile: true, consent: null });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const links = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href'), t: a.target, rel: a.rel, after: !!a.closest('[data-done], [data-fail]'), credit: a.matches('.ft__bottom a[data-credit]'), sprite: !!a.closest('svg') })));
    const bad = links.filter((l) => !(l.href.startsWith('#') || (['/privacidad', '/aviso-legal', '/cookies'].includes(l.href) && l.t === '_blank' && /noopener/.test(l.rel)) || (l.after && l.href.startsWith('https://wa.me/34616372644')) || (l.credit && l.href === 'https://www.aasmarketing.com/' && l.t === '_blank' && /noopener/.test(l.rel))));
    ok(!bad.length && links.length > 20, 'Sin fugas (página): solo enlaces internos, legales y crédito del pie en pestaña nueva (rel="noopener") y el WhatsApp de después del envío', bad.map((l) => l.href).join(' ') || `${links.length} enlaces`);
    const logos = await p.$$eval('.hd__logo, .ft__logo', (els) => els.map((e) => e.getAttribute('href')));
    ok(logos.join() === '#inicio,#inicio', 'Logo de cabecera y pie: solo sube al inicio (#inicio)', logos.join());
    // 3) Legales del aviso de cookies y del pie: se abren encima y la landing sigue abierta
    const [tab] = await Promise.all([ctx.waitForEvent('page'), p.click('#cookie-banner a[href="/cookies"]')]);
    await tab.waitForLoadState();
    ok(tab.url().endsWith('/cookies') && p.url() === BASE + '/', 'Legales: "Política de cookies" del aviso de cookies se abre en otra pestaña y la landing sigue abierta', tab.url());
    await tab.close();
    await p.click('#cookie-banner [data-cookie="reject"]');
    await p.evaluate(() => document.querySelector('.ft a[href="/privacidad"]').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(400);
    const [tab2] = await Promise.all([ctx.waitForEvent('page'), p.tap('.ft a[href="/privacidad"]')]);
    await tab2.waitForLoadState();
    ok(tab2.url().endsWith('/privacidad') && p.url() === BASE + '/', 'Legales: "Privacidad" del pie se abre en otra pestaña y la landing sigue abierta', tab2.url());
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
    ok(f1.cls === 'skip' && f1.t === 'none' && f3.txt.startsWith('Pedir asesoramiento gratis') && f3.outline !== 'none', 'Teclado: salto al contenido, cabecera y foco visible', JSON.stringify([f1, f3]));
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
    ok(pdf.status === 301 && pdf.headers.location === '/#asesoramiento' && !fs.existsSync('dist/assets/docs') && !fs.existsSync('assets/docs/catalogo-vytalgroup-2026.pdf'), 'Catálogo: el PDF ya no existe (ni en el repo ni en dist) y su URL redirige con 301 a /#asesoramiento', `${pdf.status} ${pdf.headers.location}`);
    const clean = await Promise.all(['/aviso-legal', '/privacidad', '/cookies'].map(get));
    ok(clean.every((r) => r.status === 200 && r.body.toString().includes('<h1')), 'URLs limpias: /aviso-legal, /privacidad y /cookies');
    const red = await Promise.all(['/privacidad.html', '/cookies/', '/index', '/index.html'].map(get));
    ok(red.map((r) => `${r.status} ${r.headers.location}`).join(' | ') === '308 /privacidad | 308 /cookies | 308 / | 308 /', 'URLs limpias: redirecciones .html, barra final e /index', red.map((r) => `${r.status} ${r.headers.location}`).join(' | '));
    const cfg = await get('/config.js');
    ok(/must-revalidate/.test(cfg.headers['cache-control']) && /SHEETS_ENDPOINT: "https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec"/.test(cfg.body.toString()) && /META_PIXEL_ID: "[\d,]*1593490341777612[\d,]*"/.test(cfg.body.toString()), 'config.js: sin caché, con la URL del Apps Script (/exec) y el ID del píxel');
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
    ok(org && org.url === `${SITE_URL}/` && faq && faq.mainEntity.length === 8 && faq.mainEntity.map((q) => q.name).join('|') === visibleQs.join('|'), 'Metadatos: JSON-LD Organization y FAQPage con las mismas 8 preguntas que la web');
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
    const legalText = await p.evaluate(() => document.querySelector('.legal__body').innerText);
    const datos = ['Javier Ruiz Vides', '49115639J', 'Rue des Champs 61a, Bertrange, Luxemburgo', 'vytalkinetech@gmail.com', '+34 616 372 644', '12 meses desde el último contacto'];
    const faltan = datos.filter((d) => !legalText.includes(d));
    ok(!(await p.$('mark, .pending')) && !/Pendiente/.test(legalText) && !faltan.length, 'Legales: datos del titular completos (nombre, DNI, domicilio, email, teléfono) y plazo de conservación, sin huecos pendientes', faltan.join(', '));
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
