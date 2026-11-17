import { getSession } from "@/lib/session";
import { Chat } from "./Chat";

export default async function CoachPage() {
  const { supabase, user } = await getSession();
  const { data } = await supabase.from("chat_messages").select("role, content").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(60);
  const initial = ((data ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();
  return (
    <div className="space-y-3">
      <div>
        <h1 className="h1">✨ ИИ-коуч</h1>
        <p className="muted">Видит только ваши данные и то, чем партнёр поделился. Скрытые цели партнёра ему недоступны.</p>
      </div>
      <Chat initial={initial} />
    </div>
  );
}
