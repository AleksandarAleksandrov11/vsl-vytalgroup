// VytalGroup · landing
// Cabecera, entradas al hacer scroll, control segmentado, carrusel, conteo, acordeón,
// barra fija en móvil, botón magnético, carga diferida del formulario y eventos del píxel.

import { captureAttribution } from './attribution.js';
import { initConsent } from './consent.js';
import { initTracking, viewContent, catalogDownload, contact } from './tracking.js';

const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 900px)');
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

captureAttribution();
initTracking();
initConsent();

// ------------------------------------------------------------------ cabecera
const header = $('[data-header]');
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
  ticking = false;
}
window.addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
onScroll();

// ------------------------------------------------------------------ entradas al hacer scroll
// Solo se ocultan los bloques que están por debajo de la primera pantalla: nada parpadea.
if (!reduced.matches && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  const groups = new Map();
  $$('[data-rv]').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const parent = el.closest('section') || document.body;
    const i = groups.get(parent) || 0;
    groups.set(parent, i + 1);
    el.style.setProperty('--rd', `${Math.min(i, 4) * 70}ms`);
    el.classList.add('rv');
    io.observe(el);
  });
}

// ------------------------------------------------------------------ control segmentado + carrusel
const seg = $('[data-seg]');
const tabs = $$('[role="tab"]', seg);
const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
function selectTab(i, focus = false) {
  tabs.forEach((t, j) => {
    const on = i === j;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    panels[j].classList.toggle('is-active', on);
  });
  seg.dataset.active = String(i);
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

// ------------------------------------------------------------------ conteo animado
const counters = $('[data-count-list]');
if (counters && 'IntersectionObserver' in window) {
  const nums = $$('[data-count]', counters);
  const run = () => {
    if (reduced.matches) return;
    const t0 = performance.now();
    const dur = 1100;
    nums.forEach((el) => { el.textContent = el.dataset.from || '0'; });
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - (1 - p) ** 3;
      nums.forEach((el) => {
        const from = Number(el.dataset.from || 0);
        const to = Number(el.dataset.count);
        el.textContent = String(Math.round(from + (to - from) * e));
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
  io.observe(counters);
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
    if (reduced.matches || !dy) return;
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
    const dy = before - item.getBoundingClientRect().height;
    slide(els, dy);
  });
}

// ------------------------------------------------------------------ formulario (carga diferida)
let formMod = null;
const loadForm = () => {
  if (!formMod) {
    formMod = import('./form.js').then((m) => { m.initForm(); return m; });
  }
  return formMod;
};
const formSec = $('#asesoramiento');
if ('IntersectionObserver' in window) {
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
  const cta = e.target.closest('[data-cta], [data-want]');
  if (!cta) return;
  const mod = loadForm();
  if (want) mod.then((m) => m.preselect(want.dataset.want, want.dataset.equipo));
  afterScroll(() => mod.then((m) => m.focusForm()));
});

// ------------------------------------------------------------------ barra fija en móvil
const bar = $('[data-mbar]');
const faqWa = $('[data-faq-wa]');
const hero = $('#inicio');
const vis = { hero: true, form: false, faqWa: false };
function paintBar() {
  const on = !vis.hero && !vis.form;
  bar.classList.toggle('is-on', on);
  bar.inert = !on;
  // Un solo enlace de WhatsApp visible a la vez
  bar.classList.toggle('no-wa', vis.faqWa);
}
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.target === hero) vis.hero = e.isIntersecting;
      else if (e.target === formSec) vis.form = e.isIntersecting;
      else if (e.target === faqWa) vis.faqWa = e.isIntersecting;
    });
    paintBar();
  }, { rootMargin: '0px 0px -12% 0px' });
  [hero, formSec, faqWa].forEach((el) => el && io.observe(el));
}

// ------------------------------------------------------------------ botón magnético (escritorio)
const mag = $('[data-magnetic]');
if (mag && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced.matches) {
  const zone = mag.parentElement;
  zone.addEventListener('pointermove', (e) => {
    const r = mag.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) > 140) { mag.style.removeProperty('--mx'); mag.style.removeProperty('--my'); return; }
    mag.style.setProperty('--mx', `${(dx * 0.14).toFixed(1)}px`);
    mag.style.setProperty('--my', `${(dy * 0.2).toFixed(1)}px`);
  });
  zone.addEventListener('pointerleave', () => { mag.style.removeProperty('--mx'); mag.style.removeProperty('--my'); });
}

// ------------------------------------------------------------------ eventos del píxel
const equipos = $('#equipos');
if ('IntersectionObserver' in window) {
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
