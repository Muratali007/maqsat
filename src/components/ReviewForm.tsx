"use client";

import { useActionState, useState } from "react";
import { saveReview } from "@/app/(app)/actions";
import { Markdown, Submit } from "@/components/ui";

export function ReviewForm({ kind, periodStart, questions }: { kind: "weekly" | "family"; periodStart: string; questions: { id: string; q: string }[] }) {
  const [state, action] = useActionState(saveReview, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="period_start" value={periodStart} />
      {questions.map((q) => (
        <div key={q.id}>
          <label className="label">{q.q}</label>
          <textarea name={`q_${q.id}`} rows={2} className="input" />
        </div>
      ))}
      <Submit>Сохранить обзор</Submit>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function AiFeedback({ reviewId, initial }: { reviewId: string; initial: string | null }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function ask() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/ai/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setText(json.text);
    } catch (e) { setErr(e instanceof Error ? e.message : "Ошибка"); }
    setBusy(false);
  }
  return (
    <div className="space-y-2 rounded-xl border border-violet-300/60 bg-violet-50/60 p-3 dark:bg-violet-950/20">
      {text ? <Markdown>{text}</Markdown> : <p className="muted">ИИ-коуч прочитает обзор вместе с вашими целями и подскажет, что поменять.</p>}
      <button className="btn-ai" onClick={ask} disabled={busy}>{busy ? "Думаю…" : text ? "Обновить разбор" : "✨ Разбор от ИИ"}</button>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
