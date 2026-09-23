// Ejecuta las pruebas automáticas contra la versión compilada (dist/):
//  · qa-form   → formulario completo, validaciones, envío (mock de Apps Script), UTM, antispam,
//                consentimiento y eventos del píxel (Meta simulado, sin salir a internet).
//  · qa-ui     → menú, cabecera, barra CTA, fichas, filtros, acordeón, carruseles, dropdowns,
//                vídeos diferidos, foco con teclado, animación de entrada y movimiento reducido.
//  · qa-layout → capturas de página completa en 14 tamaños y comprobación de desbordamiento.
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
  spawn(process.execPath, ['scripts/serve.mjs', 'dist', PORT], { stdio: 'ignore' }),
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
  ['tests/qa-layout.cjs', [join(out, 'screenshots', 'index')]],
]) {
  console.log(`\n▶ ${file}`);
  failed += (await run(file, args)) ? 1 : 0;
}
bg.forEach((p) => p.kill());
process.exit(failed ? 1 : 0);
