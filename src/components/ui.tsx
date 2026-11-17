"use client";

import { useFormStatus } from "react-dom";
import ReactMarkdown from "react-markdown";

export function Submit({ children, className = "btn-primary", pending: pendingText }: { children: React.ReactNode; className?: string; pending?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? pendingText ?? "Сохраняем…" : children}</button>;
}

export function Markdown({ children }: { children: string }) {
  return <div className="prose-ai text-sm leading-relaxed"><ReactMarkdown>{children}</ReactMarkdown></div>;
}

export function Notice({ state }: { state?: { error?: string; ok?: boolean } }) {
  if (state?.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-green-600">Сохранено ✓</p>;
  return null;
}
