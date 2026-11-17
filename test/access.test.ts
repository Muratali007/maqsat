// Privacy & rules of the data layer, on an in-memory Postgres (PGlite) — or a real one via DATABASE_URL in CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { one, q } from "../src/lib/db";
import * as data from "../src/lib/data";
import type { Ctx, GoalInput } from "../src/lib/data";

const goal = (over: Partial<GoalInput> = {}): GoalInput => ({
  title: "Цель", why: null, sphere: "finance", horizon: "1y", metric: null, target: null, unit: null,
  deadline: null, visibility: "private", parent_id: null, assignee_id: null, ...over,
});

async function user(name: string) {
  const u = await one<{ id: string }>("insert into users (email, password_hash, name) values ($1, 'x', $2) returning id",
    [`${name}-${Math.random().toString(36).slice(2)}@t.kz`, name]);
  return u!.id;
}
const ctxOf = async (id: string): Promise<Ctx> => ({ userId: id, familyId: (await data.familyOf(id))?.id ?? null });

test("family privacy: private / shared / family goals", async () => {
  const husband = await user("Муж"), wife = await user("Жена"), stranger = await user("Чужой");
  const fid = await data.createFamily(husband, "Семья");
  const code = (await data.familyOf(husband))!.invite_code;
  assert.equal(await data.joinFamily(wife, code), fid);
  await assert.rejects(data.joinFamily(wife, code), /уже/);
  const H = await ctxOf(husband), W = await ctxOf(wife), S = await ctxOf(stranger);

  const priv = await data.insertGoal(H, goal({ title: "Секрет" }));
  const shared = await data.insertGoal(H, goal({ title: "Видна жене", visibility: "shared" }));
  const fam = await data.insertGoal(W, goal({ title: "Отпуск", visibility: "family", horizon: "90d" }));

  const wifeSees = (await data.listGoals(W)).map((g) => g.title).sort();
  assert.deepEqual(wifeSees, ["Видна жене", "Отпуск"]);
  assert.equal(await data.getGoal(W, priv), null, "wife must not open husband's private goal");
  assert.equal((await data.listGoals(S)).length, 0, "stranger sees nothing");
  assert.equal(await data.getGoal(S, fam), null);

  // shared is read-only for the partner, family goal is editable by both
  await assert.rejects(data.setGoalField(W, shared, "current", 5), /не найдена/);
  await assert.rejects(data.updateGoal(W, priv, goal({ title: "взлом" })), /не найдена/);
  await data.setGoalField(H, fam, "current", 3);
  assert.equal((await data.getGoal(W, fam))!.current, 3);

  // a family goal stays family (even its creator can't hide it); partner can't change visibility of a shared goal
  await data.updateGoal(W, fam, goal({ title: "Отпуск летом", visibility: "private", horizon: "90d" }));
  await data.updateGoal(H, fam, goal({ title: "Отпуск летом", visibility: "private", horizon: "90d" }));
  assert.equal((await data.getGoal(H, fam))!.visibility, "family");
  assert.equal((await data.getGoal(W, fam))!.title, "Отпуск летом");
  // owner can still make a shared goal private again
  await data.updateGoal(H, shared, goal({ title: "Видна жене", visibility: "private" }));
  assert.equal(await data.getGoal(W, shared), null);
  await data.updateGoal(H, shared, goal({ title: "Видна жене", visibility: "shared" }));
  // delete is owner-only
  await data.deleteGoal(W, shared);
  assert.ok(await data.getGoal(H, shared), "wife can't delete husband's goal");

  // a private goal can't hang under a goal you can't see
  await assert.rejects(data.insertGoal(S, goal({ parent_id: fam })), /Родительская/);
});

test("tasks follow goal visibility", async () => {
  const a = await user("A"), b = await user("B");
  await data.createFamily(a, "F");
  await data.joinFamily(b, (await data.familyOf(a))!.invite_code);
  const A = await ctxOf(a), B = await ctxOf(b);
  const week = "2026-11-16";
  const famGoal = await data.insertGoal(A, goal({ visibility: "family", horizon: "90d" }));
  const privGoal = await data.insertGoal(A, goal({ horizon: "90d" }));
  await data.insertTask(A, "общая задача", famGoal, week);
  await data.insertTask(A, "личная задача", privGoal, week);
  await data.insertTask(A, "просто задача", null, week);
  assert.deepEqual((await data.tasksForWeek(B, week)).map((t) => t.title), ["общая задача"]);
  await assert.rejects(data.insertTask(B, "в чужую цель", privGoal, week), /не найдена/);
  const mine = (await data.tasksForWeek(A, week)).find((t) => t.title === "личная задача")!;
  await data.setTaskDone(B, mine.id, true);
  assert.equal((await data.tasksForWeek(A, week)).find((t) => t.id === mine.id)!.done, false, "partner can't tick private task");
});

test("max 5 personal goals per year, family goals don't count", async () => {
  const u = await user("Фокус");
  const U = await ctxOf(u);
  for (let i = 0; i < 5; i++) await data.insertGoal(U, goal({ title: `g${i}` }));
  await assert.rejects(data.insertGoal(U, goal({ title: "шестая" })), /Не больше 5/);
  await data.insertGoal(U, goal({ title: "на 90 дней", horizon: "90d" }));
  const first = (await data.listGoals(U))[0];
  await data.setGoalField(U, first.id, "status", "done");
  await data.insertGoal(U, goal({ title: "теперь можно" }));
});

test("visions: personal is private, family is shared; reviews", async () => {
  const a = await user("V1"), b = await user("V2");
  await data.createFamily(a, "F");
  await data.joinFamily(b, (await data.familyOf(a))!.invite_code);
  const A = await ctxOf(a), B = await ctxOf(b);
  await data.saveVision(A, "personal", { where: "дом" });
  await data.saveVision(A, "personal", { where: "свой дом" });
  await data.saveVision(B, "family", { home: "Астана" });
  assert.deepEqual(await data.getVision(A, "personal"), { where: "свой дом" });
  assert.deepEqual(await data.getVision(B, "personal"), {});
  assert.deepEqual(await data.getVision(A, "family"), { home: "Астана" });

  const wr = await data.insertReview(A, "weekly", "2026-11-16", { done: "много" });
  const fr = await data.insertReview(B, "family", "2026-11-01", { good: "отпуск" });
  assert.equal(await data.getReview(B, wr), null, "weekly review is personal");
  assert.ok(await data.getReview(A, fr), "family review visible to both");
  assert.equal((await data.reviewFor(A, "weekly", "2026-11-16"))!.answers.done, "много");
  const row = await one<{ n: number }>("select count(*)::int n from visions");
  assert.ok(row!.n >= 2);
  await q("select 1");
});
