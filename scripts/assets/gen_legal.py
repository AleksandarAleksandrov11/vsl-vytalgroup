import re
src = open('index.html', encoding='utf-8').read()

# Sprite reducido: gradiente, logo e iconos que usan las páginas legales
sprite = re.search(r'<svg class="sprite".*?</svg>(?=\s*<a class="skip")', src, re.S).group(0)
keep = ['logo', 'i-arrow', 'i-close', 'i-phone', 'i-mail', 'i-whatsapp', 'i-instagram']
defs = re.search(r'<defs>.*?</defs>', sprite, re.S).group(0)
symbols = ''.join(m.group(0) for m in re.finditer(r'<symbol id="([^"]+)".*?</symbol>', sprite, re.S) if m.group(1) in keep)
mini_sprite = f'<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">{defs}{symbols}</svg>'

footer = re.search(r'<footer class="footer">.*?</footer>', src, re.S).group(0).replace('href="#inicio"', 'href="/"')
cookies = re.search(r'<!-- Cookies -->.*?</dialog>', src, re.S).group(0)

HEAD = '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} | VytalGroup</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://vytalgroup.org/{file}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#0B1929">
<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/brand/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<script>document.documentElement.className += ' js';</script>
<link rel="stylesheet" href="/assets/css/critical.css" data-inline>
<link rel="stylesheet" href="/assets/css/main.css">
<link rel="stylesheet" href="/assets/css/legal.css">
<script defer src="/config.js"></script>
<script type="module" src="/assets/js/legal.js"></script>
</head>
<body class="legal">
{sprite}
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="legal-header">
  <div class="container">
    <a class="header__logo" href="/" aria-label="VytalGroup, ir a la página principal"><svg class="logo" viewBox="0 0 1117 171" aria-hidden="true"><use href="#logo"/></svg></a>
    <a class="legal-back" href="/"><svg class="icon icon--flip" aria-hidden="true"><use href="#i-arrow"/></svg> Volver a la web</a>
  </div>
</header>
<main id="contenido">
  <section class="legal-hero section-dark" aria-labelledby="legal-title">
    <div class="container">
      <p class="eyebrow">Información legal</p>
      <h1 class="h2" id="legal-title">{title}</h1>
      <p class="lead">{lead}</p>
    </div>
  </section>
  <section class="legal-main" aria-label="Contenido">
    <div class="container">
      <article class="legal-body">
{body}
        <p class="legal-updated">Última actualización: 23 de septiembre de 2026.</p>
      </article>
    </div>
  </section>
</main>
{footer}
{cookies}
</body>
</html>
'''

P = lambda t: f'<mark class="pending">[Pendiente: {t}]</mark>'
TITULAR = f'''        <dl class="legal-data">
          <div><dt>Titular</dt><dd>{P("nombre y apellidos o razón social")}</dd></div>
          <div><dt>Nombre comercial</dt><dd>VytalGroup</dd></div>
          <div><dt>NIF / CIF</dt><dd>{P("NIF o CIF")}</dd></div>
          <div><dt>Domicilio</dt><dd>{P("dirección completa")}</dd></div>
          <div><dt>Datos registrales</dt><dd>{P("Registro Mercantil, tomo, folio y hoja, o indicar que no procede")}</dd></div>
          <div><dt>Email</dt><dd><a href="mailto:vytalkinetech@gmail.com">vytalkinetech@gmail.com</a></dd></div>
          <div><dt>Teléfono</dt><dd><a href="tel:+34616372644">+34 616 372 644</a></dd></div>
        </dl>'''

aviso = f'''        <h2>1. Datos identificativos</h2>
        <p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI), te informamos de los datos del titular de este sitio web:</p>
{TITULAR}
        <h2>2. Objeto y público</h2>
        <p>Este sitio web ofrece información sobre equipamiento de fisioterapia, rehabilitación y medicina (ecógrafos, diatermias y otros equipos) y permite solicitar asesoramiento. La información está dirigida a profesionales sanitarios.</p>
        <h2>3. Condiciones de uso</h2>
        <p>El acceso a la web es libre y gratuito. Al usarla te comprometes a hacerlo de forma lícita, sin dañar el sitio ni a terceros y sin introducir datos falsos en el formulario.</p>
        <h2>4. Información sobre los productos</h2>
        <p>Las características de los equipos proceden del catálogo internacional de equipamiento médico 2026 de ADC Global Tech y VytalGroup y de la documentación de sus fabricantes. Es información orientativa: las especificaciones, certificaciones, accesorios, plazos y condiciones aplicables se confirman en la oferta final para cada operación y país de destino.</p>
        <p>La web no publica precios ni constituye una oferta vinculante.</p>
        <h2>5. Propiedad intelectual e industrial</h2>
        <p>Los textos, el diseño, el logotipo y los demás elementos propios de la web pertenecen a su titular o se usan con autorización. Las marcas y nombres de producto de terceros (por ejemplo EDAN, Acclarix, I-Tech, EME, EasyTech o LiKAMED) pertenecen a sus respectivos titulares y se citan solo para identificar los equipos.</p>
        <h2>6. Responsabilidad</h2>
        <p>Trabajamos para que la información sea correcta y esté actualizada, pero no podemos garantizar la ausencia de errores ni la disponibilidad continua de la web. No respondemos de los daños derivados de un uso indebido de la web ni de los contenidos de sitios de terceros enlazados.</p>
        <h2>7. Enlaces</h2>
        <p>La web puede incluir enlaces a servicios de terceros, como WhatsApp o Instagram. Al usarlos, se aplican las condiciones y políticas de privacidad de esos servicios.</p>
        <h2>8. Protección de datos y cookies</h2>
        <p>El tratamiento de tus datos personales se explica en la <a href="/privacidad.html">política de privacidad</a> y el uso de cookies en la <a href="/cookies.html">política de cookies</a>.</p>
        <h2>9. Legislación aplicable</h2>
        <p>Estas condiciones se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan conforme a la normativa aplicable.</p>'''

priv = f'''        <h2>1. Responsable del tratamiento</h2>
{TITULAR}
        <h2>2. Qué datos tratamos</h2>
        <ul>
          <li><strong>Datos del formulario:</strong> nombre y apellidos, teléfono, email, provincia o país, perfil profesional, equipos y modelos de interés y plazo previsto.</li>
          <li><strong>Origen de la visita:</strong> parámetros de campaña (UTM), identificador de clic de Meta (fbclid y fbc), página de referencia y URL de entrada. Si aceptas las cookies de marketing, también el identificador del navegador del píxel de Meta (fbp).</li>
          <li><strong>Datos técnicos:</strong> tipo de dispositivo, sistema operativo, tamaño de pantalla, navegador e idioma, y un identificador aleatorio de la solicitud.</li>
          <li><strong>Comunicaciones:</strong> lo que nos cuentes por WhatsApp, teléfono o email.</li>
        </ul>
        <h2>3. Para qué los usamos</h2>
        <ul>
          <li>Atender tu solicitud, asesorarte y enviarte la información o propuesta que pidas.</li>
          <li>Saber de qué campaña o anuncio llega cada solicitud para mejorar nuestras campañas.</li>
          <li>Si aceptas las cookies de marketing, medir la eficacia de los anuncios de Meta (Instagram y Facebook).</li>
          <li>Proteger el formulario frente a envíos automáticos.</li>
        </ul>
        <h2>4. Base legal</h2>
        <ul>
          <li><strong>Consentimiento</strong> (art. 6.1.a RGPD): al enviar el formulario marcando la casilla y al aceptar las cookies de marketing. Puedes retirarlo cuando quieras.</li>
          <li><strong>Medidas precontractuales</strong> a petición tuya (art. 6.1.b RGPD): preparar y enviarte una propuesta.</li>
          <li><strong>Interés legítimo</strong> (art. 6.1.f RGPD): seguridad de la web y prevención de envíos automáticos.</li>
        </ul>
        <h2>5. Cuánto tiempo los conservamos</h2>
        <p>Mientras mantengamos la relación contigo y, si no llegas a contratar, durante {P("plazo de conservación de los leads, por ejemplo 12 meses desde el último contacto")}. Después, los datos se bloquean durante los plazos legales de prescripción y se eliminan.</p>
        <h2>6. Con quién los compartimos</h2>
        <ul>
          <li><strong>Google</strong> (Google Workspace, Google Sheets y Apps Script), como encargado del tratamiento, para recibir y guardar las solicitudes del formulario.</li>
          <li><strong>Meta Platforms Ireland Ltd.</strong>, solo si aceptas las cookies de marketing, para la medición de anuncios con el píxel de Meta.</li>
          <li><strong>Proveedor de alojamiento web:</strong> {P("Netlify o Vercel, según dónde se publique la web")}, como encargado del tratamiento.</li>
          <li>Autoridades y organismos públicos, cuando exista una obligación legal.</li>
        </ul>
        <p>Google y Meta pueden tratar datos fuera del Espacio Económico Europeo. En ese caso lo hacen con las garantías previstas en el RGPD, como el Marco de Privacidad de Datos UE y EE. UU. o las cláusulas contractuales tipo de la Comisión Europea.</p>
        <p>No vendemos tus datos ni los cedemos a terceros con otros fines.</p>
        <h2>7. Tus derechos</h2>
        <p>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, y retirar tu consentimiento en cualquier momento, escribiendo a <a href="mailto:vytalkinetech@gmail.com?subject=Protecci%C3%B3n%20de%20datos">vytalkinetech@gmail.com</a> con el asunto "Protección de datos" e indicando qué derecho quieres ejercer.</p>
        <p>Si consideras que no hemos tratado bien tus datos, puedes presentar una reclamación ante la Agencia Española de Protección de Datos en <a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>.</p>
        <h2>8. Seguridad</h2>
        <p>Aplicamos medidas técnicas y organizativas razonables para proteger tus datos: conexión cifrada, acceso restringido a la hoja de solicitudes y proveedores que cumplen el RGPD.</p>
        <h2>9. Cambios en esta política</h2>
        <p>Podemos actualizar esta política para adaptarla a cambios legales o de funcionamiento. Siempre verás aquí la versión vigente y su fecha.</p>'''

cook = f'''        <h2>1. Qué son las cookies</h2>
        <p>Las cookies y tecnologías similares (como el almacenamiento local del navegador) son pequeños archivos que la web guarda en tu dispositivo para funcionar, recordar tus preferencias o medir anuncios.</p>
        <h2>2. Qué cookies y almacenamiento usa esta web</h2>
        <div class="legal-table-wrap">
          <table class="legal-table">
            <thead><tr><th scope="col">Nombre</th><th scope="col">Titular</th><th scope="col">Finalidad</th><th scope="col">Duración</th><th scope="col">Tipo</th></tr></thead>
            <tbody>
              <tr><td data-label="Nombre"><code>vg_consent</code></td><td data-label="Titular">VytalGroup (propia)</td><td data-label="Finalidad">Guardar tu elección sobre cookies (almacenamiento local)</td><td data-label="Duración">12 meses</td><td data-label="Tipo">Necesaria</td></tr>
              <tr><td data-label="Nombre"><code>vg_intro</code></td><td data-label="Titular">VytalGroup (propia)</td><td data-label="Finalidad">Recordar que ya has visto la animación de entrada (almacenamiento de sesión)</td><td data-label="Duración">Sesión</td><td data-label="Tipo">Necesaria</td></tr>
              <tr><td data-label="Nombre"><code>vg_attr</code></td><td data-label="Titular">VytalGroup (propia)</td><td data-label="Finalidad">Guardar el origen de la visita (UTM y fbclid) para asociarlo a tu solicitud (almacenamiento de sesión)</td><td data-label="Duración">Sesión</td><td data-label="Tipo">Necesaria</td></tr>
              <tr><td data-label="Nombre"><code>vg_vc_*</code>, <code>vg_lead_*</code></td><td data-label="Titular">VytalGroup (propia)</td><td data-label="Finalidad">Evitar que un mismo evento de medición se envíe dos veces (almacenamiento de sesión)</td><td data-label="Duración">Sesión</td><td data-label="Tipo">Marketing</td></tr>
              <tr><td data-label="Nombre"><code>_fbp</code></td><td data-label="Titular">Meta</td><td data-label="Finalidad">Identificar el navegador para medir los anuncios de Meta</td><td data-label="Duración">3 meses</td><td data-label="Tipo">Marketing</td></tr>
              <tr><td data-label="Nombre"><code>_fbc</code></td><td data-label="Titular">Meta</td><td data-label="Finalidad">Guardar el identificador del clic en un anuncio de Meta</td><td data-label="Duración">3 meses</td><td data-label="Tipo">Marketing</td></tr>
            </tbody>
          </table>
        </div>
        <p>Las cookies de Meta solo se instalan si aceptas la categoría de marketing. Meta puede usar además sus propias cookies en sus dominios, según su <a href="https://www.facebook.com/privacy/policies/cookies/" target="_blank" rel="noopener">política de cookies</a>.</p>
        <p><strong>Analítica:</strong> ahora mismo esta web no usa ninguna herramienta de analítica. Si en el futuro se añade, se cargará solo si aceptas esa categoría y se incluirá en esta tabla.</p>
        <h2>3. Cómo gestionar tus preferencias</h2>
        <p>Al entrar por primera vez puedes aceptar, rechazar o configurar las cookies. Puedes cambiar tu elección cuando quieras:</p>
        <p class="legal-cta"><button type="button" class="btn btn--dark" data-cookie-settings>Configurar cookies</button></p>
        <p>También puedes borrar o bloquear las cookies desde la configuración de tu navegador (Chrome, Safari, Firefox o Edge). Si bloqueas las necesarias, es posible que alguna parte de la web no funcione bien.</p>
        <h2>4. Responsable</h2>
        <p>El responsable es el titular de la web indicado en el <a href="/aviso-legal.html">aviso legal</a>. Para más información sobre cómo tratamos tus datos, consulta la <a href="/privacidad.html">política de privacidad</a>.</p>'''

pages = [
  ('aviso-legal.html', 'Aviso legal', 'Datos del titular de la web y condiciones de uso de vytalgroup.org.', 'Quién está detrás de esta web y las condiciones para usarla.', aviso),
  ('privacidad.html', 'Política de privacidad', 'Cómo trata VytalGroup los datos personales del formulario de asesoramiento y de la web.', 'Qué datos tratamos, para qué, durante cuánto tiempo y cómo ejercer tus derechos.', priv),
  ('cookies.html', 'Política de cookies', 'Cookies y almacenamiento que usa la web de VytalGroup y cómo configurarlos.', 'Qué cookies usa la web, para qué sirven y cómo cambiar tu elección.', cook),
]
for file, title, desc, lead, body in pages:
    html = HEAD.format(title=title, desc=desc, file=file, lead=lead, body=body, sprite=mini_sprite, footer=footer, cookies=cookies)
    open(file, 'w', encoding='utf-8').write(html)
    print(file, len(html))
