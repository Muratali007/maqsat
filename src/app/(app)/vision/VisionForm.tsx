"use client";

import { useActionState } from "react";
import { saveVision } from "../actions";
import { Notice, Submit, keepValues } from "@/components/ui";

export function VisionForm({ scope, questions, answers }: { scope: "personal" | "family"; questions: { id: string; q: string }[]; answers: Record<string, string> }) {
  const [state, action, busy] = useActionState(saveVision, undefined);
  return (
    <form onSubmit={keepValues(action)} className="space-y-4">
      <input type="hidden" name="scope" value={scope} />
      {questions.map((q) => (
        <div key={q.id}>
          <label className="label">{q.q}</label>
          <textarea name={`q_${q.id}`} defaultValue={answers[q.id] ?? ""} rows={2} className="input" />
        </div>
      ))}
      <div className="flex items-center gap-3"><Submit busy={busy}>Сохранить</Submit><Notice state={state} /></div>
    </form>
  );
}
