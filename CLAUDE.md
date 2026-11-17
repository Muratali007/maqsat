@AGENTS.md

# Мақсат — семейный трекер целей

Общаться с владельцем по-русски. Подробности — README.md. Стек и деплой как у Казыны (`../family-budget`): Render + Neon + GitHub `Muratali007`.

- Next.js 16: `proxy.ts` вместо middleware, `params`/`searchParams`/`cookies()` только async, типы `PageProps<"/route">`.
  Перед изменениями сверяться с `node_modules/next/dist/docs/`. `cacheComponents` выключен сознательно.
- Tailwind 4: свои классы (`card`, `btn-primary`, `input`…) — через `@utility` в `globals.css`.
- База: `src/lib/db.ts` (pg при `DATABASE_URL`, иначе PGlite). Доступ к данным — ТОЛЬКО через `src/lib/data.ts`, там правила приватности.
  Меняя правила — дописывать `test/access.test.ts`.
- Формы с `useActionState` отправляются через `keepValues()` (ui.tsx), чтобы React 19 не стирал введённое при ошибке.
- ИИ выключен (решение владельца): `NEXT_PUBLIC_AI_ENABLED=0` → компонент `Soon` («скоро»). Код в `src/lib/ai.ts`, модель `claude-opus-5-5`.
- Проверка: `npx tsc --noEmit && npx eslint src test && npm test && npm run build`.
- Никогда не направлять тесты (`npm test` с `DATABASE_URL`) на прод-базу Neon.
