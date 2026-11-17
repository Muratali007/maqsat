export function Soon({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 dark:bg-violet-950/20 ${compact ? "p-3" : "p-5"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">✨ {title}</span>
        <span className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2 py-0.5 text-xs font-medium text-white">скоро</span>
      </div>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}
