const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { sessionStorage.setItem('vg_intro','1'); localStorage.setItem('vg_consent', JSON.stringify({ v:1, date:new Date().toISOString(), necessary:true, analytics:false, marketing:false }));
  window.__ev = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.interactionId) window.__ev.push([e.name, Math.round(e.duration)]); })).observe({ type: 'event', durationThreshold: 16, buffered: true }); });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.goto('' + (process.env.BASE || 'http://localhost:8081') + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
const steps = [
  ['burger', () => p.tap('.burger')], ['cerrar menú', () => p.tap('.burger')],
  ['ver ficha', async () => { await p.evaluate(() => document.getElementById('ecografos').scrollIntoView()); await p.waitForTimeout(800); await p.tap('[aria-controls="ficha-ecow"]'); }],
  ['cerrar ficha', () => p.tap('#ficha-ecow .ficha__close')],
  ['me interesa', () => p.tap('#ecografos [data-model="Eco Wireless (VytaMeD)"].btn--primary')],
  ['abrir dropdown', async () => { await p.waitForTimeout(1500); await p.tap('.qstep[data-step="2"] .dd__trigger'); }],
  ['elegir modelo', () => p.tap('.dd__panel.is-sheet .dd__opt >> nth=1')],
  ['listo', () => p.tap('.dd__panel.is-sheet .dd__done')],
  ['siguiente', () => p.tap('[data-next]')],
  ['perfil', () => p.tap('label.opt:has(input[value="Médico"])')],
  ['acordeón', async () => { await p.evaluate(() => document.getElementById('preguntas').scrollIntoView()); await p.waitForTimeout(900); await p.tap('#faq-2-b'); }],
  ['filtro gama', async () => { await p.evaluate(() => document.querySelector('.range').scrollIntoView({block:'center'})); await p.waitForTimeout(900); await p.tap('.range__toggle'); await p.waitForTimeout(400); await p.tap('.chip[data-filter="carro"]'); }],
];
for (const [n, fn] of steps) { await fn(); await p.waitForTimeout(700); }
const ev = await p.evaluate(() => window.__ev);
const max = ev.reduce((m, e) => Math.max(m, e[1]), 0);
console.log('interacciones medidas:', ev.length, '| peor duración (≈INP):', max, 'ms');
console.log(ev.sort((a,b)=>b[1]-a[1]).slice(0,8).map(e=>e.join(' ')).join(' | '));
await b.close(); })();
