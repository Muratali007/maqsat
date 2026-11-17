"use client";

import { useState, useTransition } from "react";
import { addSuggestions } from "../../actions";

type Sub = { title: string; deadline: string | null; metric: string | null; target: number | null; unit: string | null };
type Plan = { goals: Sub[]; tasks: string[]; comment: string };

export function Breakdown({ goalId, childLabel }: { goalId: string; childLabel: string | null }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pickG, setPickG] = useState<boolean[]>([]);
  const [pickT, setPickT] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);

  async function ask() {
    setBusy(true); setErr(null); setSaved(false);
    try {
      const res = await fetch("/api/ai/breakdown", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goalId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPlan(json); setPickG(json.goals.map(() => true)); setPickT(json.tasks.map(() => true));
    } catch (e) { setErr(e instanceof Error ? e.message : "Ошибка"); }
    setBusy(false);
  }

  function save() {
    if (!plan) return;
    start(async () => {
      const r = await addSuggestions(goalId, plan.goals.filter((_, i) => pickG[i]), plan.tasks.filter((_, i) => pickT[i]));
      if (r?.error) setErr(r.error); else { setSaved(true); setPlan(null); }
    });
  }

  return (
    <div className="card space-y-3 border-violet-300/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="h2">✨ Разбить на шаги</div>
          <p className="muted">ИИ предложит {childLabel ? `цели на ${childLabel} и ` : ""}задачи на эту неделю</p>
        </div>
        <button className="btn-ai" onClick={ask} disabled={busy}>{busy ? "Думаю…" : plan ? "Ещё вариант" : "Предложить план"}</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {saved && <p className="text-sm text-green-600">Добавлено ✓</p>}
      {plan && (
        <div className="space-y-3 text-sm">
          {plan.comment && <p className="text-muted">{plan.comment}</p>}
          {plan.goals.length > 0 && <div>
            <div className="mb-1 font-medium">Цели на {childLabel}</div>
            {plan.goals.map((g, i) => (
              <label key={i} className="flex gap-2 py-1">
                <input type="checkbox" checked={pickG[i]} onChange={(e) => setPickG(pickG.map((v, j) => (j === i ? e.target.checked : v)))} />
                <span>{g.title}{g.deadline && <span className="text-muted"> · до {g.deadline}</span>}{g.target != null && <span className="text-muted"> · {g.target} {g.unit}</span>}</span>
              </label>
            ))}
          </div>}
          {plan.tasks.length > 0 && <div>
            <div className="mb-1 font-medium">Задачи на эту неделю</div>
            {plan.tasks.map((t, i) => (
              <label key={i} className="flex gap-2 py-1">
                <input type="checkbox" checked={pickT[i]} onChange={(e) => setPickT(pickT.map((v, j) => (j === i ? e.target.checked : v)))} />
                <span>{t}</span>
              </label>
            ))}
          </div>}
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Добавляем…" : "Добавить выбранное"}</button>
        </div>
      )}
    </div>
  );
}
