# VytalGroup · Landing de venta (Meta Ads)

Landing de una sola página para las campañas de Instagram y Facebook de VytalGroup. Una única acción: completar el formulario de asesoramiento. Ecógrafos y diatermias, "de fisio a fisio".

- HTML, CSS y JavaScript vanilla. Sin frameworks ni librerías en el navegador.
- 5 secciones y un footer: Hero, Equipos, Por qué VytalGroup, Dudas y Formulario.
- Carga inicial en móvil: unos 82 KB (presupuesto 250 KB). JS propio: 12,7 KB. CSS: 7,6 KB (gzip).
- Lighthouse móvil y escritorio: 100 en rendimiento, accesibilidad, buenas prácticas y SEO.

---

## 1. Estructura del proyecto

```
/
├── index.html                  Landing
├── aviso-legal.html            Páginas legales (se generan con scripts/assets/gen_legal.py)
├── privacidad.html
├── cookies.html
├── config.js                   ← SHEETS_ENDPOINT y META_PIXEL_ID (vacíos)
├── site.config.mjs             ← SITE_URL: la URL pública de la web (un único sitio)
├── vercel.json                 Despliegue en Vercel: cabeceras, CSP, caché y URLs limpias
├── site.webmanifest
├── assets/
│   ├── css/                    base.css (compartido), landing.css, legal.css. Se insertan inline al compilar
│   ├── js/                     main.js, form.js, prefix.js, data.js, attribution.js, consent.js,
│   │                           tracking.js, legal.js
│   ├── img/                    Productos, hero y Javier en AVIF + WebP (varios anchos)
│   ├── fonts/                  Geist (variable, 400 a 600) e Instrument Serif cursiva, woff2 con subset latino
│   ├── brand/                  Favicon, iconos e imagen Open Graph
│   └── docs/catalogo-vytalgroup-2026.pdf
├── integrations/google-sheets.gs   Apps Script que recibe los leads en Google Sheets
├── scripts/
│   ├── build.mjs               Compilación a dist/ (hashes, CSS inline, minificado, SITE_URL, sitemap)
│   ├── serve.mjs               Servidor local que aplica las cabeceras de vercel.json
│   └── assets/                 Generadores: imágenes, fuentes, imagen OG y páginas legales
├── tests/                      Pruebas automáticas con Playwright (npm test)
├── PLAN.md                     Lista de tareas seguida durante el trabajo
└── README.md
```

`robots.txt` y `sitemap.xml` no están en la raíz: los genera la compilación a partir de `SITE_URL`. En los HTML fuente las URLs absolutas se escriben como `https://site-url.invalid` y la compilación las sustituye por `SITE_URL`.

---

## 2. Cómo ejecutarlo en local

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

## 3. Google Sheets: guardar los leads (paso a paso)

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
   Vuelve a desplegar la web (apartado 5).
6. **Prueba.** Envía el formulario con datos de prueba. En segundos aparece una fila en "Leads" con la fecha y hora de Madrid, los datos, el origen de la campaña y la columna **Estado** en "Nuevo" para que la gestiones tú. Si abres la URL `/exec` en el navegador y ves `{"ok":true,...}`, el despliegue responde.
7. **Si cambias el script**, vuelve a desplegarlo desde **Implementar > Gestionar implementaciones**: lápiz de la implementación activa, **Versión: Nueva versión** e **Implementar**. Así la URL no cambia.

**Opcional: aviso por email con cada lead.** En el script cambia `SEND_EMAIL_NOTIFICATION` a `true` (destinatario: `NOTIFY_EMAIL`), guarda y vuelve a desplegar.

Columnas, en este orden: Fecha · Nombre · Teléfono · Email · Equipo · Modelo · Perfil · Plazo · Consentimiento · utm_source · utm_medium · utm_campaign · utm_content · utm_term · fbclid · fbc · fbp · Referrer · URL de entrada · Dispositivo · Idioma · event_id · Estado.

Detalles:
- Envío con `fetch` y `Content-Type: text/plain;charset=utf-8` (sin petición previa de CORS).
- UTM y `fbclid` se guardan en `sessionStorage` en la primera visita. `fbc` se construye desde `fbclid` si no existe la cookie `_fbc`.
- El script valida los campos obligatorios, usa `LockService`, ignora envíos repetidos con el mismo `event_id`, descarta el campo trampa y escapa los textos que empiezan por `=`, `+`, `-` o `@`.
- **Modelo:** el elegido en "Lo quiero"; "Sin decidir" si se eligió solo el tipo de equipo; vacío en "Otro equipo".
- **Dispositivo:** móvil, tablet o escritorio, sistema y si llega desde el navegador interno de Instagram o Facebook.
- Con `SHEETS_ENDPOINT` vacío el formulario falla con elegancia: mensaje amable, reintento, WhatsApp como alternativa, sin perder los datos, y un aviso claro en la consola.

---

## 4. Meta Pixel

1. En el **Administrador de eventos** de Meta, copia el identificador numérico del píxel.
2. Pégalo en `config.js` → `META_PIXEL_ID: "123456789012345"` y vuelve a desplegar.

- El script de Meta **no se descarga** hasta que el visitante acepta "Marketing" en el aviso de cookies. Si acepta más tarde, se carga en ese momento. Si lo retira desde "Configurar cookies", deja de enviar eventos y se borran `_fbp` y `_fbc`.
- Con `META_PIXEL_ID` vacío no se carga nada.

| Evento | Cuándo |
|---|---|
| `PageView` | Al inicializar el píxel. |
| `ViewContent` | Una vez por sesión, al ver la sección de equipos, con la categoría activa (`Ecógrafos` o `Diatermias`). |
| `Lead` | Solo tras un envío correcto a la hoja, una única vez, con `eventID` igual al `event_id` guardado en la hoja (listo para la API de Conversiones sin duplicar). |
| `DescargaCatalogo` | Evento personalizado (`trackCustom`) al descargar el catálogo. **No es un lead.** |
| `Contact` | Al pulsar cualquier enlace de WhatsApp. |

Todo el tracking está en `assets/js/tracking.js`.

---

## 5. Despliegue en Vercel

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

## 6. Dominio definitivo (vytalgroup.org) y `SITE_URL`

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

## 7. Pendientes del cliente

1. **ID del Meta Pixel** → `config.js` (apartado 4).
2. **URL del Apps Script** → `config.js` (apartado 3).
3. **Datos legales del titular** en `aviso-legal.html` y `privacidad.html` (marcados en amarillo como "[Pendiente: …]"): razón social o nombre, NIF o CIF, domicilio y datos registrales, y el plazo de conservación de los leads. Se editan en `scripts/assets/gen_legal.py` y se regeneran con `python3 scripts/assets/gen_legal.py`. Conviene que un asesor legal revise los textos.
4. **¿Puede Javier prometer "respuesta en menos de 24 h"?** Si lo confirma, se cambia el subtítulo del formulario ("Te respondo yo personalmente.") por "Te respondo yo, en menos de 24 h.".
5. **Vídeo de Javier.** El vídeo de la diatermia (1:47) que había en el proyecto no es de Javier (lo confirmó el cliente), así que no se usa. Si Javier graba uno, se puede poner en "Por qué VytalGroup" con portada y carga solo al pulsar.
6. **Material que no llegó:** la carpeta `referencias/` no venía en el encargo. Mejorarían la web unas fotos de los Acclarix a más resolución (el catálogo trae unos 550 px) y una foto de Javier más grande (la recibida es de 640 × 640).
7. **Confirmar el usuario de Instagram** de la marca: se enlaza `instagram.com/vytalgroup`.

---

## 8. Decisiones tomadas

**Estructura.** Las preguntas del visitante, en orden: ¿qué es? (Hero), ¿qué tenéis? (Equipos), ¿por qué vosotros? (Por qué VytalGroup), ¿y si…? (Dudas) y ¿cómo lo pido? (Formulario).

**Textos**
- Titular: "Ecógrafos y diatermias, *sin letra pequeña*." Dice qué se vende y la promesa. "Un fisio" ya aparece en la línea de apoyo y en "De fisio a fisio".
- Línea de confianza: "Mantenimiento **asegurado**", el término que usan el brief y la web actual (no "incluido").
- Un único texto de CTA, "Quiero asesoramiento", en cabecera, hero, "Por qué VytalGroup" y barra móvil. La única excepción es "Lo quiero" en las tarjetas, porque el brief lo pide así: lleva al formulario con ese modelo ya elegido.
- 177 palabras visibles (sin contar respuestas ni formulario), medidas por código en las pruebas. Para bajar de 180 se quitó la marca visible de las tarjetas (sigue en el `alt` y en el modelo que llega a la hoja) y se acortaron la historia y dos razones a 5 palabras, como pide el brief.
- Historia: "Me quemé en jornadas de 12 horas. Monté VytalGroup para que no te engañen."
- Datos de tarjeta: solo los del brief, 2 por equipo. "Hasta 60 min" y "hasta 8 electrodos" se muestran como "60 min · Batería máx." y "8 · Electrodos máx." para que quepan en una línea.

**Diseño**
- Base clara (`#FAFBFC`, tarjetas blancas) y marino `#0B1929` solo en "Por qué VytalGroup" (con grano finísimo) y en el footer.
- Turquesa `#48A0A8`, el tono exacto del logo, solo en botones, indicador del segmentado, barra de progreso y detalles mínimos. Los botones llevan texto marino (contraste 5,8:1).
- Geist variable (pesos 400 a 600, tracking negativo en titulares) e Instrument Serif cursiva solo en una o dos palabras de algunos titulares. Se precargan las dos porque las dos forman el titular del hero. Respaldos con métricas ajustadas para que el cambio de fuente no mueva nada (CLS 0).

**Imágenes**
- Los 6 equipos tienen el mismo tratamiento: recorte, mismo lienzo blanco 4:3, mismo tamaño visual y misma sombra de contacto. Eco Wireless y Diatermia Multifunción solo existían en foto con fondo: se recortaron con GrabCut (`scripts/assets/build_images.py`).
- Hero: la Diatermia Multifunción VytaMeD (marca propia y la foto con más resolución), recortada con transparencia, con un barrido de ecografía en abanico con arcos de profundidad que recorre el equipo como una sonda.
- Javier: su foto, recortada por encima del logo de otra clínica que lleva el polo, con etalonaje suave.

**Animaciones** (solo CSS y JS vanilla, easing `cubic-bezier(.22, 1, .36, 1)`, desactivadas con `prefers-reduced-motion`)
- Hero: titular por palabras con máscara, entrada escalonada de texto y botón, producto con fundido y escala leve, y barrido de ecografía en bucle lento. Es la animación de entrada de la página, sin pantalla previa que retrase el contenido.
- Entradas suaves al hacer scroll (solo para lo que está por debajo de la primera pantalla), indicador deslizante del segmentado, conteo animado de "2 años · 0 sorpresas · 1 fisio", brillo al pasar por los botones y hundimiento al pulsar, efecto magnético leve en el CTA del hero (escritorio).
- El acordeón anima solo con `transform` (técnica FLIP): lo que queda debajo se desliza hasta su nueva posición.

**Formulario (6 pasos)**
- Equipo → perfil → plazo → nombre → WhatsApp → email y consentimiento.
- Desde "Lo quiero", el paso 1 se muestra como confirmación ("Te interesa: Acclarix AX8 · Cambiar").
- Avance automático al tocar una opción. Con teclado, las flechas eligen y Enter avanza, para no saltar de paso sin querer.
- Prefijo con buscador (+34 por defecto), validación por país y formato por grupos. En móvil se abre como hoja inferior sin abrir el teclado. Sugerencia de dominio de email ("gmial.com" → "gmail.com").
- Con el teclado del móvil abierto, la página se desplaza para que el campo y su botón queden a la vista.

**Barra móvil y WhatsApp**
- Aparece al pasar el hero y se oculta con el formulario en pantalla o con el aviso de cookies abierto. Respeta el área segura de iOS.
- Un solo enlace de WhatsApp visible a la vez: el icono de la barra se oculta cuando se ve el enlace de "Dudas".

**Cookies:** solo hay una categoría opcional, "Marketing" (píxel de Meta). La web no usa analítica, así que no se ofrece un interruptor que no haría nada.

---

## 9. Qué se ha eliminado respecto a la versión anterior

- Menú de navegación.
- Gama completa de 10 ecógrafos, filtros, "Ver ficha" y fichas técnicas.
- Tabla comparativa de diatermias.
- Bloque de Physio Invasiva.
- "También te equipamos con" (5 productos) y "Cómo trabajamos" (4 pasos).
- Sección independiente de catálogo (queda un enlace de texto bajo los equipos y en el footer).
- Badges, etiquetas de tarjeta, chips de confianza y contadores decorativos.
- Botón flotante de WhatsApp y los CTA con textos distintos ("Me interesa", "Habla con Javier", "No sé cuál elegir", "Te ayudo a elegir", "Empezar ahora"…).
- Preguntas frecuentes 6 a 8.
- Formulario de 9 pasos (ahora 6): se quitan la ubicación y la elección múltiple de modelos.
- Animación de entrada a pantalla completa.
- Vídeos (el de la diatermia no es de Javier) y sus pósteres.
- Tipografías Syne e Inter, CSS, HTML y componentes anteriores.
- Configuración de Netlify (`_headers`, `netlify.toml`): el despliegue es en Vercel.

---

## 10. Pruebas y resultados

`npm test` se ejecuta sobre `dist/` (compila antes con `npm run build`): levanta la web con las cabeceras de `vercel.json` y un Apps Script simulado, y ejecuta:

- **Formulario y tracking (77 comprobaciones):** nada de Facebook antes de aceptar (red interceptada), aviso de cookies con tres botones iguales, PageView, ViewContent con la categoría activa, DescargaCatalogo, Contact, preselección desde "Lo quiero", los 6 pasos con teclado, ratón y táctil, validaciones, prefijos y buscador, sugerencia de email, casilla RGPD, envío con `?utm_source=facebook&utm_campaign=test&fbclid=abc123` y todas las columnas, doble clic sin duplicar, Lead una sola vez con el `eventID` correcto, endpoint vacío, error del servidor, campo trampa y envío en menos de 3 s.
- **Interfaz y reglas del brief (57):** 5 secciones y footer, menos de 180 palabras, un único texto de CTA, sin badges, un botón por tarjeta, nada de lo eliminado, botón del hero visible en 375 × 667, cabecera, segmentado y carrusel con teclado y táctil, acordeón, conteo, barra móvil, un solo WhatsApp visible, Geist e Instrument Serif cargadas (ni rastro de Syne o Inter), movimiento reducido, cero errores de CSP con el píxel cargado, cabeceras de seguridad y caché, PDF, URLs limpias, canonical, OG (1200 × 630), JSON-LD, sitemap y robots.
- **Diseño (17 tamaños):** capturas de página completa en 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440 y 1920, móvil en horizontal y páginas legales, con comprobación por código de scroll horizontal, desbordes, textos partidos o cortados, solapes con la cabecera y áreas táctiles de 44 px. Las capturas quedan en `tests/output/`.
- `node tests/inp.cjs`: latencia de las interacciones con la CPU ralentizada ×4.

Resultados de la entrega:

| | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| Móvil, landing | 100 | 100 | 100 | 100 |
| Escritorio, landing | 100 | 100 | 100 | 100 |
| Móvil, páginas legales | 100 | 100 | 100 | 100 |

- Móvil: LCP 1,7 a 1,8 s, CLS 0, TBT 0 ms. Escritorio: LCP 0,4 s. Interacción más lenta medida: 104 ms (INP < 200 ms).
- HTML válido (validador W3C) en el código fuente y en `dist/`.
- Sin rayas, sin emojis y sin menciones a veterinaria en todo el proyecto, comprobado por código.

---

## 11. Regenerar recursos

```bash
bash scripts/assets/subset_fonts.sh                 # fuentes (requiere fonttools y brotli)
python3 scripts/assets/build_images.py <pdfimages> <fotos> assets/img
                                                    # imágenes (pdfimages -all -p del catálogo, foto de Javier)
node scripts/assets/build_og.mjs                    # imagen Open Graph (Playwright)
python3 scripts/assets/gen_legal.py                 # páginas legales (toman el pie y las cookies de index.html)
```

Catálogo PDF comprimido con Ghostscript:

```bash
gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dColorImageResolution=200 -dGrayImageResolution=200 -dJPEGQ=82 -dDetectDuplicateImages=true -o catalogo-vytalgroup-2026.pdf original.pdf
```
