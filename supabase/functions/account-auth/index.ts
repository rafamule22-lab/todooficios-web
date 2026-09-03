// Edge Function: account-auth
// Punto único de acceso server-side para todo lo que en kv_store no puede
// quedar abierto a `anon` sin control. Tres problemas distintos, resueltos
// aquí en fases sucesivas:
//
// 1) Credenciales: el hash+salt de la contraseña vivía dentro del mismo
//    objeto JSON público (`client:<email>` / `account:<email>`). Ahora
//    vive en `credentials:<email-key>`, sin ningún acceso para `anon`.
//
// 2) Escritura de perfiles: `anon` ya no puede hacer UPDATE/DELETE sobre
//    `client:*`/`account:*`/`negocio:*` — solo SELECT+INSERT donde aplica
//    (el directorio de `account:*` necesita ser público; `client:*` y
//    `negocio:*` ni eso). Las acciones 'get'/'save'/'delete' exigen probar
//    que eres el dueño (token propio o sesión de Supabase Auth).
//
// 3) Lectura en bloque: una política RLS solo controla qué filas puede ver
//    `anon`, no si la consulta pide una key concreta o todas — un SELECT
//    sin filtro devuelve TODO lo que la política deja pasar. Por eso
//    `client:*`, `negocio:*`, `materiales:*`, `calc-favoritas:*`,
//    `presupuesto-publico:*` y `contactMessages` están completamente
//    bloqueados para `anon` (como `credentials:*`) y solo se leen a través
//    de esta función:
//    - `presupuesto-publico:<shareId>`: el propio shareId (aleatorio, 96
//      bits) es la credencial — sin login, igual que antes, pero ya no se
//      puede volcar la colección entera sin conocerlo.
//    - `contactMessages`: un único array con las conversaciones de todos
//      los pares cliente-profesional; 'get-messages' devuelve solo las
//      del que pregunta, filtradas en el servidor.
//    `ratings` se queda con lectura pública a propósito (ya se muestra en
//    las fichas), pero la escritura pasa por 'add-rating' para que nadie
//    se invente ni borre reseñas ajenas.
//
// El token propio es un HMAC-SHA256 simple (no JWT completo) firmado con
// SESSION_SECRET. Si no está configurado, login/register siguen
// funcionando (token: null) pero ninguna acción que lo requiera puede
// verificar nada.
//
// Despliegue (en este orden):
//   1. supabase secrets set SESSION_SECRET=$(openssl rand -hex 32)
//   2. supabase functions deploy account-auth
//   3. Solo después, aplica (en orden) las migraciones
//      20260902000100_restrict_account_writes.sql,
//      20260902000200_restrict_sensitive_collections.sql y
//      20260902000300_restrict_index_keys.sql
//      (o pega supabase-kv-store.sql actualizado en el SQL Editor)
// Si el paso 3 se aplica antes que el 1-2, se rompen el login/alta de
// clientes y profesionales (incluidos los de Google), el panel de
// negocio, los mensajes, las reseñas nuevas, los presupuestos públicos y
// el directorio de profesionales hasta que despliegues la función.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CLOUD_NAMESPACE = 'todooficios:v1';
const AUTH_PREFIXES = ['client:', 'account:']; // pueden tener contraseña (register/login)
const OWNED_PREFIXES = ['client:', 'account:', 'negocio:', 'materiales:', 'calc-favoritas:']; // se leen/escriben solo por su dueño (get/save/delete)
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días, igual que la cookie de sesión del navegador

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function matchesPrefix(key: string, prefixes: string[]): string | null {
  return prefixes.find((p) => key.startsWith(p)) || null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmailKey(key: string, prefixes: string[]): boolean {
  const prefix = matchesPrefix(key, prefixes);
  if (!prefix) return false;
  return EMAIL_RE.test(key.slice(prefix.length));
}

const RATING_CRITERIA_KEYS = ['puntualidad', 'calidad', 'limpieza', 'trato', 'precio'];

// Solo se aceptan las 5 claves conocidas, cada una un número entre 1 y 5;
// cualquier otra clave o valor fuera de rango se descarta en vez de guardarse.
function sanitizeRatingCriteria(input: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (input && typeof input === 'object') {
    for (const k of RATING_CRITERIA_KEYS) {
      const v = Number((input as Record<string, unknown>)[k]);
      if (Number.isFinite(v) && v >= 1 && v <= 5) out[k] = v;
    }
  }
  return out;
}

function emailOf(key: string): string {
  return key.slice(key.indexOf(':') + 1).toLowerCase();
}

async function sha256Hex(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string): Promise<{ passwordHash: string; passwordSalt: string }> {
  const passwordSalt = generateSalt();
  const passwordHash = await sha256Hex(password + '|' + passwordSalt);
  return { passwordHash, passwordSalt };
}

function base64url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64url.length + (4 - (b64url.length % 4 || 4)) % 4, '=');
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// Token = base64url(JSON payload) + '.' + base64url(firma HMAC del payload en texto)
async function signToken(sub: string, secret: string): Promise<string> {
  const payload = JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS });
  const payloadB64 = base64url(new TextEncoder().encode(payload));
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64url(new Uint8Array(sig))}`;
}

async function verifyToken(token: string, secret: string): Promise<{ sub: string } | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const key = await getHmacKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, base64urlToBytes(sigB64), new TextEncoder().encode(payloadB64));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

type SupabaseClient = ReturnType<typeof createClient>;

// Resuelve el email autenticado de quien llama, a partir de su token propio
// (HMAC) o de una sesión real de Supabase Auth (cuentas de Google). Cuando
// viene del token propio, también devuelve con qué prefijo se emitió
// ('client:' o 'account:') para poder exigir un rol concreto; una sesión de
// Supabase Auth no tiene ese concepto, así que prefix queda null (se confía
// en el email verificado tal cual, en el contexto — cliente o profesional —
// desde el que se llama).
async function resolveIdentity(
  payload: { token?: string; authToken?: string },
  sessionSecret: string,
  supabase: SupabaseClient,
): Promise<{ email: string; prefix: string | null } | null> {
  const token = String(payload.token || '');
  if (token && sessionSecret) {
    const verified = await verifyToken(token, sessionSecret);
    if (verified) {
      const prefix = matchesPrefix(verified.sub, AUTH_PREFIXES);
      if (prefix) return { email: emailOf(verified.sub), prefix };
    }
  }
  const authToken = String(payload.authToken || '');
  if (authToken) {
    const { data: userData } = await supabase.auth.getUser(authToken);
    const authEmail = userData?.user?.email?.toLowerCase();
    if (authEmail) return { email: authEmail, prefix: null };
  }
  return null;
}

function indexKeyFor(key: string): string | null {
  if (key.startsWith('account:')) return 'accounts-index';
  if (key.startsWith('client:')) return 'clients-index';
  return null;
}

async function addToIndex(supabase: SupabaseClient, indexKey: string, email: string): Promise<void> {
  const { data } = await supabase
    .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', indexKey).maybeSingle();
  let list: string[] = [];
  try { list = data ? JSON.parse(data.value) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (list.includes(email)) return;
  list.push(email);
  await supabase.from('kv_store').upsert({
    namespace: CLOUD_NAMESPACE, key: indexKey, value: JSON.stringify(list), updated_at: new Date().toISOString(),
  }, { onConflict: 'namespace,key' });
}

async function removeFromIndex(supabase: SupabaseClient, indexKey: string, email: string): Promise<void> {
  const { data } = await supabase
    .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', indexKey).maybeSingle();
  if (!data) return;
  try {
    const list = JSON.parse(data.value);
    if (!Array.isArray(list)) return;
    const filtered = list.filter((e: string) => e !== email);
    if (filtered.length === list.length) return;
    await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE, key: indexKey, value: JSON.stringify(filtered), updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
  } catch {
    // Si el índice no es JSON válido, no hay nada sensato que filtrar.
  }
}

// Freno básico a fuerza bruta sobre login: tras LOGIN_MAX_ATTEMPTS fallos
// consecutivos para una misma cuenta en LOGIN_LOCKOUT_SECONDS, se rechaza sin
// ni siquiera mirar la contraseña. El contador vive en su propio prefijo de
// kv_store (nunca expuesto a `anon`, solo lo toca esta función con la service
// role key), y se borra en cuanto el login tiene éxito.
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_LOCKOUT_SECONDS = 15 * 60;

async function getLoginAttempts(supabase: SupabaseClient, key: string): Promise<{ count: number; first: number }> {
  const { data } = await supabase
    .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', 'login-attempts:' + key).maybeSingle();
  if (!data) return { count: 0, first: 0 };
  try {
    const v = JSON.parse(data.value);
    return { count: Number(v.count) || 0, first: Number(v.first) || 0 };
  } catch {
    return { count: 0, first: 0 };
  }
}

async function recordLoginFailure(supabase: SupabaseClient, key: string, current: { count: number; first: number }): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const stillFresh = current.count > 0 && now - current.first < LOGIN_LOCKOUT_SECONDS;
  const next = { first: stillFresh ? current.first : now, count: stillFresh ? current.count + 1 : 1 };
  await supabase.from('kv_store').upsert({
    namespace: CLOUD_NAMESPACE, key: 'login-attempts:' + key, value: JSON.stringify(next), updated_at: new Date().toISOString(),
  }, { onConflict: 'namespace,key' });
}

async function clearLoginAttempts(supabase: SupabaseClient, key: string): Promise<void> {
  await supabase.from('kv_store').delete().eq('namespace', CLOUD_NAMESPACE).eq('key', 'login-attempts:' + key);
}

async function purgeRatingsForPro(supabase: SupabaseClient, proEmail: string): Promise<void> {
  const { data } = await supabase
    .from('kv_store')
    .select('value')
    .eq('namespace', CLOUD_NAMESPACE)
    .eq('key', 'ratings')
    .maybeSingle();
  if (!data) return;
  try {
    const list = JSON.parse(data.value);
    if (!Array.isArray(list)) return;
    const filtered = list.filter((r: { proEmail?: string }) => r.proEmail !== proEmail);
    if (filtered.length === list.length) return;
    await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE,
      key: 'ratings',
      value: JSON.stringify(filtered),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
  } catch {
    // Si 'ratings' no es JSON válido, no hay nada sensato que filtrar.
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const sessionSecret = Deno.env.get('SESSION_SECRET') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'El servidor no tiene configurada la autenticación todavía.' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let payload: {
    action?: string; key?: string; password?: string; token?: string; authToken?: string; value?: unknown;
    role?: string; proEmail?: string; message?: string; clientName?: string; messageKey?: string; replyText?: string;
    rating?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Petición inválida.' }, 400);
  }

  const action = payload.action;

  // ---- register / login: solo cuentas con contraseña (client:/account:) ----
  if (action === 'register' || action === 'login') {
    const key = String(payload.key || '');
    if (!isValidEmailKey(key, AUTH_PREFIXES)) return jsonResponse({ error: 'Cuenta inválida.' }, 400);
    const password = String(payload.password || '');
    if (!password) return jsonResponse({ error: 'Falta la contraseña.' }, 400);
    const credentialsKey = 'credentials:' + key;

    if (action === 'register') {
      const { data: existingCred, error: readCredError } = await supabase
        .from('kv_store').select('key').eq('namespace', CLOUD_NAMESPACE).eq('key', credentialsKey).maybeSingle();
      if (readCredError) return jsonResponse({ error: 'No se pudo comprobar la cuenta.' }, 500);
      const { data: existingProfile, error: readProfileError } = await supabase
        .from('kv_store').select('key').eq('namespace', CLOUD_NAMESPACE).eq('key', key).maybeSingle();
      if (readProfileError) return jsonResponse({ error: 'No se pudo comprobar la cuenta.' }, 500);
      if (existingCred || existingProfile) return jsonResponse({ error: 'Ya existe una cuenta con ese email.' }, 409);

      const { passwordHash, passwordSalt } = await hashPassword(password);
      const { error: writeError } = await supabase.from('kv_store').upsert({
        namespace: CLOUD_NAMESPACE, key: credentialsKey,
        value: JSON.stringify({ passwordHash, passwordSalt }), updated_at: new Date().toISOString(),
      }, { onConflict: 'namespace,key' });
      if (writeError) return jsonResponse({ error: 'No se pudo guardar la contraseña.' }, 500);

      const indexKey = indexKeyFor(key);
      if (indexKey) await addToIndex(supabase, indexKey, emailOf(key));

      const token = sessionSecret ? await signToken(key, sessionSecret) : null;
      return jsonResponse({ ok: true, token });
    }

    // action === 'login'
    const loginAttempts = await getLoginAttempts(supabase, key);
    const attemptsAge = Math.floor(Date.now() / 1000) - loginAttempts.first;
    if (loginAttempts.count >= LOGIN_MAX_ATTEMPTS && attemptsAge < LOGIN_LOCKOUT_SECONDS) {
      return jsonResponse({ error: 'Demasiados intentos fallidos. Prueba de nuevo en unos minutos.' }, 429);
    }

    const respondOk = async () => {
      await clearLoginAttempts(supabase, key);
      const token = sessionSecret ? await signToken(key, sessionSecret) : null;
      const { data: profileRow } = await supabase
        .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', key).maybeSingle();
      return jsonResponse({ ok: true, token, profile: profileRow?.value ?? null });
    };

    const { data: credRow, error: credError } = await supabase
      .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', credentialsKey).maybeSingle();
    if (credError) return jsonResponse({ error: 'No se pudo verificar la contraseña.' }, 500);

    if (credRow) {
      const record = JSON.parse(credRow.value);
      const hash = await sha256Hex(password + '|' + record.passwordSalt);
      if (hash !== record.passwordHash) {
        await recordLoginFailure(supabase, key, loginAttempts);
        return jsonResponse({ ok: false });
      }
      return await respondOk();
    }

    // Cuenta creada antes de que existiera esta función: el hash (o, en el
    // caso más antiguo, la contraseña en texto plano) vive dentro del propio
    // perfil. Si es un hash válido, lo migramos a `credentials:` y lo
    // quitamos del perfil. La contraseña en texto plano ya NO se acepta.
    const { data: profileRow, error: profileError } = await supabase
      .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', key).maybeSingle();
    if (profileError) return jsonResponse({ error: 'No se pudo verificar la contraseña.' }, 500);
    if (!profileRow) {
      await recordLoginFailure(supabase, key, loginAttempts);
      return jsonResponse({ ok: false });
    }

    const profile = JSON.parse(profileRow.value);
    if (!profile.passwordHash || !profile.passwordSalt) {
      return jsonResponse({ ok: false, error: 'legacy_password' });
    }

    const hash = await sha256Hex(password + '|' + profile.passwordSalt);
    if (hash !== profile.passwordHash) {
      await recordLoginFailure(supabase, key, loginAttempts);
      return jsonResponse({ ok: false });
    }

    const { error: migrateError } = await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE, key: credentialsKey,
      value: JSON.stringify({ passwordHash: profile.passwordHash, passwordSalt: profile.passwordSalt }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
    if (migrateError) return jsonResponse({ error: 'No se pudo migrar la cuenta.' }, 500);

    delete profile.passwordHash;
    delete profile.passwordSalt;
    delete profile.password;
    await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE, key, value: JSON.stringify(profile), updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });

    return await respondOk();
  }

  // ---- get / save / delete: cualquier key propia (client:/account:/negocio:) ----
  if (action === 'get' || action === 'save' || action === 'delete') {
    const key = String(payload.key || '');
    if (!isValidEmailKey(key, OWNED_PREFIXES)) return jsonResponse({ error: 'Clave inválida.' }, 400);

    const identity = await resolveIdentity(payload, sessionSecret, supabase);
    if (!identity || identity.email !== emailOf(key)) {
      return jsonResponse({ error: 'Sesión inválida o caducada. Vuelve a iniciar sesión.' }, 401);
    }

    if (action === 'get') {
      const { data, error } = await supabase
        .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', key).maybeSingle();
      if (error) return jsonResponse({ error: 'No se pudo leer.' }, 500);
      return jsonResponse({ ok: true, value: data?.value ?? null });
    }

    if (action === 'delete') {
      const { error } = await supabase.from('kv_store').delete().eq('namespace', CLOUD_NAMESPACE).eq('key', key);
      if (error) return jsonResponse({ error: 'No se pudo eliminar.' }, 500);
      if (key.startsWith('account:')) await purgeRatingsForPro(supabase, emailOf(key));
      const indexKey = indexKeyFor(key);
      if (indexKey) await removeFromIndex(supabase, indexKey, emailOf(key));
      return jsonResponse({ ok: true });
    }

    // action === 'save'
    if (typeof payload.value !== 'string') return jsonResponse({ error: 'Falta el contenido a guardar.' }, 400);
    const { error } = await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE, key, value: payload.value, updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
    if (error) return jsonResponse({ error: 'No se pudo guardar.' }, 500);
    return jsonResponse({ ok: true });
  }

  // ---- accounts-index / clients-index: solo lectura pública (accounts-index,
  // necesaria para el directorio) o ninguna (clients-index); los añade 'register'
  // para las cuentas con contraseña, y esta acción para las cuentas de Google
  // (que no pasan por 'register' al no tener contraseña) ----
  if (action === 'index-add') {
    const key = String(payload.key || '');
    if (!isValidEmailKey(key, AUTH_PREFIXES)) return jsonResponse({ error: 'Cuenta inválida.' }, 400);
    const identity = await resolveIdentity(payload, sessionSecret, supabase);
    if (!identity || identity.email !== emailOf(key)) {
      return jsonResponse({ error: 'Sesión inválida o caducada.' }, 401);
    }
    const indexKey = indexKeyFor(key);
    if (indexKey) await addToIndex(supabase, indexKey, emailOf(key));
    return jsonResponse({ ok: true });
  }

  // ---- reseñas: lectura pública (RLS), escritura solo por aquí ----
  if (action === 'add-rating') {
    // La app permite dejar una reseña sin haber iniciado sesión como
    // cliente (clientEmail queda null en ese caso, igual que antes). Si SÍ
    // hay sesión, se usa el email verificado — nunca el que venga en
    // payload.rating, para que nadie pueda firmar una reseña con el email
    // de otro cliente. El resto del objeto se reconstruye campo a campo
    // (id incluido) en vez de aceptar lo que mande el cliente tal cual:
    // sin esto, cualquiera sin sesión podía meter cualquier clave/valor
    // arbitrario (incluido HTML/JS) en una reseña pública.
    const identity = await resolveIdentity(payload, sessionSecret, supabase);
    const clientEmail = (identity && (!identity.prefix || identity.prefix === 'client:')) ? identity.email : null;
    const rating = payload.rating;
    if (!rating || typeof rating !== 'object') return jsonResponse({ error: 'Falta la reseña.' }, 400);
    const raw = rating as Record<string, unknown>;

    const proEmail = String(raw.proEmail || '').toLowerCase();
    if (!EMAIL_RE.test(proEmail)) return jsonResponse({ error: 'Profesional inválido.' }, 400);
    const criteria = sanitizeRatingCriteria(raw.criteria);
    if (Object.keys(criteria).length !== RATING_CRITERIA_KEYS.length) {
      return jsonResponse({ error: 'Faltan criterios de la valoración.' }, 400);
    }
    const overall = RATING_CRITERIA_KEYS.reduce((s, k) => s + criteria[k], 0) / RATING_CRITERIA_KEYS.length;

    const clean = {
      id: 'rt' + Date.now() + Math.random().toString(36).slice(2, 8),
      proEmail,
      clientEmail,
      clientName: String(raw.clientName || '').slice(0, 120),
      criteria,
      overall,
      wouldRehire: raw.wouldRehire === true,
      title: String(raw.title || '').slice(0, 200),
      comment: String(raw.comment || '').slice(0, 2000),
      createdAt: Date.now(),
    };

    const { data } = await supabase
      .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', 'ratings').maybeSingle();
    let list: unknown[] = [];
    try { list = data ? JSON.parse(data.value) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    list.push(clean);

    const { error } = await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE, key: 'ratings', value: JSON.stringify(list), updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
    if (error) return jsonResponse({ error: 'No se pudo guardar la reseña.' }, 500);
    return jsonResponse({ ok: true });
  }

  if (action === 'delete-rating') {
    const identity = await resolveIdentity(payload, sessionSecret, supabase);
    if (!identity || (identity.prefix && identity.prefix !== 'client:')) {
      return jsonResponse({ error: 'Sesión de cliente inválida o caducada.' }, 401);
    }
    const ratingId = String(payload.key || '');
    if (!ratingId) return jsonResponse({ error: 'Falta la reseña a eliminar.' }, 400);

    const { data } = await supabase
      .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', 'ratings').maybeSingle();
    let list: Array<{ id?: string; clientEmail?: string | null }> = [];
    try { list = data ? JSON.parse(data.value) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    const rating = list.find((r) => r.id === ratingId);
    if (!rating || rating.clientEmail !== identity.email) {
      return jsonResponse({ error: 'Reseña no encontrada.' }, 404);
    }
    const filtered = list.filter((r) => r.id !== ratingId);

    const { error } = await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE, key: 'ratings', value: JSON.stringify(filtered), updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
    if (error) return jsonResponse({ error: 'No se pudo eliminar la reseña.' }, 500);
    return jsonResponse({ ok: true });
  }

  // ---- mensajería: contactMessages es un único array compartido, bloqueado
  // para anon; aquí se filtra/escribe con el email ya verificado ----
  if (action === 'get-messages') {
    const requiredPrefix = payload.role === 'pro' ? 'account:' : 'client:';
    const identity = await resolveIdentity(payload, sessionSecret, supabase);
    if (!identity || (identity.prefix && identity.prefix !== requiredPrefix)) {
      return jsonResponse({ error: 'Sesión inválida o caducada.' }, 401);
    }
    const { data } = await supabase
      .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', 'contactMessages').maybeSingle();
    let list: Array<{ clientEmail?: string; proEmail?: string }> = [];
    try { list = data ? JSON.parse(data.value) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    const mine = payload.role === 'pro'
      ? list.filter((m) => m.proEmail === identity.email)
      : list.filter((m) => m.clientEmail === identity.email);
    return jsonResponse({ ok: true, messages: mine });
  }

  if (action === 'add-message') {
    const identity = await resolveIdentity(payload, sessionSecret, supabase);
    if (!identity || (identity.prefix && identity.prefix !== 'client:')) {
      return jsonResponse({ error: 'Sesión de cliente inválida o caducada.' }, 401);
    }
    const proEmail = String(payload.proEmail || '').toLowerCase();
    const message = String(payload.message || '').trim();
    if (!proEmail || !message) return jsonResponse({ error: 'Falta el profesional o el mensaje.' }, 400);

    const { data } = await supabase
      .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', 'contactMessages').maybeSingle();
    let list: unknown[] = [];
    try { list = data ? JSON.parse(data.value) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    list.push({
      id: 'msg' + Date.now() + Math.random().toString(36).slice(2, 8),
      clientEmail: identity.email,
      clientName: String(payload.clientName || '').slice(0, 120),
      proEmail, message: message.slice(0, 4000), sentAt: Date.now(), replies: [],
    });

    const { error } = await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE, key: 'contactMessages', value: JSON.stringify(list), updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
    if (error) return jsonResponse({ error: 'No se pudo enviar el mensaje.' }, 500);
    return jsonResponse({ ok: true });
  }

  if (action === 'add-reply') {
    const identity = await resolveIdentity(payload, sessionSecret, supabase);
    if (!identity || (identity.prefix && identity.prefix !== 'account:')) {
      return jsonResponse({ error: 'Sesión de profesional inválida o caducada.' }, 401);
    }
    const messageKey = String(payload.messageKey || '');
    const replyText = String(payload.replyText || '').trim();
    if (!messageKey || !replyText) return jsonResponse({ error: 'Falta el mensaje o la respuesta.' }, 400);

    const { data } = await supabase
      .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', 'contactMessages').maybeSingle();
    let list: Array<{ id?: string; clientEmail?: string; sentAt?: number; proEmail?: string; replies?: unknown[] }> = [];
    try { list = data ? JSON.parse(data.value) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    const msg = list.find((m) => (m.id || (m.clientEmail + '|' + m.sentAt)) === messageKey);
    if (!msg || msg.proEmail !== identity.email) return jsonResponse({ error: 'Mensaje no encontrado.' }, 404);
    msg.replies = msg.replies || [];
    msg.replies.push({ text: replyText.slice(0, 4000), sentAt: Date.now() });

    const { error } = await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE, key: 'contactMessages', value: JSON.stringify(list), updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
    if (error) return jsonResponse({ error: 'No se pudo enviar la respuesta.' }, 500);
    return jsonResponse({ ok: true, clientEmail: msg.clientEmail });
  }

  // ---- presupuesto público: el shareId (96 bits aleatorios) es la propia
  // credencial — sin login, igual que antes, pero ya sin poder volcar toda
  // la colección sin conocerlo ----
  if (action === 'get-public-presupuesto' || action === 'save-public-presupuesto') {
    const key = String(payload.key || '');
    if (!key.startsWith('presupuesto-publico:') || key.length < 30) {
      return jsonResponse({ error: 'Enlace inválido.' }, 400);
    }
    if (action === 'get-public-presupuesto') {
      const { data, error } = await supabase
        .from('kv_store').select('value').eq('namespace', CLOUD_NAMESPACE).eq('key', key).maybeSingle();
      if (error) return jsonResponse({ error: 'No se pudo leer el presupuesto.' }, 500);
      return jsonResponse({ ok: true, value: data?.value ?? null });
    }
    if (typeof payload.value !== 'string') return jsonResponse({ error: 'Falta el contenido a guardar.' }, 400);
    const { error } = await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE, key, value: payload.value, updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
    if (error) return jsonResponse({ error: 'No se pudo guardar el presupuesto.' }, 500);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Acción desconocida.' }, 400);
});
