/**
 * VytalGroup · Leads de la web en Google Sheets
 *
 * Recibe por POST (JSON) cada solicitud del formulario de la web, la valida y la guarda en la pestaña
 * "Leads", con Estado y Notas para el equipo comercial. La pestaña "Resumen" calcula estadísticas con
 * fórmulas que se actualizan solas. Después de guardar, avisa por email. doGet() comprueba el despliegue.
 *
 * Para ejecutar a mano desde el editor:
 *   setup()           prepara la hoja, migra lo que ya hay, crea el Resumen y pide el permiso de email.
 *   rebuildSummary()  rehace la pestaña Resumen desde cero.
 *   testLead()        envía un lead de prueba y comprueba que el duplicado no se guarda.
 *
 * Propiedades del script (Configuración del proyecto > Propiedades del script), opcionales:
 *   NOTIFY_EMAIL   destinatarios del aviso, separados por comas. Por defecto, aaswebmarketing@gmail.com.
 *   LEAD_SECRET    si existe, cada envío tiene que traer "secret" con el mismo valor.
 * El script guarda además LAYOUT_VERSION para saber que la hoja ya está migrada.
 */

const SHEET_NAME = 'Leads';
const SUMMARY_NAME = 'Resumen';
const TIMEZONE = 'Europe/Madrid';
const DATE_FORMAT = 'dd/MM/yyyy HH:mm';
const SEND_EMAIL_NOTIFICATION = true;
const DEFAULT_NOTIFY_EMAIL = 'aaswebmarketing@gmail.com';
const LAYOUT_VERSION = '4';
const RESERVED_ROWS = 1000;
const MIN_FREE_ROWS = 20;

const NAVY = '#0B1929';
const WHITE = '#FFFFFF';
const LINE = '#D9DEE5';
const MUTED = '#5B6573';

const ESTADOS = [
  { name: 'Nuevo', color: '#FFF4CC' },
  { name: 'Contactado', color: '#DDEBFF' },
  { name: 'Propuesta enviada', color: '#E8DDFF' },
  { name: 'Cliente', color: '#D1FAE5' },
  { name: 'Descartado', color: '#EEEEEE' },
];

const COLUMNS = [
  ['Fecha y hora', 130],
  ['Nombre', 180],
  ['Teléfono', 150],
  ['Email', 220],
  ['Perfil', 120],
  ['Equipo de interés', 190],
  ['Modelo', 200],
  ['Estado', 150],
  ['Notas', 280],
  ['utm_source', 110],
  ['utm_medium', 110],
  ['utm_campaign', 170],
  ['utm_content', 170],
  ['utm_term', 150],
  ['event_id', 120],
];
const HEADERS = COLUMNS.map(function (c) { return c[0]; });
const C = {
  fecha: col_('Fecha y hora'),
  nombre: col_('Nombre'),
  telefono: col_('Teléfono'),
  perfil: col_('Perfil'),
  equipo: col_('Equipo de interés'),
  modelo: col_('Modelo'),
  estado: col_('Estado'),
  notas: col_('Notas'),
  utmSource: col_('utm_source'),
  utmCampaign: col_('utm_campaign'),
  utmContent: col_('utm_content'),
  eventId: col_('event_id'),
};
const LEGACY_HEADERS = ['Fecha', 'Nombre', 'Teléfono', 'Email', 'Perfil', 'Equipo de interés', 'Modelo', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'event_id'];
const LEGACY_SIN_MODELO = LEGACY_HEADERS.filter(function (h) { return h !== 'Modelo'; });

const REQUIRED = ['nombre', 'perfil', 'equipo', 'consentimiento', 'event_id'];
const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

function doPost(e) {
  const lock = LockService.getScriptLock();
  let lead = null;
  let notifyTo = DEFAULT_NOTIFY_EMAIL;
  try {
    const d = parseBody_(e);
    const props = PropertiesService.getScriptProperties().getProperties();

    if (props.LEAD_SECRET && String(d.secret || '') !== String(props.LEAD_SECRET)) return json_({ ok: false, error: 'No autorizado' });
    if (d.website) return json_({ ok: true });

    const missing = REQUIRED.filter(function (k) { return !String(d[k] || '').trim(); });
    if (missing.length) return json_({ ok: false, error: 'Faltan campos: ' + missing.join(', ') });
    const digits = String(d.telefono || '').replace(/\D/g, '');
    const email = String(d.email || '').replace(/\s+/g, '').toLowerCase();
    if (!digits && !email) return json_({ ok: false, error: 'Falta el teléfono o el correo' });
    if (digits && (digits.length < 8 || digits.length > 15)) return json_({ ok: false, error: 'Teléfono no válido' });
    if (email && (email.length > 254 || !EMAIL_RE.test(email))) return json_({ ok: false, error: 'Correo no válido' });

    lock.waitLock(20000);
    const sheet = getSheet_(props.LAYOUT_VERSION !== LAYOUT_VERSION);
    const last = sheet.getLastRow();

    if (isDuplicate_(sheet, last, String(d.event_id))) return json_({ ok: true, duplicate: true });

    const now = new Date();
    lead = {
      fecha: Utilities.formatDate(now, TIMEZONE, DATE_FORMAT),
      nombre: String(d.nombre).trim(),
      telefono: digits ? phone_(d.telefono) : '',
      whatsapp: digits ? 'https://wa.me/' + digits : '',
      email: email,
      perfil: d.perfil,
      equipo: String(d.equipo).trim(),
      modelo: modelo_(d),
      campana: [d.utm_source, d.utm_medium, d.utm_campaign].filter(String).join(' / '),
    };
    const row = [now, clean_(lead.nombre), lead.telefono]
      .concat([lead.email, lead.perfil, lead.equipo, lead.modelo, ESTADOS[0].name, ''].map(clean_))
      .concat(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'event_id'].map(function (k) { return clean_(d[k]); }));

    ensureRoom_(sheet, last);
    sheet.getRange(last + 1, 1, 1, HEADERS.length).setValues([row]);
    // Con LockService hay que escribir antes de soltar el bloqueo: si no, el siguiente envío no ve esta fila al buscar duplicados
    SpreadsheetApp.flush();
    notifyTo = notifyTo_(props);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }

  if (SEND_EMAIL_NOTIFICATION) {
    try {
      notify_(lead, notifyTo);
    } catch (err) {
      console.error('Lead guardado, pero no se pudo enviar el aviso por email: ' + (err && err.message ? err.message : err));
    }
  }
  return json_({ ok: true });
}

function doGet() {
  return json_({ ok: true, service: 'VytalGroup leads', time: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss') });
}

function setup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let sheet;
  try {
    sheet = getSheet_(true);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  const props = PropertiesService.getScriptProperties().getProperties();
  console.log('Pestaña "' + SHEET_NAME + '" lista con ' + Math.max(0, sheet.getLastRow() - 1) + ' leads, y pestaña "' + SUMMARY_NAME + '" preparada.');
  if (SEND_EMAIL_NOTIFICATION) console.log('Avisos por email a ' + notifyTo_(props) + '. Correos que quedan hoy: ' + MailApp.getRemainingDailyQuota() + '.');
  console.log(props.LEAD_SECRET ? 'LEAD_SECRET activo: se rechazan los envíos sin el "secret" correcto.' : 'Sin LEAD_SECRET: se aceptan los envíos como hasta ahora.');
}

function rebuildSummary() {
  buildSummary_(SpreadsheetApp.getActiveSpreadsheet());
  console.log('Pestaña "' + SUMMARY_NAME + '" reconstruida.');
}

function testLead() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const body = {
    nombre: 'PRUEBA testLead (borrar)',
    telefono: '+34 600 000 000',
    email: '',
    perfil: 'Clínica',
    equipo: 'Ecógrafo',
    modelo: 'Sin decidir',
    consentimiento: 'Sí · prueba desde Apps Script',
    utm_source: 'prueba',
    utm_medium: 'apps_script',
    utm_campaign: 'testLead',
    utm_content: '',
    utm_term: '',
    event_id: 'prueba-' + Utilities.getUuid(),
    website: '',
  };
  if (props.LEAD_SECRET) body.secret = props.LEAD_SECRET;
  const send = function () { return JSON.parse(doPost({ postData: { contents: JSON.stringify(body) } }).getContent()); };
  const first = send();
  const second = send();
  console.log('Lead de prueba: ' + JSON.stringify(first));
  console.log('Mismo event_id otra vez: ' + JSON.stringify(second));
  const ok = first.ok === true && !first.duplicate && second.ok === true && second.duplicate === true;
  console.log(ok
    ? 'Todo bien: el lead está en "' + SHEET_NAME + '" (bórralo cuando quieras) y el duplicado no se ha guardado. Mira también el email en ' + notifyTo_(props) + '.'
    : 'Algo no ha ido bien: revisa los mensajes de arriba.');
  return ok;
}

function getSheet_(full) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Este código tiene que estar dentro de la hoja: ábrela y entra en Extensiones > Apps Script');
  let sheet = ss.getSheetByName(SHEET_NAME);
  const layout = sheet ? layoutOf_(sheet) : 'vacia';
  if (layout === 'actual' && !full) return sheet;

  if (ss.getSpreadsheetTimeZone() !== TIMEZONE) ss.setSpreadsheetTimeZone(TIMEZONE);
  if (layout === 'desconocida') {
    sheet.setName(SHEET_NAME + ' anterior ' + Utilities.formatDate(new Date(), TIMEZONE, 'dd-MM-yyyy HH.mm'));
    sheet = null;
  }
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME, 0);
  if (layout === 'sin-modelo') addModelo_(sheet);
  if (layout === 'sin-modelo' || layout === 'con-modelo') sheet.insertColumnsAfter(C.modelo, 2);
  if (sheet.getMaxColumns() < HEADERS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  convertDates_(sheet);
  applyLayout_(sheet);
  if (!ss.getSheetByName(SUMMARY_NAME)) buildSummary_(ss);
  PropertiesService.getScriptProperties().setProperty('LAYOUT_VERSION', LAYOUT_VERSION);
  return sheet;
}

function layoutOf_(sheet) {
  const width = Math.min(sheet.getMaxColumns(), HEADERS.length);
  const row = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (v) { return String(v).trim(); });
  while (row.length < HEADERS.length) row.push('');
  if (row.join('') === '') return sheet.getLastRow() === 0 ? 'vacia' : 'desconocida';
  const actual = ['Fecha y hora'].concat(row.slice(1));
  const legacy = ['Fecha'].concat(row.slice(1));
  if (row[0] !== 'Fecha' && row[0] !== 'Fecha y hora') return 'desconocida';
  if (same_(actual, HEADERS)) return 'actual';
  if (same_(actual.slice(0, C.modelo), HEADERS.slice(0, C.modelo)) && !row[C.estado - 1] && !row[C.notas - 1] && same_(actual.slice(C.notas), HEADERS.slice(C.notas))) return 'actual';
  if (same_(legacy.slice(0, LEGACY_HEADERS.length), LEGACY_HEADERS)) return 'con-modelo';
  if (same_(legacy.slice(0, LEGACY_SIN_MODELO.length), LEGACY_SIN_MODELO)) return 'sin-modelo';
  return 'desconocida';
}

function addModelo_(sheet) {
  sheet.insertColumnAfter(C.modelo - 1);
  sheet.getRange(1, C.modelo).setValue('Modelo');
  const n = sheet.getLastRow() - 1;
  if (n > 0) {
    const range = sheet.getRange(2, C.modelo - 1, n, 2);
    range.setValues(range.getValues().map(function (r) {
      const v = String(r[0]);
      const i = v.indexOf(' · ');
      return (i < 0 ? [v, ''] : [v.slice(0, i), v.slice(i + 3)]).map(clean_);
    }));
  }
}

function convertDates_(sheet) {
  const n = sheet.getLastRow() - 1;
  if (n < 1) return;
  const values = sheet.getRange(2, C.fecha, n, 1).getValues();
  let start = -1;
  let run = [];
  const write = function () {
    if (run.length) sheet.getRange(2 + start, C.fecha, run.length, 1).setValues(run);
    start = -1;
    run = [];
  };
  values.forEach(function (r, i) {
    const date = typeof r[0] === 'string' ? parseFecha_(r[0]) : null;
    if (!date) return write();
    if (start < 0) start = i;
    run.push([date]);
  });
  write();
}

function parseFecha_(text) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/.exec(text);
  if (!m) return null;
  const p = m.slice(1).map(function (x) { return Number(x || 0); });
  const wall = Date.UTC(p[2], p[1] - 1, p[0], p[3], p[4], p[5]);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== p[2] || check.getUTCMonth() !== p[1] - 1 || check.getUTCDate() !== p[0] || p[3] > 23 || p[4] > 59 || p[5] > 59) return null;
  const guess = wall - offsetMs_(new Date(wall));
  return new Date(wall - offsetMs_(new Date(guess)));
}

function offsetMs_(date) {
  const z = Utilities.formatDate(date, TIMEZONE, 'Z');
  return (z.charAt(0) === '-' ? -1 : 1) * (Number(z.slice(1, 3)) * 60 + Number(z.slice(3, 5))) * 60000;
}

function applyLayout_(sheet) {
  const need = sheet.getLastRow() + RESERVED_ROWS;
  if (sheet.getMaxRows() < need) sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows());

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground(NAVY).setFontColor(WHITE).setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  COLUMNS.forEach(function (c, i) { sheet.setColumnWidth(i + 1, c[1]); });
  formatRows_(sheet, 2, sheet.getMaxRows() - 1);
  setEstadoColors_(sheet);
  setFilter_(sheet);
  sheet.hideColumns(C.eventId);
}

function formatRows_(sheet, from, count) {
  sheet.getRange(from, C.fecha, count, 1).setNumberFormat(DATE_FORMAT);
  sheet.getRange(from, C.telefono, count, 1).setNumberFormat('@');
  sheet.getRange(from, C.estado, count, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS.map(function (s) { return s.name; }), true).setAllowInvalid(false).build()
  );
  sheet.getRange(from, C.notas, count, 1).setWrap(true);
}

function setEstadoColors_(sheet) {
  const prefix = '=$' + letter_(C.estado) + '2="';
  const range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, HEADERS.length);
  const others = sheet.getConditionalFormatRules().filter(function (rule) {
    const cond = rule.getBooleanCondition();
    return !(cond && String(cond.getCriteriaValues()[0] || '').indexOf(prefix) === 0);
  });
  const ours = ESTADOS.map(function (s) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(prefix + s.name + '"').setBackground(s.color).setRanges([range]).build();
  });
  sheet.setConditionalFormatRules(others.concat(ours));
}

function setFilter_(sheet) {
  const width = Math.max(HEADERS.length, sheet.getLastColumn());
  const old = sheet.getFilter();
  const criteria = {};
  if (old) {
    try {
      const r = old.getRange();
      for (let c = r.getColumn(); c < r.getColumn() + r.getNumColumns(); c++) criteria[c] = old.getColumnFilterCriteria(c);
    } catch (err) {}
    old.remove();
  }
  const filter = sheet.getRange(1, 1, sheet.getMaxRows(), width).createFilter();
  Object.keys(criteria).forEach(function (c) {
    if (criteria[c] && Number(c) <= width) filter.setColumnFilterCriteria(Number(c), criteria[c]);
  });
}

function ensureRoom_(sheet, last) {
  const max = sheet.getMaxRows();
  if (max - last > MIN_FREE_ROWS) return;
  sheet.insertRowsAfter(max, RESERVED_ROWS);
  formatRows_(sheet, max + 1, RESERVED_ROWS);
  setEstadoColors_(sheet);
  setFilter_(sheet);
}

function isDuplicate_(sheet, last, eventId) {
  if (last < 2 || !eventId) return false;
  const from = Math.max(2, last - 200);
  const ids = sheet.getRange(from, C.eventId, last - from + 1, 1).getValues();
  return ids.some(function (r) { return String(r[0]) === eventId; });
}

function buildSummary_(ss) {
  const old = ss.getSheetByName(SUMMARY_NAME);
  const index = old ? old.getIndex() - 1 : Math.min(1, ss.getSheets().length);
  if (old) ss.deleteSheet(old);
  const sh = ss.insertSheet(SUMMARY_NAME, index);
  const sep = separator_(sh);
  const fx = function (template) { return template.split('|').join(sep); };
  const ref = "'" + SHEET_NAME + "'!";
  const column = function (n) { return ref + letter_(n) + '2:' + letter_(n); };
  const name = letter_(C.nombre);

  sh.setHiddenGridlines(true);
  sh.setTabColor(NAVY);
  [20, 230, 80, 28, 230, 80, 28, 230, 80].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setRowHeight(1, 44);
  sh.getRange('B1:I1').merge().setValue('Resumen de leads · VytalGroup')
    .setFontSize(16).setFontWeight('bold').setFontColor(WHITE).setBackground(NAVY).setVerticalAlignment('middle');
  sh.getRange('B2:I2').merge().setValue('Se actualiza solo con cada lead. Si algo sale con error, ejecuta rebuildSummary() en Extensiones > Apps Script.')
    .setFontStyle('italic').setFontColor(MUTED);

  const totals = [
    ['Leads totales', '=COUNTA(' + column(C.nombre) + ')'],
    ['Leads de hoy', '=COUNTIFS(' + column(C.fecha) + '|">="&TODAY()|' + column(C.fecha) + '|"<"&(TODAY()+1))'],
    ['Últimos 7 días', '=COUNTIFS(' + column(C.fecha) + '|">="&(TODAY()-6)|' + column(C.fecha) + '|"<"&(TODAY()+1))'],
    ['Pendientes (' + ESTADOS[0].name + ')', '=COUNTIF(' + column(C.estado) + '|"' + ESTADOS[0].name + '")'],
  ];
  blockTitle_(sh, 4, 2, 'Totales');
  totals.forEach(function (t, i) {
    sh.getRange(5 + i, 2).setValue(t[0]).setFontColor(NAVY);
    sh.getRange(5 + i, 3).setFormula(fx(t[1])).setFontWeight('bold').setFontSize(13).setFontColor(NAVY).setHorizontalAlignment('right');
  });
  sh.getRange(5, 2, totals.length, 2).setBorder(null, null, true, null, null, true, LINE, SpreadsheetApp.BorderStyle.SOLID);

  const tables = [
    [10, 2, 'Por perfil', 'Perfil', C.perfil, 20],
    [10, 5, 'Por equipo de interés', 'Equipo', C.equipo, 20],
    [10, 8, 'Por modelo', 'Modelo', C.modelo, 20],
    [33, 2, 'Por campaña (utm_campaign)', 'Campaña', C.utmCampaign, 0],
    [33, 5, 'Por anuncio (utm_content)', 'Anuncio', C.utmContent, 0],
    [33, 8, 'Por origen (utm_source)', 'Origen', C.utmSource, 0],
  ];
  tables.forEach(function (t) {
    const row = t[0];
    const col = t[1];
    const x = letter_(t[4]);
    const rows = t[5] || sh.getMaxRows() - row - 1;
    blockTitle_(sh, row, col, t[2]);
    sh.getRange(row + 1, col, 1, 2).setValues([[t[3], 'Leads']]).setFontWeight('bold').setFontColor(NAVY)
      .setBorder(null, null, true, null, null, null, NAVY, SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(row + 1, col + 1, rows + 1, 1).setHorizontalAlignment('right');
    sh.getRange(row + 2, col).setFormula(fx(
      '=IFERROR(QUERY(' + ref + 'A2:' + letter_(HEADERS.length) + '|"select ' + x + ', count(' + name + ') where ' + x + " <> '' and " + name + " <> '' group by " + x +
      ' order by count(' + name + ') desc, ' + x + ' label ' + x + " '', count(" + name + ") ''\"|0)|\"Sin datos todavía\")"
    ));
  });
}

function blockTitle_(sh, row, col, text) {
  sh.getRange(row, col, 1, 2).merge().setValue(text).setFontWeight('bold').setFontColor(WHITE).setBackground(NAVY);
}

// Separador de argumentos de las fórmulas: "," en en_US y ";" en es_ES. Se prueba con una fórmula real.
function separator_(sheet) {
  const cell = sheet.getRange(1, 1);
  let found = '';
  [',', ';'].some(function (sep) {
    try {
      cell.setFormula('=IF(1' + sep + '2' + sep + '3)');
      SpreadsheetApp.flush();
      found = String(cell.getValue()) === '2' ? sep : '';
    } catch (err) {
      found = '';
    }
    return found !== '';
  });
  cell.clearContent();
  if (found) return found;
  return /^en/.test(SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetLocale()) ? ',' : ';';
}

function notify_(l, to) {
  const lines = [
    'Nuevo lead desde la web de VytalGroup',
    '',
    'Nombre: ' + l.nombre,
    l.telefono ? 'Teléfono: ' + l.telefono + '  (WhatsApp: ' + l.whatsapp + ')' : '',
    l.email ? 'Email: ' + l.email : '',
    'Perfil: ' + l.perfil,
    'Equipo de interés: ' + l.equipo,
    l.modelo ? 'Modelo: ' + l.modelo : '',
    l.campana ? 'Campaña: ' + l.campana : '',
    'Fecha: ' + l.fecha,
  ];
  const mail = {
    to: to,
    subject: 'Nuevo lead: ' + l.nombre + ' · ' + (l.modelo || l.equipo),
    body: lines.filter(function (x, i) { return x !== '' || i === 1; }).join('\n'),
  };
  if (l.email) mail.replyTo = l.email;
  MailApp.sendEmail(mail);
}

function notifyTo_(props) {
  return String(props.NOTIFY_EMAIL || '').trim() || DEFAULT_NOTIFY_EMAIL;
}

function modelo_(d) {
  const modelo = String(d.modelo || '').trim();
  return modelo === 'Sin decidir' ? '' : modelo;
}

function phone_(value) {
  return String(value).replace(/[^\d +()-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 1000);
}

function clean_(v) {
  let s = v === undefined || v === null ? '' : String(v);
  s = s.slice(0, 1000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('Petición vacía');
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error('El cuerpo no es un JSON válido');
  }
}

function col_(name) {
  return HEADERS.indexOf(name) + 1;
}

function letter_(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function same_(a, b) {
  return a.join('|') === b.join('|');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
