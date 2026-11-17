-- Goals app schema. Run once in Supabase → SQL Editor → New query → Run.
-- Privacy is enforced here (Row Level Security), not only in the UI:
--   private  — only the owner sees it
--   shared   — owner's personal goal, visible (read-only) to family members
--   family   — common family goal, every member can see and edit it

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- families
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- security definer: lets policies check membership without recursing into family_members' own policy
create or replace function public.is_family_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_members where family_id = fid and user_id = auth.uid());
$$;

create or replace function public.shares_family(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members a join public.family_members b on a.family_id = b.family_id
    where a.user_id = auth.uid() and b.user_id = other);
$$;

-- one family per user (MVP): create, or join by code
create or replace function public.create_family(fname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'Вы уже состоите в семье';
  end if;
  insert into families (name, created_by) values (fname, auth.uid()) returning id into fid;
  insert into family_members (family_id, user_id) values (fid, auth.uid());
  return fid;
end $$;

create or replace function public.join_family(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'Вы уже состоите в семье';
  end if;
  select id into fid from families where invite_code = upper(trim(code));
  if fid is null then raise exception 'Код приглашения не найден'; end if;
  insert into family_members (family_id, user_id) values (fid, auth.uid());
  return fid;
end $$;

-- ---------------------------------------------------------------- visions (life vision answers)
create table if not exists public.visions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  family_id uuid references public.families on delete cascade,   -- null = personal vision
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists visions_personal_uq on public.visions (owner_id) where family_id is null;
create unique index if not exists visions_family_uq on public.visions (family_id) where family_id is not null;

-- ---------------------------------------------------------------- wheel of life (7 spheres, 1–10)
create table if not exists public.wheel_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  scores jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- goals (10y → 3y → 1y → 90d cascade)
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  family_id uuid references public.families on delete cascade,
  visibility text not null default 'private' check (visibility in ('private', 'shared', 'family')),
  sphere text not null check (sphere in ('career', 'finance', 'family', 'health', 'growth', 'travel', 'self')),
  horizon text not null check (horizon in ('10y', '3y', '1y', '90d')),
  parent_id uuid references public.goals on delete set null,
  title text not null,
  why text,
  metric text,
  target numeric,
  current numeric not null default 0,
  unit text,
  deadline date,
  status text not null default 'active' check (status in ('active', 'done', 'dropped')),
  assignee_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility = 'private' or family_id is not null)
);
create index if not exists goals_owner_idx on public.goals (owner_id);
create index if not exists goals_family_idx on public.goals (family_id);
create index if not exists goals_parent_idx on public.goals (parent_id);

-- Focus rule: at most 5 active personal goals for the year
create or replace function public.check_year_focus() returns trigger
language plpgsql as $$
begin
  if new.horizon = '1y' and new.status = 'active' and new.visibility <> 'family' then
    if (select count(*) from public.goals
        where owner_id = new.owner_id and horizon = '1y' and status = 'active'
          and visibility <> 'family' and id <> new.id) >= 5 then
      raise exception 'Не больше 5 главных целей на год — сначала завершите или уберите одну';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists goals_year_focus on public.goals;
create trigger goals_year_focus before insert or update on public.goals
  for each row execute function public.check_year_focus();

-- ---------------------------------------------------------------- weekly tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  goal_id uuid references public.goals on delete cascade,
  family_id uuid references public.families on delete cascade,  -- set for tasks of family goals
  title text not null,
  week_start date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_owner_week_idx on public.tasks (owner_id, week_start);

-- ---------------------------------------------------------------- reviews (weekly personal / monthly family)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  family_id uuid references public.families on delete cascade,  -- set for family reviews
  kind text not null check (kind in ('weekly', 'family')),
  period_start date not null,
  answers jsonb not null default '{}'::jsonb,
  ai_feedback text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- AI coach chat history
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_user_idx on public.chat_messages (user_id, created_at);

-- ================================================================ Row Level Security
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.visions enable row level security;
alter table public.wheel_scores enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.reviews enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.shares_family(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid());

drop policy if exists families_select on public.families;
create policy families_select on public.families for select using (public.is_family_member(id));
drop policy if exists families_update on public.families;
create policy families_update on public.families for update using (public.is_family_member(id));

drop policy if exists members_select on public.family_members;
create policy members_select on public.family_members for select using (public.is_family_member(family_id));
drop policy if exists members_leave on public.family_members;
create policy members_leave on public.family_members for delete using (user_id = auth.uid());

drop policy if exists visions_all on public.visions;
create policy visions_all on public.visions for all
  using ((family_id is null and owner_id = auth.uid()) or (family_id is not null and public.is_family_member(family_id)))
  with check ((family_id is null and owner_id = auth.uid()) or (family_id is not null and public.is_family_member(family_id)));

drop policy if exists wheel_all on public.wheel_scores;
create policy wheel_all on public.wheel_scores for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals for select
  using (owner_id = auth.uid() or (visibility in ('shared', 'family') and public.is_family_member(family_id)));
drop policy if exists goals_insert on public.goals;
create policy goals_insert on public.goals for insert
  with check (owner_id = auth.uid() and (family_id is null or public.is_family_member(family_id)));
drop policy if exists goals_update on public.goals;
create policy goals_update on public.goals for update
  using (owner_id = auth.uid() or (visibility = 'family' and public.is_family_member(family_id)))
  with check (family_id is null or public.is_family_member(family_id));
drop policy if exists goals_delete on public.goals;
create policy goals_delete on public.goals for delete using (owner_id = auth.uid());

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select
  using (owner_id = auth.uid() or (family_id is not null and public.is_family_member(family_id)));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (owner_id = auth.uid() and (family_id is null or public.is_family_member(family_id)));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
  using (owner_id = auth.uid() or (family_id is not null and public.is_family_member(family_id)));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
  using (owner_id = auth.uid() or (family_id is not null and public.is_family_member(family_id)));

drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select
  using (user_id = auth.uid() or (kind = 'family' and public.is_family_member(family_id)));
drop policy if exists reviews_write on public.reviews;
create policy reviews_write on public.reviews for insert
  with check (user_id = auth.uid() and (family_id is null or public.is_family_member(family_id)));
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews for update
  using (user_id = auth.uid() or (kind = 'family' and public.is_family_member(family_id)));

drop policy if exists chat_all on public.chat_messages;
create policy chat_all on public.chat_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
