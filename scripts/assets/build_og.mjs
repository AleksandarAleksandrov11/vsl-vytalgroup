// Genera assets/brand/og-image.jpg (1200 × 630) con el diseño de la landing.
// Usa las mismas fuentes, logo e imagen del hero. Uso: node scripts/assets/build_og.mjs
// (CHROME_PATH=/ruta/a/chrome si Playwright no trae navegador)
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve('.');
const index = readFileSync('index.html', 'utf8');
const sprite = index.match(/<svg class="sprite"[\s\S]*?<\/svg>(?=\s*<a class="skip")/)[0];
const f = (p) => `file://${root}/${p}`;
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face { font-family: Geist; src: url(${f('assets/fonts/geist.woff2')}); font-weight: 400 600; }
@font-face { font-family: "Instrument Serif"; src: url(${f('assets/fonts/instrument-serif-italic.woff2')}); font-style: italic; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #FAFBFC; font-family: Geist; color: #0B1929; position: relative; }
body::before { content: ""; position: absolute; right: -160px; top: -40px; width: 820px; height: 820px; border-radius: 50%; background: radial-gradient(closest-side, #FFF, rgba(255,255,255,0)); }
.logo { position: absolute; left: 72px; top: 64px; height: 30px; width: auto; aspect-ratio: 1117/171; --logo-m: url(#vgl); --logo-a: #102850; --logo-b: #48A0A8; }
.lg-m { fill: var(--logo-m); } .lg-a { fill: var(--logo-a); } .lg-b { fill: var(--logo-b); }
h1 { position: absolute; left: 72px; top: 156px; width: 600px; font-size: 70px; line-height: 1.02; letter-spacing: -.04em; font-weight: 560; }
h1 em { font-family: "Instrument Serif"; font-style: italic; font-weight: 400; font-size: 1.08em; letter-spacing: -.012em; }
p { position: absolute; left: 72px; top: 440px; font-size: 26px; color: #3E4C5C; letter-spacing: -.01em; }
.trust { top: 520px; font-size: 18px; color: #5E6C7B; }
img { position: absolute; right: 48px; top: 104px; width: 450px; }
</style></head><body>${sprite}
<svg class="logo" viewBox="0 0 1117 171"><use href="#logo"/></svg>
<h1>Ecógrafos y diatermias, <em>sin letra pequeña.</em></h1>
<p>Te asesora Javier, fisioterapeuta. No un comercial.</p>
<p class="trust">Certificados CE · 2 años de garantía · Mantenimiento asegurado</p>
<img src="${f('assets/img/hero-vytamed-760.webp')}" alt="">
</body></html>`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// Se abre como archivo local para que carguen las fuentes y la imagen (file://)
const dir = mkdtempSync(join(tmpdir(), 'og-'));
writeFileSync(join(dir, 'og.html'), html);
await page.goto(`file://${join(dir, 'og.html')}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'assets/brand/og-image.jpg', type: 'jpeg', quality: 88 });
await browser.close();
rmSync(dir, { recursive: true, force: true });
console.log('assets/brand/og-image.jpg');
