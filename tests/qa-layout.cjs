// Capturas de página completa en todos los anchos del brief (y en horizontal) y comprobación por código:
// scroll horizontal, elementos fuera de pantalla, textos cortados, solapes con la cabecera y áreas táctiles.
const { chromium } = require('playwright');

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 8081}`;
const OUT = process.argv[2];
const SIZES = [
  [320, 640], [360, 780], [375, 667], [390, 844], [414, 896], [430, 932],
  [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080],
  [844, 390], [932, 430],
];
const PAGES = [['/', 'index'], ['/privacidad', 'privacidad'], ['/cookies', 'cookies']];

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const rows = [];
  let fails = 0;
  for (const [url, name] of PAGES) {
    for (const [w, h] of (name === 'index' ? SIZES : [[320, 640], [1440, 900]])) {
      const touch = w < 1024 || h < 500;
      const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
      await ctx.addInitScript(() => { try { localStorage.setItem('vg_consent', JSON.stringify({ v: 2, date: new Date().toISOString(), necessary: true, marketing: false })); } catch (e) { /* */ } });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); });
      await p.goto(BASE + url, { waitUntil: 'networkidle' });
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += Math.round(h * 0.6)) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(90); }
      await p.waitForTimeout(1200);
      const res = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const clipped = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX)) return true; } return false; };
        const shown = (el) => el.checkVisibility({ visibilityProperty: true }) && !el.closest('[hidden], .sr-only, .hp, .sprite, [inert]');
        const bad = [];
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || getComputedStyle(el).position === 'fixed' || el.closest('.sel__panel, .ck, .cp, .hp') || !el.checkVisibility({ visibilityProperty: true })) return;
          if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) bad.push(`${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]} [${Math.round(r.left)},${Math.round(r.right)}]`);
        });
        const cut = [];
        document.querySelectorAll('h1,h2,h3,p,a,button,li,dd,dt,span,label').forEach((el) => {
          if (!shown(el) || el.closest('.cards')) return;
          if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && getComputedStyle(el).overflowX !== 'visible') cut.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
        });
        // Palabras partidas o que se salen de su caja (texto más ancho que su contenedor)
        const wide = [];
        document.querySelectorAll('h1, h2, h3, .btn, .card__data dd, .card__data div, .why__list li, .hd__bar, .seg, .cat__name, .cmp__table td, .tst figure').forEach((el) => {
          if (!shown(el)) return;
          const box = el.getBoundingClientRect();
          const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          while (tw.nextNode()) {
            const range = document.createRange();
            range.selectNodeContents(tw.currentNode);
            for (const t of range.getClientRects()) {
              if (t.width && (t.right > box.right + 2 || t.left < box.left - 2)) { wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`); return; }
            }
          }
        });
        // Botones, datos y cifras en una sola línea (sin partirse)
        document.querySelectorAll('.btn, .seg__btn, .card__data dd, .why__list strong, .catalog__meta, .reel__cap, .reel__who strong, .reel__who small, .sel__btn, .lhd__back, .hd__logo').forEach((el) => {
          if (!shown(el)) return;
          const tops = new Set();
          const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          while (tw.nextNode()) {
            if (!tw.currentNode.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(tw.currentNode);
            for (const r of range.getClientRects()) if (r.width) tops.add(Math.round(r.top / 4));
          }
          if (tops.size > 1) wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} (partido: "${el.textContent.trim().slice(0, 24)}")`);
        });
        const small = [];
        document.querySelectorAll('a, button, input, [role="option"], [role="tab"]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || !shown(el) || el.closest('.sel:not(.is-open) .sel__panel, .cp:not([open]), .ck[hidden]')) return;
          if (el.matches('.opt input, .check input, .switch, .hp input')) return;
          // Enlaces dentro de un párrafo: exentos (WCAG 2.5.8)
          if (el.tagName === 'A' && el.closest('p, li, dd, td') && !el.matches('.link, .btn') && getComputedStyle(el).display === 'inline') return;
          if (r.height < 43.5 || r.width < 43.5) small.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || el.textContent.trim().slice(0, 18)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        });
        // En la primera pantalla, la cabecera no tapa el titular
        window.scrollTo({ top: 0, behavior: 'instant' });
        const hd = document.querySelector('[data-header], .lhd');
        const h1 = document.querySelector('h1');
        const overlap = hd && h1 && hd.getBoundingClientRect().bottom > h1.getBoundingClientRect().top + 1;
        return { sw: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 6), cut: [...new Set(cut)].slice(0, 6), wide: [...new Set(wide)].slice(0, 6), small: [...new Set(small)].slice(0, 8), overlap };
      });
      await p.waitForTimeout(300);
      await p.addStyleTag({ content: '[data-header]{position:absolute!important}.mbar{display:none!important}' });
      await p.screenshot({ path: `${OUT}/${name}-${w}x${h}.png`, fullPage: true });
      const pass = res.sw <= res.vw && !res.bad.length && !res.cut.length && !res.wide.length && !res.small.length && !res.overlap && !errs.length;
      if (!pass) fails++;
      rows.push(`${pass ? 'PASS' : 'FAIL'}  ${name} ${w}x${h}  scrollWidth=${res.sw} vw=${res.vw}${res.bad.length ? `  desbordan: ${res.bad.join('; ')}` : ''}${res.cut.length ? `  cortados: ${res.cut.join('; ')}` : ''}${res.wide.length ? `  se salen: ${res.wide.join('; ')}` : ''}${res.small.length ? `  táctil<44: ${res.small.join('; ')}` : ''}${res.overlap ? '  la cabecera tapa el titular' : ''}${errs.length ? `  consola: ${errs.join(' / ')}` : ''}`);
      await ctx.close();
    }
  }
  await b.close();
  console.log(rows.join('\n'));
  console.log(`\n${rows.length - fails}/${rows.length} tamaños OK`);
  process.exit(fails ? 1 : 0);
})();
