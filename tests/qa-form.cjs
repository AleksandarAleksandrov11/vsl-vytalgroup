// QA del formulario, consentimiento y tracking contra dist/ (puerto 8081) y el mock de Apps Script (8090).
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:' + (process.env.PORT || 8081);
const MOCK = 'http://localhost:8090';
const LOG = process.argv[2];
const results = [];
const ok = (cond, name, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  · ${extra}` : ''}`); };
const readLog = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const PIXEL_STUB = `(function(){var c=window.__fb=window.__fb||[];var f=window.fbq;function cm(){c.push(Array.prototype.slice.call(arguments).map(function(x){return JSON.parse(JSON.stringify(x))}))}f.callMethod=cm;(f.queue||[]).forEach(function(a){cm.apply(null,a)});f.queue=[];document.cookie='_fbp=fb.1.1700000000000.987654321; path=/';})();`;

async function newPage(b, { width, height, mobile, endpoint = `${MOCK}/exec`, pixel = '1234567890', consent = null, intro = false, nowPatch = false }) {
  const ctx = await b.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  await ctx.addInitScript(({ consent, intro, nowPatch }) => {
    try {
      if (!intro) sessionStorage.setItem('vg_intro', '1');
      if (consent) localStorage.setItem('vg_consent', JSON.stringify({ v: 1, date: new Date().toISOString(), necessary: true, ...consent }));
    } catch (e) {}
    if (nowPatch) { const real = performance.now.bind(performance); performance.now = () => Math.min(real(), 1500); }
  }, { consent, intro, nowPatch });
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.VG_CONFIG={SHEETS_ENDPOINT:${JSON.stringify(endpoint)},META_PIXEL_ID:${JSON.stringify(pixel)}};` }));
  const fbReq = [];
  await ctx.route(/facebook\.(net|com)/, (r) => { fbReq.push(r.request().url()); r.fulfill({ contentType: 'text/javascript', body: PIXEL_STUB }); });
  await ctx.route(/wa\.me/, (r) => r.fulfill({ contentType: 'text/html', body: '<p>wa</p>' }));
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  return { ctx, p, fbReq, logs };
}
const fbCalls = (p) => p.evaluate(() => window.__fb || []);
const step = (p) => p.evaluate(() => document.querySelector('#qform .qstep.is-active')?.dataset.step);

async function flow(p, { mobile, label }) {
  await p.evaluate(() => document.querySelector('#asesoramiento').scrollIntoView());
  await p.waitForTimeout(600);
  ok(await p.isDisabled('[data-next]'), `${label}: Siguiente deshabilitado en paso 1 sin elegir`);
  ok(await p.isHidden('[data-back]'), `${label}: sin botón Atrás en paso 1`);
  await p.click('label.opt:has(input[value="Ecógrafo"])');
  await p.click('label.opt:has(input[value="Diatermia / Tecar"])');
  ok(await p.isEnabled('[data-next]'), `${label}: Siguiente habilitado tras elegir`);
  await p.click('[data-next]');
  await p.waitForTimeout(450);
  ok((await step(p)) === '2', `${label}: avanza al paso 2`);
  ok((await p.textContent('[data-step-now]')).includes('Paso 2'), `${label}: contador "Paso 2 de 9"`);
  // Atrás conserva datos
  await p.click('[data-back]');
  await p.waitForTimeout(450);
  ok((await step(p)) === '1' && await p.isChecked('input[value="Ecógrafo"]') && await p.isChecked('input[value="Diatermia / Tecar"]'), `${label}: Atrás conserva las opciones`);
  await p.click('[data-next]');
  await p.waitForTimeout(450);
  // Paso 2: dropdown de modelos agrupado por producto
  await p.click('.qstep[data-step="2"] .dd__trigger');
  await p.waitForTimeout(400);
  const groups = await p.$$eval('.dd.is-open .dd__panel .dd__group, .dd__panel.is-sheet .dd__group', (els) => els.map((e) => e.textContent));
  ok(groups.includes('Ecógrafo') && groups.includes('Diatermia / Tecar') && !groups.includes('Presoterapia'), `${label}: modelos filtrados por el paso 1`, groups.join(' | '));
  if (mobile) {
    const sheet = await p.evaluate(() => { const el = document.querySelector('.dd__panel.is-sheet'); if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
    ok(!!sheet && sheet.bottom <= sheet.vh + 1 && sheet.top >= 0, `${label}: dropdown en hoja inferior dentro de pantalla`, JSON.stringify(sheet));
  }
  const PANEL = mobile ? '.dd__panel.is-sheet' : '.dd.is-open .dd__panel';
  await p.click(`${PANEL} .dd__opt:has-text("Acclarix AX8")`);
  await p.click(`${PANEL} .dd__opt:has-text("Reatherm (I-Tech)")`);
  if (mobile) await p.click(`${PANEL} .dd__done`); else await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  const pills = await p.$$eval('.qstep[data-step="2"] .dd__pill', (els) => els.map((e) => e.textContent.trim()));
  ok(pills.length === 2, `${label}: selección múltiple de modelos`, pills.join(', '));
  await p.click('[data-next]');
  await p.waitForTimeout(450);
  // Paso 3 y 4: avance automático
  await p.click('label.opt:has(input[value="Fisioterapeuta"])');
  await p.waitForTimeout(900);
  ok((await step(p)) === '4', `${label}: avance automático tras elegir perfil`);
  await p.click('label.opt:has(input[value="Lo antes posible"])');
  await p.waitForTimeout(900);
  ok((await step(p)) === '5', `${label}: avance automático tras elegir plazo`);
  // Paso 5: nombre
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'f-nombre'), `${label}: foco automático en el nombre`);
  await p.fill('#f-nombre', 'A');
  await p.press('#f-nombre', 'Enter');
  await p.waitForTimeout(200);
  ok((await p.textContent('.qstep[data-step="5"] [data-error]')).length > 5 && (await step(p)) === '5', `${label}: validación de nombre corto`);
  await p.fill('#f-nombre', 'Ana López');
  await p.press('#f-nombre', 'Enter');
  await p.waitForTimeout(450);
  ok((await step(p)) === '6', `${label}: Enter avanza al teléfono`);
  // Paso 6: teléfono
  await p.fill('#f-tel', '12345');
  await p.press('#f-tel', 'Enter');
  await p.waitForTimeout(200);
  ok((await step(p)) === '6' && (await p.textContent('.qstep[data-step="6"] [data-error]')).includes('9'), `${label}: validación de longitud del teléfono (ES)`);
  await p.fill('#f-tel', '');
  await p.type('#f-tel', '612345678');
  ok((await p.inputValue('#f-tel')) === '612 345 678', `${label}: formateo visual del teléfono`, await p.inputValue('#f-tel'));
  // Prefijo con buscador
  await p.click('.dd--prefix .dd__trigger');
  await p.waitForTimeout(350);
  if (!mobile) {
    await p.keyboard.type('portu');
    await p.waitForTimeout(150);
    const vis = await p.$$eval('.dd--prefix .dd__opt', (els) => els.filter((e) => !e.hidden).map((e) => e.textContent.trim()));
    ok(vis.length === 1 && vis[0].includes('Portugal'), `${label}: buscador de prefijos`, vis.join(','));
    await p.keyboard.press('Enter');
  } else {
    await p.fill('.dd__panel.is-sheet .dd__search input', 'portu');
    await p.click('.dd__panel.is-sheet .dd__opt:not([hidden])');
  }
  await p.waitForTimeout(500);
  ok((await p.textContent('.dd--prefix .dd__trigger')).includes('+351'), `${label}: prefijo Portugal seleccionado`);
  ok(await p.isDisabled('[data-next]'), `${label}: 612 no vale para Portugal (debe empezar por 2 o 9)`);
  // Volver a España pegando un número internacional
  await p.fill('#f-tel', '+34 612 345 678');
  await p.dispatchEvent('#f-tel', 'input');
  await p.waitForTimeout(150);
  ok((await p.textContent('.dd--prefix .dd__trigger')).includes('+34') && (await p.inputValue('#f-tel')) === '612 345 678', `${label}: detecta el prefijo al pegar +34`);
  await p.click('[data-next]');
  await p.waitForTimeout(450);
  // Paso 7: email con sugerencia
  await p.fill('#f-email', 'ana@gmial.com');
  await p.waitForTimeout(150);
  ok(await p.isVisible('[data-suggest] button'), `${label}: sugiere corrección de gmial.com`, await p.textContent('[data-suggest]'));
  await p.click('[data-suggest] button');
  ok((await p.inputValue('#f-email')) === 'ana@gmail.com', `${label}: corrige el dominio`);
  await p.press('#f-email', 'Enter');
  await p.waitForTimeout(450);
  // Paso 8: provincias
  ok((await step(p)) === '8', `${label}: paso 8 ubicación`);
  const provCount = await p.$$eval('.qstep[data-step="8"] .dd__opt, body > .dd__panel .dd__opt', (els) => els.length);
  await p.click('.qstep[data-step="8"] .dd__trigger');
  await p.waitForTimeout(400);
  const count = await p.$$eval('.dd__panel .dd__opt', (els) => els.filter((e) => e.closest('.dd__panel').offsetParent || e.closest('.is-sheet')).length);
  if (!mobile) {
    await p.keyboard.type('mala');
    await p.waitForTimeout(120);
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Enter');
  } else {
    await p.fill('.dd__panel.is-sheet .dd__search input', 'Málaga');
    await p.waitForTimeout(150);
    await p.click('.dd__panel.is-sheet .dd__opt:not([hidden])');
  }
  await p.waitForTimeout(500);
  ok((await p.textContent('.qstep[data-step="8"] .dd__trigger')).includes('Málaga'), `${label}: provincia elegida con buscador`, `${provCount} opciones en DOM`);
  await p.click('[data-next]');
  await p.waitForTimeout(450);
  // Paso 9: resumen y consentimiento
  const summary = await p.textContent('[data-summary]');
  ok(summary.includes('Ana López') && summary.includes('+34 612 345 678') && summary.includes('Málaga') && summary.includes('Acclarix AX8'), `${label}: resumen completo`);
  ok(await p.isDisabled('[data-submit]'), `${label}: Enviar deshabilitado sin consentimiento`);
  ok(!(await p.isChecked('input[name="consentimiento"]')), `${label}: consentimiento sin premarcar`);
  await p.click('label.consent');
  ok(await p.isEnabled('[data-submit]'), `${label}: Enviar habilitado con consentimiento`);
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  // ---------------------------------------------------------------- 1. Sin consentimiento no se carga nada de Meta
  {
    const { ctx, p, fbReq } = await newPage(b, { width: 1280, height: 860, mobile: false });
    await p.goto(`${BASE}/?utm_source=facebook&utm_campaign=test&fbclid=abc123`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    ok(fbReq.length === 0, 'Sin decisión de cookies no se pide fbevents.js');
    ok(await p.isVisible('#cookie-banner'), 'Banner de cookies visible en la primera visita');
    const btns = await p.$$eval('#cookie-banner .btn', (els) => els.map((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return [e.textContent.trim(), Math.round(r.width), Math.round(r.height), s.backgroundColor, s.color]; }));
    const sameStyle = btns.every((x) => x[3] === btns[0][3] && x[4] === btns[0][4] && x[2] === btns[0][2]);
    ok(btns.length === 3 && sameStyle, 'Aceptar, Rechazar y Configurar con el mismo peso visual', JSON.stringify(btns.map((x) => x.slice(0, 3))));
    await p.click('[data-cookie="reject"]');
    await p.waitForTimeout(800);
    ok(fbReq.length === 0 && !(await p.isVisible('#cookie-banner')), 'Rechazar: banner cerrado y sin píxel');
    // Cambiar desde el footer
    await p.click('[data-cookie-settings]');
    await p.waitForTimeout(300);
    ok(await p.isVisible('#cookie-panel'), 'Configurar cookies desde el footer abre el panel');
    await p.click('#cookie-panel label.switch:has([data-consent="marketing"])');
    await p.click('#cookie-panel [data-cookie="save"]');
    await p.waitForTimeout(800);
    const calls = await fbCalls(p);
    ok(fbReq.length === 1 && calls.some((c) => c[0] === 'track' && c[1] === 'PageView'), 'Aceptar marketing después: se carga el píxel y envía PageView', `${fbReq.length} petición(es)`);
    const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('vg_consent')));
    ok(stored && stored.marketing === true && !!stored.date, 'Elección guardada con fecha');
    // Retirar consentimiento
    await p.click('[data-cookie-settings]');
    await p.waitForTimeout(300);
    await p.click('#cookie-panel label.switch:has([data-consent="marketing"])');
    await p.click('#cookie-panel [data-cookie="save"]');
    await p.waitForTimeout(400);
    const before = (await fbCalls(p)).length;
    await p.click('.hero [data-catalog]');
    await p.waitForTimeout(400);
    const after = await fbCalls(p);
    ok(after.some((c) => c[0] === 'consent' && c[1] === 'revoke') && !after.slice(before).some((c) => c[0] === 'trackCustom'), 'Retirar marketing: revoca y deja de enviar eventos');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 2. Recorrido completo con éxito (escritorio) + eventos
  for (const vp of [{ width: 1280, height: 860, mobile: false, label: 'Escritorio' }, { width: 390, height: 844, mobile: true, label: 'Móvil' }]) {
    fs.writeFileSync(LOG, '');
    const { ctx, p, fbReq, logs } = await newPage(b, { ...vp, consent: { analytics: false, marketing: true } });
    await p.goto(`${BASE}/?utm_source=facebook&utm_campaign=test&fbclid=abc123`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    ok(fbReq.length === 1, `${vp.label}: con marketing aceptado se carga el píxel`);
    // ViewContent una vez por sección
    for (const id of ['ecografos', 'diatermias', 'ecografos', 'diatermias']) {
      await p.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
      await p.waitForTimeout(500);
    }
    let calls = await fbCalls(p);
    const vc = calls.filter((c) => c[1] === 'ViewContent').map((c) => c[2].content_category);
    ok(vc.length === 2 && vc.includes('Ecógrafos') && vc.includes('Diatermias'), `${vp.label}: ViewContent una vez por sección`, vc.join(','));
    // DescargaCatalogo
    const dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await p.evaluate(() => document.getElementById('catalogo').scrollIntoView());
    await p.waitForTimeout(500);
    await p.click('#catalogo [data-catalog]');
    const d = await dl;
    calls = await fbCalls(p);
    ok(calls.some((c) => c[0] === 'trackCustom' && c[1] === 'DescargaCatalogo') && !calls.some((c) => c[1] === 'Lead'), `${vp.label}: DescargaCatalogo (no es Lead)`, d ? d.suggestedFilename() : 'sin descarga');
    // Contact
    const pop = p.context().waitForEvent('page', { timeout: 4000 }).catch(() => null);
    await p.click('#preguntas [data-whatsapp]');
    const popup = await pop;
    calls = await fbCalls(p);
    ok(calls.some((c) => c[1] === 'Contact'), `${vp.label}: Contact al pulsar WhatsApp`, popup ? decodeURIComponent(popup.url()).slice(0, 90) : '');
    if (popup) await popup.close();
    // "Me interesa" preselecciona el modelo
    await p.evaluate(() => document.getElementById('ecografos').scrollIntoView());
    await p.waitForTimeout(500);
    if (vp.mobile) {
      await p.evaluate(() => { const t = document.querySelector('#ecografos .carousel__track'); t.scrollLeft = t.children[1].offsetLeft; });
      await p.waitForTimeout(400);
    }
    await p.click('#ecografos button[data-model="Acclarix AX8"].btn--primary');
    await p.waitForTimeout(1400);
    ok((await step(p)) === '2' && await p.isChecked('input[value="Ecógrafo"]'), `${vp.label}: "Me interesa" lleva al paso 2 con Ecógrafo`);
    const pill = await p.$$eval('.qstep[data-step="2"] .dd__pill', (els) => els.map((e) => e.textContent.trim()));
    ok(pill.join() === 'Acclarix AX8', `${vp.label}: modelo AX8 preseleccionado`, pill.join());
    const toast = await p.textContent('#toast');
    ok(toast.includes('Acclarix AX8'), `${vp.label}: aviso "Añadido"`, toast);
    // Reiniciar la selección y hacer el recorrido completo
    await p.evaluate(() => document.querySelectorAll('.qstep[data-step="2"] .dd__pill button').forEach((b) => b.click()));
    await p.click('[data-back]');
    await p.waitForTimeout(450);
    await p.click('label.opt:has(input[value="Ecógrafo"])');
    await flow(p, { mobile: vp.mobile, label: vp.label });
    // Doble clic en Enviar
    await p.dblclick('[data-submit]');
    await p.waitForTimeout(2500);
    const posts = readLog().filter((r) => r.method === 'POST');
    const preflight = readLog().filter((r) => r.method === 'OPTIONS');
    ok(posts.length === 1, `${vp.label}: doble clic genera un solo envío`, `${posts.length} POST`);
    ok(preflight.length === 0 && posts[0] && posts[0].ct.startsWith('text/plain'), `${vp.label}: sin preflight CORS (text/plain)`);
    const body = posts[0] ? JSON.parse(posts[0].body) : {};
    const need = ['nombre', 'telefono', 'email', 'ubicacion', 'productos', 'modelos', 'perfil', 'plazo', 'consentimiento', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'fbc', 'fbp', 'referrer', 'landing_url', 'dispositivo', 'navegador_idioma', 'event_id'];
    const missingKeys = need.filter((k) => !(k in body));
    ok(missingKeys.length === 0, `${vp.label}: el envío incluye todas las columnas`, missingKeys.join(','));
    ok(body.utm_source === 'facebook' && body.utm_campaign === 'test' && body.fbclid === 'abc123' && /^fb\.1\.\d+\.abc123$/.test(body.fbc) && body.fbp.startsWith('fb.1.'), `${vp.label}: UTM, fbclid, fbc y fbp correctos`, `${body.fbc} | ${body.fbp}`);
    ok(body.telefono === '+34 612 345 678' && body.ubicacion === 'Málaga' && body.productos === 'Ecógrafo, Diatermia / Tecar' && body.modelos.includes('Acclarix AX8'), `${vp.label}: datos del lead`, `${body.modelos}`);
    ok(body.landing_url.includes('utm_source=facebook'), `${vp.label}: URL de entrada con UTM`);
    ok(await p.isVisible('[data-done]') && (await p.textContent('[data-done-title]')).includes('Gracias, Ana.'), `${vp.label}: pantalla de gracias con el nombre`);
    const waHref = await p.getAttribute('[data-done-wa]', 'href');
    ok(decodeURIComponent(waHref).includes('Acclarix AX8'), `${vp.label}: WhatsApp prellenado con el producto`, decodeURIComponent(waHref).slice(0, 110));
    calls = await fbCalls(p);
    const leads = calls.filter((c) => c[1] === 'Lead');
    ok(leads.length === 1 && leads[0][3] && leads[0][3].eventID === body.event_id && leads[0][2].content_name === 'Ecógrafo, Diatermia / Tecar', `${vp.label}: Lead una sola vez con eventID = event_id`, leads.length ? JSON.stringify(leads[0].slice(2)) : 'sin Lead');
    await p.click('[data-done] [data-catalog]').catch(() => {});
    await p.waitForTimeout(300);
    ok((await fbCalls(p)).filter((c) => c[1] === 'Lead').length === 1, `${vp.label}: el Lead no se repite`);
    ok(logs.length === 0, `${vp.label}: consola sin errores ni avisos`, logs.join(' / '));
    await ctx.close();
  }

  // ---------------------------------------------------------------- 3. Endpoint vacío: error amable
  {
    fs.writeFileSync(LOG, '');
    const { ctx, p, logs } = await newPage(b, { width: 1280, height: 860, mobile: false, endpoint: '', consent: { analytics: false, marketing: false } });
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await p.click('#asesoramiento .fcard').catch(() => {});
    await p.waitForTimeout(300);
    await flow(p, { mobile: false, label: 'Endpoint vacío' });
    await p.click('[data-submit]');
    await p.waitForTimeout(1200);
    ok(await p.isVisible('[data-fail]'), 'Endpoint vacío: mensaje de error amable');
    ok(logs.some((l) => l.includes('SHEETS_ENDPOINT')), 'Endpoint vacío: aviso claro en consola', logs.find((l) => l.includes('SHEETS_ENDPOINT'))?.slice(0, 80));
    // Reintentar conserva los datos
    await p.click('[data-retry]');
    await p.waitForTimeout(1200);
    ok(await p.isVisible('[data-fail]') && (await p.inputValue('#f-nombre')) === 'Ana López', 'Reintentar conserva los datos');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 4. Error del servidor
  {
    fs.writeFileSync(LOG, '');
    const { ctx, p } = await newPage(b, { width: 1280, height: 860, mobile: false, endpoint: `${MOCK}/exec?mode=fail`, consent: { analytics: false, marketing: true } });
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await flow(p, { mobile: false, label: 'Error servidor' });
    await p.click('[data-submit]');
    await p.waitForTimeout(1500);
    ok(await p.isVisible('[data-fail]') && !(await fbCalls(p)).some((c) => c[1] === 'Lead'), 'Respuesta { ok:false }: error y sin evento Lead');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 5. Honeypot
  {
    fs.writeFileSync(LOG, '');
    const { ctx, p } = await newPage(b, { width: 1280, height: 860, mobile: false, consent: { analytics: false, marketing: true } });
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await flow(p, { mobile: false, label: 'Honeypot' });
    await p.evaluate(() => { document.querySelector('input[name="website"]').value = 'spam.com'; });
    await p.click('[data-submit]');
    await p.waitForTimeout(1500);
    ok(readLog().filter((r) => r.method === 'POST').length === 0 && !(await fbCalls(p)).some((c) => c[1] === 'Lead'), 'Honeypot relleno: no se envía ni se registra Lead');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 6. Tiempo mínimo de 3 s
  {
    fs.writeFileSync(LOG, '');
    const { ctx, p } = await newPage(b, { width: 1280, height: 860, mobile: false, consent: { analytics: false, marketing: true }, nowPatch: true });
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await flow(p, { mobile: false, label: 'Tiempo mínimo' });
    await p.click('[data-submit]');
    await p.waitForTimeout(1500);
    ok(readLog().filter((r) => r.method === 'POST').length === 0, 'Envío antes de 3 s: bloqueado');
    await ctx.close();
  }

  await b.close();
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} OK`);
  if (results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;
})();
