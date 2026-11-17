export const SPHERES = [
  { id: "career", label: "Карьера и бизнес", emoji: "💼", color: "#2563eb" },
  { id: "finance", label: "Финансы", emoji: "💰", color: "#16a34a" },
  { id: "family", label: "Семья и отношения", emoji: "❤️", color: "#e11d48" },
  { id: "health", label: "Здоровье", emoji: "🏃", color: "#f97316" },
  { id: "growth", label: "Образование и развитие", emoji: "📚", color: "#7c3aed" },
  { id: "travel", label: "Путешествия и впечатления", emoji: "✈️", color: "#0891b2" },
  { id: "self", label: "Личность и духовность", emoji: "🧘", color: "#a16207" },
] as const;
export type SphereId = (typeof SPHERES)[number]["id"];
export const sphere = (id: string) => SPHERES.find((s) => s.id === id) ?? SPHERES[0];

export const HORIZONS = [
  { id: "10y", label: "10 лет", hint: "Большая мечта, направление жизни" },
  { id: "3y", label: "3 года", hint: "Новый уровень: карьера, доход, жильё" },
  { id: "1y", label: "1 год", hint: "Главные цели года — не больше 5" },
  { id: "90d", label: "90 дней", hint: "Конкретные шаги и привычки" },
] as const;
export type HorizonId = (typeof HORIZONS)[number]["id"];
export const horizon = (id: string) => HORIZONS.find((h) => h.id === id) ?? HORIZONS[2];
/** The horizon one level below (children of a 10y goal are 3y goals, etc.). */
export const childHorizon = (id: string): HorizonId | null =>
  ({ "10y": "3y", "3y": "1y", "1y": "90d" } as Record<string, HorizonId>)[id] ?? null;

export const VISIBILITY = [
  { id: "private", label: "🔒 Только я" },
  { id: "shared", label: "👀 Личная, видна семье" },
  { id: "family", label: "👨‍👩‍👧 Общая семейная" },
] as const;

export const MAX_YEAR_GOALS = 5;

/** Life vision: "imagine 5 years have passed". */
export const VISION_QUESTIONS = [
  { id: "where", q: "Где я живу? В своей квартире или доме?" },
  { id: "work", q: "Какую работу выполняю? Кем я стал профессионально?" },
  { id: "income", q: "Сколько зарабатываю?" },
  { id: "family", q: "Как чувствует себя моя семья? Сколько времени я уделяю близким?" },
  { id: "health", q: "Как выглядит моё здоровье, сколько у меня энергии?" },
  { id: "travel", q: "Сколько стран я посетил, какие впечатления получил?" },
  { id: "skills", q: "Какими знаниями и навыками обладаю?" },
  { id: "proud", q: "Горжусь ли я собой? За что?" },
  { id: "dreams", q: "Три самые большие мечты" },
];

export const FAMILY_VISION_QUESTIONS = [
  { id: "home", q: "Где и как мы живём через 5 лет?" },
  { id: "kids", q: "Дети, родители — какой мы видим нашу семью?" },
  { id: "money", q: "Наши общие финансовые цели (жильё, подушка, инвестиции)" },
  { id: "time", q: "Как мы проводим время вместе? Традиции, отдых" },
  { id: "travel", q: "Куда мы поедем вместе?" },
  { id: "values", q: "Что для нас самое важное как для семьи?" },
];

export const WEEKLY_QUESTIONS = [
  { id: "done", q: "Что я сделал за эту неделю?" },
  { id: "failed", q: "Что не получилось и почему?" },
  { id: "closer", q: "Что приблизило меня к моим целям?" },
  { id: "next", q: "Три главные задачи на следующую неделю" },
];

export const FAMILY_REVIEW_QUESTIONS = [
  { id: "good", q: "Что хорошего было у нас в этом месяце?" },
  { id: "progress", q: "Как продвинулись общие цели?" },
  { id: "hard", q: "Что было тяжело? Что мешало?" },
  { id: "next", q: "Что делаем вместе в следующем месяце?" },
];

/** Monday of the week containing `d`, as YYYY-MM-DD. */
export function weekStart(d = new Date()): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}
export function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  return new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}
