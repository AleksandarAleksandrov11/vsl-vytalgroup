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

## 5. v4: hero con material real de clientes (sustituido en la v5)
- [x] Tarjeta "Clientes" con fotos y vídeo, y fuera la sección de testimonios. El cliente no quedó convencido y en la v5 se sustituye por el escaparate.

## 6. v5: ajustes del cliente
- [x] Hero sin material de clientes: 3 maquetas (foto de fondo, escaparate oscuro, carrusel 3D). Elegida la B, escaparate oscuro con ondas.
- [x] Hero centrado en móvil; cabecera fija siempre visible; línea de confianza infinita.
- [x] Por qué VytalGroup: historia en dos líneas, etiquetas pegadas a las cifras, "Fisioterapeutas te asesoran", firma entera, sin la línea sobre la firma.
- [x] Más equipos: botón "Descargar catálogo" destacado junto al CTA; fuera la sección de catálogo.
- [x] Voz de empresa (nosotros) en toda la web; fuera "Te respondo yo personalmente." y la foto del formulario.
- [x] Lo más pedido en móvil y tableta: una tarjeta centrada cada vez.
- [x] Alineación: titulares y CTA de sección centrados en todos los dispositivos; footer centrado en móvil.
- [x] Formulario de 2 pasos (equipo; nombre + WhatsApp). Desplegable hacia abajo o hacia arriba, entero y con hover.
- [x] Instagram: fisioruiz_.
- [x] Pruebas: formulario 81/81, interfaz 81/81, diseño 17/17. INP ≤ 144 ms. Lighthouse móvil 99-100 y escritorio 100. HTML válido.

## 7. v6: hero con foto de fondo y Por qué VytalGroup como antes
- [x] Hero: 3 maquetas nuevas con foto de fondo difuminada. Elegida la 1, "Oscuro, solo foto": foto de clínica del catálogo difuminada en el archivo, velo marino, sin animación de fondo.
- [x] Por qué VytalGroup en escritorio: historia y cifras a la derecha de la foto, alineadas a la izquierda. Móvil sin cambios (centrado).
- [x] Sin líneas separadoras en las cifras ni en el comparador.
- [x] Pruebas: formulario 81/81, interfaz 89/89, diseño 17/17. INP 120 ms. Lighthouse 100 en todo (móvil ×3 y escritorio). HTML válido.

## 8. v7: garantías aparte, formulario de 4 preguntas y móvil sin cortes
- [x] Garantías en sección propia bajo el hero, más grande, textos mayores e icono en cada una (bucle infinito).
- [x] Comparador como tabla minimalista centrada con fondo.
- [x] Dudas: fuera "¿Solo vendéis...?"; nuevas "¿Qué garantía tienen?" y "¿Qué pasa cuando envío el formulario?".
- [x] Formulario de 4 preguntas: qué te interesa, perfil, nombre y WhatsApp. Apps Script con Perfil y enlace de WhatsApp.
- [x] "Fisioterapeutas te asesoran" sin "no comerciales".
- [x] Flechas en el carrusel de móvil y tableta.
- [x] Cabecera y barra móvil cortadas: causa (desbordes horizontales) corregida y probada sin overflow: clip y con texto al 130 %.
- [x] Solo WebP.
- [x] Revisión por pantallas en 360, 390, 768, 1024, 1440 y horizontal.
- [x] Pruebas: Apps Script 13/13, formulario 88/88, interfaz 102/102, diseño 17/17. INP 112 ms. Lighthouse móvil 99-100, escritorio y legales 100. HTML válido.

## 9. v8: sin flechas ni cifras, correo como alternativa y pie nuevo
- [x] Fuera las flechas del carrusel de Lo más pedido.
- [x] Fuera las cifras bajo la foto de Javier: de la foto directo a la tabla.
- [x] "Prefiero por correo" bajo el WhatsApp: misma pregunta para el correo, formato validado y aviso de dominio mal escrito. Apps Script con "Contactar por" y "Email".
- [x] Footer con logo grande, columnas con título pequeño e iconos, y "VytalGroup" a todo el ancho con animación al final. También en las legales.
- [x] Pruebas: Apps Script 17/17, formulario 102/102, interfaz 108/108, diseño 17/17. INP 128 ms. Lighthouse 100 en todo. HTML válido.

