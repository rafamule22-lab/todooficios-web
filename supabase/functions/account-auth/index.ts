// Edge Function: account-auth
// Verifica contraseñas y protege las escrituras de cuentas (clientes y
// profesionales) del lado del servidor, en vez de hacerlo en el navegador
// contra un registro leído/escrito directamente en kv_store con la anon key.
//
// Dos problemas distintos, resueltos aquí:
//
// 1) Credenciales: el hash+salt de la contraseña vivía dentro del mismo
//    objeto JSON público (`client:<email>` / `account:<email>`) que
//    cualquiera puede leer con la anon key (necesario para que el
//    directorio público funcione). Se movieron a una key aparte,
//    `credentials:<email-key>`, a la que las políticas RLS ya no dan
//    ningún acceso a `anon` (ver supabase/migrations) — solo esta función,
//    con SUPABASE_SERVICE_ROLE_KEY, puede tocarla.
//
// 2) Escritura del perfil: las políticas RLS solo dejan a `anon` LEER y
//    CREAR (insert) filas `client:*`/`account:*` — ya no puede
//    actualizarlas ni borrarlas. Actualizar/borrar tu propio perfil (editar
//    ficha, marcar favorito, activar destacado, eliminar cuenta) pasa por
//    las acciones 'save'/'delete' de aquí, que exigen el token de sesión
//    que devuelve 'login'/'register'.
//
// El token es un HMAC-SHA256 simple (no JWT completo) firmado con el
// secreto SESSION_SECRET. Si SESSION_SECRET no está configurado, login y
// register siguen funcionando (devuelven token: null) pero 'save'/'delete'
// no pueden verificar nada — el cliente cae de vuelta al escritura directa
// de antes, que solo sigue funcionando si NO se ha aplicado todavía la
// migración que restringe UPDATE/DELETE. Por eso el orden de despliegue
// importa, ver README más abajo.
//
// Despliegue (en este orden):
//   1. supabase secrets set SESSION_SECRET=$(openssl rand -hex 32)
//   2. supabase functions deploy account-auth
//   3. Solo después, aplica supabase/migrations/20260902000100_restrict_account_writes.sql
//      (o pega supabase-kv-store.sql actualizado en el SQL Editor)
// Si se aplica el paso 3 antes que el 1-2, nadie podrá editar su perfil,
// marcar favoritos ni eliminar su cuenta hasta que despliegues la función.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CLOUD_NAMESPACE = 'todooficios:v1';
const KEY_PREFIXES = ['client:', 'account:'];
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

function isValidAccountKey(key: string): boolean {
  const prefix = KEY_PREFIXES.find((p) => key.startsWith(p));
  if (!prefix) return false;
  const email = key.slice(prefix.length);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

  let payload: { action?: string; key?: string; password?: string; token?: string; authToken?: string; value?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Petición inválida.' }, 400);
  }

  const action = payload.action;
  const key = String(payload.key || '');

  if (!isValidAccountKey(key)) {
    return jsonResponse({ error: 'Cuenta inválida.' }, 400);
  }

  const credentialsKey = 'credentials:' + key;

  if (action === 'register' || action === 'login') {
    const password = String(payload.password || '');
    if (!password) return jsonResponse({ error: 'Falta la contraseña.' }, 400);

    if (action === 'register') {
      const { data: existing, error: readError } = await supabase
        .from('kv_store')
        .select('key')
        .eq('namespace', CLOUD_NAMESPACE)
        .eq('key', credentialsKey)
        .maybeSingle();
      if (readError) return jsonResponse({ error: 'No se pudo comprobar la cuenta.' }, 500);
      if (existing) return jsonResponse({ error: 'Ya existe una cuenta con ese email.' }, 409);

      const { passwordHash, passwordSalt } = await hashPassword(password);
      const { error: writeError } = await supabase.from('kv_store').upsert({
        namespace: CLOUD_NAMESPACE,
        key: credentialsKey,
        value: JSON.stringify({ passwordHash, passwordSalt }),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'namespace,key' });
      if (writeError) return jsonResponse({ error: 'No se pudo guardar la contraseña.' }, 500);

      const token = sessionSecret ? await signToken(key, sessionSecret) : null;
      return jsonResponse({ ok: true, token });
    }

    // action === 'login'
    const { data: credRow, error: credError } = await supabase
      .from('kv_store')
      .select('value')
      .eq('namespace', CLOUD_NAMESPACE)
      .eq('key', credentialsKey)
      .maybeSingle();
    if (credError) return jsonResponse({ error: 'No se pudo verificar la contraseña.' }, 500);

    if (credRow) {
      const record = JSON.parse(credRow.value);
      const hash = await sha256Hex(password + '|' + record.passwordSalt);
      if (hash !== record.passwordHash) return jsonResponse({ ok: false });
      const token = sessionSecret ? await signToken(key, sessionSecret) : null;
      return jsonResponse({ ok: true, token });
    }

    // Cuenta creada antes de que existiera esta función: el hash (o, en el
    // caso más antiguo, la contraseña en texto plano) vive dentro del propio
    // perfil público. Si es un hash válido, lo migramos a `credentials:` y lo
    // quitamos del perfil. La contraseña en texto plano ya NO se acepta.
    const { data: profileRow, error: profileError } = await supabase
      .from('kv_store')
      .select('value')
      .eq('namespace', CLOUD_NAMESPACE)
      .eq('key', key)
      .maybeSingle();
    if (profileError) return jsonResponse({ error: 'No se pudo verificar la contraseña.' }, 500);
    if (!profileRow) return jsonResponse({ ok: false });

    const profile = JSON.parse(profileRow.value);
    if (!profile.passwordHash || !profile.passwordSalt) {
      // Solo tenía `password` en texto plano (o ninguna credencial): ya no hay fallback.
      return jsonResponse({ ok: false, error: 'legacy_password' });
    }

    const hash = await sha256Hex(password + '|' + profile.passwordSalt);
    if (hash !== profile.passwordHash) return jsonResponse({ ok: false });

    const { error: migrateError } = await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE,
      key: credentialsKey,
      value: JSON.stringify({ passwordHash: profile.passwordHash, passwordSalt: profile.passwordSalt }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
    if (migrateError) return jsonResponse({ error: 'No se pudo migrar la cuenta.' }, 500);

    delete profile.passwordHash;
    delete profile.passwordSalt;
    delete profile.password;
    await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE,
      key,
      value: JSON.stringify(profile),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });

    const token = sessionSecret ? await signToken(key, sessionSecret) : null;
    return jsonResponse({ ok: true, token });
  }

  if (action === 'save' || action === 'delete') {
    // Dos formas válidas de probar "soy el dueño de esta key": el token propio
    // (cuentas con email+contraseña, emitido en login/register) o una sesión
    // real de Supabase Auth (cuentas creadas con Google) cuyo email coincida
    // con el de la key. Una cuenta usa una vía u otra, nunca las dos.
    let authorized = false;

    const token = String(payload.token || '');
    if (token && sessionSecret) {
      const verified = await verifyToken(token, sessionSecret);
      if (verified && verified.sub === key) authorized = true;
    }

    if (!authorized) {
      const authToken = String(payload.authToken || '');
      if (authToken) {
        const { data: userData } = await supabase.auth.getUser(authToken);
        const authEmail = userData?.user?.email?.toLowerCase();
        const keyEmail = key.slice(key.indexOf(':') + 1).toLowerCase();
        if (authEmail && authEmail === keyEmail) authorized = true;
      }
    }

    if (!authorized) {
      return jsonResponse({ error: 'Sesión inválida o caducada. Vuelve a iniciar sesión.' }, 401);
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('kv_store')
        .delete()
        .eq('namespace', CLOUD_NAMESPACE)
        .eq('key', key);
      if (error) return jsonResponse({ error: 'No se pudo eliminar la cuenta.' }, 500);
      // El token queda inválido de forma natural: la próxima lectura de este
      // perfil ya no existe, y un login futuro emite un token nuevo.
      return jsonResponse({ ok: true });
    }

    // action === 'save'
    if (typeof payload.value !== 'string') return jsonResponse({ error: 'Falta el contenido a guardar.' }, 400);
    const { error } = await supabase.from('kv_store').upsert({
      namespace: CLOUD_NAMESPACE,
      key,
      value: payload.value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'namespace,key' });
    if (error) return jsonResponse({ error: 'No se pudo guardar el perfil.' }, 500);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Acción desconocida.' }, 400);
});
