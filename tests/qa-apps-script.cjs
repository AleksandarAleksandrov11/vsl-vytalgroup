// Ejecuta integrations/google-sheets.gs (el Apps Script real) contra una hoja de Google simulada:
// columnas, WhatsApp o correo, aviso por email, duplicados, campo trampa, validaciones, fórmulas
// y el paso de una pestaña con las columnas antiguas a la nueva.
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(require('path').join(__dirname, '..', 'integrations', 'google-sheets.gs'), 'utf8');
function makeEnv() {
  const sheets = {};
  const mails = [];
  const mkSheet = (name) => {
    const rows = [];
    const sh = {
      name, rows, frozen: 0, hidden: [],
      setName: (n) => { delete sheets[sh.name]; sh.name = n; sheets[n] = sh; },
      hideColumns: (c) => { sh.hidden.push(c); },
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
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = mkSheet(n)) }), __sheets: sheets, flush: () => {} },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { formatDate: () => '24/09/2026 12:00' },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => ({ body: JSON.parse(t) }) }) },
    MailApp: { sendEmail: (m) => mails.push(m), getRemainingDailyQuota: () => 100 },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, sheets, mails };
}
const post = (ctx, obj) => ctx.doPost({ postData: { contents: typeof obj === 'string' ? obj : JSON.stringify(obj) } }).body;
const base = { nombre: 'Laura Gómez', telefono: '+34 612 345 678', email: '', perfil: 'Fisioterapeuta', equipo: 'Ecógrafo', modelo: 'Acclarix AX8 (EDAN)', consentimiento: 'Sí · 2026-09-24T10:00:00Z', utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'otono', utm_content: 'video-1', utm_term: '', event_id: '11111111-1111-4111-8111-111111111111', website: '' };
const HEAD = 'Fecha|Nombre|Teléfono|Email|Perfil|Equipo de interés|utm_source|utm_medium|utm_campaign|utm_content|utm_term|event_id';
const res = [];
const ok = (c, n, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  · ' + x : ''}`);

{ const { ctx, sheets } = makeEnv(); ctx.setup(); const sh = sheets.Leads; ok(sh && sh.rows[0].join('|') === HEAD && sh.frozen === 1 && sh.hidden.join() === '12', 'setup(): crea "Leads" solo con Fecha, Nombre, Teléfono, Email, Perfil, Equipo de interés y UTM (event_id oculto)', sh && sh.rows[0].join(', ')); }
{ const { ctx } = makeEnv(); const r = ctx.doGet().body; ok(r.ok === true && r.service, 'doGet(): responde ok para comprobar el despliegue'); }
{
  const { ctx, sheets, mails } = makeEnv();
  const r = post(ctx, base);
  const sh = sheets.Leads; const h = sh.rows[0]; const row = sh.rows[1]; const col = (n) => row[h.indexOf(n)];
  ok(r.ok === true && sh.rows.length === 2 && row.length === 12, 'doPost(): guarda una fila de 12 columnas y responde { ok: true }', JSON.stringify(r));
  ok(col('Fecha') === '24/09/2026 12:00' && col('Nombre') === 'Laura Gómez' && col('Teléfono') === "'+34 612 345 678" && col('Email') === '' && col('Perfil') === 'Fisioterapeuta' && col('Equipo de interés') === 'Ecógrafo · Acclarix AX8 (EDAN)' && col('utm_source') === 'facebook' && col('utm_campaign') === 'otono' && col('utm_content') === 'video-1' && col('event_id') === base.event_id, 'doPost(): cada dato en su columna; el equipo de interés junta equipo y modelo', row.slice(0, 6).join(' | '));
  const m = mails[0];
  ok(mails.length === 1 && m.to === 'aaswebmarketing@gmail.com' && m.subject === 'Nuevo lead: Laura Gómez · Ecógrafo · Acclarix AX8 (EDAN)' && /Teléfono: \+34 612 345 678 {2}\(WhatsApp: https:\/\/wa\.me\/34612345678\)/.test(m.body) && /Perfil: Fisioterapeuta/.test(m.body) && /Campaña: facebook \/ paid \/ otono/.test(m.body) && !/Email:/.test(m.body), 'Email: asunto con nombre y equipo, teléfono con enlace de WhatsApp, perfil y campaña', m && m.subject);
  const r2 = post(ctx, base);
  ok(r2.ok === true && r2.duplicate === true && sh.rows.length === 2 && mails.length === 1, 'doPost(): el mismo event_id no se duplica');
  ok(post(ctx, { ...base, event_id: '2', website: 'http://spam' }).ok === true && sh.rows.length === 2, 'doPost(): el campo trampa se descarta sin dar pistas');
  const r4 = post(ctx, { ...base, event_id: '3', perfil: '' });
  ok(r4.ok === false && /perfil/.test(r4.error) && sh.rows.length === 2, 'doPost(): sin perfil responde error y no guarda', r4.error);
  const r5 = post(ctx, { ...base, event_id: '4', telefono: '12' });
  ok(r5.ok === false && /Teléfono/.test(r5.error), 'doPost(): teléfono imposible responde error', r5.error);
  const r6 = post(ctx, { ...base, event_id: '5', nombre: '=HYPERLINK("http://x")' });
  ok(r6.ok === true && sh.rows[2][1].startsWith("'="), 'doPost(): un texto que empieza por = no se ejecuta como fórmula', sh.rows[2][1]);
  const r7 = post(ctx, 'no es json');
  ok(r7.ok === false && /JSON/.test(r7.error), 'doPost(): cuerpo que no es JSON responde error', r7.error);
  ok(ctx.doPost({}).body.ok === false, 'doPost(): petición vacía responde error');
  const n = sh.rows.length; const m0 = mails.length;
  const r9 = post(ctx, { ...base, event_id: '6', telefono: '', email: ' Laura.Gomez@Gmail.com ', equipo: 'Diatermia', modelo: 'Sin decidir' });
  const erow = sh.rows[n];
  ok(r9.ok === true && erow && erow[2] === '' && erow[3] === 'laura.gomez@gmail.com' && erow[5] === 'Diatermia', 'Correo: guarda el correo limpio, sin teléfono; "Sin decidir" deja solo el equipo', erow && erow.slice(1, 6).join(' | '));
  const mail = mails[m0];
  ok(mail && mail.replyTo === 'laura.gomez@gmail.com' && /Email: laura\.gomez@gmail\.com/.test(mail.body) && !/Teléfono:/.test(mail.body), 'Correo: el aviso por email se puede responder directamente al lead', mail && mail.replyTo);
  const r10 = post(ctx, { ...base, event_id: '7', telefono: '', email: 'laura@gmail' });
  ok(r10.ok === false && /Correo no válido/.test(r10.error), 'Correo: formato no válido responde error', r10.error);
  const r11 = post(ctx, { ...base, event_id: '8', telefono: '', email: '' });
  ok(r11.ok === false && /teléfono o el correo/.test(r11.error), 'doPost(): sin teléfono ni correo responde error', r11.error);
}
{
  // Hoja con la pestaña "Leads" de la versión anterior (24 columnas): se aparta y se crea una nueva
  const { ctx, sheets } = makeEnv();
  ctx.setup();
  const old = sheets.Leads;
  old.rows[0] = ['Fecha', 'Nombre', 'Contactar por', 'Teléfono', 'WhatsApp', 'Email', 'Perfil', 'Equipo', 'Modelo'];
  old.rows.push(['27/09/2026 10:30:00', 'Prueba antigua', 'WhatsApp']);
  const r = post(ctx, { ...base, event_id: '99' });
  const names = Object.keys(sheets);
  const moved = names.find((x) => x.startsWith('Leads anterior '));
  ok(r.ok === true && moved && sheets[moved].rows.length === 2 && sheets.Leads.rows[0].join('|') === HEAD && sheets.Leads.rows.length === 2, 'Columnas antiguas: la pestaña vieja se guarda aparte ("Leads anterior …") y el lead entra en una "Leads" nueva', names.join(', '));
  sheets.Leads.rows[0].push('Estado');
  post(ctx, { ...base, event_id: '100' });
  ok(Object.keys(sheets).length === 2 && sheets.Leads.rows.length === 3, 'Añadir columnas propias a la derecha (p. ej. "Estado") no cambia de pestaña');
}
console.log(res.join('\n'));
const fails = res.filter((x) => x.startsWith('FAIL')).length;
console.log(`\n${res.length - fails}/${res.length} OK`);
process.exit(fails ? 1 : 0);
