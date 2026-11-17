import { z } from "zod";
import { aiErrorMessage, buildContext, structured } from "@/lib/ai";
import { childHorizon, horizon } from "@/lib/constants";
import { getSession } from "@/lib/session";
import type { Goal } from "@/lib/types";

const Plan = z.object({
  goals: z.array(z.object({
    title: z.string(),
    deadline: z.string().nullable().describe("YYYY-MM-DD"),
    metric: z.string().nullable(),
    target: z.number().nullable(),
    unit: z.string().nullable(),
  })).describe("Подцели следующего уровня; пустой массив, если цель уже на 90 дней"),
  tasks: z.array(z.string()).describe("3–5 конкретных задач на ЭТУ неделю, каждая выполнима за 15–90 минут"),
  comment: z.string().describe("1–2 фразы: логика плана"),
});

export async function POST(req: Request) {
  try {
    const s = await getSession();
    const { goalId } = await req.json();
    const { data } = await s.supabase.from("goals").select("*").eq("id", goalId).maybeSingle();
    if (!data) return Response.json({ error: "Цель не найдена" }, { status: 404 });
    const g = data as Goal;
    const child = childHorizon(g.horizon);
    const context = await buildContext({ supabase: s.supabase, userId: s.user.id, me: s.me, family: s.family, members: s.members });
    const task = `Разбей цель «${g.title}» (горизонт ${horizon(g.horizon).label}${g.deadline ? `, срок ${g.deadline}` : ""}${g.target ? `, цель ${g.target} ${g.unit ?? ""}, сейчас ${g.current}` : ""}) на шаги.
${child ? `Предложи 2–4 подцели на горизонт «${horizon(child).label}» — SMART, со сроками и метриками, последовательные.` : "Подцелей не нужно (goals = [])."}
И 3–5 задач на эту неделю, с которых реально начать. Учитывай уже существующие подцели и задачи из контекста — не дублируй их.${g.visibility === "family" ? " Это общая семейная цель: задачи могут быть для обоих." : ""}`;
    return Response.json(await structured({ schema: Plan, context, task, effort: "high" }));
  } catch (e) {
    return Response.json({ error: aiErrorMessage(e) }, { status: 500 });
  }
}
