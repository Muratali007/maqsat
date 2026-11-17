import type Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage, buildContext, chatStream } from "@/lib/ai";
import { getSession } from "@/lib/session";

const HISTORY = 30;

export async function POST(req: Request) {
  let s;
  try {
    s = await getSession();
  } catch {
    return new Response("Не авторизован", { status: 401 });
  }
  const { message } = await req.json();
  const text = String(message ?? "").trim().slice(0, 4000);
  if (!text) return new Response("Пустое сообщение", { status: 400 });

  const { data: rows } = await s.supabase.from("chat_messages").select("role, content")
    .eq("user_id", s.user.id).order("created_at", { ascending: false }).limit(HISTORY);
  const history = ((rows ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();
  while (history.length && history[0].role !== "user") history.shift();   // API needs a user turn first

  await s.supabase.from("chat_messages").insert({ user_id: s.user.id, role: "user", content: text });
  const msgs: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: text }];

  let context: string;
  try {
    context = await buildContext({ supabase: s.supabase, userId: s.user.id, me: s.me, family: s.family, members: s.members });
  } catch (e) {
    return new Response(aiErrorMessage(e), { status: 500 });
  }

  const supabase = s.supabase, userId = s.user.id;
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        const stream = chatStream(context, msgs);
        stream.on("text", (delta) => { full += delta; controller.enqueue(enc.encode(delta)); });
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !full) {
          full = "Извините, на это я не могу ответить. Попробуйте переформулировать вопрос.";
          controller.enqueue(enc.encode(full));
        }
      } catch (e) {
        const msg = `\n\n⚠️ ${aiErrorMessage(e)}`;
        controller.enqueue(enc.encode(msg));
        if (!full) { controller.close(); return; }
      }
      if (full.trim()) await supabase.from("chat_messages").insert({ user_id: userId, role: "assistant", content: full });
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
