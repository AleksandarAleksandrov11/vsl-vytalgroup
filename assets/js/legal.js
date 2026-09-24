// Páginas legales: consentimiento de cookies, píxel (si se acepta), atribución y nombre animado del pie.
import { captureAttribution } from './attribution.js';
import { initConsent } from './consent.js';
import { initTracking, catalogDownload, contact } from './tracking.js';
import { initFooter } from './footer.js';

captureAttribution();
initTracking();
initConsent({ delay: 400 });
initFooter();

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-catalog]')) catalogDownload();
  const wa = e.target.closest('[data-wa]');
  if (wa) contact(wa.dataset.wa);
});
