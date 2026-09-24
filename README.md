# VytalGroup · Landing de venta para Meta Ads

Landing de una sola página para las campañas de Instagram y Facebook de VytalGroup: **ecógrafos y diatermias elegidos por un fisioterapeuta**, con formulario de asesoramiento "una pregunta cada vez", leads a Google Sheets, Meta Pixel con consentimiento, catálogo PDF de descarga libre y páginas legales.

- Sitio estático: HTML, CSS y JavaScript vanilla en módulos. Sin frameworks ni librerías en el navegador.
- Mobile first, pensado también para el navegador interno de Instagram y Facebook.
- Carga inicial en móvil de unos 123 KB (presupuesto: 350 KB).

---

## 1. Estructura del proyecto

```
/
├── index.html                  Landing
├── aviso-legal.html            Páginas legales (mismo diseño, cabecera simplificada)
├── privacidad.html
├── cookies.html
├── config.js                   ← SHEETS_ENDPOINT y META_PIXEL_ID (vacíos)
├── assets/
│   ├── css/                    critical.css (se inserta inline), main.css (no bloqueante), legal.css
│   ├── js/                     main.js, form.js, dropdown.js, data.js, tracking.js, consent.js,
│   │                           attribution.js, legal.js
│   ├── img/                    Imágenes en AVIF + WebP en varios tamaños
│   ├── video/                  Vídeos en MP4 (H.264) + WebM
│   ├── fonts/                  Syne 700/800 e Inter 400/500/600 en woff2 (subconjunto latino)
│   ├── brand/                  Logos SVG, favicon, iconos, imagen Open Graph
│   └── docs/catalogo-vytalgroup-2026.pdf
├── integrations/google-sheets.gs   Código de Google Apps Script para recibir los leads
├── scripts/
│   ├── build.mjs               Compilación a dist/ (minificado, hashes, CSS crítico inline)
│   ├── serve.mjs               Servidor local con compresión
│   └── assets/                 Scripts que generaron imágenes, logo, fuentes y páginas legales
├── tests/                      Pruebas automáticas con Playwright (npm test)
├── _headers                    Cabeceras de caché y seguridad para Netlify
├── netlify.toml / vercel.json  Configuración de despliegue
├── robots.txt / sitemap.xml / site.webmanifest
├── PLAN.md                     Lista de tareas seguida durante el trabajo
└── README.md
```

---

## 2. Cómo ejecutarlo en local

Requisitos: Node.js 18 o superior.

```bash
npm install          # herramientas de compilación (solo desarrollo)
npm run dev          # sirve el código fuente en http://localhost:8080
npm run build        # genera la versión optimizada en dist/
npm run preview      # sirve dist/ en http://localhost:8080
npm test             # pruebas automáticas contra dist/ (ver apartado 9)
```

El código fuente funciona tal cual en el navegador. La compilación (`npm run build`) añade:
- minificado de HTML, CSS y JS;
- hash en el nombre de cada archivo, para poder cachearlos un año;
- CSS crítico insertado en el `<head>`;
- precarga de los módulos JS.

Al terminar muestra un informe de pesos y del presupuesto.

---

## 3. Google Sheets: guardar los leads (paso a paso)

El formulario envía cada solicitud a una hoja de Google a través de un pequeño programa (Apps Script). Se configura una sola vez:

1. **Crea la hoja.** Entra en [sheets.google.com](https://sheets.google.com) con la cuenta de Google que quieras usar (por ejemplo vytalkinetech@gmail.com) y crea una hoja en blanco. Ponle un nombre, por ejemplo "Leads web VytalGroup". No hace falta crear columnas: el programa crea la pestaña "Leads" con sus cabeceras.
2. **Pega el código.** En la hoja, abre el menú **Extensiones > Apps Script**. Se abre un editor con un archivo `Código.gs`. Borra lo que haya y pega todo el contenido de `integrations/google-sheets.gs`. Pulsa el icono de guardar.
3. **Despliégalo como aplicación web.** Arriba a la derecha pulsa **Implementar > Nueva implementación**. En "Seleccionar tipo" (icono de engranaje) elige **Aplicación web** y rellena:
   - Descripción: "Leads web".
   - Ejecutar como: **Yo** (tu cuenta).
   - Quién tiene acceso: **Cualquier usuario**.

   Pulsa **Implementar**.
4. **Autoriza los permisos.** Google pedirá permiso para que el programa use tu hoja: pulsa **Autorizar acceso** y elige tu cuenta. Si aparece "Google no ha verificado esta aplicación", pulsa **Configuración avanzada > Ir a (nombre del proyecto)** y después **Permitir**. Es normal: el programa es tuyo.
5. **Copia la URL.** Al terminar verás la **URL de la aplicación web**, que termina en `/exec`. Cópiala y pégala en `config.js`:
   ```js
   window.VG_CONFIG = {
     SHEETS_ENDPOINT: "https://script.google.com/macros/s/XXXXXXXX/exec",
     META_PIXEL_ID: ""
   };
   ```
   Vuelve a publicar la web (apartado 5).
6. **Haz una prueba.** Abre la web, completa el formulario con datos de prueba y envíalo. En unos segundos aparecerá una fila nueva en la pestaña "Leads", con la fecha y hora de Madrid, los datos, el origen de la campaña (UTM, fbclid…) y la columna **Estado** vacía para que la gestiones tú. También puedes abrir la URL `/exec` en el navegador: si ves `{"ok":true,...}`, el despliegue responde.
7. **Si cambias el código del script** tienes que volver a desplegarlo. Ve a **Implementar > Gestionar implementaciones**, pulsa el lápiz de la implementación activa, elige **Versión: Nueva versión** y pulsa **Implementar**. La URL se mantiene y no hace falta tocar `config.js`. Si creas una implementación nueva en lugar de editar la existente, la URL cambia y hay que actualizarla.

**Opcional: aviso por email con cada lead.** En el script, cambia `const SEND_EMAIL_NOTIFICATION = false;` a `true` (el destinatario es `NOTIFY_EMAIL`). Después guarda y vuelve a desplegar (paso 7). Google pedirá un permiso adicional para enviar correos.

Detalles técnicos:
- El formulario envía JSON como `text/plain`, así el navegador no hace petición previa de CORS, y sigue la redirección de Apps Script.
- El script bloquea escrituras simultáneas (`LockService`).
- Descarta el campo trampa antispam.
- Ignora envíos repetidos con el mismo `event_id`.
- Escapa textos que empiecen por `=`, `+`, `-` o `@` para que la hoja no los interprete como fórmulas.

Columnas, en este orden: Fecha · Nombre · Teléfono · Email · Ubicación · Productos · Modelos · Perfil · Plazo · Consentimiento · utm_source · utm_medium · utm_campaign · utm_content · utm_term · fbclid · fbc · fbp · Referrer · URL de entrada · Dispositivo · Navegador e idioma · event_id · Estado.

Si `SHEETS_ENDPOINT` está vacío, la web funciona igual. Al enviar, el formulario muestra un mensaje amable de error con WhatsApp como alternativa, y deja un aviso claro en la consola del navegador.

---

## 4. Meta Pixel

1. En el **Administrador de eventos** de Meta, copia el identificador numérico de tu píxel.
2. Pégalo en `config.js` → `META_PIXEL_ID: "123456789012345"` y vuelve a publicar.

Cómo funciona:
- **Consentimiento:** el script de Meta **no se descarga** hasta que el visitante acepta la categoría "Marketing" en el banner de cookies. Si acepta más tarde, se carga en ese momento. Si retira el consentimiento desde "Configurar cookies", deja de enviar eventos (`fbq('consent','revoke')`) y se borran las cookies `_fbp` y `_fbc`.
- **Sin ID:** con `META_PIXEL_ID` vacío no se carga nada.
- **Eventos:**

  | Evento | Cuándo se envía |
  |---|---|
  | `PageView` | Al inicializar el píxel. |
  | `ViewContent` | La primera vez que se ve la sección de Ecógrafos (`content_category: "Ecógrafos"`) y la de Diatermias (`"Diatermias"`). Una vez por sesión. |
  | `Lead` | Solo cuando el formulario recibe respuesta de éxito de la hoja, **una única vez**. Lleva `eventID` igual al `event_id` guardado en la hoja y `content_name` con los productos elegidos, para añadir en el futuro la API de Conversiones sin duplicar eventos. |
  | `DescargaCatalogo` | Evento personalizado al pulsar cualquier botón de descarga del catálogo. **No es un lead.** |
  | `Contact` | Al pulsar cualquier botón de WhatsApp. |
- Todo el tracking está en `assets/js/tracking.js`.
- Se desactiva la configuración automática del píxel (`autoConfig`) para que no envíe clics por su cuenta.

---

## 5. Despliegue

**Netlify (recomendado)**
- **Con Git:** conecta el repositorio en Netlify. `netlify.toml` ya indica el comando (`npm run build`) y la carpeta (`dist`). Las cabeceras de `_headers` se aplican solas.
- **Sin Git:** ejecuta `npm install && npm run build` y arrastra la carpeta `dist/` a [app.netlify.com/drop](https://app.netlify.com/drop). En ese caso, para cambiar `config.js` edita `dist/config.js` y vuelve a arrastrar la carpeta.

**Vercel**
- Importa el repositorio. `vercel.json` ya define el comando, la carpeta de salida y las cabeceras de caché y seguridad.

**Caché**
- `/assets/css`, `/assets/js`, `/assets/fonts`, `/assets/img` y `/assets/video` llevan hash en el nombre, así que se cachean un año (`immutable`).
- `config.js` y los HTML se revalidan siempre: los cambios en `config.js` se ven al momento.
- El catálogo se descarga con nombre fijo (`catalogo-vytalgroup-2026.pdf`).

**Dominio y HTTPS**
- Hoy `https://vytalgroup.org` muestra un certificado de `*.netlify.app` que no corresponde al dominio: el navegador da error y solo carga por `http://`. Al publicar, añade el dominio en Netlify (o Vercel) y activa el certificado. Esto es importante para los anuncios.
- Las URL absolutas (canonical, Open Graph, sitemap, robots) apuntan a `https://vytalgroup.org/`. Si el dominio final es otro, cámbialo en `index.html`, en las páginas legales, en `robots.txt` y en `sitemap.xml`.

---

## 6. Pendientes para el cliente

1. **ID del píxel de Meta** → `config.js` (`META_PIXEL_ID`).
2. **URL del Apps Script** → `config.js` (`SHEETS_ENDPOINT`). Pasos en el apartado 3.
3. **Datos legales del titular** en `aviso-legal.html` y `privacidad.html`: razón social o nombre, NIF/CIF, domicilio y datos registrales. Están marcados en amarillo como "[Pendiente: …]". También hay que confirmar:
   - el plazo de conservación de los leads;
   - el proveedor de alojamiento (Netlify o Vercel).

   Conviene que un asesor legal revise los textos.
4. **Confirmar la marca:** la landing usa **VytalGroup** y el logo "VG". La web actual usa "VytalKineTech", que no aparece como marca visible. El email de contacto sigue siendo vytalkinetech@gmail.com.
5. **Confirmar las certificaciones ISO 13485 y FDA.** No aparecen en ninguna fuente para los productos de esta landing, así que **no se han usado**. La barra de confianza dice "Certificación MDR / CE". Cada ficha muestra solo la normativa que indica el catálogo: CE, MDR (UE) 2017/745, clase IIa o IIb, CE0068 o Directiva 93/42/CEE.
6. **Confirmar el usuario de Instagram de la marca.** Se ha enlazado `instagram.com/vytalgroup` a partir de "@VytalGroup". El personal es `@fisioruiz_`.
7. **Material que no llegó.** La carpeta `referencias/` no venía en el encargo: faltan el catálogo EDAN, el logo en archivo y el cartel del sorteo. Si se envían, se pueden sustituir las imágenes (apartado 8). Mejorarían sobre todo las fotos de los Acclarix (el catálogo trae unos 550 px de ancho) y una foto de Javier a más resolución (la recibida es de 640 × 640).
8. **Arreglar el certificado HTTPS del dominio** (apartado 5).
9. **Confirmar el vídeo de demostración de la diatermia.** La persona que aparece no es Javier. Se presenta como "demostración" del producto, sin atribuírselo a nadie. Hay que confirmar que hay permiso para usarlo o enviar uno grabado por Javier (se sustituye en `assets/video/diatermia-demo.*` y `assets/video/diatermia-loop.*`).

---

## 7. Decisiones tomadas

**Marca**
- VytalGroup, con el logo "VG" vectorizado desde el catálogo (versiones clara y oscura, favicon y símbolo).
- El turquesa principal se ha ajustado al del logo, como pide el brief:
  - `#48A0A8` es el tono exacto del logo y se usa solo como decoración;
  - `#4FC1C7` es el color de los botones, siempre con texto marino (contraste 8,3:1);
  - `#257880` es el turquesa para texto sobre fondo claro (5,2:1).
- Todos los pares de texto y fondo cumplen AA.

**Titular del hero:** "Ecógrafos y diatermias, elegidos por un fisio." Syne 800, igual que la web actual.

**Animación de entrada.** Petición expresa, con la referencia de vdnperformance.com:
- **Secuencia:** un "escaneo de ultrasonido" de unos 1,3 s. Aparece el logo VytalGroup con un barrido, una línea turquesa lo atraviesa, unas ondas se expanden y dos "puertas" se abren revelando el hero. Después, titular, botones e imagen entran escalonados; la imagen se revela con una cortina y un barrido de escáner que se repite cada pocos segundos.
- **Cuándo se muestra:** solo en la primera visita de cada sesión.
- **Coste de rendimiento:** solo anima `transform`, `opacity` y un `clip-path` pequeño, y no retrasa el LCP.
- **Movimiento reducido:** con `prefers-reduced-motion` no se muestra.

**Imágenes**
- **Hero:** la Diatermia Multifunción de VytalGroup (foto del catálogo), con una tarjeta flotante del Acclarix AX8, para que se vean los dos productos protagonistas.
- **Vídeo del hero:** no se ha usado. En la web actual la pieza con el rótulo "DW-P8" es una imagen, no un vídeo, y el rótulo no se puede eliminar.
- **Vídeo de demostración de la Diatermia Multifunción (1:47):** va en la sección de Diatermias. Quien lo presenta no es Javier, así que el botón dice "Mira la demostración" y no se le atribuye a nadie:
  - un bucle mudo de 8 s de la pantalla, sin subtítulos, que se carga solo al acercarse y nunca con ahorro de datos o conexiones lentas;
  - un botón para verlo completo con sonido en un diálogo, cargado bajo demanda.
- **Foto de Javier:** la que envió el cliente. Se usa en la historia, en el hero ("Te responde Javier Ruiz") y junto al formulario. El recorte termina por encima del logo de otra clínica que lleva bordado el polo, y lleva un etalonaje de marca suave.
- **Presoterapia:** se usa la imagen de las botas con marca VytalGroup (del vídeo de presoterapia). La foto de I-Press del catálogo lleva otra marca impresa y fondo amarillo.
- **Firma de Javier:** vectorizada con la tipografía libre Mrs Saint Delafield (licencia OFL) para que se vea igual en todos los dispositivos. Se anima como si se escribiera.

**Formulario**
- Nueve pasos, como pide el brief.
- Los modelos del paso 2 se filtran por los equipos del paso 1.
- "Me interesa" lleva al paso 2 con el modelo ya elegido y muestra un aviso "Añadido: …".
- "No sé cuál elegir" preselecciona "Aún no lo sé, quiero asesoramiento".
- Desde el resumen, "Editar" lleva al paso y vuelve al resumen con "Guardar".
- **Teléfono:**
  - 26 países con bandera en SVG, sin emojis, que no se ven en Windows;
  - opción "Otro país" para escribir el prefijo a mano;
  - si se pega un número con `+34…` o `+351…`, detecta el país.
- **Antispam:** si salta el campo trampa o el envío llega antes de 3 s, se muestra la pantalla de gracias pero **no se envía nada ni se registra el Lead**, para no dar pistas a los bots.

**Comparativa de diatermias:** la Multifunción VytaMeD no tiene potencia ni frecuencia en el catálogo. En su fila se indica su tecnología (RET/CET + TENS/IFC, 4 canales) en lugar de inventar cifras.

**Preguntas frecuentes:** 8 preguntas, todas respondidas solo con datos de las fuentes. No se ha añadido nada sobre financiación ni plazos de entrega.

**Rendimiento**
- `content-visibility` en las secciones bajo el hero. El desplazamiento a las anclas se corrige al terminar para aterrizar exacto, y está probado.
- Las opciones de los desplegables se construyen al abrirlos por primera vez, lo que ahorra unos 500 nodos iniciales.
- Los pósteres de vídeo se asignan al acercarse: el atributo `poster` se descarga siempre, aunque el vídeo no.
- En móvil, la imagen del hero es un recorte más ligero (dirección de arte).

**Barra de confianza en móvil:** una fila deslizable que pasa a carrusel automático lento si el movimiento está permitido.

**Atribución:** los UTM y el `fbclid` se guardan en `sessionStorage`, como pide el brief, y figuran en la política de cookies como almacenamiento propio necesario. Conviene que el asesor legal lo confirme.

---

## 8. Mantenimiento

**Textos y productos:** todo está en `index.html`, en HTML legible. Cada producto es un `<article class="pcard">` con su ficha (`<dl class="ficha__list">`) y su botón "Me interesa". Los atributos `data-product` y `data-model` de ese botón deben coincidir con los de `assets/js/data.js` (lista de modelos del formulario).

**Imágenes:** los scripts de `scripts/assets/` documentan cómo se generaron.
- `build_images.py` recorta, lleva a lienzo 5:4 y exporta AVIF + WebP en varios tamaños.
- `build_logo.py` vectoriza el logo.
- `subset_fonts.sh` genera los subconjuntos de las fuentes.

Para una imagen nueva, expórtala en los mismos anchos (por ejemplo 320, 480 y 640) y en los dos formatos. Mantén `width` y `height` en el HTML.

**Páginas legales:** se generaron con `scripts/assets/gen_legal.py`, que comparte cabecera, pie y banner de cookies con la landing. Puedes editar los HTML directamente. Si vuelves a ejecutar el generador, sobrescribe los cambios manuales.

**Catálogo:** comprimido con Ghostscript a 200 ppp, con texto seleccionable (1,2 MB frente a 18 MB):
```
gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dColorImageResolution=200 -dGrayImageResolution=200 -dJPEGQ=82 -dDetectDuplicateImages=true -o catalogo-vytalgroup-2026.pdf original.pdf
```

---

## 9. Resultado de la revisión final

Todo se probó sobre la versión compilada (`dist/`) con Playwright y Chromium.

**Lighthouse, móvil** (Moto G simulado, 4G lento, CPU 4× más lenta; tres pasadas)

| Categoría | Resultado |
|---|---|
| Rendimiento | 96 · 99 · 100 |
| Accesibilidad | 100 |
| Buenas prácticas | 100 |
| SEO | 100 |

| Métrica | Resultado | Objetivo |
|---|---|---|
| LCP | 1,7 a 1,8 s | < 2 s |
| CLS | 0 | 0 |
| TBT | 0 a 150 ms | |
| INP (peor interacción medida con Event Timing y CPU 4×) | 96 ms | < 200 ms |

**Lighthouse, escritorio:** 100 · 100 · 100 · 100. **Páginas legales (móvil):** 100 en las cuatro categorías.

**Pesos**

| Recurso | Peso | Presupuesto |
|---|---|---|
| Carga inicial en móvil (HTML, CSS, JS, fuentes e imagen del hero) | 123 KB | 350 KB |
| JS propio (gzip) | 18,1 KB | 40 KB |
| CSS total (gzip) | 17 KB | 35 KB |
| Catálogo PDF | 1,2 MB | 5 MB |

**Validación HTML:** validador W3C (Nu HTML Checker) sin errores ni avisos, en el código fuente y en `dist/`.

**Pruebas automáticas (`npm test`)**
- **Formulario, consentimiento y tracking** (212 comprobaciones):
  - recorrido completo en móvil y escritorio, validaciones, botón Atrás que conserva los datos, avance con Enter y automático;
  - prefijos con buscador, sugerencia de email y "Fuera de España";
  - endpoint vacío (error amable y aviso en consola), error del servidor y reintento;
  - servidor local que imita Apps Script con redirección: todos los campos, UTM de `?utm_source=facebook&utm_campaign=test&fbclid=abc123`, `fbc` y `fbp`, sin petición previa de CORS;
  - el doble clic produce un solo envío; honeypot y tiempo mínimo;
  - sin consentimiento no se pide `fbevents.js`;
  - `PageView`, `ViewContent` (una vez por sección), `Lead` único con `eventID` igual al `event_id`, `DescargaCatalogo` y `Contact`;
  - rechazar, cambiar y retirar el consentimiento.
- **Componentes** (47): menú móvil, cabecera, anclas y scrollspy, barra CTA, fichas, filtros de la gama, acordeón, carrusel, desplegables (teclado, clic fuera, apertura hacia arriba, hoja inferior), vídeos diferidos y ahorro de datos, foco visible, animación de entrada y movimiento reducido.
- **Diseño:** capturas de página completa en 320, 360, 375, 390, 414, 430, 768, 820, 1024, 1280, 1440 y 1920 px, y en horizontal (844×390 y 932×430). Ningún ancho tiene scroll horizontal (`scrollWidth ≤ innerWidth`), textos cortados ni áreas táctiles de menos de 44 px.

**Revisión de contenido:**
- ninguna raya ni guion largo (U+2014 y U+2013) en HTML, JS, CSS ni metadatos;
- ninguna mención a veterinaria;
- sin textos de relleno;
- todas las anclas y los 136 recursos locales responden;
- el WhatsApp se abre con el mensaje prellenado.

Las pruebas se ejecutan con `npm run build && npm test`. Si Playwright no encuentra navegador, indica uno con `CHROME_PATH=/ruta/a/chrome`.

---

## 10. Créditos y licencias

- **Syne, Inter y Mrs Saint Delafield** (esta última solo convertida en trazados para la firma): SIL Open Font License 1.1.
- **Imágenes de producto:** catálogo ADC Global Tech | VytalGroup 2026. Las marcas de terceros (EDAN, Acclarix, I-Tech, EME, EasyTech, LiKAMED) pertenecen a sus titulares.
- **Vídeos:** material del cliente.
