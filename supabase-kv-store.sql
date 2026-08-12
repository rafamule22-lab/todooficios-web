-- Ejecuta este SQL en Supabase SQL Editor
-- Crea un almacén clave/valor compartido para TodoOficios

create table if not exists public.kv_store (
  namespace text not null,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  constraint kv_store_pkey primary key (namespace, key)
);

alter table public.kv_store enable row level security;

-- Lectura pública (cliente web)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kv_store'
      and policyname = 'kv_store_select_anon'
  ) then
    create policy kv_store_select_anon
      on public.kv_store
      for select
      to anon
      using (true);
  end if;
end $$;

-- Escritura pública (cliente web)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kv_store'
      and policyname = 'kv_store_insert_anon'
  ) then
    create policy kv_store_insert_anon
      on public.kv_store
      for insert
      to anon
      with check (true);
  end if;
end $$;

-- Actualización pública (cliente web)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kv_store'
      and policyname = 'kv_store_update_anon'
  ) then
    create policy kv_store_update_anon
      on public.kv_store
      for update
      to anon
      using (true)
      with check (true);
  end if;
end $$;

-- Borrado público (cliente web)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kv_store'
      and policyname = 'kv_store_delete_anon'
  ) then
    create policy kv_store_delete_anon
      on public.kv_store
      for delete
      to anon
      using (true);
  end if;
end $$;
