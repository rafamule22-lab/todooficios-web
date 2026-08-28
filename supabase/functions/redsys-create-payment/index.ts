// Edge Function: redsys-create-payment
// El cliente (index.html) llama a esta función cuando un profesional pulsa
// "Activar Premium" / "Renovar". Calcula el importe a cobrar según el estado
// real de su cuenta (guardado en Supabase, no en lo que mande el navegador),
// registra el pedido y devuelve los campos ya firmados para que el cliente
// haga un POST de redirección a la pasarela de Redsys.
//
// La clave secreta de comercio nunca sale de aquí. Despliegue:
//   supabase functions deploy redsys-create-payment
//   supabase secrets set REDSYS_MERCHANT_CODE=999008881 REDSYS_TERMINAL=1 \
//     REDSYS_SECRET_KEY=sq7HjrUOBfKmC576ILgskD5srU870gJ7 REDSYS_ENV=test \
//     SITE_URL=https://todooficios.es

import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeMerchantParameters, generateOrderId, redsysPaymentUrl, redsysSign } from '../_shared/redsys.ts';

const CLOUD_NAMESPACE = 'todooficios:v1';

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

// Debe coincidir con la tarificación por escalones de index.html (premiumPrice).
const PREMIUM_PRICE_FIRST_YEAR = 4.99;
const PREMIUM_PRICE_YEAR2 = 6.99;
const PREMIUM_PRICE_YEAR3 = 8.99;
const PREMIUM_PRICE_RENEWAL = 9.99;
const PREMIUM_FOUNDER_MONTHS = 24;

function premiumPrice(acc: { premiumMonthsPaid?: number; premiumPromo?: boolean }): number {
  const paid = acc.premiumMonthsPaid || 0;
  const year1Months = acc.premiumPromo ? PREMIUM_FOUNDER_MONTHS : 12;
  if (paid < year1Months) return PREMIUM_PRICE_FIRST_YEAR;
  if (paid < year1Months + 12) return PREMIUM_PRICE_YEAR2;
  if (paid < year1Months + 24) return PREMIUM_PRICE_YEAR3;
  return PREMIUM_PRICE_RENEWAL;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);

  const merchantCode = Deno.env.get('REDSYS_MERCHANT_CODE');
  const terminal = Deno.env.get('REDSYS_TERMINAL');
  const secretKey = Deno.env.get('REDSYS_SECRET_KEY');
  const env = Deno.env.get('REDSYS_ENV') || 'test';
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://todooficios.es').replace(/\/+$/, '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!merchantCode || !terminal || !secretKey || !supabaseUrl || !serviceRoleKey) {
    console.error('redsys-create-payment: faltan secretos de configuración.');
    return jsonResponse({ error: 'La pasarela de pago todavía no está configurada. Inténtalo más tarde.' }, 500);
  }

  let payload: { email?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Petición inválida.' }, 400);
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Falta un email de cuenta válido.' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: accountRow, error: accountError } = await supabase
    .from('kv_store')
    .select('value')
    .eq('namespace', CLOUD_NAMESPACE)
    .eq('key', 'account:' + email)
    .maybeSingle();
  if (accountError || !accountRow) {
    return jsonResponse({ error: 'No se encontró la cuenta para activar el pago.' }, 404);
  }

  let account: { premiumMonthsPaid?: number; premiumPromo?: boolean };
  try {
    account = JSON.parse(accountRow.value);
  } catch {
    return jsonResponse({ error: 'Cuenta inválida.' }, 500);
  }

  const price = premiumPrice(account);
  const amountCents = Math.round(price * 100);
  const orderId = generateOrderId();

  const { error: insertError } = await supabase
    .from('redsys_orders')
    .insert({ order_id: orderId, email, amount_cents: amountCents, status: 'pending' });
  if (insertError) {
    console.error('redsys-create-payment: no se pudo registrar el pedido', insertError);
    return jsonResponse({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' }, 500);
  }

  const notifyUrl = `${supabaseUrl}/functions/v1/redsys-notification`;
  const okUrl = `${siteUrl}/index.html?payment=success&email=${encodeURIComponent(email)}`;
  const koUrl = `${siteUrl}/index.html?payment=cancel&email=${encodeURIComponent(email)}`;

  const merchantParameters = encodeMerchantParameters({
    Ds_Merchant_Amount: String(amountCents),
    Ds_Merchant_Order: orderId,
    Ds_Merchant_MerchantCode: merchantCode,
    Ds_Merchant_Currency: '978',
    Ds_Merchant_TransactionType: '0',
    Ds_Merchant_Terminal: terminal,
    Ds_Merchant_MerchantURL: notifyUrl,
    Ds_Merchant_UrlOK: okUrl,
    Ds_Merchant_UrlKO: koUrl,
    Ds_Merchant_ProductDescription: 'Suscripcion Premium TodoOficios - 1 mes',
    Ds_Merchant_MerchantName: 'TodoOficios.es',
    Ds_Merchant_ConsumerLanguage: '001',
  });
  const signature = redsysSign(secretKey, orderId, merchantParameters);

  return jsonResponse({
    url: redsysPaymentUrl(env),
    fields: {
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantParameters: merchantParameters,
      Ds_Signature: signature,
    },
  });
});
