-- Ejecuta este SQL en Supabase SQL Editor
-- Crea un almacén clave/valor compartido para TodoOficios
--
-- IMPORTANTE sobre el orden: si vienes de una versión anterior de este
-- archivo (políticas con using(true), acceso total para anon), antes de
-- pegar esto despliega la Edge Function account-auth con SESSION_SECRET
-- configurado (ver supabase/functions/account-auth/index.ts). Si aplicas
-- las políticas de abajo antes de eso, nadie podrá editar su perfil, marcar
-- favoritos ni eliminar su cuenta hasta que la despliegues.

create table if not exists public.kv_store (
  namespace text not null,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  constraint kv_store_pkey primary key (namespace, key)
);

alter table public.kv_store enable row level security;

-- Lectura pública (cliente web y directorio), excepto las credenciales
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

-- Alta de cuentas nuevas (INSERT, no UPDATE) y del resto de keys, excepto las credenciales
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

-- Actualización pública, EXCEPTO credenciales y perfiles de cliente/profesional
-- (esos se actualizan vía Edge Function account-auth, acción 'save', que exige
-- el token de sesión del login/alta)
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
      using (
        key not like 'credentials:%'
        and key not like 'client:%'
        and key not like 'account:%'
      )
      with check (
        key not like 'credentials:%'
        and key not like 'client:%'
        and key not like 'account:%'
      );
  end if;
end $$;

-- Borrado público, EXCEPTO credenciales y perfiles de cliente/profesional
-- (esos se borran vía Edge Function account-auth, acción 'delete')
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
      using (
        key not like 'credentials:%'
        and key not like 'client:%'
        and key not like 'account:%'
      );
  end if;
end $$;

-- Si la tabla y las políticas YA existen de antes, los bloques `if not
-- exists` de arriba no las tocan: ejecuta en su lugar, en este orden,
-- supabase/migrations/20260902000000_restrict_credentials_key.sql y
-- supabase/migrations/20260902000100_restrict_account_writes.sql
