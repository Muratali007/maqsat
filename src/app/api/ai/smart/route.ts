import { z } from "zod";
import { aiErrorMessage, buildContext, structured } from "@/lib/ai";
import { horizon, sphere } from "@/lib/constants";
import { currentSession } from "@/lib/session";

const Smart = z.object({
  title: z.string().describe("Переформулированная SMART-цель, одна фраза"),
  metric: z.string().describe("Что измеряем, коротко"),
  target: z.number().nullable().describe("Целевое число или null, если цель бинарная"),
  unit: z.string().describe("Единица измерения: ₸, кг, раз, книг, стран… или пусто"),
  deadline: z.string().describe("Срок в формате YYYY-MM-DD"),
  checks: z.array(z.object({
    letter: z.enum(["S", "M", "A", "R", "T"]),
    ok: z.boolean().describe("Выполнялся ли критерий в ИСХОДНОЙ формулировке пользователя"),
    tip: z.string().describe("Коротко: что было/стало, 1 фраза"),
  })),
  comment: z.string().describe("1–2 фразы: на что обратить внимание, без воды"),
});

export async function POST(req: Request) {
  try {
    const s = await currentSession();
    if (!s) return Response.json({ error: "Войдите заново" }, { status: 401 });
    const body = await req.json();
    const context = await buildContext(s);
    const task = `Пользователь создаёт цель. Сделай из неё SMART-цель с учётом его контекста и горизонта.
Исходная формулировка: «${String(body.title ?? "").slice(0, 500)}»
Сфера: ${sphere(body.sphere).label}. Горизонт: ${horizon(body.horizon).label}.${body.why ? ` Зачем: ${String(body.why).slice(0, 500)}.` : ""}${body.deadline ? ` Желаемый срок: ${body.deadline}.` : ""}
Срок ставь реалистичный в пределах горизонта от сегодняшней даты. Если число неизвестно (доход, сумма) — предложи разумное исходя из контекста и скажи об этом в comment. Верни все 5 пунктов checks по порядку S, M, A, R, T.`;
    return Response.json(await structured({ schema: Smart, context, task }));
  } catch (e) {
    return Response.json({ error: aiErrorMessage(e) }, { status: 500 });
  }
}
