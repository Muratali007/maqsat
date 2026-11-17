import type Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage, buildContext, chatStream } from "@/lib/ai";
import { addChat, chatHistory } from "@/lib/data";
import { currentSession } from "@/lib/session";

const HISTORY = 30;

export async function POST(req: Request) {
  const s = await currentSession();
  if (!s) return new Response("Войдите заново", { status: 401 });
  const { message } = await req.json();
  const text = String(message ?? "").trim().slice(0, 4000);
  if (!text) return new Response("Пустое сообщение", { status: 400 });

  const history = await chatHistory(s.ctx, HISTORY);
  while (history.length && history[0].role !== "user") history.shift();   // API needs a user turn first

  let context: string;
  try {
    context = await buildContext(s);
  } catch (e) {
    return new Response(aiErrorMessage(e), { status: 500 });
  }
  await addChat(s.ctx, "user", text);
  const msgs: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: text }];

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
        controller.enqueue(enc.encode(`\n\n⚠️ ${aiErrorMessage(e)}`));
      }
      if (full.trim()) await addChat(s.ctx, "assistant", full);
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
