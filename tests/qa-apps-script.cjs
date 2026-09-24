// Ejecuta integrations/google-sheets.gs (el Apps Script real) contra una hoja de Google simulada:
// columnas, WhatsApp o correo, enlace de WhatsApp, aviso por email, duplicados, campo trampa,
// validaciones y fórmulas.
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(require('path').join(__dirname, '..', 'integrations', 'google-sheets.gs'), 'utf8');
function makeEnv() {
  const sheets = {};
  const mails = [];
  const mkSheet = (name) => {
    const rows = [];
    const sh = {
      name, rows, frozen: 0,
      getLastRow: () => rows.length,
      insertRowBefore: (i) => rows.splice(i - 1, 0, []),
      appendRow: (r) => rows.push(r.slice()),
      setFrozenRows: (n) => { sh.frozen = n; },
      setColumnWidths: () => sh,
      getRange: (a, c, nr, nc) => {
        if (typeof a === 'string') return { setNumberFormat: () => {} };
        const api = {
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((rows[a - 1 + i] || [])[c - 1 + j] ?? ''))),
          setValues: (v) => { v.forEach((row, i) => { rows[a - 1 + i] = rows[a - 1 + i] || []; row.forEach((x, j) => { rows[a - 1 + i][c - 1 + j] = x; }); }); return api; },
          setFontWeight: () => api, setBackground: () => api, setFontColor: () => api,
        };
        return api;
      },
    };
    return sh;
  };
  const quiet = { ...console, error: () => {}, log: () => {} };
  const ctx = {
    console: quiet,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = mkSheet(n)) }), flush: () => {} },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { formatDate: () => '24/09/2026 12:00:00' },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => ({ body: JSON.parse(t) }) }) },
    MailApp: { sendEmail: (m) => mails.push(m), getRemainingDailyQuota: () => 100 },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, sheets, mails };
}
const post = (ctx, obj) => ctx.doPost({ postData: { contents: typeof obj === 'string' ? obj : JSON.stringify(obj) } }).body;
const base = { nombre: 'Laura Gómez', canal: 'WhatsApp', telefono: '+34 612 345 678', email: '', perfil: 'Fisioterapeuta', equipo: 'Ecógrafo', modelo: 'Acclarix AX8 (EDAN)', consentimiento: 'Sí · 2026-09-24T10:00:00Z', utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'test', utm_content: '', utm_term: '', fbclid: 'abc', fbc: 'fb.1.1.abc', fbp: 'fb.1.2.3', referrer: '', landing_url: 'https://x/?utm_source=facebook', dispositivo: 'Móvil · iOS · Instagram', idioma: 'es-ES', event_id: '11111111-1111-4111-8111-111111111111', website: '' };
const res = [];
const ok = (c, n, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  · ' + x : ''}`);

{ const { ctx, sheets } = makeEnv(); ctx.setup(); const sh = sheets.Leads; ok(sh && sh.rows[0].join('|') === 'Fecha|Nombre|Contactar por|Teléfono|WhatsApp|Email|Perfil|Equipo|Modelo|Consentimiento|utm_source|utm_medium|utm_campaign|utm_content|utm_term|fbclid|fbc|fbp|Referrer|URL de entrada|Dispositivo|Idioma|event_id|Estado' && sh.frozen === 1, 'setup(): crea "Leads" con las cabeceras y la primera fila fija', sh && sh.rows[0].join(', ')); }
{ const { ctx } = makeEnv(); const r = ctx.doGet().body; ok(r.ok === true && r.service, 'doGet(): responde ok para comprobar el despliegue'); }
{
  const { ctx, sheets, mails } = makeEnv();
  const r = post(ctx, base);
  const sh = sheets.Leads; const h = sh.rows[0]; const row = sh.rows[1]; const col = (n) => row[h.indexOf(n)];
  ok(r.ok === true && sh.rows.length === 2, 'doPost(): guarda una fila y responde { ok: true }', JSON.stringify(r));
  ok(col('Nombre') === 'Laura Gómez' && col('Teléfono') === "'+34 612 345 678" && col('Perfil') === 'Fisioterapeuta' && col('Equipo') === 'Ecógrafo' && col('Modelo') === 'Acclarix AX8 (EDAN)' && col('utm_source') === 'facebook' && col('Estado') === 'Nuevo' && col('Fecha') === '24/09/2026 12:00:00' && col('Contactar por') === 'WhatsApp' && col('Email') === '', 'doPost(): cada dato en su columna, con fecha y estado "Nuevo" (el teléfono con apóstrofo: Sheets lo guarda como texto y no lo muestra)');
  ok(col('WhatsApp') === 'https://wa.me/34612345678', 'doPost(): enlace directo a WhatsApp del lead', col('WhatsApp'));
  ok(mails.length === 1 && /Laura Gómez/.test(mails[0].subject) && /Perfil: Fisioterapeuta/.test(mails[0].body) && /wa\.me\/34612345678/.test(mails[0].body) && mails[0].to === 'vytalkinetech@gmail.com', 'Email: aviso con nombre, perfil, equipo y WhatsApp', mails[0] && mails[0].subject);
  const r2 = post(ctx, base);
  ok(r2.ok === true && r2.duplicate === true && sh.rows.length === 2 && mails.length === 1, 'doPost(): el mismo event_id no se duplica');
  const r3 = post(ctx, { ...base, event_id: '2', website: 'http://spam' });
  ok(r3.ok === true && sh.rows.length === 2, 'doPost(): el campo trampa se descarta sin dar pistas');
  const r4 = post(ctx, { ...base, event_id: '3', perfil: '' });
  ok(r4.ok === false && /perfil/.test(r4.error) && sh.rows.length === 2, 'doPost(): sin perfil responde error y no guarda', r4.error);
  const r5 = post(ctx, { ...base, event_id: '4', telefono: '12' });
  ok(r5.ok === false && /Teléfono/.test(r5.error), 'doPost(): teléfono imposible responde error', r5.error);
  const r6 = post(ctx, { ...base, event_id: '5', nombre: '=HYPERLINK("http://x")' });
  ok(r6.ok === true && sh.rows[2][h.indexOf('Nombre')].startsWith("'="), 'doPost(): un texto que empieza por = no se ejecuta como fórmula', sh.rows[2][h.indexOf('Nombre')]);
  const r7 = post(ctx, 'no es json');
  ok(r7.ok === false && /JSON/.test(r7.error), 'doPost(): cuerpo que no es JSON responde error', r7.error);
  const r8 = ctx.doPost({}).body;
  ok(r8.ok === false, 'doPost(): petición vacía responde error', r8.error);
  // "Prefiero por correo"
  const n = sh.rows.length;
  const m0 = mails.length;
  const r9 = post(ctx, { ...base, event_id: '6', canal: 'Correo', telefono: '', email: ' Laura.Gomez@Gmail.com ' });
  const erow = sh.rows[n];
  ok(r9.ok === true && erow && erow[h.indexOf('Contactar por')] === 'Correo' && erow[h.indexOf('Email')] === 'laura.gomez@gmail.com' && erow[h.indexOf('Teléfono')] === '' && erow[h.indexOf('WhatsApp')] === '', 'Correo: guarda "Contactar por: Correo" y el correo limpio, sin teléfono ni enlace de WhatsApp', erow && erow.slice(1, 6).join(' | '));
  const mail = mails[m0];
  ok(mail && mail.replyTo === 'laura.gomez@gmail.com' && /Correo: laura\.gomez@gmail\.com/.test(mail.body) && !/WhatsApp: /.test(mail.body), 'Correo: el aviso por email se puede responder directamente al lead', mail && mail.replyTo);
  const r10 = post(ctx, { ...base, event_id: '7', canal: 'Correo', telefono: '', email: 'laura@gmail' });
  ok(r10.ok === false && /Correo no válido/.test(r10.error), 'Correo: formato no válido responde error', r10.error);
  const r11 = post(ctx, { ...base, event_id: '8', telefono: '', email: '' });
  ok(r11.ok === false && /teléfono o el correo/.test(r11.error), 'doPost(): sin teléfono ni correo responde error', r11.error);
}
console.log(res.join('\n'));
const fails = res.filter((x) => x.startsWith('FAIL')).length;
console.log(`\n${res.length - fails}/${res.length} OK`);
process.exit(fails ? 1 : 0);
