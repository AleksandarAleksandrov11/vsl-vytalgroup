// Compilación de producción → dist/ (lo que publica Vercel)
// · SITE_URL (site.config.mjs) → canonical, og:url, og:image, JSON-LD, sitemap.xml y robots.txt
//   (en los HTML fuente se escribe https://site-url.invalid y aquí se sustituye).
// · Todo /assets lleva hash en el nombre (caché inmutable), salvo el PDF del catálogo.
// · CSS: lightningcss (minificado) e insertado inline en cada HTML (no bloquea el render).
// · JS: esbuild (módulos ES, división de código, minificado, hash). Sin scripts inline (CSP).
// · HTML: rutas reescritas a los archivos con hash y minificado.
// · Informe de pesos y presupuestos (gzip).
import { build } from 'esbuild';
import { transform } from 'lightningcss';
import { minify } from 'html-minifier-terser';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SITE_URL } from '../site.config.mjs';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const PAGES = ['index.html', 'aviso-legal.html', 'privacidad.html', 'cookies.html'];
const HASHED = ['assets/brand', 'assets/fonts', 'assets/img'];
const PDF = 'assets/docs/catalogo-vytalgroup-2026.pdf';
const TARGETS = { chrome: 100 << 16, safari: 15 << 16, ios_saf: 15 << 16, firefox: 100 << 16, edge: 100 << 16, samsung: 16 << 16 };
const BUDGET = { initial: 250, js: 30, css: 25 };
const PLACEHOLDER = 'https://site-url.invalid'; // en los HTML fuente; se sustituye por SITE_URL

if (!/^https:\/\/[^/]+$/.test(SITE_URL)) throw new Error(`SITE_URL no válida: "${SITE_URL}" (https y sin barra final)`);

const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);
const map = new Map(); // '/assets/img/a.webp' → '/assets/img/a.1a2b3c4d.webp'
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const url = (p) => `/${relative(DIST, p).replace(/\\/g, '/')}`;

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// ---------------------------------------------------------------- recursos con hash
for (const dir of HASHED) {
  mkdirSync(join(DIST, dir), { recursive: true });
  for (const file of readdirSync(join(ROOT, dir))) {
    const src = join(ROOT, dir, file);
    if (!statSync(src).isFile()) continue;
    const buf = readFileSync(src);
    const ext = extname(file);
    const out = `${basename(file, ext)}.${hash(buf)}${ext}`;
    writeFileSync(join(DIST, dir, out), buf);
    map.set(`/${dir}/${file}`, `/${dir}/${out}`);
  }
}
mkdirSync(join(DIST, 'assets/docs'), { recursive: true });
cpSync(join(ROOT, PDF), join(DIST, PDF));
cpSync(join(ROOT, 'config.js'), join(DIST, 'config.js'));

const rewrite = (text) => {
  // Primero las rutas más largas, para evitar coincidencias parciales
  for (const k of [...map.keys()].sort((a, b) => b.length - a.length)) text = text.split(k).join(map.get(k));
  return text.split(PLACEHOLDER).join(SITE_URL);
};

// ---------------------------------------------------------------- CSS (inline)
const cssCache = new Map();
const css = (file) => {
  if (!cssCache.has(file)) {
    cssCache.set(file, transform({
      filename: file,
      code: Buffer.from(rewrite(readFileSync(join(ROOT, file), 'utf8'))),
      minify: true,
      targets: TARGETS,
    }).code.toString());
  }
  return cssCache.get(file);
};

// ---------------------------------------------------------------- JS
const result = await build({
  entryPoints: ['assets/js/main.js', 'assets/js/legal.js'],
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: ['es2020', 'chrome100', 'safari15', 'firefox100', 'edge100'],
  outdir: join(DIST, 'assets/js'),
  entryNames: '[name].[hash]',
  chunkNames: '[name].[hash]',
  metafile: true,
  legalComments: 'none',
  logLevel: 'warning',
});
const preloads = {};
for (const [out, meta] of Object.entries(result.metafile.outputs)) {
  if (!meta.entryPoint) continue;
  map.set(`/${meta.entryPoint}`, url(join(ROOT, out)));
  preloads[meta.entryPoint] = meta.imports.filter((i) => i.kind === 'import-statement').map((i) => url(join(ROOT, i.path)));
}

// ---------------------------------------------------------------- HTML
const inlineCss = {};
for (const file of PAGES) {
  let html = readFileSync(join(ROOT, file), 'utf8');
  // Los <link data-inline> consecutivos se sustituyen por un único <style>
  const links = [...html.matchAll(/<link rel="stylesheet" href="\/(assets\/css\/[\w-]+\.css)" data-inline>\s*/g)];
  if (!links.length) throw new Error(`${file}: sin CSS`);
  const style = links.map((m) => css(m[1])).join('');
  inlineCss[file] = style;
  html = html.replace(links[0][0], `<style>${style}</style>`);
  for (const m of links.slice(1)) html = html.replace(m[0], '');
  for (const [entry, list] of Object.entries(preloads)) {
    const tag = `<script type="module" src="/${entry}"></script>`;
    if (html.includes(tag) && list.length) html = html.replace(tag, list.map((u) => `<link rel="modulepreload" href="${u}">`).join('') + tag);
  }
  html = rewrite(html);
  if (html.includes(PLACEHOLDER) || /\/assets\/(img|fonts|brand|js|css|video)\/[\w-]+\.(avif|webp|png|jpg|svg|woff2|js|css|mp4|webm)\b/.test(html)) throw new Error(`${file}: quedan rutas sin hash o sin SITE_URL`);
  const min = await minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: false,
    removeComments: true,
    minifyJS: false,
    minifyCSS: false,
    keepClosingSlash: false,
    removeRedundantAttributes: false,
    sortAttributes: false,
  });
  mkdirSync(dirname(join(DIST, file)), { recursive: true });
  writeFileSync(join(DIST, file), min);
}

// ---------------------------------------------------------------- manifest, sitemap y robots
writeFileSync(join(DIST, 'site.webmanifest'), rewrite(readFileSync(join(ROOT, 'site.webmanifest'), 'utf8')));
const today = new Date().toISOString().slice(0, 10);
const urls = ['/', '/aviso-legal', '/privacidad', '/cookies'];
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u, i) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod><priority>${i ? '0.3' : '1.0'}</priority></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// ---------------------------------------------------------------- informe y presupuestos
const file = (p) => readFileSync(join(DIST, p.replace(/^\//, '')));
// Fondo del hero en móvil (foto difuminada: pesa muy poco)
const heroMobile = map.get('/assets/img/hero-fondo-m-600.webp');
const initial = [
  ['index.html (con CSS inline)', gz(file('index.html'))],
  ['config.js', gz(file('config.js'))],
  [map.get('/assets/js/main.js'), gz(file(map.get('/assets/js/main.js')))],
  ...preloads['assets/js/main.js'].map((u) => [u, gz(file(u))]),
  [map.get('/assets/fonts/geist.woff2'), file(map.get('/assets/fonts/geist.woff2')).length],
  [map.get('/assets/fonts/instrument-serif-italic.woff2'), file(map.get('/assets/fonts/instrument-serif-italic.woff2')).length],
  [heroMobile, file(heroMobile).length],
];
let total = 0;
console.log(`SITE_URL: ${SITE_URL}\n\nCarga inicial (texto en gzip, binarios tal cual):`);
for (const [name, size] of initial) {
  total += size;
  console.log(`  ${name.padEnd(52)} ${kb(size).padStart(9)}`);
}
console.log(`  ${'TOTAL'.padEnd(52)} ${kb(total).padStart(9)}  (presupuesto ${BUDGET.initial} KB)`);
const js = readdirSync(join(DIST, 'assets/js')).reduce((a, f) => a + gz(readFileSync(join(DIST, 'assets/js', f))), 0);
const cssIndex = gz(Buffer.from(inlineCss['index.html']));
console.log(`JS propio total (gzip): ${kb(js)} (presupuesto ${BUDGET.js} KB)`);
console.log(`CSS de la landing (gzip): ${kb(cssIndex)} (presupuesto ${BUDGET.css} KB)`);
console.log(`Catálogo PDF: ${kb(statSync(join(DIST, PDF)).size)}`);
const over = [total > BUDGET.initial * 1024 && 'carga inicial', js > BUDGET.js * 1024 && 'JS', cssIndex > BUDGET.css * 1024 && 'CSS'].filter(Boolean);
if (over.length) throw new Error(`Presupuesto superado: ${over.join(', ')}`);
console.log('\nListo: dist/');
