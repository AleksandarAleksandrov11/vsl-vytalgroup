// Páginas legales: consentimiento de cookies, píxel (si se acepta) y atribución.
import { captureAttribution } from './attribution.js';
import { initConsent } from './consent.js';
import { initTracking, contact } from './tracking.js';

captureAttribution();
initTracking();
initConsent({ delay: 400 });

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-whatsapp]')) contact('legal');
});
