// Ejecuta las pruebas automáticas contra la versión compilada (dist/), servida con las
// cabeceras de vercel.json (CSP incluida):
//  · qa-form   → formulario de 2 pasos (equipo; nombre y WhatsApp), desplegables, validaciones, envío
//                (Apps Script simulado), UTM, antispam, consentimiento y eventos del píxel
//                (Meta simulado, sin salir a internet).
//  · qa-ui     → estructura (secciones, palabras, un CTA por sección), cabecera, barra de progreso,
//                hero (escaparate con ondas), alineación, línea de confianza, segmentado,
//                carrusel, más equipos, comparador, descarga del catálogo,
//                catálogo, acordeón, conteo, barra móvil, fuentes, teclado, movimiento reducido,
//                CSP, caché y metadatos.
//  · qa-layout → capturas de página completa en todos los anchos y comprobación por código de
//                desbordamientos, textos cortados y áreas táctiles.
// Uso: npm run build && npm test     (CHROME_PATH=/ruta/a/chrome si Playwright no trae navegador)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PORT = process.env.PORT || '8081';
const out = join('tests', 'output');
mkdirSync(join(out, 'screenshots'), { recursive: true });
const log = join(out, 'mock-log.jsonl');
writeFileSync(log, '');

const bg = [
  spawn(process.execPath, ['scripts/serve.mjs', 'dist', PORT], { stdio: 'ignore', env: { ...process.env, CSP_CONNECT_EXTRA: 'http://localhost:8090' } }),
  spawn(process.execPath, ['tests/mock-apps-script.cjs', log, '8090'], { stdio: 'ignore' }),
];
const env = { ...process.env, PORT, BASE: `http://localhost:${PORT}` };
const run = (file, args = []) => new Promise((resolve) => {
  const p = spawn(process.execPath, [file, ...args], { stdio: 'inherit', env });
  p.on('exit', (code) => resolve(code));
});

await new Promise((r) => setTimeout(r, 800));
let failed = 0;
for (const [file, args] of [
  ['tests/qa-form.cjs', [log]],
  ['tests/qa-ui.cjs', []],
  ['tests/qa-layout.cjs', [join(out, 'screenshots')]],
]) {
  console.log(`\n▶ ${file}`);
  failed += (await run(file, args)) ? 1 : 0;
}
bg.forEach((p) => p.kill());
process.exit(failed ? 1 : 0);
