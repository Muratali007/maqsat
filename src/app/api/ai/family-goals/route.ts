import { z } from "zod";
import { aiErrorMessage, buildContext, structured } from "@/lib/ai";
import { getSession } from "@/lib/session";

const Ideas = z.object({
  goals: z.array(z.object({
    title: z.string().describe("SMART-формулировка общей цели"),
    sphere: z.enum(["career", "finance", "family", "health", "growth", "travel", "self"]),
    horizon: z.enum(["10y", "3y", "1y", "90d"]),
    why: z.string().describe("Почему это важно именно этой паре, со ссылкой на их видение/цели"),
    deadline: z.string().nullable().describe("YYYY-MM-DD"),
  })).describe("3–5 идей"),
  comment: z.string().describe("1–2 фразы: общая логика, конфликты целей если есть"),
});

export async function POST() {
  try {
    const s = await getSession();
    if (!s.family) return Response.json({ error: "Сначала создайте семью" }, { status: 400 });
    const context = await buildContext({ supabase: s.supabase, userId: s.user.id, me: s.me, family: s.family, members: s.members });
    const task = `Предложи 3–5 ОБЩИХ семейных целей для этой пары: на основе видения семьи, личных видений и целей, которые видны в контексте. Не повторяй уже существующие семейные цели. Смешай горизонты: что-то большое (3 года) и что-то близкое и приятное (90 дней). Если в целях есть противоречия по деньгам или времени — скажи в comment.`;
    return Response.json(await structured({ schema: Ideas, context, task }));
  } catch (e) {
    return Response.json({ error: aiErrorMessage(e) }, { status: 500 });
  }
}
