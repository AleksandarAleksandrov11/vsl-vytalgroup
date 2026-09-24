# VytalGroup · Landing de venta (Meta Ads)

Landing de una sola página para las campañas de Instagram y Facebook de VytalGroup: equipos médicos de alta calidad para profesionales sanitarios, sin letra pequeña. Ecógrafos y diatermias como protagonistas y el resto del catálogo a un clic. Una acción principal: pedir asesoramiento.

- HTML, CSS y JavaScript vanilla. Sin frameworks ni librerías en el navegador.
- 6 secciones y un footer (apartado 1).
- Carga inicial en móvil: unos 87 KB (presupuesto 250 KB). JS propio: 13,6 KB. CSS: unos 10 KB (gzip).
- Lighthouse: móvil 99 a 100 en rendimiento y 100 en accesibilidad, buenas prácticas y SEO; escritorio y páginas legales, 100 en todo.

---

## 1. Cómo es la página

Hablamos como empresa, en primera persona del plural ("Lo que nos preguntáis", "Cuéntanos qué necesitas", "Escríbenos por WhatsApp"). La única excepción es la historia de Javier en "Por qué VytalGroup", que va firmada por él.

**Sistema de alineación, igual en todos los dispositivos:** titulares de sección y botones de sección siempre centrados. El hero va en dos columnas en escritorio (texto a la izquierda, equipo a la derecha) y centrado en móvil y tableta. La cabecera es fija y siempre visible.

1. **Hero** (fondo marino). "Equipos médicos de alta calidad. *Sin letra pequeña.*", la línea "Ecógrafos, diatermias y todo lo que tu clínica necesita. Te asesoran fisioterapeutas, no comerciales.", el botón "Quiero asesoramiento" y "Ver catálogo" (lleva a Más equipos). A la derecha (debajo en móvil), la **diatermia flotando** con un halo turquesa y **ondas tipo ecografía** que salen de ella en bucle; en escritorio el equipo sigue un poco al cursor. Debajo, la **línea de confianza** en bucle infinito: 2 años de garantía · CE / MDR certificados · UE, USA y LATAM envíos · Fisioterapeutas te asesoran · 0 sorpresas en mantenimiento · 53 páginas de catálogo.
2. **Lo más pedido.** Segmentado Ecógrafos / Diatermias y 3 tarjetas con "Lo quiero". En móvil y tableta se ve una tarjeta cada vez, centrada, con puntos. CTA de sección.
3. **Más equipos** ("Todo lo que tu clínica necesita."). 6 categorías del catálogo con descripción al pasar o tocar, "Y más de 50 páginas de equipos en el catálogo." y dos botones: "Quiero asesoramiento" y **"Descargar catálogo"** (oscuro, con icono, para que destaque).
4. **Por qué VytalGroup** ("Sin timos. *Sin letra pequeña.*"). Historia de Javier en dos líneas, su foto, las cifras (2 años de garantía · 0 sorpresas en mantenimiento · Fisioterapeutas te asesoran, no comerciales), el comparador "Lo habitual" frente a "Con VytalGroup", la firma y el CTA, centrados.
5. **Dudas** ("Lo que *nos preguntáis.*"). 5 preguntas, el CTA y "¿Otra duda? Escríbenos por WhatsApp".
6. **Formulario** ("Cuéntanos qué *necesitas.*"). Solo lo imprescindible, en 2 pasos:
   1. ¿Qué equipo buscas? Ecógrafo · Diatermia · Presoterapia · Ondas de choque · Otro equipo (desplegable con magnetoterapia, láser, electrólisis percutánea, camillas u otro).
   2. ¿Dónde te escribimos? Nombre, WhatsApp (con prefijo) y consentimiento.

   Desde "Lo quiero" se salta el paso 1: se llega directo al paso 2 con "Te interesa: Acclarix AX8 · Cambiar".

**Footer** con teléfono, email, Instagram (`instagram.com/fisioruiz_`), "Catálogo (PDF)" y enlaces legales (centrado en móvil). La barra fija del móvil aparece al pasar el hero y se oculta con el formulario en pantalla.

---

## 2. Cambios de esta ronda (v5)

- **Hero nuevo, sin fotos ni vídeos de clientes:** escaparate oscuro con la diatermia flotando y ondas tipo ecografía (opción B de las tres maquetas). El texto y los botones van centrados en móvil. Imagen OG rehecha con el mismo estilo.
- **Fuera:**
  - la tarjeta "Clientes" (fotos y vídeo de clientes);
  - la sección de testimonios de ejemplo;
  - la sección propia del catálogo, con su maqueta 3D.

  El catálogo se descarga desde el botón de Más equipos, el footer y la pantalla de gracias.
- **Cabecera fija** siempre visible en todos los dispositivos.
- **Línea de confianza infinita:** 4 copias de la lista, así nunca se queda vacía en pantallas anchas.
- **Por qué VytalGroup:**
  - la historia va en dos líneas;
  - "de garantía" y "te asesoran" van pegados a su cifra;
  - "Fisioterapeutas te asesoran, no comerciales" en lugar de "1 fisio";
  - la firma se ve entera (el `viewBox` recortaba la parte de arriba);
  - sin la línea sobre la firma y el botón.
- **Primera persona del plural** en toda la web: FAQ, formulario, WhatsApp, cookies y JSON-LD. Fuera "Te respondo yo personalmente." y la foto de Javier del formulario.
- **Formulario de 2 pasos** (antes 6). Fuera perfil, plazo y email. El desplegable se abre hacia arriba si abajo no cabe, se ve entero y resalta la opción al pasar el ratón (Enter elige la misma).
- **Rendimiento:** los saltos largos dentro de la página (p. ej. de "Lo quiero" al formulario) van directos en vez de con scroll suave, que en un móvil modesto tardaba y retrasaba las pulsaciones (INP de 850 ms a unos 120 ms).
- **Instagram:** `https://www.instagram.com/fisioruiz_/`.

---

## 3. Cómo ejecutarlo en local

```
/
├── index.html                  Landing
├── aviso-legal.html            Páginas legales (se generan con scripts/assets/gen_legal.py)
├── privacidad.html
├── cookies.html
├── config.js                   ← SHEETS_ENDPOINT y META_PIXEL_ID (vacíos)
├── site.config.mjs             ← SITE_URL: la URL pública de la web
├── vercel.json                 Cabeceras, CSP, caché y URLs limpias
├── assets/
│   ├── css/                    base.css (compartido), landing.css, legal.css (inline al compilar)
│   ├── js/                     main.js, form.js, select.js (desplegable propio), data.js,
│   │                           attribution.js, consent.js, tracking.js, legal.js
│   ├── img/                    Productos, categorías, diatermia del hero y Javier (AVIF + WebP)
│   ├── fonts/                  Geist e Instrument Serif cursiva (woff2, subset latino)
│   ├── brand/                  Favicon, iconos e imagen Open Graph
│   └── docs/catalogo-vytalgroup-2026.pdf
├── integrations/google-sheets.gs   Apps Script que recibe los leads
├── scripts/                    build.mjs, serve.mjs y generadores de recursos (assets/)
├── tests/                      Pruebas con Playwright (npm test)
├── PLAN.md
└── README.md
```

`robots.txt` y `sitemap.xml` los genera la compilación a partir de `SITE_URL`.


Requisitos: Node.js 18 o superior.

```bash
npm install          # herramientas de compilación y pruebas (solo desarrollo)
npm run build        # genera la versión de producción en dist/
npm run preview      # sirve dist/ en http://localhost:8080 con las cabeceras de vercel.json
npm run dev          # sirve el código fuente sin compilar
npm test             # pruebas automáticas contra dist/ (compila antes con npm run build)
```

La compilación muestra un informe de pesos y **falla si se supera algún presupuesto** (carga inicial 250 KB, JS 30 KB, CSS 25 KB) o si queda alguna ruta sin hash o sin `SITE_URL`.

---

## 4. Google Sheets: guardar los leads (paso a paso)

El formulario envía cada solicitud a una hoja de Google mediante un pequeño programa (Apps Script). Se configura una sola vez:

1. **Crea la hoja.** Entra en [sheets.google.com](https://sheets.google.com) con la cuenta que quieras usar (por ejemplo vytalkinetech@gmail.com) y crea una hoja en blanco, por ejemplo "Leads web VytalGroup". No hace falta crear columnas: el programa crea la pestaña "Leads" con sus cabeceras.
2. **Pega el código.** En la hoja, abre **Extensiones > Apps Script**. Borra lo que haya en `Código.gs`, pega todo el contenido de `integrations/google-sheets.gs` y guarda.
3. **Despliégalo como aplicación web.** Pulsa **Implementar > Nueva implementación**. En "Seleccionar tipo" (engranaje) elige **Aplicación web**:
   - Descripción: "Leads web".
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.

   Pulsa **Implementar**.
4. **Autoriza los permisos.** Pulsa **Autorizar acceso** y elige tu cuenta. Si aparece "Google no ha verificado esta aplicación", pulsa **Configuración avanzada > Ir a (nombre del proyecto)** y **Permitir**. Es normal: el programa es tuyo.
5. **Conecta la URL.** Copia la **URL de la aplicación web** (termina en `/exec`) y pégala en `config.js`:
   ```js
   window.VG_CONFIG = {
     SHEETS_ENDPOINT: "https://script.google.com/macros/s/XXXXXXXX/exec",
     META_PIXEL_ID: ""
   };
   ```
   Vuelve a desplegar la web (apartado 6).
6. **Prueba.** Envía el formulario con datos de prueba. En segundos aparece una fila en "Leads" con la fecha y hora de Madrid, los datos, el origen de la campaña y la columna **Estado** en "Nuevo" para que la gestiones tú. Si abres la URL `/exec` en el navegador y ves `{"ok":true,...}`, el despliegue responde.
7. **Si cambias el script**, vuelve a desplegarlo desde **Implementar > Gestionar implementaciones**: lápiz de la implementación activa, **Versión: Nueva versión** e **Implementar**. Así la URL no cambia.

**Opcional: aviso por email con cada lead.** En el script cambia `SEND_EMAIL_NOTIFICATION` a `true` (destinatario: `NOTIFY_EMAIL`), guarda y vuelve a desplegar.

Columnas, en este orden: Fecha · Nombre · Teléfono · Email · Equipo · Modelo · Perfil · Plazo · Consentimiento · utm_source · utm_medium · utm_campaign · utm_content · utm_term · fbclid · fbc · fbp · Referrer · URL de entrada · Dispositivo · Idioma · event_id · Estado.

Detalles:
- Envío con `fetch` y `Content-Type: text/plain;charset=utf-8` (sin petición previa de CORS).
- UTM y `fbclid` se guardan en `sessionStorage` en la primera visita. `fbc` se construye desde `fbclid` si no existe la cookie `_fbc`.
- El script valida los campos obligatorios, usa `LockService`, ignora envíos repetidos con el mismo `event_id`, descarta el campo trampa y escapa los textos que empiezan por `=`, `+`, `-` o `@`.
- **Equipo:** Ecógrafo, Diatermia, Presoterapia u Ondas de choque. Si se marca "Otro equipo", llega la categoría elegida en el desplegable (Magnetoterapia de alta intensidad, Láser de alta potencia, Electrólisis percutánea ecoguiada o Camillas de fisioterapia) u "Otro equipo" si se elige "Otro".
- **Modelo:** el elegido en "Lo quiero"; "Sin decidir" si se eligió ecógrafo o diatermia sin modelo; vacío en el resto de equipos.
- **Email, Perfil y Plazo:** el formulario ya no los pregunta (solo lo imprescindible: equipo, nombre y WhatsApp), así que llegan vacíos. Las columnas se mantienen por si se vuelven a pedir. El script solo exige nombre, teléfono, equipo, consentimiento y `event_id`.
- **Dispositivo:** móvil, tablet o escritorio, sistema y si llega desde el navegador interno de Instagram o Facebook.
- Con `SHEETS_ENDPOINT` vacío el formulario falla con elegancia: mensaje amable, reintento, WhatsApp como alternativa, sin perder los datos, y un aviso claro en la consola.

---

## 5. Meta Pixel

1. En el **Administrador de eventos** de Meta, copia el identificador numérico del píxel.
2. Pégalo en `config.js` → `META_PIXEL_ID: "123456789012345"` y vuelve a desplegar.

- El script de Meta **no se descarga** hasta que el visitante acepta "Marketing" en el aviso de cookies. Si acepta más tarde, se carga en ese momento. Si lo retira desde "Configurar cookies", deja de enviar eventos y se borran `_fbp` y `_fbc`.
- Con `META_PIXEL_ID` vacío no se carga nada.

| Evento | Cuándo |
|---|---|
| `PageView` | Al inicializar el píxel. |
| `ViewContent` | Una vez por sesión, al ver la sección de equipos, con la categoría activa (`Ecógrafos` o `Diatermias`). |
| `Lead` | Solo tras un envío correcto a la hoja, una única vez, con `eventID` igual al `event_id` guardado en la hoja (listo para la API de Conversiones sin duplicar). |
| `DescargaCatalogo` | Evento personalizado (`trackCustom`) al descargar el catálogo (botón de Más equipos, footer o pantalla de gracias). **No es un lead.** |
| `Contact` | Al pulsar cualquier enlace de WhatsApp. |

Todo el tracking está en `assets/js/tracking.js`.

---

## 6. Despliegue en Vercel

El proyecto está listo para `vercel --prod`:

```bash
npm i -g vercel
vercel            # la primera vez: enlaza el proyecto
vercel --prod
```

O conecta el repositorio en vercel.com: cada push despliega solo. `vercel.json` ya define:
- **Compilación:** `npm run build` y carpeta de salida `dist/`.
- **URLs limpias:** `/privacidad`, `/cookies` y `/aviso-legal`. Las rutas `.html`, con barra final o `/index` redirigen (308).
- **Seguridad:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Permissions-Policy` y la **CSP** del brief. No hay ningún script inline: todo el JS está en archivos.
- **Caché:** todo `/assets` lleva hash en el nombre y se cachea un año (`immutable`), salvo el PDF (`/assets/docs`, sin hash, 7 días y descarga como adjunto). HTML, `config.js`, `robots.txt`, `sitemap.xml` y el manifest se revalidan siempre (`max-age=0, must-revalidate`), así los cambios en `config.js` se ven al momento.

Ajustes respecto al `vercel.json` del brief:
- La regla de caché de un año usa `/assets/((?!docs/).*)` para no pisar la del PDF.
- Se añade `/((?!assets/).*)` con `must-revalidate`: con URLs limpias, `/privacidad` no termina en `.html` y no la cubriría la regla de los HTML.
- Si se añade cualquier recurso de otro dominio (un vídeo, una fuente…), hay que añadirlo a la CSP.

**Comprobarlo en local:** `npm run build && npm run preview` sirve `dist/` con las mismas cabeceras y redirecciones de `vercel.json`. La única diferencia es que en local se quita `upgrade-insecure-requests`, porque no hay https en `localhost`.

---

## 7. Dominio definitivo (vytalgroup.org) y `SITE_URL`

1. En Vercel: **Project > Settings > Domains > Add** y escribe `vytalgroup.org`. Añade también `www.vytalgroup.org` y marca que redirija al dominio principal.
2. En el proveedor del dominio, crea los registros DNS que indica Vercel (normalmente un registro `A` para `vytalgroup.org` y un `CNAME` para `www`). Vercel emite el certificado HTTPS solo.
3. Cambia la URL en `site.config.mjs`:
   ```js
   export const SITE_URL = 'https://vytalgroup.org';
   ```
   y vuelve a desplegar. Con eso cambian el canonical, `og:url`, `og:image`, el JSON-LD, `sitemap.xml` y `robots.txt`.
4. Comprueba la vista previa del enlace en el [depurador de Meta](https://developers.facebook.com/tools/debug/) y pulsa "Volver a extraer".

Mientras tanto, `SITE_URL` es `https://vsl-vytalgroup.vercel.app`, así que la vista previa al compartir el enlace ya funciona.

---

## 8. Pendientes del cliente

1. **ID del Meta Pixel** → `config.js` (apartado 5).
2. **URL del Apps Script** → `config.js` (apartado 4).
3. **Datos legales del titular** en `aviso-legal.html` y `privacidad.html` (marcados en amarillo como "[Pendiente: …]"): razón social o nombre, NIF o CIF, domicilio y datos registrales, y el plazo de conservación de los leads. Se editan en `scripts/assets/gen_legal.py` y se regeneran con `python3 scripts/assets/gen_legal.py`. Conviene que un asesor legal revise los textos.
4. **¿Podemos prometer "respuesta en menos de 24 h"?** Si se confirma, se puede añadir bajo "Cuéntanos qué necesitas.".
5. **Testimonios reales** (opcional): si más adelante hay opiniones de clientes con su permiso, se puede recuperar una sección de testimonios.
6. **Material que no llegó:** fotos de los Acclarix a más resolución (el catálogo trae unos 550 px) y una foto de Javier más grande (la recibida es de 640 × 640).

---

## 9. Decisiones tomadas

**Texto.** Unas 217 palabras visibles en las secciones, más 23 en la línea de confianza y 23 en cabecera y footer, medidas por código. Voz de empresa ("nosotros"); la historia firmada es de Javier.

**Diseño.**
- Geist + Instrument Serif. Marino `#0B1929` en el hero, en "Por qué VytalGroup" y en el footer. Turquesa `#48A0A8`, el del logo, en botones y detalles.
- El botón de descarga del catálogo es marino con el icono en turquesa: destaca junto al CTA sin competir con él.
- El titular del hero se ajusta al ancho de su columna para salir siempre en 3 líneas.

**Animaciones.** Solo `transform`, `opacity` y variables CSS.
- Hero:
  - titular por palabras;
  - entrada del escaparate;
  - flotación del equipo y halo que respira;
  - ondas en bucle;
  - en escritorio, el equipo sigue un poco al cursor.
- Titulares de sección por líneas.
- Imágenes con fundido y escala.
- Parallax leve y halo en tarjetas (escritorio).
- Segmentado con transición cruzada.
- Comparador con checks que se dibujan.
- Conteo de cifras.
- Barra de progreso de lectura.
- Botones con brillo y efecto magnético.
- `prefers-reduced-motion`: sin flotación, ondas, parallax, marquesina ni conteos; quedan los fundidos y las ondas como anillos quietos.

**Formulario.** Solo equipo, nombre y WhatsApp, porque cuantas menos preguntas, más leads. El WhatsApp de la pantalla de gracias lleva el nombre y el equipo o modelo.

---

## 10. Historial

- **v5 (esta ronda):** ver apartado 2.
- **v4:** hero con fotos y vídeo de clientes y sin testimonios. Sustituido en la v5.
- **v3:**
  - enfoque "equipos médicos sin letra pequeña";
  - Más equipos;
  - comparador;
  - línea de confianza;
  - sección de catálogo (quitada en la v5);
  - testimonios de ejemplo (quitados en la v4).
- **v2:** rediseño completo (Geist + Instrument Serif, segmentado, formulario por pasos, Vercel, CSP).

---

## 11. Pruebas y resultados

`npm test` compila y ejecuta sobre `dist/`, con las cabeceras de `vercel.json` y un Apps Script simulado:

- **Formulario y tracking (81 comprobaciones):**
  - nada de Facebook sin consentimiento;
  - aviso de cookies;
  - eventos: PageView, ViewContent, DescargaCatalogo (desde Más equipos) y Contact;
  - "Lo quiero" salta al paso 2 con el modelo;
  - solo equipo, nombre, WhatsApp y consentimiento;
  - "Cambiar";
  - validaciones;
  - prefijos: buscador, Enter y Escape, opción resaltada con el ratón, hoja inferior en móvil;
  - "Otro equipo": desplegable que se abre hacia arriba cerca del borde y se ve entero, con teclado y ratón;
  - envío con UTM y todas las columnas;
  - doble clic sin duplicar;
  - Lead único con `eventID` = `event_id`;
  - endpoint vacío, error del servidor y antispam.
- **Interfaz (81):**
  - 6 secciones;
  - palabras;
  - CTA por sección (con "Descargar catálogo" junto al de Más equipos);
  - alineación centrada de titulares y CTA en móvil y escritorio;
  - cabecera fija siempre visible;
  - barra de progreso;
  - línea de confianza infinita;
  - hero (diatermia precargada, fondo oscuro, logo blanco, ondas, flotación, sigue al cursor, sin fotos ni vídeos de clientes);
  - segmentado;
  - carrusel de una tarjeta centrada;
  - Más equipos, comparador, acordeón y conteo;
  - movimiento reducido;
  - CSP, caché, PDF, URLs limpias, metadatos y OG.
- **Diseño (17 tamaños):** capturas de página completa de 320 a 1920 px, horizontal y páginas legales, con comprobación por código de desbordes, textos partidos, solapes y áreas táctiles. Revisadas una a una.
- `node tests/inp.cjs`: interacción más lenta 112 a 144 ms con la CPU ×4 (INP < 200 ms).

| | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| Móvil, landing (3 pasadas) | 99 · 100 · 99 | 100 | 100 | 100 |
| Escritorio, landing | 100 | 100 | 100 | 100 |
| Móvil, páginas legales | 100 | 100 | 100 | 100 |

Móvil: LCP 1,7 a 1,8 s (la diatermia del hero), CLS 0. Escritorio: LCP 0,4 s. HTML válido (W3C). Sin rayas ni emojis, comprobado por código.

---

## 12. Regenerar recursos

```bash
bash scripts/assets/subset_fonts.sh                 # fuentes (requiere fonttools y brotli)
python3 scripts/assets/build_images.py <pdfimages> <fotos> assets/img
                                                    # imágenes (pdfimages -all -p del catálogo, foto de Javier;
                                                    # las páginas de la maqueta se renderizan del PDF con pdftoppm)
node scripts/assets/build_og.mjs                    # imagen Open Graph (Playwright)
python3 scripts/assets/gen_legal.py                 # páginas legales (toman el pie y las cookies de index.html)
```

Catálogo PDF comprimido con Ghostscript:

```bash
gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dColorImageResolution=200 -dGrayImageResolution=200 -dJPEGQ=82 -dDetectDuplicateImages=true -o catalogo-vytalgroup-2026.pdf original.pdf
```
