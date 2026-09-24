# VytalGroup · Landing de venta (Meta Ads)

Landing de una sola página para las campañas de Instagram y Facebook de VytalGroup: equipos médicos de alta calidad para profesionales sanitarios, sin letra pequeña. Ecógrafos y diatermias como protagonistas y el resto del catálogo a un clic. Una acción principal: pedir asesoramiento.

- HTML, CSS y JavaScript vanilla. Sin frameworks ni librerías en el navegador.
- Hero, franja de garantías, 6 secciones y un footer (apartado 1).
- Imágenes solo en WebP. Carga inicial en móvil: unos 65 KB (presupuesto 250 KB). JS propio: 14,7 KB. CSS: unos 10 KB (gzip).
- Lighthouse: 100 en todo, en móvil, escritorio y páginas legales.

---

## 1. Cómo es la página

Hablamos como empresa, en primera persona del plural ("Lo que nos preguntáis", "Cuéntanos qué necesitas", "Escríbenos por WhatsApp"). La única excepción es la historia de Javier en "Por qué VytalGroup", que va firmada por él.

**Sistema de alineación, igual en todos los dispositivos:** titulares de sección y botones de sección siempre centrados. El hero lleva el texto a la izquierda en escritorio y centrado en móvil y tableta. "Por qué VytalGroup" es la excepción en escritorio: su titular va a la derecha de la foto de Javier, alineado a la izquierda. La cabecera es fija y siempre visible.

1. **Hero** con **foto de clínica de fondo, difuminada y oscurecida** con un velo marino (más opaco a la izquierda en escritorio, donde va el texto, y abajo en móvil). "Equipos médicos de alta calidad. *Sin letra pequeña.*", la línea "Ecógrafos, diatermias y todo lo que tu clínica necesita. Te asesoran fisioterapeutas.", el botón "Quiero asesoramiento" y "Ver catálogo" (lleva a Más equipos). Ocupa la primera pantalla menos la franja de garantías, que asoma debajo.
   **Franja de garantías** (sección propia, fondo blanco): en bucle infinito y con un icono para cada una: 2 años de garantía · CE / MDR certificados · UE, USA y LATAM envíos · Fisioterapeutas te asesoran · 0 sorpresas en mantenimiento · 53 páginas de catálogo.
2. **Lo más pedido.** Segmentado Ecógrafos / Diatermias y 3 tarjetas con "Lo quiero". En móvil y tableta se ve una tarjeta cada vez, centrada; se pasa deslizando, con puntos. CTA de sección.
3. **Más equipos** ("Todo lo que tu clínica necesita."). 6 categorías del catálogo con descripción al pasar o tocar, "Y más de 50 páginas de equipos en el catálogo." y dos botones: "Quiero asesoramiento" y **"Descargar catálogo"** (oscuro, con icono, para que destaque).
4. **Por qué VytalGroup** ("Sin timos. *Sin letra pequeña.*"). En escritorio, la foto de Javier a la izquierda y a su derecha el titular, la historia en dos líneas ("Me quemé en jornadas de 12 horas." / "Monté VytalGroup para que no te engañen.") alineados a la izquierda; en móvil y tableta, centrado y con la foto debajo. Después, la firma de Javier y el CTA. Fondo marino a todo el ancho.
5. **¿Por qué elegir *VytalGroup?*** (sección propia). Fondo turquesa claro con una trama de puntos suave, distinto del marino de arriba y del claro de Dudas; a todo el ancho. Una tabla centrada en tarjeta blanca, con las cabeceras centradas "OTRAS MARCAS" y "VYTALGROUP": aspas grises y texto tachado en otras marcas, checks blancos sobre turquesa en VytalGroup (columna resaltada). 5 filas: comercial frente a fisioterapeutas · mantenimiento · garantía de 2 años · envío y aduana (UE, USA y LATAM, aduana gestionada) · todo el equipamiento en un solo sitio. En escritorio cada fila cabe en una línea. Sin líneas separadoras. CTA de sección.
6. **Dudas** ("Lo que *nos preguntáis.*"). 6 preguntas: ¿Cuál me conviene? · ¿Qué garantía tienen? · ¿Y el mantenimiento? · ¿Están certificados? · ¿Enviáis fuera de España? · ¿Qué pasa cuando envío el formulario? El CTA y "¿Otra duda? Escríbenos por WhatsApp".
7. **Formulario** ("Cuéntanos qué *necesitas.*", siempre en una línea; la sección empieza más cerca de Dudas porque las dos son claras). 4 preguntas, una por pantalla:
   1. ¿Qué equipo te interesa? Ecógrafo · Diatermia · Presoterapia · Ondas de choque · Otro equipo (desplegable con magnetoterapia, láser, electrólisis percutánea, camillas u otro).
   2. ¿Cuál es tu perfil? Clínica · Fisioterapeuta · Médico · Otro.
   3. ¿Cómo te llamas?
   4. ¿A qué WhatsApp te escribimos? Con prefijo y el consentimiento. Debajo, el enlace **"Prefiero por correo"** abre la misma pregunta para el correo ("¿A qué correo te escribimos?"), con teclado de correo, sin espacios, en minúsculas, formato validado y aviso si el dominio parece mal escrito ("¿Querías decir laura@gmail.com?"). "Prefiero por WhatsApp" vuelve atrás.

   Las opciones avanzan solas al tocarlas. Desde "Lo quiero" se salta la pregunta 1: se llega a la 2 con "Te interesa: Acclarix AX8 · Cambiar".

**Footer** (también en las páginas legales):
- el logo en grande, "Equipos médicos de alta calidad. *Sin letra pequeña.*" y "Información dirigida a profesionales sanitarios";
- columnas con título pequeño: **Contacto** (teléfono, WhatsApp y correo, con icono), **Equipos** (Lo más pedido, Más equipos, Catálogo PDF y Pedir asesoramiento), **Legal** (aviso legal, privacidad, cookies y configurar cookies) y **Síguenos** (Instagram `fisioruiz_`);
- el copyright;
- al final del todo, **"VytalGroup" a todo el ancho** ("Vytal" en blanco y "Group" en turquesa, como el logo), con las letras que suben una a una al llegar.

Centrado en móvil y tableta; en escritorio, la marca a la izquierda y las 4 columnas a la derecha. La barra fija del móvil aparece al pasar el hero y se oculta con el formulario en pantalla; su icono de WhatsApp se oculta cuando se ve otro WhatsApp (Dudas o el pie).

---

## 2. Cambios de las últimas rondas

**v11 (esta ronda)**

- **Transiciones:** vuelven los cortes rectos entre secciones, como antes. Solo Más equipos (la de la cuadrícula) se funde arriba con Lo más pedido; abajo su cuadrícula se desvanece, como siempre. Javier y la comparativa siguen a todo el ancho.
- **Comparativa:** título "¿Por qué elegir *VytalGroup?*", sin subtítulo, tabla más grande (hasta 960 px, texto mayor e iconos de 30 px), cabeceras centradas "OTRAS MARCAS" y "VYTALGROUP" y dos filas nuevas con datos que ya estaban en la web: envío y aduana (UE, USA y LATAM, aduana gestionada) y todo el equipamiento en un solo sitio.
- **Formulario:** "Cuéntanos qué *necesitas.*" en una línea en todos los anchos y la sección más cerca de Dudas (antes quedaba un hueco blanco muy grande entre las dos).

**v10**

- **Panel de cookies:** al abrirse asomaba un instante una barra de scroll (el diálogo tenía `overflow: auto` y la animación de entrada desbordaba su caja) y el foco inicial podía desplazarlo. Ahora el diálogo no hace scroll (solo su contenido, si no cabe), el foco no mueve nada, el fondo aparece con un fundido, en móvil sube como hoja desde abajo y se cierra con la misma suavidad (también con Escape).
- **Transiciones entre secciones:** de Lo más pedido hacia abajo, cada sección empieza con el color de la anterior y se funde con el suyo en su margen superior, con una curva suave (sin línea recta ni bandas): Lo más pedido → Más equipos → Por qué VytalGroup → Lo habitual frente a VytalGroup → Dudas → Formulario. El pie mantiene su corte recto; de la cabecera a las garantías y de las garantías a Lo más pedido, como estaba.
- **Por qué VytalGroup y la comparativa a todo el ancho** (antes eran tarjetas con margen en escritorio).

**v9**

- **"Lo habitual frente a VytalGroup" en su propia sección**, debajo de la de Javier: título, subtítulo, tabla pequeña más cuidada (tarjeta blanca, aspas y checks en círculo, columna de VytalGroup resaltada) y CTA, sobre un fondo turquesa claro distinto del de arriba y del de abajo.
- **Por qué VytalGroup** se queda con "Sin timos. *Sin letra pequeña.*", la historia, la foto, la firma de Javier y el CTA.

**v8**

- **Lo más pedido:** fuera las flechas; se pasa deslizando, con puntos.
- **Por qué VytalGroup:** fuera las cifras de debajo de la foto (2 años de garantía, 0 sorpresas, fisioterapeutas te asesoran); de la foto de Javier se pasa directo a la tabla "Lo habitual" frente a "Con VytalGroup".
- **Formulario:** debajo del WhatsApp, "Prefiero por correo" abre la misma pregunta para el correo. Formato bien controlado (sin espacios, minúsculas, sin puntos seguidos ni en los extremos, dominio y extensión válidos, 254 caracteres como máximo) y aviso de dominio mal escrito antes de enviar, con corrección en un toque. En la hoja llegan "Contactar por" (WhatsApp o Correo) y el correo.
- **Footer nuevo**, más completo: logo grande, columnas con título pequeño (Contacto, Equipos, Legal, Síguenos) con iconos, copyright y "VytalGroup" a todo el ancho al final con las letras que suben una a una. El mismo pie en las páginas legales.
- **Apps Script:** acepta WhatsApp o correo (al menos uno y bien escrito), columnas "Contactar por" y "Email", y el aviso por email se puede responder directamente al lead cuando dejó su correo.

**v7**

- **Garantías en su propia sección**, fuera del hero: franja blanca bajo el hero (asoma en la primera pantalla), un poco más alta, textos más grandes y un icono para cada garantía (escudo, sello, globo, personas, llave y libro). Sigue en bucle infinito.
- **Comparador** "Lo habitual" frente a "Con VytalGroup": tabla minimalista centrada, con fondo y la columna de VytalGroup resaltada.
- **Dudas:** fuera "¿Solo vendéis ecógrafos y diatermias?"; nuevas "¿Qué garantía tienen?" y "¿Qué pasa cuando envío el formulario?". También en el JSON-LD.
- **Formulario de 4 preguntas:** qué te interesa, perfil (clínica, fisioterapeuta, médico u otro), nombre y WhatsApp. El perfil llega a la hoja de Google.
- **"Fisioterapeutas te asesoran"**, sin "no comerciales", en toda la web y en los metadatos.
- **Lo más pedido en móvil y tableta:** flechas a los lados de la foto para pasar de tarjeta.
- **Cabecera y barra fija en móvil:** se cortaban porque algunos elementos (el panel de pestañas al moverse y la foto del hero) se salían unos píxeles por la derecha; en navegadores que no recortan eso (Safari antiguo y algunos navegadores internos), la página se ensanchaba y la cabecera y la barra se alargaban con ella. Ahora nada se sale en ningún ancho, ni con el texto del sistema al 130 %, y hay un respaldo para esos navegadores. El logo de la cabecera cede espacio antes que el botón.
- **Solo WebP:** fuera todas las AVIF. WebP se decodifica rápido en cualquier móvil.
- **Mejoras:**
  - el Apps Script añade un enlace directo a WhatsApp por lead, avisa por email de cada lead y trae una función `setup()` para prepararlo en un clic;
  - política de privacidad al día con los datos que se piden;
  - pruebas nuevas del Apps Script real contra una hoja simulada.

**v6**

- **Hero con foto de fondo difuminada** (opción 1 de las tres maquetas, "Oscuro, solo foto"): una foto real de clínica del catálogo, difuminada y con velo marino, a toda pantalla. Fuera la diatermia recortada, el halo y las ondas; el hero queda quieto salvo la entrada del texto y la línea de confianza.
  - La foto viene ya difuminada en el archivo (WebP de 7 KB en móvil y 15 KB en escritorio), sin `filter: blur()`, que es caro de pintar en móviles.
  - Se precarga la versión de móvil o la de escritorio según el ancho.
  - La imagen OG se queda como estaba (fondo marino con la diatermia).
- **Por qué VytalGroup en escritorio vuelve a como estaba:** foto a la izquierda y, a su derecha, titular, "Me quemé en jornadas de 12 horas." / "Monté VytalGroup para que no te engañen." y las cifras, alineados a la izquierda. En móvil sigue centrado.
- **Sin líneas separadoras** en las cifras (años, sorpresas, fisioterapeutas) ni en el comparador "Lo habitual" frente a "Con VytalGroup".

**v5**

- **Hero sin fotos ni vídeos de clientes:** escaparate oscuro con la diatermia flotando y ondas (sustituido en la v6). El texto y los botones van centrados en móvil. Imagen OG rehecha en oscuro.
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
- **Formulario de 2 pasos** (antes 6; en la v7 pasa a 4 preguntas). Fuera perfil, plazo y email. El desplegable se abre hacia arriba si abajo no cabe, se ve entero y resalta la opción al pasar el ratón (Enter elige la misma).
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
│   ├── img/                    Productos, categorías, fondo del hero, diatermia de la OG y Javier (WebP)
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
3. **Prepáralo.** Arriba, en el desplegable de funciones, elige **setup** y pulsa **Ejecutar**. Google pedirá permisos (ver el punto 5). Se crea la pestaña "Leads" con sus columnas.
4. **Despliégalo como aplicación web.** Pulsa **Implementar > Nueva implementación**. En "Seleccionar tipo" (engranaje) elige **Aplicación web**:
   - Descripción: "Leads web".
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.

   Pulsa **Implementar**.
5. **Autoriza los permisos** (si no lo hiciste en el punto 3). Pulsa **Autorizar acceso** y elige tu cuenta. Si aparece "Google no ha verificado esta aplicación", pulsa **Configuración avanzada > Ir a (nombre del proyecto)** y **Permitir**. Es normal: el programa es tuyo.
6. **Conecta la URL.** Copia la **URL de la aplicación web** (termina en `/exec`) y pégala en `config.js`:
   ```js
   window.VG_CONFIG = {
     SHEETS_ENDPOINT: "https://script.google.com/macros/s/XXXXXXXX/exec",
     META_PIXEL_ID: ""
   };
   ```
   Vuelve a desplegar la web (apartado 6).
7. **Prueba.** Envía el formulario con datos de prueba. En segundos aparece una fila en "Leads" con la fecha y hora de Madrid, los datos, el origen de la campaña y la columna **Estado** en "Nuevo" para que la gestiones tú. Si abres la URL `/exec` en el navegador y ves `{"ok":true,...}`, el despliegue responde.
8. **Si cambias el script**, vuelve a desplegarlo desde **Implementar > Gestionar implementaciones**: lápiz de la implementación activa, **Versión: Nueva versión** e **Implementar**. Así la URL no cambia.

**Aviso por email con cada lead:** activado por defecto, a `NOTIFY_EMAIL` (vytalkinetech@gmail.com), con nombre, por dónde prefiere que le escribas, teléfono y enlace de WhatsApp (o su correo), perfil, equipo y campaña. Si dejó su correo, "Responder" le contesta directamente. Para desactivarlo, pon `SEND_EMAIL_NOTIFICATION` a `false`, guarda y vuelve a desplegar.

Columnas, en este orden: Fecha · Nombre · Contactar por (WhatsApp o Correo) · Teléfono · WhatsApp (enlace directo `wa.me`) · Email · Perfil · Equipo · Modelo · Consentimiento · utm_source · utm_medium · utm_campaign · utm_content · utm_term · fbclid · fbc · fbp · Referrer · URL de entrada · Dispositivo · Idioma · event_id · Estado.

Detalles:
- Envío con `fetch` y `Content-Type: text/plain;charset=utf-8` (sin petición previa de CORS).
- UTM y `fbclid` se guardan en `sessionStorage` en la primera visita. `fbc` se construye desde `fbclid` si no existe la cookie `_fbc`.
- El script valida los campos obligatorios (nombre, perfil, equipo, consentimiento y `event_id`), que haya teléfono o correo, que el teléfono tenga entre 8 y 15 cifras y que el correo tenga un formato válido, usa `LockService`, ignora envíos repetidos con el mismo `event_id`, descarta el campo trampa y escapa los textos que empiezan por `=`, `+`, `-` o `@`.
- **Equipo:** Ecógrafo, Diatermia, Presoterapia u Ondas de choque. Si se marca "Otro equipo", llega la categoría elegida en el desplegable (Magnetoterapia de alta intensidad, Láser de alta potencia, Electrólisis percutánea ecoguiada o Camillas de fisioterapia) u "Otro equipo" si se elige "Otro".
- **Modelo:** el elegido en "Lo quiero"; "Sin decidir" si se eligió ecógrafo o diatermia sin modelo; vacío en el resto de equipos.
- **Perfil:** Clínica, Fisioterapeuta, Médico u Otro.
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

**Texto.** Unas 217 palabras visibles en las secciones, más 23 en la franja de garantías y 23 en cabecera y footer, medidas por código. Voz de empresa ("nosotros"); la historia firmada es de Javier.

**Diseño.**
- Geist + Instrument Serif. Marino `#0B1929` en el hero, en "Por qué VytalGroup" y en el footer. Turquesa `#48A0A8`, el del logo, en botones y detalles.
- El botón de descarga del catálogo es marino con el icono en turquesa: destaca junto al CTA sin competir con él.
- El titular del hero se ajusta al ancho de pantalla para salir siempre en 3 líneas.
- La foto del hero va difuminada en el propio archivo: pesa muy poco y no hay que difuminarla en el navegador.
- Entre secciones, corte recto; solo Más equipos se funde arriba con Lo más pedido (curva suave de opacidad dentro de su margen).
- Imágenes solo en WebP (decodificación rápida en cualquier móvil). La imagen OG sigue en JPG y los iconos de la web en PNG, porque Facebook, WhatsApp e iOS los piden así.
- Nada puede salirse por la derecha: en móvil y tableta el cambio de pestaña se anima en vertical y el carrusel se recorta dentro de su sección.

**Animaciones.** Solo `transform`, `opacity` y variables CSS.
- Hero: titular por palabras y entrada suave del resto; la foto de fondo, quieta.
- Titulares de sección por líneas.
- Imágenes con fundido y escala.
- Parallax leve y halo en tarjetas (escritorio).
- Segmentado con transición cruzada (en vertical en móvil y tableta).
- Nombre de la empresa en el pie: las letras suben una a una al llegar (y se levantan un poco al pasar el ratón).
- Comparador con checks que se dibujan.
- Barra de progreso de lectura.
- Botones con brillo y efecto magnético.
- `prefers-reduced-motion`: sin entradas, parallax ni marquesina, el nombre del pie quieto y sin desplazamiento suave.

**Formulario.** 4 preguntas, una por pantalla y las de opciones con avance automático: así se siente corto aunque pregunte el perfil. El correo es la alternativa, no una pregunta más: quien prefiere WhatsApp no lo ve. El aviso de dominio mal escrito sale al pulsar Enviar (no al salir del campo), para no mover el botón justo cuando se toca. El WhatsApp de la pantalla de gracias lleva el nombre y el equipo o modelo.

---

## 10. Historial

- **v11 (esta ronda)**, **v10**, **v9**, **v8**, **v7**, **v6** y **v5:** ver apartado 2.
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

- **Apps Script (17):** el `google-sheets.gs` real contra una hoja simulada: `setup()`, columnas, WhatsApp o correo, enlace de WhatsApp, aviso por email (con respuesta directa al lead), duplicados, campo trampa, campos obligatorios, teléfono, fórmulas y cuerpos no válidos.
- **Formulario y tracking (102 comprobaciones):**
  - nada de Facebook sin consentimiento;
  - aviso de cookies;
  - eventos: PageView, ViewContent, DescargaCatalogo (desde Más equipos) y Contact;
  - "Lo quiero" salta al perfil con el modelo;
  - 4 preguntas (equipo, perfil, nombre y WhatsApp) y consentimiento, con progreso 1/4 a 4/4;
  - perfil: opciones, aviso si no se elige, avance automático y se conserva al volver;
  - "Prefiero por correo": enlace bajo el WhatsApp, misma pregunta para el correo, 12 formatos incorrectos rechazados, sin espacios, minúsculas, aviso de dominio mal escrito y corrección en un toque, vuelta a WhatsApp, envío con "Correo" y un dominio propio sin avisos;
  - "Cambiar";
  - validaciones;
  - prefijos: buscador, Enter y Escape, opción resaltada con el ratón, hoja inferior en móvil;
  - "Otro equipo": desplegable que se abre hacia arriba cerca del borde y se ve entero, con teclado y ratón;
  - envío con UTM y exactamente las columnas de la hoja;
  - doble clic sin duplicar;
  - Lead único con `eventID` = `event_id`;
  - endpoint vacío, error del servidor y antispam.
- **Interfaz (131):**
  - hero, franja de garantías y 5 secciones;
  - 6 dudas, iguales en la web y en el JSON-LD;
  - sin "no comerciales";
  - palabras;
  - CTA por sección (con "Descargar catálogo" junto al de Más equipos);
  - alineación centrada de titulares y CTA en móvil y escritorio;
  - Por qué VytalGroup: a la derecha de la foto en escritorio, centrado en móvil, historia en dos líneas y sin líneas separadoras;
  - cabecera fija siempre visible;
  - barra de progreso;
  - franja de garantías: sección propia bajo el hero, visible en la primera pantalla, más grande, un icono distinto en cada una y en bucle infinito;
  - hero en móvil y escritorio (foto de fondo precargada según el ancho, a todo el hero, velo marino, sin filtro, titular y logo en blanco, sin equipo recortado, ondas ni vídeos);
  - segmentado;
  - carrusel de una tarjeta centrada, sin flechas;
  - Por qué VytalGroup: titular, historia, foto, firma y CTA, sin cifras ni tabla;
  - transiciones: Más equipos se funde arriba con Lo más pedido (dentro de su margen); el resto de secciones y el pie, con corte recto; Javier y la comparativa a todo el ancho;
  - titular del formulario en una línea de 320 a 1440 px y el formulario cerca de Dudas;
  - panel de cookies en escritorio, móvil y horizontal: se abre sin barra de scroll ni saltos (medido fotograma a fotograma), como hoja en móvil, se cierra con animación (también con Escape) y se puede volver a abrir;
  - ¿Por qué elegir VytalGroup?: sección propia tras la de Javier, sin subtítulo, con CTA, fondo distinto del de arriba y del de abajo, cabeceras centradas "OTRAS MARCAS" y "VYTALGROUP", 5 filas y, en escritorio, todas en una línea a la misma altura;
  - pie: logo, columnas con título, enlaces, nombre en grande a todo el ancho con las letras animadas, y el mismo pie en las legales;
  - nada ensancha la página de 320 a 1024 px, con el texto al 100 y al 130 % y simulando un navegador sin `overflow: clip`: la cabecera y la barra fija nunca se cortan;
  - solo WebP;
  - Más equipos, comparador (tabla centrada con fondo) y acordeón;
  - movimiento reducido;
  - CSP, caché, PDF, URLs limpias, metadatos y OG.
- **Diseño (17 tamaños):** capturas de página completa de 320 a 1920 px, horizontal y páginas legales, con comprobación por código de desbordes, textos partidos, solapes y áreas táctiles. Revisadas una a una.
- `node tests/inp.cjs`: interacción más lenta 96 ms con la CPU ×4 (INP < 200 ms), incluidas las 4 preguntas y "Prefiero por correo".

| | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| Móvil, landing (3 pasadas) | 100 · 100 · 100 | 100 | 100 | 100 |
| Escritorio, landing | 100 | 100 | 100 | 100 |
| Móvil, páginas legales | 100 | 100 | 100 | 100 |

Móvil: LCP 1,35 s (el titular del hero), CLS 0. Escritorio: LCP 0,4 s. HTML válido (W3C). Sin rayas ni emojis, comprobado por código.

---

## 12. Regenerar recursos

```bash
bash scripts/assets/subset_fonts.sh                 # fuentes (requiere fonttools y brotli)
python3 scripts/assets/build_images.py <pdfimages> <fotos> assets/img
                                                    # imágenes WebP (pdfimages -all -p del catálogo y foto de Javier;
                                                    # también el fondo difuminado del hero)
node scripts/assets/build_og.mjs                    # imagen Open Graph (Playwright)
python3 scripts/assets/gen_legal.py                 # páginas legales (toman el pie y las cookies de index.html)
```

Catálogo PDF comprimido con Ghostscript:

```bash
gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dColorImageResolution=200 -dGrayImageResolution=200 -dJPEGQ=82 -dDetectDuplicateImages=true -o catalogo-vytalgroup-2026.pdf original.pdf
```
