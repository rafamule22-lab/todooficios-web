// Edge Function: notify-reply
// Envía un email al cliente avisándole de que un profesional respondió a su
// mensaje en TodoOficios.es. Se llama desde el panel del profesional justo
// después de guardar la respuesta en contactMessages (index.html).
//
// La API key de Resend vive solo aquí, como secreto de Supabase, y nunca se
// expone en el cliente. Despliegue:
//   supabase functions deploy notify-reply
//   supabase secrets set RESEND_API_KEY=re_...
// Opcional (si tienes un dominio verificado en Resend; si no se define, se
// usa el remitente de pruebas de Resend, válido solo para enviar a la
// dirección con la que creaste la cuenta de Resend):
//   supabase secrets set RESEND_FROM_EMAIL="TodoOficios.es <notificaciones@todooficios.es>"
//   supabase secrets set SITE_URL="https://todooficios.es"

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

function escapeHtml(s: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s).replace(/[&<>"']/g, (c) => map[c]);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'El servidor no tiene configurado el envío de emails todavía.' }, 500);

  let payload: { toEmail?: string; toName?: string; proName?: string; excerpt?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Petición inválida.' }, 400);
  }

  const toEmail = String(payload.toEmail || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) return jsonResponse({ error: 'Email de destino inválido.' }, 400);
  const toName = String(payload.toName || 'Cliente').slice(0, 120);
  const proName = String(payload.proName || 'Un profesional').slice(0, 120);
  const excerpt = String(payload.excerpt || '').slice(0, 400);
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'TodoOficios.es <onboarding@resend.dev>';
  const siteUrl = Deno.env.get('SITE_URL') || 'https://todooficios.es';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `${proName} te respondió en TodoOficios.es`,
        html: `
          <p>Hola ${escapeHtml(toName)},</p>
          <p><strong>${escapeHtml(proName)}</strong> te respondió a tu mensaje en TodoOficios.es:</p>
          <blockquote style="border-left:3px solid #ddd; margin:12px 0; padding:4px 12px; color:#444;">${escapeHtml(excerpt)}</blockquote>
          <p><a href="${siteUrl}">Entra en tu cuenta</a> para ver la respuesta completa y contestar.</p>
        `,
      }),
    });
    if (!res.ok) {
      console.error('Resend error:', res.status, await res.text());
      return jsonResponse({ error: 'No se pudo enviar el aviso por email.' }, 502);
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('notify-reply error:', err);
    return jsonResponse({ error: 'Error inesperado enviando el aviso.' }, 500);
  }
});
