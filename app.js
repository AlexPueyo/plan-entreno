/* Plan de Alex. The screen only reads data/semana-actual.json. */

const state = { data: null, tab: "inicio", dayId: null };
const CHECKS = "plan-alex-checks";

const TABS = [
  { id: "inicio", label: "Inicio", icon: "inicio" },
  { id: "hoy", label: "Hoy", icon: "hoy" },
  { id: "semana", label: "Semana", icon: "semana" },
  { id: "progreso", label: "Progreso", icon: "progreso" },
  { id: "nutricion", label: "Nutrición", aria: "Nutrición y suplementos", icon: "nutricion" },
  { id: "notas", label: "Notas", icon: "notas" },
];

const SPORT_COLOR = {
  Bici: "var(--bici)",
  Carrera: "var(--carrera)",
  Natación: "var(--natacion)",
  Fuerza: "var(--fuerza)",
};

const SPORT_LABEL = {
  bici: "Bici",
  carrera: "Carrera",
  natacion: "Natación",
  fuerza: "Fuerza",
  descanso: "Descanso",
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const sign = n < 0 ? "-" : "";
  return sign + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
    weekday: "long", day: "numeric", month: "long",
  }).format(new Date(`${iso}T12:00:00`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function clock(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function parseClock(value) {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function icon(name) {
  const attrs = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const paths = {
    inicio: '<path d="M4 11.2 12 4l8 7.2"/><path d="M7 10.2V20h10V10.2"/>',
    hoy: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3.5V6.5M16 3.5V6.5"/>',
    semana: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 14h2M12 14h2M16 14h2"/>',
    progreso: '<path d="M4 16.5 8.5 12l3 3L20 6.5"/>',
    nutricion: '<path d="M12 20.5s-6.2-4-6.2-9a3.5 3.5 0 0 1 6.2-2 3.5 3.5 0 0 1 6.2 2c0 5-6.2 9-6.2 9z"/>',
    notas: '<path d="M7 3.5h7.2L19 8.2V20H7z"/><path d="M14 3.6V8.5H19M8 13h8M8 17h5"/>',
  };
  return `<svg ${attrs}>${paths[name]}</svg>`;
}

function checks() {
  try {
    return JSON.parse(localStorage.getItem(CHECKS) || "{}");
  } catch (err) {
    return {};
  }
}

function toggleCheck(id) {
  const all = checks();
  if (all[id]) delete all[id];
  else all[id] = true;
  localStorage.setItem(CHECKS, JSON.stringify(all));
}

function checkKey(session, item) {
  return `${state.data.week.start}:${session.id}:${item.id}`;
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

function realToday() {
  return state.data.days.find((day) => day.date === localISO()) || state.data.days[0];
}

function menuOf(day) {
  return state.data.menus[day.menu];
}

function totals(meals) {
  return meals.reduce((sum, meal) => ({
    kcal: sum.kcal + meal.kcal,
    p: sum.p + meal.p,
    c: sum.c + meal.c,
    g: sum.g + meal.g,
  }), { kcal: 0, p: 0, c: 0, g: 0 });
}

function goalPct(goal) {
  if (!goal.target) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.now / goal.target) * 100)));
}

function markerIndex(data) {
  const index = data.load.points.findIndex((point) => point.date === localISO());
  return index >= 0 ? index : data.load.hoyIndex;
}

function weekProgress() {
  const tally = { minutosPlan: 0, minutosHechos: 0, sesionesPlan: 0, sesionesHechas: 0 };
  state.data.days.forEach((day) => {
    day.sessions.forEach((session) => {
      if (!session.cuentaEnPlan) return;
      tally.sesionesPlan += 1;
      tally.minutosPlan += session.duracionMin || 0;
      if (session.completado) {
        tally.sesionesHechas += 1;
        tally.minutosHechos += session.duracionMin || 0;
      }
    });
  });
  return tally;
}

function sessionTotal(session) {
  const bits = [];
  if (session.duracion) bits.push(session.duracion);
  if (session.distancia) bits.push(session.distancia);
  if (session.metros) bits.push(`${num(session.metros)} m`);
  if (session.largos) bits.push(`${num(session.largos)} largos`);
  return bits.join(" · ");
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
      <span class="dow">${esc(dow)}</span><span class="dom">${esc(dom || "")}</span>${hoy}
    </button>`;
  }).join("");
  return `<div class="day-select" role="group" aria-label="Día de la semana">${chips}</div>`;
}

function ring(percent) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, percent)) * c;
  return `<svg class="ring" viewBox="0 0 84 84" role="img" aria-label="${Math.round(percent * 100)}% de las horas">
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--line)" stroke-width="4"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" transform="rotate(-90 42 42)"/>
    <text x="42" y="46" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="700">${Math.round(percent * 100)}%</text>
  </svg>`;
}

function dec(value) {
  return Number(value).toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

function parseLoose(text) {
  return [...String(text).matchAll(/\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?/g)].map((match) =>
    Number(match[0].replace(/\./g, "").replace(",", "."))
  );
}

function phaseHeading(phase) {
  const match = String(phase.name).match(/^(Fase\s+\d+)\s+(.+)$/i);
  if (!match) return phase.name;
  const rest = match[2].charAt(0).toUpperCase() + match[2].slice(1);
  return `${match[1]} · ${rest}`;
}

function phaseDayNumber(dateIso) {
  const start = new Date(`${state.data.phase.start}T12:00:00`);
  const date = new Date(`${dateIso}T12:00:00`);
  const day = Math.round((date - start) / 86400000) + 1;
  return Math.min(state.data.phase.daysTotal, Math.max(1, day));
}

function formatHour(value) {
  const hours = Math.floor(value);
  const mins = Math.round((value - hours) * 60) % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

function shortSpan(start, end) {
  const part = (value) => (Number.isInteger(value) ? String(value) : formatHour(value));
  return `${part(start)}–${part(end)}`;
}

function loadIndex(dateIso) {
  const index = state.data.load.points.findIndex((point) => point.date === dateIso);
  return index >= 0 ? index : state.data.load.hoyIndex;
}

function trendOf(points, key, index) {
  if (index <= 0) return "flat";
  const delta = points[index][key] - points[index - 1][key];
  if (delta > 0.05) return "up";
  if (delta < -0.05) return "down";
  return "flat";
}

function spark(points, key, index) {
  const w = 84;
  const h = 28;
  const pad = 3;
  const vals = points.map((point) => point[key]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => pad + (i / (vals.length - 1)) * (w - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(index).toFixed(1)}" cy="${y(vals[index]).toFixed(1)}" r="2.2" fill="currentColor"/></svg>`;
}

function blockSummary(session) {
  return (session.bloques || []).map((block) => {
    const qty = block.duracion || block.distancia || "";
    if (block.intensidad?.zona) return `${qty} ${block.intensidad.zona}`.trim();
    if (/calma/i.test(block.nombre)) return `${qty} calma`.trim();
    const short = String(block.nombre || "").toLowerCase();
    if (!qty) return short;
    if (/calentamiento/i.test(block.nombre)) return qty;
    return `${qty} ${short}`.trim();
  }).filter(Boolean).join(" · ");
}

function dayEvents(day) {
  return state.data.events.filter((event) => event.date === day.date);
}

function agendaItems(day) {
  const items = dayEvents(day).map((event) => ({
    sort: event.start,
    kind: event.free ? "trabajo" : event.flag ? "clase" : "entreno",
    time: `${formatHour(event.start)}–${formatHour(event.end)}`,
    title: event.title,
  }));
  let last = 7;
  menuOf(day).meals.forEach((meal) => {
    const mins = parseClock(meal.time);
    const hour = mins == null ? last + 0.35 : mins / 60;
    if (mins != null) last = mins / 60;
    items.push({ sort: hour, kind: "comida", time: meal.time, title: meal.name });
  });
  return items.sort((a, b) => a.sort - b.sort);
}

function dayMark(day) {
  const training = day.sessions.filter((session) => session.cuentaEnPlan);
  if (!training.length) return "rest";
  const done = training.filter((session) => session.completado).length;
  if (done === 0) return "planned";
  if (done === training.length) return "done";
  return "partial";
}

function targetBar(value, min, max) {
  const cap = max || min || 1;
  const width = Math.max(0, Math.min(100, Math.round((value / cap) * 100)));
  return width;
}

function renderInicio() {
  const today = realToday();
  const phase = state.data.phase;
  const estado = state.data.athlete.metrics.find((item) => item.id === "estado");
  const index = loadIndex(today.date);
  const point = state.data.load.points[index];
  const points = state.data.load.points;
  const estimate = /estimaci[oó]n/i.test(state.data.load.caption || "");
  const loads = [
    { key: "ctl", label: "Condición física", short: "CTL", value: point.ctl },
    { key: "atl", label: "Fatiga", short: "ATL", value: point.atl },
    { key: "tsb", label: "Forma", short: "TSB", value: point.tsb },
  ];
  const bodyMetrics = ["peso", "vfc", "fc-reposo"]
    .map((id) => state.data.athlete.metrics.find((item) => item.id === id))
    .filter(Boolean);
  const events = dayEvents(today);
  const work = events.filter((event) => event.free);
  const classes = events.filter((event) => event.flag);
  const rest = dayMark(today) === "rest";
  const chips = [
    ...work.map((event) => `Trabajo ${shortSpan(event.start, event.end)}`),
    ...(classes.length ? classes.map((event) => `Clase ${shortSpan(event.start, event.end)}`) : ["Sin clase"]),
    ...(rest ? ["Descanso"] : []),
  ];
  const agenda = agendaItems(today).map((item) => `<li class="ag ${item.kind}"><span>${esc(item.time)}</span><span>${esc(item.title)}</span></li>`).join("");
  const sessions = today.sessions.map((session) => `<button type="button" class="card" data-day="${esc(today.id)}" data-goto="hoy">
      <div class="session-top">
        <span class="sport-line"><i class="dot ${esc(session.deporte)}"></i>${esc(SPORT_LABEL[session.deporte] || session.title)}</span>
        <span class="tag${session.completado ? " done" : ""}">${session.completado ? "COMPLETADO" : esc(session.tag)}</span>
      </div>
      <h3>${esc(session.title)}</h3>
      <p class="total">${esc(session.duracion || sessionTotal(session))}${session.objetivo ? ` · ${esc(session.objetivo)}` : ""}</p>
      <p class="summary">${esc(blockSummary(session))}</p>
    </button>`).join("");
  const menu = menuOf(today);
  const total = totals(menu.meals);
  const energyText = state.data.nutrition.targets.find((item) => item.label === "Energía")?.value || "";
  const proteinText = state.data.nutrition.targets.find((item) => item.label === "Proteína")?.value || "";
  const energyNums = parseLoose(energyText);
  const proteinNums = parseLoose(proteinText);
  const energyMax = today.id === "sab" && energyNums.length >= 3 ? energyNums[energyNums.length - 1] : energyNums[1] || energyNums[0] || 1;
  const energyLabel = today.id === "sab" && energyNums.length >= 3
    ? `${num(energyNums[energyNums.length - 1])} kcal`
    : energyNums.length >= 2 ? `${num(energyNums[0])}–${num(energyNums[1])} kcal` : energyText;
  const proteinMax = proteinNums[1] || proteinNums[0] || 1;
  const proteinLabel = proteinNums.length >= 2 ? `${num(proteinNums[0])}–${num(proteinNums[1])} g` : proteinText;
  const meals = menu.meals.map((meal) => `<li class="meal-row">
      <span class="meal-time">${esc(meal.time)}</span>
      <span>
        <strong>${esc(meal.name)}</strong>
        <span class="meal-food">${esc(meal.food)}</span>
        <span class="macros">${num(meal.kcal)} kcal · ${num(meal.p)} P · ${num(meal.c)} C · ${num(meal.g)} G</span>
        ${meal.supp && meal.supp !== "—" ? `<span class="pill">${esc(meal.supp)}</span>` : ""}
      </span>
    </li>`).join("");
  const progress = weekProgress();
  const letters = { lun: "L", mar: "M", mie: "X", jue: "J", vie: "V", sab: "S", dom: "D" };
  const dots = state.data.days.map((day) => {
    const mark = dayMark(day);
    const current = day.id === today.id ? " is-today" : "";
    return `<div class="daydot ${mark}${current}"><i></i><span>${letters[day.id] || ""}</span></div>`;
  }).join("");
  const arrows = { up: "↑", down: "↓", flat: "→" };

  return `<header class="dash-head">
      <p class="kicker">${esc(longDate(today.date))}</p>
      <h2 id="panel-title">${esc(phaseHeading(phase))}</h2>
      <p class="quiet">día ${phaseDayNumber(today.date)}/${esc(phase.daysTotal)}</p>
      <p class="status">${esc(estado?.value || "")}</p>
    </header>
    <section class="card">
      <div class="session-top">
        <h2>Estado de forma</h2>
        ${estimate ? '<span class="tag">estimación</span>' : ""}
      </div>
      <p class="state-label">${esc(estado?.value || "")}</p>
      <p class="quiet">${esc(estado?.detail || "")}</p>
      <div class="form-grid">
        ${loads.map((item) => {
          const dir = trendOf(points, item.key, index);
          return `<div class="form-metric">
            <span class="label">${esc(item.label)}</span>
            <b>${dec(item.value)} <span class="trend ${dir}" aria-label="${dir}">${arrows[dir]}</span></b>
            <span class="label">${esc(item.short)}</span>
            ${spark(points, item.key, index)}
          </div>`;
        }).join("")}
      </div>
      <div class="form-grid measured">
        ${bodyMetrics.map((item) => `<div class="form-metric"><span class="label">${esc(item.label)}</span><b>${esc(item.value)}</b></div>`).join("")}
      </div>
    </section>
    <div class="section"><h2>Agenda de hoy</h2></div>
    <section class="card">
      <div class="badges">${chips.map((chip) => `<span class="chip">${esc(chip)}</span>`).join("")}</div>
      <ol class="agenda-list">${agenda}</ol>
    </section>
    <div class="section"><h2>Sesiones de hoy</h2></div>
    <div class="stack">${sessions}</div>
    <div class="section"><h2>Comida de hoy</h2></div>
    <section class="card">
      <ol class="meal-list">${meals}</ol>
      <div class="bar-block">
        <div class="hbar-top"><span>Energía</span><strong>${num(total.kcal)} kcal</strong></div>
        <div class="track"><div class="fill" style="width:${targetBar(total.kcal, energyNums[0], energyMax)}%"></div></div>
        <p class="quiet">Objetivo ${esc(energyLabel)}</p>
      </div>
      <div class="bar-block">
        <div class="hbar-top"><span>Proteína</span><strong>${num(total.p)} g</strong></div>
        <div class="track"><div class="fill" style="width:${targetBar(total.p, proteinNums[0], proteinMax)}%"></div></div>
        <p class="quiet">Objetivo ${esc(proteinLabel)}</p>
      </div>
    </section>
    <div class="section"><h2>Semana</h2></div>
    <section class="card">
      <div class="dots">${dots}</div>
      <p class="total">${clock(progress.minutosHechos)} de ${clock(progress.minutosPlan)} h</p>
      <p class="quiet">${progress.sesionesHechas} de ${progress.sesionesPlan} sesiones</p>
    </section>
    <section class="card alert"><p>${esc(state.data.week.alerta)}</p></section>`;
}

function timeline(blocks) {
  if (!blocks.length) return "";
  return `<ol class="timeline">${blocks.map(blockHtml).join("")}</ol>`;
}

function blockHtml(block) {
  const when = block.duracion || block.distancia || "";
  const bits = [];
  if (block.duracion && block.distancia) bits.push(block.distancia);
  if (block.metros && block.distancia && block.distancia.includes("×")) bits.push(`${num(block.metros)} m`);
  if (block.largos) bits.push(block.largos);
  if (block.descanso) bits.push(`desc ${block.descanso}`);
  if (block.intensidad?.zona) bits.push(block.intensidad.zona);
  if (block.intensidad?.fc) bits.push(block.intensidad.fc);
  if (block.intensidad?.texto) bits.push(block.intensidad.texto);
  if (block.descripcion) bits.push(block.descripcion);
  return `<li class="tl"><div class="tl-when">${esc(when)}</div><div><div class="tl-name">${esc(block.nombre)}</div><p>${esc(bits.join(" · "))}</p></div></li>`;
}

function exercisesHtml(session) {
  const saved = checks();
  if (!session.ejercicios?.length) return "";
  return session.ejercicios.map((group) => {
    const label = group.items.length > 1 ? `Superserie ${group.grupo}` : group.grupo;
    const rows = group.items.map((item) => {
      const id = checkKey(session, item);
      const on = Boolean(saved[id]);
      const meta = [`${item.series}×${item.reps}`];
      if (item.descanso) meta.push(`desc ${item.descanso}`);
      if (item.rir) meta.push(`RIR ${item.rir}`);
      if (item.notas) meta.push(item.notas);
      return `<button type="button" class="check" data-check="${esc(id)}" aria-pressed="${on}">
        <span class="box" aria-hidden="true">${on ? "✓" : ""}</span>
        <span><span class="ex-name"><span class="ex-id">${esc(item.id)}</span>${esc(item.nombre)}</span><span class="ex-meta">${esc(meta.join(" · "))}</span></span>
      </button>`;
    }).join("");
    return `<div class="ex-group"><h3>${esc(label)}</h3>${rows}</div>`;
  }).join("");
}

function kitHtml(items) {
  if (!items?.length) return "";
  return `<div class="callout"><strong>Llevar</strong><div class="chips">${items.map((item) => `<span class="chip">${esc(item)}</span>`).join("")}</div></div>`;
}

function sessionHtml(session, dayKit) {
  const pool = session.deporte === "natacion" && state.data.week.piscinaM
    ? `<p class="quiet">Piscina de ${esc(state.data.week.piscinaM)} m.</p>`
    : "";
  const note = session.nota ? `<p class="callout">${esc(session.nota)}</p>` : "";
  const fuel = session.nutricion_durante ? `<div class="callout"><strong>Durante</strong><p>${esc(session.nutricion_durante)}</p></div>` : "";
  const ownKit = session.llevar?.length ? session.llevar : [];
  return `<article class="card">
    <div class="session-top">
      <span class="sport-line"><i class="dot ${esc(session.deporte)}"></i>${esc(session.hora || SPORT_LABEL[session.deporte] || session.deporte)}</span>
      <span class="tag${session.completado ? " done" : ""}">${esc(session.tag)}</span>
    </div>
    <h3>${esc(session.title)}</h3>
    <p class="total">${esc(sessionTotal(session))}</p>
    ${session.objetivo ? `<p class="objetivo">${esc(session.objetivo)}</p>` : ""}
    ${pool}
    ${note}
    ${timeline((session.bloques || []).filter((block) => block.fase !== "despues"))}
    ${exercisesHtml(session)}
    ${timeline((session.bloques || []).filter((block) => block.fase === "despues"))}
    ${kitHtml(ownKit.length ? ownKit : dayKit)}
    ${fuel}
  </article>`;
}

function renderHoy() {
  const day = currentDay();
  const menu = menuOf(day);
  const total = totals(menu.meals);
  const parts = [
    { label: "Hidratos", grams: total.c, kcal: total.c * 4, color: "var(--accent)" },
    { label: "Proteína", grams: total.p, kcal: total.p * 4, color: "var(--bici)" },
    { label: "Grasa", grams: total.g, kcal: total.g * 9, color: "var(--natacion)" },
  ];
  const note = day.note ? `<aside class="callout">${esc(day.note)}</aside>` : "";
  const targets = state.data.nutrition.targets.map((item) => `<div class="prop"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`).join("");
  const sharedKit = day.llevar?.length && day.sessions.every((session) => !session.llevar?.length) ? day.llevar : [];
  return `${daySelect()}
    <p class="kicker">${day.date === localISO() ? "Hoy · " : ""}${esc(longDate(day.date))}</p>
    <div class="section"><h2 id="panel-title">${esc(day.focus)}</h2></div>
    <div class="stack">${day.sessions.map((session) => sessionHtml(session, sharedKit)).join("")}</div>
    ${note}
    <div class="section"><h2>Agenda</h2></div>
    <div class="agenda">
      <div><span>Trabajo</span><strong>${esc(day.work)}</strong></div>
      <div><span>Clases</span><strong>${esc(day.classes)}</strong></div>
      <div><span>Menú</span><strong>${esc(menu.name)}</strong></div>
    </div>
    <div class="section"><h2>Menú, macros y suplementos</h2></div>
    <ol class="meals">${menu.meals.map((meal) => `<li class="card">
      <div class="meal-head"><span class="meal-time">${esc(meal.time)}</span><strong>${esc(meal.name)}</strong></div>
      <p class="meal-food">${esc(meal.food)}</p>
      <div class="chips">
        <span class="chip">${num(meal.kcal)} kcal</span>
        <span class="chip">${num(meal.p)} g prot.</span>
        <span class="chip">${num(meal.c)} g hidr.</span>
        <span class="chip">${num(meal.g)} g grasa</span>
      </div>
      ${meal.supp && meal.supp !== "—" ? `<p class="supp">${esc(meal.supp)}</p>` : ""}
    </li>`).join("")}</ol>
    <section class="card">
      <h2>Reparto del día</h2>
      <p class="kcal">${num(total.kcal)}<span>kcal · ${num(total.p)} g proteína · ${num(total.c)} g hidratos · ${num(total.g)} g grasa</span></p>
      <div class="donut-row">${donutSvg(parts, num(total.kcal))}${legendHtml(parts)}</div>
    </section>
    <section class="card"><h2>Objetivos diarios</h2><div class="props">${targets}</div></section>
    <p class="quiet">${esc(state.data.nutrition.macrosNote)}</p>`;
}

function donutSvg(parts, center) {
  const energy = parts.reduce((sum, part) => sum + part.kcal, 0);
  const r = 46;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = parts.map((part) => {
    const len = energy ? (part.kcal / energy) * c : 0;
    const dash = Math.max(0, len - 2);
    const circle = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${part.color}" stroke-width="10" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 70 70)"/>`;
    offset += len;
    return circle;
  }).join("");
  return `<svg viewBox="0 0 140 140" role="img" aria-label="Reparto del día, ${esc(center)} kcal">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--line)" stroke-width="10"/>
    ${arcs}
    <text x="70" y="68" text-anchor="middle" fill="var(--text)" font-size="16" font-weight="700">${esc(center)}</text>
    <text x="70" y="84" text-anchor="middle" fill="var(--muted)" font-size="10">kcal</text>
  </svg>`;
}

function legendHtml(parts) {
  const energy = parts.reduce((sum, part) => sum + part.kcal, 0);
  return `<div class="legend">${parts.map((part) => {
    const pct = energy ? Math.round((part.kcal / energy) * 100) : 0;
    return `<div><i style="background:${part.color}"></i><span>${esc(part.label)}</span><b>${num(part.grams)} g · ${pct}%</b></div>`;
  }).join("")}</div>`;
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
  for (let hour = start; hour < end; hour += 1) times.push(`<div class="cal-time">${hour}:00</div>`);
  const columns = days.map((day) => {
    const blocks = events.filter((event) => event.date === day.date).map((event) => {
      const top = ((Math.max(event.start, start) - start) / span) * 100;
      const height = ((Math.min(event.end, end) - Math.max(event.start, start)) / span) * 100;
      return `<div class="cal-event ${eventClass(event)}" style="top:${top}%;height:${height}%">${esc(event.title)}</div>`;
    }).join("");
    const nowLine = day.date === today && nowHour >= start && nowHour <= end
      ? `<div class="now-line" style="top:${((nowHour - start) / span) * 100}%"></div>` : "";
    const classes = ["cal-day", day.date === today ? "is-today" : "", day.id === state.dayId ? "is-selected" : ""].filter(Boolean).join(" ");
    return `<div class="${classes}"><button type="button" class="cal-day-h" data-day="${esc(day.id)}">${esc(day.label)}</button><div class="cal-track">${nowLine}${blocks}</div></div>`;
  }).join("");
  return `<div class="cal-scroll"><div class="cal" style="--span:${span}"><div class="cal-times"><div class="cal-corner"></div>${times.join("")}</div>${columns}</div></div>
    <div class="cal-key"><span><i class="work"></i>Trabajo</span><span><i class="class"></i>Clase</span><span><i class="train"></i>Entreno</span></div>`;
}

function renderSemana() {
  const hours = Object.fromEntries(state.data.distribution.byDay.map((row) => [row.id, row.display]));
  const cards = state.data.days.map((day) => `<button type="button" class="day-card${day.id === state.dayId ? " is-on" : ""}" data-day="${esc(day.id)}" data-goto="hoy">
    <header><strong>${esc(day.label)}</strong><span>${esc(hours[day.id] || "")}</span></header>
    <p class="meta">${esc(day.focus)}</p>
    <p class="meta">Trabajo: ${esc(day.work)}</p>
    <p class="meta">Clases: ${esc(day.classes)}</p>
    <ul>${day.sessions.map((session) => `<li><i class="dot ${esc(session.deporte)}"></i><span>${esc(session.title)} · ${esc(session.duracion || "")}${session.objetivo ? ` · ${esc(session.objetivo)}` : ""}</span></li>`).join("")}</ul>
  </button>`).join("");
  return `${daySelect()}
    <div class="section"><h2 id="panel-title">Calendario de la semana</h2></div>
    <p class="quiet">${esc(state.data.week.calendarCaption)}</p>
    <section class="card week-grid">${renderCalendar()}</section>
    <div class="section"><h2>Días</h2></div>
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
  const H = 220;
  const pad = { l: 48, r: 8, t: 22, b: 32 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = points.length;
  const x = (index) => pad.l + (index / (n - 1)) * iw;
  const y = (value) => pad.t + ((ceiling - Math.min(ceiling, Math.max(floor, value))) / (ceiling - floor)) * ih;
  const grids = chartTicks(floor, ceiling, options.zeroLabel).map((tick) => {
    const yy = y(tick);
      return `<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W - pad.r}" y2="${yy.toFixed(1)}" stroke="var(--line)"/>
      <text x="${pad.l - 6}" y="${(yy + 4).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="13">${esc(num(tick))}</text>`;
  }).join("");
  const lines = series.map((item) => {
    const d = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point[item.key]).toFixed(1)}`).join("");
    return `<path d="${d}" fill="none" stroke="${item.color}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(hoy).toFixed(1)}" cy="${y(points[hoy][item.key]).toFixed(1)}" r="2.6" fill="${item.color}"/>`;
  }).join("");
  const labels = points.map((point, index) => {
    if (!point.label) return "";
    const edge = index === 0 ? "start" : index === n - 1 ? "end" : "middle";
    const xx = index === 0 ? pad.l : index === n - 1 ? W - 2 : x(index);
    return `<text x="${xx.toFixed(1)}" y="${H - 8}" text-anchor="${edge}" fill="var(--muted)" font-size="13">${esc(point.label)}</text>`;
  }).join("");
  const hx = x(hoy);
  const marker = `<line x1="${hx.toFixed(1)}" y1="${pad.t}" x2="${hx.toFixed(1)}" y2="${(pad.t + ih).toFixed(1)}" stroke="var(--accent)" stroke-dasharray="2 3"/>
    <text x="${Math.max(pad.l + 16, Math.min(hx, W - 36)).toFixed(1)}" y="14" text-anchor="middle" fill="var(--accent)" font-size="13" font-weight="700">${esc(options.hoyLabel || "hoy")}</text>`;
  const zero = options.zeroLabel && floor < 0 && ceiling > 0
    ? `<line x1="${pad.l}" y1="${y(0).toFixed(1)}" x2="${W - pad.r}" y2="${y(0).toFixed(1)}" stroke="var(--faint)" stroke-dasharray="3 3"/>
      <text x="${W - pad.r}" y="${(y(0) - 6).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="13">${esc(options.zeroLabel)}</text>`
    : "";
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(options.aria || "Gráfico")}">${grids}${zero}${lines}${marker}${labels}</svg></div>`;
}

function stackedColumns(labels, series) {
  const W = 360;
  const H = 250;
  const pad = { l: 8, r: 8, t: 28, b: 46 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const totals = labels.map((_, index) => series.reduce((sum, item) => sum + item.values[index], 0));
  const yMax = Math.max(1, Math.ceil(Math.max(...totals)));
  const slot = iw / labels.length;
  const bw = Math.min(42, slot * 0.46);
  let shapes = "";
  labels.forEach((label, index) => {
    let acc = 0;
    const x = pad.l + slot * index + (slot - bw) / 2;
    series.forEach((item) => {
      const value = item.values[index];
      if (!value) return;
      const h = (value / yMax) * ih;
      const y = pad.t + ih - ((acc + value) / yMax) * ih;
      acc += value;
      shapes += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h - 1).toFixed(1)}" fill="${SPORT_COLOR[item.name] || "var(--accent)"}"/>`;
    });
    shapes += `<text x="${(x + bw / 2).toFixed(1)}" y="${(pad.t + ih - (acc / yMax) * ih - 8).toFixed(1)}" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="700">${esc(Number(totals[index]).toLocaleString("es-ES", { maximumFractionDigits: 2 }))}</text>`;
    const lines = label.includes(" (") ? [label.slice(0, label.indexOf(" (")), label.slice(label.indexOf(" (") + 1)] : [label];
    lines.forEach((line, lineIndex) => {
      shapes += `<text x="${(pad.l + slot * index + slot / 2).toFixed(1)}" y="${(H - 28 + lineIndex * 16).toFixed(1)}" text-anchor="middle" fill="var(--muted)" font-size="13">${esc(line)}</text>`;
    });
  });
  const legend = `<div class="chart-legend">${series.map((item) => `<span><i style="background:${SPORT_COLOR[item.name]}"></i>${esc(item.name)}</span>`).join("")}</div>`;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Horas por semana y deporte">${shapes}</svg></div>${legend}`;
}

function disciplineBars(rows) {
  const max = Math.max(...rows.map((row) => row.hours), 0.01);
  return rows.map((row) => `<div class="hbar"><div class="hbar-top"><span class="sport-line"><i class="dot ${esc(row.label === "Natación" ? "natacion" : row.label.toLowerCase())}"></i>${esc(row.label)}</span><strong>${esc(row.display)}</strong></div><div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(2, Math.round((row.hours / max) * 100))}%;background:${SPORT_COLOR[row.label] || "var(--accent)"}"></div></div></div>`).join("");
}

function dayColumns(rows) {
  const max = Math.max(...rows.map((row) => row.hours), 0.01);
  return `<div class="cols">${rows.map((row) => `<div class="col"><span class="col-val">${esc(row.display)}</span><div class="col-track"><div class="col-fill" style="--h:${row.hours ? Math.max(4, Math.round((row.hours / max) * 100)) : 0}%"></div></div><span class="col-lab">${esc(row.label)}</span></div>`).join("")}</div>`;
}

function renderProgreso() {
  const { athlete, load, goals, weeklyHours, distribution, records } = state.data;
  const hoy = markerIndex(state.data);
  const point = load.points[hoy];
  const bits = [athlete.name, athlete.age ? `${athlete.age} años` : "", athlete.heightM ? `${Number(athlete.heightM).toLocaleString("es-ES", { minimumFractionDigits: 2 })} m` : "", athlete.level || ""].filter(Boolean);
  const metrics = athlete.metrics.map((metric) => `<div class="metric"><div class="value">${esc(metric.value)}</div><div class="label">${esc(metric.label)}</div>${metric.detail ? `<div class="label">${esc(metric.detail)}</div>` : ""}</div>`).join("");
  const pending = athlete.pending.map((item) => `<div class="prop"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`).join("");
  const fitness = lineChart(load.points, [
    { key: "ctl", label: load.fitness.label, color: "var(--bici)" },
    { key: "atl", label: load.fatigue.label, color: "var(--accent)" },
  ], load.fitness.floor, load.fitness.ceiling, hoy, { hoyLabel: load.hoyLabel, aria: "Condición física y fatiga" });
  const form = lineChart(load.points, [
    { key: "tsb", label: load.form.label, color: "var(--fuerza)" },
  ], load.form.floor, load.form.ceiling, hoy, { hoyLabel: load.hoyLabel, zeroLabel: load.zeroLabel, aria: "Forma" });
  const goalBars = goals.map((goal) => `<div class="goal"><div class="goal-top"><span>${esc(goal.name)}</span><span>${esc(goal.nowLabel)} de ${esc(goal.targetLabel)} · ${goalPct(goal)}%</span></div><div class="track"><div class="fill" style="width:${goalPct(goal)}%"></div></div></div>`).join("");
  const recordList = records.map((record) => `<li class="record"><div><strong>${esc(record.title)}</strong><p>${esc(record.detail)}</p></div><span class="badge${record.tone === "success" ? " ok" : ""}">${esc(record.badge)}</span></li>`).join("");
  return `<p class="quiet">${esc(bits.join(" · "))}</p>
    <p class="quiet">${esc(athlete.asOf)}</p>
    <div class="section"><h2 id="panel-title">Atleta</h2></div>
    <section class="card"><div class="metrics">${metrics}</div><div class="props">${pending}</div></section>
    <div class="section"><h2>Estado de entreno y condición física</h2></div>
    <p class="quiet">${esc(load.caption)}</p>
    <div class="grid-2">
      <section class="card"><h2>Condición física y fatiga</h2>${fitness}<div class="chart-legend"><span><i style="background:var(--bici)"></i>${esc(load.fitness.label)}</span><span><i style="background:var(--accent)"></i>${esc(load.fatigue.label)}</span></div></section>
      <section class="card"><h2>Forma</h2>${form}<div class="chart-legend"><span><i style="background:var(--fuerza)"></i>${esc(load.form.label)}</span></div></section>
    </div>
    <p class="quiet">«${esc(load.hoyLabel)}» ${esc(shortDate(point.date))}: condición ${point.ctl.toLocaleString("es-ES")} · fatiga ${point.atl.toLocaleString("es-ES")} · forma ${point.tsb.toLocaleString("es-ES")}.</p>
    <p class="quiet">${esc(load.formNote)}</p>
    <div class="section"><h2>Hacia tus objetivos</h2></div>
    <section class="card">${goalBars}</section>
    <div class="section"><h2>Horas por semana y deporte</h2></div>
    <section class="card">${stackedColumns(weeklyHours.labels, weeklyHours.series)}</section>
    <div class="grid-2">
      <section class="card"><h2>Por disciplina</h2>${disciplineBars(distribution.byDiscipline)}</section>
      <section class="card"><h2>Por día</h2>${dayColumns(distribution.byDay)}</section>
    </div>
    <aside class="card"><strong>${esc(distribution.warning.title)}</strong> <span class="quiet">${esc(distribution.warning.text)}</span></aside>
    <div class="section"><h2>Mejores marcas recientes</h2></div>
    <ul class="list">${recordList}</ul>`;
}

function renderNutricion() {
  const { nutrition, menus } = state.data;
  const groups = [];
  nutrition.supplements.forEach((item) => {
    const last = groups[groups.length - 1];
    if (!last || last.moment !== item.moment) groups.push({ moment: item.moment, items: [item] });
    else last.items.push(item);
  });
  const moments = groups.map((group) => `<li class="moment"><h3>${esc(group.moment)}</h3>${group.items.map((item) => `<p class="dose"><strong>${esc(item.name)}</strong> · ${esc(item.dose)}</p><p class="why">${esc(item.why)}</p>`).join("")}</li>`).join("");
  const menuCards = Object.values(menus).map((menu) => {
    const total = totals(menu.meals);
    const lines = menu.meals.map((meal) => `<div class="menu-line"><strong>${esc(meal.time)} · ${esc(meal.name)}</strong><br>${esc(meal.food)}<br>${num(meal.kcal)} kcal · ${num(meal.p)} g prot. · ${num(meal.c)} g hidr. · ${num(meal.g)} g grasa${meal.supp && meal.supp !== "—" ? ` · ${esc(meal.supp)}` : ""}</div>`).join("");
    return `<article class="menu-block"><h3>${esc(menu.name)}</h3><p class="why">${num(total.kcal)} kcal · ${num(total.p)} g prot.</p>${lines}</article>`;
  }).join("");
  const targets = nutrition.targets.map((item) => `<div class="prop"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`).join("");
  return `<div class="section"><h2 id="panel-title">Nutrición y suplementos</h2></div>
    <div class="section"><h2>Suplementación diaria</h2></div>
    <ul class="list">${moments}</ul>
    <p class="quiet">${esc(nutrition.supplementNote)}</p>
    <div class="section"><h2>Menús tipo</h2></div>
    <div class="stack card">${menuCards}</div>
    <section class="card"><h2>Objetivos diarios</h2><div class="props">${targets}</div></section>
    <p class="quiet">${esc(nutrition.macrosNote)}</p>`;
}

function renderNotas() {
  const { phase, week, risks, nextSteps, zonas } = state.data;
  const pct = phase.daysTotal ? Math.round((phase.dayNumber / phase.daysTotal) * 100) : 0;
    const zoneRows = zonas.tabla.map((row) => `<div class="zone"><b>${esc(row.zona)}</b><span>${esc(row.fc)}</span></div>`).join("");
  const riskList = risks.map((risk) => {
    const tone = risk.tone === "danger" ? "danger" : risk.tone === "warning" ? "warn" : "";
    const badge = risk.badge ? `<span class="badge ${tone}">${esc(risk.badge)}</span>` : "";
    return `<li class="risk"><div class="risk-top"><h3>${esc(risk.title)}</h3>${badge}</div><p>${esc(risk.detail)}</p></li>`;
  }).join("");
  const steps = nextSteps.map((step, index) => `<li class="step"><span class="step-n">${index + 1}</span><div><h3>${esc(step.title)}</h3><p>${esc(step.detail)}</p></div></li>`).join("");
  return `<div class="section"><h2 id="panel-title">${esc(phase.name)}</h2></div>
    <p class="lede">${esc(week.summary)}</p>
    <section class="card">
      <p class="phase-range">${esc(phase.startLabel)}–${esc(phase.endLabel)}</p>
      <p class="quiet">Semana ${esc(phase.weekNumber)} de ${esc(phase.weeksTotal)} · día ${esc(phase.dayNumber)} de ${esc(phase.daysTotal)}</p>
      <div class="track" style="margin-top:12px"><div class="fill" style="width:${pct}%"></div></div>
    </section>
    <div class="section"><h2>Zonas de frecuencia</h2></div>
    <section class="card">
      <p class="quiet">${esc(zonas.nota)}</p>
      <div class="zones">${zoneRows}</div>
    </section>
    <div class="section"><h2>Puntos de atención</h2></div>
    <ul class="list">${riskList}</ul>
    <div class="section"><h2>Próximos pasos</h2></div>
    <ol class="list">${steps}</ol>
    <p class="quiet">Para dejarlo en la pantalla de inicio: en el iPhone, Compartir → Añadir a pantalla de inicio; en Android, el menú del navegador → Instalar app.</p>`;
}

function renderPanel() {
  if (state.tab === "hoy") return renderHoy();
  if (state.tab === "semana") return renderSemana();
  if (state.tab === "progreso") return renderProgreso();
  if (state.tab === "nutricion") return renderNutricion();
  if (state.tab === "notas") return renderNotas();
  return renderInicio();
}

function render(options = {}) {
  const root = document.querySelector("#app");
  const keep = options.keepScroll ? window.scrollY : 0;
  try {
    const { week, phase } = state.data;
    document.title = `Plan de Alex · ${week.label}`;
    const tabs = TABS.map((tab) => {
      const on = tab.id === state.tab;
      return `<button type="button" class="tab${on ? " is-active" : ""}" data-tab="${tab.id}" role="tab" aria-selected="${on}" aria-label="${esc(tab.aria || tab.label)}">${icon(tab.icon)}<span>${esc(tab.label)}</span></button>`;
    }).join("");
    root.innerHTML = `<header class="top"><div class="top-inner">
        <p class="brand"><i></i> Plan de Alex</p>
        <h1>${esc(week.label)}</h1>
        <p class="phase">${esc(phase.name)} · ${esc(phase.startLabel)}–${esc(phase.endLabel)}</p>
      </div></header>
      <nav class="tabbar" aria-label="Secciones">${tabs}</nav>
      <main class="main" id="contenido" role="tabpanel">${renderPanel()}</main>`;
    syncHash();
    const scroller = document.querySelector(".day-select");
    const chip = scroller?.querySelector(".day-chip.is-on");
    if (scroller && chip) scroller.scrollLeft = Math.max(0, chip.offsetLeft - 16);
    if (options.keepScroll) window.scrollTo(0, keep);
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
  const check = event.target.closest("[data-check]");
  if (check) {
    toggleCheck(check.dataset.check);
    render({ keepScroll: true });
    return;
  }
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
