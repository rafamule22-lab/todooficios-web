# ADR 0002: Generar borradores de blog con IA, sin autopublicar

## Estado
Aceptado (en uso).

## Contexto
Mantener un blog con contenido SEO regular sobre oficios (fontanería, electricidad, reformas...) requiere tiempo de escritura del que el dueño del negocio no dispone cada semana.

## Decisión
`scripts/generate-blog-post.mjs` corre semanalmente vía GitHub Actions (`.github/workflows/weekly-blog-post.yml`, cron los lunes). Elige un oficio de forma determinista por número de semana ISO, pide un artículo a la API de Anthropic (modelo `claude-opus-5`) y lo guarda en la tabla `blog_posts` de Supabase con `status: 'draft'`. **Nunca lo publica automáticamente** — alguien tiene que entrar a Supabase Studio y cambiar el estado a `published` a mano.

## Consecuencias
- Contenido nuevo cada semana sin esfuerzo humano de redacción, pero con un punto de control humano obligatorio antes de publicar (evita que un artículo con errores factuales o de tono salga sin revisión).
- El workflow depende de tres secrets de GitHub Actions (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); si alguno falta o cambia de formato, el job falla en el paso de `requireEnv()` con un mensaje explícito.
- El ID de modelo (`claude-opus-5`) está hardcodeado en el script; si Anthropic retira o renombra ese modelo, el cron empezará a fallar hasta que se actualice a mano — no hay alerta automática más allá del propio log de GitHub Actions (ver hallazgo de `observability-and-instrumentation` en la auditoría de skills).

## Alternativas consideradas
No hay evidencia de que se evaluara un servicio de terceros (Buffer, Zapier + IA) frente a un script propio; el script propio da control total sobre el prompt y el formato de salida (JSON estructurado con título, excerpt, meta description y HTML).
