// Dropdown / combobox personalizado y accesible.
// Selección simple o múltiple, búsqueda opcional, navegación con flechas, Enter y Escape,
// cierre al pulsar fuera, apertura hacia arriba o hacia abajo según el espacio y hoja
// inferior en móvil. ARIA: combobox + listbox + option + aria-activedescendant.

const SHEET_MQ = '(max-width: 639px)';
let uid = 0;
let openInstance = null;

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

/**
 * @param {HTMLElement} slot  Contenedor donde se monta el componente
 * @param {object} o
 *   options: [{ value, label, sub?, group?, keywords?, special?, html? }]
 *   multiple, searchable, placeholder, label, sheetTitle, searchPlaceholder,
 *   searchAutocomplete, exclusive (valor que excluye al resto), className,
 *   renderValue(selected[]) → html, onChange(values), describedBy
 */
export function createDropdown(slot, o) {
  const id = `dd${++uid}`;
  const listId = `${id}-list`;
  let options = [];
  let selected = [];
  let active = -1;
  let visible = [];
  let isOpen = false;
  let rendered = false; // las opciones se pintan en la primera apertura (menos DOM inicial)
  let sheet = false;
  let backdrop = null;
  let lastTypeahead = '';
  let typeaheadTimer = 0;

  const root = document.createElement('div');
  root.className = `dd${o.className ? ` ${o.className}` : ''}`;
  root.innerHTML = `
    <button type="button" class="dd__trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${listId}" aria-label="${esc(o.label)}"${o.describedBy ? ` aria-describedby="${o.describedBy}"` : ''}>
      <span class="dd__value is-placeholder">${esc(o.placeholder || 'Selecciona')}</span>
      ${icon('i-chevron', 'dd__chev')}
    </button>
    <div class="dd__panel" id="${id}-panel">
      <div class="dd__sheet-head"><p class="dd__sheet-title">${esc(o.sheetTitle || o.label)}</p><button type="button" class="dd__sheet-close" aria-label="Cerrar">${icon('i-close')}</button></div>
      ${o.searchable ? `<div class="dd__search">${icon('i-search')}<input type="text" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="${listId}" aria-label="Buscar" placeholder="${esc(o.searchPlaceholder || 'Buscar')}" autocomplete="${o.searchAutocomplete || 'off'}" autocapitalize="off" spellcheck="false" enterkeyhint="done"></div>` : ''}
      <div class="dd__list" id="${listId}" role="listbox" tabindex="-1" aria-label="${esc(o.label)}"${o.multiple ? ' aria-multiselectable="true"' : ''}></div>
      <div class="dd__foot"><button type="button" class="btn btn--primary btn--block dd__done">Listo</button></div>
    </div>
    ${o.multiple ? '<div class="dd__pills" aria-live="polite"></div>' : ''}`;
  slot.appendChild(root);

  const trigger = root.querySelector('.dd__trigger');
  const valueEl = root.querySelector('.dd__value');
  const panel = root.querySelector('.dd__panel');
  const list = root.querySelector('.dd__list');
  const search = root.querySelector('.dd__search input');
  const pills = root.querySelector('.dd__pills');
  const home = root; // el panel vuelve aquí al cerrar la hoja inferior

  // ------------------------------------------------------------ render
  function render() {
    const groups = new Map();
    options.forEach((opt, i) => {
      const g = opt.group || '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push([opt, i]);
    });
    let html = '';
    let gi = 0;
    groups.forEach((items, g) => {
      const gid = `${id}-g${gi++}`;
      if (g) html += `<div role="group" aria-labelledby="${gid}" class="dd__grp"><p class="dd__group" id="${gid}">${esc(g)}</p>`;
      items.forEach(([opt, i]) => {
        const sel = selected.includes(opt.value);
        html += `<div class="dd__opt${opt.special ? ' dd__opt--special' : ''}" role="option" id="${id}-o${i}" data-i="${i}" aria-selected="${sel}">
          ${opt.html || `<span class="dd__opt-main">${esc(opt.label)}</span>`}${icon('i-check', 'dd__tick')}</div>`;
      });
      if (g) html += '</div>';
    });
    html += '<p class="dd__empty" hidden>Sin resultados</p>';
    list.innerHTML = html;
    filter(search ? search.value : '');
  }

  function renderValue() {
    const sel = options.filter((opt) => selected.includes(opt.value));
    if (!sel.length) {
      valueEl.classList.add('is-placeholder');
      valueEl.textContent = o.placeholder || 'Selecciona';
    } else {
      valueEl.classList.remove('is-placeholder');
      if (o.renderValue) valueEl.innerHTML = o.renderValue(sel);
      else valueEl.textContent = o.multiple ? (sel.length === 1 ? sel[0].label : `${sel.length} seleccionados`) : sel[0].label;
    }
    if (pills) {
      pills.innerHTML = o.multiple && sel.length
        ? sel.map((s) => `<span class="dd__pill">${esc(s.label)}<button type="button" data-remove="${esc(s.value)}" aria-label="Quitar ${esc(s.label)}">${icon('i-close')}</button></span>`).join('')
        : '';
    }
    list.querySelectorAll('.dd__opt').forEach((el) => {
      el.setAttribute('aria-selected', String(selected.includes(options[+el.dataset.i].value)));
    });
  }

  function filter(q) {
    const nq = norm(q);
    visible = [];
    list.querySelectorAll('.dd__opt').forEach((el) => {
      const opt = options[+el.dataset.i];
      const hay = norm(`${opt.label} ${opt.sub || ''} ${opt.keywords || ''}`);
      const show = !nq || hay.includes(nq);
      el.hidden = !show;
      if (show) visible.push(+el.dataset.i);
    });
    list.querySelectorAll('.dd__grp').forEach((g) => { g.hidden = !g.querySelector('.dd__opt:not([hidden])'); });
    list.querySelector('.dd__empty').hidden = visible.length > 0;
    if (!visible.includes(active)) setActive(visible.length ? visible[0] : -1, false);
  }

  // ------------------------------------------------------------ activo
  function comboEl() { return search && isOpen && !sheet ? search : trigger; }
  function setActive(i, scroll = true) {
    list.querySelector('.dd__opt.is-active')?.classList.remove('is-active');
    active = i;
    const el = i >= 0 ? list.querySelector(`[data-i="${i}"]`) : null;
    [trigger, search, list].forEach((n) => n && n.removeAttribute('aria-activedescendant'));
    if (el) {
      el.classList.add('is-active');
      comboEl().setAttribute('aria-activedescendant', el.id);
      if (sheet) list.setAttribute('aria-activedescendant', el.id);
      if (scroll) el.scrollIntoView({ block: 'nearest' });
    }
  }
  function move(delta) {
    if (!visible.length) return;
    const pos = visible.indexOf(active);
    let next = pos === -1 ? (delta > 0 ? 0 : visible.length - 1) : pos + delta;
    next = Math.max(0, Math.min(visible.length - 1, next));
    setActive(visible[next]);
  }

  // ------------------------------------------------------------ selección
  function choose(i) {
    const opt = options[i];
    if (!opt) return;
    if (o.multiple) {
      if (selected.includes(opt.value)) selected = selected.filter((v) => v !== opt.value);
      else if (o.exclusive && opt.value === o.exclusive) selected = [opt.value];
      else selected = selected.filter((v) => v !== o.exclusive).concat(opt.value);
    } else {
      selected = [opt.value];
    }
    renderValue();
    emit();
    if (!o.multiple) close(true);
  }
  function emit() { o.onChange?.(o.multiple ? [...selected] : selected[0] || ''); }

  // ------------------------------------------------------------ abrir / cerrar
  function position() {
    if (sheet) return;
    const r = trigger.getBoundingClientRect();
    const vh = window.visualViewport ? window.visualViewport.height : innerHeight;
    const below = vh - r.bottom - 16;
    const above = r.top - 16 - 64;
    const up = below < 280 && above > below;
    root.classList.toggle('dd--up', up);
    panel.style.setProperty('--dd-max', `${Math.max(180, Math.min(360, up ? above : below))}px`);
    panel.style.left = '';
    const pr = panel.getBoundingClientRect();
    const overflow = pr.right - (document.documentElement.clientWidth - 12);
    if (overflow > 0) panel.style.left = `${-overflow}px`;
  }

  function lockScroll(lock) {
    document.documentElement.classList.toggle('dd-lock', lock);
  }

  function fitSheetToViewport() {
    if (!sheet || !window.visualViewport) return;
    const vv = window.visualViewport;
    const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
    panel.style.bottom = `${kb}px`;
    panel.style.maxHeight = `${Math.min(vv.height * 0.9, 640)}px`;
  }

  function open() {
    if (isOpen) return;
    if (openInstance && openInstance !== api) openInstance.close();
    openInstance = api;
    isOpen = true;
    sheet = matchMedia(SHEET_MQ).matches;
    trigger.setAttribute('aria-expanded', 'true');
    if (!rendered) { rendered = true; render(); }
    if (search) search.value = '';
    filter('');
    const firstSel = options.findIndex((opt) => selected.includes(opt.value));
    if (sheet) {
      backdrop = document.createElement('div');
      backdrop.className = 'dd-backdrop';
      backdrop.addEventListener('click', () => close(true));
      document.body.append(backdrop, panel);
      panel.classList.add('is-sheet');
      lockScroll(true);
      requestAnimationFrame(() => {
        backdrop.classList.add('is-open');
        panel.classList.add('is-open-sheet');
      });
      window.visualViewport?.addEventListener('resize', fitSheetToViewport);
      fitSheetToViewport();
      list.focus({ preventScroll: true });
    } else {
      root.classList.add('is-open');
      position();
      if (search) search.focus({ preventScroll: true });
    }
    setActive(firstSel >= 0 ? firstSel : visible[0] ?? -1);
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('resize', onResize);
  }

  function close(focusTrigger = false) {
    if (!isOpen) return;
    isOpen = false;
    if (openInstance === api) openInstance = null;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', onResize);
    if (sheet) {
      const b = backdrop;
      panel.classList.remove('is-open-sheet');
      b?.classList.remove('is-open');
      window.visualViewport?.removeEventListener('resize', fitSheetToViewport);
      lockScroll(false);
      setTimeout(() => {
        b?.remove();
        if (!isOpen) {
          panel.classList.remove('is-sheet');
          panel.style.bottom = '';
          panel.style.maxHeight = '';
          home.insertBefore(panel, pills || null);
        }
      }, 460);
    } else {
      root.classList.remove('is-open');
    }
    if (focusTrigger) trigger.focus({ preventScroll: true });
  }

  function onOutside(e) {
    if (root.contains(e.target) || panel.contains(e.target)) return;
    if (backdrop && e.target === backdrop) return;
    close(false);
  }
  function onResize() { if (!sheet) position(); }

  // ------------------------------------------------------------ teclado
  function onKey(e) {
    const k = e.key;
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) {
        e.preventDefault();
        open();
        if (k === 'ArrowUp') setActive(visible[visible.length - 1]);
        return;
      }
      if (k.length === 1 && /\S/.test(k)) typeahead(k, e);
      return;
    }
    switch (k) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Home': if (e.target !== search) { e.preventDefault(); setActive(visible[0]); } break;
      case 'End': if (e.target !== search) { e.preventDefault(); setActive(visible[visible.length - 1]); } break;
      case 'PageDown': e.preventDefault(); move(6); break;
      case 'PageUp': e.preventDefault(); move(-6); break;
      case 'Enter':
        e.preventDefault();
        if (active >= 0) choose(active);
        else if (o.multiple) close(true);
        break;
      case ' ':
        if (e.target !== search) { e.preventDefault(); if (active >= 0) choose(active); }
        break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(true); break;
      case 'Tab': close(false); break;
      default:
        if (!search && k.length === 1 && /\S/.test(k)) typeahead(k, e);
    }
  }
  function typeahead(ch, e) {
    if (search) {
      e.preventDefault();
      open();
      search.value = ch;
      filter(ch);
      return;
    }
    clearTimeout(typeaheadTimer);
    lastTypeahead += norm(ch);
    typeaheadTimer = setTimeout(() => { lastTypeahead = ''; }, 700);
    const hit = options.findIndex((opt) => norm(opt.label).startsWith(lastTypeahead));
    if (hit >= 0) { if (!isOpen) open(); setActive(hit); }
  }

  // ------------------------------------------------------------ eventos
  trigger.addEventListener('click', () => (isOpen ? close(true) : open()));
  trigger.addEventListener('keydown', onKey);
  panel.addEventListener('keydown', (e) => { if (e.target !== trigger) onKey(e); });
  list.addEventListener('click', (e) => {
    const el = e.target.closest('.dd__opt');
    if (el) { setActive(+el.dataset.i, false); choose(+el.dataset.i); }
  });
  list.addEventListener('pointermove', (e) => {
    const el = e.target.closest('.dd__opt');
    if (el && +el.dataset.i !== active && e.pointerType === 'mouse') setActive(+el.dataset.i, false);
  });
  panel.querySelector('.dd__sheet-close').addEventListener('click', () => close(true));
  panel.querySelector('.dd__done').addEventListener('click', () => close(true));
  if (search) {
    search.addEventListener('input', (e) => {
      filter(search.value);
      // Autocompletado del navegador o pegado: si coincide exactamente, se selecciona
      if (!o.multiple && e.inputType !== 'insertText' && e.inputType !== 'deleteContentBackward') {
        const n = norm(search.value);
        const hit = options.findIndex((opt) => norm(opt.label) === n);
        if (hit >= 0) choose(hit);
      }
    });
  }
  if (pills) {
    pills.addEventListener('click', (e) => {
      const b = e.target.closest('[data-remove]');
      if (!b) return;
      selected = selected.filter((v) => v !== b.dataset.remove);
      renderValue();
      emit();
      trigger.focus({ preventScroll: true });
    });
  }

  // ------------------------------------------------------------ API
  const api = {
    root,
    trigger,
    open,
    close,
    get isOpen() { return isOpen; },
    setOptions(next) {
      options = next;
      selected = selected.filter((v) => options.some((opt) => opt.value === v));
      if (rendered) render();
      renderValue();
    },
    setValue(v, silent = false) {
      const arr = Array.isArray(v) ? v : v ? [v] : [];
      selected = arr.filter((x) => options.some((opt) => opt.value === x));
      renderValue();
      if (!silent) emit();
    },
    getValue() { return o.multiple ? [...selected] : selected[0] || ''; },
    setInvalid(bad) { trigger.setAttribute('aria-invalid', String(!!bad)); },
    focus() { trigger.focus({ preventScroll: true }); },
  };
  api.setOptions(o.options || []);
  return api;
}
