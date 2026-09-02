# ADR 0001: Usar Supabase como backend compartido

## Estado
Aceptado (en uso).

## Contexto
TodoOficios.es es un sitio estático (HTML/JS/CSS sin build ni framework) desplegado manualmente en Hostinger. Necesitaba algún sitio donde persistir datos que antes solo vivían en `localStorage` (cuentas, presupuestos, mensajes) para que sobrevivieran a cambiar de navegador/dispositivo, sin montar un backend propio.

## Decisión
Se usa Supabase (Postgres gestionado + API REST autogenerada) como almacén compartido, accedido directamente desde el navegador con la librería `@supabase/supabase-js` y la anon key pública. Se implementó como un patrón de almacén clave/valor genérico (tabla `kv_store`, ver `supabase/migrations/`) que actúa como sustituto en la nube de `localStorage`: mismas claves, mismo formato JSON en `value`, sin autenticación real de Supabase (`auth.uid()` no se usa en ningún sitio).

## Consecuencias
- Cero backend propio que mantener; el sitio sigue siendo estático.
- **La seguridad de acceso depende de las políticas RLS de `kv_store`**, no de una capa de autenticación real — no hay sesión ni JWT: el navegador simplemente recuerda un email en `localStorage` como "sesión". Esto es el punto más delicado de toda la arquitectura.
- (2026-09) Se cerró la parte más grave: las contraseñas (`passwordHash`/`passwordSalt`) vivían dentro del mismo objeto público (`client:<email>` / `account:<email>`) que cualquiera podía leer y sobrescribir con la anon key — permitía tanto exfiltrar todos los hashes como tomar cualquier cuenta reescribiéndolos. Ahora viven en `credentials:<email-key>`, con RLS que bloquea ese prefijo para `anon` por completo, y la verificación/alta de contraseña se hace en la Edge Function `account-auth` con `SUPABASE_SERVICE_ROLE_KEY`. Se retiró también el fallback que aceptaba contraseñas en texto plano sin hash.
- **Lo que queda sin resolver:** el resto de cada perfil (fotos, bio, precios, `featuredUntil`, mensajes, presupuestos) sigue siendo de lectura Y escritura pública para `anon` — cualquiera con la anon key puede seguir editando el perfil público de otra persona (aunque ya no puede robarle ni cambiarle la contraseña). Cerrar eso del todo requeriría extender el mismo patrón (gatekeeper server-side) a cada operación de escritura del panel de negocio, que es una superficie mucho más grande y no se abordó en este cambio.
- Cualquier cambio de "quién puede leer/escribir qué" requiere replantear las políticas RLS por `key` (prefijo), no por usuario, porque no hay identidad de sesión en la base de datos.
- Las operaciones que necesitan privilegios elevados (leer todos los posts en borrador, notificar respuestas, verificar contraseñas) se hacen desde Edge Functions con `SUPABASE_SERVICE_ROLE_KEY`, nunca desde el cliente.

## Alternativas consideradas
No hay evidencia en el repo de que se evaluaran alternativas (Firebase, backend propio en un VPS) antes de esta decisión.
