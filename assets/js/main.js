// VytalGroup · landing de venta. Punto de entrada.
import { captureAttribution } from './attribution.js';
import { initConsent } from './consent.js';
import { initTracking, viewContent, catalogDownload, contact } from './tracking.js';

const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const isIntro = html.classList.contains('intro');
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const raf = (fn) => requestAnimationFrame(fn);

captureAttribution();
initTracking();
initConsent({ delay: isIntro ? 1900 : 900 });

// ------------------------------------------------------------ animación de entrada
(function intro() {
  const ov = $('.intro-overlay');
  if (!isIntro) { ov?.remove(); return; }
  try { sessionStorage.setItem('vg_intro', '1'); } catch { /* sin almacenamiento */ }
  setTimeout(() => ov?.remove(), 1700);
})();

// ------------------------------------------------------------ cabecera y scrollspy
const header = $('#header');
(function headerBehaviour() {
  let lastY = scrollY;
  let ticking = false;
  const update = () => {
    const y = scrollY;
    const dy = y - lastY;
    header.classList.toggle('is-scrolled', y > 8);
    if (innerWidth < 1024 && !html.classList.contains('menu-open')) {
      if (dy > 10 && y > 480) header.classList.add('is-hidden');
      else if (dy < -4 || y < 240) header.classList.remove('is-hidden');
    } else {
      header.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; raf(update); } }, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  raf(update);

  const links = $$('.nav__link');
  const byId = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
      const l = byId.get(e.target.id);
      if (l) { l.classList.add('is-active'); l.setAttribute('aria-current', 'location'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach((s) => spy.observe(s));
})();

// ------------------------------------------------------------ menú móvil
(function mobileMenu() {
  const burger = $('.burger');
  const menu = $('#menu');
  if (!burger || !menu) return;
  const focusables = () => [burger, ...$$('a, button', menu)];
  const onKey = (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  };
  function open() {
    menu.hidden = false;
    raf(() => raf(() => menu.classList.add('is-open')));
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Cerrar menú');
    html.classList.add('menu-open');
    header.classList.remove('is-hidden');
    document.addEventListener('keydown', onKey);
    setTimeout(() => $('a', menu)?.focus({ preventScroll: true }), 80);
  }
  function close(focus = true) {
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menú');
    html.classList.remove('menu-open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 420);
    if (focus) burger.focus({ preventScroll: true });
  }
  burger.addEventListener('click', () => (menu.classList.contains('is-open') ? close() : open()));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(false); });
  addEventListener('resize', () => { if (innerWidth >= 1024 && menu.classList.contains('is-open')) close(false); });
})();

// ------------------------------------------------------------ reveals al hacer scroll
(function reveals() {
  $$('[data-stagger]').forEach((c) => {
    $$('[data-reveal]', c).forEach((el, i) => el.style.setProperty('--i', String(i % 8)));
  });
  const els = $$('[data-reveal]');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((el) => io.observe(el));
})();

// ------------------------------------------------------------ barra de confianza (carrusel en móvil)
(function trustMarquee() {
  const wrap = $('.trust');
  const list = $('.trust__list');
  if (!wrap || !list || reduced.matches) return;
  $$('.trust__item', list).forEach((it) => {
    const c = it.cloneNode(true);
    c.classList.add('trust__clone');
    c.setAttribute('aria-hidden', 'true');
    list.append(c);
  });
  wrap.classList.add('is-marquee');
})();

// ------------------------------------------------------------ carruseles con indicadores
(function carousels() {
  $$('[data-carousel]').forEach((car) => {
    const track = $('.carousel__track', car);
    const items = [...track.children];
    const dots = $('.carousel__dots', car);
    if (!dots || items.length < 2) return;
    dots.innerHTML = items.map((_, i) => `<button type="button" class="carousel__dot" aria-label="Ver ${i + 1} de ${items.length}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('');
    const btns = [...dots.children];
    btns.forEach((b, i) => b.addEventListener('click', () => {
      const pad = parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || 0;
      track.scrollTo({ left: items[i].offsetLeft - track.offsetLeft - pad, behavior: reduced.matches ? 'auto' : 'smooth' });
    }));
    let t = false;
    track.addEventListener('scroll', () => {
      if (t) return;
      t = true;
      raf(() => {
        t = false;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        const w = items[0].getBoundingClientRect().width + gap;
        const max = track.scrollWidth - track.clientWidth;
        const i = track.scrollLeft >= max - 4 ? items.length - 1 : Math.round(track.scrollLeft / w);
        btns.forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
      });
    }, { passive: true });
  });
})();

// ------------------------------------------------------------ paneles "Ver ficha"
(function fichas() {
  $$('[data-ficha]').forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const card = btn.closest('.pcard');
    if (!panel || !card) return;
    const interest = $('[data-interest]', card);
    if (interest) {
      const foot = document.createElement('div');
      foot.className = 'ficha__foot';
      const b = interest.cloneNode(true);
      b.classList.remove('btn--sm');
      b.classList.add('btn--block');
      foot.append(b);
      panel.append(foot);
    }
    const closeBtn = $('.ficha__close', panel);
    const open = () => {
      panel.hidden = false;
      raf(() => raf(() => panel.classList.add('is-open')));
      btn.setAttribute('aria-expanded', 'true');
      setTimeout(() => closeBtn.focus({ preventScroll: true }), 60);
    };
    const close = (focus = true) => {
      panel.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 520);
      if (focus) btn.focus({ preventScroll: true });
    };
    btn.addEventListener('click', () => (panel.classList.contains('is-open') ? close() : open()));
    closeBtn.addEventListener('click', () => close());
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    panel.addEventListener('click', (e) => { if (e.target.closest('[data-interest]')) close(false); });
  });
})();

// ------------------------------------------------------------ gama completa y filtros
(function ranges() {
  $$('[data-range]').forEach((r) => {
    const toggle = $('.range__toggle', r);
    const panel = $('.range__panel', r);
    const label = $('span', toggle);
    const items = $$('.ritem', r);
    const animateIn = (list) => list.forEach((it, i) => {
      it.classList.remove('is-filtered-in');
      it.style.setProperty('--i', String(i));
      void it.offsetWidth;
      it.classList.add('is-filtered-in');
    });
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
      label.textContent = open ? 'Ocultar la gama' : 'Ver toda la gama';
      if (open) animateIn(items.filter((it) => !it.hidden));
    });
    $$('[data-filter]', r).forEach((chip, _, chips) => chip.addEventListener('click', () => {
      chips.forEach((c) => { c.classList.toggle('is-active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
      const f = chip.dataset.filter;
      items.forEach((it) => { it.hidden = !(f === 'all' || it.dataset.type === f); });
      animateIn(items.filter((it) => !it.hidden));
    }));
  });
})();

// ------------------------------------------------------------ acordeón
$$('.acc__btn').forEach((b) => {
  const p = document.getElementById(b.getAttribute('aria-controls'));
  b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    p.classList.toggle('is-open', open);
  });
});

// ------------------------------------------------------------ línea temporal que se dibuja
(function timeline() {
  const t = $('[data-timeline]');
  if (!t) return;
  const rail = $('.timeline__rail', t);
  const steps = $$('.tstep', t);
  let horizontal = false;
  let railLen = 1;
  const measure = () => {
    horizontal = innerWidth >= 900;
    if (horizontal) { rail.style.height = ''; railLen = 1; return; }
    railLen = Math.max(1, steps[steps.length - 1].offsetTop - steps[0].offsetTop);
    rail.style.bottom = 'auto';
    rail.style.height = `${railLen}px`;
  };
  const update = () => {
    const vh = innerHeight;
    let p;
    if (horizontal) {
      const r = t.getBoundingClientRect();
      p = (vh * 0.85 - r.top) / (vh * 0.45);
    } else {
      const r = rail.getBoundingClientRect();
      p = (vh * 0.62 - r.top) / railLen;
    }
    p = Math.max(0, Math.min(1, p));
    t.style.setProperty('--p', p.toFixed(4));
    steps.forEach((s, i) => {
      const at = horizontal ? i / (steps.length - 1) : (s.offsetTop - steps[0].offsetTop) / railLen;
      s.classList.toggle('is-lit', p >= at - 0.002);
    });
  };
  let on = false;
  let measured = false;
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; raf(() => { ticking = false; update(); }); } };
  new IntersectionObserver(([e]) => {
    if (!measured) { measured = true; measure(); }
    if (e.isIntersecting && !on) { on = true; addEventListener('scroll', onScroll, { passive: true }); update(); }
    else if (!e.isIntersecting && on) { on = false; removeEventListener('scroll', onScroll); update(); }
  }, { rootMargin: '10% 0px' }).observe(t);
  addEventListener('resize', () => { if (measured) { measure(); update(); } });
})();

// ------------------------------------------------------------ barra CTA móvil y WhatsApp flotante
(function ctaBar() {
  const bar = $('#ctabar');
  const wa = $('.wa-float');
  const hero = $('#inicio');
  const formSec = $('#asesoramiento');
  if (!bar || !hero || !formSec) return;
  let pastHero = false;
  let formVisible = false;
  const apply = () => {
    const show = pastHero && !formVisible;
    bar.classList.toggle('is-visible', show);
    bar.setAttribute('aria-hidden', String(!show));
    $$('a', bar).forEach((a) => (show ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
    wa?.classList.toggle('is-visible', show);
  };
  new IntersectionObserver(([e]) => { pastHero = e.intersectionRatio < 0.2; apply(); }, { threshold: [0, 0.2, 0.4] }).observe(hero);
  new IntersectionObserver(([e]) => { formVisible = e.isIntersecting; apply(); }, { threshold: 0.08 }).observe(formSec);
})();

// ------------------------------------------------------------ vídeos diferidos
const slowNet = () => {
  const c = navigator.connection;
  return !!(c && (c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || '')));
};
function attachSources(v) {
  if (v.dataset.loaded) return;
  [['webm', 'video/webm'], ['mp4', 'video/mp4']].forEach(([k, type]) => {
    if (!v.dataset[k]) return;
    const s = document.createElement('source');
    s.src = v.dataset[k];
    s.type = type;
    v.append(s);
  });
  v.dataset.loaded = '1';
  v.load();
}
// El póster se asigna al acercarse: el atributo poster se descarga siempre, aunque preload="none"
const setPoster = (v) => { if (v && v.dataset.poster && !v.getAttribute('poster')) v.setAttribute('poster', v.dataset.poster); };
(function videos() {
  const loop = $('.demo__video');
  if (loop) {
    new IntersectionObserver(([e], io) => { if (e.isIntersecting) { setPoster(loop); io.disconnect(); } }, { rootMargin: '800px 0px' }).observe(loop);
  }
  if (loop && !slowNet() && !reduced.matches) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { attachSources(loop); loop.play().catch(() => {}); }
      else if (loop.dataset.loaded) loop.pause();
    }, { threshold: 0.25 }).observe(loop);
  }
  const dlg = $('#video-dialog');
  if (!dlg) return;
  const vid = $('video', dlg);
  const openDlg = () => {
    setPoster(vid);
    attachSources(vid);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    vid.play().catch(() => {});
  };
  const closeDlg = () => { if (dlg.open) dlg.close(); };
  $$('[data-video-open]').forEach((b) => b.addEventListener('click', openDlg));
  $('[data-video-close]', dlg).addEventListener('click', closeDlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDlg(); });
  dlg.addEventListener('close', () => vid.pause());
})();

// ------------------------------------------------------------ aviso breve
const toastEl = $('#toast');
let toastT = 0;
function toast(msg) {
  if (!toastEl || !msg) return;
  clearTimeout(toastT);
  toastEl.textContent = msg;
  raf(() => toastEl.classList.add('is-visible'));
  toastT = setTimeout(() => {
    toastEl.classList.remove('is-visible');
    setTimeout(() => { if (!toastEl.classList.contains('is-visible')) toastEl.textContent = ''; }, 400);
  }, 2600);
}

// ------------------------------------------------------------ formulario (carga diferida)
let formMod = null;
const loadForm = () => formMod || (formMod = import('./form.js').then((m) => { m.initForm(); return m; }));
(function formLoader() {
  const sec = $('#asesoramiento');
  if (!sec) return;
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { loadForm(); io.disconnect(); } }, { rootMargin: '900px 0px' }).observe(sec);
  const warm = () => loadForm();
  $$('[data-cta], [data-interest]').forEach((el) => {
    el.addEventListener('pointerenter', warm, { once: true, passive: true });
    el.addEventListener('touchstart', warm, { once: true, passive: true });
    el.addEventListener('focus', warm, { once: true });
  });
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
  addEventListener('load', () => setTimeout(() => idle(() => loadForm(), { timeout: 4000 }), 3500));
})();

// Desplazamiento suave con corrección final: las secciones fuera de pantalla usan una altura
// estimada (content-visibility) hasta pintarse, así que al terminar se comprueba el destino.
function scrollToEl(el, offset) {
  const behavior = reduced.matches ? 'auto' : 'smooth';
  const off = () => (offset ?? (parseFloat(getComputedStyle(html).scrollPaddingTop) || 72));
  const go = () => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - off(), behavior });
  let tries = 0;
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, cancel, { once: true, passive: true }));
  const check = () => {
    if (cancelled) return;
    if (Math.abs(el.getBoundingClientRect().top - off()) > 3 && tries++ < 3) { go(); later(); }
  };
  const later = () => { if ('onscrollend' in window) addEventListener('scrollend', check, { once: true }); else setTimeout(check, 800); };
  go();
  later();
}
function scrollToForm() {
  const mobile = innerWidth < 1024;
  const target = mobile ? $('#asesoramiento .fcard') : $('#asesoramiento');
  if (target) scrollToEl(target, mobile ? header.offsetHeight + 12 : 0);
}
function focusQuestion() {
  const q = $('#qform .qstep.is-active .qstep__q');
  if (q) q.focus({ preventScroll: true });
}

document.addEventListener('click', async (e) => {
  const interest = e.target.closest('[data-interest]');
  if (interest) {
    e.preventDefault();
    const m = await loadForm();
    const label = m.preselect(interest.dataset.product, interest.dataset.model);
    scrollToForm();
    if (label) toast(`Añadido: ${label}`);
    return;
  }
  const cta = e.target.closest('a[data-cta][href="#asesoramiento"]');
  if (cta && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    scrollToForm();
    loadForm().then(() => setTimeout(focusQuestion, reduced.matches ? 0 : 650));
    return;
  }
  const a = e.target.closest('a[href^="#"]:not(.skip)');
  const target = a && a.getAttribute('href').length > 1 ? document.querySelector(a.getAttribute('href')) : null;
  if (target && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    scrollToEl(target);
  }
});

// ------------------------------------------------------------ eventos de medición
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-catalog]')) catalogDownload();
  const wa = e.target.closest('[data-whatsapp]');
  if (wa) contact(wa.closest('section, footer, .ctabar, .menu')?.id || wa.className.split(' ')[0]);
});
(function viewContentObserver() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) viewContent(e.target.dataset.viewcontent); });
  }, { rootMargin: '-35% 0px -35% 0px', threshold: 0 }); // franja central: funciona con secciones más altas que la pantalla
  $$('[data-viewcontent]').forEach((s) => io.observe(s));
  // Si se acepta marketing con la sección ya en pantalla, se registra en ese momento
  addEventListener('vg:consent', () => {
    $$('[data-viewcontent]').forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.top < innerHeight * 0.8 && r.bottom > innerHeight * 0.2) viewContent(s.dataset.viewcontent);
    });
  });
})();
