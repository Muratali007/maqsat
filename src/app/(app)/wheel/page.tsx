import { SPHERES, fmtDate } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { WheelForm } from "./WheelForm";

export default async function WheelPage() {
  const { supabase, user } = await getSession();
  const { data } = await supabase.from("wheel_scores").select("scores, created_at").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(6);
  const history = (data ?? []) as { scores: Record<string, number>; created_at: string }[];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Колесо жизни</h1>
        <p className="muted">Оцените каждую сферу от 1 до 10 честно, «как есть сейчас». Повторяйте раз в 1–3 месяца, чтобы видеть движение.</p>
      </div>
      <div className="card"><WheelForm initial={history[0]?.scores ?? {}} /></div>
      {history.length > 1 && (
        <div className="card overflow-x-auto">
          <h2 className="h2 mb-2">История</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-muted"><th className="text-left font-normal">Дата</th>{SPHERES.map((s) => <th key={s.id} title={s.label} className="font-normal">{s.emoji}</th>)}</tr></thead>
            <tbody>{history.map((h) => (
              <tr key={h.created_at} className="border-t border-line">
                <td className="py-1">{fmtDate(h.created_at.slice(0, 10))}</td>
                {SPHERES.map((s) => <td key={s.id} className="text-center">{h.scores[s.id] ?? "—"}</td>)}
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
