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

La seguridad de acceso depende de las políticas RLS de `kv_store` (`supabase/migrations/`): casi toda key se lee y escribe directo desde el navegador con la anon key pública, porque el sitio es estático y necesita que el directorio de profesionales sea público. La única excepción es el prefijo **`credentials:<email-key>`**, bloqueado por completo para `anon` — ahí vive el `passwordHash`/`passwordSalt` de cada cuenta, gestionado exclusivamente por la Edge Function `account-auth` (con `SUPABASE_SERVICE_ROLE_KEY`). El login y el alta de cuentas llaman a esa función (`verifyAccountPassword()` / `registerAccountCredentials()` en `index.html`) en vez de comparar la contraseña en el propio navegador. Si Supabase no está configurado (modo local/desarrollo) o la función aún no está desplegada, cae de vuelta al comportamiento anterior (hash embebido en el perfil) para no romper el flujo.

Cualquier otro dato del perfil (fotos, bio, presupuestos, mensajes) sigue sin protección por usuario a nivel de fila — solo se protegió lo más crítico (credenciales). Ver `docs/decisions/0001-supabase-como-backend.md` para el detalle y las limitaciones que quedan pendientes.

## Despliegue

Manual: se genera un zip del sitio y se sube a Hostinger. No hay CI de build/lint/test. El workflow de GitHub Actions existente solo genera el post de blog semanal, no despliega nada.

## Convenciones

- No crear más copias de seguridad manuales del tipo `index-copia-seguridad-*.html` ni zips de despliegue dentro del repo — están en `.gitignore`. Usa commits/tags de git como historial real.
- Nunca hardcodear claves/secretos en el código; usar variables de entorno (ver `scripts/generate-blog-post.mjs` y las Edge Functions como ejemplo correcto).
- Commits pequeños y descriptivos en español, un cambio por commit — es el patrón que ya sigue este repo y funciona bien.
- No hay suite de tests para el sitio estático (HTML/JS vanilla). `scripts/generate-blog-post.mjs` sí tiene tests con `node --test` para sus funciones puras.
