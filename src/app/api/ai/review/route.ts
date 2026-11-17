import { aiErrorMessage, buildContext, text } from "@/lib/ai";
import { FAMILY_REVIEW_QUESTIONS, WEEKLY_QUESTIONS } from "@/lib/constants";
import { currentSession } from "@/lib/session";
import { getReview, setReviewFeedback } from "@/lib/data";

export async function POST(req: Request) {
  try {
    const s = await currentSession();
    if (!s) return Response.json({ error: "Войдите заново" }, { status: 401 });
    const { reviewId } = await req.json();
    const r = await getReview(s.ctx, String(reviewId));
    if (!r) return Response.json({ error: "Обзор не найден" }, { status: 404 });
    const qs = r.kind === "family" ? FAMILY_REVIEW_QUESTIONS : WEEKLY_QUESTIONS;
    const answers = qs.map((q) => `- ${q.q}\n  ${r.answers[q.id] || "(не заполнено)"}`).join("\n");
    const context = await buildContext(s);
    const task = r.kind === "family"
      ? `Вот семейный обзор месяца (${r.period_start}), который пара заполнила вместе:\n${answers}\n\nДай короткий разбор для обоих: что получилось (похвали конкретно), где буксуют общие цели и почему, 2–3 конкретных предложения на следующий месяц, одно совместное дело для удовольствия. До 200 слов.`
      : `Вот мой обзор недели (${r.period_start}):\n${answers}\n\nДай короткий разбор: что получилось (конкретно), закономерности по сравнению с прошлыми обзорами (если есть), что поменять в плане, и уточни/улучши три главные задачи на следующую неделю так, чтобы они двигали главные цели года. Без упрёков. До 200 слов.`;
    const out = await text({ context, task });
    await setReviewFeedback(s.ctx, r.id, out);
    return Response.json({ text: out });
  } catch (e) {
    return Response.json({ error: aiErrorMessage(e) }, { status: 500 });
  }
}
