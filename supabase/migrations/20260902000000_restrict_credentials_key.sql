-- Antes de esta migración, las 4 políticas de kv_store daban acceso total
-- (using(true) / with check(true)) a `anon` sobre TODAS las filas, incluidas
-- las que guardaban passwordHash/passwordSalt dentro del perfil público de
-- cada cliente/profesional (`client:<email>`, `account:<email>`). Eso
-- permitía leer los hashes de contraseña de todos los usuarios directamente
-- vía API REST con la anon key pública, y también sobrescribirlos.
--
-- A partir de ahora las credenciales viven en una key aparte
-- (`credentials:<email-key>`), gestionada solo por la Edge Function
-- `account-auth` con la service role key. Estas políticas le quitan a `anon`
-- cualquier acceso a esa key; el resto del comportamiento no cambia.

drop policy if exists kv_store_select_anon on public.kv_store;
create policy kv_store_select_anon
  on public.kv_store
  for select
  to anon
  using (key not like 'credentials:%');

drop policy if exists kv_store_insert_anon on public.kv_store;
create policy kv_store_insert_anon
  on public.kv_store
  for insert
  to anon
  with check (key not like 'credentials:%');

drop policy if exists kv_store_update_anon on public.kv_store;
create policy kv_store_update_anon
  on public.kv_store
  for update
  to anon
  using (key not like 'credentials:%')
  with check (key not like 'credentials:%');

drop policy if exists kv_store_delete_anon on public.kv_store;
create policy kv_store_delete_anon
  on public.kv_store
  for delete
  to anon
  using (key not like 'credentials:%');
