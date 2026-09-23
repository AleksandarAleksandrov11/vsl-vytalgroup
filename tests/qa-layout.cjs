// Capturas de página completa y comprobación de desbordamiento horizontal en todos los anchos.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:' + (process.env.PORT || 8081);
const OUT = process.argv[2];
const PAGE = process.argv[3] || '/';
const SIZES = [
  [320, 700, true], [360, 780, true], [375, 812, true], [390, 844, true], [414, 896, true], [430, 932, true],
  [768, 1024, true], [820, 1180, true], [1024, 768, false], [1280, 800, false], [1440, 900, false], [1920, 1080, false],
  [844, 390, true], [932, 430, true],
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const rows = [];
  for (const [w, h, touch] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: touch && w < 1000, hasTouch: touch });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('vg_intro', '1'); localStorage.setItem('vg_consent', JSON.stringify({ v: 1, date: new Date().toISOString(), necessary: true, analytics: false, marketing: false })); } catch (e) {} });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    await p.goto(BASE + PAGE, { waitUntil: 'networkidle' });
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += Math.round(h * 0.7)) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(120); }
    await p.waitForTimeout(800);
    const res = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const clipped = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX)) return true; } return false; };
      const bad = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || getComputedStyle(el).position === 'fixed') return;
        if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} [${Math.round(r.left)},${Math.round(r.right)}]`);
      });
      // Textos cortados: elementos de texto con desbordamiento interno visible
      const cut = [];
      document.querySelectorAll('h1,h2,h3,p,a,button,li,dd,dt,span').forEach((el) => {
        const s = getComputedStyle(el);
        if (s.overflow === 'hidden' && s.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !el.closest('.sr-only,.hp,.dd__panel,[hidden]')) cut.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
      });
      const small = [];
      document.querySelectorAll('a, button, input, [role="option"], label.opt, label.consent').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || el.closest('[hidden], .sr-only, .hp, .sprite, .ficha:not(.is-open), .dd__panel, footer p') || getComputedStyle(el).visibility === 'hidden') return;
        if (el.matches('.opt input, .consent input, .switch input')) return;
        if (r.height < 43.5 || r.width < 43.5) small.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || el.textContent.trim().slice(0, 18)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      });
      return { scrollWidth: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 8), cut: cut.slice(0, 8), small: [...new Set(small)].slice(0, 12) };
    });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(300);
    await p.addStyleTag({ content: '.header{position:absolute!important}.ctabar,.wa-float,.skip,.toast{display:none!important}' });
    await p.screenshot({ path: `${OUT}_${w}x${h}.png`, fullPage: true });
    rows.push(`${res.scrollWidth <= res.vw ? 'PASS' : 'FAIL'}  ${w}x${h}  scrollWidth=${res.scrollWidth} vw=${res.vw}${res.bad.length ? `  desbordan: ${res.bad.join('; ')}` : ''}${res.cut.length ? `  cortados: ${res.cut.join('; ')}` : ''}${errs.length ? `  consola: ${errs.join(' / ')}` : ''}\n      táctil<44: ${res.small.join('; ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(rows.join('\n'));
})();
