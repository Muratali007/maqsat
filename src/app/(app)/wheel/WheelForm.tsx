"use client";

import { useState, useTransition } from "react";
import { saveWheel } from "../actions";
import { SPHERES } from "@/lib/constants";

function Radar({ scores }: { scores: Record<string, number> }) {
  const n = SPHERES.length, c = 130, R = 105;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * R * (v / 10), c + Math.sin(a) * R * (v / 10)];
  };
  const poly = SPHERES.map((s, i) => pt(i, scores[s.id] ?? 0).join(",")).join(" ");
  return (
    <svg viewBox="0 0 260 260" className="mx-auto w-full max-w-xs">
      {[2, 4, 6, 8, 10].map((r) => (
        <polygon key={r} points={SPHERES.map((_, i) => pt(i, r).join(",")).join(" ")} fill="none" stroke="var(--line)" />
      ))}
      <polygon points={poly} fill="var(--accent)" fillOpacity={0.2} stroke="var(--accent)" strokeWidth={2} />
      {SPHERES.map((s, i) => {
        const [x, y] = pt(i, 11.6);
        return <text key={s.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={16}>{s.emoji}</text>;
      })}
    </svg>
  );
}

export function WheelForm({ initial }: { initial: Record<string, number> }) {
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(SPHERES.map((s) => [s.id, initial[s.id] ?? 5])));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        {SPHERES.map((s) => (
          <div key={s.id}>
            <div className="flex justify-between text-sm"><span>{s.emoji} {s.label}</span><b>{scores[s.id]}</b></div>
            <input type="range" min={1} max={10} value={scores[s.id]} className="w-full" style={{ accentColor: s.color }}
              onChange={(e) => setScores({ ...scores, [s.id]: Number(e.target.value) })} />
          </div>
        ))}
        <button className="btn-primary" disabled={pending}
          onClick={() => start(async () => { const r = await saveWheel(scores); setMsg(r?.error ?? "Сохранено ✓"); })}>
          {pending ? "Сохраняем…" : "Сохранить оценку"}
        </button>
        {msg && <span className="ml-3 text-sm">{msg}</span>}
      </div>
      <Radar scores={scores} />
    </div>
  );
}
