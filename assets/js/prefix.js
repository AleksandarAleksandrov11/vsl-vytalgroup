// Selector de prefijo telefónico: botón + panel con buscador y lista (listbox).
// Teclado: flechas, Inicio/Fin, Enter, Escape y Tab. Cierre al pulsar fuera.
// En móvil (< 640 px) el panel se abre como hoja inferior con fondo.

const SHEET_MQ = '(max-width: 639px)';
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;

export function createPrefix(slot, { countries, value = 'ES', onChange }) {
  let current = countries.find((c) => c.iso === value) || countries[0];
  let visible = countries;
  let active = 0;
  let open = false;
  let rendered = false;

  const root = document.createElement('div');
  root.className = 'pf';
  root.innerHTML = `
    <button class="pf__btn" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="pf-panel"></button>
    <div class="pf__backdrop" data-pf-close></div>
    <div class="pf__panel" id="pf-panel" role="dialog" aria-label="Elige el prefijo">
      <div class="pf__head"><span>Prefijo</span><button class="pf__close" type="button" aria-label="Cerrar" data-pf-close>${icon('i-close')}</button></div>
      <div class="pf__search">${icon('i-search')}<input type="text" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="pf-list" aria-label="Buscar país o prefijo" placeholder="Buscar país o prefijo" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></div>
      <div class="pf__list" id="pf-list" role="listbox" tabindex="-1" aria-label="Países"></div>
    </div>`;
  slot.appendChild(root);
  const btn = root.querySelector('.pf__btn');
  const search = root.querySelector('input');
  const list = root.querySelector('.pf__list');

  function paintButton() {
    btn.innerHTML = `${current.flag}<span>${current.dial ? `+${current.dial}` : '+'}</span>${icon('i-chevron')}`;
    btn.setAttribute('aria-label', `Prefijo: ${current.name}${current.dial ? ` +${current.dial}` : ''}. Cambiar`);
  }

  function renderList() {
    list.innerHTML = visible.length
      ? visible.map((c, i) => `<div class="pf__opt${i === active ? ' is-active' : ''}" role="option" id="pf-o-${c.iso}" data-iso="${c.iso}" aria-selected="${c.iso === current.iso}">${c.flag}<span>${c.name}</span><small>${c.dial ? `+${c.dial}` : ''}</small></div>`).join('')
      : '<p class="pf__empty">Sin resultados. Elige "Otro país".</p>';
    rendered = true;
    syncActive(false);
  }

  function syncActive(scroll = true) {
    list.querySelectorAll('.pf__opt').forEach((o, i) => o.classList.toggle('is-active', i === active));
    const el = list.children[active];
    if (el && el.id) {
      search.setAttribute('aria-activedescendant', el.id);
      list.setAttribute('aria-activedescendant', el.id);
      if (scroll) el.scrollIntoView({ block: 'nearest' });
    } else {
      search.removeAttribute('aria-activedescendant');
      list.removeAttribute('aria-activedescendant');
    }
  }

  function filter() {
    const q = norm(search.value).replace(/^\+/, '');
    visible = !q ? countries : countries.filter((c) => norm(c.name).includes(q) || (c.dial && c.dial.startsWith(q.replace(/\D/g, '') || '#')) || c.iso === 'XX');
    active = 0;
    renderList();
  }

  function place() {
    if (matchMedia(SHEET_MQ).matches) { root.classList.remove('is-up'); return; }
    const r = btn.getBoundingClientRect();
    root.classList.toggle('is-up', window.innerHeight - r.bottom < 360 && r.top > window.innerHeight - r.bottom);
  }

  function show() {
    if (open) return;
    open = true;
    search.value = '';
    visible = countries;
    active = Math.max(0, countries.indexOf(current));
    renderList();
    place();
    root.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    const sheet = matchMedia(SHEET_MQ).matches;
    if (sheet) document.documentElement.style.overflow = 'hidden';
    // En la hoja inferior no se abre el teclado hasta que se toca el buscador
    (sheet ? list : search).focus({ preventScroll: true });
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

  function pick(iso, silent = false) {
    const c = countries.find((x) => x.iso === iso);
    if (!c) return;
    current = c;
    paintButton();
    if (rendered) list.querySelectorAll('.pf__opt').forEach((o) => o.setAttribute('aria-selected', String(o.dataset.iso === iso)));
    if (!silent && onChange) onChange(c);
  }

  function keys(e) {
    const n = visible.length;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (n) { active = (active + 1) % n; syncActive(); } break;
      case 'ArrowUp': e.preventDefault(); if (n) { active = (active - 1 + n) % n; syncActive(); } break;
      case 'Home': if (e.target === list) { e.preventDefault(); active = 0; syncActive(); } break;
      case 'End': if (e.target === list) { e.preventDefault(); active = n - 1; syncActive(); } break;
      case 'Enter': e.preventDefault(); e.stopPropagation(); if (visible[active]) { hide(false); pick(visible[active].iso); } break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); hide(); break;
      case 'Tab': hide(false); break;
      default:
        // Escribir con la lista enfocada lleva al buscador
        if (e.target === list && e.key.length === 1 && !e.metaKey && !e.ctrlKey) search.focus();
    }
  }

  btn.addEventListener('click', () => (open ? hide() : show()));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(); }
  });
  search.addEventListener('input', filter);
  search.addEventListener('keydown', keys);
  list.addEventListener('keydown', keys);
  list.addEventListener('click', (e) => {
    const o = e.target.closest('.pf__opt');
    if (!o) return;
    hide(false);
    pick(o.dataset.iso);
  });
  root.addEventListener('click', (e) => { if (e.target.closest('[data-pf-close]')) hide(); });
  window.addEventListener('resize', () => { if (open) place(); }, { passive: true });

  paintButton();
  return {
    setValue: (iso) => pick(iso, true),
    get value() { return current; },
  };
}
