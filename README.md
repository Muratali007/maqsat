# 🎯 Цели — карта жизни семьи

Сайт для двоих (муж и жена): видение жизни, колесо 7 сфер, каскад целей 10 лет → 3 года → 1 год → 90 дней → задачи недели,
воскресный обзор, общие семейные цели и ИИ-коуч на Claude.

Стек: **Next.js 16** (App Router) · **Supabase** (вход + Postgres с RLS) · **Anthropic API** (Claude) · деплой на **Vercel**.

## Запуск локально

1. **Supabase** (бесплатно): supabase.com → New project.
   - SQL Editor → New query → вставить `supabase/schema.sql` → Run.
   - Project Settings → API: скопировать `Project URL` и `anon`/`publishable` key в `.env.local`.
   - Authentication → URL Configuration → Site URL: `http://localhost:3000`, Redirect URLs: `http://localhost:3000/auth/callback`.
   - Вход по почте (magic link) работает сразу. Google — Authentication → Providers → Google (нужен OAuth Client в Google Cloud Console).
2. **Claude** (пока выключен — на сайте плашки «скоро»; включить: `NEXT_PUBLIC_AI_ENABLED=1`): console.anthropic.com → API Keys → создать ключ → `ANTHROPIC_API_KEY` в `.env.local`.
   (Это отдельный от подписки Claude Pro счёт: оплата за использование, пополняется в Billing.)
3. `npm install && npm run dev` → http://localhost:3000

## Деплой на Vercel
1. Залить репозиторий на GitHub → vercel.com → Add New Project → импорт.
2. Environment Variables: переменные из `.env.local` (без ИИ достаточно двух `NEXT_PUBLIC_SUPABASE_*`).
3. В Supabase добавить прод-адрес в Site URL / Redirect URLs (`https://<домен>/auth/callback`).

## Как устроено
- `supabase/schema.sql` — таблицы и правила доступа (RLS). Приватность обеспечивает база, а не только интерфейс:
  `private` — видит только автор; `shared` — личная, видна семье; `family` — общая, редактируют оба.
  Лимит «не больше 5 целей на год» — триггер в базе.
- `src/lib/ai.ts` — ИИ: модель `claude-opus-5-5` (можно сменить через `ANTHROPIC_MODEL`), контекст пользователя
  (`buildContext`), структурированные ответы (Zod), серверный fallback при отказе модели.
- `src/app/api/ai/*` — SMART-помощник, разбивка цели на шаги, разбор обзора, идеи семейных целей; `src/app/api/coach` — чат (стриминг).
- `src/app/(app)/*` — страницы; `actions.ts` — все записи в базу (server actions).
- `src/proxy.ts` — обновляет сессию и закрывает страницы от неавторизованных (в Next 16 middleware называется proxy).
