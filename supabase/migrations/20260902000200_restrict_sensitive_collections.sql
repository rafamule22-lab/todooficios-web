-- Hallazgo: las políticas anteriores (using(true) primero, luego "not like
-- 'credentials:%'") controlan qué FILAS puede tocar `anon`, pero no impiden
-- una consulta sin filtro — un SELECT * contra kv_store devuelve TODAS las
-- filas que la política deja pasar, no solo las que la propia app pide con
-- .eq('key', ...). Es decir: cualquiera con la anon key (pública, está en
-- legal-config.js) podía volcar la tabla entera vía la API REST de
-- Supabase, sin pasar por la app ni conocer ninguna key concreta.
--
-- Para `account:*` esto era aceptable (es el directorio público: se supone
-- que se puede listar). Para el resto, no:
-- - `client:*`: cuentas de clientes (nombre, teléfono, favoritos) — nada en
--   el sitio necesita listarlas en bloque.
-- - `negocio:*`: gastos, agenda, clientes propios y presupuestos internos
--   de cada profesional — datos de negocio sensibles.
-- - `materiales:*` / `calc-favoritas:*`: precios de materiales guardados y
--   calculadoras favoritas de cada profesional (calculadoras.js) — mismo
--   caso que negocio:, datos de negocio del profesional sin ninguna
--   necesidad de lectura pública.
-- - `presupuesto-publico:*`: el modelo de seguridad es "quien tiene el
--   enlace (shareId aleatorio de 96 bits) puede verlo", pero eso solo vale
--   si no se puede volcar la tabla entera sin conocer ningún shareId.
-- - `contactMessages`: un único array con las conversaciones de TODOS los
--   pares cliente-profesional.
--
-- Estas colecciones pasan a estar completamente bloqueadas para `anon`
-- (como ya lo estaba `credentials:%`): se leen y escriben solo a través de
-- la Edge Function account-auth (acciones 'get'/'save'/'delete' para
-- client:/negocio:/materiales:/calc-favoritas:,
-- 'get-public-presupuesto'/'save-public-presupuesto' para
-- presupuesto-publico:, y 'get-messages'/'add-message'/'add-reply' para
-- contactMessages).
--
-- `ratings` es distinto: el contenido ya es público a propósito (se
-- muestra en las fichas de los profesionales), así que la LECTURA se deja
-- abierta; solo se bloquean INSERT/UPDATE/DELETE, para que nadie pueda
-- inventarse ni borrar reseñas ajenas (pasan por 'add-rating', y el borrado
-- al eliminar una cuenta lo hace la propia función como parte de 'delete').
--
-- IMPORTANTE: aplica esta migración DESPUÉS de desplegar la versión de
-- account-auth que implementa las acciones nuevas. Si la aplicas antes,
-- se rompen el login/alta de clientes, el panel de negocio (incluidas las
-- calculadoras), los mensajes, las reseñas nuevas y los presupuestos
-- públicos hasta que despliegues la función.

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
  );
