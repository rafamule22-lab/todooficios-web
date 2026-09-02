-- Hasta ahora `anon` podía hacer UPDATE y DELETE sobre CUALQUIER fila de
-- kv_store, incluidas `client:<email>` y `account:<email>` (el perfil
-- público de cada cliente/profesional). Eso significaba que, aunque las
-- credenciales ya estaban a salvo (ver 20260902000000_...), cualquiera con
-- la anon key podía seguir reescribiendo o borrando el perfil de otra
-- persona: cambiarle el teléfono, marcarse a sí mismo como destacado
-- (featuredUntil), o borrar la cuenta de otro profesional.
--
-- SELECT e INSERT en `client:%`/`account:%` se quedan abiertos a propósito:
-- el directorio público necesita poder leer perfiles sin sesión, y el alta
-- de una cuenta nueva es un INSERT (no un UPDATE) porque la fila todavía no
-- existe. Solo UPDATE y DELETE de una fila que YA existe requieren ahora
-- pasar por la Edge Function account-auth (acciones 'save'/'delete'), que
-- exige el token de sesión emitido en el login/alta.
--
-- IMPORTANTE: aplica esta migración DESPUÉS de desplegar la versión de
-- account-auth con SESSION_SECRET configurado (ver comentario al principio
-- de supabase/functions/account-auth/index.ts). Si la aplicas antes, nadie
-- podrá editar su perfil, marcar favoritos ni eliminar su cuenta hasta que
-- despliegues la función.

drop policy if exists kv_store_update_anon on public.kv_store;
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

drop policy if exists kv_store_delete_anon on public.kv_store;
create policy kv_store_delete_anon
  on public.kv_store
  for delete
  to anon
  using (
    key not like 'credentials:%'
    and key not like 'client:%'
    and key not like 'account:%'
  );
