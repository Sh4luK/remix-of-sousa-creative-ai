-- usage_logs: one row per generation, used for rate limiting server-side
create table if not exists public.usage_logs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_created_idx
  on public.usage_logs (user_id, created_at desc);

alter table public.usage_logs enable row level security;

-- users can view their own usage (for future dashboard)
create policy "users_view_own_usage"
  on public.usage_logs for select
  using (auth.uid() = user_id);

-- inserts are done by the edge function via service role (bypasses RLS)


-- generations: server-side image history, replaces localStorage
create table if not exists public.generations (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  prompt     text        not null,
  image_url  text        not null,
  metadata   jsonb       not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

create policy "users_crud_own_generations"
  on public.generations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
