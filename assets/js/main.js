// VytalGroup · landing
// Cabecera y barra de progreso, tarjeta "Clientes" del hero (reel.js), entradas al hacer scroll
// (bloques, titulares por líneas e imágenes), parallax y halo en escritorio, control segmentado,
// carrusel, categorías, conteo, comparador, maqueta del catálogo, marquesina, acordeón, barra fija
// en móvil, botones magnéticos, carga diferida del formulario y eventos del píxel.
// Solo se animan transform, opacity y variables CSS. Con prefers-reduced-motion quedan los fundidos.

import { captureAttribution } from './attribution.js';
import { initConsent } from './consent.js';
import { initTracking, viewContent, catalogDownload, contact } from './tracking.js';
import { initReel } from './reel.js';

const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktop = matchMedia('(min-width: 900px)');
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const hasIO = 'IntersectionObserver' in window;
const belowFold = (el) => el.getBoundingClientRect().top > window.innerHeight;

captureAttribution();
initTracking();
initConsent();

// ------------------------------------------------------------------ scroll: cabecera, progreso y parallax
const header = $('[data-header]');
const progress = $('[data-progress-bar]');
const plx = fine && desktop.matches && !reduced ? $$('[data-parallax]') : [];
plx.forEach((img) => { if (img.closest('.why__photo')) img.style.setProperty('--ps', '1.1'); });
let lastY = window.scrollY;
let ticking = false;
function onScroll() {
  const y = window.scrollY;
  header.classList.toggle('is-scrolled', y > 8);
  const dy = y - lastY;
  if (Math.abs(dy) > 6) {
    // En móvil se oculta al bajar y reaparece al subir
    header.classList.toggle('is-hidden', !desktop.matches && dy > 0 && y > 320 && !header.contains(document.activeElement));
    lastY = y;
  }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
  progress.classList.toggle('is-top', header.classList.contains('is-hidden'));
  // Parallax vertical muy leve (6 % del recorrido, máx. 16 px) medido sobre el contenedor
  const vh = window.innerHeight;
  plx.forEach((img) => {
    const r = img.parentElement.getBoundingClientRect();
    if (r.bottom < -80 || r.top > vh + 80) return;
    const off = Math.max(-16, Math.min(16, -(r.top + r.height / 2 - vh / 2) * 0.06));
    img.style.setProperty('--py', `${off.toFixed(1)}px`);
  });
  ticking = false;
}
window.addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
onScroll();

// ------------------------------------------------------------------ tarjeta "Clientes" del hero
const reelEl = $('[data-reel]');
if (reelEl) initReel(reelEl, { reduced, tilt: fine && desktop.matches && !reduced });

// ------------------------------------------------------------------ entradas al hacer scroll
// Solo se preparan los elementos que están por debajo de la primera pantalla: nada parpadea.
const reveal = hasIO ? new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    reveal.unobserve(e.target);
  });
}, { rootMargin: '0px 0px -8% 0px' }) : null;

// Titulares de sección: se parten en palabras y cada línea sube dentro de su máscara
function splitLines(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 1) { walk(n); return; }
      if (n.nodeType !== 3 || !n.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((t) => {
        if (!t) return;
        if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
        const w = document.createElement('span');
        const inner = document.createElement('span');
        w.className = 'w';
        inner.textContent = t;
        w.appendChild(inner);
        frag.appendChild(w);
      });
      n.replaceWith(frag);
    });
  };
  walk(el);
  el.classList.add('is-split');
  let line = -1;
  let top = null;
  $$('.w', el).forEach((w) => {
    const t = w.getBoundingClientRect().top;
    if (top === null || Math.abs(t - top) > 6) { line++; top = t; }
    w.style.setProperty('--i', line);
  });
}

if (reveal && !reduced) {
  const groups = new Map();
  $$('[data-rv]').forEach((el) => {
    if (!belowFold(el)) return;
    const parent = el.closest('section') || document.body;
    const i = groups.get(parent) || 0;
    groups.set(parent, i + 1);
    el.style.setProperty('--rd', `${Math.min(i, 4) * 70}ms`);
    el.classList.add('rv');
    reveal.observe(el);
  });
  $$('[data-lines]').forEach((el) => {
    if (!belowFold(el)) return;
    splitLines(el);
    reveal.observe(el);
  });
  // Imágenes de producto: fundido y escala de 0,96 a 1, escalonadas dentro de su rejilla
  $$('.card picture, .cat__media').forEach((el) => {
    if (!belowFold(el)) return;
    const li = el.closest('li');
    const i = li ? [...li.parentElement.children].indexOf(li) : 0;
    el.style.setProperty('--rd', `${(i % 3) * 90 + 120}ms`);
    el.classList.add('rvi');
    reveal.observe(el);
  });
}

// ------------------------------------------------------------------ halo de luz en tarjetas (escritorio)
if (fine && !reduced) {
  let raf = 0;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card, .cat__btn');
    if (!card) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--hx', `${Math.round(e.clientX - r.left)}px`);
      card.style.setProperty('--hy', `${Math.round(e.clientY - r.top)}px`);
    });
  }, { passive: true });
}

// ------------------------------------------------------------------ control segmentado + carrusel
const seg = $('[data-seg]');
const tabs = $$('[role="tab"]', seg);
const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
let currentTab = 0;
function selectTab(i, focus = false) {
  if (i !== currentTab) {
    // Transición cruzada: la nueva entra desde el lado hacia el que se avanza
    const dir = i > currentTab ? 1 : -1;
    const next = panels[i];
    next.classList.add('no-anim');
    next.style.setProperty('--off', `${dir * 28}px`);
    void next.offsetWidth;
    next.classList.remove('no-anim');
    panels[currentTab].style.setProperty('--off', `${-dir * 28}px`);
  }
  tabs.forEach((t, j) => {
    const on = i === j;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    panels[j].classList.toggle('is-active', on);
  });
  seg.dataset.active = String(i);
  currentTab = i;
  const track = $('[data-carousel]', panels[i]);
  if (track) track.scrollLeft = 0;
  if (focus) tabs[i].focus();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(i));
  t.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowLeft: -1, Home: -99, End: 99 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    const n = k === -99 ? 0 : k === 99 ? tabs.length - 1 : (i + k + tabs.length) % tabs.length;
    selectTab(n, true);
  });
});

$$('[data-carousel]').forEach((track) => {
  const dots = $$('span', track.parentElement.querySelector('.dots'));
  let raf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const cards = [...track.children];
      const x = track.scrollLeft;
      let best = 0;
      cards.forEach((c, i) => { if (Math.abs(c.offsetLeft - track.offsetLeft - x) < Math.abs(cards[best].offsetLeft - track.offsetLeft - x)) best = i; });
      if (x + track.clientWidth >= track.scrollWidth - 4) best = cards.length - 1;
      dots.forEach((d, i) => d.classList.toggle('is-on', i === best));
    });
  }, { passive: true });
});

// ------------------------------------------------------------------ más equipos: descripción al tocar
const cats = $('[data-cats]');
if (cats) {
  cats.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat__btn');
    if (!btn) return;
    const item = btn.parentElement;
    const open = !item.classList.contains('is-open');
    $$('.cat.is-open', cats).forEach((c) => {
      c.classList.remove('is-open');
      $('.cat__btn', c).setAttribute('aria-expanded', 'false');
    });
    item.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  });
}

// ------------------------------------------------------------------ conteo animado
const counters = $('[data-count-list]');
if (counters && hasIO && !reduced) {
  const nums = $$('[data-count]', counters);
  const run = () => {
    const t0 = performance.now();
    const dur = 1400;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const k = 1 - (1 - p) ** 4; // easeOutQuart: arranca rápido y se posa suave
      nums.forEach((el) => {
        const from = Number(el.dataset.from || 0);
        el.textContent = String(Math.round(from + (Number(el.dataset.count) - from) * k));
      });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    run();
  }, { threshold: .6 });
  if (belowFold(counters)) {
    nums.forEach((el) => { el.textContent = el.dataset.from || '0'; });
    io.observe(counters);
  }
}

// ------------------------------------------------------------------ comparador: filas una a una y checks que se dibujan
const cmp = $('[data-cmp]');
if (cmp && reveal && !reduced && belowFold(cmp)) {
  cmp.classList.add('is-armed');
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    cmp.classList.add('is-in');
  }, { threshold: .35 });
  io.observe(cmp);
}

// ------------------------------------------------------------------ catálogo: abanico al entrar e inclinación con el cursor
const book = $('[data-book]');
if (book) {
  if (hasIO && !reduced) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      book.classList.add('is-open');
    }, { threshold: .4 });
    io.observe(book);
  } else {
    book.classList.add('is-open');
  }
  if (fine && !reduced) {
    const zone = book.closest('section');
    const stack = $('.book__stack', book);
    let raf = 0;
    zone.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = zone.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        book.classList.add('is-tilting');
        stack.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
        stack.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
      });
    }, { passive: true });
    zone.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      book.classList.remove('is-tilting');
      stack.style.removeProperty('--rx');
      stack.style.removeProperty('--ry');
    });
  }
}

// ------------------------------------------------------------------ marquesina: en pausa fuera de pantalla
if (hasIO) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('is-paused', !e.isIntersecting));
  });
  $$('[data-marquee]').forEach((el) => io.observe(el));
}

// ------------------------------------------------------------------ acordeón (FLIP: solo transform y opacity)
const acc = $('[data-acc]');
if (acc) {
  const after = (item) => {
    // Todo lo que queda debajo del elemento se desplaza con transform
    const list = [];
    let n = item.nextElementSibling;
    while (n) { list.push(n); n = n.nextElementSibling; }
    let sec = acc.nextElementSibling;
    while (sec) { list.push(sec); sec = sec.nextElementSibling; }
    let s = acc.closest('section').nextElementSibling;
    while (s) { list.push(s); s = s.nextElementSibling; }
    const ft = $('.ft');
    if (ft) list.push(ft);
    return list;
  };
  const slide = (els, dy) => {
    if (reduced || !dy) return;
    els.forEach((el) => {
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      els.forEach((el) => {
        el.style.transition = 'transform .55s cubic-bezier(.22, 1, .36, 1)';
        el.style.transform = '';
      });
    }));
    setTimeout(() => els.forEach((el) => { el.style.transition = ''; }), 700);
  };
  acc.addEventListener('click', (e) => {
    const btn = e.target.closest('.acc__btn');
    if (!btn) return;
    const item = btn.closest('.acc__item');
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const open = btn.getAttribute('aria-expanded') !== 'true';
    const els = after(item);
    const before = item.getBoundingClientRect().height;
    btn.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    panel.classList.toggle('is-opening', open);
    slide(els, before - item.getBoundingClientRect().height);
  });
}

// ------------------------------------------------------------------ formulario (carga diferida)
let formMod = null;
const loadForm = () => {
  if (!formMod) formMod = import('./form.js').then((m) => { m.initForm(); return m; });
  return formMod;
};
const formSec = $('#asesoramiento');
if (hasIO) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    loadForm();
  }, { rootMargin: '900px 0px' });
  io.observe(formSec);
} else {
  loadForm();
}
['pointerdown', 'focusin'].forEach((ev) => formSec.addEventListener(ev, loadForm, { once: true }));

// Al llegar al formulario desde un CTA, el foco pasa a la pregunta actual
function afterScroll(fn) {
  let done = false;
  const go = () => { if (!done) { done = true; fn(); } };
  if ('onscrollend' in window) window.addEventListener('scrollend', go, { once: true });
  setTimeout(go, 900);
}
document.addEventListener('click', (e) => {
  const want = e.target.closest('[data-want]');
  const cta = e.target.closest('[data-cta], [data-want], a[href="#asesoramiento"]');
  if (!cta) return;
  const mod = loadForm();
  if (want) mod.then((m) => m.preselect(want.dataset.want, want.dataset.equipo));
  afterScroll(() => mod.then((m) => m.focusForm()));
});

// ------------------------------------------------------------------ barra fija en móvil
// Aparece al pasar el hero y se oculta en el catálogo (para no competir con "Descargar catálogo")
// y en el formulario. El icono de WhatsApp se oculta cuando se ve el enlace de Dudas.
const bar = $('[data-mbar]');
const faqWa = $('[data-faq-wa]');
const hero = $('#inicio');
const catalogSec = $('#catalogo');
const vis = { hero: true, form: false, catalog: false, faqWa: false };
function paintBar() {
  const on = !vis.hero && !vis.form && !vis.catalog;
  bar.classList.toggle('is-on', on);
  bar.inert = !on;
  bar.classList.toggle('no-wa', vis.faqWa);
}
if (hasIO) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.target === hero) vis.hero = e.isIntersecting;
      else if (e.target === formSec) vis.form = e.isIntersecting;
      else if (e.target === catalogSec) vis.catalog = e.isIntersecting;
      else if (e.target === faqWa) vis.faqWa = e.isIntersecting;
    });
    paintBar();
  }, { rootMargin: '0px 0px -12% 0px' });
  [hero, formSec, catalogSec, faqWa].forEach((el) => el && io.observe(el));
}

// ------------------------------------------------------------------ botones magnéticos (escritorio)
if (fine && !reduced) {
  $$('[data-magnetic]').forEach((btn) => {
    const zone = btn.parentElement;
    const reset = () => { btn.style.removeProperty('--mx'); btn.style.removeProperty('--my'); };
    zone.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) > 140) { reset(); return; }
      btn.style.setProperty('--mx', `${(dx * 0.12).toFixed(1)}px`);
      btn.style.setProperty('--my', `${(dy * 0.18).toFixed(1)}px`);
    }, { passive: true });
    zone.addEventListener('pointerleave', reset);
  });
}

// ------------------------------------------------------------------ eventos del píxel
const equipos = $('#equipos');
if (hasIO) {
  let sent = false;
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || sent) return;
    const active = panels.find((p) => p.classList.contains('is-active'));
    sent = viewContent(active ? active.dataset.cat : 'Equipos');
    if (sent) io.disconnect();
  }, { threshold: .35 });
  io.observe(equipos);
  // Si se aceptan las cookies con la sección ya en pantalla, se vuelve a comprobar
  window.addEventListener('vg:consent', () => { if (!sent) { io.unobserve(equipos); io.observe(equipos); } });
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-catalog]')) catalogDownload();
  const wa = e.target.closest('[data-wa]');
  if (wa) contact(wa.dataset.wa);
});

html.classList.add('js');
if (!desktop.matches) paintBar();
