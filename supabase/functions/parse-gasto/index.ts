// Edge Function: parse-gasto
// Recibe la foto de una factura/ticket de gasto (data URL en base64) y devuelve los
// datos ya extraídos (fecha, proveedor, concepto, categoría, total, IVA) para rellenar
// el formulario "Añadir gasto" del Panel de negocio en index.html.
//
// La API key de Anthropic vive solo aquí, como secreto de Supabase, y nunca se expone
// en el cliente. Despliegue:
//   supabase functions deploy parse-gasto
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const CATEGORIAS_GASTO = [
  'Fontanería', 'Electricidad', 'Albañilería', 'Pintura y acabados', 'Climatización',
  'Cerrajería', 'Herramientas y maquinaria', 'Alquiler de equipos', 'Transporte / desplazamientos', 'Otros',
];

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'El servidor no tiene configurada la lectura de facturas todavía.' }, 500);

  let payload: { image?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Petición inválida.' }, 400);
  }

  const dataUrl = payload.image || '';
  const match = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) return jsonResponse({ error: 'Falta la foto de la factura.' }, 400);
  const [, mediaType, base64Data] = match;

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Eres un asistente que lee fotos de facturas o tickets de gasto de un profesional autónomo español (fontanero, electricista, albañil, etc.) y extrae los datos para apuntarlos como gasto de su negocio.

Devuelve SOLO un objeto JSON (sin texto alrededor, sin markdown) con estas claves:
- "fecha": fecha de la factura en formato YYYY-MM-DD. Si no se lee con claridad, usa "${today}".
- "proveedor": nombre del comercio o proveedor tal como aparece en la factura. Si no se lee, "".
- "concepto": resumen breve de qué se compró (máximo 60 caracteres). Si no se lee, "".
- "categoria": elige la que mejor encaje de esta lista exacta: ${JSON.stringify(CATEGORIAS_GASTO)}. Si dudas, usa "Otros".
- "total": importe TOTAL con IVA incluido, como número (usa punto decimal, sin símbolo de moneda). Si no se lee con confianza, usa 0.
- "ivaPct": porcentaje de IVA aplicado, como número: 21, 10, 4 o 0. Si no se ve, usa 21.
- "confianza": "alta", "media" o "baja" según lo legible que esté la foto.

No inventes datos que no puedas leer razonablemente en la imagen; dejar el valor por defecto es mejor que inventar.`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      console.error('Anthropic error:', anthropicRes.status, await anthropicRes.text());
      return jsonResponse({ error: 'No se pudo leer la factura. Inténtalo de nuevo.' }, 502);
    }

    const data = await anthropicRes.json();
    const text = (data.content || []).map((b: { text?: string }) => b.text || '').join('').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return jsonResponse({ error: 'No se pudo interpretar la factura.' }, 502);

    const parsed = JSON.parse(jsonMatch[0]);
    const categoria = CATEGORIAS_GASTO.includes(parsed.categoria) ? parsed.categoria : 'Otros';
    const ivaPct = [21, 10, 4, 0].includes(Number(parsed.ivaPct)) ? Number(parsed.ivaPct) : 21;
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha) ? parsed.fecha : today;

    return jsonResponse({
      fecha,
      proveedor: String(parsed.proveedor || '').slice(0, 120),
      concepto: String(parsed.concepto || '').slice(0, 120),
      categoria,
      total: Number.isFinite(Number(parsed.total)) ? Math.max(0, Number(parsed.total)) : 0,
      ivaPct,
      confianza: ['alta', 'media', 'baja'].includes(parsed.confianza) ? parsed.confianza : 'media',
    });
  } catch (err) {
    console.error('parse-gasto error:', err);
    return jsonResponse({ error: 'Error inesperado leyendo la factura.' }, 500);
  }
});
