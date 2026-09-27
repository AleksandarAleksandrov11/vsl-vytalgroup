const SHEET_NAME = 'Leads';
const TIMEZONE = 'Europe/Madrid';
const SEND_EMAIL_NOTIFICATION = true;
const NOTIFY_EMAIL = 'aaswebmarketing@gmail.com';

const HEADERS = ['Fecha', 'Nombre', 'Teléfono', 'Email', 'Perfil', 'Equipo de interés', 'Modelo', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'event_id'];
const MODELO_COL = HEADERS.indexOf('Modelo') + 1;
const REQUIRED = ['nombre', 'perfil', 'equipo', 'consentimiento', 'event_id'];
const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = parseBody_(e);

    if (d.website) return json_({ ok: true });

    const missing = REQUIRED.filter(function (k) { return !String(d[k] || '').trim(); });
    if (missing.length) return json_({ ok: false, error: 'Faltan campos: ' + missing.join(', ') });
    const digits = String(d.telefono || '').replace(/\D/g, '');
    const email = String(d.email || '').replace(/\s+/g, '').toLowerCase();
    if (!digits && !email) return json_({ ok: false, error: 'Falta el teléfono o el correo' });
    if (digits && (digits.length < 8 || digits.length > 15)) return json_({ ok: false, error: 'Teléfono no válido' });
    if (email && (email.length > 254 || !EMAIL_RE.test(email))) return json_({ ok: false, error: 'Correo no válido' });

    lock.waitLock(20000);
    const sheet = getSheet_();

    if (isDuplicate_(sheet, String(d.event_id))) return json_({ ok: true, duplicate: true });

    const lead = {
      fecha: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm'),
      nombre: String(d.nombre).trim(),
      telefono: digits ? String(d.telefono).trim() : '',
      whatsapp: digits ? 'https://wa.me/' + digits : '',
      email: email,
      perfil: d.perfil,
      equipo: String(d.equipo).trim(),
      modelo: modelo_(d),
      campana: [d.utm_source, d.utm_medium, d.utm_campaign].filter(String).join(' / '),
    };
    sheet.appendRow([lead.fecha, lead.nombre, lead.telefono, lead.email, lead.perfil, lead.equipo, lead.modelo, d.utm_source, d.utm_medium, d.utm_campaign, d.utm_content, d.utm_term, d.event_id].map(clean_));
    SpreadsheetApp.flush();

    if (SEND_EMAIL_NOTIFICATION) notify_(lead);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function setup() {
  getSheet_();
  if (SEND_EMAIL_NOTIFICATION) MailApp.getRemainingDailyQuota();
  console.log('Listo: pestaña "' + SHEET_NAME + '" preparada.');
}

function doGet() {
  return json_({ ok: true, service: 'VytalGroup leads', time: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss') });
}

function modelo_(d) {
  const modelo = String(d.modelo || '').trim();
  return modelo === 'Sin decidir' ? '' : modelo;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('Petición vacía');
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error('El cuerpo no es un JSON válido');
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Este código tiene que estar dentro de la hoja: ábrela y entra en Extensiones > Apps Script');
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet && sheet.getLastRow() > 0) {
    let first = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].map(String);
    const sinModelo = HEADERS.filter(function (h) { return h !== 'Modelo'; });
    if (first.slice(0, sinModelo.length).join('|') === sinModelo.join('|')) {
      addModelo_(sheet);
      first = HEADERS;
    }
    if (first.join('|') !== HEADERS.join('|')) {
      sheet.setName(SHEET_NAME + ' anterior ' + Utilities.formatDate(new Date(), TIMEZONE, 'dd-MM-yyyy HH.mm'));
      sheet = null;
    }
  }
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME, 0);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#0B1929').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, HEADERS.length, 170);
    sheet.hideColumns(HEADERS.length);
  }
  return sheet;
}

function addModelo_(sheet) {
  sheet.insertColumnAfter(MODELO_COL - 1);
  sheet.getRange(1, MODELO_COL).setValue('Modelo').setFontWeight('bold').setBackground('#0B1929').setFontColor('#FFFFFF');
  sheet.setColumnWidth(MODELO_COL, 170);
  const n = sheet.getLastRow() - 1;
  if (n > 0) {
    const range = sheet.getRange(2, MODELO_COL - 1, n, 2);
    range.setValues(range.getValues().map(function (r) {
      const v = String(r[0]);
      const i = v.indexOf(' · ');
      return (i < 0 ? [v, ''] : [v.slice(0, i), v.slice(i + 3)]).map(clean_);
    }));
  }
  sheet.hideColumns(HEADERS.length);
}

function isDuplicate_(sheet, eventId) {
  const last = sheet.getLastRow();
  if (last < 2 || !eventId) return false;
  const from = Math.max(2, last - 200);
  const ids = sheet.getRange(from, HEADERS.length, last - from + 1, 1).getValues();
  return ids.some(function (r) { return String(r[0]) === eventId; });
}

function clean_(v) {
  let s = v === undefined || v === null ? '' : String(v);
  s = s.slice(0, 1000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function notify_(l) {
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
    to: NOTIFY_EMAIL,
    subject: 'Nuevo lead: ' + l.nombre + ' · ' + (l.modelo || l.equipo),
    body: lines.filter(function (x, i) { return x !== '' || i === 1; }).join('\n'),
  };
  if (l.email) mail.replyTo = l.email;
  MailApp.sendEmail(mail);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
