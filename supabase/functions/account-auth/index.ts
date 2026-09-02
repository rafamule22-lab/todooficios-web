// Edge Function: account-auth
// Verifica y guarda contraseñas de cuentas (clientes y profesionales) del lado
// del servidor, en vez de hacerlo en el navegador contra un registro leído
// directamente de kv_store con la anon key.
//
// Antes de esta función, el hash+salt de la contraseña vivía dentro del mismo
// objeto JSON público (`client:<email>` / `account:<email>`) que cualquiera
// puede leer con la anon key (necesario para que el directorio público
// funcione). Esta función mueve esas dos credenciales a una key aparte,
// `credentials:<email-key>`, a la que las políticas RLS de kv_store ya no dan
// acceso de lectura/escritura a `anon` (ver supabase/migrations) — solo esta
// función, con SUPABASE_SERVICE_ROLE_KEY, puede tocarla.
//
// No cambia nada del resto del perfil (fotos, bio, presupuestos, etc.): eso
// sigue leyéndose/escribiéndose igual que antes desde el cliente.
//
// Despliegue: supabase functions deploy account-auth
// (usa las variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY que Supabase
// inyecta automáticamente en toda Edge Function; no hace falta configurarlas)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CLOUD_NAMESPACE = 'todooficios:v1';
const KEY_PREFIXES = ['client:', 'account:'];

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'El servidor no tiene configurada la autenticación todavía.' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let payload: { action?: string; key?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Petición inválida.' }, 400);
  }

  const action = payload.action;
  const key = String(payload.key || '');
  const password = String(payload.password || '');

  if (!isValidAccountKey(key)) {
    return jsonResponse({ error: 'Cuenta inválida.' }, 400);
  }
  if (!password) {
    return jsonResponse({ error: 'Falta la contraseña.' }, 400);
  }

  const credentialsKey = 'credentials:' + key;

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

    return jsonResponse({ ok: true });
  }

  if (action === 'login') {
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
      return jsonResponse({ ok: hash === record.passwordHash });
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

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Acción desconocida.' }, 400);
});
