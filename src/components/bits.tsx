import Link from "next/link";
import { fmtDate, horizon, sphere } from "@/lib/constants";
import { progress, type Goal, type Profile } from "@/lib/types";

export function ProgressBar({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

const VIS_BADGE: Record<string, string> = { private: "🔒", shared: "👀", family: "👨‍👩‍👧" };

export function GoalCard({ g, members, me }: { g: Goal; members: Profile[]; me: string }) {
  const s = sphere(g.sphere);
  const p = progress(g);
  const owner = g.owner_id !== me && g.visibility !== "family" ? members.find((m) => m.id === g.owner_id)?.name : null;
  return (
    <Link href={`/goals/${g.id}`} className="card block space-y-2 !p-4 transition hover:border-accent">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium leading-snug">
          {g.status === "done" && "✅ "}{g.title}
        </div>
        <span title="Видимость">{VIS_BADGE[g.visibility]}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="chip" style={{ borderColor: s.color, color: s.color }}>{s.emoji} {s.label}</span>
        <span className="chip">{horizon(g.horizon).label}</span>
        {g.deadline && <span className="chip">до {fmtDate(g.deadline)}</span>}
        {owner && <span className="chip">👤 {owner}</span>}
      </div>
      {(g.target || g.status === "done") && (
        <div className="flex items-center gap-2">
          <ProgressBar value={p} color={s.color} />
          <span className="w-10 text-right text-xs text-muted">{p}%</span>
        </div>
      )}
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}
