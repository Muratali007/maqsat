import Link from "next/link";
import { AiFeedback, ReviewForm } from "@/components/ReviewForm";
import { ProgressBar } from "@/components/bits";
import { Submit } from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { WEEKLY_QUESTIONS, fmtDate, weekStart } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { listGoals, reviewFor, reviewHistory, tasksForWeek } from "@/lib/data";
import { addTask } from "../actions";
import { Soon } from "@/components/Soon";
import { AI_ENABLED } from "@/lib/flags";

const shift = (d: string, days: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
};

export default async function WeekPage(props: PageProps<"/week">) {
  const { w } = await props.searchParams;
  const week = typeof w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w) ? weekStart(new Date(w + "T00:00:00")) : weekStart();
  const isCurrent = week === weekStart();
  const { user, ctx } = await getSession();
  const [tasks, goals, review, allReviews] = await Promise.all([
    tasksForWeek(ctx, week),
    listGoals(ctx, { status: "active" }),
    reviewFor(ctx, "weekly", week),
    reviewHistory(ctx, "weekly", 8),
  ]);
  const titles = Object.fromEntries(goals.map((g) => [g.id, g.title]));
  const history = allReviews.filter((r) => r.period_start !== week);
  const done = tasks.filter((t) => t.done).length;
  const myGoals = goals.filter((g) => g.owner_id === user.id || g.visibility === "family");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">Неделя с {fmtDate(week)}</h1>
          <p className="muted">Задачи недели и воскресный обзор — 20–30 минут.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/week?w=${shift(week, -7)}`} className="btn-ghost">← Пред.</Link>
          {!isCurrent && <Link href="/week" className="btn-ghost">Сегодня</Link>}
          <Link href={`/week?w=${shift(week, 7)}`} className="btn-ghost">След. →</Link>
        </div>
      </div>

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between"><h2 className="h2">Задачи</h2><span className="muted">{done}/{tasks.length}</span></div>
        {tasks.length > 0 && <ProgressBar value={Math.round((done / tasks.length) * 100)} />}
        <TaskList tasks={tasks} goalTitles={titles} />
        <form action={addTask} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="week_start" value={week} />
          <input name="title" required placeholder="Новая задача…" className="input" />
          <select name="goal_id" className="input sm:max-w-64" defaultValue="">
            <option value="">без цели</option>
            {myGoals.map((g) => <option key={g.id} value={g.id}>[{g.horizon}] {g.title}</option>)}
          </select>
          <Submit className="btn-ghost" pending="…">Добавить</Submit>
        </form>
      </section>

      <section id="review" className="card space-y-3">
        <h2 className="h2">Обзор недели</h2>
        {review ? (<>
          <dl className="space-y-2 text-sm">
            {WEEKLY_QUESTIONS.map((q) => review.answers[q.id] ? (
              <div key={q.id}><dt className="text-muted">{q.q}</dt><dd className="whitespace-pre-wrap">{review.answers[q.id]}</dd></div>
            ) : null)}
          </dl>
          {AI_ENABLED ? <AiFeedback reviewId={review.id} initial={review.ai_feedback} />
            : <Soon compact title="Разбор обзора от ИИ" text="Коуч прочитает обзор вместе с вашими целями, найдёт закономерности и уточнит три главные задачи на неделю." />}
        </>) : (<>
          <p className="muted">Не ругайте себя за невыполненное — корректируйте план.</p>
          <ReviewForm kind="weekly" periodStart={week} questions={WEEKLY_QUESTIONS} />
        </>)}
      </section>

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="h2">Прошлые обзоры</h2>
          {history.map((r) => (
            <Link key={r.id} href={`/week?w=${r.period_start}#review`} className="card block !p-3 text-sm hover:border-accent">
              <b>{fmtDate(r.period_start)}</b> — {(r.answers.done ?? "").slice(0, 120) || "…"}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
