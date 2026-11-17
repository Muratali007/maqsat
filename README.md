# 🎯 Мақсат — цели семьи

Сайт для двоих (муж и жена): видение жизни через 5 лет, колесо 7 сфер, каскад целей 10 лет → 3 года → 1 год → 90 дней → задачи недели,
воскресный обзор, общие семейные цели и ежемесячный обзор вдвоём. ИИ-коуч (Claude) встроен, но пока выключен — на его месте плашки «скоро».

Стек: **Next.js 16** · **Postgres** (Neon в проде, встроенный PGlite локально) · свой вход (почта + пароль, JWT-cookie) · **Render** + GitHub Actions.

## Запуск локально

```bash
npm install
npm run dev        # http://localhost:3000
```

Ничего настраивать не нужно: база — встроенный Postgres (PGlite) в `data/pglite`.

## Деплой: Render + Neon (как Казына)

1. **База:** Neon → проект `maqsat` → строка подключения `postgresql://…?sslmode=require`.
2. **Код:** github.com/Muratali007/maqsat (публичный — keepalive бесплатный).
3. **Render:** New → Blueprint → репозиторий (возьмётся `render.yaml`) → вставить `DATABASE_URL`. `JWT_SECRET` создастся сам.
4. **Автодеплой:** Render → сервис → Settings → Deploy Hook → в GitHub секрет `RENDER_DEPLOY_HOOK`. После зелёных тестов на `main` workflow сам дёргает хук.
5. **Чтобы не засыпал:** в GitHub → Settings → Variables → `SITE_URL` = адрес сайта; `keepalive.yml` пингует `/healthz` раз в 10 минут.

> На бесплатном Render сайт засыпает после 15 минут без запросов — keepalive это лечит. GitHub отключает расписание после 60 дней без коммитов (включить в Actions).

## Как устроено

- `src/lib/schema.ts` — схема (применяется сама при старте). Лимит «не больше 5 личных целей на год» — триггер в базе.
- `src/lib/data.ts` — **все** запросы с правилами доступа:
  `private` — видит только автор; `shared` — личная, видна семье (только чтение); `family` — общая, редактируют оба и она всегда остаётся общей.
- `src/lib/auth.ts`, `src/app/login/` — регистрация/вход (bcrypt, JWT в httpOnly-cookie, 10 попыток за 15 минут).
  Приглашение: ссылка `/login?code=КОД` или код в разделе «Семья».
- `src/app/(app)/` — страницы и `actions.ts` (все записи); `src/lib/ai.ts` + `src/app/api/` — ИИ (выключен флагом).
- `test/access.test.ts` — тесты приватности и правил (PGlite и Postgres 16 в CI).

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Postgres (Neon). Нет — встроенный PGlite |
| `JWT_SECRET` | секрет сессий (обязателен в проде) |
| `NEXT_PUBLIC_AI_ENABLED` | `1` — включить ИИ (нужен `ANTHROPIC_API_KEY`) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | ключ Claude и модель (по умолчанию `claude-opus-5-5`) |
