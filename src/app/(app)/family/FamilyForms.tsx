"use client";

import { useActionState, useState, useTransition } from "react";
import { createFamily, joinFamily, updateName } from "../actions";
import { Notice, Submit } from "@/components/ui";
import { horizon, sphere } from "@/lib/constants";

export function CreateJoin() {
  const [cState, cAction] = useActionState(createFamily, undefined);
  const [jState, jAction] = useActionState(joinFamily, undefined);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={cAction} className="card space-y-3">
        <div className="h2">Создать семью</div>
        <p className="muted">Вы получите код приглашения для жены/мужа.</p>
        <input name="name" placeholder="Например: Амангали" className="input" />
        <Submit>Создать</Submit>
        <Notice state={cState} />
      </form>
      <form action={jAction} className="card space-y-3">
        <div className="h2">Присоединиться</div>
        <p className="muted">Введите код, который вам прислали.</p>
        <input name="code" required placeholder="AB12CD34" className="input uppercase" />
        <Submit>Присоединиться</Submit>
        <Notice state={jState} />
      </form>
    </div>
  );
}

export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateName, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input name="name" defaultValue={name} className="input max-w-60" />
      <Submit className="btn-ghost">Сохранить имя</Submit>
      <Notice state={state} />
    </form>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className="btn-ghost font-mono tracking-widest" onClick={async () => {
      await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500);
    }}>{code} {copied ? "✓" : "📋"}</button>
  );
}

type Suggestion = { title: string; sphere: string; horizon: string; why: string; deadline: string | null };

export function FamilyGoalIdeas({ addAction }: { addAction: (g: Suggestion) => Promise<{ error?: string } | undefined> }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<number[]>([]);
  const [pending, start] = useTransition();
  async function ask() {
    setBusy(true); setErr(null); setAdded([]);
    try {
      const res = await fetch("/api/ai/family-goals", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setList(json.goals); setComment(json.comment);
    } catch (e) { setErr(e instanceof Error ? e.message : "Ошибка"); }
    setBusy(false);
  }
  return (
    <div className="card space-y-3 border-violet-300/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="h2">✨ Идеи общих целей</div>
          <p className="muted">ИИ посмотрит ваши видения и цели обоих и предложит общие</p>
        </div>
        <button className="btn-ai" onClick={ask} disabled={busy}>{busy ? "Думаю…" : "Предложить"}</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {comment && <p className="text-sm text-muted">{comment}</p>}
      {list?.map((g, i) => (
        <div key={i} className="flex items-start justify-between gap-3 border-t border-line pt-2 text-sm">
          <div>
            <div className="font-medium">{sphere(g.sphere).emoji} {g.title}</div>
            <div className="text-muted">{horizon(g.horizon).label}{g.deadline && ` · до ${g.deadline}`} · {g.why}</div>
          </div>
          {added.includes(i) ? <span className="text-green-600">✓</span> : (
            <button className="btn-ghost shrink-0 !py-1" disabled={pending}
              onClick={() => start(async () => { const r = await addAction(g); if (r?.error) setErr(r.error); else setAdded([...added, i]); })}>+ Добавить</button>
          )}
        </div>
      ))}
    </div>
  );
}
