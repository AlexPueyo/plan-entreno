/* Plan de Alex
   The screen only reads data/semana-actual.json. Weekly edits belong in that file. */

const state = {
  data: null,
  tab: "hoy",
  dayId: null,
};

const TABS = [
  { id: "hoy", label: "Hoy", icon: "hoy" },
  { id: "semana", label: "Semana", icon: "semana" },
  { id: "progreso", label: "Progreso", icon: "progreso" },
  { id: "nutricion", label: "Nutrición", sub: "y suplementos", aria: "Nutrición y suplementos", icon: "nutricion" },
  { id: "notas", label: "Notas", icon: "notas" },
];

const SPORT = {
  Bici: "#FC4C02",
  Carrera: "#2D7FF9",
  Natación: "#14B8A6",
  Fuerza: "#A855F7",
};

const TAG = {
  Hecho: "#3dd68c",
  Z2: "#2D7FF9",
  Drills: "#14B8A6",
  Gym: "#A855F7",
  Swim: "#14B8A6",
  Descanso: "#94a3b8",
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function num(value) {
  return Number(value).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function localISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shortDate(iso) {
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${months[month - 1]}`;
}

function longDate(iso) {
  const formatted = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${iso}T12:00:00`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function icon(name) {
  const attrs = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const paths = {
    hoy: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3.5V6M16 3.5V6M12 13v3.5M10.2 14.8h3.6"/>',
    semana: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 13h2M12 13h2M16 13h2M8 17h2M12 17h2"/>',
    progreso: '<path d="M4 16.5 8.2 12l3.1 3.1L20 6.5"/><path d="M15 6.5h5V11"/>',
    nutricion: '<path d="M12 20.5s-6.5-4.1-6.5-9.2a3.7 3.7 0 0 1 6.5-2.2 3.7 3.7 0 0 1 6.5 2.2c0 5.1-6.5 9.2-6.5 9.2z"/>',
    notas: '<path d="M7 3.5h7.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M14 3.6V8.5h5M8 13h8M8 17h5.5"/>',
  };
  return `<svg ${attrs}>${paths[name]}</svg>`;
}

function pickDay(data) {
  const today = localISO();
  return (data.days.find((day) => day.date === today) || data.days[0]).id;
}

function readHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  if (!raw) return;
  const [tab, day] = raw.split("/");
  if (TABS.some((item) => item.id === tab)) state.tab = tab;
  if (day && state.data.days.some((item) => item.id === day)) state.dayId = day;
}

function syncHash() {
  const next = `#/${state.tab}/${state.dayId}`;
  if (location.hash !== next) history.replaceState(null, "", next);
}

function currentDay() {
  return state.data.days.find((day) => day.id === state.dayId) || state.data.days[0];
}

function menuOf(day) {
  return state.data.menus[day.menu];
}

function totals(meals) {
  return meals.reduce(
    (sum, meal) => ({
      kcal: sum.kcal + meal.kcal,
      p: sum.p + meal.p,
      c: sum.c + meal.c,
      g: sum.g + meal.g,
    }),
    { kcal: 0, p: 0, c: 0, g: 0 }
  );
}

function goalPct(goal) {
  if (!goal.target) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.now / goal.target) * 100)));
}

function markerIndex(data) {
  const today = localISO();
  const index = data.load.points.findIndex((point) => point.date === today);
  return index >= 0 ? index : data.load.hoyIndex;
}

function daySelect() {
  const today = localISO();
  const chips = state.data.days.map((day) => {
    const [dow, dom] = day.label.split(" ");
    const on = day.id === state.dayId ? " is-on" : "";
    const hoy = day.date === today
      ? '<span class="hoy-mark">hoy</span>'
      : '<span class="hoy-mark" aria-hidden="true">&nbsp;</span>';
    return `<button type="button" class="day-chip${on}" data-day="${esc(day.id)}" aria-pressed="${day.id === state.dayId}">
      <span class="dow">${esc(dow)}</span>
      <span class="dom">${esc(dom || "")}</span>
      ${hoy}
    </button>`;
  }).join("");
  return `<div class="day-select" role="group" aria-label="Día de la semana">${chips}</div>`;
}

function sessionsHtml(sessions) {
  return `<div class="stack">${sessions.map((session) => {
    const color = TAG[session.tag] || "#FC4C02";
    return `<article class="card session" style="--tag:${color}">
      <div class="session-top">
        <h3>${esc(session.title)}</h3>
        <span class="tag">${esc(session.tag)}</span>
      </div>
      <p>${esc(session.detail)}</p>
    </article>`;
  }).join("")}</div>`;
}

function agendaHtml(day, menu) {
  return `<div class="agenda">
    <div><span>Trabajo</span><strong>${esc(day.work)}</strong></div>
    <div><span>Clases</span><strong>${esc(day.classes)}</strong></div>
    <div><span>Tipo de menú</span><strong>${esc(menu.name)}</strong></div>
  </div>`;
}

function mealsHtml(meals) {
  return `<ol class="meals">${meals.map((meal) => {
    const supp = meal.supp && meal.supp !== "—"
      ? `<p class="supp">${esc(meal.supp)}</p>`
      : "";
    return `<li class="meal card">
      <div class="meal-head">
        <span class="meal-time">${esc(meal.time)}</span>
        <strong class="meal-name">${esc(meal.name)}</strong>
      </div>
      <p class="meal-food">${esc(meal.food)}</p>
      <div class="chips">
        <span class="chip">${num(meal.kcal)} kcal</span>
        <span class="chip">${num(meal.p)} g prot.</span>
        <span class="chip">${num(meal.c)} g hidr.</span>
        <span class="chip">${num(meal.g)} g grasa</span>
      </div>
      ${supp}
    </li>`;
  }).join("")}</ol>`;
}

function donutSvg(parts, center) {
  const energy = parts.reduce((sum, part) => sum + part.kcal, 0);
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = parts.map((part) => {
    const len = energy ? (part.kcal / energy) * c : 0;
    const gap = len > 4 ? 3 : 0;
    const dash = Math.max(0, len - gap);
    const circle = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${part.color}" stroke-width="16" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 80 80)"/>`;
    offset += len;
    return circle;
  }).join("");
  return `<svg viewBox="0 0 160 160" role="img" aria-label="Reparto de energía del día, ${esc(center)} kcal">
    <circle cx="80" cy="80" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="16"/>
    ${arcs}
    <text x="80" y="76" text-anchor="middle" fill="#f4f6f8" font-size="20" font-weight="800">${esc(center)}</text>
    <text x="80" y="96" text-anchor="middle" fill="#a3adbb" font-size="11" font-weight="700">kcal</text>
  </svg>`;
}

function legendHtml(parts) {
  const energy = parts.reduce((sum, part) => sum + part.kcal, 0);
  return `<div class="legend">${parts.map((part) => {
    const pct = energy ? Math.round((part.kcal / energy) * 100) : 0;
    return `<div><i style="background:${part.color}"></i><span>${esc(part.label)}</span><b>${num(part.grams)} g · ${pct}%</b></div>`;
  }).join("")}</div>`;
}

function macroParts(total, palette) {
  return [
    { label: "Hidratos", grams: total.c, kcal: total.c * 4, color: palette[0] },
    { label: "Proteína", grams: total.p, kcal: total.p * 4, color: palette[1] },
    { label: "Grasa", grams: total.g, kcal: total.g * 9, color: palette[2] },
  ];
}

function renderHoy() {
  const day = currentDay();
  const menu = menuOf(day);
  const total = totals(menu.meals);
  const parts = macroParts(total, state.data.palette);
  const today = day.date === localISO();
  const note = day.note ? `<aside class="callout info">${esc(day.note)}</aside>` : "";
  const targets = state.data.nutrition.targets.map((item) =>
    `<div class="prop"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`
  ).join("");
  return `${daySelect()}
    <p class="eyebrow">${today ? "Hoy · " : ""}${esc(longDate(day.date))}</p>
    <div class="section-head"><h2 id="panel-title">Entreno · ${esc(day.focus)}</h2></div>
    ${sessionsHtml(day.sessions)}
    ${note}
    <div class="section-head"><h2>Agenda</h2></div>
    ${agendaHtml(day, menu)}
    <div class="section-head"><h2>Menú, macros y suplementos</h2></div>
    ${mealsHtml(menu.meals)}
    <section class="card">
      <h2>Reparto de energía del día</h2>
      <div class="kcal-num">${num(total.kcal)}<span>kcal en las comidas</span></div>
      <div class="chips">
        <span class="chip">${num(total.p)} g proteína</span>
        <span class="chip">${num(total.c)} g hidratos</span>
        <span class="chip">${num(total.g)} g grasa</span>
      </div>
      <div class="donut-row">
        ${donutSvg(parts, num(total.kcal))}
        ${legendHtml(parts)}
      </div>
    </section>
    <section class="card">
      <h2>Objetivos diarios</h2>
      <div class="props">${targets}</div>
    </section>
    <p class="note">${esc(state.data.nutrition.macrosNote)}</p>`;
}

function eventClass(event) {
  if (event.flag) return "class";
  if (event.free) return "work";
  return "train";
}

function renderCalendar() {
  const { week, days, events } = state.data;
  const start = week.calendarStartHour;
  const end = week.calendarEndHour;
  const span = end - start;
  const today = localISO();
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const times = [];
  for (let hour = start; hour < end; hour += 1) {
    times.push(`<div class="cal-time">${hour}:00</div>`);
  }
  const columns = days.map((day) => {
    const blocks = events.filter((event) => event.date === day.date).map((event) => {
      const a = Math.max(event.start, start);
      const b = Math.min(event.end, end);
      const top = ((a - start) / span) * 100;
      const height = ((b - a) / span) * 100;
      return `<div class="cal-event ${eventClass(event)}" style="top:${top}%;height:${height}%" title="${esc(event.title)}"><span>${esc(event.title)}</span></div>`;
    }).join("");
    let nowLine = "";
    if (day.date === today && nowHour >= start && nowHour <= end) {
      nowLine = `<div class="now-line" style="top:${((nowHour - start) / span) * 100}%"></div>`;
    }
    const classes = [
      "cal-day",
      day.date === today ? "is-today" : "",
      day.id === state.dayId ? "is-selected" : "",
    ].filter(Boolean).join(" ");
    return `<div class="${classes}">
      <button type="button" class="cal-day-h" data-day="${esc(day.id)}">${esc(day.label)}</button>
      <div class="cal-track">${nowLine}${blocks}</div>
    </div>`;
  }).join("");
  return `<div class="cal-scroll">
    <div class="cal" style="--span:${span}">
      <div class="cal-times"><div class="cal-corner"></div>${times.join("")}</div>
      ${columns}
    </div>
  </div>
  <div class="cal-key">
    <span><i class="work"></i>Trabajo</span>
    <span><i class="class"></i>Clase</span>
    <span><i class="train"></i>Entreno</span>
  </div>`;
}

function renderSemana() {
  const hours = Object.fromEntries(state.data.distribution.byDay.map((row) => [row.id, row.display]));
  const cards = state.data.days.map((day) => {
    const menu = menuOf(day);
    const on = day.id === state.dayId ? " is-on" : "";
    const items = day.sessions.map((session) =>
      `<li><span class="tag" style="--tag:${TAG[session.tag] || "#FC4C02"}">${esc(session.tag)}</span> ${esc(session.title)}</li>`
    ).join("");
    return `<button type="button" class="day-card${on}" data-day="${esc(day.id)}" data-goto="hoy">
      <header>
        <strong>${esc(day.label)}</strong>
        <span class="hours-pill">${esc(hours[day.id] || "")}</span>
      </header>
      <p class="meta">${esc(day.focus)}</p>
      <p class="meta">Trabajo: ${esc(day.work)}</p>
      <p class="meta">Clases: ${esc(day.classes)}</p>
      <p class="meta">Menú: ${esc(menu.name)}</p>
      <ul>${items}</ul>
    </button>`;
  }).join("");
  return `${daySelect()}
    <div class="section-head">
      <h2 id="panel-title">Calendario de la semana</h2>
    </div>
    <p class="caption">${esc(state.data.week.calendarCaption)}</p>
    <section class="card">${renderCalendar()}</section>
    <div class="section-head"><h2>Días</h2></div>
    <div class="day-cards">${cards}</div>`;
}

function chartTicks(floor, ceiling, withZero) {
  const ticks = new Set([ceiling, floor]);
  if (withZero && floor < 0 && ceiling > 0) ticks.add(0);
  else ticks.add((ceiling + floor) / 2);
  return [...ticks].sort((a, b) => b - a);
}

function lineChart(points, series, floor, ceiling, hoy, options) {
  const W = 360;
  const H = 214;
  const pad = { l: 36, r: 12, t: 18, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = points.length;
  const x = (index) => pad.l + (n <= 1 ? iw / 2 : (index / (n - 1)) * iw);
  const y = (value) => {
    const clamped = Math.min(ceiling, Math.max(floor, value));
    return pad.t + ((ceiling - clamped) / (ceiling - floor)) * ih;
  };
  const grids = chartTicks(floor, ceiling, options.zeroLabel).map((tick) => {
    const yy = y(tick).toFixed(1);
    return `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="rgba(255,255,255,.08)"/>
      <text x="${pad.l - 6}" y="${Number(yy) + 3}" text-anchor="end" fill="#8b95a7" font-size="10">${esc(num(tick))}</text>`;
  }).join("");
  const lines = series.map((item) => {
    const d = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point[item.key]).toFixed(1)}`).join("");
    return `<path d="${d}" fill="none" stroke="${item.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(hoy).toFixed(1)}" cy="${y(points[hoy][item.key]).toFixed(1)}" r="3.6" fill="${item.color}" stroke="#0c0e12" stroke-width="1.5"/>`;
  }).join("");
  const labels = points.map((point, index) => {
    if (!point.label) return "";
    return `<text x="${x(index).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="#8b95a7" font-size="10">${esc(point.label)}</text>`;
  }).join("");
  const hx = x(hoy);
  const hoyLabel = `<line x1="${hx.toFixed(1)}" y1="${pad.t}" x2="${hx.toFixed(1)}" y2="${(pad.t + ih).toFixed(1)}" stroke="#FC4C02" stroke-dasharray="3 3"/>
    <text x="${Math.max(pad.l + 14, Math.min(hx, W - pad.r - 12)).toFixed(1)}" y="12" text-anchor="middle" fill="#FC4C02" font-size="10" font-weight="700">${esc(options.hoyLabel || "hoy")}</text>`;
  let zero = "";
  if (options.zeroLabel && floor < 0 && ceiling > 0) {
    const zy = y(0);
    zero = `<line x1="${pad.l}" y1="${zy.toFixed(1)}" x2="${W - pad.r}" y2="${zy.toFixed(1)}" stroke="rgba(255,255,255,.55)" stroke-dasharray="4 3"/>
      <text x="${W - pad.r}" y="${(zy - 5).toFixed(1)}" text-anchor="end" fill="#d5dbe6" font-size="10">${esc(options.zeroLabel)}</text>`;
  }
  const table = `<table class="sr-only"><caption>${esc(options.aria || "Gráfico")}</caption><thead><tr><th>Fecha</th>${series.map((item) => `<th>${esc(item.label)}</th>`).join("")}</tr></thead><tbody>
    ${points.map((point) => `<tr><td>${esc(point.date)}</td>${series.map((item) => `<td>${esc(num(point[item.key]))}</td>`).join("")}</tr>`).join("")}
  </tbody></table>`;
  return `<div class="chart">${table}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(options.aria || "Gráfico")}">${grids}${zero}${lines}${hoyLabel}${labels}</svg></div>`;
}

function stackedColumns(labels, series) {
  const W = 360;
  const H = 236;
  const pad = { l: 32, r: 8, t: 22, b: 40 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const totals = labels.map((_, index) => series.reduce((sum, item) => sum + item.values[index], 0));
  const yMax = Math.max(1, Math.ceil(Math.max(...totals)));
  const slot = iw / labels.length;
  const bw = Math.min(46, slot * 0.52);
  let shapes = "";
  labels.forEach((label, index) => {
    let acc = 0;
    const x = pad.l + slot * index + (slot - bw) / 2;
    series.forEach((item) => {
      const value = item.values[index];
      if (!value) return;
      const gap = acc > 0 ? 1.5 : 0;
      const h = Math.max(0, (value / yMax) * ih - gap);
      const y = pad.t + ih - ((acc + value) / yMax) * ih;
      acc += value;
      shapes += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${SPORT[item.name] || "#FC4C02"}"/>`;
    });
    shapes += `<text x="${(x + bw / 2).toFixed(1)}" y="${(pad.t + ih - (acc / yMax) * ih - 6).toFixed(1)}" text-anchor="middle" fill="#e8edf4" font-size="11" font-weight="700">${esc(num(totals[index]))}</text>`;
    const lines = label.includes(" (") ? [label.slice(0, label.indexOf(" (")), label.slice(label.indexOf(" (") + 1)] : [label];
    lines.forEach((line, lineIndex) => {
      shapes += `<text x="${(pad.l + slot * index + slot / 2).toFixed(1)}" y="${(H - 22 + lineIndex * 12).toFixed(1)}" text-anchor="middle" fill="#8b95a7" font-size="10">${esc(line)}</text>`;
    });
  });
  const axis = [0, yMax].map((tick) => {
    const yy = (pad.t + ih - (tick / yMax) * ih).toFixed(1);
    return `<text x="${pad.l - 6}" y="${Number(yy) + 3}" text-anchor="end" fill="#8b95a7" font-size="10">${tick}</text>`;
  }).join("");
  const legend = `<div class="chart-legend">${series.map((item) =>
    `<span><i style="background:${SPORT[item.name]}"></i>${esc(item.name)}</span>`
  ).join("")}</div>`;
  const table = `<table class="sr-only"><caption>Horas por semana y deporte</caption><thead><tr><th>Semana</th>${series.map((item) => `<th>${esc(item.name)}</th>`).join("")}</tr></thead><tbody>
    ${labels.map((label, index) => `<tr><td>${esc(label)}</td>${series.map((item) => `<td>${esc(num(item.values[index]))}</td>`).join("")}</tr>`).join("")}
  </tbody></table>`;
  return `${table}<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Horas por semana y deporte">${axis}${shapes}<text x="4" y="14" fill="#8b95a7" font-size="10">h</text></svg></div>${legend}`;
}

function disciplineBars(rows) {
  const max = Math.max(...rows.map((row) => row.hours), 0.01);
  return rows.map((row) => {
    const pct = Math.max(2, Math.round((row.hours / max) * 100));
    return `<div class="hbar${row.emphasis ? " is-em" : ""}">
      <div class="hbar-top"><span>${esc(row.label)}</span><strong>${esc(row.display)}</strong></div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${SPORT[row.label] || "#FC4C02"}"></div></div>
    </div>`;
  }).join("");
}

function dayColumns(rows) {
  const max = Math.max(...rows.map((row) => row.hours), 0.01);
  return `<div class="cols">${rows.map((row) => {
    const pct = Math.max(4, Math.round((row.hours / max) * 100));
    return `<div class="col${row.emphasis ? " is-em" : ""}">
      <span class="col-val">${esc(row.display)}</span>
      <div class="col-track"><div class="col-fill" style="--h:${pct}%"></div></div>
      <span class="col-lab">${esc(row.label)}</span>
    </div>`;
  }).join("")}</div>`;
}

function renderProgreso() {
  const { athlete, load, goals, palette, weeklyHours, distribution, records } = state.data;
  const hoy = markerIndex(state.data);
  const point = load.points[hoy];
  const bits = [
    athlete.name,
    athlete.age ? `${athlete.age} años` : "",
    athlete.heightM ? `${num(athlete.heightM)} m` : "",
    athlete.level || "",
  ].filter(Boolean);
  const metrics = athlete.metrics.map((metric) =>
    `<article class="metric${metric.tone === "success" ? " success" : ""}">
      <div class="value">${esc(metric.value)}</div>
      <div class="label">${esc(metric.label)}</div>
      ${metric.detail ? `<div class="detail">${esc(metric.detail)}</div>` : ""}
    </article>`
  ).join("");
  const pending = athlete.pending.map((item) =>
    `<div class="prop"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`
  ).join("");
  const fitness = lineChart(
    load.points,
    [
      { key: "ctl", label: load.fitness.label, color: "#2D7FF9" },
      { key: "atl", label: load.fatigue.label, color: "#FC4C02" },
    ],
    load.fitness.floor,
    load.fitness.ceiling,
    hoy,
    { hoyLabel: load.hoyLabel, aria: "Condición física y fatiga" }
  );
  const form = lineChart(
    load.points,
    [{ key: "tsb", label: load.form.label, color: "#A855F7" }],
    load.form.floor,
    load.form.ceiling,
    hoy,
    { hoyLabel: load.hoyLabel, zeroLabel: load.zeroLabel, aria: "Forma, condición menos fatiga" }
  );
  const goalBars = goals.map((goal) => {
    const pct = goalPct(goal);
    const color = palette[goal.color] || palette[0];
    return `<div class="goal">
      <div class="goal-top"><span>${esc(goal.name)}</span><span>${esc(goal.nowLabel)} de ${esc(goal.targetLabel)} · ${pct}%</span></div>
      <div class="track" role="img" aria-label="${esc(goal.name)} ${pct}%"><div class="fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }).join("");
  const recordList = records.map((record) =>
    `<li class="record">
      <div><strong>${esc(record.title)}</strong><p>${esc(record.detail)}</p></div>
      <span class="badge ${record.tone === "success" ? "success" : "neutral"}">${esc(record.badge)}</span>
    </li>`
  ).join("");
  return `<p class="profile">${esc(bits.join(" · "))}</p>
    <p class="lede">${esc(athlete.asOf)}</p>
    <div class="section-head"><h2 id="panel-title">Atleta</h2></div>
    <section class="card">
      <div class="metrics">${metrics}</div>
      <div class="props">${pending}</div>
    </section>
    <div class="section-head"><h2>Estado de entreno y condición física</h2></div>
    <p class="caption">${esc(load.caption)}</p>
    <div class="grid-2">
      <section class="card">
        <h2>Condición física y fatiga</h2>
        ${fitness}
        <div class="chart-legend">
          <span><i style="background:#2D7FF9"></i>${esc(load.fitness.label)}</span>
          <span><i style="background:#FC4C02"></i>${esc(load.fatigue.label)}</span>
        </div>
      </section>
      <section class="card">
        <h2>Forma (condición menos fatiga)</h2>
        ${form}
        <div class="chart-legend"><span><i style="background:#A855F7"></i>${esc(load.form.label)}</span></div>
      </section>
    </div>
    <p class="note">Marcador «${esc(load.hoyLabel)}» (${esc(shortDate(point.date))}): condición física ${num(point.ctl)} · fatiga ${num(point.atl)} · forma ${num(point.tsb)}.</p>
    <p class="note">${esc(load.formNote)}</p>
    <div class="section-head"><h2>Hacia tus objetivos</h2></div>
    <section class="card">${goalBars}</section>
    <div class="section-head"><h2>Horas por semana y deporte</h2></div>
    <section class="card">${stackedColumns(weeklyHours.labels, weeklyHours.series)}</section>
    <div class="grid-2">
      <section class="card">
        <h2>Por disciplina</h2>
        ${disciplineBars(distribution.byDiscipline)}
      </section>
      <section class="card">
        <h2>Por día</h2>
        ${dayColumns(distribution.byDay)}
      </section>
    </div>
    <aside class="callout warn"><strong>${esc(distribution.warning.title)}</strong> ${esc(distribution.warning.text)}</aside>
    <div class="section-head"><h2>Mejores marcas recientes</h2></div>
    <ul class="records">${recordList}</ul>`;
}

function renderNutricion() {
  const { nutrition, menus } = state.data;
  const groups = [];
  nutrition.supplements.forEach((item) => {
    const last = groups[groups.length - 1];
    if (!last || last.moment !== item.moment) groups.push({ moment: item.moment, items: [item] });
    else last.items.push(item);
  });
  const moments = groups.map((group) => `<li class="moment">
    <h3>${esc(group.moment)}</h3>
    ${group.items.map((item) => `<p class="dose"><strong>${esc(item.name)}</strong> · ${esc(item.dose)}</p><p class="why">${esc(item.why)}</p>`).join("")}
  </li>`).join("");
  const menuCards = Object.entries(menus).map(([, menu]) => {
    const total = totals(menu.meals);
    const lines = menu.meals.map((meal) =>
      `<div class="menu-line"><strong>${esc(meal.time)} · ${esc(meal.name)}</strong><br>${esc(meal.food)}<br>${num(meal.kcal)} kcal · ${num(meal.p)} g prot. · ${num(meal.c)} g hidr. · ${num(meal.g)} g grasa${meal.supp && meal.supp !== "—" ? ` · ${esc(meal.supp)}` : ""}</div>`
    ).join("");
    return `<article class="menu-block">
      <h3>${esc(menu.name)}</h3>
      <p class="why">${num(total.kcal)} kcal · ${num(total.p)} g prot. · ${num(total.c)} g hidr. · ${num(total.g)} g grasa</p>
      ${lines}
    </article>`;
  }).join("");
  const targets = nutrition.targets.map((item) =>
    `<div class="prop"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`
  ).join("");
  return `<div class="section-head"><h2 id="panel-title">Nutrición y suplementos</h2></div>
    <p class="lede">Suplementación por momento del día y las cuatro plantillas de menú de esta semana.</p>
    <div class="section-head"><h2>Suplementación diaria</h2></div>
    <ul class="moments">${moments}</ul>
    <p class="note">${esc(nutrition.supplementNote)}</p>
    <div class="section-head"><h2>Menús tipo</h2></div>
    <div class="stack">${menuCards}</div>
    <section class="card">
      <h2>Objetivos diarios</h2>
      <div class="props">${targets}</div>
    </section>
    <p class="note">${esc(nutrition.macrosNote)}</p>`;
}

function renderNotas() {
  const { phase, week, risks, nextSteps } = state.data;
  const pct = phase.daysTotal ? Math.max(0, Math.min(100, Math.round((phase.dayNumber / phase.daysTotal) * 100))) : 0;
  const riskList = risks.map((risk) => {
    const tone = risk.tone === "danger" ? "danger" : risk.tone === "warning" ? "warn" : "neutral";
    const badge = risk.badge ? `<span class="badge ${tone === "warn" ? "warn" : tone === "danger" ? "danger" : "neutral"}">${esc(risk.badge)}</span>` : "";
    return `<li class="risk ${tone}"><div class="risk-top"><h3>${esc(risk.title)}</h3>${badge}</div><p>${esc(risk.detail)}</p></li>`;
  }).join("");
  const steps = nextSteps.map((step, index) =>
    `<li class="step"><span class="step-n">${index + 1}</span><div><h3>${esc(step.title)}</h3><p>${esc(step.detail)}</p></div></li>`
  ).join("");
  return `<div class="section-head"><h2 id="panel-title">${esc(phase.name)}</h2></div>
    <p class="lede">${esc(week.summary)}</p>
    <section class="card phase-card">
      <p class="eyebrow">${esc(phase.fullName)}</p>
      <p class="range">${esc(phase.startLabel)}–${esc(phase.endLabel)}</p>
      <p class="week-of">Semana ${esc(phase.weekNumber)} de ${esc(phase.weeksTotal)} · día ${esc(phase.dayNumber)} de ${esc(phase.daysTotal)}</p>
      <div class="track" role="img" aria-label="Avance de la fase ${pct}%"><div class="fill" style="width:${pct}%;background:#A855F7"></div></div>
    </section>
    <div class="section-head"><h2>Puntos de atención</h2></div>
    <ul class="risks">${riskList}</ul>
    <div class="section-head"><h2>Próximos pasos</h2></div>
    <ol class="steps">${steps}</ol>
    <p class="note install-hint">Para dejarlo en la pantalla de inicio del móvil: en iPhone, Compartir y luego «Añadir a pantalla de inicio»; en Android, el menú del navegador y «Instalar app» o «Añadir a pantalla de inicio».</p>`;
}

function renderPanel() {
  if (state.tab === "semana") return renderSemana();
  if (state.tab === "progreso") return renderProgreso();
  if (state.tab === "nutricion") return renderNutricion();
  if (state.tab === "notas") return renderNotas();
  return renderHoy();
}

function render() {
  const root = document.querySelector("#app");
  try {
    const { week, phase } = state.data;
    document.title = `Plan de Alex · ${week.label}`;
    const tabs = TABS.map((tab) => {
      const on = tab.id === state.tab;
      const sub = tab.sub ? `<span class="sub">${esc(tab.sub)}</span>` : "";
      return `<button type="button" class="tab${on ? " is-active" : ""}" data-tab="${tab.id}" role="tab" aria-selected="${on}" aria-label="${esc(tab.aria || tab.label)}">
        ${icon(tab.icon)}
        <span class="tab-label">${esc(tab.label)}${sub}</span>
      </button>`;
    }).join("");
    root.innerHTML = `<header class="top"><div class="top-inner">
        <p class="brand"><span class="logo" aria-hidden="true">A</span> Plan de Alex</p>
        <h1>${esc(week.label)}</h1>
        <p class="phase-pill"><i></i>${esc(phase.name)} · ${esc(phase.startLabel)}–${esc(phase.endLabel)}</p>
      </div></header>
      <nav class="tabbar" aria-label="Secciones">${tabs}</nav>
      <main class="main" id="contenido" role="tabpanel">${renderPanel()}</main>`;
    syncHash();
  } catch (err) {
    root.innerHTML = `<p class="error">No se ha podido mostrar el plan. Revisa data/semana-actual.json.</p><pre class="error-detail">${esc(err.message)}</pre>`;
    console.error(err);
  }
}

async function boot() {
  const root = document.querySelector("#app");
  try {
    const response = await fetch("./data/semana-actual.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.dayId = pickDay(state.data);
    readHash();
    render();
  } catch (err) {
    root.innerHTML = `<p class="error">No se ha podido cargar el plan.</p><pre class="error-detail">${esc(err.message)}</pre>`;
    console.error(err);
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).catch(() => {});
  }
}

document.addEventListener("click", (event) => {
  if (!state.data) return;
  const tab = event.target.closest("[data-tab]");
  if (tab && TABS.some((item) => item.id === tab.dataset.tab)) {
    state.tab = tab.dataset.tab;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const day = event.target.closest("[data-day]");
  if (day && state.data.days.some((item) => item.id === day.dataset.day)) {
    state.dayId = day.dataset.day;
    if (day.dataset.goto && TABS.some((item) => item.id === day.dataset.goto)) state.tab = day.dataset.goto;
    render();
    window.scrollTo(0, 0);
  }
});

window.addEventListener("hashchange", () => {
  if (!state.data) return;
  readHash();
  render();
});

boot();
