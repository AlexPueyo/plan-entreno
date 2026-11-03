# Plan de Alex

Panel personal de entrenamiento y nutrición, en español, instalable en el móvil (PWA). Se publica con GitHub Pages en `https://alexpueyo.github.io/plan-entreno/`.

La interfaz está en `index.html`, `styles.css` y `app.js`. **No calcula el plan:** solo lee un JSON. Para cambiar la semana no hace falta tocar la interfaz.

## Actualizar la semana

1. Copia la semana que termina:

   ```bash
   cp data/semana-actual.json data/historial/2026-11-02.json
   ```

   El nombre es la fecha del lunes (`week.start`). `data/historial/` es el archivo de semanas pasadas. La app, de momento, no lo lee: sirve para no perder el plan anterior.

2. Edita **solo** `data/semana-actual.json`.
3. Comprueba el archivo:

   ```bash
   node scripts/validate-data.mjs
   ```

4. Sube el cambio a `main`. El workflow de GitHub Actions publica la web. El service worker pide el JSON a la red antes de usar la copia guardada, así que el móvil ve la semana nueva en cuanto abre la app con conexión.

Los textos `Estimación` y `Pendiente` se dejan tal cual cuando el dato todavía no es una medición.

## Qué hay que mantener al día

| Zona de la app | Dónde está en el JSON |
| --- | --- |
| Cabecera (semana y fase) | `week.label`, `phase` |
| Inicio: resumen, anillo, alerta | se calcula de `days[].sessions`, `menus`, `week.alerta`, `athlete.metrics` |
| Hoy: bloques, ejercicios, comidas | `days[]`, `menus` |
| Semana: calendario y tarjetas | `events`, `days[]`, `distribution.byDay` |
| Progreso: atleta, CTL/ATL/TSB, objetivos, horas, marcas | `athlete`, `load`, `goals`, `weeklyHours`, `distribution`, `records` |
| Nutrición y suplementos | `nutrition`, `menus` |
| Notas: fase, zonas, riesgos, próximos pasos | `phase`, `zonas`, `week.summary`, `risks`, `nextSteps` |

`Hoy` elige el día cuya `date` coincide con el día del teléfono. Si hoy no cae dentro de `week.start`–`week.end`, abre el lunes. El marcador `hoy` de las gráficas de carga hace lo mismo sobre `load.points`: si la fecha de hoy está en la serie, el marcador se coloca ahí; si no, usa `load.hoyIndex`.

Las casillas de los ejercicios se guardan en el navegador (`localStorage`, clave `plan-alex-checks`). No van en el JSON.

El anillo de Inicio suma las sesiones con `cuentaEnPlan: true`. `completado: true` cuenta como hecho. El descanso del viernes no entra en el anillo.

## Esquema (`schemaVersion`: 2)

Paleta de los objetivos, en este orden (índice `goals[].color`):

`#FC4C02` naranja · `#2D7FF9` azul · `#14B8A6` verde azulado · `#A855F7` morado.

### `week`

- `number`, `label`: número y título visible (`Semana 1 · 2–8 nov`).
- `start`, `end`: lunes y domingo, `YYYY-MM-DD`.
- `summary`: frase de la fase y de la semana. Sale en Notas.
- `calendarStartHour`, `calendarEndHour`: horas enteras del calendario (en esta semana, 6 y 23).
- `calendarCaption`: nota bajo el calendario.
- `referenceToday`, `referenceNowHour`: día y hora (decimal, 14.2 = 14:12) del momento en que se armó el plan. La app dibuja la hora real del teléfono; estos dos campos conservan la referencia original.
- `alerta`: frase corta de Inicio.
- `piscinaM`: largo de la piscina en metros (20). Un largo = `piscinaM`.

### `phase`

Periodización que se muestra en la cabecera y en Notas.

- `name`: `Fase 1 base`.
- `fullName`, `focus`.
- `start`, `end`: `YYYY-MM-DD` (2 nov 2026–10 ene 2027).
- `startLabel`, `endLabel`: texto corto (`2 nov`, `10 ene`).
- `weekNumber`, `weeksTotal`: semana 1 de 10.
- `dayNumber`, `daysTotal`: día 2 de 70.

La ficha de Alex (21 años, 1,75 m, nivel intermedio) vive en `athlete` y no cambia cada semana. El peso que se ve en las tarjetas es el de `athlete.metrics`, no un campo suelto.

### `athlete`

- `name`, `age`, `heightM` (metros, número), `level`.
- `asOf`: frase de la fecha de los datos (`Estado a 3 de noviembre…`).
- `metrics[]`: `{ id, value, label, detail?, tone? }`. `value` y `detail` se muestran tal cual. `tone: "success"` marca la tarjeta en verde.
- `pending[]`: `{ label, value }` para lo que sigue en `Pendiente`.

### `load`

Serie diaria de condición física (CTL, 42 días), fatiga (ATL, 7 días) y forma (TSB = condición − fatiga).

- `caption`, `formNote`: textos bajo el título y bajo las gráficas.
- `hoyIndex`: posición (desde 0) del marcador `hoy` en el plan original.
- `hoyLabel` (`hoy`), `zeroLabel` (`equilibrio`).
- `fitness`: `{ key: "ctl", label, ceiling, floor }`.
- `fatigue`: `{ key: "atl", label }`. Comparte el eje de `fitness`.
- `form`: `{ key: "tsb", label, ceiling, floor }`.
- `points[]`: un objeto por día, en orden, sin huecos:

  ```json
  { "date": "2026-10-19", "label": "19 oct", "ctl": 0, "atl": 0, "tsb": 0 }
  ```

  `label` es el texto del eje; déjalo `""` en los días sin marca. `date` tiene que ser el día natural siguiente al anterior. En esta semana la serie va del 19 oct al 8 nov (21 días) y el `hoy` original es el índice 15 (3 nov).

### `goals[]`

`{ name, now, target, nowLabel, targetLabel, color }`. `now` y `target` son números (la barra usa `now / target`). Las etiquetas se muestran tal cual (`día 2`, `70 días (10 ene)`, `2:00 h`…).

### `weeklyHours`

Columnas apiladas de horas por semana y deporte.

- `unit`: `h`.
- `labels[]`: una etiqueta por semana (`2–8 nov (plan)`).
- `series[]`: `{ name, values[] }`. `name` es `Bici`, `Carrera`, `Natación` o `Fuerza` (de ese nombre depende el color). `values` tiene la misma longitud que `labels`.

### `distribution`

Reparto de **esta** semana. No lo recalcules a partir de `weeklyHours`: los textos (`1:00–1:30`, `3:10`) vienen del plan y no siempre coinciden con el decimal.

- `byDiscipline[]`: `{ label, hours, display, emphasis? }`.
- `byDay[]`: `{ id, label, hours, display, emphasis? }`. `id` es `lun`…`dom`. `emphasis: true` resalta la barra (en este plan, la carrera y el sábado).
- `warning`: `{ title, text }`.

### `records[]`

`{ title, detail, badge, tone? }`. `tone: "success"` pinta la etiqueta en verde. `badge` es `PR`, `2.ª mejor`, `10 semanas`, etc.

### `nutrition`

- `targets[]`: `{ label, value }` (proteína, energía, agua, evitar).
- `macrosNote`, `supplementNote`.
- `supplements[]`: `{ moment, name, dose, why }`, en el orden del día. Las filas con el mismo `moment` se agrupan.

### `menus`

Objeto con una clave por plantilla. Esta semana: `c18`, `c20`, `sab`, `dom`. Cada una:

```json
{
  "name": "Entreno por la tarde y clase a las 18:00",
  "meals": [
    {
      "time": "6:30",
      "name": "Desayuno",
      "food": "80 g de pan de centeno, 2 huevos, tomate, 1 manzana y café",
      "kcal": 430,
      "p": 20,
      "c": 60,
      "g": 12,
      "supp": "Creatina 5 g + vitamina D3"
    }
  ]
}
```

`p`, `c` y `g` son gramos de proteína, hidratos y grasa. `supp` es el suplemento de esa toma; `—` significa que no hay. Los totales y el donut los suma la interfaz (el donut reparte la energía con 4 kcal/g para proteína e hidratos y 9 kcal/g para la grasa; el centro muestra la suma de `kcal`). No hace falta guardar el total.

El viernes puede llevar `days[].note` (en esta semana: quitar el whey y bajar el arroz a 60 g). Es una nota, no un menú distinto: el menú enlazado sigue siendo `c18`.

### `days[]`

Siete objetos, de lunes a domingo:

- `id`: `lun`, `mar`, `mie`, `jue`, `vie`, `sab`, `dom`.
- `date`: `YYYY-MM-DD`.
- `label`: `Lun 2`, `Mar 3`…
- `work`, `classes`, `focus`.
- `menu`: clave de `menus`.
- `note`: opcional.
- `llevar`: opcional, material compartido por las sesiones del día cuando ninguna trae el suyo.
- `sessions[]`: cada sesión es un objeto con:
  - `id`, `deporte` (`bici`, `carrera`, `natacion`, `fuerza`, `descanso`), `tag`, `title`.
  - `hora`: `HH:MM` o `null` si el plan no fija la hora.
  - `completado`, `opcional`, `cuentaEnPlan`.
  - `duracionMin` (número o `null`) y `duracion` (texto, `1:25`, `35'`, `15' + sauna 10–15'`).
  - `distancia`, `metros`, `largos`: totales de la sesión. En natación, `metros` es la suma de `bloques[].metros` y `largos` es `metros / piscinaM`.
  - `objetivo`: texto corto para Inicio (`Z2 135–150`).
  - `nota`, `llevar` (lista), `nutricion_durante` (texto o `null`).
  - `bloques[]`, en orden: `{ nombre, duracion, duracionMin, distancia, metros, largos, descanso, intensidad, descripcion, fase? }`. `intensidad` es `{ zona, fc, texto }` o `null`. `fase: "despues"` pinta el bloque debajo de los ejercicios (la vuelta a la calma del gym).
  - `ejercicios[]`: grupos `{ grupo, items }`. Cada ítem es `{ id, nombre, series, reps, descanso, rir, notas }`. `A1`+`A2` es una superserie. `reps` puede ser `10`, `30"`, `10/brazo` o `8/pierna`.

Las horas de `distribution`, `weeklyHours` (columna de esta semana) y los objetivos «Horas», «Natación» y «Carrera» de esta semana salen de estas sesiones: se suman los `duracionMin` con `cuentaEnPlan`, y los metros de natación. El miércoles está contado en 40' porque los tramos (8'+3'+20'+4'+5') suman 40.

### `zonas`

`{ fcMax, nota, tabla: [{ zona, fc }] }`. La tabla provisional (FCmáx ~190) vive aquí y se pinta en Notas.

### `events[]`

Bloques del calendario. `{ date, start, end, title, free?, flag? }`. `start` y `end` son horas decimales (`16.25` = 16:15). `free: true` es trabajo. `flag: true` es clase. El resto es entreno.

### `risks[]` y `nextSteps[]`

- Riesgo: `{ title, detail, tone?, badge? }`. `tone` es `warning` o `danger`. Sin `tone` ni `badge` queda neutro.
- Paso: `{ title, detail }`, en el orden en que se deben leer.

## PWA y rutas

Todo usa rutas relativas (`./data/semana-actual.json`, `manifest.json`) para funcionar en `https://alexpueyo.github.io/plan-entreno/`.

`manifest.json` se llama **Plan de Alex**, con `theme_color` `#f6f5f3` (claro por defecto), iconos 192 y 512 (normal y maskable) y `display: standalone`. El tema oscuro sigue a `prefers-color-scheme`. `sw.js` precarga la app en el primer acceso. Si cambias HTML, CSS o JS y quieres soltar copias viejas, sube `CACHE` en `sw.js` (`plan-alex-v3`, `v4`…).

Colores: acento `#FC4C02`. Los deportes solo van en un punto: bici `#2D7FF9`, carrera `#FC4C02`, natación `#14B8A6`, fuerza `#A855F7`.

Iconos: `node` no hace falta para regenerarlos; el script es `scripts/make-icons.py` (Pillow).

Para verla en local hace falta un servidor, el service worker no arranca en `file://`:

```bash
python3 -m http.server 8765
```

Abre `http://127.0.0.1:8765/`.

## GitHub Pages

El workflow `.github/workflows/pages.yml` despliega con `actions/deploy-pages` en cada push a `main`.

En el repositorio, una sola vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Sin eso el workflow no tiene dónde publicar. El sitio queda en `https://alexpueyo.github.io/plan-entreno/`.
