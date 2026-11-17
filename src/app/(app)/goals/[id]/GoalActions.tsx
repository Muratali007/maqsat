"use client";

import { useState, useTransition } from "react";
import { deleteGoal, setStatus } from "../../actions";

export function GoalActions({ id, status, canDelete }: { id: string; status: string; canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (s: "active" | "done" | "dropped") => start(async () => { const r = await setStatus(id, s); setErr(r?.error ?? null); });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <>
          <button className="btn-primary" disabled={pending} onClick={() => run("done")}>✅ Цель достигнута</button>
          <button className="btn-ghost" disabled={pending} onClick={() => run("dropped")}>Отказаться</button>
        </>
      ) : (
        <button className="btn-ghost" disabled={pending} onClick={() => run("active")}>Вернуть в работу</button>
      )}
      {canDelete && (
        <button className="btn-ghost text-red-600" disabled={pending}
          onClick={() => { if (window.confirm("Удалить цель навсегда?")) start(() => deleteGoal(id)); }}>Удалить</button>
      )}
      {err && <p className="w-full text-sm text-red-600">{err}</p>}
    </div>
  );
}
