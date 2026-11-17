"use client";

import { useOptimistic, useTransition } from "react";
import { deleteTask, toggleTask } from "@/app/(app)/actions";
import type { Task } from "@/lib/types";

export function TaskList({ tasks, goalTitles = {} }: { tasks: Task[]; goalTitles?: Record<string, string> }) {
  const [, start] = useTransition();
  const [list, setList] = useOptimistic(tasks, (cur: Task[], u: { id: string; done?: boolean; remove?: boolean }) =>
    u.remove ? cur.filter((t) => t.id !== u.id) : cur.map((t) => (t.id === u.id ? { ...t, done: !!u.done } : t)));

  if (!list.length) return <p className="muted">Задач пока нет.</p>;
  return (
    <ul className="divide-y divide-line">
      {list.map((t) => (
        <li key={t.id} className="group flex items-center gap-3 py-2">
          <input type="checkbox" checked={t.done} className="size-4 accent-[var(--accent)]"
            onChange={(e) => { const done = e.target.checked; start(async () => { setList({ id: t.id, done }); await toggleTask(t.id, done); }); }} />
          <div className="flex-1">
            <div className={t.done ? "text-muted line-through" : ""}>{t.title}</div>
            {t.goal_id && goalTitles[t.goal_id] && <div className="text-xs text-muted">🎯 {goalTitles[t.goal_id]}</div>}
          </div>
          <button className="text-xs text-muted opacity-0 transition group-hover:opacity-100 hover:text-red-600"
            onClick={() => start(async () => { setList({ id: t.id, remove: true }); await deleteTask(t.id); })}>удалить</button>
        </li>
      ))}
    </ul>
  );
}
