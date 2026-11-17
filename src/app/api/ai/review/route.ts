import { aiErrorMessage, buildContext, text } from "@/lib/ai";
import { FAMILY_REVIEW_QUESTIONS, WEEKLY_QUESTIONS } from "@/lib/constants";
import { getSession } from "@/lib/session";
import type { Review } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const s = await getSession();
    const { reviewId } = await req.json();
    const { data } = await s.supabase.from("reviews").select("*").eq("id", reviewId).maybeSingle();
    if (!data) return Response.json({ error: "Обзор не найден" }, { status: 404 });
    const r = data as Review;
    const qs = r.kind === "family" ? FAMILY_REVIEW_QUESTIONS : WEEKLY_QUESTIONS;
    const answers = qs.map((q) => `- ${q.q}\n  ${r.answers[q.id] || "(не заполнено)"}`).join("\n");
    const context = await buildContext({ supabase: s.supabase, userId: s.user.id, me: s.me, family: s.family, members: s.members });
    const task = r.kind === "family"
      ? `Вот семейный обзор месяца (${r.period_start}), который пара заполнила вместе:\n${answers}\n\nДай короткий разбор для обоих: что получилось (похвали конкретно), где буксуют общие цели и почему, 2–3 конкретных предложения на следующий месяц, одно совместное дело для удовольствия. До 200 слов.`
      : `Вот мой обзор недели (${r.period_start}):\n${answers}\n\nДай короткий разбор: что получилось (конкретно), закономерности по сравнению с прошлыми обзорами (если есть), что поменять в плане, и уточни/улучши три главные задачи на следующую неделю так, чтобы они двигали главные цели года. Без упрёков. До 200 слов.`;
    const out = await text({ context, task });
    await s.supabase.from("reviews").update({ ai_feedback: out }).eq("id", r.id);
    return Response.json({ text: out });
  } catch (e) {
    return Response.json({ error: aiErrorMessage(e) }, { status: 500 });
  }
}
