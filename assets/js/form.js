// Formulario "una pregunta cada vez".
// Pasos, validación en línea, prefijos con buscador, sugerencia de email, resumen,
// envío a Google Sheets (Apps Script) y evento Lead solo tras respuesta de éxito.

import { createDropdown } from './dropdown.js';
import { MODELS, UNSURE, COUNTRIES, PROVINCES, PROVINCE_ALIASES, OUTSIDE_SPAIN, EMAIL_DOMAINS } from './data.js';
import { getAttribution } from './attribution.js';
import { lead } from './tracking.js';

const TOTAL = 9;
const WA = 'https://wa.me/34616372644?text=';
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[a-z]{2,}$/i;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let form;
let steps;
let ui;
let dd;
let state;
let busy = false;
let finished = false;
let returnTo = 0;
let pointerPick = false;
let errTimer = 0;
let ready = false;

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  }));
const $ = (sel, ctx = form) => ctx.querySelector(sel);
const stepEl = (n) => steps[n - 1];
const errEl = (n) => stepEl(n).querySelector('[data-error]');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
  const d = String(ui.tel.value).replace(/\D/g, '');
  if (c.iso === 'XX') return /^\+/.test(ui.tel.value.trim()) && d.length >= 8 && d.length <= 15;
  const n = phoneDigits(ui.tel.value, c);
  return n.length >= c.min && n.length <= c.max && (!c.lead || c.lead.test(n));
}
function phoneE164Display() {
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
  if (/^(\+|00)/.test(trimmed) && state.country.iso !== 'XX') {
    const all = trimmed.replace(/^00/, '').replace(/\D/g, '');
    const hit = COUNTRIES.filter((c) => c.dial).sort((a, b) => b.dial.length - a.dial.length).find((c) => all.startsWith(c.dial));
    if (hit) {
      setCountry(hit.iso, true);
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
  fieldChanged(6);
}
function setCountry(iso, silent) {
  const c = COUNTRIES.find((x) => x.iso === iso) || COUNTRIES[0];
  state.country = c;
  ui.tel.placeholder = c.ph;
  if (silent) dd.prefix.setValue(iso, true);
}

// ------------------------------------------------------------------ email
function lev(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}
function emailSuggestion(v) {
  const at = v.lastIndexOf('@');
  if (at < 1) return '';
  const user = v.slice(0, at);
  const domain = v.slice(at + 1).toLowerCase().trim();
  if (domain.length < 4 || EMAIL_DOMAINS.includes(domain)) return '';
  let best = '';
  let dist = 9;
  EMAIL_DOMAINS.forEach((d) => {
    const x = lev(domain, d);
    if (x < dist) { dist = x; best = d; }
  });
  return dist > 0 && dist <= 2 ? `${user}@${best}` : '';
}
function updateSuggestion() {
  const s = emailSuggestion(ui.email.value.trim());
  if (s === ui.suggest.dataset.value) return; // no se vuelve a pintar: el botón debe seguir existiendo al pulsarlo
  ui.suggest.dataset.value = s;
  if (!s) { ui.suggest.hidden = true; ui.suggest.innerHTML = ''; return; }
  ui.suggest.hidden = false;
  ui.suggest.innerHTML = `¿Querías decir <strong>${esc(s)}</strong>? <button type="button" data-fix-email="${esc(s)}">Sí, corregir</button>`;
}

// ------------------------------------------------------------------ validación
function validate(n, show = false) {
  let ok = true;
  let msg = '';
  switch (n) {
    case 1: ok = state.productos.length > 0; msg = 'Elige al menos un equipo para seguir.'; break;
    case 2: ok = true; break;
    case 3: ok = !!state.perfil; msg = 'Elige tu perfil para seguir.'; break;
    case 4: ok = !!state.plazo; msg = 'Dime para cuándo lo necesitas.'; break;
    case 5: {
      const v = ui.nombre.value.trim();
      ok = v.length >= 2 && /\p{L}/u.test(v);
      msg = 'Escribe tu nombre, con al menos 2 letras.';
      break;
    }
    case 6: {
      ok = phoneValid();
      const c = state.country;
      msg = c.iso === 'XX'
        ? 'Escribe el prefijo y el número, por ejemplo +41 78 123 45 67.'
        : `Revisa el número: en ${c.name} tiene ${c.min === c.max ? c.min : `entre ${c.min} y ${c.max}`} cifras.`;
      break;
    }
    case 7: ok = EMAIL_RE.test(ui.email.value.trim()); msg = 'Revisa el email, parece que falta algo.'; break;
    case 8:
      if (!state.provincia) { ok = false; msg = 'Elige tu provincia o "Fuera de España".'; }
      else if (state.provincia === OUTSIDE_SPAIN && ui.pais.value.trim().length < 2) { ok = false; msg = 'Escribe en qué país estás.'; }
      break;
    case 9: ok = ui.consent.checked; msg = 'Necesito tu consentimiento para poder escribirte.'; break;
    default: break;
  }
  if (show) setError(n, ok ? '' : msg);
  return ok;
}
function setError(n, msg) {
  const e = errEl(n);
  if (e && e.textContent !== msg) e.textContent = msg;
  const field = { 5: ui.nombre, 6: ui.tel, 7: ui.email }[n];
  if (field) field.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (n === 8) {
    dd.prov.setInvalid(!!msg && !state.provincia);
    ui.pais.setAttribute('aria-invalid', msg && state.provincia === OUTSIDE_SPAIN ? 'true' : 'false');
  }
}
function fieldChanged(n) {
  clearTimeout(errTimer);
  if (validate(n)) setError(n, '');
  else if (currentValueNotEmpty(n)) errTimer = setTimeout(() => validate(n, true), 900);
  update();
}
function currentValueNotEmpty(n) {
  const el = { 5: ui.nombre, 6: ui.tel, 7: ui.email, 8: ui.pais }[n];
  return !!(el && el.value.trim());
}

// ------------------------------------------------------------------ interfaz
function update() {
  const n = state.step;
  const valid = validate(n);
  const last = n === TOTAL;
  ui.next.hidden = last;
  ui.submit.hidden = !last;
  ui.next.disabled = !valid;
  ui.submit.disabled = !valid || busy;
  ui.back.hidden = n === 1;
  ui.nextLabel.textContent = returnTo && n !== TOTAL ? 'Guardar' : 'Siguiente';
  ui.count.textContent = `Paso ${n}`;
  ui.progress.setAttribute('aria-valuenow', String(n));
  ui.bar.style.setProperty('--progress', String(n / TOTAL));
}
function announce() {
  const q = stepEl(state.step).querySelector('.qstep__q').textContent.trim();
  ui.live.textContent = `Paso ${state.step} de ${TOTAL}. ${q}`;
}
function focusStep() {
  const s = stepEl(state.step);
  let target = null;
  switch (state.step) {
    case 1: target = s.querySelector('input:checked') || s.querySelector('input'); break;
    case 2: target = dd.models.trigger; break;
    case 3: case 4: target = s.querySelector('input:checked') || s.querySelector('input'); break;
    case 5: target = ui.nombre; break;
    case 6: target = ui.tel; break;
    case 7: target = ui.email; break;
    case 8: target = dd.prov.trigger; break;
    case 9: target = ui.consent; break;
    default: break;
  }
  if (target) target.focus({ preventScroll: true });
}

function goTo(n, dir = 'fwd') {
  if (n === state.step || n < 1 || n > TOTAL) return;
  const cur = stepEl(state.step);
  const nxt = stepEl(n);
  if (n === 2) buildModelOptions();
  if (n === TOTAL) renderSummary();
  const back = dir === 'back';
  cur.classList.remove('is-active', 'is-entering', 'is-back');
  cur.classList.add('is-leaving');
  cur.classList.toggle('is-back', back);
  setTimeout(() => cur.classList.remove('is-leaving', 'is-back'), reduced() ? 0 : 330);
  nxt.classList.add('is-active', 'is-entering');
  nxt.classList.toggle('is-back', back);
  setTimeout(() => nxt.classList.remove('is-entering', 'is-back'), reduced() ? 0 : 520);
  state.step = n;
  update();
  announce();
  focusStep();
  keepFormInView();
}
function next() {
  if (!validate(state.step, true)) return;
  if (returnTo && state.step !== TOTAL) {
    const r = returnTo;
    returnTo = 0;
    goTo(r);
    return;
  }
  if (state.step < TOTAL) goTo(state.step + 1);
}
function back() {
  returnTo = 0;
  if (state.step > 1) goTo(state.step - 1, 'back');
}
function keepFormInView() {
  const r = (form.closest('.fcard') || form).getBoundingClientRect();
  const headerH = document.getElementById('header')?.offsetHeight || 64;
  if (r.top < headerH || r.top > innerHeight * 0.6) {
    const y = scrollY + r.top - headerH - 16;
    window.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' });
  }
}

// ------------------------------------------------------------------ modelos
function buildModelOptions() {
  const prods = state.productos.length ? state.productos : Object.keys(MODELS);
  const opts = [];
  prods.forEach((p) => (MODELS[p] || []).forEach((m) => opts.push({ value: m, label: m, group: p })));
  opts.push({ value: UNSURE, label: UNSURE, special: true });
  dd.models.setOptions(opts);
  state.modelos = state.modelos.filter((m) => opts.some((o) => o.value === m));
  dd.models.setValue(state.modelos, true);
}
function syncProducts() {
  form.querySelectorAll('input[name="productos"]').forEach((i) => { i.checked = state.productos.includes(i.value); });
}

// ------------------------------------------------------------------ resumen
function ubicacion() {
  return state.provincia === OUTSIDE_SPAIN ? `Fuera de España: ${ui.pais.value.trim()}` : state.provincia;
}
function renderSummary() {
  const rows = [
    ['Equipo', state.productos.join(', '), 1],
    ['Modelo', state.modelos.length ? state.modelos.join(', ') : 'Sin preferencia', 2],
    ['Perfil', state.perfil, 3],
    ['Plazo', state.plazo, 4],
    ['Nombre', ui.nombre.value.trim(), 5],
    ['Teléfono', phoneE164Display(), 6],
    ['Email', ui.email.value.trim(), 7],
    ['Ubicación', ubicacion(), 8],
  ];
  ui.summary.innerHTML = rows.map(([k, v, s]) => `<div><dt>${k}</dt><dd>${esc(v || '')}</dd><button type="button" class="summary__edit" data-edit="${s}" aria-label="Editar ${k.toLowerCase()}">Editar</button></div>`).join('');
}

// ------------------------------------------------------------------ envío
function device() {
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const tablet = /iPad|Tablet/i.test(ua) || iPadOS || (/Android/i.test(ua) && !/Mobi/i.test(ua));
  const mobile = /Mobi|iPhone|iPod|Android/i.test(ua);
  const type = tablet ? 'Tablet' : mobile ? 'Móvil' : 'Escritorio';
  const os = /iPhone|iPad|iPod/.test(ua) || iPadOS ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Otro';
  return `${type} · ${os} · ${screen.width}×${screen.height}`;
}
function browser() {
  const ua = navigator.userAgent;
  const b = /Instagram/.test(ua) ? 'Instagram (navegador interno)'
    : /FBAN|FBAV|FB_IAB/.test(ua) ? 'Facebook (navegador interno)'
      : /EdgA?\/|EdgiOS/.test(ua) ? 'Edge'
        : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
          : /OPR\//.test(ua) ? 'Opera'
            : /Firefox|FxiOS/.test(ua) ? 'Firefox'
              : /Chrome|CriOS/.test(ua) ? 'Chrome'
                : /Safari/.test(ua) ? 'Safari' : 'Otro';
  return `${b} · ${navigator.language || ''}`;
}
function payload() {
  const a = getAttribution();
  return {
    nombre: ui.nombre.value.trim(),
    telefono: phoneE164Display(),
    email: ui.email.value.trim(),
    ubicacion: ubicacion(),
    productos: state.productos.join(', '),
    modelos: state.modelos.join(', '),
    perfil: state.perfil,
    plazo: state.plazo,
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
    navegador_idioma: browser(),
    event_id: state.eventId,
    website: form.elements.website.value || '',
  };
}
function waText() {
  const what = state.modelos.filter((m) => m !== UNSURE).join(', ') || state.productos.join(', ') || 'vuestros equipos';
  const name = ui.nombre.value.trim();
  return encodeURIComponent(`Hola Javier, ${name ? `soy ${name}. ` : ''}Vengo de la web y quiero información sobre ${what}.`);
}
function setLoading(on) {
  ui.submit.classList.toggle('is-loading', on);
  ui.submit.setAttribute('aria-busy', String(on));
  update();
}
async function submit() {
  if (busy || finished) return;
  for (let n = 1; n <= TOTAL; n++) {
    if (!validate(n)) { if (n !== state.step) goTo(n, 'back'); validate(n, true); return; }
  }
  busy = true;
  setLoading(true);
  ui.fail.hidden = true;
  const data = payload();
  const bot = data.website.trim() !== '' || performance.now() < 3000;
  try {
    if (bot) {
      await new Promise((r) => setTimeout(r, 700));
      done(false);
      return;
    }
    const endpoint = String((window.VG_CONFIG && window.VG_CONFIG.SHEETS_ENDPOINT) || '').trim();
    if (!endpoint) {
      console.warn('[VytalGroup] Falta configurar SHEETS_ENDPOINT en config.js. El formulario no puede guardar leads hasta que pegues la URL de la aplicación web de Apps Script (ver README).');
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
function done(real) {
  finished = true;
  const first = ui.nombre.value.trim().split(/\s+/)[0] || '';
  ui.doneTitle.textContent = first ? `Gracias, ${first}. Te escribo muy pronto.` : 'Gracias. Te escribo muy pronto.';
  ui.doneWa.href = WA + waText();
  stepEl(state.step).classList.remove('is-active');
  form.classList.add('is-finished');
  ui.done.hidden = false;
  ui.done.focus({ preventScroll: true });
  keepFormInView();
  ui.live.textContent = ui.doneTitle.textContent;
  if (real) lead(state.eventId, state.productos);
  window.dispatchEvent(new CustomEvent('vg:lead-done'));
}
function failed() {
  ui.failWa.href = WA + waText();
  stepEl(state.step).classList.remove('is-active');
  form.classList.add('is-finished');
  ui.fail.hidden = false;
  ui.fail.focus({ preventScroll: true });
  keepFormInView();
  ui.live.textContent = 'No se ha podido enviar. Tus datos siguen aquí.';
}
function retry() {
  ui.fail.hidden = true;
  form.classList.remove('is-finished');
  stepEl(state.step).classList.add('is-active');
  submit();
}

// ------------------------------------------------------------------ API pública
export function initForm() {
  if (ready) return;
  form = document.getElementById('qform');
  if (!form) return;
  ready = true;
  steps = [...form.querySelectorAll('.qstep')];
  ui = {
    next: $('[data-next]'),
    back: $('[data-back]'),
    submit: $('[data-submit]'),
    count: $('[data-step-now]'),
    progress: $('.qform__progress'),
    bar: $('.qform__bar'),
    live: $('[data-live]'),
    nombre: $('#f-nombre'),
    tel: $('#f-tel'),
    email: $('#f-email'),
    pais: $('#f-pais'),
    country: $('[data-country]'),
    suggest: $('[data-suggest]'),
    consent: form.elements.consentimiento,
    summary: $('[data-summary]'),
    done: $('[data-done]'),
    doneTitle: $('[data-done-title]'),
    doneWa: $('[data-done-wa]'),
    fail: $('[data-fail]'),
    failWa: $('[data-fail-wa]'),
  };
  ui.nextLabel = document.createElement('span');
  ui.nextLabel.textContent = 'Siguiente';
  ui.next.firstChild.replaceWith(ui.nextLabel);

  state = {
    step: 1,
    productos: [],
    modelos: [],
    perfil: '',
    plazo: '',
    provincia: '',
    country: COUNTRIES[0],
    eventId: uuid(),
  };

  dd = {
    models: createDropdown($('[data-dd="modelos"]'), {
      multiple: true,
      searchable: true,
      label: 'Modelos',
      placeholder: 'Elige uno o varios modelos',
      sheetTitle: '¿Qué modelo tienes en mente?',
      searchPlaceholder: 'Busca un modelo',
      exclusive: UNSURE,
      renderValue: (sel) => esc(sel.length === 1 ? sel[0].label : `${sel.length} modelos elegidos`),
      onChange: (v) => { state.modelos = v; update(); },
    }),
    prefix: createDropdown($('[data-dd="prefijo"]'), {
      searchable: true,
      className: 'dd--prefix',
      label: 'Prefijo del país',
      sheetTitle: 'Prefijo del país',
      searchPlaceholder: 'Busca un país o prefijo',
      describedBy: 'e-tel',
      options: COUNTRIES.map((c) => ({
        value: c.iso,
        label: c.name,
        keywords: c.dial ? `+${c.dial} ${c.dial}` : '',
        html: `${c.flag}<span class="dd__opt-main">${esc(c.name)}</span><span class="dd__opt-sub">${c.dial ? `+${c.dial}` : ''}</span>`,
      })),
      renderValue: (sel) => {
        const c = COUNTRIES.find((x) => x.iso === sel[0].value);
        return `<span style="display:inline-flex;align-items:center;gap:8px">${c.flag}<span>${c.dial ? `+${c.dial}` : '+'}</span></span>`;
      },
      onChange: (iso) => {
        setCountry(iso, false);
        if (iso === 'XX' && !ui.tel.value.trim().startsWith('+')) ui.tel.value = ui.tel.value ? `+${ui.tel.value.replace(/\D/g, '')}` : '';
        else if (iso !== 'XX') onTelInput();
        fieldChanged(6);
        ui.tel.focus({ preventScroll: true });
      },
    }),
    prov: createDropdown($('[data-dd="provincia"]'), {
      searchable: true,
      label: 'Provincia',
      placeholder: 'Elige tu provincia',
      sheetTitle: '¿Dónde estás?',
      searchPlaceholder: 'Busca tu provincia',
      searchAutocomplete: 'address-level1',
      options: [
        ...PROVINCES.map((p) => ({ value: p, label: p, keywords: PROVINCE_ALIASES[p] || '' })),
        { value: OUTSIDE_SPAIN, label: OUTSIDE_SPAIN, special: true, keywords: 'extranjero otro pais internacional' },
      ],
      onChange: (v) => {
        state.provincia = v;
        const out = v === OUTSIDE_SPAIN;
        ui.country.hidden = !out;
        if (out) setTimeout(() => ui.pais.focus({ preventScroll: true }), 60);
        fieldChanged(8);
      },
    }),
  };
  dd.prefix.setValue('ES', true);

  // Selección de opciones (checkbox y radio)
  form.addEventListener('pointerdown', (e) => { if (e.target.closest('.opt')) pointerPick = true; });
  form.addEventListener('keydown', () => { pointerPick = false; }, true);
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'productos') {
      state.productos = [...form.querySelectorAll('input[name="productos"]:checked')].map((i) => i.value);
      fieldChanged(1);
      if (state.productos.length) setError(1, '');
    } else if (t.name === 'perfil' || t.name === 'plazo') {
      state[t.name] = t.value;
      setError(state.step, '');
      update();
      const opt = t.closest('.opt');
      opt.classList.remove('is-picked');
      void opt.offsetWidth;
      opt.classList.add('is-picked');
      if (pointerPick) {
        const at = state.step;
        setTimeout(() => { if (state.step === at && !finished) next(); }, 300);
      }
      pointerPick = false;
    } else if (t.name === 'consentimiento') {
      if (t.checked) setError(9, '');
      update();
    }
  });

  ui.nombre.addEventListener('input', () => fieldChanged(5));
  ui.nombre.addEventListener('blur', () => { if (ui.nombre.value.trim()) validate(5, true); });
  ui.tel.addEventListener('input', onTelInput);
  ui.tel.addEventListener('blur', () => { if (ui.tel.value.trim()) validate(6, true); });
  ui.email.addEventListener('input', () => { fieldChanged(7); updateSuggestion(); });
  ui.email.addEventListener('blur', () => { if (ui.email.value.trim()) validate(7, true); updateSuggestion(); });
  ui.pais.addEventListener('input', () => fieldChanged(8));

  form.addEventListener('click', (e) => {
    const fix = e.target.closest('[data-fix-email]');
    if (fix) {
      ui.email.value = fix.dataset.fixEmail;
      updateSuggestion();
      fieldChanged(7);
      ui.email.focus({ preventScroll: true });
      return;
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      returnTo = TOTAL;
      goTo(+edit.dataset.edit, 'back');
    }
  });
  ui.next.addEventListener('click', next);
  ui.back.addEventListener('click', back);
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  form.querySelector('[data-retry]').addEventListener('click', retry);

  // Enter avanza en los campos de texto y en las opciones
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const t = e.target;
    if (t.closest('.dd')) return;
    if (t.matches('input[type="text"], input[type="tel"], input[type="email"], input[type="radio"], input[type="checkbox"]')) {
      e.preventDefault();
      if (state.step === TOTAL) { if (validate(TOTAL, true)) submit(); } else next();
    }
  });

  // Con el teclado móvil abierto, mantener visibles el campo y el botón
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const a = document.activeElement;
      if (!a || !form.contains(a) || !a.matches('input')) return;
      const nav = form.querySelector('.qform__nav').getBoundingClientRect();
      const vv = window.visualViewport;
      const limit = vv.height + vv.offsetTop - 12;
      if (nav.bottom > limit) window.scrollBy({ top: nav.bottom - limit, behavior: 'smooth' });
    });
  }

  update();
}

/** Preselecciona producto y modelo desde "Me interesa". Devuelve el texto para el aviso. */
export function preselect(product, model) {
  initForm();
  if (!ready || finished) return '';
  if (product && !state.productos.includes(product)) {
    state.productos.push(product);
    syncProducts();
    setError(1, '');
  }
  if (model) {
    if (model === UNSURE) state.modelos = [UNSURE];
    else if (!state.modelos.includes(model)) state.modelos = state.modelos.filter((m) => m !== UNSURE).concat(model);
  }
  if (state.step <= 2) {
    if (state.step === 2) buildModelOptions();
    else goTo(2);
  }
  update();
  return model && model !== UNSURE ? model : product;
}

export function focusCurrent() {
  initForm();
  if (ready && !finished) focusStep();
}
