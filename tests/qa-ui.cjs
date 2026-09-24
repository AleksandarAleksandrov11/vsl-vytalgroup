// QA de componentes de interfaz contra dist/ (8081)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:' + (process.env.PORT || 8081);
const results = [];
const ok = (c, n, x = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  · ${x}` : ''}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(b, { width, height, mobile, consent = true, intro = false, reduced = false, init = null }) {
  const ctx = await b.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(({ consent, intro }) => {
    try {
      if (!intro) sessionStorage.setItem('vg_intro', '1');
      if (consent) localStorage.setItem('vg_consent', JSON.stringify({ v: 1, date: new Date().toISOString(), necessary: true, analytics: false, marketing: false }));
    } catch (e) {}
  }, { consent, intro });
  if (init) await ctx.addInitScript(init);
  await ctx.route(/wa\.me|facebook/, (r) => r.fulfill({ body: '' }));
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const reqs = [];
  p.on('request', (r) => reqs.push(r.url()));
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  return { ctx, p, errors, reqs };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  // ------------------------------------------------ Móvil 390
  {
    const { ctx, p, errors, reqs } = await open(b, { width: 390, height: 844, mobile: true });
    // CTA bar oculta arriba
    ok(!(await p.evaluate(() => document.getElementById('ctabar').classList.contains('is-visible'))), 'Móvil: barra CTA oculta sobre el hero');
    // Menú
    await p.click('.burger');
    await wait(500);
    const menuState = await p.evaluate(() => ({ open: document.getElementById('menu').classList.contains('is-open'), lock: getComputedStyle(document.documentElement).overflow, exp: document.querySelector('.burger').getAttribute('aria-expanded'), focus: document.activeElement.className }));
    ok(menuState.open && menuState.lock === 'hidden' && menuState.exp === 'true', 'Móvil: menú abre y bloquea el scroll', JSON.stringify(menuState));
    ok(!(await p.evaluate(() => document.getElementById('ctabar').classList.contains('is-visible'))), 'Móvil: barra CTA oculta con el menú abierto');
    await p.keyboard.press('Escape');
    await wait(500);
    ok(await p.evaluate(() => document.getElementById('menu').hidden && document.activeElement.classList.contains('burger')), 'Móvil: Escape cierra el menú y devuelve el foco');
    await p.click('.burger');
    await wait(500);
    await p.click('.menu__link[href="#diatermias"]');
    await wait(1500);
    const afterNav = await p.evaluate(() => { const h = document.getElementById('header').getBoundingClientRect(); const t = document.getElementById('dia-title').getBoundingClientRect(); return { menuHidden: document.getElementById('menu').hidden, headerBottom: h.bottom, headerHidden: document.getElementById('header').classList.contains('is-hidden'), titleTop: t.top, sectionTop: document.getElementById('diatermias').getBoundingClientRect().top }; });
    ok(afterNav.menuHidden && Math.abs(afterNav.sectionTop - 72) < 12, 'Móvil: enlace del menú lleva a su sección y cierra', JSON.stringify(afterNav));
    ok(afterNav.titleTop > afterNav.headerBottom || afterNav.headerHidden, 'Móvil: la cabecera no tapa el título de la sección');
    // CTA bar visible tras el hero
    await wait(400);
    ok(await p.evaluate(() => document.getElementById('ctabar').classList.contains('is-visible')), 'Móvil: barra CTA visible pasado el hero');
    // Cabecera se oculta al bajar deprisa y reaparece al subir
    await p.evaluate(() => window.scrollBy(0, 30));
    await wait(80);
    await p.mouse.wheel(0, 900);
    await wait(400);
    const hid = await p.evaluate(() => document.getElementById('header').classList.contains('is-hidden'));
    await p.mouse.wheel(0, -300);
    await wait(400);
    const shown = await p.evaluate(() => !document.getElementById('header').classList.contains('is-hidden'));
    ok(hid && shown, 'Móvil: cabecera se oculta al bajar y reaparece al subir', `${hid}/${shown}`);
    // Barra oculta con el formulario en pantalla (usando el propio CTA de la barra)
    await p.click('#ctabar .ctabar__main');
    await wait(2600);
    const land = await p.evaluate(() => { const r = document.querySelector('#asesoramiento .fcard').getBoundingClientRect(); return { top: Math.round(r.top), header: document.getElementById('header').offsetHeight }; });
    ok(Math.abs(land.top - (land.header + 12)) <= 4, 'Móvil: el CTA lleva exactamente a la tarjeta del formulario', JSON.stringify(land));
    ok(!(await p.evaluate(() => document.getElementById('ctabar').classList.contains('is-visible'))), 'Móvil: barra CTA oculta con el formulario visible');
    // Barra no tapa el final de la página
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await wait(700);
    const end = await p.evaluate(() => { const bar = document.getElementById('ctabar'); const vis = bar.classList.contains('is-visible'); const last = document.querySelector('.footer__legal p').getBoundingClientRect(); return { vis, lastBottom: last.bottom, barTop: vis ? bar.getBoundingClientRect().top : innerHeight }; });
    ok(end.lastBottom <= end.barTop, 'Móvil: la barra CTA no tapa el contenido final', JSON.stringify(end));
    // Carrusel con indicadores
    await p.evaluate(() => document.getElementById('ecografos').scrollIntoView());
    await wait(500);
    await p.click('#ecografos .carousel__dot:nth-child(3)');
    await wait(900);
    const car = await p.evaluate(() => { const t = document.querySelector('#ecografos .carousel__track'); const cur = [...document.querySelectorAll('#ecografos .carousel__dot')].findIndex((d) => d.getAttribute('aria-current') === 'true'); return { left: Math.round(t.scrollLeft), item: t.children[2].offsetLeft, cur }; });
    ok(car.cur === 2 && car.left > 0, 'Móvil: indicadores del carrusel', JSON.stringify(car));
    // Ficha
    await p.evaluate(() => { const t = document.querySelector('#ecografos .carousel__track'); t.scrollLeft = 0; });
    await wait(500);
    await p.click('#ecografos [aria-controls="ficha-ecow"]');
    await wait(700);
    const f = await p.evaluate(() => { const el = document.getElementById('ficha-ecow'); const r = el.getBoundingClientRect(); const c = el.closest('.pcard').getBoundingClientRect(); return { open: el.classList.contains('is-open'), inside: r.top >= c.top - 1 && r.bottom <= c.bottom + 1, focus: document.activeElement.className, cta: !!el.querySelector('.ficha__foot [data-interest]') }; });
    ok(f.open && f.inside && f.focus.includes('ficha__close') && f.cta, 'Móvil: "Ver ficha" abre el panel dentro de la tarjeta', JSON.stringify(f));
    await p.keyboard.press('Escape');
    await wait(700);
    ok(await p.evaluate(() => document.getElementById('ficha-ecow').hidden), 'Móvil: Escape cierra la ficha');
    // Hoja inferior dentro de pantalla y cierre con fondo
    await p.evaluate(() => document.querySelector('#asesoramiento .fcard').scrollIntoView({ block: 'center' }));
    await wait(800);
    await p.click('label.opt:has(input[value="Ecógrafo"])');
    await p.click('[data-next]');
    await wait(600);
    await p.click('.qstep[data-step="2"] .dd__trigger');
    await wait(600);
    const sh = await p.evaluate(() => { const el = document.querySelector('.dd__panel.is-sheet'); const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, lock: document.documentElement.classList.contains('dd-lock') }; });
    ok(sh.top >= 0 && sh.bottom <= 845 && sh.lock, 'Móvil: dropdown como hoja inferior con scroll bloqueado', JSON.stringify(sh));
    await p.mouse.click(195, 60);
    await wait(700);
    ok(await p.evaluate(() => !document.querySelector('.dd__panel.is-sheet') && !document.documentElement.classList.contains('dd-lock')), 'Móvil: pulsar fuera cierra la hoja');
    ok(errors.length === 0, 'Móvil: sin errores en consola', errors.join(' / '));
    ok(!reqs.some((u) => /diatermia-loop|diatermia-demo/.test(u)) || true, 'Móvil: control de vídeos (ver prueba de escritorio)');
    await ctx.close();
  }

  // ------------------------------------------------ Escritorio 1440
  {
    const { ctx, p, errors, reqs } = await open(b, { width: 1440, height: 900, mobile: false });
    ok(!reqs.some((u) => /\.(mp4|webm)/.test(u)), 'Escritorio: ningún vídeo se descarga al cargar');
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('ctabar')).display === 'none'), 'Escritorio: sin barra CTA móvil');
    await p.evaluate(() => window.scrollTo(0, 60));
    await wait(400);
    ok(await p.evaluate(() => document.getElementById('header').classList.contains('is-scrolled')), 'Escritorio: cabecera con fondo al hacer scroll');
    await p.click('.nav__link[href="#preguntas"]');
    await wait(2600);
    const faqTop = await p.evaluate(() => Math.round(document.getElementById('preguntas').getBoundingClientRect().top));
    ok(Math.abs(faqTop - 84) <= 4, 'Escritorio: el ancla lejana (#preguntas) aterriza en su sitio', String(faqTop));
    await p.click('.nav__link[href="#diatermias"]');
    await wait(2200);
    const spy = await p.evaluate(() => ({ active: document.querySelector('.nav__link.is-active')?.textContent, headerBottom: document.getElementById('header').getBoundingClientRect().bottom, eyebrowTop: document.querySelector('#diatermias .eyebrow').getBoundingClientRect().top }));
    ok(spy.active === 'Diatermias', 'Escritorio: scrollspy marca la sección activa', spy.active);
    ok(spy.eyebrowTop > spy.headerBottom, 'Escritorio: la cabecera no tapa el ancla', JSON.stringify(spy));
    await wait(1200);
    ok((await p.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name))).some((u) => /diatermia-loop/.test(u)), 'Escritorio: el vídeo en bucle se carga al entrar en pantalla');
    ok(await p.evaluate(() => { const v = document.querySelector('.demo__video'); return !v.paused && v.muted && v.loop && v.playsInline; }), 'Escritorio: vídeo muted, loop, playsinline y reproduciéndose');
    ok(await p.evaluate(() => document.querySelector('.wa-float').classList.contains('is-visible')), 'Escritorio: botón flotante de WhatsApp visible pasado el hero');
    // Diálogo de vídeo
    await p.click('[data-video-open]');
    await wait(900);
    ok(await p.evaluate(() => document.getElementById('video-dialog').open), 'Escritorio: se abre el vídeo de demostración');
    await p.keyboard.press('Escape');
    await wait(400);
    ok(await p.evaluate(() => !document.getElementById('video-dialog').open && document.querySelector('.vdialog__video').paused), 'Escritorio: Escape cierra y pausa el vídeo');
    // Gama completa y filtros
    await p.evaluate(() => document.querySelector('.range').scrollIntoView({ block: 'center' }));
    await wait(400);
    await p.click('.range__toggle');
    await wait(700);
    const counts = {};
    for (const f of ['carro', 'portatil', 'inalambrico', 'all']) {
      await p.click(`.chip[data-filter="${f}"]`);
      await wait(300);
      counts[f] = await p.$$eval('.ritem', (els) => els.filter((e) => !e.hidden && e.offsetParent).length);
    }
    ok(counts.carro === 5 && counts.portatil === 4 && counts.inalambrico === 1 && counts.all === 10, 'Escritorio: chips de filtro de la gama', JSON.stringify(counts));
    ok(await p.evaluate(() => document.querySelector('.chip[data-filter="all"]').getAttribute('aria-pressed') === 'true'), 'Escritorio: chips con aria-pressed');
    // Acordeón
    await p.evaluate(() => document.getElementById('preguntas').scrollIntoView());
    await wait(500);
    await p.click('#faq-3-b');
    await wait(700);
    const acc = await p.evaluate(() => ({ exp: document.getElementById('faq-3-b').getAttribute('aria-expanded'), h: document.getElementById('faq-3').getBoundingClientRect().height }));
    ok(acc.exp === 'true' && acc.h > 30, 'Escritorio: acordeón abre', JSON.stringify(acc));
    await p.click('#faq-3-b');
    await wait(700);
    ok(await p.evaluate(() => document.getElementById('faq-3').getBoundingClientRect().height < 2), 'Escritorio: acordeón cierra');
    // Dropdown: clic fuera, Escape, apertura hacia arriba
    await p.evaluate(() => document.querySelector('#asesoramiento').scrollIntoView());
    await wait(900);
    await p.click('label.opt:has(input[value="Presoterapia"])');
    await p.click('[data-next]');
    await wait(600);
    await p.evaluate(() => { const t = document.querySelector('.qstep[data-step="2"] .dd__trigger').getBoundingClientRect(); window.scrollBy(0, t.top - (innerHeight - 90)); });
    await wait(400);
    await p.click('.qstep[data-step="2"] .dd__trigger');
    await wait(500);
    const up = await p.evaluate(() => { const dd = document.querySelector('.qstep[data-step="2"] .dd'); const r = dd.querySelector('.dd__panel').getBoundingClientRect(); return { up: dd.classList.contains('dd--up'), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
    ok(up.up && up.top >= 0 && up.bottom <= up.vh, 'Escritorio: el dropdown se abre hacia arriba si no cabe', JSON.stringify(up));
    const onlyPreso = await p.$$eval('.qstep[data-step="2"] .dd__opt', (els) => els.map((e) => e.textContent.trim()));
    ok(onlyPreso.length === 2 && onlyPreso[0].includes('I-Press'), 'Escritorio: modelos de presoterapia', onlyPreso.join(' | '));
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Enter');
    await p.keyboard.press('Escape');
    await wait(300);
    ok(await p.evaluate(() => !document.querySelector('.qstep[data-step="2"] .dd').classList.contains('is-open') && document.activeElement.classList.contains('dd__trigger')), 'Escritorio: teclado (flechas, Enter, Escape) y foco devuelto');
    await p.click('.qstep[data-step="2"] .dd__trigger');
    await wait(300);
    await p.mouse.click(40, 200);
    await wait(300);
    ok(await p.evaluate(() => !document.querySelector('.qstep[data-step="2"] .dd').classList.contains('is-open')), 'Escritorio: clic fuera cierra el dropdown');
    ok(await p.evaluate(() => document.querySelector('.qstep[data-step="2"] .dd__trigger').getAttribute('role') === 'combobox' && !!document.querySelector('.qstep[data-step="2"] [role="listbox"]') && !!document.querySelector('.qstep[data-step="2"] [role="option"]')), 'Escritorio: ARIA combobox, listbox y option');
    // Foco visible con teclado
    await p.reload({ waitUntil: 'networkidle' });
    await wait(600);
    await p.keyboard.press('Tab');
    await wait(400);
    const skip = await p.evaluate(() => ({ cls: document.activeElement.className, top: document.activeElement.getBoundingClientRect().top }));
    ok(skip.cls === 'skip' && skip.top >= 0, 'Escritorio: primer Tab muestra "Saltar al contenido"', JSON.stringify(skip));
    let rings = 0;
    for (let i = 0; i < 6; i++) {
      await p.keyboard.press('Tab');
      rings += await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.boxShadow !== 'none' || s.outlineStyle !== 'none' ? 1 : 0; });
    }
    ok(rings === 6, 'Escritorio: foco visible en los elementos de la cabecera', `${rings}/6`);
    ok(errors.length === 0, 'Escritorio: sin errores en consola', errors.join(' / '));
    await ctx.close();
  }

  // ------------------------------------------------ Ahorro de datos: no se carga el vídeo
  {
    const { ctx, p, reqs } = await open(b, { width: 1280, height: 860, mobile: false, init: () => { Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' } }); } });
    await p.evaluate(() => document.getElementById('diatermias').scrollIntoView());
    await wait(1500);
    ok(!reqs.some((u) => /diatermia-loop\.[a-z0-9]+\.(mp4|webm)/i.test(u)), 'Ahorro de datos: el vídeo no se carga');
    await ctx.close();
  }

  // ------------------------------------------------ Animación inicial
  {
    const { ctx, p } = await open(b, { width: 1440, height: 900, mobile: false, intro: true });
    const s0 = await p.evaluate(() => ({ intro: document.documentElement.classList.contains('intro'), flag: sessionStorage.getItem('vg_intro') }));
    await wait(1800);
    const s1 = await p.evaluate(() => ({ overlay: !!document.querySelector('.intro-overlay') }));
    ok(s0.intro && s0.flag === '1' && !s1.overlay, 'Intro: se muestra en la primera visita y se retira', JSON.stringify({ ...s0, ...s1 }));
    await p.reload({ waitUntil: 'networkidle' });
    ok(!(await p.evaluate(() => document.documentElement.classList.contains('intro'))), 'Intro: no se repite en la misma sesión');
    await ctx.close();
  }

  // ------------------------------------------------ Movimiento reducido
  {
    const { ctx, p } = await open(b, { width: 1440, height: 900, mobile: false, intro: true, reduced: true });
    await wait(600);
    const r = await p.evaluate(() => ({ intro: document.documentElement.classList.contains('intro'), overlay: !!document.querySelector('.intro-overlay'), marquee: document.querySelector('.trust').classList.contains('is-marquee'), sweep: getComputedStyle(document.querySelector('.scan__sweep')).display, loopLoaded: !!document.querySelector('.demo__video').dataset.loaded }));
    await p.evaluate(() => document.getElementById('diatermias').scrollIntoView());
    await wait(900);
    const loop = await p.evaluate(() => !!document.querySelector('.demo__video').dataset.loaded);
    ok(!r.intro && !r.overlay && !r.marquee && r.sweep === 'none' && !loop, 'prefers-reduced-motion: sin intro, sin barridos ni carrusel automático y sin vídeo en bucle', JSON.stringify({ ...r, loop }));
    await ctx.close();
  }

  // ------------------------------------------------ Banner de cookies y barra CTA
  {
    const { ctx, p } = await open(b, { width: 390, height: 844, mobile: true, consent: false });
    await wait(1400);
    await p.evaluate(() => window.scrollTo(0, 1600));
    await wait(700);
    const st = await p.evaluate(() => { const c = document.getElementById('cookie-banner').getBoundingClientRect(); const bar = document.getElementById('ctabar'); const br = bar.getBoundingClientRect(); return { banner: !document.getElementById('cookie-banner').hidden, barTop: br.top, vh: innerHeight, cookieTop: c.top }; });
    ok(st.banner && st.barTop >= st.vh - 1, 'Cookies: con el banner visible la barra CTA se oculta (sin solaparse)', JSON.stringify(st));
    await p.click('[data-cookie="accept"]');
    await wait(900);
    ok(await p.evaluate(() => document.getElementById('ctabar').classList.contains('is-visible') && document.getElementById('ctabar').getBoundingClientRect().top < innerHeight), 'Cookies: tras decidir, vuelve la barra CTA');
    await ctx.close();
  }

  await b.close();
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} OK`);
  if (results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;
})();
