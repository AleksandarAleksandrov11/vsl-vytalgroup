// Desplegable propio y accesible: botón + panel con lista (listbox) y buscador opcional.
// Se usa para el prefijo telefónico (con buscador) y para "Otro equipo" en el paso 1.
// Teclado: flechas, Inicio/Fin, Enter, Escape y Tab. Cierre al pulsar fuera.
// En móvil (< 640 px) el panel se abre como hoja inferior con fondo, sin abrir el teclado.

const SHEET_MQ = '(max-width: 639px)';
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;

/**
 * @param {HTMLElement} slot
 * @param {object} o
 *   id, options [{ value, label, html?, hint?, keywords? }], value, title, placeholder,
 *   searchable, searchLabel, button(opt) → html, buttonLabel(opt) → texto accesible,
 *   match(opt, q) → boolean, always(opt) → boolean (opción que siempre aparece al buscar), onChange(opt)
 */
export function createSelect(slot, o) {
  const id = o.id;
  const options = o.options;
  let current = options.find((x) => x.value === o.value) || null;
  let visible = options;
  let active = 0;
  let open = false;

  const root = document.createElement('div');
  root.className = `sel${o.className ? ` ${o.className}` : ''}`;
  root.innerHTML = `
    <button class="sel__btn" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-panel"${o.labelledby ? ` aria-describedby="${o.labelledby}"` : ''}></button>
    <div class="sel__backdrop" data-sel-close></div>
    <div class="sel__panel" id="${id}-panel" role="dialog" aria-label="${o.title}">
      <div class="sel__head"><span>${o.title}</span><button class="sel__close" type="button" aria-label="Cerrar" data-sel-close>${icon('i-close')}</button></div>
      ${o.searchable ? `<div class="sel__search">${icon('i-search')}<input type="text" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="${id}-list" aria-label="${o.searchLabel}" placeholder="${o.searchLabel}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></div>` : ''}
      <div class="sel__list" id="${id}-list" role="listbox" tabindex="-1" aria-label="${o.title}"></div>
    </div>`;
  slot.appendChild(root);
  const btn = root.querySelector('.sel__btn');
  const search = root.querySelector('.sel__search input');
  const list = root.querySelector('.sel__list');
  const panel = root.querySelector('.sel__panel');
  const focusTarget = () => (search && !matchMedia(SHEET_MQ).matches ? search : list);

  function paintButton() {
    if (!current) {
      btn.innerHTML = `<span class="sel__placeholder">${o.placeholder}</span>${icon('i-chevron')}`;
      btn.setAttribute('aria-label', `${o.title}: ${o.placeholder}`);
      return;
    }
    btn.innerHTML = `${o.button ? o.button(current) : `<span>${current.label}</span>`}${icon('i-chevron')}`;
    btn.setAttribute('aria-label', o.buttonLabel ? o.buttonLabel(current) : `${o.title}: ${current.label}. Cambiar`);
  }

  function renderList() {
    list.innerHTML = visible.length
      ? visible.map((x, i) => `<div class="sel__opt${i === active ? ' is-active' : ''}" role="option" id="${id}-o-${i}" data-i="${i}" aria-selected="${current === x}">${x.html || `<span>${x.label}</span>`}${x.hint ? `<small>${x.hint}</small>` : ''}</div>`).join('')
      : '<p class="sel__empty">Sin resultados.</p>';
    syncActive(false);
  }

  function syncActive(scroll = true) {
    list.querySelectorAll('.sel__opt').forEach((el, i) => el.classList.toggle('is-active', i === active));
    const el = list.children[active];
    [search, list].filter(Boolean).forEach((t) => {
      if (el && el.id) t.setAttribute('aria-activedescendant', el.id);
      else t.removeAttribute('aria-activedescendant');
    });
    if (el && scroll) el.scrollIntoView({ block: 'nearest' });
  }

  function filter() {
    const q = norm(search.value);
    visible = !q ? options : options.filter((x) => (o.always && o.always(x)) || (o.match ? o.match(x, q) : norm(x.label).includes(q)));
    active = 0;
    renderList();
  }

  // Se abre hacia abajo si cabe; si no, hacia arriba si arriba hay más sitio.
  // Si aun así no cabe entero, la página se desplaza lo justo para verlo.
  function place() {
    if (matchMedia(SHEET_MQ).matches) { root.classList.remove('is-up'); return; }
    const r = btn.getBoundingClientRect();
    const need = panel.offsetHeight + 12;
    const below = window.innerHeight - r.bottom;
    const up = below < need && r.top > below;
    root.classList.toggle('is-up', up);
    if (!up && below < need) window.scrollBy({ top: need - below + 8, behavior: 'smooth' });
  }

  function show() {
    if (open) return;
    open = true;
    if (search) search.value = '';
    visible = options;
    active = Math.max(0, options.indexOf(current));
    renderList();
    place();
    root.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    if (matchMedia(SHEET_MQ).matches) document.documentElement.style.overflow = 'hidden';
    focusTarget().focus({ preventScroll: true });
    syncActive();
    document.addEventListener('pointerdown', outside, true);
  }

  function hide(focusBtn = true) {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    document.removeEventListener('pointerdown', outside, true);
    if (focusBtn) btn.focus({ preventScroll: true });
  }

  function outside(e) {
    if (!root.contains(e.target)) hide(false);
  }

  function pick(x, silent = false) {
    if (!x) return;
    current = x;
    paintButton();
    if (!silent && o.onChange) o.onChange(x);
  }

  function keys(e) {
    const n = visible.length;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (n) { active = (active + 1) % n; syncActive(); } break;
      case 'ArrowUp': e.preventDefault(); if (n) { active = (active - 1 + n) % n; syncActive(); } break;
      case 'Home': if (e.target === list) { e.preventDefault(); active = 0; syncActive(); } break;
      case 'End': if (e.target === list) { e.preventDefault(); active = n - 1; syncActive(); } break;
      case 'Enter':
      case ' ':
        if (e.key === ' ' && e.target === search) break;
        e.preventDefault();
        e.stopPropagation();
        if (visible[active]) { hide(false); pick(visible[active]); }
        break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); hide(); break;
      case 'Tab': hide(false); break;
      default:
        // Escribir con la lista enfocada lleva al buscador
        if (search && e.target === list && e.key.length === 1 && !e.metaKey && !e.ctrlKey) search.focus();
    }
  }

  btn.addEventListener('click', () => (open ? hide() : show()));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(); }
  });
  if (search) {
    search.addEventListener('input', filter);
    search.addEventListener('keydown', keys);
  }
  list.addEventListener('keydown', keys);
  // Al pasar el ratón, la opción queda activa (Enter elige la misma que se ve resaltada)
  list.addEventListener('pointermove', (e) => {
    const el = e.target.closest('.sel__opt');
    if (!el || e.pointerType === 'touch') return;
    const i = Number(el.dataset.i);
    if (i !== active) { active = i; syncActive(false); }
  });
  list.addEventListener('click', (e) => {
    const el = e.target.closest('.sel__opt');
    if (!el) return;
    hide(false);
    pick(visible[Number(el.dataset.i)]);
  });
  root.addEventListener('click', (e) => { if (e.target.closest('[data-sel-close]')) hide(); });
  window.addEventListener('resize', () => { if (open) place(); }, { passive: true });

  paintButton();
  return {
    setValue: (value) => pick(options.find((x) => x.value === value), true),
    get value() { return current; },
    focus: () => btn.focus({ preventScroll: true }),
    button: btn,
  };
}
