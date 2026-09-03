-- Las políticas de kv_store se escribieron `to anon` únicamente. Pero en
-- cuanto un usuario entra con Google, Supabase Auth le da una sesión real y
-- el cliente JS empieza a mandar sus peticiones como rol `authenticated`,
-- no `anon` — para el que no había ninguna política. Resultado: cualquier
-- alta de cuenta (cliente o profesional) hecha por un usuario ya logueado
-- con Google era denegada por RLS (INSERT bloqueado por defecto al no
-- coincidir ninguna política), aunque el mismo alta sin sesión (anon)
-- funcionaba perfectamente. Esto rompía el registro con Google en
-- producción para cualquier cuenta nueva.
--
-- Fix: las mismas 4 políticas, con las mismas condiciones de siempre, pero
-- aplicando también al rol `authenticated` (no solo `anon`). No cambia qué
-- se puede hacer con cada key, solo deja de exigir que la petición vaya
-- forzosamente sin sesión.

drop policy if exists kv_store_select_anon on public.kv_store;
create policy kv_store_select_anon
  on public.kv_store
  for select
  to anon, authenticated
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

drop policy if exists kv_store_insert_anon on public.kv_store;
create policy kv_store_insert_anon
  on public.kv_store
  for insert
  to anon, authenticated
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

drop policy if exists kv_store_update_anon on public.kv_store;
create policy kv_store_update_anon
  on public.kv_store
  for update
  to anon, authenticated
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

drop policy if exists kv_store_delete_anon on public.kv_store;
create policy kv_store_delete_anon
  on public.kv_store
  for delete
  to anon, authenticated
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
