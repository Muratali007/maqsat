import { AI_ENABLED } from "@/lib/flags";
import { getSession } from "@/lib/session";
import { Chat } from "./Chat";

const FEATURES = [
  { icon: "💬", title: "Чат с коучем", text: "Спрашивайте «с чего начать?», «какие цели выбрать на год?», «почему я буксую?» — коуч видит ваше видение, цели и обзоры." },
  { icon: "🎯", title: "SMART за секунду", text: "Напишите цель своими словами — получите конкретную формулировку с цифрой и сроком." },
  { icon: "🪜", title: "Разбивка на шаги", text: "Цель на 10 лет → шаги на 3 года → на год → на 90 дней → задачи на эту неделю." },
  { icon: "🗓️", title: "Разбор недели", text: "После воскресного обзора — короткий разбор: что получилось, что поменять, какие 3 задачи главные." },
  { icon: "👨‍👩‍👧", title: "Для семьи", text: "Идеи общих целей на основе ваших видений и подсказка, если цели спорят за деньги или время." },
  { icon: "🔒", title: "Приватно", text: "Коуч видит только ваши данные и то, чем партнёр сам поделился." },
];

export default async function CoachPage() {
  const { supabase, user } = await getSession();
  if (!AI_ENABLED) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="card bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
          <div className="text-sm font-medium uppercase tracking-wide opacity-80">Скоро</div>
          <h1 className="mt-1 text-3xl font-bold">✨ ИИ-коуч</h1>
          <p className="mt-2 max-w-xl opacity-90">Личный коуч по целям, который знает вашу жизнь: видение, цели и обзоры недель. Уже готовим — а пока заполните видение и поставьте цели, чтобы коучу было с чем работать.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="text-2xl">{f.icon}</div>
              <div className="mt-1 font-semibold">{f.title}</div>
              <p className="muted mt-1">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
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
