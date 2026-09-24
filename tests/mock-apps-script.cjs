// Servidor que imita una aplicación web de Google Apps Script:
// POST /exec → 302 a /echo (como script.googleusercontent.com) → 200 JSON con CORS.
const http = require('http');
const fs = require('fs');
const LOG = process.argv[2] || 'mock-log.jsonl';
const port = Number(process.argv[3] || 8090);
let last = null;
http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    fs.appendFileSync(LOG, JSON.stringify({ method: req.method, url: req.url, ct: req.headers['content-type'] || '', body }) + '\n');
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    if (req.method === 'POST' && req.url.startsWith('/exec')) {
      let ok = true; let err = '';
      try { last = JSON.parse(body); } catch (e) { ok = false; err = 'JSON no válido'; }
      const mode = (req.url.match(/mode=(\w+)/) || [])[1];
      res.writeHead(302, { ...cors, Location: `/echo?ok=${ok && mode !== 'fail' ? 1 : 0}&err=${encodeURIComponent(err || (mode === 'fail' ? 'Fallo simulado' : ''))}` });
      res.end();
      return;
    }
    if (req.url.startsWith('/echo')) {
      const u = new URL(req.url, 'http://x');
      const ok = u.searchParams.get('ok') === '1';
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ok ? { ok: true } : { ok: false, error: u.searchParams.get('err') }));
      return;
    }
    res.writeHead(404, cors); res.end();
  });
}).listen(port, () => console.log('mock en', port));
