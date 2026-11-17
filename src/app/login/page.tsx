"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { login, register } from "./actions";
import { Submit, keepValues } from "@/components/ui";

function Forms() {
  const params = useSearchParams();
  const invite = params.get("code") ?? "";
  const [mode, setMode] = useState<"login" | "register">(invite ? "register" : "login");
  const [lState, lAction, lBusy] = useActionState(login, undefined);
  const [rState, rAction, rBusy] = useActionState(register, undefined);
  return (
    <div className="card w-full max-w-sm space-y-5">
      <div className="text-center">
        <div className="text-4xl">🎯</div>
        <h1 className="h1 mt-2">Мақсат</h1>
        <p className="muted mt-1">Цели семьи: видение, цели на 10 лет → 90 дней и обзоры недели</p>
      </div>
      <div className="grid grid-cols-2 rounded-xl border border-line p-1 text-sm">
        <button onClick={() => setMode("login")} className={`rounded-lg py-1.5 ${mode === "login" ? "bg-accent text-white" : ""}`}>Вход</button>
        <button onClick={() => setMode("register")} className={`rounded-lg py-1.5 ${mode === "register" ? "bg-accent text-white" : ""}`}>Регистрация</button>
      </div>
      {mode === "login" ? (
        <form onSubmit={keepValues(lAction)} className="space-y-3">
          <input name="email" type="email" required autoComplete="email" placeholder="Почта" className="input" />
          <input name="password" type="password" required autoComplete="current-password" placeholder="Пароль" className="input" />
          <Submit className="btn-primary w-full" pending="Входим…" busy={lBusy}>Войти</Submit>
          {lState?.error && <p className="text-sm text-red-600">{lState.error}</p>}
        </form>
      ) : (
        <form onSubmit={keepValues(rAction)} className="space-y-3">
          <input name="name" required autoComplete="given-name" placeholder="Ваше имя" className="input" />
          <input name="email" type="email" required autoComplete="email" placeholder="Почта" className="input" />
          <input name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="Пароль (от 6 символов)" className="input" />
          <input name="code" defaultValue={invite} placeholder="Код семьи (если пригласили)" className="input uppercase" />
          <Submit className="btn-primary w-full" pending="Создаём…" busy={rBusy}>Создать аккаунт</Submit>
          {rState?.error && <p className="text-sm text-red-600">{rState.error}</p>}
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense><Forms /></Suspense>
    </main>
  );
}
