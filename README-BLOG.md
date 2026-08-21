# Blog automático de TodoOficios.es — instalación

Cada semana, un bot genera un borrador de artículo con la API de Claude y lo guarda en Supabase. Nada se publica solo: tú revisas y publicas a mano.

## 1. Crear la tabla en Supabase

En el SQL Editor de tu proyecto de Supabase, ejecuta el contenido de
[`supabase/migrations/20260821000000_create_blog_posts.sql`](supabase/migrations/20260821000000_create_blog_posts.sql).

## 2. Configurar los 3 secrets en GitHub

En el repositorio de GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Crea estos tres:

| Secret | Dónde lo consigues |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `SUPABASE_URL` | Supabase → Project Settings → API → "Project URL" |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → "service_role" key (⚠️ secreta, nunca la pongas en `legal-config.js` ni en ningún archivo del sitio público) |

Estos 3 secrets **solo** los usa el workflow de GitHub Actions. Son distintos de `supabaseUrl`/`supabaseAnonKey` en `legal-config.js`, que son las claves públicas que ya usa el resto del sitio.

## 3. Probarlo sin esperar al lunes

En GitHub: pestaña **Actions** → "Generar borrador semanal del blog" → **Run workflow**. Tarda menos de un minuto. Si falla, el log te dice exactamente qué variable falta o qué error dio Supabase/Claude.

## 4. Revisar y publicar un borrador

En Supabase Studio → **Table Editor** → tabla `blog_posts`. Cada fila nueva llega con `status = draft`. Edita el contenido si quieres, y cuando estés conforme cambia `status` a `published` (y opcionalmente rellena `published_at` con la fecha que quieras que muestre — si lo dejas vacío, el artículo no aparecerá en el listado porque se ordena por esa columna; te recomendamos poner la fecha del día en que lo publicas).

## 5. Ver el blog en el sitio

Una vez `legal-config.js` tenga `supabaseUrl` y `supabaseAnonKey` reales (no los `PENDIENTE_...` actuales), `blog.html` mostrará automáticamente los artículos publicados. El enlace "Blog" ya está añadido en el menú y el pie de página.

## 6. Cambiar la frecuencia o el día

El cron está en [`.github/workflows/weekly-blog-post.yml`](.github/workflows/weekly-blog-post.yml) (`cron: '0 6 * * 1'` = todos los lunes a las 06:00 UTC ≈ 07:00/08:00 hora de España según el cambio de horario). Cámbialo si quieres otra cadencia.
