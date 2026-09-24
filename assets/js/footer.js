// Pie: el nombre de la empresa en grande. Si el pie está fuera de pantalla al cargar, las letras
// se preparan abajo y suben una a una al llegar al final (solo transform y opacity).
export function initFooter() {
  const word = document.querySelector('[data-word]');
  if (!word || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (word.getBoundingClientRect().top < window.innerHeight) return;
  word.classList.add('is-armed');
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    word.classList.add('is-in');
  }, { threshold: .35 });
  io.observe(word);
}
