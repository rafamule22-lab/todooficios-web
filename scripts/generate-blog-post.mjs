// Bot generador semanal del blog de TodoOficios.es.
// Elige categoría/oficio de forma determinista por semana, pide un artículo a Claude
// y lo guarda en Supabase como borrador (status: 'draft'). Nunca publica solo.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const OFICIOS_GROUPS = [
  { group: 'Instalaciones y reparaciones', items: ['Fontanero', 'Electricista', 'Gasista', 'Técnico en calefacción', 'Instalador de aire acondicionado', 'Técnico en refrigeración', 'Instalador de termos y calderas'] },
  { group: 'Obra y reformas', items: ['Albañil', 'Maestro de obra', 'Oficial de construcción', 'Reformista', 'Pladurista (Pladur / Drywall)', 'Yesero', 'Alicatador', 'Solador', 'Colocador de cerámica', 'Colocador de porcelanato'] },
  { group: 'Carpintería y metal', items: ['Carpintero', 'Carpintero de obra', 'Carpintero de muebles', 'Ebanista', 'Instalador de puertas', 'Instalador de ventanas', 'Herrero', 'Soldador', 'Metalista'] },
  { group: 'Acabados', items: ['Pintor', 'Pintor decorativo', 'Aplicador de microcemento', 'Impermeabilizador', 'Restaurador de fachadas'] },
  { group: 'Cerramientos y vidrio', items: ['Vidriero', 'Instalador de mamparas', 'Instalador de aluminio', 'Instalador de PVC', 'Instalador de cerramientos', 'Colocador de vidrio templado'] },
  { group: 'Techos y exteriores', items: ['Techista', 'Reparador de tejados', 'Instalador de canalones', 'Aislador térmico', 'Aislador acústico'] },
  { group: 'Seguridad y automatización', items: ['Cerrajero', 'Instalador de alarmas', 'Instalador de cámaras', 'Técnico en CCTV', 'Instalador de porteros automáticos', 'Instalador de videoporteros', 'Domótica / hogar inteligente'] },
  { group: 'Mantenimiento general', items: ['Manitas / mantenimiento del hogar', 'Jardinero', 'Instalador de riego', 'Limpieza post obra', 'Retiro de escombros'] }
];

function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function requireEnv(name) {
  // .trim() por si el secret se pegó con un espacio o salto de línea de más
  // (causa típica de "invalid header value" al construir la petición HTTP).
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`Falta la variable de entorno "${name}"`);
  return v;
}

async function main() {
  const anthropicKey = requireEnv('ANTHROPIC_API_KEY');
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const now = new Date();
  const week = isoWeekNumber(now);
  const groupIndex = week % OFICIOS_GROUPS.length;
  const group = OFICIOS_GROUPS[groupIndex];
  const oficio = group.items[Math.floor(Math.random() * group.items.length)];

  console.log(`Semana ISO ${week} -> categoría "${group.group}" -> oficio "${oficio}"`);

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const prompt = `Escribe un artículo de blog en español de España para TodoOficios.es, un directorio de profesionales de oficios (como Airbnb pero para encontrar fontaneros, electricistas, albañiles, etc.).

El artículo debe centrarse en el oficio "${oficio}" (dentro de la categoría "${group.group}"). Debe ser útil y práctico para un particular que se plantea contratar a este profesional o hacer una reforma relacionada: qué debe tener en cuenta, cómo elegir bien, señales de alarma, preguntas que hacer, rangos de precio orientativos si aplica, errores comunes a evitar. Tono cercano y claro, sin tecnicismos innecesarios. Entre 500 y 800 palabras.

Responde ÚNICAMENTE con un objeto JSON válido (sin bloques de código, sin texto antes ni después), con esta forma exacta:
{
  "title": "título del artículo, atractivo y claro (máx 70 caracteres)",
  "excerpt": "resumen de 1-2 frases para la tarjeta de listado (máx 200 caracteres)",
  "meta_description": "meta description SEO (máx 155 caracteres)",
  "content_html": "el cuerpo del artículo en HTML simple: usa <p>, <h2>, <ul>/<li> donde tenga sentido. No incluyas <html>, <head>, <body> ni el título como <h1> (el título ya se muestra aparte)."
}`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('La respuesta de Claude no incluyó texto');

  let raw = textBlock.text.trim();
  // Por si acaso el modelo envuelve el JSON en un bloque de código pese a la instrucción.
  raw = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();

  let post;
  try {
    post = JSON.parse(raw);
  } catch (err) {
    console.error('No se pudo parsear la respuesta como JSON:\n', raw);
    throw err;
  }

  for (const field of ['title', 'excerpt', 'meta_description', 'content_html']) {
    if (!post[field] || typeof post[field] !== 'string') {
      throw new Error(`Falta o es inválido el campo "${field}" en la respuesta del modelo`);
    }
  }

  const baseSlug = slugify(post.title) || slugify(oficio);
  const slug = `${baseSlug}-${now.toISOString().slice(0, 10)}`;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { error } = await supabase.from('blog_posts').insert({
    slug,
    title: post.title,
    excerpt: post.excerpt,
    content_html: post.content_html,
    category: group.group,
    oficio,
    meta_description: post.meta_description,
    status: 'draft'
  });

  if (error) throw new Error(`Error al insertar en Supabase: ${error.message}`);

  console.log(`Borrador creado: "${post.title}" (slug: ${slug})`);
  console.log('Revísalo y publícalo cambiando status a "published" en Supabase Studio.');
}

main().catch((err) => {
  console.error('Fallo generando el post del blog:', err.message || err);
  process.exit(1);
});
