// Compilación de producción → dist/
// · JS: esbuild (módulos ES, división de código, minificado, hash en el nombre).
// · CSS: lightningcss (minificado); el CSS crítico se inserta inline en cada HTML.
// · Imágenes, fuentes y vídeos: se copian con hash en el nombre (caché de un año).
// · HTML: referencias reescritas a los archivos con hash y minificado.
// · Informe final de pesos (gzip y brotli) y del presupuesto de la carga inicial.
import { build } from 'esbuild';
import { transform } from 'lightningcss';
import { minify } from 'html-minifier-terser';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const HTML = ['index.html', 'aviso-legal.html', 'privacidad.html', 'cookies.html'];
const HASHED_DIRS = ['assets/fonts', 'assets/img', 'assets/video'];
const COPY = ['assets/brand', 'assets/docs', 'config.js', 'robots.txt', 'sitemap.xml', 'site.webmanifest', '_headers'];
const TARGETS = { chrome: 100 << 16, safari: 15 << 16, ios_saf: 15 << 16, firefox: 100 << 16, edge: 100 << 16, samsung: 16 << 16 };

const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);
const map = new Map(); // '/assets/img/a.webp' → '/assets/img/a.1a2b3c4d.webp'
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// ---------------------------------------------------------------- recursos con hash
for (const dir of HASHED_DIRS) {
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
for (const item of COPY) cpSync(join(ROOT, item), join(DIST, item), { recursive: true });

const rewrite = (text) => {
  // Sustituye primero las rutas más largas para evitar coincidencias parciales
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  for (const k of keys) text = text.split(k).join(map.get(k));
  return text;
};

// ---------------------------------------------------------------- CSS
const css = (file) => transform({
  filename: file,
  code: Buffer.from(rewrite(readFileSync(join(ROOT, file), 'utf8'))),
  minify: true,
  targets: TARGETS,
}).code.toString();

const critical = css('assets/css/critical.css');
mkdirSync(join(DIST, 'assets/css'), { recursive: true });
for (const f of ['main.css', 'legal.css']) {
  const code = css(`assets/css/${f}`);
  const out = `${basename(f, '.css')}.${hash(code)}.css`;
  writeFileSync(join(DIST, 'assets/css', out), code);
  map.set(`/assets/css/${f}`, `/assets/css/${out}`);
}

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
  const url = `/${relative(DIST, join(ROOT, out)).replace(/\\/g, '/')}`;
  map.set(`/${meta.entryPoint}`, url);
  preloads[meta.entryPoint] = meta.imports
    .filter((i) => i.kind === 'import-statement')
    .map((i) => `/${relative(DIST, join(ROOT, i.path)).replace(/\\/g, '/')}`);
}

// ---------------------------------------------------------------- HTML
for (const file of HTML) {
  let html = readFileSync(join(ROOT, file), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="\/assets\/css\/critical\.css" data-inline>/, `<style>${critical}</style>`);
  for (const [entry, list] of Object.entries(preloads)) {
    if (!html.includes(`src="/${entry}"`) || !list.length) continue;
    const tags = list.map((u) => `<link rel="modulepreload" href="${u}">`).join('');
    html = html.replace(`<script type="module" src="/${entry}"></script>`, `${tags}<script type="module" src="/${entry}"></script>`);
  }
  html = rewrite(html);
  const min = await minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: false,
    removeComments: true,
    minifyJS: true,
    minifyCSS: false,
    removeRedundantAttributes: false,
    keepClosingSlash: false,
    sortAttributes: false,
  });
  mkdirSync(dirname(join(DIST, file)), { recursive: true });
  writeFileSync(join(DIST, file), min);
}

// ---------------------------------------------------------------- informe
const size = (p) => {
  const buf = readFileSync(join(DIST, p));
  return { raw: buf.length, gz: gzipSync(buf, { level: 9 }).length, br: brotliCompressSync(buf).length };
};
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const initial = [
  'index.html',
  map.get('/assets/css/main.css'),
  'config.js',
  map.get('/assets/js/main.js'),
  ...preloads['assets/js/main.js'],
  map.get('/assets/fonts/syne-800.woff2'),
  map.get('/assets/fonts/inter-400.woff2'),
  map.get('/assets/fonts/inter-500.woff2'),
  map.get('/assets/fonts/inter-600.woff2'),
  map.get('/assets/img/hero-diatermia-640.avif'),
].map((p) => p.replace(/^\//, ''));
let total = 0;
console.log('\nCarga inicial (sin vídeo):');
for (const p of initial) {
  const s = size(p);
  const bin = /\.(woff2|avif|webp)$/.test(p);
  const w = bin ? s.raw : s.gz;
  total += w;
  console.log(`  ${p.padEnd(52)} ${kb(w).padStart(9)} ${bin ? '(binario)' : '(gzip)'}`);
}
console.log(`  ${'TOTAL'.padEnd(52)} ${kb(total).padStart(9)}  (presupuesto 350 KB)`);
const js = readdirSync(join(DIST, 'assets/js')).map((f) => size(`assets/js/${f}`)).reduce((a, s) => a + s.gz, 0);
const cssAll = size(map.get('/assets/css/main.css').slice(1)).gz + gzipSync(Buffer.from(critical)).length;
console.log(`\nJS propio total (gzip): ${kb(js)} (presupuesto 40 KB)`);
console.log(`CSS total, crítico + principal (gzip): ${kb(cssAll)} (presupuesto 35 KB)`);
console.log(`HTML index (gzip, con CSS crítico inline): ${kb(size('index.html').gz)}`);
if (!indexHtml.includes('<style>')) throw new Error('No se ha insertado el CSS crítico');
if (!existsSync(join(DIST, 'assets/docs/catalogo-vytalgroup-2026.pdf'))) throw new Error('Falta el catálogo PDF');
console.log(`Catálogo PDF: ${kb(statSync(join(DIST, 'assets/docs/catalogo-vytalgroup-2026.pdf')).size)}`);
console.log('\nListo: dist/');
