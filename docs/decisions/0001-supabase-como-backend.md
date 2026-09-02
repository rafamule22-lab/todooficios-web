# ADR 0001: Usar Supabase como backend compartido

## Estado
Aceptado (en uso).

## Contexto
TodoOficios.es es un sitio estático (HTML/JS/CSS sin build ni framework) desplegado manualmente en Hostinger. Necesitaba algún sitio donde persistir datos que antes solo vivían en `localStorage` (cuentas, presupuestos, mensajes) para que sobrevivieran a cambiar de navegador/dispositivo, sin montar un backend propio.

## Decisión
Se usa Supabase (Postgres gestionado + API REST autogenerada) como almacén compartido, accedido directamente desde el navegador con la librería `@supabase/supabase-js` y la anon key pública. Se implementó como un patrón de almacén clave/valor genérico (tabla `kv_store`, ver `supabase/migrations/`) que actúa como sustituto en la nube de `localStorage`: mismas claves, mismo formato JSON en `value`, sin autenticación real de Supabase (`auth.uid()` no se usa en ningún sitio).

## Consecuencias
- Cero backend propio que mantener; el sitio sigue siendo estático.
- **La seguridad de acceso depende enteramente de las políticas RLS de `kv_store`**, no de una capa de autenticación real — el login se verifica en el cliente (`verifyPasswordRecord` en `index.html`). Esto es el punto más delicado de toda la arquitectura y debe revisarse antes de escalar el número de usuarios reales.
- Cualquier cambio de "quién puede leer/escribir qué" requiere replantear las políticas RLS por `key`, no por usuario, porque no hay identidad de sesión en la base de datos.
- Las operaciones que sí necesitan privilegios elevados (leer todos los posts en borrador, notificar respuestas) se hacen desde Edge Functions con `SUPABASE_SERVICE_ROLE_KEY`, nunca desde el cliente.

## Alternativas consideradas
No hay evidencia en el repo de que se evaluaran alternativas (Firebase, backend propio en un VPS) antes de esta decisión.
