import Link from "next/link";
import { Empty, GoalCard, ProgressBar } from "@/components/bits";
import { TaskList } from "@/components/TaskList";
import { MAX_YEAR_GOALS, SPHERES, weekStart } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { listGoals, reviewFor, tasksForWeek, getVision, wheelHistory } from "@/lib/data";
import { AI_ENABLED } from "@/lib/flags";

export default async function Home() {
  const { user, me, family, members, ctx } = await getSession();
  const [goals, tasks, vision, wheel, review] = await Promise.all([
    listGoals(ctx, { status: "active" }),
    tasksForWeek(ctx, weekStart()),
    getVision(ctx, "personal"),
    wheelHistory(ctx, 1),
    reviewFor(ctx, "weekly", weekStart()),
  ]);
  const year = goals.filter((g) => g.horizon === "1y" && g.owner_id === user.id && g.visibility !== "family");
  const quarter = goals.filter((g) => g.horizon === "90d" && (g.owner_id === user.id || g.visibility === "family"));
  const fam = goals.filter((g) => g.visibility === "family");
  const done = tasks.filter((t) => t.done).length;
  const titles = Object.fromEntries(goals.map((g) => [g.id, g.title]));
  const scores = wheel[0]?.scores;
  const isSunday = new Date().getDay() === 0;

  const steps = [
    !Object.values(vision).some((v) => v?.trim()) && { href: "/vision", text: "Опишите, какой будет ваша жизнь через 5 лет" },
    !scores && { href: "/wheel", text: "Оцените 7 сфер жизни — колесо жизни" },
    !goals.length && { href: "/goals/new", text: "Поставьте первую цель" },
    !family && { href: "/family", text: "Создайте семью и пригласите жену/мужа" },
  ].filter(Boolean) as { href: string; text: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Привет, {me.name?.split(" ")[0] ?? "друг"} 👋</h1>
        <p className="muted">Маленькие шаги каждую неделю → большая жизнь через 10 лет.</p>
      </div>

      {steps.length > 0 && (
        <div className="card space-y-2 border-accent/40 bg-accent-soft">
          <div className="h2">С чего начать</div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {steps.map((s) => <li key={s.href}><Link href={s.href} className="underline">{s.text}</Link></li>)}
          </ol>
        </div>
      )}

      {goals.length > 0 && !review && (
        <Link href="/week#review" className="card block border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          🗓️ {isSunday ? "Сегодня воскресенье — " : ""}время для обзора недели (20 минут). →
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="h2">Главные цели года <span className="muted">({year.length}/{MAX_YEAR_GOALS})</span></h2>
            <Link href="/goals/new?horizon=1y" className="text-sm text-accent">+ цель</Link>
          </div>
          {year.length ? <div className="grid gap-3 sm:grid-cols-2">{year.map((g) => <GoalCard key={g.id} g={g} members={members} me={user.id} />)}</div>
            : <Empty>Выберите 3–5 главных целей на год — по одной на важные сферы.</Empty>}

          {quarter.length > 0 && (<>
            <h2 className="h2 pt-2">Фокус на 90 дней</h2>
            <div className="grid gap-3 sm:grid-cols-2">{quarter.map((g) => <GoalCard key={g.id} g={g} members={members} me={user.id} />)}</div>
          </>)}

          {family && (<>
            <div className="flex items-baseline justify-between pt-2">
              <h2 className="h2">Общие цели семьи «{family.name}»</h2>
              <Link href="/goals/new?visibility=family" className="text-sm text-accent">+ общая цель</Link>
            </div>
            {fam.length ? <div className="grid gap-3 sm:grid-cols-2">{fam.map((g) => <GoalCard key={g.id} g={g} members={members} me={user.id} />)}</div>
              : <Empty>Общих целей пока нет — например, «отпуск вместе летом» или «подушка безопасности».</Empty>}
          </>)}
        </section>

        <aside className="space-y-6">
          <section className="card space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="h2">Эта неделя</h2>
              <span className="muted">{done}/{tasks.length}</span>
            </div>
            {tasks.length > 0 && <ProgressBar value={tasks.length ? Math.round((done / tasks.length) * 100) : 0} />}
            <TaskList tasks={tasks} goalTitles={titles} />
            <Link href="/week" className="text-sm text-accent">Все задачи и обзор →</Link>
          </section>

          {scores && (
            <section className="card space-y-2">
              <div className="flex items-baseline justify-between"><h2 className="h2">Колесо жизни</h2><Link href="/wheel" className="text-sm text-accent">обновить</Link></div>
              {SPHERES.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5">{s.emoji}</span>
                  <ProgressBar value={(scores[s.id] ?? 0) * 10} color={s.color} />
                  <span className="w-5 text-right text-muted">{scores[s.id] ?? "—"}</span>
                </div>
              ))}
            </section>
          )}

          <Link href="/coach" className="card block bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
            <div className="font-semibold">✨ ИИ-коуч {!AI_ENABLED && <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-xs">скоро</span>}</div>
            <div className="text-sm opacity-90">{AI_ENABLED ? "Спросите, с чего начать, как разбить цель или почему не получается." : "Личный коуч, который знает ваши цели. Уже готовим!"}</div>
          </Link>
        </aside>
      </div>
    </div>
  );
}
