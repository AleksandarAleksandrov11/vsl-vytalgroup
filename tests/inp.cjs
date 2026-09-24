// Mide la latencia de las interacciones (base del INP) en un móvil con la CPU ralentizada ×4.
// Uso: node tests/inp.cjs   (con dist/ servido en BASE, por defecto http://localhost:8081)
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('vg_consent', JSON.stringify({ v: 2, date: new Date().toISOString(), necessary: true, marketing: false }));
    window.__ev = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.interactionId) window.__ev.push([e.name, Math.round(e.duration)]); }))
      .observe({ type: 'event', durationThreshold: 16, buffered: true });
  });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto(`${process.env.BASE || 'http://localhost:8081'}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const go = (sel) => p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
  const steps = [
    ['historia (siguiente)', () => p.tap('[data-reel-next]', { position: { x: 60, y: 120 } })],
    ['historia (pausa)', () => p.tap('[data-reel-toggle]')],
    ['segmentado', async () => { await go('#equipos .seg'); await p.waitForTimeout(900); await p.tap('#tab-dia'); }],
    ['segmentado (vuelta)', () => p.tap('#tab-eco')],
    ['lo quiero', () => p.tap('[data-want="Acclarix LX9 (EDAN)"]')],
    ['siguiente', async () => { await p.waitForTimeout(1500); await p.tap('.qf__step.is-active [data-next]'); }],
    ['perfil', () => p.tap('.qf__step.is-active label.opt:has(input[value="Fisioterapeuta"])')],
    ['plazo', () => p.tap('.qf__step.is-active label.opt:has(input[value="Lo antes posible"])')],
    ['nombre', async () => { await p.tap('#f-name'); await p.keyboard.type('Ana'); }],
    ['siguiente', () => p.tap('.qf__step.is-active [data-next]')],
    ['prefijo', () => p.tap('.sel--prefix .sel__btn')],
    ['elegir país', () => p.tap('.sel--prefix .sel__opt:has-text("Portugal")')],
    ['acordeón', async () => { await go('#q3'); await p.waitForTimeout(900); await p.tap('#q3'); }],
    ['acordeón (cerrar)', () => p.tap('#q3')],
  ];
  for (const [, fn] of steps) { await fn(); await p.waitForTimeout(700); }
  const ev = await p.evaluate(() => window.__ev);
  const max = ev.reduce((m, e) => Math.max(m, e[1]), 0);
  console.log(`Interacciones medidas: ${ev.length} | peor duración (≈INP): ${max} ms ${max < 200 ? '(< 200 ms, correcto)' : '(supera 200 ms)'}`);
  console.log(ev.sort((a, c) => c[1] - a[1]).slice(0, 6).map((e) => e.join(' ')).join(' | '));
  await b.close();
  process.exit(max < 200 ? 0 : 1);
})();
