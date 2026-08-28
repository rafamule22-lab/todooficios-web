// Edge Function: redsys-notification
// Redsys llama a esta URL servidor-a-servidor ("notificación online") tras
// procesar el pago, con Ds_MerchantParameters + Ds_Signature en el cuerpo
// (application/x-www-form-urlencoded). Esta función es la única que activa
// de verdad el Premium: nunca nos fiamos de lo que diga el navegador del
// cliente al volver de Redsys.
//
// Debe desplegarse sin verificación de JWT (ver supabase/config.toml), porque
// Redsys no envía ninguna cabecera de autenticación de Supabase.
//   supabase functions deploy redsys-notification --no-verify-jwt
//   supabase secrets set REDSYS_SECRET_KEY=... (mismo secreto que redsys-create-payment)

import { createClient } from 'npm:@supabase/supabase-js@2';
import { decodeMerchantParameters, isAuthorizedResponse, redsysSignaturesMatch } from '../_shared/redsys.ts';

const CLOUD_NAMESPACE = 'todooficios:v1';
const PREMIUM_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // debe coincidir con index.html

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return textResponse('Método no permitido', 405);

  const secretKey = Deno.env.get('REDSYS_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    console.error('redsys-notification: faltan secretos de configuración.');
    return textResponse('Configuración incompleta', 500);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return textResponse('Cuerpo inválido', 400);
  }
  const params = new URLSearchParams(rawBody);
  const merchantParametersB64 = params.get('Ds_MerchantParameters');
  const receivedSignature = params.get('Ds_Signature');
  if (!merchantParametersB64 || !receivedSignature) {
    return textResponse('Faltan parámetros', 400);
  }

  let merchantParams: Record<string, string>;
  try {
    merchantParams = decodeMerchantParameters(merchantParametersB64);
  } catch {
    return textResponse('Ds_MerchantParameters inválido', 400);
  }

  const order = merchantParams.Ds_Order;
  const response = merchantParams.Ds_Response;
  if (!order || response === undefined) {
    return textResponse('Faltan campos en Ds_MerchantParameters', 400);
  }

  if (!redsysSignaturesMatch(secretKey, order, merchantParametersB64, receivedSignature)) {
    console.error('redsys-notification: firma inválida para el pedido', order);
    return textResponse('Firma inválida', 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: orderRow, error: orderError } = await supabase
    .from('redsys_orders')
    .select('email, status')
    .eq('order_id', order)
    .maybeSingle();
  if (orderError || !orderRow) {
    console.error('redsys-notification: pedido no encontrado', order, orderError);
    // Respondemos 200 para que Redsys no reintente indefinidamente un pedido que no existe.
    return textResponse('Pedido no encontrado', 200);
  }
  if (orderRow.status === 'paid') {
    return textResponse('OK (ya procesado)', 200);
  }

  if (!isAuthorizedResponse(response)) {
    await supabase.from('redsys_orders').update({ status: 'failed' }).eq('order_id', order);
    return textResponse('Pago no autorizado registrado', 200);
  }

  const email = orderRow.email as string;
  const { data: accountRow, error: accountError } = await supabase
    .from('kv_store')
    .select('value')
    .eq('namespace', CLOUD_NAMESPACE)
    .eq('key', 'account:' + email)
    .maybeSingle();
  if (accountError || !accountRow) {
    console.error('redsys-notification: cuenta no encontrada para', email);
    return textResponse('Cuenta no encontrada', 200);
  }

  let account: { featuredUntil?: number; premiumMonthsPaid?: number };
  try {
    account = JSON.parse(accountRow.value);
  } catch {
    console.error('redsys-notification: cuenta con JSON inválido para', email);
    return textResponse('Cuenta inválida', 200);
  }

  account.featuredUntil = Date.now() + PREMIUM_DURATION_MS;
  account.premiumMonthsPaid = (account.premiumMonthsPaid || 0) + 1;

  const { error: updateError } = await supabase
    .from('kv_store')
    .upsert(
      { namespace: CLOUD_NAMESPACE, key: 'account:' + email, value: JSON.stringify(account), updated_at: new Date().toISOString() },
      { onConflict: 'namespace,key' }
    );
  if (updateError) {
    console.error('redsys-notification: no se pudo activar el Premium de', email, updateError);
    return textResponse('No se pudo activar la cuenta', 500);
  }

  await supabase.from('redsys_orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('order_id', order);

  return textResponse('OK', 200);
});
