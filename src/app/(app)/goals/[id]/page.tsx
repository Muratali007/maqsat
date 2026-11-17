import Link from "next/link";
import { notFound } from "next/navigation";
import { GoalCard, ProgressBar } from "@/components/bits";
import { Submit } from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { childHorizon, fmtDate, horizon, sphere, weekStart } from "@/lib/constants";
import { getSession, nameOf } from "@/lib/session";
import { progress, type Goal, type Task } from "@/lib/types";
import { addTask, setProgress } from "../../actions";
import { GoalForm } from "../GoalForm";
import { Breakdown } from "./Breakdown";
import { Soon } from "@/components/Soon";
import { AI_ENABLED } from "@/lib/flags";
import { GoalActions } from "./GoalActions";

const VIS = { private: "🔒 Только я", shared: "👀 Видна семье", family: "👨‍👩‍👧 Общая семейная" };

export default async function GoalPage(props: PageProps<"/goals/[id]">) {
  const { id } = await props.params;
  const { edit } = await props.searchParams;
  const { supabase, user, family, members } = await getSession();
  const { data } = await supabase.from("goals").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const g = data as Goal;
  const [kidsRes, parentRes, tasksRes, parentsRes] = await Promise.all([
    supabase.from("goals").select("*").eq("parent_id", id).neq("status", "dropped").order("deadline"),
    g.parent_id ? supabase.from("goals").select("id, title").eq("id", g.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("tasks").select("*").eq("goal_id", id).order("week_start", { ascending: false }),
    supabase.from("goals").select("id, title, horizon").eq("status", "active").neq("horizon", "90d"),
  ]);
  const kids = (kidsRes.data ?? []) as Goal[];
  const parent = parentRes.data as { id: string; title: string } | null;
  const tasks = (tasksRes.data ?? []) as Task[];
  const s = sphere(g.sphere);
  const p = progress(g);
  const canEdit = g.owner_id === user.id || g.visibility === "family";
  const child = childHorizon(g.horizon);
  const thisWeek = weekStart();

  return (
    <div className="max-w-3xl space-y-5">
      {parent && <Link href={`/goals/${parent.id}`} className="text-sm text-accent">↑ {parent.title}</Link>}
      <div className="space-y-2">
        <h1 className="h1">{g.status === "done" && "✅ "}{g.title}</h1>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="chip" style={{ borderColor: s.color, color: s.color }}>{s.emoji} {s.label}</span>
          <span className="chip">{horizon(g.horizon).label}</span>
          {g.deadline && <span className="chip">до {fmtDate(g.deadline)}</span>}
          <span className="chip">{VIS[g.visibility]}</span>
          {g.owner_id !== user.id && <span className="chip">👤 автор: {nameOf(members, g.owner_id)}</span>}
          {g.assignee_id && <span className="chip">🙋 отвечает: {nameOf(members, g.assignee_id)}</span>}
        </div>
        {g.why && <p className="text-sm"><span className="text-muted">Зачем: </span>{g.why}</p>}
      </div>

      <div className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="h2">Прогресс</div>
          <div className="text-sm text-muted">{g.metric}</div>
        </div>
        {g.target ? (<>
          <div className="flex items-center gap-3"><ProgressBar value={p} color={s.color} /><b>{p}%</b></div>
          {canEdit && g.status === "active" && (
            <form action={setProgress.bind(null, g.id)} className="flex items-center gap-2 text-sm">
              <input name="current" inputMode="decimal" defaultValue={g.current} className="input max-w-40" />
              <span className="text-muted">из {g.target} {g.unit}</span>
              <Submit className="btn-ghost">Обновить</Submit>
            </form>
          )}
        </>) : <p className="muted">Метрика не задана — нажмите «Изменить» и добавьте число, чтобы видеть прогресс.</p>}
        {canEdit && <GoalActions id={g.id} status={g.status} canDelete={g.owner_id === user.id} />}
      </div>

      {canEdit && g.status === "active" && (AI_ENABLED ? <Breakdown goalId={g.id} childLabel={child ? horizon(child).label : null} />
        : <Soon title="Разбить на шаги" text="ИИ разложит цель на подцели следующего уровня и 3–5 задач на эту неделю — останется отметить галочками нужные." />)}

      {child && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="h2">Шаги на {horizon(child).label}</h2>
            {canEdit && <Link href={`/goals/new?parent=${g.id}`} className="text-sm text-accent">+ шаг</Link>}
          </div>
          {kids.length ? <div className="grid gap-3 sm:grid-cols-2">{kids.map((k) => <GoalCard key={k.id} g={k} members={members} me={user.id} />)}</div>
            : <p className="muted">Пока нет. Большая цель становится реальной, когда разбита на шаги.</p>}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="h2">Задачи</h2>
        <TaskList tasks={tasks.filter((t) => t.week_start === thisWeek)} />
        {canEdit && (
          <form action={addTask} className="flex gap-2">
            <input type="hidden" name="goal_id" value={g.id} />
            <input name="title" required placeholder="Задача на эту неделю…" className="input" />
            <Submit className="btn-ghost" pending="…">Добавить</Submit>
          </form>
        )}
        {tasks.some((t) => t.week_start !== thisWeek) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Прошлые недели</summary>
            <ul className="mt-2 space-y-1">{tasks.filter((t) => t.week_start !== thisWeek).map((t) => (
              <li key={t.id} className={t.done ? "text-muted line-through" : ""}>{t.done ? "✓" : "○"} {t.title} <span className="text-xs text-muted">({fmtDate(t.week_start)})</span></li>
            ))}</ul>
          </details>
        )}
      </section>

      {canEdit && (
        edit ? (
          <div className="card space-y-3">
            <div className="flex items-baseline justify-between"><h2 className="h2">Изменить цель</h2><Link href={`/goals/${g.id}`} className="text-sm text-muted">закрыть</Link></div>
            <GoalForm goal={g} parents={(parentsRes.data ?? []) as Goal[]} members={members} hasFamily={!!family} />
          </div>
        ) : <Link href={`/goals/${g.id}?edit=1`} className="btn-ghost">✏️ Изменить</Link>
      )}
    </div>
  );
}
