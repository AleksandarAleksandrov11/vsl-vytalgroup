// Consentimiento de cookies: banner, panel de configuración y almacenamiento (12 meses).
// Emite el evento `vg:consent` con { necessary, analytics, marketing } cuando cambia.

const KEY = 'vg_consent';
const MAX_AGE = 365 * 24 * 60 * 60 * 1000;

export function getConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    if (!c || !c.date || Date.now() - Date.parse(c.date) > MAX_AGE) return null;
    return c;
  } catch {
    return null;
  }
}

function save(analytics, marketing) {
  const c = { v: 1, date: new Date().toISOString(), necessary: true, analytics: !!analytics, marketing: !!marketing };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* sin almacenamiento: vale para esta visita */ }
  current = c;
  window.dispatchEvent(new CustomEvent('vg:consent', { detail: c }));
  return c;
}

let current = null;
export const consentState = () => current || getConsent();

export function initConsent({ delay = 600 } = {}) {
  current = getConsent();
  const banner = document.getElementById('cookie-banner');
  const panel = document.getElementById('cookie-panel');
  if (!banner || !panel) return;
  const html = document.documentElement;
  const toggles = {
    analytics: panel.querySelector('[data-consent="analytics"]'),
    marketing: panel.querySelector('[data-consent="marketing"]'),
  };

  function showBanner() {
    banner.hidden = false;
    html.classList.add('has-cookie-banner');
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('is-visible')));
  }
  function hideBanner() {
    banner.classList.remove('is-visible');
    html.classList.remove('has-cookie-banner');
    setTimeout(() => { banner.hidden = true; }, 560);
  }
  function openPanel() {
    const c = consentState();
    toggles.analytics.checked = !!(c && c.analytics);
    toggles.marketing.checked = !!(c && c.marketing);
    if (typeof panel.showModal === 'function') panel.showModal();
    else panel.setAttribute('open', '');
    toggles.analytics.focus();
  }
  function closePanel() {
    if (panel.open) panel.close();
  }
  function decide(analytics, marketing) {
    save(analytics, marketing);
    closePanel();
    hideBanner();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cookie], [data-cookie-settings], [data-cpanel-close]');
    if (!b) return;
    if (b.hasAttribute('data-cookie-settings')) { openPanel(); return; }
    if (b.hasAttribute('data-cpanel-close')) { closePanel(); return; }
    switch (b.dataset.cookie) {
      case 'accept': decide(true, true); break;
      case 'reject': decide(false, false); break;
      case 'config': openPanel(); break;
      case 'save': decide(toggles.analytics.checked, toggles.marketing.checked); break;
    }
  });
  panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });

  if (!current) setTimeout(showBanner, delay);
}
