"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setError(error.message);
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="text-4xl">🎯</div>
          <h1 className="h1 mt-2">Цели</h1>
          <p className="muted mt-1">Карта жизни для вас двоих: видение, цели и ИИ-коуч</p>
        </div>
        <button onClick={google} className="btn-ghost w-full">
          <span className="font-bold text-[#4285F4]">G</span> Войти через Google
        </button>
        <div className="flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-line" />или по почте<div className="h-px flex-1 bg-line" />
        </div>
        {sent ? (
          <p className="rounded-xl bg-accent-soft p-3 text-sm">Мы отправили ссылку для входа на <b>{email}</b>. Откройте письмо на этом устройстве.</p>
        ) : (
          <form onSubmit={magic} className="space-y-3">
            <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Отправляем…" : "Получить ссылку для входа"}</button>
          </form>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
