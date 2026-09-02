# TodoOficios.es

Directorio de profesionales de oficios (fontaneros, electricistas, albañiles, cerrajeros...) en España. Sitio estático HTML/JS/CSS vanilla (sin framework, sin build), desplegado manualmente en Hostinger. Backend en Supabase.

## Estructura

- `index.html` — SPA principal (login, panel de negocio, presupuestos, mensajería). Un único `<script>` inline genera el HTML por concatenación de strings.
- `calculadoras.js` / `calculadoras.html` — calculadoras de presupuestos de reforma.
- `presupuesto-publico.html` / `presupuesto-publico.js` — vista pública de un presupuesto compartido.
- `blog.html` — listado de posts de blog (leídos desde Supabase, tabla `blog_posts`).
- `legal-config.js` — configuración real (URL/anon key de Supabase, datos fiscales). Cargado antes que `index.html` sobreescriba sus defaults.
- `scripts/generate-blog-post.mjs` — bot Node que corre semanalmente (`.github/workflows/weekly-blog-post.yml`), genera un borrador de blog con la API de Anthropic y lo guarda en Supabase con `status: 'draft'`. Nunca publica solo.
- `supabase/migrations/` — SQL de las tablas (`kv_store`, `blog_posts`). `supabase-kv-store.sql` es una copia manual del mismo SQL para pegar en el SQL Editor de Supabase.
- `supabase/functions/` — Edge Functions (`parse-gasto`, `notify-reply`), usan `SUPABASE_SERVICE_ROLE_KEY` desde variables de entorno, nunca hardcodeada.
- `handoff-calculadora-reformas/` — documento de contexto/plan de una feature en curso.

## Modelo de datos (importante)

**No hay Supabase Auth.** La tabla `kv_store` es un almacén clave/valor genérico (`namespace`, `key`, `value` como JSON en texto) usado como sustituto en la nube de `localStorage` — ver `getStorageApi()`/`cloudStorageAdapter()` en `index.html`. Todos los datos de la app (cuentas, presupuestos, mensajes) viven bajo el namespace fijo `todooficios:v1`, diferenciados solo por `key` (p. ej. `client:<email>`, `account:<email>`, `contactMessages`).

La seguridad de acceso depende de las políticas RLS de `kv_store` (`supabase/migrations/`) y de la Edge Function `account-auth`, que centraliza todo lo que `anon` ya no puede tocar directo:

- **Bloqueadas por completo para `anon`** (ni lectura ni escritura, ni siquiera con filtro exacto — una política RLS no distingue "pido una key concreta" de "pido todas"; sin esto, cualquiera con la anon key podía volcar la tabla entera): `credentials:<email-key>` (hash+salt de la contraseña), `client:<email>` (cuenta de cliente), `negocio:<email>` / `materiales:<email>` / `calc-favoritas:<email>` (datos de negocio del profesional: gastos, agenda, presupuestos internos, precios), `presupuesto-publico:<shareId>` (el shareId aleatorio de 96 bits es la credencial, no el login) y `contactMessages` (un único array con las conversaciones de todos los pares cliente-profesional). Se leen/escriben solo a través de `account-auth` (acciones `get`/`save`/`delete` para las de dueño único; `get-messages`/`add-message`/`add-reply` para mensajes; `get-public-presupuesto`/`save-public-presupuesto` para presupuestos públicos).
- **`account:<email>`** (perfil público del profesional): SELECT e INSERT siguen abiertos a propósito — es el directorio, necesita ser público y el alta de cuenta es un INSERT — pero UPDATE y DELETE están bloqueados.
- **`ratings`**: SELECT abierto a propósito (ya se muestra en las fichas), pero INSERT/UPDATE/DELETE pasan por `account-auth` (`add-rating`/`delete-rating`) para que nadie invente o borre reseñas ajenas.
- **`accounts-index`** (lista de emails que alimenta el directorio — `getAllProfessionals()` la lee): SELECT abierto a propósito, pero INSERT/UPDATE/DELETE bloqueados. **`clients-index`**: bloqueada del todo (nada la lee). Los mantiene `account-auth` como efecto de `register`/`delete`, o con la acción `index-add` para las cuentas creadas con Google.

Editar tu ficha, marcar favoritos, activar destacado, guardar tu panel de negocio, mandar/responder un mensaje, dejar o borrar una reseña, o eliminar tu cuenta — todo pasa por `account-auth`, autenticado con el token de sesión emitido en login/alta (`saveAccountSecure()` / `deleteAccountSecure()` / `getAccountSecure()` en `index.html`, y sus equivalentes en `calculadoras.js` y `presupuesto-publico.js`) o, en cuentas de Google, la propia sesión de Supabase Auth.

Si Supabase no está configurado (modo local/desarrollo), la función aún no está desplegada, o `SESSION_SECRET` no está puesto, todo esto cae de vuelta al comportamiento anterior (lectura/escritura directa) para no romper el flujo — pero eso significa que la RLS restrictiva solo protege de verdad una vez que account-auth está desplegada con `SESSION_SECRET` configurado, y **antes** de aplicar las migraciones que restringen kv_store. Ver el comentario al principio de `supabase/functions/account-auth/index.ts` para el orden correcto de despliegue.

Ver `docs/decisions/0001-supabase-como-backend.md` para el detalle y las limitaciones que quedan pendientes.

## Despliegue

Manual: se genera un zip del sitio y se sube a Hostinger. No hay CI de build/lint/test. El workflow de GitHub Actions existente solo genera el post de blog semanal, no despliega nada.

## Convenciones

- No crear más copias de seguridad manuales del tipo `index-copia-seguridad-*.html` ni zips de despliegue dentro del repo — están en `.gitignore`. Usa commits/tags de git como historial real.
- Nunca hardcodear claves/secretos en el código; usar variables de entorno (ver `scripts/generate-blog-post.mjs` y las Edge Functions como ejemplo correcto).
- Commits pequeños y descriptivos en español, un cambio por commit — es el patrón que ya sigue este repo y funciona bien.
- No hay suite de tests para el sitio estático (HTML/JS vanilla). `scripts/generate-blog-post.mjs` sí tiene tests con `node --test` para sus funciones puras.
