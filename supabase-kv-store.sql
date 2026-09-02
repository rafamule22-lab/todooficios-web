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

-- Lectura pública (cliente web), excepto las credenciales (ver Edge Function account-auth)
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
      using (key not like 'credentials:%');
  end if;
end $$;

-- Escritura pública (cliente web), excepto las credenciales
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
      with check (key not like 'credentials:%');
  end if;
end $$;

-- Actualización pública (cliente web), excepto las credenciales
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
      using (key not like 'credentials:%')
      with check (key not like 'credentials:%');
  end if;
end $$;

-- Borrado público (cliente web), excepto las credenciales
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
      using (key not like 'credentials:%');
  end if;
end $$;

-- Si la tabla y las políticas YA existen de antes (creadas con using(true)),
-- ejecuta también supabase/migrations/20260902000000_restrict_credentials_key.sql
-- para sustituirlas por las de arriba: los bloques `if not exists` de este
-- archivo no tocan políticas que ya existan.
