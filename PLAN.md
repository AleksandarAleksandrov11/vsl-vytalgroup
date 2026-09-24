# PLAN · Brief v3: ajustes sobre el rediseño

Trabajo en solitario y secuencial, sin subagentes ni workflows. Se marca cada tarea al completarla.
Se mantiene el sistema visual del rediseño (Geist + Instrument Serif, paleta, espaciados, componentes y tono).

## 0. Estado de partida (capturas en 375, 768 y 1440 px)
- 5 secciones: Hero ("Ecógrafos y diatermias, sin letra pequeña."), Equipos (segmentado + 3 tarjetas), Por qué VytalGroup (marino), Dudas (5) y Formulario (6 pasos).
- El mensaje habla solo de ecógrafos y diatermias. No se ven presoterapia, ondas de choque, magnetoterapia, láser, electrólisis ni camillas.
- El catálogo es solo un enlace de texto bajo las tarjetas y en el footer.
- Fondos: claro en todo salvo "Por qué VytalGroup" y el footer (marino).
- 177 palabras visibles. Lighthouse 100 en todo.

## 1. Cambios pedidos
### Enfoque y metadatos
- [x] Mensaje general: equipos médicos de alta calidad, sin timos ni letra pequeña (hero, title, description, OG, JSON-LD)
- [x] Nueva imagen OG con "Equipos médicos de alta calidad. Sin letra pequeña."

### Estructura
- [x] Hero: titular general, línea de apoyo nueva, CTA y enlace "Ver catálogo"
- [x] Línea de confianza en movimiento bajo el hero, tipo cifras (petición del cliente)
- [x] Lo más pedido: segmentado actual + CTA de sección (el apoyo "¿No sabes cuál elegir?" se quitó para quedar en ~250 palabras)
- [x] NUEVA · Más equipos: 6 categorías con imagen y nombre, descripción al pasar o tocar, CTA
- [x] Por qué VytalGroup: "Sin timos. Sin letra pequeña.", comparador de 3 filas con checks que se dibujan, CTA
- [x] NUEVA · Testimonios: 8 de ejemplo en bucle infinito hacia la izquierda, marcados como ejemplo (petición del cliente)
- [x] NUEVA · Catálogo: maqueta 3D que se abre en abanico, inclinación con el cursor, "Descargar catálogo" y "¿Prefieres que te asesore?"
- [x] Dudas: 5 preguntas (nueva "¿Solo vendéis ecógrafos y diatermias?"; fuera "¿Qué garantía tienen?", repetida), CTA y WhatsApp
- [x] Formulario: paso 1 ampliado y desplegable propio para "Otro equipo"; WhatsApp de éxito y Apps Script al día
- [x] Footer revisado; barra móvil oculta también en el catálogo
- [x] Fondos y texturas distintos por sección (petición del cliente)

### Animaciones
- [x] Titulares de sección por líneas con máscara (60 a 80 ms)
- [x] Imágenes de producto: fundido, escala 0,96 → 1 y parallax leve (solo escritorio)
- [x] Rejilla de Más equipos: entrada escalonada, zoom 1,04 y descripción
- [x] Comparador: filas una a una y checks con stroke-dashoffset
- [x] Conteo de números revisado
- [x] Catálogo: abanico e inclinación
- [x] Barra de progreso de lectura de 2 px bajo la cabecera
- [x] Botones: brillo, hundimiento y magnetismo en escritorio
- [x] Halo de luz que sigue al cursor en las tarjetas (escritorio)
- [x] Cambio de categoría con transición cruzada y desplazamiento corto
- [x] `prefers-reduced-motion`: sin parallax, inclinación, marquesinas ni conteos; solo fundidos

### Recursos
- [x] Imágenes de las 6 categorías con el mismo tratamiento que los destacados (recortes, lienzo 4:3, sombra)
- [x] Portada y dos páginas interiores del catálogo para la maqueta

## 2. Revisión final (sección 8)
- [x] Capturas de página completa en 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440 y 1920, revisadas una a una
- [x] Estructura: secciones, un CTA por sección, texto de asesoramiento idéntico, palabras contadas por código
- [x] Contenido: sin rayas, sin veterinaria, sin datos inventados (testimonios marcados como ejemplo), ortografía
- [x] Animaciones fluidas, CLS 0 y movimiento reducido
- [x] Responsive: botón del hero en 375 × 667, sin desbordes, barra móvil
- [x] Formulario y tracking: paso 1 ampliado, preselección, UTM, Lead único, DescargaCatalogo, nada de Facebook sin consentimiento
- [x] Calidad: Lighthouse móvil ≥ 95, consola y CSP limpias, HTML válido, teclado, sin archivos muertos

## 3. Entrega
- [x] README actualizado (cambios y pendientes)
- [x] Commit y push a `claude/vytalgroup-landing-meta-1y05py`
- [x] Resumen con Lighthouse

## 4. Resultado de la revisión final
- 8 secciones (las 7 del brief + testimonios) y footer. Un CTA por sección: "Quiero asesoramiento" en todas y "Descargar catálogo" en el catálogo.
- Palabras visibles, por código: 244 en secciones, 24 en la línea de confianza y 23 en cabecera y footer.
- Capturas de las 11 anchuras (y horizontal) revisadas una a una. Ajustes que salieron de la revisión:
  - titular del hero siempre en 3 líneas;
  - "+" de Más equipos en la esquina de la imagen;
  - descripción a tarjeta completa en móvil;
  - 3 columnas desde 640 px;
  - comparador con la columna de VytalGroup más ancha en 320 px;
  - "Sin letra pequeña." en su propia línea.
- Pruebas: formulario 89/89, interfaz 80/80, diseño 17/17. INP 112 ms. HTML válido (vnu). Sin rayas, veterinaria, ISO/FDA ni emojis.
- Lighthouse:
  - móvil: 99, 99 y 100 en rendimiento, y 100 en accesibilidad, buenas prácticas y SEO;
  - escritorio y páginas legales: 100 en todo.

## 5. v4: hero con material real de clientes (sin testimonios)
- [x] Descargar y revisar el material: 7 fotos (una repetida) y un vídeo de 14 s. Se descartan las capturas de WhatsApp e Instagram por los datos personales que muestran.
- [x] Quitar la sección de testimonios: HTML, CSS, pruebas, aviso de compilación y README.
- [x] Hero limpio: sin recorte, rejilla de puntos ni barrido. Tarjeta "Clientes" en formato historia con el vídeo y 2 fotos.
- [x] Vídeo: bucle sin saltos, 4:5, WebM + MP4 sin audio, pedido después de `load`, nunca con ahorro de datos. Foto de la misma sesión como LCP.
- [x] Pausa (WCAG 2.2.2), pausa fuera de pantalla, anterior y siguiente, y movimiento reducido.
- [x] Pruebas nuevas (UI 90/90, formulario 89/89, diseño 17/17) y capturas revisadas en todos los anchos, horizontal incluido.
- [x] Lighthouse 100 en todo (móvil y escritorio), HTML válido, INP 120 ms.
- [ ] Pendiente del cliente: permiso de imagen de las personas que aparecen.
