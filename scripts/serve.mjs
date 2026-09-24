// Servidor estático local para desarrollo y pruebas (sin dependencias).
// Uso: node scripts/serve.mjs [carpeta] [puerto]   → por defecto "." y 8080
// Comprime con brotli/gzip los archivos de texto y aplica una caché parecida a la de producción.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const root = resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.ico': 'image/x-icon',
};
const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml', '.webmanifest']);
const cache = new Map();

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const st = await stat(file);
    const ext = extname(file);
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
    headers['Cache-Control'] = /\/assets\/(css|js|fonts|img|video)\//.test(path) && /\.[a-f0-9]{8}\./.test(path)
      ? 'public, max-age=31536000, immutable' : 'no-cache';
    let body = await readFile(file);
    const ae = req.headers['accept-encoding'] || '';
    if (TEXT.has(ext)) {
      const key = `${file}:${st.mtimeMs}`;
      if (ae.includes('br')) {
        if (!cache.has(`${key}:br`)) cache.set(`${key}:br`, brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
        body = cache.get(`${key}:br`); headers['Content-Encoding'] = 'br';
      } else if (ae.includes('gzip')) {
        if (!cache.has(`${key}:gz`)) cache.set(`${key}:gz`, gzipSync(body, { level: 9 }));
        body = cache.get(`${key}:gz`); headers['Content-Encoding'] = 'gzip';
      }
      headers.Vary = 'Accept-Encoding';
    }
    // Soporte de Range para vídeo (Safari lo exige)
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
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
  }
}).listen(port, () => console.log(`Sirviendo ${root} en http://localhost:${port}`));
