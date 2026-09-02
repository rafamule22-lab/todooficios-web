-- accounts-index y clients-index son las listas de emails que usa la app
-- para saber qué keys `account:*`/`client:*` existen (accounts-index
-- alimenta directamente el directorio público de profesionales:
-- getAllProfessionals() la lee para saber a quién buscar). Hasta ahora
-- `anon` podía sobrescribirlas o vaciarlas libremente — no exponen datos
-- sensibles (son solo emails), pero permitían vandalizar el directorio
-- público entero con una sola escritura no autenticada.
--
-- accounts-index se queda con lectura pública a propósito (la necesita el
-- directorio); clients-index no la lee nadie en la app, así que se bloquea
-- también en lectura, igual que el resto de datos de clientes. La única
-- forma de añadir o quitar un email de cualquiera de las dos pasa ahora
-- por account-auth (efecto de 'register'/'delete', o la acción 'index-add'
-- para las cuentas creadas con Google, que no pasan por 'register').
--
-- IMPORTANTE: aplica esta migración DESPUÉS de desplegar la versión de
-- account-auth que mantiene estos índices. Si la aplicas antes, un alta de
-- cuenta nueva (con o sin Google) dejaría de aparecer en el directorio de
-- profesionales hasta que despliegues la función.

drop policy if exists kv_store_select_anon on public.kv_store;
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

drop policy if exists kv_store_insert_anon on public.kv_store;
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

drop policy if exists kv_store_update_anon on public.kv_store;
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

drop policy if exists kv_store_delete_anon on public.kv_store;
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
