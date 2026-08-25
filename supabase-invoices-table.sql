-- Ejecuta este SQL en Supabase SQL Editor (una sola vez)
-- Tabla de facturas de la suscripción Premium (TodoOficios.es factura al profesional)

create table if not exists public.invoices (
  id bigint generated always as identity primary key,
  -- Numeración correlativa sin huecos: se deriva directamente del id (bigint identity de
  -- Postgres, atómico frente a inserciones concurrentes) — nunca se calcula en el cliente.
  numero text generated always as ('PREM-' || lpad(id::text, 6, '0')) stored,
  fecha date not null default current_date,
  profesional_email text not null,
  profesional_nombre text not null,
  profesional_nif text,
  concepto text not null,
  periodo text not null,
  base numeric(10,2) not null,
  iva_pct numeric(5,2) not null default 21,
  cuota numeric(10,2) not null,
  total numeric(10,2) not null,
  metodo_pago text not null default 'PayPal',
  paypal_order_id text,
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;

-- Inserción pública (el cliente web crea la factura justo tras el pago).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_insert_anon'
  ) then
    create policy invoices_insert_anon
      on public.invoices
      for insert
      to anon
      with check (true);
  end if;
end $$;

-- Lectura pública, igual que el resto de tablas de esta app (kv_store usa la misma política).
-- OJO: esta tabla guarda NIF y datos fiscales reales de cada profesional Premium. Con RLS
-- abierta a "anon", cualquiera con la anon key pública puede leer TODAS las facturas de TODOS
-- los profesionales, no solo las suyas — es el mismo modelo de confianza que ya usa el resto
-- del sitio (accounts, mensajes, reseñas viven en kv_store con la misma apertura), pero aquí
-- hay datos fiscales de verdad de terceros, así que pesa más. Antes de activar pagos reales
-- (PAYMENTS_ENABLED = true en producción), conviene sustituir esto por Supabase Auth real +
-- una política que solo permita "select" cuando auth.email() = profesional_email, o mover la
-- lectura a una Edge Function con la service role key en vez de la anon key.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_select_anon'
  ) then
    create policy invoices_select_anon
      on public.invoices
      for select
      to anon
      using (true);
  end if;
end $$;
