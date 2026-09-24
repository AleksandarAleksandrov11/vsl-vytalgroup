# PLAN · Rediseño completo de la landing VytalGroup

Trabajo en solitario y secuencial, sin subagentes. Se marca cada tarea al completarla.
Regla de oro: menos. Ante la duda, se quita.

## 1. Análisis
- [x] Leer el brief del rediseño entero
- [x] Decidir qué se reaprovecha: google-sheets.gs, consentimiento, tracking, atribución, envío del formulario, contenido legal, imágenes de producto, foto de Javier y PDF del catálogo
- [x] Comprobar en las fuentes el término exacto del mantenimiento: "asegurado" (brief y web actual)
- [x] Vídeo de la diatermia: quien sale no es Javier (lo confirmó el cliente), así que no se usa y se borra
- [x] Anotar lo que falta (carpeta `referencias/`, confirmación de "menos de 24 h")

## 2. Recursos
- [x] Geist variable (400 a 600) e Instrument Serif cursiva, autoalojadas en woff2 con subset latino
- [x] Recortes de producto homogéneos (mismo tamaño visual y misma sombra): Eco Wireless, Acclarix AX8, Acclarix LX9, Diatermia Multifunción, Reatherm y HR Tek
- [x] Imagen del hero (producto protagonista, versión móvil y escritorio)
- [x] Retrato de Javier para la sección marina, con etalonaje suave
- [x] Nueva imagen Open Graph 1200 × 630 con el nuevo diseño
- [x] Borrar fuentes, imágenes, vídeos y scripts que dejan de usarse

## 3. Maquetación (HTML + CSS desde cero)
- [x] Tokens: paleta clara, marino solo en 4.3 y footer, tipografía fluida, radios, sombras
- [x] Header: logo + "Quiero asesoramiento"; transparente, desenfoque al bajar; en móvil se oculta al bajar
- [x] Hero: titular corto, línea de apoyo, un botón, línea de confianza, producto con barrido de ecografía
- [x] Equipos: control segmentado Ecógrafos | Diatermias, 3 tarjetas por categoría, carrusel en móvil, enlace al catálogo
- [x] Por qué VytalGroup: foto de Javier, frase, 3 razones con conteo, firma y botón
- [x] Dudas: 5 preguntas en acordeón y un enlace de WhatsApp
- [x] Formulario de 6 pasos, pantalla de éxito y de error
- [x] Footer mínimo
- [x] Barra fija móvil (CTA + WhatsApp pequeño)
- [x] Banner de cookies mínimo y panel con interruptores propios
- [x] Páginas legales con el nuevo diseño

## 4. JavaScript (vanilla, sin librerías)
- [x] main.js: header, reveals, segmentado, carrusel, conteo, acordeón, barra móvil, botón magnético, CTA con preselección
- [x] form.js: 6 pasos, Enter, avance automático, validación, prefijos con buscador, honeypot, 3 s, doble envío
- [x] Reaprovechar attribution.js, consent.js y tracking.js (ViewContent con la categoría activa)
- [x] config.js con `SHEETS_ENDPOINT` y `META_PIXEL_ID` vacíos

## 5. Integraciones, build y despliegue
- [x] `integrations/google-sheets.gs` con las nuevas columnas
- [x] `SITE_URL` en un único sitio; canonical, OG, JSON-LD, sitemap y robots salen de ahí
- [x] Build: hash en todo /assets (menos el PDF), CSS crítico inline, sin scripts inline (CSP)
- [x] `vercel.json` con cabeceras, CSP, caché y URLs limpias; quitar Netlify
- [x] Servidor local que aplica las cabeceras de `vercel.json`

## 6. Revisión final (sección 13)
- [x] Minimalismo: 5 secciones, < 180 palabras (por código), un texto de CTA, sin badges, un botón por tarjeta
- [x] Capturas de página completa en 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440 y 1920, revisadas una a una
- [x] Botón del hero visible en 375 × 667; sin desbordes ni solapes (por código)
- [x] Segmentado, carrusel, acordeón y desplegable con táctil y teclado
- [x] Formulario: 6 pasos, preselección, validaciones, endpoint vacío, endpoint simulado con UTM, doble clic
- [x] Tracking: nada de Facebook sin consentimiento, Lead único con eventID, ViewContent, DescargaCatalogo y Contact
- [x] Vercel: JSON válido, cero errores de CSP, caché, PDF, URLs limpias, canonical y OG
- [x] Contenido: sin rayas, sin veterinaria, sin datos inventados, ortografía
- [x] Lighthouse móvil ≥ 95 en las cuatro categorías, CLS 0, LCP < 2 s, INP < 200 ms
- [x] HTML válido, consola limpia, teclado, `prefers-reduced-motion`, sin archivos muertos
- [x] Repaso final como fisio que llega desde un anuncio

## 7. Entrega
- [x] README (estructura, Google Sheets, píxel, dominio y `SITE_URL`, pendientes, decisiones)
- [x] Commit y push a `claude/vytalgroup-landing-meta-1y05py`
- [x] Resumen con Lighthouse y lista de lo eliminado

## Notas finales
- Resultado: Lighthouse 100 en las cuatro categorías (móvil y escritorio, landing y legales); LCP móvil 1,7 a 1,8 s; CLS 0; interacción más lenta 104 ms.
- Pruebas: `npm test` (formulario y tracking 77/77, interfaz y reglas del brief 57/57, diseño 17/17 tamaños).
- 177 palabras visibles, 5 secciones, un texto de CTA ("Lo quiero" en tarjetas, como pide el brief).
- El vídeo de la diatermia no es de Javier: no se usa y se ha borrado. Se usa su foto.

