/** Idempotent schema — applied on server start (and in tests). Plain Postgres: Neon in prod, PGlite locally. */
export const SCHEMA = `

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  token_version int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists login_attempts (
  email text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_idx on login_attempts (email, at);

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references users on delete cascade,
  created_at timestamptz not null default now()
);

-- MVP: one family per user
create table if not exists family_members (
  family_id uuid not null references families on delete cascade,
  user_id uuid not null unique references users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists visions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users on delete cascade,
  family_id uuid references families on delete cascade,   -- null = personal vision
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists visions_personal_uq on visions (owner_id) where family_id is null;
create unique index if not exists visions_family_uq on visions (family_id) where family_id is not null;

create table if not exists wheel_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  scores jsonb not null,
  created_at timestamptz not null default now()
);

-- private: only owner · shared: owner's goal visible to family · family: common goal, all members edit
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users on delete cascade,
  family_id uuid references families on delete cascade,
  visibility text not null default 'private' check (visibility in ('private', 'shared', 'family')),
  sphere text not null check (sphere in ('career', 'finance', 'family', 'health', 'growth', 'travel', 'self')),
  horizon text not null check (horizon in ('10y', '3y', '1y', '90d')),
  parent_id uuid references goals on delete set null,
  title text not null,
  why text,
  metric text,
  target numeric,
  current numeric not null default 0,
  unit text,
  deadline date,
  status text not null default 'active' check (status in ('active', 'done', 'dropped')),
  assignee_id uuid references users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility = 'private' or family_id is not null)
);
create index if not exists goals_owner_idx on goals (owner_id);
create index if not exists goals_family_idx on goals (family_id);
create index if not exists goals_parent_idx on goals (parent_id);

create or replace function check_year_focus() returns trigger language plpgsql as $$
begin
  if new.horizon = '1y' and new.status = 'active' and new.visibility <> 'family' then
    if (select count(*) from goals
        where owner_id = new.owner_id and horizon = '1y' and status = 'active'
          and visibility <> 'family' and id <> new.id) >= 5 then
      raise exception 'Не больше 5 главных целей на год — сначала завершите или уберите одну';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists goals_year_focus on goals;
create trigger goals_year_focus before insert or update on goals for each row execute function check_year_focus();

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users on delete cascade,
  goal_id uuid references goals on delete cascade,
  family_id uuid references families on delete cascade,   -- set for tasks of family goals
  title text not null,
  week_start date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_owner_week_idx on tasks (owner_id, week_start);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  family_id uuid references families on delete cascade,
  kind text not null check (kind in ('weekly', 'family')),
  period_start date not null,
  answers jsonb not null default '{}'::jsonb,
  ai_feedback text,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_user_idx on chat_messages (user_id, created_at);
`;
