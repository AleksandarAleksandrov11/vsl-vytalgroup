// Tarjeta "Clientes" del hero: baraja de fotos y vídeo reales en formato historia.
// · Avanza sola: cada foto 5 s y el vídeo hasta el final. Tocar la izquierda vuelve, la derecha avanza.
// · Se pausa con el botón, fuera de pantalla y con la pestaña oculta (WCAG 2.2.2).
// · El vídeo se pide después del evento load y nunca con ahorro de datos o en 2G; mientras carga
//   se ve la foto de la misma sesión y, cuando empieza, aparece encima con un fundido.
// · Con prefers-reduced-motion empieza en pausa, sin vídeo ni zoom: solo se mueve si se pide.
// Solo se animan transform, opacity y variables CSS.

const PHOTO_MS = 5000;
const WAIT_VIDEO_MS = 3500; // tiempo máximo que la primera tarjeta espera a que arranque el vídeo
const OUT_MS = 420;

export function initReel(root, { reduced = false, tilt = false } = {}) {
  const cards = [...root.querySelectorAll('[data-slide]')];
  const bars = [...root.querySelectorAll('.reel__bars i')];
  const toggle = root.querySelector('[data-reel-toggle]');
  const video = root.querySelector('video');
  const n = cards.length;
  const conn = navigator.connection || {};
  const lowData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');

  let cur = 0;
  let elapsed = 0;
  let waited = 0;
  let last = 0;
  let raf = 0;
  let userPaused = reduced;
  let onScreen = true;
  let running = false;
  let vstate = video ? 'none' : 'failed'; // none | loading | ready | failed

  const videoActive = () => cur === 0 && vstate === 'ready' && !video.paused;

  function layout() {
    cards.forEach((c, i) => {
      const p = (i - cur + n) % n;
      c.style.setProperty('--p', p);
      c.classList.toggle('is-front', p === 0);
    });
  }

  function paintBars(t) {
    bars.forEach((b, i) => b.style.setProperty('--t', i < cur ? 1 : i > cur ? 0 : Math.min(1, t).toFixed(4)));
  }

  function playVideo() {
    if (vstate !== 'ready' || cur !== 0 || !running) return;
    video.play().catch((e) => {
      // AbortError = una pausa interrumpió la reproducción: no es un fallo
      if (e && e.name === 'AbortError') return;
      vstate = 'failed';
      cards[0].classList.remove('is-playing');
    });
  }

  function leaveVideo() {
    if (!video || vstate !== 'ready') return;
    video.pause();
    // La foto de la sesión vuelve a verse cuando la tarjeta ya está atrás
    setTimeout(() => {
      if (cur === 0) return;
      cards[0].classList.remove('is-playing');
      video.currentTime = 0;
    }, OUT_MS);
  }

  function go(dir) {
    const prev = cur;
    cur = (cur + dir + n) % n;
    elapsed = 0;
    waited = 0;
    if (prev === 0) leaveVideo();
    if (reduced) {
      layout();
    } else if (dir > 0) {
      // La delantera sale hacia la izquierda y reaparece al fondo con un fundido
      const out = cards[prev];
      out.classList.add('is-out');
      layout();
      out.style.setProperty('--p', 0);
      setTimeout(() => {
        out.classList.add('no-anim', 'is-hidden');
        out.classList.remove('is-out');
        out.style.setProperty('--p', (prev - cur + n) % n);
        void out.offsetWidth;
        out.classList.remove('no-anim');
        requestAnimationFrame(() => out.classList.remove('is-hidden'));
      }, OUT_MS);
    } else {
      // Hacia atrás: la del fondo entra desde la izquierda
      const inc = cards[cur];
      inc.classList.add('no-anim', 'is-out');
      void inc.offsetWidth;
      inc.classList.remove('no-anim', 'is-out');
      layout();
    }
    paintBars(0);
    if (cur === 0) {
      if (vstate === 'ready') video.currentTime = 0;
      playVideo();
    }
    schedule();
  }

  function tick(now) {
    raf = 0;
    if (!running) return;
    const dt = last ? Math.min(now - last, 100) : 0;
    last = now;
    let t;
    if (videoActive()) {
      t = video.duration ? video.currentTime / video.duration : 0;
    } else if (cur === 0 && vstate === 'loading' && waited < WAIT_VIDEO_MS) {
      waited += dt;
      t = 0;
    } else {
      elapsed += dt;
      t = elapsed / PHOTO_MS;
    }
    paintBars(t);
    // El vídeo avanza con su evento "ended"
    if (t >= 1 && !videoActive()) { go(1); return; }
    schedule();
  }

  function schedule() {
    if (running && !raf) raf = requestAnimationFrame(tick);
  }

  function update() {
    const should = !userPaused && onScreen && !document.hidden;
    root.classList.toggle('is-paused', !should);
    if (should === running) return;
    running = should;
    last = 0;
    if (running) {
      playVideo();
      schedule();
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
      if (video && !video.paused) video.pause();
    }
  }

  function loadVideo() {
    if (vstate !== 'none' || lowData) return;
    vstate = 'loading';
    const webm = video.canPlayType('video/webm; codecs="vp9"');
    video.addEventListener('canplay', () => { vstate = 'ready'; playVideo(); }, { once: true });
    video.addEventListener('error', () => { vstate = 'failed'; }, { once: true });
    video.addEventListener('playing', () => cards[0].classList.add('is-playing'));
    video.addEventListener('ended', () => { if (cur === 0) go(1); });
    video.src = webm ? video.dataset.webm : video.dataset.mp4;
    video.load();
  }

  function paintToggle() {
    toggle.setAttribute('aria-label', userPaused ? 'Reproducir' : 'Pausar');
    toggle.querySelector('use').setAttribute('href', userPaused ? '#i-play' : '#i-pause');
  }

  // ---------------------------------------------------------------- eventos
  root.querySelector('[data-reel-next]').addEventListener('click', () => go(1));
  root.querySelector('[data-reel-prev]').addEventListener('click', () => go(-1));
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    paintToggle();
    if (!userPaused) loadVideo();
    update();
  });
  document.addEventListener('visibilitychange', update);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; update(); }, { threshold: 0.2 }).observe(root);
  }

  // Inclinación suave con el cursor (escritorio)
  if (tilt) {
    const zone = root.parentElement;
    let r = 0;
    zone.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(r);
      r = requestAnimationFrame(() => {
        const b = zone.getBoundingClientRect();
        const x = (e.clientX - b.left) / b.width - 0.5;
        const y = (e.clientY - b.top) / b.height - 0.5;
        root.classList.add('is-tilting');
        root.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
        root.style.setProperty('--rx', `${(-y * 9).toFixed(2)}deg`);
      });
    }, { passive: true });
    zone.addEventListener('pointerleave', () => {
      cancelAnimationFrame(r);
      root.classList.remove('is-tilting');
      root.style.removeProperty('--rx');
      root.style.removeProperty('--ry');
    });
  }

  layout();
  paintBars(0);
  paintToggle();
  update();
  if (!reduced && video) {
    const later = () => ('requestIdleCallback' in window ? requestIdleCallback(loadVideo, { timeout: 2000 }) : setTimeout(loadVideo, 800));
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
  }
}
