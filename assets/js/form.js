// Formulario corto de 4 preguntas, una por pantalla:
//   1. ¿Qué equipo te interesa? (desde "Lo quiero" el modelo ya viene elegido y se salta este paso)
//   2. ¿Cuál es tu perfil? Clínica, fisioterapeuta, médico u otro.
//   3. ¿Cómo te llamas?
//   4. ¿A qué WhatsApp te escribimos? + consentimiento. Con "Prefiero por correo" la misma
//      pregunta pasa a pedir el correo (formato validado y aviso si el dominio parece mal escrito).
// · Avance automático al elegir una opción con el dedo o el ratón; con teclado, Enter.
// · Validación en línea, datos conservados al volver atrás, prefijo con buscador.
// · Antispam: campo trampa, tiempo mínimo de 3 s y bloqueo de doble envío.
// · Envío a Google Apps Script (texto plano, sin preflight CORS). Solo tras una respuesta
//   { ok: true } se muestra el "gracias" y se dispara Lead (una vez, eventID = event_id).

import { COUNTRIES } from './data.js';
import { createSelect } from './select.js';
import { getAttribution } from './attribution.js';
import { lead } from './tracking.js';

const TOTAL = 4;
const MIN_MS = 3000;
const WA = 'https://wa.me/34616372644?text=';
const WHAT = {
  'Ecógrafo': 'un ecógrafo',
  'Diatermia': 'una diatermia',
  'Presoterapia': 'un equipo de presoterapia',
  'Ondas de choque': 'un equipo de ondas de choque',
  'Magnetoterapia de alta intensidad': 'un equipo de magnetoterapia de alta intensidad',
  'Láser de alta potencia': 'un láser de alta potencia',
  'Electrólisis percutánea ecoguiada': 'un equipo de electrólisis percutánea ecoguiada',
  'Camillas de fisioterapia': 'una camilla de fisioterapia',
  'Otro equipo': 'otro equipo del catálogo',
};
// "Otro equipo" en el paso 1 abre un desplegable con el resto de categorías del catálogo
const OTHER = ['Magnetoterapia de alta intensidad', 'Láser de alta potencia', 'Electrólisis percutánea ecoguiada', 'Camillas de fisioterapia', 'Otro'];
const WITH_MODELS = ['Ecógrafo', 'Diatermia'];
const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// Correo: parte local con los caracteres permitidos (sin puntos al principio, al final ni seguidos),
// dominio con etiquetas válidas y extensión de al menos 2 letras. Sin "lookbehind": iOS < 16.4 no lo entiende.
const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const validEmail = (v) => v.length <= 254 && v.indexOf('@') <= 64 && EMAIL_RE.test(v);
const DOMAINS = ['gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'yahoo.com', 'yahoo.es', 'icloud.com', 'live.com', 'live.es', 'msn.com', 'me.com', 'gmx.com', 'gmx.es', 'protonmail.com', 'proton.me', 'telefonica.net', 'movistar.es'];

let form;
let steps;
let ui;
let prefix;
let other;
let state;
let ready = false;
let busy = false;
let finished = false;
let pointerPick = false;
let pending = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));
const $ = (sel, ctx = form) => ctx.querySelector(sel);
const stepEl = (n) => steps[n - 1];
const shortModel = (m) => m.replace(/\s*\([^)]*\)$/, '');

// ------------------------------------------------------------------ teléfono
function phoneDigits(raw, c) {
  let d = String(raw).replace(/\D/g, '');
  if (c.trunk && d.startsWith('0')) d = d.slice(1);
  return d;
}
function groupDigits(d, groups) {
  const out = [];
  let i = 0;
  for (const g of groups) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + g));
    i += g;
  }
  if (i < d.length) out.push(d.slice(i));
  return out.join(' ');
}
function phoneValid() {
  const c = state.country;
  const d = ui.tel.value.replace(/\D/g, '');
  if (c.iso === 'XX') return /^\+/.test(ui.tel.value.trim()) && d.length >= 8 && d.length <= 15;
  const n = phoneDigits(ui.tel.value, c);
  return n.length >= c.min && n.length <= c.max && (!c.lead || c.lead.test(n));
}
function phoneFull() {
  const c = state.country;
  if (c.iso === 'XX') return `+${ui.tel.value.replace(/\D/g, '')}`;
  return `+${c.dial} ${groupDigits(phoneDigits(ui.tel.value, c), c.groups)}`;
}
function onTelInput() {
  const el = ui.tel;
  let v = el.value;
  const caret = el.selectionStart ?? v.length;
  const digitsBefore = v.slice(0, caret).replace(/\D/g, '').length;
  const trimmed = v.trim();
  // Si pegan el número con prefijo internacional, se detecta el país
  if (/^(\+|00)/.test(trimmed) && state.country.iso !== 'XX') {
    const all = trimmed.replace(/^00/, '').replace(/\D/g, '');
    const hit = COUNTRIES.filter((c) => c.dial).sort((a, b) => b.dial.length - a.dial.length).find((c) => all.startsWith(c.dial));
    if (hit) {
      setCountry(hit);
      prefix.setValue(hit.iso);
      v = all.slice(hit.dial.length);
    }
  }
  const c = state.country;
  let formatted;
  if (c.iso === 'XX') {
    const d = v.replace(/\D/g, '').slice(0, 15);
    formatted = d ? `+${groupDigits(d, [3, 3, 3, 3, 3])}` : (v.trim().startsWith('+') ? '+' : '');
  } else {
    formatted = groupDigits(phoneDigits(v, c).slice(0, c.max + 1), c.groups);
  }
  if (formatted !== el.value) {
    el.value = formatted;
    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < digitsBefore) {
      if (/\d/.test(formatted[pos])) seen++;
      pos++;
    }
    try { el.setSelectionRange(pos, pos); } catch { /* algunos navegadores no lo permiten en tel */ }
  }
  fieldError('tel', '');
}
function setCountry(c) {
  state.country = c;
  ui.tel.placeholder = c.ph;
}

// ------------------------------------------------------------------ correo
const emailValue = () => ui.email.value.replace(/\s+/g, '').toLowerCase();
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
// Si el dominio se parece mucho a uno habitual (gmial.com, hotmal.es, gmail.con...) se propone el bueno
function emailSuggestion(v) {
  const at = v.lastIndexOf('@');
  if (at < 1) return '';
  const domain = v.slice(at + 1);
  if (!domain || DOMAINS.includes(domain)) return '';
  let best = '';
  let bestD = 99;
  DOMAINS.forEach((d) => { const x = distance(domain, d); if (x < bestD) { bestD = x; best = d; } });
  return bestD <= (domain.length < 8 ? 1 : 2) ? `${v.slice(0, at)}@${best}` : '';
}
function showSuggestion() {
  const v = emailValue();
  const sug = validEmail(v) ? emailSuggestion(v) : '';
  state.sugFor = v;
  ui.hintFix.textContent = sug;
  ui.hint.hidden = !sug;
  if (sug) ui.live.textContent = `¿Querías decir ${sug}?`;
}
function onEmailInput() {
  const el = ui.email;
  // Sin espacios: ni al escribir ni al pegar
  if (/\s/.test(el.value)) {
    const caret = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, caret).replace(/\s+/g, '').length;
    el.value = el.value.replace(/\s+/g, '');
    try { el.setSelectionRange(before, before); } catch { /* type=email no siempre lo permite */ }
  }
  fieldError('email', '');
  ui.hint.hidden = true;
}
function setContact(mode, focus = true) {
  if (state.contact === mode) return;
  state.contact = mode;
  const step = stepEl(4);
  ui.contacts.forEach((p) => {
    const on = p.dataset.contact === mode;
    p.hidden = !on;
    p.classList.toggle('is-in', on && !reduced());
  });
  step.setAttribute('aria-labelledby', mode === 'email' ? 'q-email' : 'q-tel');
  fieldError('tel', '');
  fieldError('email', '');
  ui.hint.hidden = true;
  const field = mode === 'email' ? ui.email : ui.tel;
  if (focus) field.focus({ preventScroll: true });
  ui.live.textContent = step.querySelector(`[data-contact="${mode}"] .qf__q`).textContent;
}

// ------------------------------------------------------------------ validación
function nameProblem() {
  const v = ui.name.value.trim();
  if (!v) return 'Escribe tu nombre.';
  return v.length >= 2 && /\p{L}/u.test(v) ? '' : 'Revisa tu nombre.';
}
function telProblem() {
  if (!ui.tel.value.trim()) return 'Escribe tu número de WhatsApp.';
  return phoneValid() ? '' : 'Revisa el número: faltan o sobran cifras.';
}
function emailProblem() {
  const v = emailValue();
  if (!v) return 'Escribe tu correo.';
  return validEmail(v) ? '' : 'Revisa el correo: debe ser como nombre@correo.com.';
}
function problem(n) {
  if (n === 1) {
    if (!state.equipo) return 'Elige una opción.';
    return state.equipo === 'Otro equipo' && !state.otro ? 'Elige qué equipo buscas.' : '';
  }
  if (n === 2) return state.perfil ? '' : 'Elige una opción.';
  if (n === 3) return nameProblem();
  return state.contact === 'email' ? emailProblem() : telProblem();
}
// Errores de los pasos de opciones (1 y 2)
function setError(n, msg) {
  stepEl(n).querySelector('[data-error]').textContent = msg;
}
// Errores de los campos (nombre, WhatsApp y correo), cada uno bajo su campo
function fieldError(which, msg) {
  const f = { name: ui.name, tel: ui.tel, email: ui.email }[which];
  const e = { name: ui.nameErr, tel: ui.telErr, email: ui.emailErr }[which];
  if (!msg && !e.textContent) return;
  e.textContent = msg;
  f.setAttribute('aria-invalid', String(!!msg));
}
// Muestra el error del paso n donde toca y devuelve si el paso está bien
function check(n) {
  const msg = problem(n);
  if (n <= 2) setError(n, msg);
  else fieldError(n === 3 ? 'name' : state.contact, msg);
  return !msg;
}
// Campo que recibe el foco en cada paso (en el 4, el de WhatsApp o el de correo)
function fieldOf(n) {
  const el = stepEl(n);
  if (n === 4) return state.contact === 'email' ? ui.email : ui.tel;
  return el.querySelector('.field') || el.querySelector('input[type=radio]:checked') || el.querySelector('input[type=radio]');
}
function consentOk(show) {
  const ok = ui.consent.checked;
  if (show || ok) {
    ui.consentErr.textContent = ok ? '' : 'Necesitamos tu permiso para escribirte.';
    ui.consent.setAttribute('aria-invalid', String(!ok));
  }
  return ok;
}

// ------------------------------------------------------------------ navegación
function update() {
  const n = state.step;
  ui.progress.style.setProperty('--p', (finished ? TOTAL : n) / TOTAL);
  ui.bar.setAttribute('aria-valuenow', String(n));
  ui.bar.setAttribute('aria-valuetext', `Paso ${n} de ${TOTAL}`);
  ui.count.textContent = `${n}/${TOTAL}`;
  ui.back.hidden = n === 1 || finished;
  // En los pasos de opciones el botón "Siguiente" solo aparece si ya hay respuesta
  stepEl(1).querySelector('[data-next]').classList.toggle('is-shown', !!state.equipo);
  stepEl(2).querySelector('[data-next]').classList.toggle('is-shown', !!state.perfil);
  // En el paso 2 se recuerda qué equipo se ha elegido, con la opción de cambiarlo
  const what = state.modelo ? shortModel(state.modelo) : equipoFinal();
  ui.pickedBox.hidden = !what;
  ui.picked.textContent = what;
}
function keepInView() {
  const card = form.closest('.fcard') || form;
  const r = card.getBoundingClientRect();
  const hd = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hd')) || 64;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (r.top < hd + 8 || r.top > vh * 0.45) {
    window.scrollBy({ top: r.top - hd - 16, behavior: reduced() ? 'auto' : 'smooth' });
  }
}
// Con el teclado del móvil abierto, el campo y su botón deben quedar a la vista
function fitStep() {
  const vv = window.visualViewport;
  if (!vv || finished) return;
  const step = stepEl(state.step);
  const btn = step.querySelector('.qf__next.is-shown, .qf__send');
  const q = step.querySelector('.qf__q');
  if (!btn || !q) return;
  const bottom = vv.offsetTop + vv.height - 12;
  const over = btn.getBoundingClientRect().bottom - bottom;
  const room = q.getBoundingClientRect().top - vv.offsetTop - 12;
  if (over > 0) window.scrollBy({ top: Math.min(over, Math.max(room, 0)) });
}
function focusStep() {
  const target = fieldOf(state.step);
  if (target) target.focus({ preventScroll: true });
}
function goTo(n, dir = 'fwd') {
  if (n === state.step) return;
  stepEl(state.step).classList.remove('is-active');
  form.classList.toggle('is-back', dir === 'back');
  state.step = n;
  stepEl(n).classList.add('is-active');
  update();
  focusStep();
  keepInView();
  const q = n === 4 ? stepEl(4).querySelector(`[data-contact="${state.contact}"] .qf__q`) : stepEl(n).querySelector('.qf__q');
  ui.live.textContent = `Paso ${n} de ${TOTAL}: ${q.textContent}`;
}
function next() {
  if (finished) return;
  const n = state.step;
  if (n === TOTAL) { submit(); return; }
  if (!check(n)) {
    const f = fieldOf(n);
    if (f) f.focus({ preventScroll: true });
    return;
  }
  goTo(n + 1);
}
function back() {
  if (state.step > 1 && !finished) goTo(state.step - 1, 'back');
}

// Equipo que llega a la hoja: la categoría elegida en el desplegable si se marcó "Otro equipo"
function equipoFinal() {
  if (state.equipo !== 'Otro equipo') return state.equipo;
  return state.otro && state.otro !== 'Otro' ? state.otro : 'Otro equipo';
}
function showOther(on) {
  ui.other.hidden = !on;
  if (!on) state.otro = '';
}

// ------------------------------------------------------------------ preselección desde las tarjetas
// "Lo quiero" ya dice el equipo y el modelo: se va directo a los datos de contacto
function applyPreselect(model, equipo) {
  if (finished) return;
  state.equipo = equipo;
  state.modelo = model;
  showOther(false);
  const r = form.querySelector(`input[name="equipo"][value="${equipo}"]`);
  if (r) r.checked = true;
  setError(1, '');
  if (state.step === 1) goTo(2);
  else update();
}

// ------------------------------------------------------------------ envío
function device() {
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const tablet = /iPad|Tablet/i.test(ua) || iPadOS || (/Android/i.test(ua) && !/Mobi/i.test(ua));
  const type = tablet ? 'Tablet' : /Mobi|iPhone|iPod|Android/i.test(ua) ? 'Móvil' : 'Escritorio';
  const os = /iPhone|iPad|iPod/.test(ua) || iPadOS ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Otro';
  const app = /Instagram/.test(ua) ? ' · Instagram' : /FBAN|FBAV|FB_IAB/.test(ua) ? ' · Facebook' : '';
  return `${type} · ${os}${app}`;
}
function payload() {
  const a = getAttribution();
  const byEmail = state.contact === 'email';
  return {
    nombre: ui.name.value.trim(),
    canal: byEmail ? 'Correo' : 'WhatsApp',
    telefono: byEmail ? '' : phoneFull(),
    email: byEmail ? emailValue() : '',
    perfil: state.perfil,
    equipo: equipoFinal(),
    modelo: state.modelo || (WITH_MODELS.includes(state.equipo) ? 'Sin decidir' : ''),
    consentimiento: `Sí · ${new Date().toISOString()}`,
    utm_source: a.utm_source || '',
    utm_medium: a.utm_medium || '',
    utm_campaign: a.utm_campaign || '',
    utm_content: a.utm_content || '',
    utm_term: a.utm_term || '',
    fbclid: a.fbclid || '',
    fbc: a.fbc || '',
    fbp: a.fbp || '',
    referrer: a.referrer || '',
    landing_url: a.landing_url || location.href,
    dispositivo: device(),
    idioma: navigator.language || '',
    event_id: state.eventId,
    website: form.elements.website.value || '',
  };
}
function waText() {
  const name = ui.name.value.trim().split(/\s+/)[0];
  const what = state.modelo ? shortModel(state.modelo) : WHAT[equipoFinal()] || 'vuestros equipos';
  return encodeURIComponent(`Hola, ${name ? `soy ${name}. ` : ''}vengo de la web y me interesa ${what}.`);
}
function setLoading(on) {
  ui.submit.classList.toggle('is-loading', on);
  ui.submit.setAttribute('aria-busy', String(on));
  ui.submit.setAttribute('aria-disabled', String(on));
}
async function submit() {
  if (busy || finished) return;
  // Si falta algo de un paso anterior se vuelve a ese paso con su aviso
  for (let n = 1; n <= TOTAL; n++) {
    if (problem(n)) {
      if (n !== state.step) goTo(n, 'back');
      check(n);
      const f = fieldOf(n);
      if (f) f.focus({ preventScroll: true });
      return;
    }
  }
  // Dominio que parece mal escrito (gmial.com...): se avisa una vez antes de enviar; si se deja así, se envía
  if (state.contact === 'email') {
    const v = emailValue();
    ui.email.value = v;
    if (state.sugFor !== v && emailSuggestion(v)) {
      showSuggestion();
      ui.hintFix.focus();
      return;
    }
  }
  if (!consentOk(true)) { ui.consent.focus(); return; }
  busy = true;
  setLoading(true);
  const data = payload();
  const bot = data.website.trim() !== '' || performance.now() - state.t0 < MIN_MS;
  try {
    if (bot) {
      await new Promise((r) => setTimeout(r, 800));
      done(false);
      return;
    }
    const endpoint = String((window.VG_CONFIG && window.VG_CONFIG.SHEETS_ENDPOINT) || '').trim();
    if (!endpoint) {
      console.warn('[VytalGroup] Falta SHEETS_ENDPOINT en config.js: el formulario no puede guardar leads hasta que pegues la URL de la aplicación web de Apps Script (ver README).');
      throw new Error('sin-endpoint');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
      redirect: 'follow',
      credentials: 'omit',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    let json = null;
    try { json = JSON.parse(await res.text()); } catch { json = null; }
    if (!res.ok || !json || json.ok !== true) throw new Error((json && json.error) || `HTTP ${res.status}`);
    done(true);
  } catch (err) {
    if (err.message !== 'sin-endpoint') console.error('[VytalGroup] No se pudo enviar el formulario:', err);
    failed();
  } finally {
    busy = false;
    setLoading(false);
  }
}
function showEnd(el) {
  stepEl(state.step).classList.remove('is-active');
  form.classList.add('is-finished');
  el.hidden = false;
  el.focus({ preventScroll: true });
  keepInView();
}
function done(real) {
  finished = true;
  const first = ui.name.value.trim().split(/\s+/)[0] || '';
  ui.doneTitle.textContent = first ? `Gracias, ${first}. Te escribimos muy pronto.` : 'Gracias. Te escribimos muy pronto.';
  ui.doneWa.href = WA + waText();
  update();
  showEnd(ui.done);
  ui.live.textContent = ui.doneTitle.textContent;
  if (real) lead(state.eventId, state.modelo ? shortModel(state.modelo) : equipoFinal(), equipoFinal());
  window.dispatchEvent(new CustomEvent('vg:lead-done'));
}
function failed() {
  ui.failWa.href = WA + waText();
  showEnd(ui.fail);
  ui.live.textContent = 'No se ha podido enviar. Tus datos siguen aquí.';
}
function retry() {
  ui.fail.hidden = true;
  form.classList.remove('is-finished');
  stepEl(state.step).classList.add('is-active');
  submit();
}

// ------------------------------------------------------------------ API
export function initForm() {
  if (ready) return;
  form = document.getElementById('qf');
  if (!form) return;
  steps = [...form.querySelectorAll('.qf__step')];
  ui = {
    bar: $('.qf__bar'),
    progress: $('[data-progress]'),
    count: $('[data-count-step]'),
    back: $('[data-back]'),
    pickedBox: $('[data-picked-box]'),
    other: $('[data-other]'),
    picked: $('[data-picked]'),
    name: $('#f-name'),
    tel: $('#f-tel'),
    email: $('#f-email'),
    nameErr: $('[data-error-name]'),
    telErr: $('[data-error-tel]'),
    emailErr: $('[data-error-email]'),
    hint: $('[data-email-hint]'),
    hintFix: $('[data-email-fix]'),
    contacts: [...form.querySelectorAll('[data-contact]')],
    consent: form.elements.consent,
    consentErr: $('[data-error-consent]'),
    submit: $('[data-submit]'),
    done: $('[data-done]'),
    doneTitle: $('[data-done-title]'),
    doneWa: $('[data-done-wa]'),
    fail: $('[data-fail]'),
    failWa: $('[data-fail-wa]'),
    live: $('[data-live]'),
  };
  state = { step: 1, equipo: '', modelo: '', otro: '', perfil: '', contact: 'tel', country: COUNTRIES[0], eventId: uuid(), t0: performance.now() };

  prefix = createSelect($('[data-prefix]'), {
    id: 'pf',
    className: 'sel--prefix',
    title: 'Prefijo',
    options: COUNTRIES.map((c) => ({ value: c.iso, label: c.name, html: `${c.flag}<span>${c.name}</span>`, hint: c.dial ? `+${c.dial}` : '', c })),
    value: 'ES',
    searchable: true,
    searchLabel: 'Buscar país o prefijo',
    button: (x) => `${x.c.flag}<span>${x.c.dial ? `+${x.c.dial}` : '+'}</span>`,
    buttonLabel: (x) => `Prefijo: ${x.c.name}${x.c.dial ? ` +${x.c.dial}` : ''}. Cambiar`,
    match: (x, q) => norm(x.label).includes(q.replace(/^\+/, '')) || (!!x.c.dial && x.c.dial.startsWith(q.replace(/\D/g, '') || '#')),
    always: (x) => x.value === 'XX',
    onChange: (x) => {
      setCountry(x.c);
      onTelInput();
      ui.tel.focus({ preventScroll: true });
    },
  });
  setCountry(COUNTRIES[0]);

  other = createSelect($('[data-other-select]'), {
    id: 'otro',
    title: '¿Qué equipo buscas?',
    placeholder: 'Elige un equipo',
    labelledby: 'q-other',
    options: OTHER.map((v) => ({ value: v, label: v })),
    onChange: (x) => {
      state.otro = x.value;
      setError(1, '');
      update();
      setTimeout(next, reduced() ? 0 : 280);
    },
  });

  form.addEventListener('pointerdown', (e) => { pointerPick = !!e.target.closest('.opt'); });
  form.addEventListener('click', (e) => {
    const t = e.target;
    if (t.matches('.opt input')) {
      let wait = false;
      if (t.name === 'equipo') {
        state.equipo = t.value;
        state.modelo = '';
        wait = t.value === 'Otro equipo';
        showOther(wait);
        setError(1, '');
      } else if (t.name === 'perfil') {
        state.perfil = t.value;
        setError(2, '');
      }
      update();
      if (wait) {
        // Con "Otro equipo" no se avanza: se abre el desplegable para elegir cuál
        if (pointerPick) setTimeout(() => other.button.click(), reduced() ? 0 : 200);
        pointerPick = false;
        return;
      }
      if (pointerPick) {
        pointerPick = false;
        setTimeout(next, reduced() ? 0 : 280);
      }
      return;
    }
    if (t.closest('[data-next]')) { next(); return; }
    if (t.closest('[data-back]')) { back(); return; }
    if (t.closest('[data-change]')) { goTo(1, 'back'); return; }
    if (t.closest('[data-switch]')) { setContact(t.closest('[data-switch]').dataset.switch); return; }
    if (t.closest('[data-email-fix]')) {
      ui.email.value = ui.hintFix.textContent;
      ui.hint.hidden = true;
      fieldError('email', '');
      ui.email.focus();
      return;
    }
    if (t.closest('[data-retry]')) retry();
  });
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const t = e.target;
    if (t.closest('.sel')) return; // los desplegables gestionan su propio Enter
    if (t.matches('input:not([type=checkbox]), .opt input')) {
      e.preventDefault();
      next();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    next();
  });
  ui.name.addEventListener('input', () => fieldError('name', ''));
  ui.tel.addEventListener('input', onTelInput);
  ui.email.addEventListener('input', onEmailInput);
  // Al salir del campo solo se limpia (minúsculas y sin espacios). El aviso de dominio mal escrito sale al
  // pulsar Enviar: si saliera aquí, movería el botón justo cuando se está tocando.
  ui.email.addEventListener('change', () => { ui.email.value = emailValue(); });
  ui.consent.addEventListener('change', () => consentOk(false));
  [ui.name, ui.tel, ui.email].forEach((f) => f.addEventListener('focus', () => setTimeout(fitStep, 350)));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { if (form.contains(document.activeElement)) fitStep(); });

  ready = true;
  update();
  if (pending) {
    applyPreselect(pending.model, pending.equipo);
    pending = null;
  }
}

export function preselect(model, equipo) {
  if (!ready) { pending = { model, equipo }; return; }
  applyPreselect(model, equipo);
}

export function focusForm() {
  if (ready && !finished) focusStep();
}
