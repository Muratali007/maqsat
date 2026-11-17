"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { childHorizon, weekStart } from "@/lib/constants";
import * as data from "@/lib/data";
import { dbError, q } from "@/lib/db";
import { getSession } from "@/lib/session";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const num = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v === null) return null;
  const n = Number(v.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
};
const answersOf = (f: FormData) => {
  const a: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("q_") && typeof v === "string") a[k.slice(2)] = v.slice(0, 5000);
  return a;
};
const fail = (e: unknown): ActionState => ({ error: dbError(e) });

// ------------------------------------------------------------ profile
export async function updateName(_: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await getSession();
  const name = str(f, "name");
  if (!name) return { error: "Имя не может быть пустым" };
  await q("update users set name = $2 where id = $1", [user.id, name.slice(0, 80)]);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------ vision & wheel
export async function saveVision(_: ActionState, f: FormData): Promise<ActionState> {
  const { ctx } = await getSession();
  try {
    await data.saveVision(ctx, str(f, "scope") === "family" ? "family" : "personal", answersOf(f));
  } catch (e) { return fail(e); }
  revalidatePath("/vision");
  return { ok: true };
}

export async function saveWheel(scores: Record<string, number>): Promise<ActionState> {
  const { ctx } = await getSession();
  const clean = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.max(1, Math.min(10, Math.round(Number(v) || 1)))]));
  await data.saveWheel(ctx, clean);
  revalidatePath("/wheel");
  revalidatePath("/");
  return { ok: true };
}

// ------------------------------------------------------------ goals
function goalInput(f: FormData): data.GoalInput {
  const vis = str(f, "visibility");
  return {
    title: (str(f, "title") ?? "").slice(0, 300),
    why: str(f, "why"),
    sphere: str(f, "sphere") ?? "career",
    horizon: str(f, "horizon") ?? "1y",
    metric: str(f, "metric"),
    target: num(f, "target"),
    unit: str(f, "unit"),
    deadline: str(f, "deadline"),
    visibility: vis === "shared" || vis === "family" ? vis : "private",
    parent_id: str(f, "parent_id"),
    assignee_id: str(f, "assignee_id"),
  };
}

export async function createGoal(_: ActionState, f: FormData): Promise<ActionState> {
  const { ctx } = await getSession();
  const g = goalInput(f);
  if (!g.title) return { error: "Напишите название цели" };
  let id: string;
  try { id = await data.insertGoal(ctx, g); } catch (e) { return fail(e); }
  revalidatePath("/goals");
  redirect(`/goals/${id}`);
}

export async function updateGoal(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  const { ctx } = await getSession();
  const g = goalInput(f);
  if (!g.title) return { error: "Напишите название цели" };
  try { await data.updateGoal(ctx, id, g); } catch (e) { return fail(e); }
  revalidatePath(`/goals/${id}`);
  revalidatePath("/goals");
  return { ok: true };
}

export async function setProgress(id: string, f: FormData) {
  const { ctx } = await getSession();
  const current = num(f, "current");
  if (current !== null) await data.setGoalField(ctx, id, "current", current);
  revalidatePath(`/goals/${id}`);
  revalidatePath("/");
}

export async function setStatus(id: string, status: "active" | "done" | "dropped"): Promise<ActionState> {
  const { ctx } = await getSession();
  if (!["active", "done", "dropped"].includes(status)) return { error: "Неверный статус" };
  try { await data.setGoalField(ctx, id, "status", status); } catch (e) { return fail(e); }
  revalidatePath(`/goals/${id}`);
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteGoal(id: string) {
  const { ctx } = await getSession();
  await data.deleteGoal(ctx, id);
  revalidatePath("/goals");
  redirect("/goals");
}

/** Bulk-add sub-goals and weekly tasks suggested by the AI under `parentId`. */
export async function addSuggestions(
  parentId: string,
  goals: { title: string; deadline?: string | null; metric?: string | null; target?: number | null; unit?: string | null }[],
  tasks: string[],
): Promise<ActionState> {
  const { ctx } = await getSession();
  const parent = await data.getGoal(ctx, parentId);
  if (!parent || !data.canEdit(ctx, parent)) return { error: "Цель не найдена" };
  const h = childHorizon(parent.horizon);
  try {
    if (h) for (const g of goals) {
      await data.insertGoal(ctx, {
        title: g.title, why: null, sphere: parent.sphere, horizon: h, metric: g.metric ?? null, target: g.target ?? null,
        unit: g.unit ?? null, deadline: g.deadline ?? null, visibility: parent.visibility, parent_id: parentId, assignee_id: null,
      });
    }
    for (const t of tasks) await data.insertTask(ctx, t, parentId, weekStart());
  } catch (e) { return fail(e); }
  revalidatePath(`/goals/${parentId}`);
  revalidatePath("/goals");
  revalidatePath("/week");
  return { ok: true };
}

/** Add one AI-suggested common family goal. */
export async function addFamilyGoal(g: { title: string; sphere: string; horizon: string; why: string; deadline: string | null }): Promise<ActionState> {
  const { ctx } = await getSession();
  try {
    await data.insertGoal(ctx, {
      title: g.title, why: g.why, sphere: g.sphere, horizon: g.horizon, metric: null, target: null, unit: null,
      deadline: g.deadline, visibility: "family", parent_id: null, assignee_id: null,
    });
  } catch (e) { return fail(e); }
  revalidatePath("/family");
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}

// ------------------------------------------------------------ tasks
export async function addTask(f: FormData) {
  const { ctx } = await getSession();
  const title = str(f, "title");
  if (!title) return;
  const goalId = str(f, "goal_id");
  const week = str(f, "week_start");
  await data.insertTask(ctx, title.slice(0, 300), goalId, week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : weekStart());
  revalidatePath("/week");
  revalidatePath("/");
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

export async function toggleTask(id: string, done: boolean) {
  const { ctx } = await getSession();
  await data.setTaskDone(ctx, id, done);
  revalidatePath("/week");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const { ctx } = await getSession();
  await data.removeTask(ctx, id);
  revalidatePath("/week");
  revalidatePath("/");
}

// ------------------------------------------------------------ reviews
export async function saveReview(_: ActionState, f: FormData): Promise<ActionState> {
  const { ctx } = await getSession();
  const kind = str(f, "kind") === "family" ? "family" : "weekly";
  const period = str(f, "period_start");
  if (!period || !/^\d{4}-\d{2}-\d{2}$/.test(period)) return { error: "Неверная дата" };
  try { await data.insertReview(ctx, kind, period, answersOf(f)); } catch (e) { return fail(e); }
  revalidatePath("/week");
  revalidatePath("/family");
  return { ok: true };
}

// ------------------------------------------------------------ family
export async function createFamily(_: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await getSession();
  try { await data.createFamily(user.id, (str(f, "name") ?? "Наша семья").slice(0, 80)); } catch (e) { return fail(e); }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function joinFamily(_: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await getSession();
  try { await data.joinFamily(user.id, str(f, "code") ?? ""); } catch (e) { return fail(e); }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------ AI chat
export async function clearChat() {
  const { ctx } = await getSession();
  await data.clearChat(ctx);
  revalidatePath("/coach");
}
