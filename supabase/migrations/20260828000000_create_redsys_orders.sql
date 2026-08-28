-- Correlaciona cada Ds_Merchant_Order de Redsys con la cuenta que paga, para que la
-- función redsys-notification sepa a quién activar el Premium y pueda ignorar avisos
-- duplicados (Redsys puede reintentar la notificación online).

create table if not exists public.redsys_orders (
  order_id text primary key,
  email text not null,
  amount_cents integer not null,
  status text not null default 'pending', -- 'pending' | 'paid' | 'failed'
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- RLS activada y sin políticas para anon/authenticated: solo las Edge Functions
-- (con la service role key, que salta la RLS) leen o escriben esta tabla.
alter table public.redsys_orders enable row level security;
