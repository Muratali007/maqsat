import { childHorizon } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { listGoals } from "@/lib/data";
import type { Goal } from "@/lib/types";
import { GoalForm } from "../GoalForm";

export default async function NewGoal(props: PageProps<"/goals/new">) {
  const sp = await props.searchParams;
  const { family, members, ctx } = await getSession();
  const parents = await listGoals(ctx, { status: "active", horizonNot: "90d" });
  const parent = parents.find((p) => p.id === sp.parent);
  const defaults: Partial<Goal> = parent
    ? { parent_id: parent.id, horizon: childHorizon(parent.horizon) ?? "90d", sphere: parent.sphere, visibility: parent.visibility }
    : { horizon: (sp.horizon as string) ?? "1y", visibility: (sp.visibility as Goal["visibility"]) ?? "private", sphere: (sp.sphere as string) ?? "career" };
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="h1">Новая цель</h1>
        {parent ? <p className="muted">Шаг к цели «{parent.title}»</p> : <p className="muted">Напишите своими словами — ИИ поможет сделать её конкретной.</p>}
      </div>
      <div className="card"><GoalForm defaults={defaults} parents={parents} members={members} hasFamily={!!family} /></div>
    </div>
  );
}
