import Link from "next/link";
import { Empty, GoalCard } from "@/components/bits";
import { AiFeedback, ReviewForm } from "@/components/ReviewForm";
import { FAMILY_REVIEW_QUESTIONS, fmtDate, monthStart } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { listGoals, reviewHistory } from "@/lib/data";
import { addFamilyGoal } from "../actions";
import { Soon } from "@/components/Soon";
import { AI_ENABLED } from "@/lib/flags";
import { CopyCode, CreateJoin, FamilyGoalIdeas, NameForm } from "./FamilyForms";

export default async function FamilyPage() {
  const { user, me, family, members, ctx } = await getSession();
  if (!family) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="h1">Семья</h1>
          <p className="muted">Один создаёт семью, второй присоединяется по коду. Личные цели остаются личными, пока вы сами не решите показать их.</p>
        </div>
        <div className="card"><div className="label">Ваше имя</div><NameForm name={me.name ?? ""} /></div>
        <CreateJoin />
      </div>
    );
  }

  const month = monthStart();
  const [all, reviews] = await Promise.all([listGoals(ctx, { status: "not_dropped" }), reviewHistory(ctx, "family", 6)]);
  const goals = all.filter((g) => g.family_id === family.id);
  const common = goals.filter((g) => g.visibility === "family");
  const shared = goals.filter((g) => g.visibility === "shared" && g.owner_id !== user.id);
  const thisMonth = reviews.find((r) => r.period_start === month);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Семья «{family.name}»</h1>
        <p className="muted">Общие цели, видение семьи и ежемесячный разговор вдвоём.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2">
          <div className="h2">Участники</div>
          <ul className="text-sm">{members.map((m) => <li key={m.id}>👤 {m.name}{m.id === user.id && " (вы)"}</li>)}</ul>
          {members.length < 2 && <p className="muted">Отправьте код жене/мужу — пусть войдёт на сайт и введёт его в разделе «Семья».</p>}
          <div className="flex items-center gap-2 pt-1"><span className="muted">Код приглашения:</span><CopyCode code={family.invite_code} /></div>
        </div>
        <div className="card space-y-2">
          <div className="h2">Видение семьи</div>
          <p className="muted">Где и как вы живёте через 5 лет, что для вас главное.</p>
          <Link href="/vision?tab=family" className="btn-ghost">Открыть →</Link>
          <div className="pt-2"><div className="label">Ваше имя</div><NameForm name={me.name ?? ""} /></div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="h2">Общие цели</h2>
          <Link href="/goals/new?visibility=family" className="text-sm text-accent">+ общая цель</Link>
        </div>
        {common.length ? <div className="grid gap-3 sm:grid-cols-2">{common.map((g) => <GoalCard key={g.id} g={g} members={members} me={user.id} />)}</div>
          : <Empty>Общих целей пока нет.</Empty>}
        {AI_ENABLED ? <FamilyGoalIdeas addAction={addFamilyGoal} />
          : <Soon title="Идеи общих целей" text="ИИ посмотрит видение семьи и цели обоих и предложит общие — и подскажет, если цели конфликтуют по деньгам или времени." />}
      </section>

      {shared.length > 0 && (
        <section className="space-y-3">
          <h2 className="h2">Цели партнёра, которыми он(а) поделился(ась)</h2>
          <div className="grid gap-3 sm:grid-cols-2">{shared.map((g) => <GoalCard key={g.id} g={g} members={members} me={user.id} />)}</div>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="h2">Семейный обзор месяца</h2>
        {thisMonth ? (<>
          <dl className="space-y-2 text-sm">
            {FAMILY_REVIEW_QUESTIONS.map((q) => thisMonth.answers[q.id] ? (
              <div key={q.id}><dt className="text-muted">{q.q}</dt><dd className="whitespace-pre-wrap">{thisMonth.answers[q.id]}</dd></div>) : null)}
          </dl>
          {AI_ENABLED ? <AiFeedback reviewId={thisMonth.id} initial={thisMonth.ai_feedback} />
            : <Soon compact title="Разбор семейного обзора" text="Коуч даст разбор для вас обоих: что получилось, где буксуете и что сделать вместе в следующем месяце." />}
        </>) : (<>
          <p className="muted">Сядьте вдвоём раз в месяц на 30 минут и ответьте вместе.</p>
          <ReviewForm kind="family" periodStart={month} questions={FAMILY_REVIEW_QUESTIONS} />
        </>)}
        {reviews.filter((r) => r.period_start !== month).length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Прошлые месяцы</summary>
            {reviews.filter((r) => r.period_start !== month).map((r) => (
              <div key={r.id} className="mt-2 border-t border-line pt-2">
                <b>{fmtDate(r.period_start)}</b>
                {FAMILY_REVIEW_QUESTIONS.map((q) => r.answers[q.id] ? <p key={q.id}><span className="text-muted">{q.q} </span>{r.answers[q.id]}</p> : null)}
              </div>
            ))}
          </details>
        )}
      </section>
    </div>
  );
}
