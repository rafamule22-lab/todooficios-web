# Rediseño de la calculadora de reformas — contexto y plan de implementación

Este documento resume una conversación con Claude (Cowork) para que puedas retomarla en Claude Code sin perder contexto. Objetivo: rediseñar la calculadora combinada de reformas de todooficios-web (y replicarla, adaptada, en tudoreforma, la versión hermana para Brasil) para que sea un asistente por alcance en vez de un formulario rígido.

## 1. Problema original

En `calculadoras.js` (raíz del repo todooficios-web), la calculadora `estimacion_reforma` (categoría reformas, id `estimacion_reforma`, sobre la línea 1579) calcula siempre suelo + alicatado + adhesivo + juntas + pintura + rodapié en un único formulario, sin importar el alcance real de la obra. Campos como `lado_baldosa` y `piezas_caja` son obligatorios aunque la reforma no incluya suelo nuevo. Si el usuario no rellena largo/ancho, salta el error genérico `Falta el valor "largo"` (función `gn()`, línea 21 de `calculadoras.js`).

Archivos implicados:

- `calculadoras.js` — motor de cálculo + catálogo de fórmulas (objeto `REFORMAS`, ~línea 1573-1626).
- `calculadoras.html` — shell de la página (títulos, gate de registro, contenedor `#cecCalc` donde el motor JS pinta el formulario).

## 2. Propuesta acordada con el usuario

Sustituir el formulario único por un asistente por fases:

1. **Paso 1 — Alcance**: el usuario marca con casillas (no radio, selección múltiple) qué partes de la obra va a reformar:
   - `suelo` — Suelo (baldosa/gres)
   - `alicatado` — Alicatado (azulejo en pared)
   - `pintura` — Pintura (paredes y techo)
   - `fontaneria` — Fontanería (puntos de agua)
   - `electricidad` — Electricidad (puntos de luz)
   - `carpinteria` — Carpintería (puertas/ventanas)
2. **Paso 2 — Medidas**: campos base siempre visibles (tipo de estancia, largo, ancho, alto, nº puertas) + campos condicionales que solo aparecen si el scope correspondiente está marcado:
   - `suelo` o `alicatado` marcados → `lado_baldosa` (cm, def 33), `piezas_caja` (def 11)
   - `pintura` marcado → `rendimiento_pintura` (m²/L, def 6), `manos_pintura` (def 2)
   - `fontaneria` marcado → `puntos_agua` (uds, def 2)
   - `electricidad` marcado → `puntos_luz` (uds, def 4)
   - `carpinteria` marcado → `num_puertas_ventanas` (uds, def 1)
3. **Paso 3 — Resultado**: solo se calculan y muestran las líneas correspondientes a los scopes marcados (nada de baldosas si no hay suelo/alicatado).

### "Modo Obra" (carrito de partidas)

Cada resultado calculado se puede añadir como partida a un proyecto acumulado ("Modo Obra"), permitiendo sumar varias estancias u oficios (p. ej. baño con suelo+alicatado+fontanería, más salón solo con pintura) antes de pedir presupuesto. Esto es lo que en la captura original del usuario aparecía como los botones "1 partida guardada" y "Modo obra" en la cabecera — no existían aún en el código, son parte de esta propuesta.

### Doble salida (lo verdaderamente diferencial)

- **Vista cliente**: botón para descargar/compartir la lista de materiales de todas las partidas y pedir presupuesto a profesionales verificados de TodoOficios con el alcance ya adjunto (lead cualificado, no una frase vaga).
- **Vista profesional**: botón para abrir las partidas como borrador de presupuesto dentro del Gestor de negocio del profesional, con cantidades precalculadas — el pro solo añade precio de material y mano de obra.

Esto conecta la calculadora directamente con el directorio/marketplace de TodoOficios, que es lo que la diferencia de competidores puramente calculadores (PlanReforma, Remodelum — ver referencias abajo).

## 3. Prototipo interactivo (ya construido, para referencia visual)

Se publicó un prototipo funcional (HTML/CSS/JS vanilla, con el mismo look & feel de `calculadoras.html`: paleta ink/amber, tipografías Space Grotesk + IBM Plex Sans/Mono) que implementa el flujo completo: casillas de alcance → campos condicionales → cálculo → "Modo Obra" con carrito → las dos tarjetas de salida (cliente/profesional).

URL del prototipo: https://claude.ai/code/artifact/92a9580c-81d2-4ca3-8b76-32c6913ad2a8

Puede usarse como referencia de comportamiento/UX al reescribir `calculadoras.js`, pero está hecho como demo aislada (JS en memoria, sin persistencia, sin conexión real al directorio ni al gestor de presupuestos) — no es código de producción para copiar tal cual.

## 4. Referencias de mercado usadas para validar el enfoque

- **PlanReforma** (https://planreforma.com/calculador-reforma/) — tras datos básicos de vivienda, deja elegir qué partes reformar (integral, solo cocina, solo baño, suelos, electricidad, pintura...). Confirma que el filtro por alcance es el estándar del sector, no un extra.
- **Remodelum** (https://www.remodelum.com/renovation-cost-estimator) — además del alcance, deja elegir nivel de acabado (básico/medio/alto), lo que cambia el rango de coste estimado. Pieza pendiente para una fase futura: dar una horquilla de € orientativa, no solo cantidades.

## 5. Plan de implementación (por fases, acordado con el usuario)

- **Fase 1** (la que se está aplicando ahora): reescribir `estimacion_reforma` en `calculadoras.js` para que sea un asistente por alcance con campos condicionales. Cambios en `calculadoras.js` (lógica) y `calculadoras.html`/CSS del motor (si el motor genérico de renderizado de campos no soporta condicionalidad todavía, hay que añadirle esa capacidad: un campo con `showIf: function(v){...}` o similar, evaluado al re-render del formulario).
- **Fase 2**: "Modo Obra" — carrito de partidas persistente (localStorage en el cliente, ya que es una web estática sin backend propio para esto) que agrega resultados de esta y otras calculadoras del catálogo.
- **Fase 3**: rango de precio orientativo por partida + puente real hacia el buscador de profesionales (`index.html`) y hacia el Gestor de presupuestos de la cuenta profesional.
- **Fase 4** (exploratoria, no prioritaria): adjuntar foto de la estancia como referencia visual para el profesional.

## 6. Tarea pendiente: replicar en tudoreforma (versión Brasil)

El usuario indica que tudoreforma es "el hermano gemelo" de todooficios-web, pensado para publicarse en Brasil. Hay que aplicar el mismo rediseño ahí, adaptado a:

- **Idioma**: portugués de Brasil (pt-BR), no solo traducción literal — usar terminología de obra/reforma local (ej. "azulejo"/"revestimento", "piso" en vez de "suelo", "reboco", etc. — revisar con cuidado los términos de construcción brasileños, que difieren de los españoles en varios casos).
- **Moneda**: Real brasileño (R$) si en algún momento se añaden precios orientativos (Fase 3), no euros.
- **Nombres de marca**: revisar que todo el texto (gate de registro, CTAs, cabecera) diga "TudoReforma" y no "TodoOficios" donde corresponda.

**Bloqueante en la sesión de Cowork**: no se pudo localizar el repositorio tudoreforma — no está clonado en el equipo local (solo todooficios-web estaba conectado) y el acceso a la API pública de GitHub estaba restringido desde el contenedor en la nube. Falta confirmar la URL exacta del repositorio de tudoreforma (usuario/organización de GitHub, nombre exacto) antes de poder clonarlo o trabajar sobre él.

## 7. Siguiente paso sugerido en Claude Code

1. Confirmar la URL de tudoreforma y clonarlo junto a todooficios-web (o dejar que Claude Code lo localice si ya está en este equipo).
2. Implementar la Fase 1 en `todooficios-web/calculadoras.js` (+ ajustes de render en el motor si hace falta).
3. Probar en local (abrir `calculadoras.html` y verificar que los campos aparecen/desaparecen según el alcance marcado, y que ya no exige baldosa si no hay suelo/alicatado).
4. Portar el mismo cambio a tudoreforma, con las adaptaciones de idioma/moneda/marca del punto 6.
5. Commitear ambos repos por separado (son proyectos distintos, con su propio historial git).
