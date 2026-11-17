import Link from "next/link";
import { Empty, GoalCard } from "@/components/bits";
import { HORIZONS } from "@/lib/constants";
import { getSession } from "@/lib/session";
import type { Goal, Profile } from "@/lib/types";

function Tree({ g, all, members, me, depth = 0 }: { g: Goal; all: Goal[]; members: Profile[]; me: string; depth?: number }) {
  const kids = all.filter((c) => c.parent_id === g.id);
  return (
    <div className={depth ? "ml-4 border-l-2 border-line pl-4" : ""}>
      <GoalCard g={g} members={members} me={me} />
      {kids.length > 0 && <div className="mt-2 space-y-2">{kids.map((k) => <Tree key={k.id} g={k} all={all} members={members} me={me} depth={depth + 1} />)}</div>}
    </div>
  );
}

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "mine", label: "🙋 Мои" },
  { id: "family", label: "👨‍👩‍👧 Семейные" },
  { id: "partner", label: "👀 Партнёра" },
  { id: "done", label: "✅ Выполненные" },
];

export default async function GoalsPage(props: PageProps<"/goals">) {
  const { f = "all" } = await props.searchParams;
  const { supabase, user, family, members } = await getSession();
  const { data } = await supabase.from("goals").select("*").order("deadline", { nullsFirst: false });
  let goals = ((data ?? []) as Goal[]).filter((g) => g.status !== "dropped");
  goals = goals.filter((g) => (f === "done" ? g.status === "done" : g.status === "active"));
  if (f === "mine") goals = goals.filter((g) => g.owner_id === user.id && g.visibility !== "family");
  if (f === "family") goals = goals.filter((g) => g.visibility === "family");
  if (f === "partner") goals = goals.filter((g) => g.owner_id !== user.id && g.visibility === "shared");
  const ids = new Set(goals.map((g) => g.id));
  const roots = goals.filter((g) => !g.parent_id || !ids.has(g.parent_id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">Цели</h1>
          <p className="muted">10 лет → 3 года → 1 год → 90 дней. Каждая цель — шаг к большей.</p>
        </div>
        <Link href="/goals/new" className="btn-primary">+ Новая цель</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.filter((x) => family || (x.id !== "family" && x.id !== "partner")).map((x) => (
          <Link key={x.id} href={`/goals?f=${x.id}`} className={f === x.id ? "btn-primary !py-1" : "btn-ghost !py-1"}>{x.label}</Link>
        ))}
      </div>
      {!goals.length ? <Empty>Здесь пока пусто. <Link href="/goals/new" className="text-accent underline">Поставьте первую цель</Link>.</Empty> : (
        HORIZONS.map((h) => {
          const list = roots.filter((g) => g.horizon === h.id);
          if (!list.length) return null;
          return (
            <section key={h.id} className="space-y-2">
              <h2 className="h2">{h.label} <span className="muted font-normal">— {h.hint}</span></h2>
              <div className="space-y-3">{list.map((g) => <Tree key={g.id} g={g} all={goals} members={members} me={user.id} />)}</div>
            </section>
          );
        })
      )}
    </div>
  );
}
