// Utilidades comunes para firmar y verificar peticiones Redsys (algoritmo
// "HMAC_SHA256_V1" documentado por Redsys: se cifra el número de pedido con
// 3DES usando la clave de comercio como clave de operación, y con esa clave
// de operación se firma en HMAC-SHA256 el Ds_MerchantParameters en base64).

import { Buffer } from 'node:buffer';
import { createCipheriv, createHmac, timingSafeEqual } from 'node:crypto';

function orderOperationKey(secretKeyBase64: string, order: string): Buffer {
  const key = Buffer.from(secretKeyBase64, 'base64');
  const iv = Buffer.alloc(8, 0);
  const cipher = createCipheriv('des-ede3-cbc', key, iv);
  cipher.setAutoPadding(false);
  let data = Buffer.from(order, 'utf8');
  const padLen = (8 - (data.length % 8)) % 8;
  if (padLen) data = Buffer.concat([data, Buffer.alloc(padLen, 0)]);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

// Redsys firma en base64 estándar, pero en las respuestas/notificaciones puede
// llegar en la variante "url-safe" (- y _ en vez de + y /). Normalizamos antes
// de decodificar para aceptar ambas.
function normalizeBase64(value: string): string {
  return value.replace(/-/g, '+').replace(/_/g, '/');
}

export function redsysSign(secretKeyBase64: string, order: string, merchantParametersBase64: string): string {
  const orderKey = orderOperationKey(secretKeyBase64, order);
  return createHmac('sha256', orderKey).update(merchantParametersBase64).digest('base64');
}

export function redsysSignaturesMatch(secretKeyBase64: string, order: string, merchantParametersBase64: string, receivedSignature: string): boolean {
  const expected = Buffer.from(normalizeBase64(redsysSign(secretKeyBase64, order, merchantParametersBase64)), 'base64');
  const received = Buffer.from(normalizeBase64(receivedSignature), 'base64');
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export function encodeMerchantParameters(params: Record<string, string>): string {
  return Buffer.from(JSON.stringify(params), 'utf8').toString('base64');
}

export function decodeMerchantParameters(base64: string): Record<string, string> {
  return JSON.parse(Buffer.from(normalizeBase64(base64), 'base64').toString('utf8'));
}

export function redsysPaymentUrl(env: string): string {
  return env === 'production'
    ? 'https://sis.redsys.es/sis/realizarPago'
    : 'https://sis-t.redsys.es:25443/sis/realizarPago';
}

// Respuesta autorizada: Ds_Response entre 0000 y 0099 (ambos inclusive).
export function isAuthorizedResponse(dsResponse: string): boolean {
  const code = Number(dsResponse);
  return Number.isFinite(code) && code >= 0 && code <= 99;
}

export function generateOrderId(): string {
  const ts = Date.now().toString().slice(-9);
  const rand = String(Math.floor(100 + Math.random() * 900));
  return (ts + rand).slice(-12);
}
