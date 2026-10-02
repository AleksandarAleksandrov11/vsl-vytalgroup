# Apps Script de los leads de VytalGroup

Este programa vive dentro de la hoja de Google de los leads. Hace lo siguiente:

- **Recibe** cada solicitud del formulario de la web.
- **La guarda** en la pestaña **Leads**, con dos columnas para el equipo comercial: **Estado** y **Notas**.
- **Avisa por email.**
- **Mantiene la pestaña Resumen**, con totales y conteos que se actualizan solos.

La web no cambia: sigue enviando lo mismo a la misma URL.

El código es el archivo `Code.gs` de esta carpeta. Si vas a sustituir el script en una hoja que ya está en uso, sigue el orden de los apartados 2 y 3.

---

## 1. Lo que hay que saber antes de empezar

- **Haz siempre una copia antes de tocar la hoja real.** Ve a **Archivo > Hacer una copia**. La copia trae su propio Apps Script. Pruébalo todo primero en la copia (apartado 2).
- **La URL de la aplicación web no puede cambiar.** En la hoja real, el código nuevo se publica como **Nueva versión** de la implementación que ya existe. **Nunca** con "Nueva implementación", porque eso crea otra URL y la web dejaría de guardar leads.
- **En la hoja real, el orden importa.** Primero se publica la nueva versión y después se ejecuta `setup()`. Si lo haces al revés, la versión antigua que sigue atendiendo a la web vería columnas que no conoce y apartaría la pestaña como "Leads anterior". No se perdería nada, pero tendrías que juntarlo a mano.
- **No cambies los títulos de la fila 1** de "Leads". El programa los usa para reconocer la hoja. Puedes añadir columnas tuyas a la derecha de la O sin problema.

---

## 2. Probarlo en una copia

1. Abre la hoja de leads y ve a **Archivo > Hacer una copia**. Ponle un nombre como "COPIA PRUEBAS Leads".
2. En la copia, abre **Extensiones > Apps Script**.
3. Pega el código:
   1. En la lista de la izquierda, abre `Código.gs` (o `Code.gs`).
   2. Borra todo lo que haya y pega el contenido completo de `Code.gs`.
   3. Pulsa el icono del disquete (**Guardar**).
4. Comprueba que el proyecto usa el motor moderno: en **Configuración del proyecto** (rueda dentada), la casilla "Habilitar el tiempo de ejecución de Chrome V8" tiene que estar marcada.
5. Arriba, en el desplegable de funciones, elige **setup** y pulsa **Ejecutar**.
   - La primera vez Google pide permisos (apartado 5).
   - En el **Registro de ejecución** debe salir "Pestaña "Leads" lista con N leads", a quién van los avisos y si hay secreto.
6. Mira la hoja. Debes ver:
   - las columnas nuevas **Estado** y **Notas** detrás de **Modelo**;
   - las fechas antiguas con formato de fecha;
   - la pestaña **Resumen** con números y tablas, sin ningún `#ERROR!`.
7. Elige **testLead** y pulsa **Ejecutar**.
   - En el registro debe salir "Todo bien".
   - En la hoja aparece una fila "PRUEBA testLead (borrar)", en amarillo y con Estado "Nuevo".
   - El email llega al destinatario de los avisos.
   - Borra esa fila cuando quieras.
8. Si quieres probar el envío real desde fuera, publica la copia como aplicación web:
   1. Ve a **Implementar > Nueva implementación**. En "Seleccionar tipo" (rueda dentada) elige **Aplicación web**.
   2. Rellena las opciones:
      - **Descripción:** "Pruebas".
      - **Ejecutar como:** **Yo**.
      - **Quién tiene acceso:** **Cualquier usuario**. En algunas versiones se llama "Cualquier persona"; en inglés es "Anyone".
   3. Pulsa **Implementar** y copia la URL que termina en `/exec`. Es una URL nueva, solo de la copia.
   4. Prueba con `curl` (apartado 9) o pásasela a quien vaya a hacer la prueba.
9. Cuando todo esté bien, ya puedes hacerlo en la hoja real.

---

## 3. Ponerlo en la hoja real

1. Abre la hoja real y ve a **Extensiones > Apps Script**.
2. Sustituye el contenido de `Código.gs` por el de `Code.gs` y pulsa **Guardar**.
3. **Publica la nueva versión, sin cambiar la URL:**
   1. Ve a **Implementar > Gestionar implementaciones**.
   2. Elige la implementación activa (la que ya usa la web) y pulsa el lápiz (**Editar**).
   3. En **Versión**, elige **Nueva versión**. En la descripción puedes poner, por ejemplo, "Estado, Notas y Resumen".
   4. Pulsa **Implementar**. La URL que aparece debe ser la misma de antes.
4. Ejecuta **setup**. Hace la migración de la hoja real:
   - inserta Estado y Notas;
   - convierte las fechas;
   - crea el Resumen.

   Si no lo ejecutas, la migración se hace sola con el primer lead que llegue, pero es mejor hacerla tú y ver el resultado.
5. Si quieres, ejecuta **testLead** y borra después la fila de prueba.
6. Envía una solicitud desde la web y comprueba tres cosas: la fila en "Leads", el email y el Resumen.

---

## 4. Propiedades del script (opcionales)

Están en **Configuración del proyecto** (rueda dentada) **> Propiedades del script > Añadir propiedad del script**.

| Propiedad | Para qué sirve | Si no existe |
|---|---|---|
| `NOTIFY_EMAIL` | A quién va el aviso de cada lead. Se pueden poner varios correos separados por comas. | Se usa `aaswebmarketing@gmail.com`. |
| `LEAD_SECRET` | Una contraseña que tiene que venir en cada envío (campo `secret`). Si no viene o no coincide, responde `{"ok":false,"error":"No autorizado"}`. | Se aceptan los envíos como hasta ahora. |

**Importante sobre `LEAD_SECRET`:** la web actual no envía ningún `secret`. Si creas esta propiedad ahora, la web dejará de guardar leads. Créala solo cuando la web (o el sistema que envíe los leads) ya mande ese valor.

El programa guarda además una propiedad llamada `LAYOUT_VERSION`, que sirve para saber que la hoja ya está migrada. No hace falta tocarla.

---

## 5. Permisos de Google

La primera vez que ejecutes una función, Google pide permiso para que el programa use tu hoja y envíe emails en tu nombre:

1. Pulsa **Revisar permisos** y elige tu cuenta.
2. Si aparece "Google no ha verificado esta aplicación", pulsa **Configuración avanzada** y después **Ir a (nombre del proyecto) (no seguro)**. Es normal: el programa es tuyo y no está publicado para otros.
3. Pulsa **Permitir**.

---

## 6. La pestaña Leads

Hay una fila por lead. La columna A es la primera.

| Col. | Título | Qué contiene |
|---|---|---|
| A | Fecha y hora | Fecha real (no texto), con formato `dd/MM/yyyy HH:mm` y hora de Madrid. Se puede filtrar y contar por días. |
| B | Nombre | Nombre que escribió en el formulario. |
| C | Teléfono | WhatsApp con prefijo, guardado como texto (no se pierden el `+` ni los ceros). Vacío si eligió correo. |
| D | Email | Correo en minúsculas. Vacío si eligió WhatsApp. |
| E | Perfil | Clínica, Fisioterapeuta, Médico u Otro. |
| F | Equipo de interés | Ecógrafo, Diatermia, Presoterapia, Ondas de choque o la categoría elegida en "Otro equipo". |
| G | Modelo | Solo si eligió un modelo concreto ("Lo quiero" en una tarjeta). "Sin decidir" se guarda vacío. |
| H | Estado | Desplegable: Nuevo, Contactado, Propuesta enviada, Cliente, Descartado. Los leads nuevos entran como "Nuevo". |
| I | Notas | Libre, para comentarios del equipo comercial. |
| J | utm_source | Origen de la campaña. |
| K | utm_medium | Medio. |
| L | utm_campaign | Campaña. |
| M | utm_content | Anuncio. |
| N | utm_term | Conjunto de anuncios. |
| O | event_id | Identificador de la solicitud. Está oculta y evita duplicados. No la borres. |

Detalles:

- **Colores por estado** (fila entera):

  | Estado | Color |
  |---|---|
  | Nuevo | amarillo `#FFF4CC` |
  | Contactado | azul `#DDEBFF` |
  | Propuesta enviada | lila `#E8DDFF` |
  | Cliente | verde `#D1FAE5` |
  | Descartado | gris `#EEEEEE` |

- **Leads antiguos:** quedan con el Estado vacío, para no inflar "Pendientes". Puedes ponerles el estado que corresponda.
- **Fila 1:** congelada y con filtro, para ordenar y filtrar.
- **Filas preparadas:** hay unas 1000 filas ya formateadas (fecha, teléfono, desplegable y colores). Cuando se acaban, el programa añade otras 1000 solo.
- **Para cambiar los estados o sus colores,** edita la lista `ESTADOS` al principio de `Code.gs`. Después guarda, publica una nueva versión y ejecuta `setup()` y `rebuildSummary()`.

---

## 7. La pestaña Resumen

Se crea sola y se actualiza con cada lead nuevo. No escribe nada en "Leads". Contiene:

- **Totales:**
  - leads totales;
  - leads de hoy;
  - últimos 7 días (hoy y los 6 anteriores);
  - pendientes (Estado "Nuevo").
- **Conteos, de mayor a menor:**
  - por perfil;
  - por equipo de interés;
  - por modelo;
  - por campaña (`utm_campaign`);
  - por anuncio (`utm_content`);
  - por origen (`utm_source`).

  Si todavía no hay datos, la tabla dice "Sin datos todavía".

Las fórmulas se escriben con el separador que usa tu hoja: `;` si la hoja está en español (es_ES) y `,` si está en inglés (en_US). El programa lo detecta con una fórmula de prueba.

**Si el Resumen sale con errores,** si has cambiado la configuración regional de la hoja o si borraste la pestaña: en Apps Script elige **rebuildSummary** y pulsa **Ejecutar**. La pestaña se rehace desde cero. Si le habías añadido algo a mano, se pierde; los datos de "Leads" no se tocan.

---

## 8. Parámetros de URL para los anuncios de Meta

En el Administrador de anuncios, en cada anuncio, ve a **Seguimiento > Parámetros de URL** y pega:

```
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}
```

Así, cada lead llega con:

- **la plataforma** en `utm_source`: `fb` (Facebook), `ig` (Instagram), `an` (Audience Network) o `msg` (Messenger);
- **la campaña** en `utm_campaign`;
- **el anuncio** en `utm_content`;
- **el conjunto de anuncios** en `utm_term`.

El Resumen los cuenta solo.

---

## 9. Prueba con curl (opcional)

Desde un terminal (Mac, Linux o Windows 10 en adelante), cambia `URL_DE_LA_COPIA` por la URL `/exec` de la copia:

```bash
curl -L -H 'Content-Type: text/plain;charset=utf-8' \
  --data '{"nombre":"PRUEBA curl (borrar)","telefono":"+34 600 000 001","email":"","perfil":"Clínica","equipo":"Ecógrafo","modelo":"Acclarix AX8 (EDAN)","consentimiento":"Sí","utm_source":"prueba","utm_medium":"curl","utm_campaign":"prueba-curl","utm_content":"","utm_term":"","event_id":"prueba-curl-001","website":""}' \
  'URL_DE_LA_COPIA'
```

- **Primera vez:** responde `{"ok":true}`.
- **Repetido con el mismo `event_id`:** responde `{"ok":true,"duplicate":true}` y no crea otra fila.
- **Comprobación de que la aplicación web responde:**

  ```bash
  curl -L 'URL_DE_LA_COPIA'
  ```

  Responde `{"ok":true,"service":"VytalGroup leads","time":"..."}`.

---

## 10. Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| La web dice "No se ha podido enviar" | Abre la URL `/exec` en el navegador: tiene que responder `{"ok":true,...}`. Revisa en Apps Script **Ejecuciones** el último error. |
| `No autorizado` | Existe `LEAD_SECRET` y el envío no trae el mismo valor. Borra la propiedad o envía el `secret` correcto. |
| No llega el email | Mira la carpeta de spam y la propiedad `NOTIFY_EMAIL`. Las cuentas gratuitas de Gmail tienen un límite de unos 100 emails al día. Aunque el email falle, el lead se guarda igual y el error queda en **Ejecuciones**. |
| He cambiado el código y la web sigue igual | Falta publicar: **Implementar > Gestionar implementaciones > Editar > Nueva versión**. |
| El Resumen muestra `#ERROR!` | Ejecuta **rebuildSummary**. |
| Ha aparecido una pestaña "Leads anterior …" | El programa no reconoció las columnas de "Leads" (por ejemplo, porque se cambió un título de la fila 1) y la apartó sin borrar nada. Copia esas filas a la pestaña "Leads" nueva, en las mismas columnas. |
| He añadido columnas mías a la derecha y el filtro no las incluye | Ejecuta **setup** otra vez: amplía el filtro sin tocar los datos. |

---

## 11. Pruebas automáticas (para desarrolladores)

`node tests/qa-apps-script.cjs` ejecuta `Code.gs` contra una hoja de Google simulada. La simulación tiene la configuración regional es_ES (separador `;`) y en_US (`,`), y evalúa las fórmulas del Resumen.

Comprueba:

- el contrato con la web: campos y respuestas;
- las validaciones, el campo trampa y los duplicados;
- la inyección de fórmulas y el límite de 1000 caracteres;
- que "Sin decidir" se guarda vacío y el teléfono como texto;
- las migraciones, sin perder filas y de forma idempotente;
- que el Resumen no tiene errores en ninguno de los dos idiomas;
- que un fallo del email no impide guardar el lead;
- `LEAD_SECRET`, `NOTIFY_EMAIL`, las filas reservadas y `testLead()`.

También se ejecuta con `npm test`.
