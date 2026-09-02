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
- (2026-09, fase 1) Se cerró la parte más grave: las contraseñas (`passwordHash`/`passwordSalt`) vivían dentro del mismo objeto público (`client:<email>` / `account:<email>`) que cualquiera podía leer y sobrescribir con la anon key — permitía tanto exfiltrar todos los hashes como tomar cualquier cuenta reescribiéndolos. Ahora viven en `credentials:<email-key>`, con RLS que bloquea ese prefijo para `anon` por completo, y la verificación/alta de contraseña se hace en la Edge Function `account-auth` con `SUPABASE_SERVICE_ROLE_KEY`. Se retiró también el fallback que aceptaba contraseñas en texto plano sin hash.
- (2026-09, fase 2) Se cerró también la escritura del resto del perfil: `anon` ya no puede hacer UPDATE ni DELETE sobre `client:*`/`account:*` (solo puede seguir leyéndolas —necesario para el directorio— y crear cuentas nuevas, que es un INSERT). Editar tu ficha, marcar favoritos, activar destacado o eliminar tu cuenta pasa por las acciones `save`/`delete` de `account-auth`, que exigen un token de sesión (HMAC firmado con `SESSION_SECRET`, emitido en login/alta) o, para las cuentas creadas con Google, la propia sesión de Supabase Auth. Antes de esto, cualquiera con la anon key podía reescribir o borrar el perfil público de otra persona.
- **Lo que queda sin resolver:** el resto de las keys del negocio (`negocio:<email>` — gastos, agenda, clientes propios, presupuestos internos — y colecciones compartidas como `contactMessages`) siguen siendo de lectura y escritura totalmente públicas para `anon`, con el mismo patrón de riesgo que tenía `client:`/`account:` antes de la fase 2. Extenderles el mismo gatekeeper es el siguiente paso lógico, pero es una superficie de llamadas mucho más grande (todo el panel de negocio) y no se abordó todavía.
- El pago real (PayPal) está desactivado en producción (`PAYMENTS_ENABLED = false` en `index.html`), así que `markFeaturedAccount()` (dar Premium) no tiene hoy verificación de pago del lado servidor — cuando se active el cobro real, esa función necesitará confirmar el pago con la API de PayPal antes de marcar la cuenta como destacada, no solo comprobar que el que llama es el dueño de la cuenta.
- Cualquier cambio de "quién puede leer/escribir qué" requiere replantear las políticas RLS por `key` (prefijo), no por usuario, porque no hay identidad de sesión en la base de datos.
- Las operaciones que necesitan privilegios elevados (leer todos los posts en borrador, notificar respuestas, verificar contraseñas) se hacen desde Edge Functions con `SUPABASE_SERVICE_ROLE_KEY`, nunca desde el cliente.

## Alternativas consideradas
No hay evidencia en el repo de que se evaluaran alternativas (Firebase, backend propio en un VPS) antes de esta decisión.
