"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clearChat } from "../actions";
import { Markdown } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string };

const PROMPTS = [
  "С чего мне начать? Посмотри мои ответы и цели",
  "Какие 3–5 целей на год мне выбрать?",
  "Мои цели не конфликтуют между собой?",
  "Помоги составить план на эту неделю",
  "Почему я буксую и что поменять?",
];

export function Chat({ initial }: { initial: Msg[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: t }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: t }) });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + chunk }; return c; });
      }
    } catch (e) {
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Ошибка"}` }; return c; });
    }
    setBusy(false);
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col md:h-[calc(100vh-9rem)]">
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {!msgs.length && (
          <div className="card space-y-3">
            <p className="text-sm">Я вижу ваше видение, колесо жизни, цели, задачи и обзоры. Спросите что угодно о своих целях.</p>
            <div className="flex flex-wrap gap-2">
              {PROMPTS.map((p) => <button key={p} className="btn-ghost !py-1 text-left" onClick={() => send(p)}>{p}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-accent px-4 py-2 text-sm text-white" : "card max-w-[95%] !py-3"}>
              {m.role === "user" ? m.content : m.content ? <Markdown>{m.content}</Markdown> : <span className="muted animate-pulse">Думаю…</span>}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-line pt-3">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="Спросите коуча…" className="input resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
        <button className="btn-ai" disabled={busy || !input.trim()}>{busy ? "…" : "Отправить"}</button>
        {msgs.length > 0 && <button type="button" className="btn-ghost" title="Очистить чат" disabled={busy}
          onClick={() => { if (window.confirm("Очистить историю чата?")) start(async () => { await clearChat(); setMsgs([]); }); }}>🗑</button>}
      </form>
    </div>
  );
}
