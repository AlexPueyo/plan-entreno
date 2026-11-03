import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../data/semana-actual.json", import.meta.url), "utf8"));
const errors = [];
const fail = (message) => errors.push(message);

if (data.schemaVersion !== 2) fail("schemaVersion debe ser 2");

const dayIds = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
if (data.days.length !== 7) fail("hacen falta 7 días");
data.days.forEach((day, index) => {
  if (day.id !== dayIds[index]) fail(`día inesperado: ${day.id}`);
  if (!data.menus[day.menu]) fail(`menú ${day.menu} no existe`);
  if (!day.sessions?.length) fail(`${day.id} sin sesiones`);
  day.sessions.forEach((session) => {
    for (const key of ["id", "deporte", "tag", "title", "bloques", "ejercicios", "llevar"]) {
      if (session[key] == null) fail(`${day.id} sesión sin ${key}`);
    }
    if (!Array.isArray(session.bloques)) fail(`${session.id} bloques no es lista`);
    session.bloques.forEach((block) => {
      if (!block.nombre) fail(`${session.id} bloque sin nombre`);
    });
    session.ejercicios.forEach((group) => {
      group.items.forEach((item) => {
        for (const key of ["id", "nombre", "series", "reps"]) {
          if (item[key] == null || item[key] === "") fail(`${session.id} ${item.id || "ejercicio"} sin ${key}`);
        }
      });
    });
    if (session.deporte === "natacion") {
      const sum = session.bloques.reduce((total, block) => total + (block.metros || 0), 0);
      if (sum !== session.metros) fail(`${session.id} suma ${sum} m y declara ${session.metros}`);
    }
  });
});

for (const [id, menu] of Object.entries(data.menus)) {
  if (!menu.name || !menu.meals?.length) fail(`menú ${id} incompleto`);
  menu.meals.forEach((meal) => {
    for (const key of ["time", "name", "food", "supp"]) {
      if (meal[key] == null || meal[key] === "") fail(`${id} comida sin ${key}`);
    }
    for (const key of ["kcal", "p", "c", "g"]) {
      if (typeof meal[key] !== "number") fail(`${id} ${meal.name} ${key} no es número`);
    }
  });
}

if (data.load.points.length !== 21) fail("la serie CTL/ATL/TSB debe tener 21 puntos");
if (data.load.hoyIndex < 0 || data.load.hoyIndex >= data.load.points.length) fail("hoyIndex fuera de rango");
const first = new Date(`${data.load.points[0].date}T00:00:00Z`).getTime();
data.load.points.forEach((point, index) => {
  for (const key of ["ctl", "atl", "tsb"]) {
    if (typeof point[key] !== "number") fail(`punto ${index} sin ${key}`);
  }
  const expected = new Date(first + index * 86400000).toISOString().slice(0, 10);
  if (point.date !== expected) fail(`fecha ${point.date} != ${expected}`);
});

if (data.goals.length !== 6) fail("hacen falta 6 objetivos");
if (data.events.length !== 17) fail(`eventos: ${data.events.length}, se esperaban 17`);
if (data.nutrition.supplements.length !== 7) fail("suplementación incompleta");
if (data.records.length !== 5) fail("marcas incompletas");
if (data.risks.length !== 4) fail("riesgos incompletos");
if (data.nextSteps.length !== 4) fail("próximos pasos incompletos");
if (data.weeklyHours.series.length !== 4) fail("series de horas incompletas");
data.weeklyHours.series.forEach((series) => {
  if (series.values.length !== data.weeklyHours.labels.length) fail(`horas de ${series.name} desalineadas`);
});
if (data.distribution.byDiscipline.length !== 4 || data.distribution.byDay.length !== 7) {
  fail("distribución de horas incompleta");
}
if (!data.zonas || data.zonas.tabla.length !== 5) fail("faltan las 5 zonas");
if (!data.week.alerta) fail("falta la alerta de la semana");
if (data.week.piscinaM !== 20) fail("la piscina es de 20 m");

const required = [
  "Estimación mía con la FC",
  "Pendiente: test de 20'",
  "Pendiente: test de 30'",
  "Pendiente: pásame tus horas medias",
  "Creatina monohidrato",
  "Salto grande de volumen.",
  "Fase 1 base",
  "2 nov",
  "10 ene",
];
const blob = JSON.stringify(data);
for (const text of required) {
  if (!blob.includes(text)) fail(`falta el texto: ${text}`);
}
const swim = data.days.find((day) => day.id === "mar").sessions.find((session) => session.id === "mar-natacion");
const tech = swim.bloques.find((block) => block.nombre === "Técnica");
if (!tech || tech.descanso !== '20"' || !String(tech.descripcion).includes("brazada con pausa adelante")) {
  fail("falta la técnica del martes");
}
if (swim.metros !== 1020 || swim.bloques.find((block) => block.nombre === "Principal").metros !== 400) {
  fail("metros del martes");
}
const plan = data.days.flatMap((day) => day.sessions).filter((session) => session.cuentaEnPlan);
const planMin = plan.reduce((total, session) => total + (session.duracionMin || 0), 0);
const doneMin = plan.filter((session) => session.completado).reduce((total, session) => total + (session.duracionMin || 0), 0);
if (planMin !== 430 || doneMin !== 120) fail(`minutos plan ${planMin} hechos ${doneMin}`);
if (data.goals.find((goal) => goal.name === "Natación esta semana").target !== 3380) fail("objetivo de natación");
if (data.goals.find((goal) => goal.name === "Horas esta semana").target !== 430) fail("objetivo de horas");

if (data.week.start !== "2026-11-02" || data.week.end !== "2026-11-08") fail("rango de la semana");
if (data.phase.start !== "2026-11-02" || data.phase.end !== "2027-01-10") fail("rango de la fase");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("data/semana-actual.json OK");
