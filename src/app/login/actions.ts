"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, checkPassword, cookieOptions, hashPassword, normEmail, signSession } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { joinFamily } from "@/lib/data";

export type AuthState = { error?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function startSession(id: string, version: number) {
  (await cookies()).set(COOKIE, await signSession(id, version), cookieOptions());
}

export async function login(_: AuthState, f: FormData): Promise<AuthState> {
  const email = normEmail(str(f, "email"));
  const password = str(f, "password");
  if (!email || !password) return { error: "Введите почту и пароль" };
  const tries = await one<{ n: number }>("select count(*)::int as n from login_attempts where email = $1 and at > now() - interval '15 minutes'", [email]);
  if ((tries?.n ?? 0) >= 10) return { error: "Слишком много попыток. Подождите 15 минут." };
  const u = await one<{ id: string; password_hash: string; token_version: number }>(
    "select id, password_hash, token_version from users where email = $1", [email]);
  if (!u || !(await checkPassword(password, u.password_hash))) {
    await q("insert into login_attempts (email) values ($1)", [email]);
    return { error: "Неверная почта или пароль" };
  }
  await q("delete from login_attempts where email = $1", [email]);
  await startSession(u.id, u.token_version);
  redirect("/");
}

export async function register(_: AuthState, f: FormData): Promise<AuthState> {
  const name = str(f, "name");
  const email = normEmail(str(f, "email"));
  const password = str(f, "password");
  const code = str(f, "code");
  if (!name) return { error: "Как вас зовут?" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Проверьте почту" };
  if (password.length < 6) return { error: "Пароль — минимум 6 символов" };
  if (await one("select 1 from users where email = $1", [email])) return { error: "Такая почта уже зарегистрирована — войдите" };
  const u = await one<{ id: string }>("insert into users (email, password_hash, name) values ($1,$2,$3) returning id",
    [email, await hashPassword(password), name]);
  if (code) {
    try { await joinFamily(u!.id, code); } catch { /* wrong code — they can join later in «Семья» */ }
  }
  await startSession(u!.id, 0);
  redirect(code ? "/family" : "/");
}
