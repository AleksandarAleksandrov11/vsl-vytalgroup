# VytalGroup · Landing de venta (Meta Ads)

Landing de una sola página para las campañas de Instagram y Facebook de VytalGroup. Equipos médicos de alta calidad para profesionales sanitarios, sin timos ni letra pequeña. Ecógrafos y diatermias como protagonistas, y el resto del catálogo a un clic. Una única acción principal: pedir asesoramiento.

- HTML, CSS y JavaScript vanilla. Sin frameworks ni librerías en el navegador.
- 7 secciones y un footer: Hero (con la tarjeta "Clientes" y la línea de confianza), Lo más pedido, Más equipos, Por qué VytalGroup, Catálogo, Dudas y Formulario.
- Carga inicial en móvil: unos 109 KB en el peor caso (presupuesto 250 KB). JS propio: 15,5 KB. CSS: 10,4 KB (gzip). El vídeo del hero (644 KB en WebM, 763 KB en MP4) se pide después de la carga.
- Lighthouse: 100 en rendimiento, accesibilidad, buenas prácticas y SEO, en móvil y en escritorio.

---

## Cambios de la v4: hero con material real de clientes

**Qué se pidió.** Quitar la sección de testimonios y rediseñar el hero para que quede limpio, pero con algo más visual, usando las fotos y el vídeo de clientes que envió VytalGroup.

**Testimonios eliminados.** Se quitan la sección, sus estilos, sus pruebas y el aviso de la compilación. La prueba social ahora es real y va en el hero.

**Hero nuevo.** El texto es el mismo: titular, línea de apoyo, CTA y "Ver catálogo". Se quitan el recorte del equipo, la rejilla de puntos y el barrido de ecografía. A la derecha (debajo en móvil) hay una **tarjeta "Clientes" en formato historia de Instagram**, el mismo nombre que tiene el destacado de la marca:
- Una baraja de 3 tarjetas 4:5 con material real:
  1. el vídeo de la diatermia en consulta, con un fisioterapeuta tratando la rodilla de un deportista;
  2. las botas de presoterapia con el logo de VytalGroup;
  3. la diatermia montada en la camilla de una clínica.
- Cabecera de historia: barras de progreso, logo, "Clientes · Fotos y vídeo reales" y botón de pausa.
- Tocar la derecha avanza y la izquierda vuelve. La tarjeta delantera sale hacia la izquierda y vuelve al fondo de la baraja.
- Avanza sola: el vídeo hasta el final y cada foto 5 s, con un zoom lento.
- En escritorio la baraja se inclina un poco con el cursor.
- Al cargar, las tarjetas se reparten desde detrás de la primera.

**Rendimiento y accesibilidad**
- Carga del vídeo:
  - Mientras carga, se ve una foto de la misma sesión (es el LCP y va precargada).
  - El vídeo se pide después del evento `load` y aparece encima con un fundido cuando empieza a reproducirse.
  - Nunca se descarga con ahorro de datos o en 2G.
  - Va sin audio, en WebM (VP9) con MP4 (H.264) de respaldo.
- Empieza en el plano general, que coincide con la foto, y el bucle no tiene saltos.
- Se pausa con el botón (WCAG 2.2.2), fuera de pantalla y con la pestaña oculta.
- Con `prefers-reduced-motion` empieza en pausa, sin vídeo ni zoom. El botón lo pone en marcha si se quiere.

**Material no usado.** Las capturas de WhatsApp e Instagram muestran nombres, números y conversaciones. Tampoco encajan con un hero limpio.

**Recursos.** `scripts/assets/build_clientes.py` genera las fotos (400, 520, 640 y 800 px, AVIF + WebP) y el vídeo desde los archivos originales.

---

## Cambios de la v3 (brief de ajustes)

Se mantiene el sistema visual del rediseño: Geist + Instrument Serif, paleta, espaciados, componentes y tono.

**Enfoque.** El mensaje pasa de "ecógrafos y diatermias" a "equipos médicos de alta calidad, sin timos ni letra pequeña". Ecógrafos y diatermias siguen siendo los protagonistas.

**Secciones**
1. **Hero.** Titular nuevo, "Equipos médicos de alta calidad. *Sin letra pequeña.*", con la línea de apoyo "Ecógrafos, diatermias y todo lo que tu clínica necesita. Te asesora Javier, fisioterapeuta.". Debajo, el CTA y el enlace discreto "Ver catálogo". El titular se ajusta al ancho de su columna para que siempre salga en 3 líneas.
2. **Línea de confianza** (petición del cliente). Una marquesina fina bajo el hero con cifras: 2 años de garantía · CE / MDR certificados · UE, USA y LATAM envíos · 1 fisio te asesora · 0 sorpresas en mantenimiento · 53 páginas de catálogo.
3. **Lo más pedido.** El segmentado y las tarjetas de siempre, más un CTA de sección.
4. **Más equipos** (nueva). 6 categorías del catálogo con imagen y nombre. La descripción aparece al pasar el ratón, al tocar o con el foco del teclado. Debajo: "Y más de 50 páginas de equipos en el catálogo." y el CTA.
5. **Por qué VytalGroup.** Título "Sin timos. *Sin letra pequeña.*", la historia de Javier, las tres cifras y un comparador de 3 filas "Lo habitual" frente a "Con VytalGroup", con checks que se dibujan.
6. **Testimonios** (petición del cliente): 8 de ejemplo en bucle, marcados como tales. **Eliminada en la v4**; la prueba social pasa al hero con material real.
7. **Catálogo** (nueva). Maqueta 3D del catálogo (portada y dos páginas reales) que se abre en abanico al entrar y se inclina con el cursor en escritorio. Debajo, "PDF · 53 páginas · Descarga directa", el botón "Descargar catálogo" y el enlace "¿Prefieres que te asesore?".
8. **Dudas.** 5 preguntas, entre ellas la nueva "¿Solo vendéis ecógrafos y diatermias?", y después el CTA y el enlace de WhatsApp.
9. **Formulario.** El paso 1 tiene ahora 5 opciones: Ecógrafo · Diatermia · Presoterapia · Ondas de choque · Otro equipo. "Otro equipo" abre un desplegable propio con magnetoterapia, láser, electrólisis percutánea, camillas u otro.
10. **Footer** con "Catálogo (PDF)". La barra fija del móvil se oculta también en la sección del catálogo.

**Regla de CTA.** Cada sección termina con un único CTA, siempre con el texto "Quiero asesoramiento". La única excepción es el catálogo, con "Descargar catálogo".

**Fondos por sección** (petición del cliente):
- Hero: claro y limpio, con un halo turquesa muy suave (v4).
- Más equipos: gris azulado con rejilla fina.
- Por qué VytalGroup: marino con grano.
- Catálogo: turquesa muy claro con puntos.
- Formulario: halo turquesa.

**Metadatos.**
- Title: "Equipos médicos para fisioterapia, sin letra pequeña | VytalGroup".
- Description, OG y Twitter actualizados.
- JSON-LD FAQPage con las 5 preguntas.
- Nueva imagen OG: "Equipos médicos de alta calidad. Sin letra pequeña.".

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
│   ├── js/                     main.js, reel.js (tarjeta Clientes), form.js, select.js (desplegable propio), data.js,
│   │                           attribution.js, consent.js, tracking.js, legal.js
│   ├── img/                    Productos, categorías, páginas del catálogo, fotos de clientes y Javier (AVIF + WebP)
│   ├── video/                  Vídeo de clientes del hero (WebM + MP4, sin audio)
│   ├── fonts/                  Geist (variable, 400 a 600) e Instrument Serif cursiva, woff2 con subset latino
│   ├── brand/                  Favicon, iconos e imagen Open Graph
│   └── docs/catalogo-vytalgroup-2026.pdf
├── integrations/google-sheets.gs   Apps Script que recibe los leads en Google Sheets
├── scripts/
│   ├── build.mjs               Compilación a dist/ (hashes, CSS inline, minificado, SITE_URL, sitemap)
│   ├── serve.mjs               Servidor local que aplica las cabeceras de vercel.json
│   └── assets/                 Generadores: imágenes, material de clientes, fuentes, imagen OG y páginas legales
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
- **Equipo:** Ecógrafo, Diatermia, Presoterapia u Ondas de choque. Si se marca "Otro equipo", llega la categoría elegida en el desplegable (Magnetoterapia de alta intensidad, Láser de alta potencia, Electrólisis percutánea ecoguiada o Camillas de fisioterapia) u "Otro equipo" si se elige "Otro".
- **Modelo:** el elegido en "Lo quiero"; "Sin decidir" si se eligió ecógrafo o diatermia sin modelo; vacío en el resto de equipos.
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
| `DescargaCatalogo` | Evento personalizado (`trackCustom`) al descargar el catálogo (sección Catálogo, footer o pantalla de gracias). **No es un lead.** |
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
5. **Permiso de imagen.** El fisioterapeuta y el deportista del vídeo y de la foto se reconocen, y en la camiseta se ven logos de un club y de un hotel. Hay que confirmar que los clientes autorizan su uso en la web y en anuncios (RGPD). Para cambiar o quitar material:
   - Edita `scripts/assets/build_clientes.py` y vuelve a generarlo (apartado 11).
   - Ajusta las tarjetas `.reel__card` de `index.html`.
6. **Vídeo de Javier.** El vídeo de la diatermia (1:47) que había en el proyecto no es de Javier (lo confirmó el cliente), así que no se usa. Si Javier graba uno, se puede poner en "Por qué VytalGroup" con portada y carga solo al pulsar.
7. **Material que no llegó:** la carpeta `referencias/` no venía en el encargo. Mejorarían la web unas fotos de los Acclarix a más resolución (el catálogo trae unos 550 px) y una foto de Javier más grande (la recibida es de 640 × 640).
8. **Confirmar el usuario de Instagram** de la marca: se enlaza `instagram.com/vytalgroup`.

---

## 8. Decisiones tomadas

**Estructura.** Las preguntas del visitante, en orden:
- ¿Qué es y quién lo usa? → Hero (con fotos y vídeo reales de clientes).
- ¿Qué es lo más habitual? → Lo más pedido.
- ¿Tenéis también…? → Más equipos.
- ¿Por qué vosotros? → Por qué VytalGroup.
- ¿Puedo verlo todo? → Catálogo.
- ¿Y si…? → Dudas.
- ¿Cómo lo pido? → Formulario.

**Textos**
- Titular: "Equipos médicos de alta calidad. *Sin letra pequeña.*". La línea de apoyo nombra a los protagonistas (ecógrafos y diatermias) y a Javier.
- Un único texto de CTA, "Quiero asesoramiento", en cabecera, hero, cada sección y barra móvil. Las excepciones:
  - "Descargar catálogo", en el catálogo, como pide el brief.
  - "Lo quiero", en las tarjetas: lleva al formulario con ese modelo ya elegido.
- Palabras visibles, medidas por código en las pruebas (sin respuestas del acordeón, descripciones de Más equipos ni formulario):
  - 250 en las secciones;
  - 24 en la línea de confianza;
  - 23 en cabecera y footer.

  Para quedar en torno a 250 en la v3:
  - la línea de confianza usa cifra + 1 o 2 palabras;
  - se quitó "¿No sabes cuál elegir?";
  - se acortó el comparador;
  - se quitó la pregunta "¿Qué garantía tienen?", porque la garantía ya aparece en la línea de confianza, las cifras y el comparador.
- Comparador: solo lo que ya afirma la web (asesora un fisioterapeuta, mantenimiento sin sorpresas, 2 años en piezas y mano de obra). Es una tabla de verdad, con encabezados, para lectores de pantalla.
- Descripciones de Más equipos, sacadas del catálogo:
  - Presoterapia (pág. 48, EME).
  - Ondas de choque (pág. 32).
  - Superinductiva VytaMeD (pág. 7).
  - Láser de alta potencia de 808 y 980 nm (pág. 9).
  - Physio Invasiva 2.0 (pág. 15).
  - Camillas (pág. 14).
- Metadatos: el title es el que propone el brief (65 caracteres).

**Diseño**
- Base clara (`#FAFBFC`, tarjetas blancas). Cada sección tiene su fondo y textura (apartado de cambios v3). El marino `#0B1929` se usa solo en "Por qué VytalGroup" y en el footer.
- Turquesa `#48A0A8`, el tono exacto del logo, solo en:
  - botones;
  - indicador del segmentado;
  - barras de progreso;
  - checks del comparador;
  - detalles mínimos.

  Los botones llevan texto marino (contraste 5,8:1).
- Geist variable (pesos 400 a 600) e Instrument Serif cursiva solo en una o dos palabras de cada titular. Respaldos con métricas ajustadas (CLS 0).
- Más equipos:
  - 2 columnas en móvil, 3 desde 640 px.
  - Un "+" en la esquina de cada imagen indica que hay más información y gira a "×" al abrirla.
  - En móvil la descripción cubre toda la tarjeta, porque sobre la imagen no cabe.

**Imágenes**
- Los 6 destacados y las 6 categorías tienen el mismo tratamiento: recorte, lienzo blanco 4:3, mismo tamaño visual y misma sombra de contacto (`scripts/assets/build_images.py`). Sale todo del catálogo PDF:
  - la presoterapia de la pág. 48, porque la de las botas llegaba cortada;
  - la Superinductiva y la Physio Invasiva, recortadas con GrabCut, con la dominante cian corregida en la segunda;
  - el láser, con el fondo gris aclarado.
- Maqueta del catálogo: portada y páginas 6 y 8 del PDF renderizadas con `pdftoppm`.
- Hero (v4): fotos y vídeo reales de clientes, recortados a 4:5 (`scripts/assets/build_clientes.py`). El recorte de la Diatermia Multifunción VytaMeD queda solo para la imagen OG.
- Javier: su foto real.

**Animaciones.** Solo `transform`, `opacity` y variables CSS, con IntersectionObserver, `requestAnimationFrame` y listeners pasivos. Easing `cubic-bezier(.22, 1, .36, 1)`.
- Hero: titular por palabras con máscara y entrada escalonada de texto, botones y línea de confianza. La baraja "Clientes" se reparte desde detrás, con zoom lento en las fotos, vídeo con fundido, avance tipo historia e inclinación con el cursor. Es la animación de entrada, sin pantalla previa.
- Titulares de sección: aparecen por líneas con máscara (75 ms entre líneas).
- Imágenes de producto y categorías: fundido y escala de 0,96 a 1, escalonadas. En escritorio, parallax vertical muy leve (máx. 16 px).
- Más equipos: entrada escalonada; al pasar el ratón, la tarjeta sube, la imagen hace zoom a 1,04 y aparece la descripción.
- Comparador: filas una a una (220 ms) y checks que se dibujan con `stroke-dashoffset`.
- Conteo de "2 años · 0 sorpresas · 1 fisio", con easeOutQuart.
- Catálogo: abanico al entrar e inclinación con el cursor en escritorio.
- Barra de progreso de lectura de 2 px en turquesa bajo la cabecera. Sube al borde superior cuando la cabecera se esconde en móvil.
- Botones: brillo al pasar, hundimiento al pulsar y efecto magnético en escritorio.
- Halo de luz que sigue al cursor en tarjetas y categorías (escritorio).
- Segmentado: transición cruzada con desplazamiento corto hacia el lado al que se cambia.
- Marquesina de confianza: CSS puro, en pausa fuera de pantalla y al pasar el ratón.
- Acordeón: solo `transform` (FLIP).
- `prefers-reduced-motion`: sin parallax, inclinación, marquesina (quieta y sin copia), conteos, zoom ni vídeo automático. Quedan solo fundidos.

**Formulario (6 pasos)**
- Equipo → perfil → plazo → nombre → WhatsApp → email y consentimiento.
- Paso 1:
  - Tocar Ecógrafo, Diatermia, Presoterapia u Ondas de choque avanza solo.
  - "Otro equipo" no avanza: abre el desplegable. Al elegir, avanza.
  - Sin elegir, avisa "Elige qué equipo buscas.".
- El desplegable y el prefijo telefónico son el mismo componente accesible (`select.js`):
  - se maneja con flechas, Inicio/Fin, Enter, Escape y Tab;
  - se cierra al pulsar fuera;
  - en móvil se abre como hoja inferior sin abrir el teclado.
- Desde "Lo quiero", el paso 1 se muestra como confirmación ("Te interesa: Acclarix AX8 · Cambiar").

**Barra móvil y WhatsApp**
- Aparece al pasar el hero. Se oculta:
  - en el catálogo, para no competir con "Descargar catálogo";
  - con el formulario en pantalla;
  - con el aviso de cookies abierto.
- Un solo enlace de WhatsApp visible a la vez.

**Cookies:** solo hay una categoría opcional, "Marketing" (píxel de Meta). La web no usa analítica.

---

## 9. Historial de cambios

**v4 (este encargo)**
- Hero rediseñado con la tarjeta "Clientes": fotos y vídeo reales en formato historia.
- Quitado: la sección de testimonios de ejemplo, el recorte del equipo en el hero y el barrido de ecografía.

**v3**
- Añadido:
  - línea de confianza;
  - Más equipos;
  - comparador;
  - testimonios de ejemplo;
  - sección de catálogo con maqueta 3D;
  - barra de progreso;
  - paso 1 ampliado con desplegable;
  - fondos por sección.
- Cambiado:
  - enfoque general, titular, metadatos e imagen OG;
  - CTA de sección en todas;
  - `prefix.js` pasa a ser el componente genérico `select.js`.
- Quitado:
  - el enlace de texto al catálogo bajo las tarjetas (ahora es una sección);
  - la pregunta "¿Qué garantía tienen?" (repetida).

**v2 (rediseño), respecto a la primera versión**
- Menú de navegación.
- Gama completa de 10 ecógrafos, filtros, "Ver ficha" y fichas técnicas.
- Tabla comparativa de diatermias.
- "También te equipamos con" (5 productos) y "Cómo trabajamos" (4 pasos). En la v3 las otras categorías vuelven, de forma compacta, en Más equipos.
- Badges, etiquetas de tarjeta y chips de confianza.
- Botón flotante de WhatsApp y CTA con textos distintos ("Me interesa", "Habla con Javier", "No sé cuál elegir"…).
- Formulario de 9 pasos (ahora 6).
- Animación de entrada a pantalla completa.
- Vídeos (el de la diatermia no es de Javier).
- Tipografías Syne e Inter.
- Configuración de Netlify: el despliegue es en Vercel.

---

## 10. Pruebas y resultados

`npm test` se ejecuta sobre `dist/` (compila antes con `npm run build`). Levanta la web con las cabeceras de `vercel.json` y un Apps Script simulado, y ejecuta:

- **Formulario y tracking (89 comprobaciones):**
  - nada de Facebook antes de aceptar (red interceptada);
  - aviso de cookies;
  - eventos: PageView, ViewContent, DescargaCatalogo (no es Lead) y Contact;
  - preselección desde "Lo quiero";
  - los 6 pasos con teclado, ratón y táctil;
  - paso 1 ampliado: "Otro equipo" con desplegable y teclado, que envía "Láser de alta potencia" sin modelo; Presoterapia con avance automático;
  - validaciones, prefijos y sugerencia de email;
  - envío con UTM y todas las columnas;
  - doble clic sin duplicar;
  - Lead una sola vez con `eventID` = `event_id`;
  - endpoint vacío, error del servidor y antispam.
- **Interfaz y reglas del brief (90):**
  - las 7 secciones en orden, sin testimonios;
  - palabras visibles;
  - un CTA por sección, con el texto idéntico, y "Descargar catálogo" en el catálogo;
  - nada prohibido (ISO, FDA, veterinaria);
  - botón del hero visible en 375 × 667;
  - cabecera y barra de progreso;
  - línea de confianza en bucle con la copia oculta a lectores;
  - segmentado y carrusel;
  - Más equipos: 3 columnas, zoom 1,04, halo y descripción al pasar; en móvil, 2 columnas, al tocar, una abierta a la vez;
  - comparador: filas escalonadas y checks dibujados;
  - tarjeta Clientes: 3 fotos reales con la primera precargada; vídeo en silencio pedido después de `load`; barra que avanza con el vídeo; pausa y reanudación; anterior y siguiente; fotos que avanzan cada 5 s; pausa fuera de pantalla; sin vídeo con ahorro de datos;
  - catálogo: abanico, inclinación, descarga directa y barra móvil oculta;
  - acordeón y conteo;
  - fuentes y teclado;
  - movimiento reducido: sin marquesina, conteos, inclinación, parallax ni vídeo automático;
  - CSP limpia con el píxel;
  - cabeceras, caché, PDF como adjunto y URLs limpias;
  - metadatos, OG, JSON-LD, sitemap y robots.
- **Diseño (17 tamaños):** capturas de página completa en 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440 y 1920, más móvil en horizontal y páginas legales. Se comprueba por código:
  - scroll horizontal y desbordes;
  - textos partidos o cortados;
  - solapes con la cabecera;
  - áreas táctiles de 44 px.

  Las capturas quedan en `tests/output/` y se revisaron una a una.
- `node tests/inp.cjs`: latencia de las interacciones con la CPU ralentizada ×4.

Resultados de la entrega:

| | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| Móvil, landing (3 pasadas) | 100 · 100 · 100 | 100 | 100 | 100 |
| Escritorio, landing | 100 | 100 | 100 | 100 |
| Móvil, páginas legales | 100 | 100 | 100 | 100 |

- Móvil: LCP 1,7 s (la foto de la tarjeta Clientes), CLS 0, TBT 10 a 40 ms. Escritorio: LCP 0,4 s. Interacción más lenta medida: 120 ms (INP < 200 ms), con la tarjeta Clientes incluida.
- HTML válido (validador W3C) en `dist/`.
- Sin rayas, sin emojis y sin menciones a veterinaria, ISO 13485 o FDA, comprobado por código.

---

## 11. Regenerar recursos

```bash
bash scripts/assets/subset_fonts.sh                 # fuentes (requiere fonttools y brotli)
python3 scripts/assets/build_images.py <pdfimages> <fotos> assets/img
                                                    # imágenes (pdfimages -all -p del catálogo, foto de Javier;
                                                    # las páginas de la maqueta se renderizan del PDF con pdftoppm)
python3 scripts/assets/build_clientes.py <material_clientes> assets/img assets/video
                                                    # fotos y vídeo de clientes del hero (requiere ffmpeg)
node scripts/assets/build_og.mjs                    # imagen Open Graph (Playwright)
python3 scripts/assets/gen_legal.py                 # páginas legales (toman el pie y las cookies de index.html)
```

Catálogo PDF comprimido con Ghostscript:

```bash
gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dColorImageResolution=200 -dGrayImageResolution=200 -dJPEGQ=82 -dDetectDuplicateImages=true -o catalogo-vytalgroup-2026.pdf original.pdf
```
