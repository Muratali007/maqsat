import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import {
  FAMILY_VISION_QUESTIONS, SPHERES, VISION_QUESTIONS, WEEKLY_QUESTIONS, horizon, sphere, weekStart,
} from "@/lib/constants";
import { getVision, listGoals, reviewHistory, tasksForWeek, wheelHistory } from "@/lib/data";
import type { Session } from "@/lib/session";
import { progress } from "@/lib/types";
import { AI_ENABLED } from "@/lib/flags";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
// Server-side fallback: if the model declines a request, the API retries it on the recommended fallback model.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let _client: Anthropic | null = null;
export function ai(): Anthropic {
  if (!AI_ENABLED || !process.env.ANTHROPIC_API_KEY) throw new AiNotConfigured();
  return (_client ??= new Anthropic());
}
export class AiNotConfigured extends Error {
  constructor() {
    super("ИИ-функции скоро появятся.");
  }
}

/** Stable coaching instructions (kept identical between requests so they are prompt-cached). */
export const COACH_SYSTEM = `Ты — личный коуч по целям для семьи (муж и жена) на сайте «Цели». Отвечай по-русски, тепло и по делу, без воды.
Методика сайта:
- Видение жизни через 5 лет → 7 сфер (карьера, финансы, семья, здоровье, развитие, путешествия, личность).
- Каскад целей 10 лет → 3 года → 1 год → 90 дней → задачи недели. Большая цель должна превращаться в маленькие действия.
- Цели по SMART: конкретная, измеримая, достижимая, важная лично, ограниченная по сроку.
- На год — не больше 3–5 главных целей, остальные сферы просто поддерживать.
- Каждое воскресенье — обзор недели: что сделал, что не получилось и почему, что приблизило к целям, три главные задачи.
- Не ругать за невыполненное — корректировать план. Цель жизни не гонка за статусом, а движение в правильном направлении.
Правила:
- Опирайся на данные пользователя из контекста (видение, цели, задачи, обзоры). Не выдумывай факты о нём.
- Предлагай конкретику: цифры, сроки, частоту («30 минут 5 раз в неделю»), а не общие слова.
- Если цели конфликтуют между собой (деньги/время/силы) — мягко покажи это и предложи приоритет.
- Для семейных целей учитывай, что это решение двоих: предлагай, а не решай за них.
- Ты не финансовый, медицинский или юридический консультант: в таких вопросах давай общие ориентиры и советуй специалиста.
- Пиши коротко: абзацы по 1–3 предложения, списки где уместно, Markdown можно.`;


/** Everything the coach should know about the user, as compact text. */
export async function buildContext({ ctx, me, family, members }: Session): Promise<string> {
  const userId = ctx.userId;
  const today = new Date().toISOString().slice(0, 10);
  const [va, fa, wheel, gs, ts, weekly, fam] = await Promise.all([
    getVision(ctx, "personal"),
    family ? getVision(ctx, "family") : Promise.resolve({} as Record<string, string>),
    wheelHistory(ctx, 1),
    listGoals(ctx, { status: "not_dropped" }),
    tasksForWeek(ctx, weekStart()),
    reviewHistory(ctx, "weekly", 3),
    reviewHistory(ctx, "family", 1),
  ]);
  const rs = [...weekly, ...fam];

  const L: string[] = [`Сегодня: ${today}. Пользователь: ${me.name ?? "—"}.`];
  if (family) {
    const others = members.filter((m) => m.id !== userId).map((m) => m.name).join(", ") || "пока никого";
    L.push(`Семья «${family.name}», вместе с: ${others}.`);
  } else L.push("Семья на сайте пока не создана.");

  const vLines = VISION_QUESTIONS.filter((q) => va[q.id]?.trim()).map((q) => `- ${q.q} ${va[q.id].trim()}`);
  L.push("", "## Личное видение через 5 лет", vLines.length ? vLines.join("\n") : "(не заполнено)");

  const fLines = FAMILY_VISION_QUESTIONS.filter((q) => fa[q.id]?.trim()).map((q) => `- ${q.q} ${fa[q.id].trim()}`);
  if (family) L.push("", "## Видение семьи", fLines.length ? fLines.join("\n") : "(не заполнено)");

  const sc = wheel[0]?.scores ?? null;
  L.push("", "## Колесо жизни (1–10)", sc ? SPHERES.map((s) => `${s.label}: ${sc[s.id] ?? "—"}`).join("; ") : "(не заполнено)");

  L.push("", "## Цели");
  if (!gs.length) L.push("(целей пока нет)");
  for (const g of gs) {
    const who = g.visibility === "family" ? "семейная" : g.owner_id === userId ? (g.visibility === "shared" ? "моя, видна семье" : "моя") : `партнёра (${members.find((m) => m.id === g.owner_id)?.name ?? "—"})`;
    const pr = g.target ? `, прогресс ${g.current}/${g.target}${g.unit ? " " + g.unit : ""} (${progress(g)}%)` : "";
    L.push(`- [${horizon(g.horizon).label}, ${sphere(g.sphere).label}, ${who}${g.status === "done" ? ", ВЫПОЛНЕНА" : ""}] ${g.title}` +
      `${g.deadline ? `, срок ${g.deadline}` : ""}${pr}${g.why ? `. Зачем: ${g.why}` : ""} (id ${g.id.slice(0, 8)}${g.parent_id ? `, под целью ${g.parent_id.slice(0, 8)}` : ""})`);
  }

  L.push("", "## Задачи этой недели", ts.length ? ts.map((t) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n") : "(нет)");

  if (rs.length) {
    L.push("", "## Последние обзоры");
    for (const r of rs) {
      const a = r.answers ?? {};
      L.push(`### ${r.kind === "family" ? "Семейный" : "Недельный"} обзор от ${r.period_start}`);
      for (const q of WEEKLY_QUESTIONS) if (a[q.id]) L.push(`- ${q.q} ${a[q.id]}`);
      for (const [k, v] of Object.entries(a)) if (!WEEKLY_QUESTIONS.some((q) => q.id === k) && v) L.push(`- ${k}: ${v}`);
    }
  }
  return L.join("\n");
}

/** One request that must return JSON matching `schema`. */
export async function structured<T extends z.ZodType>(opts: {
  schema: T; context: string; task: string; effort?: "low" | "medium" | "high";
}): Promise<z.infer<T>> {
  const res = await ai().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: [{ type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    messages: [{ role: "user", content: `<context>\n${opts.context}\n</context>\n\n${opts.task}` }],
  });
  if (res.stop_reason === "refusal") throw new Error("ИИ отказался отвечать на этот запрос. Попробуйте переформулировать.");
  if (res.stop_reason === "max_tokens" || !res.parsed_output) throw new Error("ИИ вернул неполный ответ, попробуйте ещё раз.");
  return res.parsed_output as z.infer<T>;
}

/** Plain-text answer (non-streaming) — used for review feedback. */
export async function text(opts: { context: string; task: string; effort?: "low" | "medium" | "high" }): Promise<string> {
  const res = await ai().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: [{ type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: opts.effort ?? "medium" },
    messages: [{ role: "user", content: `<context>\n${opts.context}\n</context>\n\n${opts.task}` }],
  });
  if (res.stop_reason === "refusal") throw new Error("ИИ отказался отвечать на этот запрос.");
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
}

/** Streaming chat: yields text deltas, returns the full text at the end. */
export function chatStream(context: string, history: Anthropic.Beta.BetaMessageParam[]) {
  // Context goes into the first user turn so the system prompt stays byte-identical (cacheable).
  const msgs: Anthropic.Beta.BetaMessageParam[] = history.map((m, i) =>
    i === 0 && m.role === "user" ? { role: "user", content: `<context>\n${context}\n</context>\n\n${m.content as string}` } : m);
  return ai().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: [{ type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium" },
    messages: msgs,
  });
}

export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiNotConfigured) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "Неверный ANTHROPIC_API_KEY — проверьте ключ.";
  if (e instanceof Anthropic.RateLimitError) return "Слишком много запросов к ИИ, подождите минуту.";
  if (e instanceof Anthropic.APIError) return `Ошибка ИИ (${e.status}): ${e.message}`;
  return e instanceof Error ? e.message : "Неизвестная ошибка ИИ";
}
