/**
 * All reads/writes with access rules. Every query is scoped by the signed-in user (and their family):
 *   goal visible   = mine, or (shared|family) in my family
 *   goal editable  = mine, or family goal in my family
 *   task visible   = mine, or tied to my family
 *   review visible = mine, or family review of my family
 */
import { one, q } from "./db";
import type { Family, Goal, Profile, Review, Task } from "./types";

export type Ctx = { userId: string; familyId: string | null };

const GOAL_VISIBLE = `(g.owner_id = $1::uuid or (g.visibility in ('shared','family') and g.family_id = $2::uuid))`;

// ---------------------------------------------------------------- users & family
export async function userById(id: string) {
  return one<{ id: string; email: string; name: string; token_version: number }>(
    "select id, email, name, token_version from users where id = $1", [id]);
}

export async function familyOf(userId: string): Promise<Family | null> {
  return one<Family>(
    "select f.id, f.name, f.invite_code, f.created_by from families f join family_members m on m.family_id = f.id where m.user_id = $1", [userId]);
}

export async function membersOf(familyId: string): Promise<Profile[]> {
  return q<Profile>(
    "select u.id, u.name from users u join family_members m on m.user_id = u.id where m.family_id = $1 order by m.joined_at", [familyId]);
}

function inviteCode(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => A[Math.floor(Math.random() * A.length)]).join("");
}

export async function createFamily(userId: string, name: string): Promise<string> {
  if (await familyOf(userId)) throw new Error("Вы уже состоите в семье");
  const f = await one<{ id: string }>("insert into families (name, invite_code, created_by) values ($1, $2, $3) returning id",
    [name, inviteCode(), userId]);
  await q("insert into family_members (family_id, user_id) values ($1, $2)", [f!.id, userId]);
  return f!.id;
}

export async function joinFamily(userId: string, code: string): Promise<string> {
  if (await familyOf(userId)) throw new Error("Вы уже состоите в семье");
  const f = await one<{ id: string }>("select id from families where invite_code = $1", [code.trim().toUpperCase()]);
  if (!f) throw new Error("Код приглашения не найден");
  await q("insert into family_members (family_id, user_id) values ($1, $2)", [f.id, userId]);
  return f.id;
}

// ---------------------------------------------------------------- vision & wheel
export async function getVision(c: Ctx, scope: "personal" | "family"): Promise<Record<string, string>> {
  const row = scope === "family"
    ? c.familyId ? await one<{ answers: Record<string, string> }>("select answers from visions where family_id = $1", [c.familyId]) : null
    : await one<{ answers: Record<string, string> }>("select answers from visions where owner_id = $1 and family_id is null", [c.userId]);
  return row?.answers ?? {};
}

export async function saveVision(c: Ctx, scope: "personal" | "family", answers: Record<string, string>) {
  if (scope === "family") {
    if (!c.familyId) throw new Error("Сначала создайте семью или присоединитесь к ней");
    await q(`insert into visions (owner_id, family_id, answers) values ($1, $2, $3)
             on conflict (family_id) where family_id is not null do update set answers = excluded.answers, updated_at = now()`,
      [c.userId, c.familyId, JSON.stringify(answers)]);
  } else {
    await q(`insert into visions (owner_id, family_id, answers) values ($1, null, $2)
             on conflict (owner_id) where family_id is null do update set answers = excluded.answers, updated_at = now()`,
      [c.userId, JSON.stringify(answers)]);
  }
}

export async function wheelHistory(c: Ctx, limit = 6) {
  return q<{ scores: Record<string, number>; created_at: string }>(
    "select scores, created_at from wheel_scores where user_id = $1 order by created_at desc limit $2", [c.userId, limit]);
}

export async function saveWheel(c: Ctx, scores: Record<string, number>) {
  await q("insert into wheel_scores (user_id, scores) values ($1, $2)", [c.userId, JSON.stringify(scores)]);
}

// ---------------------------------------------------------------- goals
export async function listGoals(c: Ctx, opts: { status?: Goal["status"] | "not_dropped"; horizonNot?: string } = {}): Promise<Goal[]> {
  const where = [GOAL_VISIBLE];
  const params: unknown[] = [c.userId, c.familyId];
  if (opts.status === "not_dropped") where.push("g.status <> 'dropped'");
  else if (opts.status) { params.push(opts.status); where.push(`g.status = $${params.length}`); }
  if (opts.horizonNot) { params.push(opts.horizonNot); where.push(`g.horizon <> $${params.length}`); }
  return q<Goal>(`select g.* from goals g where ${where.join(" and ")} order by g.deadline nulls last, g.created_at`, params);
}

export async function getGoal(c: Ctx, id: string): Promise<Goal | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return one<Goal>(`select g.* from goals g where g.id = $3 and ${GOAL_VISIBLE}`, [c.userId, c.familyId, id]);
}

export function canEdit(c: Ctx, g: Goal): boolean {
  return g.owner_id === c.userId || (g.visibility === "family" && g.family_id === c.familyId);
}

export type GoalInput = {
  title: string; why: string | null; sphere: string; horizon: string; metric: string | null; target: number | null;
  unit: string | null; deadline: string | null; visibility: Goal["visibility"]; parent_id: string | null; assignee_id: string | null;
};

async function checkParent(c: Ctx, parentId: string | null) {
  if (parentId && !(await getGoal(c, parentId))) throw new Error("Родительская цель не найдена");
}

export async function insertGoal(c: Ctx, g: GoalInput): Promise<string> {
  if (g.visibility !== "private" && !c.familyId) throw new Error("Чтобы делиться целями, создайте семью (раздел «Семья»)");
  await checkParent(c, g.parent_id);
  const row = await one<{ id: string }>(
    `insert into goals (owner_id, family_id, visibility, sphere, horizon, parent_id, title, why, metric, target, unit, deadline, assignee_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
    [c.userId, g.visibility === "private" ? null : c.familyId, g.visibility, g.sphere, g.horizon, g.parent_id, g.title, g.why,
      g.metric, g.target, g.unit, g.deadline, g.visibility === "family" ? g.assignee_id : null]);
  return row!.id;
}

export async function updateGoal(c: Ctx, id: string, g: GoalInput) {
  const cur = await getGoal(c, id);
  if (!cur || !canEdit(c, cur)) throw new Error("Цель не найдена");
  if (g.visibility !== "private" && !c.familyId) throw new Error("Чтобы делиться целями, создайте семью");
  // A common family goal stays common (it belongs to both — stop it with «Отказаться»);
  // otherwise only the owner may change who sees a goal.
  const visibility = cur.visibility === "family" || cur.owner_id !== c.userId ? cur.visibility : g.visibility;
  if (g.parent_id === id) g.parent_id = null;
  await checkParent(c, g.parent_id);
  await q(`update goals set title=$2, why=$3, sphere=$4, horizon=$5, metric=$6, target=$7, unit=$8, deadline=$9,
             visibility=$10, family_id=$11, parent_id=$12, assignee_id=$13 where id=$1`,
    [id, g.title, g.why, g.sphere, g.horizon, g.metric, g.target, g.unit, g.deadline, visibility,
      visibility === "private" ? null : c.familyId, g.parent_id, visibility === "family" ? g.assignee_id : null]);
}

export async function setGoalField(c: Ctx, id: string, field: "current" | "status", value: number | string) {
  const cur = await getGoal(c, id);
  if (!cur || !canEdit(c, cur)) throw new Error("Цель не найдена");
  await q(`update goals set ${field === "current" ? "current" : "status"} = $2 where id = $1`, [id, value]);
}

export async function deleteGoal(c: Ctx, id: string) {
  await q("delete from goals where id = $1 and owner_id = $2", [id, c.userId]);
}

export async function childGoals(c: Ctx, id: string): Promise<Goal[]> {
  return q<Goal>(`select g.* from goals g where g.parent_id = $3 and g.status <> 'dropped' and ${GOAL_VISIBLE} order by g.deadline nulls last`,
    [c.userId, c.familyId, id]);
}

// ---------------------------------------------------------------- tasks
const TASK_VISIBLE = `(t.owner_id = $1::uuid or t.family_id = $2::uuid)`;

export async function tasksForWeek(c: Ctx, week: string): Promise<Task[]> {
  return q<Task>(`select t.* from tasks t where t.week_start = $3 and ${TASK_VISIBLE} order by t.created_at`, [c.userId, c.familyId, week]);
}

export async function tasksForGoal(c: Ctx, goalId: string): Promise<Task[]> {
  return q<Task>(`select t.* from tasks t where t.goal_id = $3 and ${TASK_VISIBLE} order by t.week_start desc, t.created_at`,
    [c.userId, c.familyId, goalId]);
}

export async function insertTask(c: Ctx, title: string, goalId: string | null, week: string) {
  let familyId: string | null = null;
  if (goalId) {
    const g = await getGoal(c, goalId);
    if (!g || !canEdit(c, g)) throw new Error("Цель не найдена");
    if (g.visibility === "family") familyId = g.family_id;
  }
  await q("insert into tasks (owner_id, goal_id, family_id, title, week_start) values ($1,$2,$3,$4,$5)", [c.userId, goalId, familyId, title, week]);
}

export async function setTaskDone(c: Ctx, id: string, done: boolean) {
  await q(`update tasks t set done = $4 where t.id = $3 and ${TASK_VISIBLE}`, [c.userId, c.familyId, id, done]);
}

export async function removeTask(c: Ctx, id: string) {
  await q(`delete from tasks t where t.id = $3 and ${TASK_VISIBLE}`, [c.userId, c.familyId, id]);
}

// ---------------------------------------------------------------- reviews
const REVIEW_VISIBLE = `(r.user_id = $1::uuid or (r.kind = 'family' and r.family_id = $2::uuid))`;

export async function reviewFor(c: Ctx, kind: "weekly" | "family", period: string): Promise<Review | null> {
  return kind === "family"
    ? c.familyId ? one<Review>("select * from reviews where kind = 'family' and family_id = $1 and period_start = $2 order by created_at desc limit 1", [c.familyId, period]) : null
    : one<Review>("select * from reviews where kind = 'weekly' and user_id = $1 and period_start = $2 order by created_at desc limit 1", [c.userId, period]);
}

export async function reviewHistory(c: Ctx, kind: "weekly" | "family", limit = 8): Promise<Review[]> {
  return kind === "family"
    ? c.familyId ? q<Review>("select * from reviews where kind = 'family' and family_id = $1 order by period_start desc limit $2", [c.familyId, limit]) : []
    : q<Review>("select * from reviews where kind = 'weekly' and user_id = $1 order by period_start desc limit $2", [c.userId, limit]);
}

export async function getReview(c: Ctx, id: string): Promise<Review | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return one<Review>(`select r.* from reviews r where r.id = $3 and ${REVIEW_VISIBLE}`, [c.userId, c.familyId, id]);
}

export async function insertReview(c: Ctx, kind: "weekly" | "family", period: string, answers: Record<string, string>): Promise<string> {
  if (kind === "family" && !c.familyId) throw new Error("Нет семьи");
  const r = await one<{ id: string }>("insert into reviews (user_id, family_id, kind, period_start, answers) values ($1,$2,$3,$4,$5) returning id",
    [c.userId, kind === "family" ? c.familyId : null, kind, period, JSON.stringify(answers)]);
  return r!.id;
}

export async function setReviewFeedback(c: Ctx, id: string, text: string) {
  await q(`update reviews r set ai_feedback = $4 where r.id = $3 and ${REVIEW_VISIBLE}`, [c.userId, c.familyId, id, text]);
}

// ---------------------------------------------------------------- AI chat
export async function chatHistory(c: Ctx, limit: number) {
  const rows = await q<{ role: "user" | "assistant"; content: string }>(
    "select role, content from chat_messages where user_id = $1 order by created_at desc limit $2", [c.userId, limit]);
  return rows.reverse();
}
export async function addChat(c: Ctx, role: "user" | "assistant", content: string) {
  await q("insert into chat_messages (user_id, role, content) values ($1,$2,$3)", [c.userId, role, content]);
}
export async function clearChat(c: Ctx) {
  await q("delete from chat_messages where user_id = $1", [c.userId]);
}
