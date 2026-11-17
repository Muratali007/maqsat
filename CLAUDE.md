@AGENTS.md

# Цели — семейный трекер целей

Общаться с владельцем по-русски. Подробности установки и устройства — README.md.

- Next.js 16: `proxy.ts` вместо middleware, `params`/`searchParams`/`cookies()` только async, типы `PageProps<"/route">`.
  Перед изменениями сверяться с `node_modules/next/dist/docs/`. `cacheComponents` выключен сознательно (всё персональное, динамическое).
- Tailwind 4: свои классы (`card`, `btn-primary`, `input`…) объявлены через `@utility` в `globals.css`.
- Доступ к данным — только через RLS (`supabase/schema.sql`). Меняя схему, обновлять policy и этот файл.
- ИИ: `src/lib/ai.ts`, модель по умолчанию `claude-opus-5-5`, `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`),
  системный промпт неизменный (кэшируется), контекст пользователя — в первом user-сообщении.
- ИИ сейчас выключен (решение владельца): флаг `NEXT_PUBLIC_AI_ENABLED` (`src/lib/flags.ts`), при `0` вместо ИИ-кнопок компонент `Soon` («скоро»), API отвечает «скоро появятся».
- Проверка: `npx tsc --noEmit && npx eslint src && npm run build` (для build нужны NEXT_PUBLIC_SUPABASE_* в env).
