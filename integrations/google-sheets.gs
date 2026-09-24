/**
 * VytalGroup · Recepción de leads en Google Sheets
 * ---------------------------------------------------------------------------
 * Instalación (5 minutos):
 *  1. Crea una hoja de Google nueva (por ejemplo "Leads VytalGroup").
 *  2. En la hoja: Extensiones > Apps Script. Borra lo que haya y pega este archivo entero.
 *  3. Guarda. Arriba, elige la función "setup" y pulsa Ejecutar. Google pedirá permisos:
 *     Revisar permisos > tu cuenta > Configuración avanzada > Ir a (proyecto) > Permitir.
 *     Se crea la pestaña "Leads" con sus columnas.
 *  4. Implementar > Nueva implementación > tipo "Aplicación web":
 *       · Ejecutar como: Yo
 *       · Quién tiene acceso: Cualquier usuario
 *     Implementar y copia la URL que termina en /exec.
 *  5. Pega esa URL en config.js → SHEETS_ENDPOINT y publica la web.
 *  Para comprobarlo, abre la URL /exec en el navegador: debe responder {"ok":true,...}.
 *  Si cambias este código, vuelve a Implementar > Gestionar implementaciones > editar >
 *  Versión: nueva. La URL no cambia.
 *
 * Qué hace:
 *  · Recibe el formulario de la web (JSON enviado como texto plano, sin preflight CORS).
 *  · Valida lo mínimo en el servidor (campos obligatorios y campo trampa vacío).
 *  · Escribe una fila por lead en la pestaña "Leads" (la crea si no existe, con
 *    cabeceras en negrita y la primera fila congelada).
 *  · Añade un enlace directo a WhatsApp con el número del lead.
 *  · Fecha y hora legibles en zona Europe/Madrid.
 *  · Usa LockService para que dos leads simultáneos no se pisen y descarta envíos repetidos.
 *  · Aviso por email con cada lead (se desactiva poniendo SEND_EMAIL_NOTIFICATION = false).
 *  · Responde { ok: true } o { ok: false, error: "..." }.
 */

// ------------------------------------------------------------------ ajustes
const SHEET_NAME = 'Leads';
const TIMEZONE = 'Europe/Madrid';
const SEND_EMAIL_NOTIFICATION = true;             // false para no recibir un email por lead
const NOTIFY_EMAIL = 'vytalkinetech@gmail.com';

// Columnas en el orden pedido. [clave del JSON, título de la columna]
const COLUMNS = [
  ['fecha', 'Fecha'],
  ['nombre', 'Nombre'],
  ['telefono', 'Teléfono'],
  ['whatsapp', 'WhatsApp'],
  // Perfil: Clínica, Fisioterapeuta, Médico u Otro.
  ['perfil', 'Perfil'],
  // Equipo: Ecógrafo, Diatermia, Presoterapia, Ondas de choque o, desde "Otro equipo", la categoría
  // elegida (Magnetoterapia de alta intensidad, Láser de alta potencia, Electrólisis percutánea
  // ecoguiada, Camillas de fisioterapia) u "Otro equipo".
  ['equipo', 'Equipo'],
  // Modelo: solo en ecógrafos y diatermias (el de la tarjeta o "Sin decidir"); vacío en el resto.
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
// El formulario pide 4 cosas: equipo, perfil, nombre y WhatsApp (más el consentimiento).
const REQUIRED = ['nombre', 'telefono', 'perfil', 'equipo', 'consentimiento', 'event_id'];

// ------------------------------------------------------------------ entrada
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = parseBody_(e);

    // Campo trampa: si viene relleno es un bot. Se responde ok para no darle pistas.
    if (data.website) return json_({ ok: true });

    const missing = REQUIRED.filter(function (k) { return !String(data[k] || '').trim(); });
    if (missing.length) return json_({ ok: false, error: 'Faltan campos: ' + missing.join(', ') });
    const digits = String(data.telefono).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return json_({ ok: false, error: 'Teléfono no válido' });

    lock.waitLock(20000);
    const sheet = getSheet_();

    // Evita duplicados si el mismo envío llega dos veces (mismo event_id)
    if (isDuplicate_(sheet, String(data.event_id))) return json_({ ok: true, duplicate: true });

    data.fecha = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
    data.estado = 'Nuevo'; // Javier lo cambia a mano: Contactado, Presupuesto, Venta...
    data.whatsapp = 'https://wa.me/' + digits;
    const row = COLUMNS.map(function (c) { return clean_(data[c[0]]); });
    sheet.appendRow(row);
    SpreadsheetApp.flush();

    if (SEND_EMAIL_NOTIFICATION) notify_(data);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* el bloqueo puede no haberse obtenido */ }
  }
}

// Ejecútala una vez desde el editor: pide los permisos y crea la pestaña "Leads" con sus columnas
function setup() {
  getSheet_();
  if (SEND_EMAIL_NOTIFICATION) MailApp.getRemainingDailyQuota(); // para que Google pida también el permiso de email
  console.log('Listo: pestaña "' + SHEET_NAME + '" preparada. Ahora Implementar > Nueva implementación > Aplicación web.');
}

// Permite comprobar en el navegador que el despliegue responde
function doGet() {
  return json_({ ok: true, service: 'VytalGroup leads', time: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss') });
}

// ------------------------------------------------------------------ utilidades
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
  const from = Math.max(2, last - 200); // revisa los últimos 200 leads
  const ids = sheet.getRange(from, col, last - from + 1, 1).getValues();
  return ids.some(function (r) { return String(r[0]) === eventId; });
}

// Evita que un texto que empiece por = + - @ se interprete como fórmula
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
    'Teléfono: ' + d.telefono,
    'WhatsApp: ' + d.whatsapp,
    'Perfil: ' + d.perfil,
    'Equipo: ' + d.equipo,
    'Modelo: ' + (d.modelo || 'No aplica'),
    'Campaña: ' + [d.utm_source, d.utm_medium, d.utm_campaign].filter(String).join(' / '),
    'Fecha: ' + d.fecha,
  ];
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'Nuevo lead: ' + d.nombre + ' (' + (d.modelo || d.equipo) + ')',
    body: lines.join('\n'),
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
