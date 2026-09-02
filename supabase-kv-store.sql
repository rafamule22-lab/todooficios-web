-- Ejecuta este SQL en Supabase SQL Editor
-- Crea un almacén clave/valor compartido para TodoOficios
--
-- IMPORTANTE sobre el orden: si vienes de una versión anterior de este
-- archivo (políticas con using(true), acceso total para anon), antes de
-- pegar esto despliega la versión de la Edge Function account-auth que
-- implementa TODAS sus acciones (login, register, get, save, delete,
-- index-add, add-rating, delete-rating, get-messages, add-message,
-- add-reply, get/save-public-presupuesto) con SESSION_SECRET configurado.
-- Si aplicas las políticas de abajo antes de eso, se rompen el login/alta
-- de clientes y profesionales (incluidos los de Google), el panel de
-- negocio (incluidas las calculadoras), los mensajes, las reseñas nuevas,
-- los presupuestos públicos y el directorio de profesionales hasta que
-- despliegues la función.

create table if not exists public.kv_store (
  namespace text not null,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  constraint kv_store_pkey primary key (namespace, key)
);

alter table public.kv_store enable row level security;

-- Lectura pública: solo lo que de verdad necesita ser público (el
-- directorio de profesionales, su índice de emails, y las reseñas). Todo
-- lo demás está bloqueado para anon porque una consulta sin filtro
-- (SELECT * sin .eq('key', ...)) devolvería TODAS las filas que la
-- política deja pasar, no solo la que la app pide.
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
      using (
        key not like 'credentials:%'
        and key not like 'client:%'
        and key not like 'negocio:%'
        and key not like 'materiales:%'
        and key not like 'calc-favoritas:%'
        and key not like 'presupuesto-publico:%'
        and key <> 'contactMessages'
        and key <> 'clients-index'
      );
  end if;
end $$;

-- Alta de cuentas nuevas (INSERT, no UPDATE): abierto solo para account:%
-- (y las keys sueltas sin prefijo protegido). El resto de colecciones
-- sensibles, y los índices de emails, se crean/actualizan solo vía Edge Function.
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
      with check (
        key not like 'credentials:%'
        and key not like 'client:%'
        and key not like 'negocio:%'
        and key not like 'materiales:%'
        and key not like 'calc-favoritas:%'
        and key not like 'presupuesto-publico:%'
        and key <> 'contactMessages'
        and key <> 'ratings'
        and key <> 'accounts-index'
        and key <> 'clients-index'
      );
  end if;
end $$;

-- Actualización pública, EXCEPTO las colecciones protegidas: esas se
-- actualizan vía Edge Function account-auth, que exige probar quién eres
-- (token de sesión o sesión de Supabase Auth con Google) antes de tocar
-- una fila que ya existe.
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
        and key not like 'negocio:%'
        and key not like 'materiales:%'
        and key not like 'calc-favoritas:%'
        and key not like 'presupuesto-publico:%'
        and key <> 'contactMessages'
        and key <> 'ratings'
        and key <> 'accounts-index'
        and key <> 'clients-index'
      )
      with check (
        key not like 'credentials:%'
        and key not like 'client:%'
        and key not like 'account:%'
        and key not like 'negocio:%'
        and key not like 'materiales:%'
        and key not like 'calc-favoritas:%'
        and key not like 'presupuesto-publico:%'
        and key <> 'contactMessages'
        and key <> 'ratings'
        and key <> 'accounts-index'
        and key <> 'clients-index'
      );
  end if;
end $$;

-- Borrado público, EXCEPTO las colecciones protegidas (mismo motivo que UPDATE)
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
        and key not like 'negocio:%'
        and key not like 'materiales:%'
        and key not like 'calc-favoritas:%'
        and key not like 'presupuesto-publico:%'
        and key <> 'contactMessages'
        and key <> 'ratings'
        and key <> 'accounts-index'
        and key <> 'clients-index'
      );
  end if;
end $$;

-- Si la tabla y las políticas YA existen de antes, los bloques `if not
-- exists` de arriba no las tocan: ejecuta en su lugar, en este orden,
-- todos los archivos de supabase/migrations/ (por fecha).
