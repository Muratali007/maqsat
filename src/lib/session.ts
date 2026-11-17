import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, readSession } from "@/lib/auth";
import { familyOf, membersOf, userById, type Ctx } from "@/lib/data";
import type { Family, Profile } from "@/lib/types";

export type Session = {
  user: { id: string; email: string };
  me: Profile;
  family: Family | null;
  members: Profile[];
  ctx: Ctx;
};

/** Signed-in user or null (no redirect) — for API routes. */
export async function currentSession(): Promise<Session | null> {
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  if (!s) return null;
  const u = await userById(s.uid);
  if (!u || u.token_version !== s.v) return null;
  const family = await familyOf(u.id);
  const members = family ? await membersOf(family.id) : [{ id: u.id, name: u.name }];
  return {
    user: { id: u.id, email: u.email },
    me: { id: u.id, name: u.name },
    family,
    members,
    ctx: { userId: u.id, familyId: family?.id ?? null },
  };
}

/** Signed-in user; redirects to /login otherwise. */
export async function getSession(): Promise<Session> {
  const s = await currentSession();
  if (!s) redirect("/login");
  return s;
}

export function nameOf(members: Profile[], id: string | null | undefined): string {
  if (!id) return "";
  return members.find((m) => m.id === id)?.name ?? "—";
}
