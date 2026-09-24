# PLAN · Landing VytalGroup (Meta Ads)

Trabajo en solitario y secuencial, sin subagentes. Se marca cada tarea al completarla.

## 1. Análisis y material
- [x] Leer el brief completo
- [x] Revisar material recibido: catálogo ADC | VytalGroup 2026 (53 págs.), vídeo presoterapia VytalGroup, vídeo de demostración de la Diatermia Multifunción
- [x] Extraer el texto del catálogo con `pdftotext`
- [x] Descargar la web actual (vytalgroup.org) y extraer sus recursos base64 (imágenes, vídeo, PDF)
- [x] Revisar la landing de referencia que ha pasado el cliente (vdnperformance.com): ritmo, animaciones y tono
- [x] Anotar el material que NO ha llegado (carpeta `referencias/`, catálogo EDAN, fotos de Javier, cartel del sorteo)

## 2. Recursos gráficos
- [x] Logo VytalGroup vectorizado (SVG) en versión clara y oscura, más el símbolo "VG"
- [x] Favicon SVG + PNG, apple-touch-icon y manifest
- [x] Imágenes de producto recortadas y exportadas en AVIF + WebP en varios tamaños
- [x] Retrato y avatar de Javier (foto enviada por el cliente) con etalonaje de marca
- [x] Portada del catálogo para el mockup
- [x] Vídeo de demostración (Diatermia) optimizado en MP4 H.264 + WebM, con póster
- [x] Catálogo PDF comprimido por debajo de 5 MB (`catalogo-vytalgroup-2026.pdf`)
- [x] Fuentes Syne (700, 800) e Inter (400, 500, 600) autoalojadas en woff2 con subset latino
- [x] Imagen Open Graph de 1200 × 630

## 3. Maquetación (HTML + CSS)
- [x] Tokens de diseño, tipografía fluida y utilidades
- [x] Animación inicial de entrada ("escaneo" de ultrasonido) profesional y dinámica, sin penalizar LCP
- [x] Header sticky + menú móvil a pantalla completa + scrollspy
- [x] Hero + barra de confianza
- [x] De fisio a fisio (historia de Javier)
- [x] Ecógrafos: 4 destacados, "Ver ficha", "Me interesa", gama completa con filtros, Physio Invasiva 2.0
- [x] Diatermias: 4 modelos, comparativa y vídeo de demostración
- [x] También te equipamos con
- [x] Cómo trabajamos (línea temporal que se dibuja con el scroll)
- [x] Garantías
- [x] Catálogo (mockup y descarga)
- [x] Preguntas frecuentes (acordeón)
- [x] Formulario "una pregunta cada vez"
- [x] Footer, botón flotante de WhatsApp (escritorio) y barra CTA móvil
- [x] Banner y panel de cookies
- [x] Páginas legales: aviso legal, privacidad y cookies

## 4. JavaScript (vanilla, módulos)
- [x] main.js: header, menú, scrollspy, reveals, carruseles, fichas, filtros, acordeón, timeline, CTA móvil, vídeo diferido
- [x] intro.js (dentro de main): coreografía de entrada
- [x] attribution.js: UTM, fbclid, fbc y fbp en sessionStorage
- [x] consent.js: banner, preferencias y almacenamiento 12 meses
- [x] tracking.js: Meta Pixel condicionado al consentimiento y eventos
- [x] dropdown.js: combobox/listbox accesible con hoja inferior en móvil
- [x] form.js: pasos, validaciones, prefijos, sugerencia de email, provincias, envío, pantalla de gracias
- [x] config.js con `SHEETS_ENDPOINT` y `META_PIXEL_ID` vacíos

## 5. Integraciones y despliegue
- [x] `integrations/google-sheets.gs` (doPost, cabeceras, LockService, Europe/Madrid, aviso por email opcional)
- [x] Build: minificación, hashes, CSS crítico inline (`npm run build` → `dist/`)
- [x] `_headers` (Netlify), `netlify.toml`, `vercel.json`, `robots.txt`, `sitemap.xml`
- [x] SEO: title, description, OG, Twitter Card, JSON-LD Organization + FAQPage

## 6. Revisión final (sección 18)
- [x] Capturas de página completa en 12 anchos y revisión una a una
- [x] Comprobación automática de desbordamiento horizontal
- [x] Componentes: dropdowns, prefijos, acordeón, fichas, carruseles, filtros, "Me interesa"
- [x] Formulario: recorrido, validaciones, endpoint vacío, endpoint simulado con UTM, doble clic, honeypot y tiempo mínimo
- [x] Tracking: sin consentimiento no se carga nada; PageView, ViewContent, Lead (una vez, con eventID), DescargaCatalogo y Contact
- [x] Contenido: sin rayas (U+2014 y U+2013), sin veterinaria, sin datos inventados, sin relleno
- [x] Lighthouse móvil ≥ 95 en las 4 categorías, CLS 0, LCP < 2 s
- [x] Validación HTML (W3C), consola limpia, teclado y `prefers-reduced-motion`
- [x] Repaso estético final como cliente

## 7. Entrega
- [x] README completo (estructura, local, Google Sheets paso a paso, píxel, despliegue, pendientes, decisiones)
- [x] Commit y push a `claude/vytalgroup-landing-meta-1y05py`

## Notas finales
- Añadido a petición del cliente: animación de entrada profesional ("escaneo de ultrasonido") y referencia visual de vdnperformance.com.
- Corrección del cliente: la persona del vídeo no es Javier. Se usa la foto de Javier que envió (historia, hero y formulario) y el vídeo pasa a ser una demostración del producto, sin atribuírselo.
- Resultado: Lighthouse móvil 96 a 100 en rendimiento y 100 en accesibilidad, buenas prácticas y SEO; escritorio 100 en todo; LCP 1,7 a 1,8 s; CLS 0; INP medido 96 ms.
- Pruebas automáticas: `npm test` (formulario y tracking 212/212, componentes 47/47, diseño 14/14 tamaños).
