const SHEET_NAME = 'Leads';
const TIMEZONE = 'Europe/Madrid';
const SEND_EMAIL_NOTIFICATION = true;
const NOTIFY_EMAIL = 'vytalkinetech@gmail.com';

const COLUMNS = [
  ['fecha', 'Fecha'],
  ['nombre', 'Nombre'],
  ['canal', 'Contactar por'],
  ['telefono', 'Teléfono'],
  ['whatsapp', 'WhatsApp'],
  ['email', 'Email'],
  ['perfil', 'Perfil'],
  ['equipo', 'Equipo'],
  ['modelo', 'Modelo'],
  ['consentimiento', 'Consentimiento'],
  ['utm_source', 'utm_source'],
  ['utm_medium', 'utm_medium'],
  ['utm_campaign', 'utm_campaign'],
  ['utm_content', 'utm_content'],
  ['utm_term', 'utm_term'],
  ['fbclid', 'fbclid'],
  ['fbc', 'fbc'],
  ['fbp', 'fbp'],
  ['referrer', 'Referrer'],
  ['landing_url', 'URL de entrada'],
  ['dispositivo', 'Dispositivo'],
  ['idioma', 'Idioma'],
  ['event_id', 'event_id'],
  ['estado', 'Estado'],
];
const REQUIRED = ['nombre', 'perfil', 'equipo', 'consentimiento', 'event_id'];
const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = parseBody_(e);

    if (data.website) return json_({ ok: true });

    const missing = REQUIRED.filter(function (k) { return !String(data[k] || '').trim(); });
    if (missing.length) return json_({ ok: false, error: 'Faltan campos: ' + missing.join(', ') });
    const digits = String(data.telefono || '').replace(/\D/g, '');
    const email = String(data.email || '').replace(/\s+/g, '').toLowerCase();
    if (!digits && !email) return json_({ ok: false, error: 'Falta el teléfono o el correo' });
    if (digits && (digits.length < 8 || digits.length > 15)) return json_({ ok: false, error: 'Teléfono no válido' });
    if (email && (email.length > 254 || !EMAIL_RE.test(email))) return json_({ ok: false, error: 'Correo no válido' });
    data.email = email;
    data.canal = data.canal === 'Correo' || (email && !digits) ? 'Correo' : 'WhatsApp';

    lock.waitLock(20000);
    const sheet = getSheet_();

    if (isDuplicate_(sheet, String(data.event_id))) return json_({ ok: true, duplicate: true });

    data.fecha = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
    data.estado = 'Nuevo';
    data.whatsapp = digits ? 'https://wa.me/' + digits : '';
    const row = COLUMNS.map(function (c) { return clean_(data[c[0]]); });
    sheet.appendRow(row);
    SpreadsheetApp.flush();

    if (SEND_EMAIL_NOTIFICATION) notify_(data);
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
  console.log('Listo: pestaña "' + SHEET_NAME + '" preparada. Ahora Implementar > Nueva implementación > Aplicación web.');
}

function doGet() {
  return json_({ ok: true, service: 'VytalGroup leads', time: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss') });
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
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const headers = COLUMNS.map(function (c) { return c[1]; });
  const first = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = first.join('') !== '' && first[0] === headers[0];
  if (!hasHeaders) {
    if (sheet.getLastRow() > 0) sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#0B1929').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('@');
    sheet.setColumnWidths(1, headers.length, 160);
  }
  return sheet;
}

function isDuplicate_(sheet, eventId) {
  const col = COLUMNS.findIndex(function (c) { return c[0] === 'event_id'; }) + 1;
  const last = sheet.getLastRow();
  if (last < 2 || !eventId) return false;
  const from = Math.max(2, last - 200);
  const ids = sheet.getRange(from, col, last - from + 1, 1).getValues();
  return ids.some(function (r) { return String(r[0]) === eventId; });
}

function clean_(v) {
  let s = v === undefined || v === null ? '' : String(v);
  s = s.slice(0, 1000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function notify_(d) {
  const lines = [
    'Nuevo lead desde la web de VytalGroup',
    '',
    'Nombre: ' + d.nombre,
    'Contactar por: ' + d.canal,
    d.telefono ? 'Teléfono: ' + d.telefono : 'Correo: ' + d.email,
    d.whatsapp ? 'WhatsApp: ' + d.whatsapp : '',
    'Perfil: ' + d.perfil,
    'Equipo: ' + d.equipo,
    'Modelo: ' + (d.modelo || 'No aplica'),
    'Campaña: ' + [d.utm_source, d.utm_medium, d.utm_campaign].filter(String).join(' / '),
    'Fecha: ' + d.fecha,
  ];
  const mail = {
    to: NOTIFY_EMAIL,
    subject: 'Nuevo lead: ' + d.nombre + ' (' + (d.modelo || d.equipo) + ')',
    body: lines.filter(function (l, i) { return l !== '' || i === 1; }).join('\n'),
  };
  if (d.email) mail.replyTo = d.email;
  MailApp.sendEmail(mail);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
