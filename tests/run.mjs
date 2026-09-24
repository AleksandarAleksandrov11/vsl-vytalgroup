// Ejecuta las pruebas automáticas contra la versión compilada (dist/), servida con las
// cabeceras de vercel.json (CSP incluida):
//  · qa-apps-script → el Apps Script real (integrations/google-sheets.gs) contra una hoja simulada:
//                columnas, WhatsApp o correo, enlace de WhatsApp, aviso por email, duplicados,
//                campo trampa y validaciones.
//  · qa-form   → formulario de 4 preguntas (equipo, perfil, nombre y WhatsApp o correo), desplegables,
//                validaciones, envío (Apps Script simulado), UTM, antispam, consentimiento y
//                eventos del píxel (Meta simulado, sin salir a internet).
//  · qa-ui     → estructura (secciones, palabras, un CTA por sección), cabecera, barra de progreso,
//                hero (foto de fondo difuminada), franja de garantías con iconos, alineación,
//                segmentado, carrusel, más equipos, comparador, pie con el nombre animado, catálogo,
//                acordeón, conteo, barra móvil, nada que ensanche la página (sin overflow: clip y
//                con texto al 130 %), solo WebP, fuentes, teclado, movimiento reducido, CSP,
//                caché y metadatos.
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
  ['tests/qa-apps-script.cjs', []],
  ['tests/qa-form.cjs', [log]],
  ['tests/qa-ui.cjs', []],
  ['tests/qa-layout.cjs', [join(out, 'screenshots')]],
]) {
  console.log(`\n▶ ${file}`);
  failed += (await run(file, args)) ? 1 : 0;
}
bg.forEach((p) => p.kill());
process.exit(failed ? 1 : 0);
