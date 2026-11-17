"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AI_ENABLED } from "@/lib/flags";

const ITEMS = [
  { href: "/", label: "Главная", icon: "🏠" },
  { href: "/vision", label: "Видение", icon: "🔭" },
  { href: "/wheel", label: "Колесо жизни", icon: "🎡" },
  { href: "/goals", label: "Цели", icon: "🎯" },
  { href: "/week", label: "Неделя", icon: "🗓️" },
  { href: "/family", label: "Семья", icon: "👨‍👩‍👧" },
  { href: "/coach", label: "ИИ-коуч", icon: "✨" },
];

export function Nav({ name }: { name: string }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-card p-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-bold">🎯 Цели</Link>
        <nav className="flex flex-1 flex-col gap-1">
          {ITEMS.map((i) => (
            <Link key={i.href} href={i.href}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${active(i.href) ? "bg-accent-soft font-semibold text-accent" : "hover:bg-accent-soft"}`}>
              <span>{i.icon}</span>{i.label}
              {i.href === "/coach" && !AI_ENABLED && <span className="ml-auto rounded-full bg-accent-soft px-1.5 text-[10px] text-accent">скоро</span>}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line pt-3 text-sm">
          <div className="truncate font-medium">{name}</div>
          <form action="/auth/signout" method="post"><button className="mt-1 text-xs text-muted hover:underline">Выйти</button></form>
        </div>
      </aside>
      <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-line bg-card px-2 py-2 md:hidden">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${active(i.href) ? "bg-accent-soft font-semibold text-accent" : ""}`}>
            {i.icon} {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
