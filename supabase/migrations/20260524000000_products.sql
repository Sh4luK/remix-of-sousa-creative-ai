-- products: catálogo de produtos por usuário, com imagens opcionais
create table if not exists public.products (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null,
  category      text        not null default 'outros',
  storage_path  text,           -- imagem enviada pelo usuário (bucket product-images)
  off_image_url text,           -- URL pública do Open Food Facts
  barcode       text,           -- código de barras opcional (Open Food Facts)
  source        text        not null default 'user',  -- 'user' | 'openfoodfacts'
  created_at    timestamptz not null default now()
);

create index if not exists products_user_name_idx
  on public.products (user_id, lower(name));

create index if not exists products_user_created_idx
  on public.products (user_id, created_at desc);

alter table public.products enable row level security;

create policy "users_crud_own_products"
  on public.products for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Storage bucket para imagens de produto enviadas pelo usuário ──────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  false,
  3145728,  -- 3 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "users_upload_own_products"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users_read_own_products"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users_delete_own_products"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
