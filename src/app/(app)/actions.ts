"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { childHorizon, weekStart } from "@/lib/constants";

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

// ------------------------------------------------------------ profile
export async function updateName(_: ActionState, f: FormData): Promise<ActionState> {
  const { supabase, user } = await getSession();
  const { error } = await supabase.from("profiles").update({ name: str(f, "name") }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------ vision & wheel
export async function saveVision(_: ActionState, f: FormData): Promise<ActionState> {
  const { supabase, user, family } = await getSession();
  const scope = str(f, "scope");
  const answers: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("q_") && typeof v === "string") answers[k.slice(2)] = v;
  const familyId = scope === "family" ? family?.id ?? null : null;
  if (scope === "family" && !familyId) return { error: "Сначала создайте семью или присоединитесь к ней" };

  let q = supabase.from("visions").select("id").limit(1);
  q = familyId ? q.eq("family_id", familyId) : q.eq("owner_id", user.id).is("family_id", null);
  const { data: existing } = await q.maybeSingle();
  const { error } = existing
    ? await supabase.from("visions").update({ answers, updated_at: new Date().toISOString() }).eq("id", existing.id)
    : await supabase.from("visions").insert({ owner_id: user.id, family_id: familyId, answers });
  if (error) return { error: error.message };
  revalidatePath("/vision");
  return { ok: true };
}

export async function saveWheel(scores: Record<string, number>): Promise<ActionState> {
  const { supabase, user } = await getSession();
  const { error } = await supabase.from("wheel_scores").insert({ user_id: user.id, scores });
  if (error) return { error: error.message };
  revalidatePath("/wheel");
  revalidatePath("/");
  return { ok: true };
}

// ------------------------------------------------------------ goals
function goalFields(f: FormData) {
  return {
    title: str(f, "title"),
    why: str(f, "why"),
    sphere: str(f, "sphere") ?? "career",
    horizon: str(f, "horizon") ?? "1y",
    metric: str(f, "metric"),
    target: num(f, "target"),
    unit: str(f, "unit"),
    deadline: str(f, "deadline"),
    visibility: (str(f, "visibility") ?? "private") as "private" | "shared" | "family",
    parent_id: str(f, "parent_id"),
    assignee_id: str(f, "assignee_id"),
  };
}

export async function createGoal(_: ActionState, f: FormData): Promise<ActionState> {
  const { supabase, user, family } = await getSession();
  const g = goalFields(f);
  if (!g.title) return { error: "Напишите название цели" };
  if (g.visibility !== "private" && !family) return { error: "Чтобы делиться целями, создайте семью (раздел «Семья»)" };
  const { data, error } = await supabase
    .from("goals")
    .insert({ ...g, owner_id: user.id, family_id: g.visibility === "private" ? null : family!.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/goals");
  redirect(`/goals/${data.id}`);
}

export async function updateGoal(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  const { supabase, family } = await getSession();
  const g = goalFields(f);
  if (!g.title) return { error: "Напишите название цели" };
  if (g.visibility !== "private" && !family) return { error: "Чтобы делиться целями, создайте семью" };
  const { error } = await supabase
    .from("goals")
    .update({ ...g, family_id: g.visibility === "private" ? null : family!.id })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/goals/${id}`);
  revalidatePath("/goals");
  return { ok: true };
}

export async function setProgress(id: string, f: FormData) {
  const { supabase } = await getSession();
  const current = num(f, "current");
  if (current !== null) await supabase.from("goals").update({ current }).eq("id", id);
  revalidatePath(`/goals/${id}`);
  revalidatePath("/");
}

export async function setStatus(id: string, status: "active" | "done" | "dropped"): Promise<ActionState> {
  const { supabase } = await getSession();
  const { error } = await supabase.from("goals").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/goals/${id}`);
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteGoal(id: string) {
  const { supabase } = await getSession();
  await supabase.from("goals").delete().eq("id", id);
  revalidatePath("/goals");
  redirect("/goals");
}

/** Bulk-add sub-goals and weekly tasks suggested by the AI under `parentId`. */
export async function addSuggestions(
  parentId: string,
  goals: { title: string; deadline?: string | null; metric?: string | null; target?: number | null; unit?: string | null }[],
  tasks: string[],
): Promise<ActionState> {
  const { supabase, user } = await getSession();
  const { data: parent } = await supabase.from("goals").select("*").eq("id", parentId).single();
  if (!parent) return { error: "Цель не найдена" };
  const h = childHorizon(parent.horizon);
  if (goals.length && h) {
    const { error } = await supabase.from("goals").insert(goals.map((g) => ({
      owner_id: user.id, family_id: parent.family_id, visibility: parent.visibility, sphere: parent.sphere,
      horizon: h, parent_id: parentId, title: g.title, deadline: g.deadline || null, metric: g.metric || null,
      target: g.target ?? null, unit: g.unit || null,
    })));
    if (error) return { error: error.message };
  }
  if (tasks.length) {
    const { error } = await supabase.from("tasks").insert(tasks.map((t) => ({
      owner_id: user.id, goal_id: parentId, family_id: parent.visibility === "family" ? parent.family_id : null,
      title: t, week_start: weekStart(),
    })));
    if (error) return { error: error.message };
  }
  revalidatePath(`/goals/${parentId}`);
  revalidatePath("/goals");
  revalidatePath("/week");
  return { ok: true };
}

// ------------------------------------------------------------ tasks
export async function addTask(f: FormData) {
  const { supabase, user } = await getSession();
  const title = str(f, "title");
  if (!title) return;
  const goalId = str(f, "goal_id");
  let familyId: string | null = null;
  if (goalId) {
    const { data: g } = await supabase.from("goals").select("visibility, family_id").eq("id", goalId).single();
    if (g?.visibility === "family") familyId = g.family_id;
  }
  await supabase.from("tasks").insert({ owner_id: user.id, title, goal_id: goalId, family_id: familyId, week_start: str(f, "week_start") ?? weekStart() });
  revalidatePath("/week");
  revalidatePath("/");
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

export async function toggleTask(id: string, done: boolean) {
  const { supabase } = await getSession();
  await supabase.from("tasks").update({ done }).eq("id", id);
  revalidatePath("/week");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const { supabase } = await getSession();
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/week");
  revalidatePath("/");
}

// ------------------------------------------------------------ reviews
export async function saveReview(_: ActionState, f: FormData): Promise<ActionState & { id?: string }> {
  const { supabase, user, family } = await getSession();
  const kind = str(f, "kind") === "family" ? "family" : "weekly";
  if (kind === "family" && !family) return { error: "Нет семьи" };
  const answers: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("q_") && typeof v === "string") answers[k.slice(2)] = v;
  const { data, error } = await supabase
    .from("reviews")
    .insert({ user_id: user.id, family_id: kind === "family" ? family!.id : null, kind, period_start: str(f, "period_start"), answers })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/week");
  revalidatePath("/family");
  return { ok: true, id: data.id };
}

// ------------------------------------------------------------ family
export async function createFamily(_: ActionState, f: FormData): Promise<ActionState> {
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("create_family", { fname: str(f, "name") ?? "Наша семья" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function joinFamily(_: ActionState, f: FormData): Promise<ActionState> {
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("join_family", { code: str(f, "code") ?? "" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Add one AI-suggested common family goal. */
export async function addFamilyGoal(g: { title: string; sphere: string; horizon: string; why: string; deadline: string | null }): Promise<ActionState> {
  const { supabase, user, family } = await getSession();
  if (!family) return { error: "Нет семьи" };
  const { error } = await supabase.from("goals").insert({
    owner_id: user.id, family_id: family.id, visibility: "family", title: g.title, sphere: g.sphere,
    horizon: g.horizon, why: g.why, deadline: g.deadline || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/family");
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}

export async function clearChat() {
  const { supabase, user } = await getSession();
  await supabase.from("chat_messages").delete().eq("user_id", user.id);
  revalidatePath("/coach");
}
