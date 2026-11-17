"use client";

import { useActionState, useRef, useState } from "react";
import { createGoal, updateGoal, type ActionState } from "../actions";
import { HORIZONS, SPHERES, VISIBILITY } from "@/lib/constants";
import { Notice, Submit } from "@/components/ui";
import type { Goal, Profile } from "@/lib/types";

type Smart = {
  title: string; metric: string; target: number | null; unit: string; deadline: string;
  checks: { letter: string; ok: boolean; tip: string }[]; comment: string;
};

export function GoalForm({ goal, defaults = {}, parents, members, hasFamily }: {
  goal?: Goal; defaults?: Partial<Goal>; parents: Pick<Goal, "id" | "title" | "horizon">[]; members: Profile[]; hasFamily: boolean;
}) {
  const action = goal ? updateGoal.bind(null, goal.id) : createGoal;
  const [state, formAction] = useActionState<ActionState, FormData>(action, undefined);
  const v = { ...defaults, ...goal };
  const form = useRef<HTMLFormElement>(null);
  const [visibility, setVisibility] = useState<string>(v.visibility ?? "private");
  const [ai, setAi] = useState<Smart | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const set = (name: string, value: string) => {
    const el = form.current?.elements.namedItem(name) as HTMLInputElement | null;
    if (el) el.value = value;
  };

  async function makeSmart() {
    const fd = new FormData(form.current!);
    if (!String(fd.get("title") ?? "").trim()) { setAiErr("Сначала напишите цель своими словами"); return; }
    setAiBusy(true); setAiErr(null);
    try {
      const res = await fetch("/api/ai/smart", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fd.entries())) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAi(json as Smart);
    } catch (e) { setAiErr(e instanceof Error ? e.message : "Ошибка"); }
    setAiBusy(false);
  }

  function applyAi() {
    if (!ai) return;
    set("title", ai.title); set("metric", ai.metric); set("unit", ai.unit);
    set("target", ai.target != null ? String(ai.target) : ""); set("deadline", ai.deadline);
    setAi(null);
  }

  return (
    <form ref={form} action={formAction} className="space-y-4">
      <div>
        <label className="label">Цель</label>
        <textarea name="title" rows={2} required defaultValue={v.title ?? ""} className="input" placeholder="Например: накопить подушку безопасности" />
      </div>
      <div className="rounded-xl border border-violet-300/60 bg-violet-50/60 p-3 dark:bg-violet-950/20">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={makeSmart} className="btn-ai" disabled={aiBusy}>{aiBusy ? "Думаю…" : "✨ Сделать SMART"}</button>
          <span className="text-xs text-muted">ИИ сделает цель конкретной, измеримой и со сроком</span>
        </div>
        {aiErr && <p className="mt-2 text-sm text-red-600">{aiErr}</p>}
        {ai && (
          <div className="mt-3 space-y-2 text-sm">
            <div className="font-medium">«{ai.title}»</div>
            <div className="text-muted">Метрика: {ai.metric} {ai.target != null && `· цель ${ai.target} ${ai.unit}`} · срок {ai.deadline}</div>
            <ul className="space-y-0.5">
              {ai.checks.map((c) => <li key={c.letter}>{c.ok ? "✅" : "⚠️"} <b>{c.letter}</b> — {c.tip}</li>)}
            </ul>
            {ai.comment && <p className="text-muted">{ai.comment}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={applyAi}>Подставить</button>
              <button type="button" className="btn-ghost" onClick={() => setAi(null)}>Не надо</button>
            </div>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Сфера</label>
          <select name="sphere" defaultValue={v.sphere ?? "career"} className="input">
            {SPHERES.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Горизонт</label>
          <select name="horizon" defaultValue={v.horizon ?? "1y"} className="input">
            {HORIZONS.map((h) => <option key={h.id} value={h.id}>{h.label} — {h.hint}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Зачем мне это? <span className="font-normal text-muted">(R — важна лично для меня)</span></label>
        <textarea name="why" rows={2} defaultValue={v.why ?? ""} className="input" placeholder="Чтобы семья чувствовала себя спокойно…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Как измерить</label>
          <input name="metric" defaultValue={v.metric ?? ""} className="input" placeholder="Сумма на счёте" />
        </div>
        <div>
          <label className="label">Цель (число)</label>
          <input name="target" inputMode="decimal" defaultValue={v.target ?? ""} className="input" placeholder="3000000" />
        </div>
        <div>
          <label className="label">Ед.</label>
          <input name="unit" defaultValue={v.unit ?? ""} className="input" placeholder="₸" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Срок</label>
          <input type="date" name="deadline" defaultValue={v.deadline ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Часть большой цели</label>
          <select name="parent_id" defaultValue={v.parent_id ?? ""} className="input">
            <option value="">— нет —</option>
            {parents.filter((p) => p.id !== goal?.id).map((p) => <option key={p.id} value={p.id}>[{p.horizon}] {p.title}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Кто видит</label>
          <select name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)} className="input">
            {VISIBILITY.map((o) => <option key={o.id} value={o.id} disabled={o.id !== "private" && !hasFamily}>{o.label}</option>)}
          </select>
          {!hasFamily && <p className="mt-1 text-xs text-muted">Делиться можно после создания семьи.</p>}
        </div>
        {visibility === "family" && (
          <div>
            <label className="label">Ответственный</label>
            <select name="assignee_id" defaultValue={v.assignee_id ?? ""} className="input">
              <option value="">Оба</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Submit>{goal ? "Сохранить" : "Создать цель"}</Submit>
        <Notice state={state} />
      </div>
    </form>
  );
}
