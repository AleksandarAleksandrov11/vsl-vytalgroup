// Servidor estático local que imita a Vercel (sin dependencias):
// · aplica las cabeceras de vercel.json (seguridad, CSP y caché) en el mismo orden,
// · URLs limpias (/privacidad sirve privacidad.html y /privacidad.html redirige a /privacidad),
// · redirecciones de vercel.json, compresión brotli/gzip y peticiones Range.
// Uso: node scripts/serve.mjs [carpeta] [puerto]      → por defecto "dist" y 8080
// Pruebas: CSP_CONNECT_EXTRA="http://localhost:8090" añade el Apps Script simulado a connect-src.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const root = resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || process.env.PORT || 8080);
const vercel = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
const rules = (vercel.headers || []).map((r) => ({ re: new RegExp(`^${r.source}$`), headers: r.headers }));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};
const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml', '.webmanifest']);
const cache = new Map();

function headersFor(path) {
  const out = {};
  for (const r of rules) {
    if (!r.re.test(path)) continue;
    for (const h of r.headers) out[h.key] = h.value;
  }
  const csp = out['Content-Security-Policy'];
  if (csp) {
    let v = csp;
    if (process.env.CSP_CONNECT_EXTRA) v = v.replace(/connect-src ([^;]+)/, `connect-src $1 ${process.env.CSP_CONNECT_EXTRA}`);
    // En local no hay https: upgrade-insecure-requests convertiría las peticiones a https://localhost
    v = v.replace(/;\s*upgrade-insecure-requests/, '');
    out['Content-Security-Policy'] = v;
  }
  return out;
}

async function exists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    let path = decodeURIComponent(u.pathname);
    const redirect = (to) => { res.writeHead(308, { Location: to + u.search }).end(); };
    for (const r of vercel.redirects || []) if (path === r.source) return redirect(r.destination);
    if (vercel.cleanUrls && path.endsWith('.html')) return redirect(path === '/index.html' ? '/' : path.slice(0, -5));
    if (vercel.trailingSlash === false && path.length > 1 && path.endsWith('/')) return redirect(path.slice(0, -1));
    let file = normalize(join(root, path === '/' ? '/index.html' : path));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (!extname(file) && vercel.cleanUrls && await exists(`${file}.html`)) file += '.html';
    if (!(await exists(file))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...headersFor(path) }).end('No encontrado');
      return;
    }
    const ext = extname(file);
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', ...headersFor(path) };
    let body = await readFile(file);
    const ae = req.headers['accept-encoding'] || '';
    if (TEXT.has(ext)) {
      const key = `${file}:${(await stat(file)).mtimeMs}`;
      if (ae.includes('br')) {
        if (!cache.has(`${key}:br`)) cache.set(`${key}:br`, brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
        body = cache.get(`${key}:br`); headers['Content-Encoding'] = 'br';
      } else if (ae.includes('gzip')) {
        if (!cache.has(`${key}:gz`)) cache.set(`${key}:gz`, gzipSync(body, { level: 9 }));
        body = cache.get(`${key}:gz`); headers['Content-Encoding'] = 'gzip';
      }
      headers.Vary = 'Accept-Encoding';
    }
    const range = req.headers.range;
    if (range && !headers['Content-Encoding']) {
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = Number(s);
      const end = e ? Number(e) : body.length - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      res.end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': body.length, 'Accept-Ranges': 'bytes' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(err));
  }
}).listen(port, () => console.log(`Sirviendo ${root} en http://localhost:${port} con las cabeceras de vercel.json`));
