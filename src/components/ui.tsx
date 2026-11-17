"use client";

import { startTransition } from "react";
import { useFormStatus } from "react-dom";
import ReactMarkdown from "react-markdown";

export function Submit({ children, className = "btn-primary", pending: pendingText, busy }: { children: React.ReactNode; className?: string; pending?: string; busy?: boolean }) {
  const status = useFormStatus();
  const pending = busy ?? status.pending;
  return <button className={className} disabled={pending}>{pending ? pendingText ?? "Сохраняем…" : children}</button>;
}

/**
 * onSubmit handler that runs a useActionState action WITHOUT React's automatic form reset,
 * so typed text survives a validation error. Pair with <Submit busy={isPending}>.
 */
export function keepValues(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(fd));
  };
}

export function Markdown({ children }: { children: string }) {
  return <div className="prose-ai text-sm leading-relaxed"><ReactMarkdown>{children}</ReactMarkdown></div>;
}

export function Notice({ state }: { state?: { error?: string; ok?: boolean } }) {
  if (state?.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-green-600">Сохранено ✓</p>;
  return null;
}
