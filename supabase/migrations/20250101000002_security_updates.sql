-- 1. Create check_and_log_usage PL/pgSQL function
create or replace function public.check_and_log_usage(p_user uuid, p_limit int, p_window interval)
returns boolean language plpgsql security definer as $$
declare cnt int;
begin
  select count(*) into cnt from public.usage_logs
   where user_id = p_user and created_at > now() - p_window;
  if cnt >= p_limit then return false; end if;
  insert into public.usage_logs(user_id) values (p_user);
  return true;
end $$;

-- 2. Create public.brands table
create table if not exists public.brands (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  slogan text,
  colors jsonb not null default '[]'::jsonb,
  default_phrase text,
  button_text text,
  signature text,
  logo_path text,
  updated_at timestamptz not null default now()
);

-- Enable RLS on brands
alter table public.brands enable row level security;

-- Policies for brands
create policy "users_own_brand"
  on public.brands for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Update public.generations table
alter table public.generations add column if not exists storage_path text;

-- Backfill pre-existing rows if any
update public.generations set storage_path = '' where storage_path is null;
alter table public.generations alter column storage_path set not null;

-- 4. Create trigger for physical storage file cleanup
create or replace function public.delete_generation_storage_file()
returns trigger language plpgsql security definer as $$
begin
  if old.storage_path is not null and old.storage_path <> '' then
    delete from storage.objects 
    where bucket_id = 'generated-images' 
      and name = old.storage_path;
  end if;
  return old;
end;
$$;

create or replace trigger cleanup_generation_storage_file
before delete on public.generations
for each row
execute function public.delete_generation_storage_file();

-- 5. Separate generations policies for immutability
drop policy if exists "users_crud_own_generations" on public.generations;

create policy "users_select_own_generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "users_insert_own_generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "users_delete_own_generations"
  on public.generations for delete
  using (auth.uid() = user_id);

-- 6. Setup brand-logos bucket and policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-logos',
  'brand-logos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "users_manage_own_logos"
  on storage.objects for all
  using (
    bucket_id = 'brand-logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'brand-logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
