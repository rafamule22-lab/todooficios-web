-- Migra cuentas de profesional/cliente, panel de negocio, materiales favoritos,
-- reseñas y mensajes de contacto desde el "kv_store" genérico (RLS abierta a
-- cualquiera con la clave anon: cualquiera podía leer o escribir cualquier fila)
-- a tablas propias con RLS por dueño real, usando Supabase Auth como identidad
-- (auth.jwt() ->> 'email'), tanto para email+contraseña como para Google.
--
-- Contraseñas: a partir de ahora las gestiona Supabase Auth (GoTrue) en el
-- servidor. Ningún hash de contraseña vuelve a guardarse en una tabla legible
-- por el cliente.
--
-- IMPORTANTE: las cuentas antiguas (account:<email> / client:<email> en
-- kv_store) NO se migran automáticamente aquí porque no es posible recuperar
-- la contraseña en texto plano a partir del hash guardado. Quien tuviera una
-- cuenta con el sistema antiguo debe volver a registrarse.

/* ======================= PROFESIONALES ======================= */
create table if not exists public.professional_profiles (
  email text primary key,
  name text not null default '',
  oficio text not null default '',
  phone text not null default '',
  address text not null default '',
  experience text not null default '',
  bio text not null default '',
  zona text not null default '',
  photo text not null default '',
  work_photos jsonb not null default '[]'::jsonb,
  lat double precision,
  lng double precision,
  verificado boolean not null default false,
  legal_accepted_at bigint,
  contact_verified boolean not null default false,
  auth_provider text not null default 'password',
  featured_until bigint,
  premium_promo boolean not null default false,
  premium_promo_slot integer,
  premium_trial boolean not null default false,
  premium_months_paid integer not null default 0,
  type text,
  website text,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

alter table public.professional_profiles enable row level security;

-- Lectura pública: es el directorio (buscador, fichas, home).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'professional_profiles'
      and policyname = 'professional_profiles_select_public'
  ) then
    create policy professional_profiles_select_public
      on public.professional_profiles for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- Escritura: solo el propio profesional autenticado, sobre su propia fila.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'professional_profiles'
      and policyname = 'professional_profiles_insert_own'
  ) then
    create policy professional_profiles_insert_own
      on public.professional_profiles for insert
      to authenticated
      with check (lower(email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'professional_profiles'
      and policyname = 'professional_profiles_update_own'
  ) then
    create policy professional_profiles_update_own
      on public.professional_profiles for update
      to authenticated
      using (lower(email) = lower(auth.jwt() ->> 'email'))
      with check (lower(email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'professional_profiles'
      and policyname = 'professional_profiles_delete_own'
  ) then
    create policy professional_profiles_delete_own
      on public.professional_profiles for delete
      to authenticated
      using (lower(email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

/* ======================= CLIENTES ======================= */
create table if not exists public.client_profiles (
  email text primary key,
  name text not null default '',
  phone text not null default '',
  favorites jsonb not null default '[]'::jsonb,
  auth_provider text not null default 'password',
  legal_accepted_at bigint,
  contact_verified boolean not null default false,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

alter table public.client_profiles enable row level security;

-- Sin lectura pública: los datos de un cliente (teléfono, favoritos) son suyos.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'client_profiles'
      and policyname = 'client_profiles_select_own'
  ) then
    create policy client_profiles_select_own
      on public.client_profiles for select
      to authenticated
      using (lower(email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'client_profiles'
      and policyname = 'client_profiles_insert_own'
  ) then
    create policy client_profiles_insert_own
      on public.client_profiles for insert
      to authenticated
      with check (lower(email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'client_profiles'
      and policyname = 'client_profiles_update_own'
  ) then
    create policy client_profiles_update_own
      on public.client_profiles for update
      to authenticated
      using (lower(email) = lower(auth.jwt() ->> 'email'))
      with check (lower(email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'client_profiles'
      and policyname = 'client_profiles_delete_own'
  ) then
    create policy client_profiles_delete_own
      on public.client_profiles for delete
      to authenticated
      using (lower(email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

/* ======================= PANEL DE NEGOCIO (privado) ======================= */
create table if not exists public.business_panel (
  owner_email text primary key references public.professional_profiles(email) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.business_panel enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'business_panel'
      and policyname = 'business_panel_owner_all'
  ) then
    create policy business_panel_owner_all
      on public.business_panel for all
      to authenticated
      using (lower(owner_email) = lower(auth.jwt() ->> 'email'))
      with check (lower(owner_email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

/* ======================= MATERIALES FAVORITOS (privado) ======================= */
create table if not exists public.materiales_favoritos (
  owner_email text primary key references public.professional_profiles(email) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.materiales_favoritos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'materiales_favoritos'
      and policyname = 'materiales_favoritos_owner_all'
  ) then
    create policy materiales_favoritos_owner_all
      on public.materiales_favoritos for all
      to authenticated
      using (lower(owner_email) = lower(auth.jwt() ->> 'email'))
      with check (lower(owner_email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

/* ======================= RESEÑAS ======================= */
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  pro_email text not null references public.professional_profiles(email) on delete cascade,
  client_email text not null references public.client_profiles(email) on delete cascade,
  client_name text not null,
  criteria jsonb not null default '{}'::jsonb,
  overall numeric not null,
  would_rehire boolean,
  title text,
  comment text,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (pro_email, client_email)
);

alter table public.ratings enable row level security;

-- Lectura pública (son las reseñas que ve cualquier visitante en la ficha).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ratings'
      and policyname = 'ratings_select_public'
  ) then
    create policy ratings_select_public
      on public.ratings for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- Solo el cliente autenticado puede publicar/editar/borrar SU PROPIA reseña.
-- El unique(pro_email, client_email) de arriba hace cumplir a nivel de base
-- de datos que solo puede existir una reseña activa por cliente y profesional
-- (antes de esta migración eso solo lo evitaba el propio JS de la app).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ratings'
      and policyname = 'ratings_insert_own'
  ) then
    create policy ratings_insert_own
      on public.ratings for insert
      to authenticated
      with check (lower(client_email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ratings'
      and policyname = 'ratings_update_own'
  ) then
    create policy ratings_update_own
      on public.ratings for update
      to authenticated
      using (lower(client_email) = lower(auth.jwt() ->> 'email'))
      with check (lower(client_email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ratings'
      and policyname = 'ratings_delete_own'
  ) then
    create policy ratings_delete_own
      on public.ratings for delete
      to authenticated
      using (lower(client_email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

/* ======================= MENSAJES DE CONTACTO (privados) ======================= */
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  pro_email text not null references public.professional_profiles(email) on delete cascade,
  client_email text not null references public.client_profiles(email) on delete cascade,
  client_name text not null,
  message text not null,
  sent_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

alter table public.contact_messages enable row level security;

-- Solo lo ven el cliente que lo escribió y el profesional destinatario.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_messages'
      and policyname = 'contact_messages_select_participants'
  ) then
    create policy contact_messages_select_participants
      on public.contact_messages for select
      to authenticated
      using (
        lower(auth.jwt() ->> 'email') = lower(client_email)
        or lower(auth.jwt() ->> 'email') = lower(pro_email)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_messages'
      and policyname = 'contact_messages_insert_own'
  ) then
    create policy contact_messages_insert_own
      on public.contact_messages for insert
      to authenticated
      with check (lower(client_email) = lower(auth.jwt() ->> 'email'));
  end if;
end $$;

/* ======================= ENDURECER kv_store ======================= */
-- Tras esta migración, kv_store deja de usarse para cuentas/negocio/reseñas/
-- mensajes (eso ahora vive en las tablas de arriba, con RLS por dueño real).
-- Lo único que sigue usando kv_store es el contador público
-- "promo-pro-signups" (cuántos profesionales ya reclamaron la promo de
-- lanzamiento). Sustituimos las políticas abiertas por unas que solo dejan
-- tocar esa clave concreta, y quitamos el delete público (ya no hace falta).
drop policy if exists kv_store_select_anon on public.kv_store;
drop policy if exists kv_store_insert_anon on public.kv_store;
drop policy if exists kv_store_update_anon on public.kv_store;
drop policy if exists kv_store_delete_anon on public.kv_store;

create policy kv_store_select_public_counter
  on public.kv_store for select
  to anon, authenticated
  using (key = 'promo-pro-signups');

create policy kv_store_write_public_counter
  on public.kv_store for insert
  to anon, authenticated
  with check (key = 'promo-pro-signups');

create policy kv_store_update_public_counter
  on public.kv_store for update
  to anon, authenticated
  using (key = 'promo-pro-signups')
  with check (key = 'promo-pro-signups');

/* ======================= DATOS DE EJEMPLO (perfiles demo) ======================= */
-- Antes esto lo creaba el propio navegador la primera vez que la web no
-- encontraba profesionales (kv_store lo permitía porque era de escritura
-- pública). Con RLS por dueño eso ya no es posible desde el cliente, así
-- que los perfiles de ejemplo se insertan aquí una sola vez, como dueño de
-- la base de datos (esto se salta RLS). Si ya existen (misma clave primaria),
-- no se duplican.
insert into public.professional_profiles
  (email, name, oficio, zona, bio, phone, verificado, lat, lng, auth_provider, featured_until)
values
  ('demo-franco@todooficios.es', 'Franco Medina', 'Electricista', 'Madrid Centro', 'Instalaciones eléctricas domiciliarias e industriales. 12 años de experiencia.', '+34 600 000 001', true, 40.4168, -3.7038, 'demo', null),
  ('demo-cecilia@todooficios.es', 'Cecilia Basle', 'Gasista', 'Madrid Este', 'Instalación y reparación de gas natural y envasado. Certificaciones al día.', '+34 600 000 002', true, 40.4300, -3.6800, 'demo', null),
  ('demo-matias@todooficios.es', 'Matías Servant', 'Fontanero', 'Madrid Norte', 'Destapaciones, cañerías y arreglos urgentes. Presupuesto sin cargo.', '+34 600 000 003', true, 40.4500, -3.6900, 'demo', null),
  ('demo-pedro@todooficios.es', 'Pedro Salatic', 'Instalador de aire acondicionado', 'Madrid Sur', 'Instalación y service de equipos split y central. Atención el mismo día.', '+34 600 000 004', false, 40.3900, -3.7100, 'demo', null),
  ('demo-ricardo@todooficios.es', 'Ricardo Hidalgo', 'Albañil', 'Madrid Centro', 'Refacciones, ampliaciones y obra nueva. Trabajo prolijo y con referencias.', '+34 600 000 005', true, 40.4200, -3.7200, 'demo', null),
  ('demo-eduardo@todooficios.es', 'Eduardo Sara', 'Pintor', 'Madrid Este', 'Pintura interior y exterior, impermeabilizaciones. Presupuesto en el día.', '+34 600 000 006', false, 40.4350, -3.6700, 'demo', null)
on conflict (email) do nothing;

-- Reseñas de ejemplo para esos mismos perfiles demo. Necesitan un
-- client_profiles real por la FK, así que primero se crea un cliente demo.
insert into public.client_profiles (email, name, auth_provider)
values ('demo-cliente@todooficios.es', 'Cliente de ejemplo', 'demo')
on conflict (email) do nothing;

insert into public.ratings (pro_email, client_email, client_name, criteria, overall, would_rehire, comment, created_at)
values
  ('demo-franco@todooficios.es', 'demo-cliente@todooficios.es', 'Laura M.', '{"puntualidad":5,"calidad":5,"limpieza":5,"trato":5,"precio":5}', 5, true, 'Vino el mismo día y solucionó el corte en minutos.', (extract(epoch from now()) * 1000)::bigint - 86400000*3),
  ('demo-cecilia@todooficios.es', 'demo-cliente@todooficios.es', 'Sofía P.', '{"puntualidad":5,"calidad":5,"limpieza":5,"trato":5,"precio":5}', 5, true, 'Muy prolija y con toda la documentación al día.', (extract(epoch from now()) * 1000)::bigint - 86400000*5),
  ('demo-matias@todooficios.es', 'demo-cliente@todooficios.es', 'Diego F.', '{"puntualidad":5,"calidad":5,"limpieza":5,"trato":5,"precio":5}', 5, true, 'Destapó una cañería complicada, quedó impecable.', (extract(epoch from now()) * 1000)::bigint - 86400000*2),
  ('demo-ricardo@todooficios.es', 'demo-cliente@todooficios.es', 'Marta G.', '{"puntualidad":4,"calidad":4,"limpieza":4,"trato":4,"precio":4}', 4, true, 'Buena terminación en la ampliación de la cocina.', (extract(epoch from now()) * 1000)::bigint - 86400000*15)
on conflict (pro_email, client_email) do nothing;
