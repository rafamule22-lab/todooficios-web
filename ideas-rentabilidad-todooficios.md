# Ideas de rentabilidad — todooficios.es

Documento vivo para ir acumulando ideas de monetización a lo largo de varias
conversaciones. Cada entrada indica de dónde viene la inspiración (con fuente),
por qué encajaría o no en la etapa actual del negocio, y qué haría falta para
probarla.

## Estado del negocio (referencia rápida)

- Cuenta profesional gratuita para siempre, con ficha visible en búsquedas.
- Plan Premium, escalonado a 4 tramos (implementado 2026-08-25,
  `premiumPrice()` en `index.html`): 4,99 €/mes el año 1, 6,99 €/mes el año 2,
  8,99 €/mes el año 3, 9,99 €/mes techo desde el año 4. Cuentas fundadoras
  (`premiumPromo`, primeros `PROMO_FREE_PRO_LIMIT` profesionales) mantienen el
  precio de año 1 durante 24 meses en vez de 12 antes de entrar al escalonado.
  Da mejor posicionamiento en búsquedas, hasta 10 fotos de trabajos (gratis: 3
  fotos) y presupuestos en PDF sin marca de agua (gratis: PDF con "Generado
  con TodoOficios.es").
- Límites del plan gratuito en el Panel de negocio (`FREE_LIMITS`): 5 clientes,
  5 gastos/mes, 3 presupuestos/mes, 5 citas activas simultáneas, 5 materiales
  favoritos. Premium sin límite en ninguna herramienta.
- Diferenciación por módulo (added 2026-08-24, ver bloque 4): el **Agente
  financiero** (avisos automáticos) es 100% exclusivo de Premium; el
  **Asesor fiscal** en gratis solo muestra el próximo vencimiento (el
  calendario completo y la estimación trimestral son Premium); el
  **Envío al gestor** en gratis mantiene el recordatorio manual pero la
  generación automática de PDF/correo es Premium. Calculadoras conectadas a
  presupuestos siguen libres para todos (embudo hacia el tope de
  presupuestos/mes).
- Pagos reales (PayPal) desactivados en producción (`PAYMENTS_ENABLED = false`)
  hasta configurar la pasarela.

## 1. Prueba gratis de Premium al registrarse ("reverse trial")

**Idea original (2026-08-23):** nuevos profesionales prueban gratis todos los
beneficios de Premium durante un periodo, y al acabar pasan a pagar o caen al
plan gratis (que a su vez restringiría más herramientas).

**Referencias:**
- [Habitissimo](https://www.habitissimo.es/premium) — "Prueba gratis el plan
  más popular de habitissimo durante 30 días", sin pedir tarjeta.
- [Houzz Pro](https://www.houzz.com/houzz-pro/pricing) — trial de 30 días,
  pide método de pago por adelantado, cancelable antes de que empiece a
  facturar la suscripción anual.
- Patrón general en SaaS: **"reverse trial"** — el usuario entra directo al
  plan de pago y, si no convierte, cae solo a un plan gratis permanente (no se
  queda bloqueado). Ejemplos: Grammarly (7 días), Toggl (30 días). Fuentes:
  [withorb.com](https://www.withorb.com/blog/reverse-trial-saas),
  [elenaverna.com](https://www.elenaverna.com/p/reverse-trials-examples).

**Alternativas concretas discutidas:**
1. **Duración**: 7 días es arriesgado con el tráfico actual (puede que no le
   llegue ninguna búsqueda real en la zona en ese tiempo y la prueba "no se
   note"). Recomendado: 14 días como punto medio, o 30 días (como Habitissimo
   y Houzz Pro) para maximizar la probabilidad de que se note el beneficio.
2. **¿Pedir tarjeta al empezar?** Houzz Pro sí, Habitissimo no. Recomendado:
   no pedirla mientras `PAYMENTS_ENABLED` siga en `false` y el negocio esté
   captando sus primeros profesionales; pedirla más adelante cuando haya
   pasarela de pago real y más confianza de marca.
3. **Cuándo empieza a contar el trial**: en vez de arrancar el reloj al
   registrarse (se puede "quemar" trial mientras completa la ficha), que
   empiece cuando complete su ficha (foto + oficio + descripción) o reciba su
   primer contacto de un cliente — así los días de prueba corresponden a
   exposición real.
4. **Qué restringir en el plan gratis (post-trial)**, más allá de los
   límites numéricos ya existentes:
   - Marca de agua en el PDF del presupuesto ("Generado con TodoOficios.es")
     en gratis; PDF limpio con membrete propio en Premium — restricción
     "suave" (patrón Canva/Loom), no rompe la herramienta, solo la pule.
   - Tope en Materiales favoritos (p. ej. 5 en gratis, ilimitado en Premium).
   - Mantener fotos de trabajo (3 vs 10) y posicionamiento en búsquedas como
     el diferenciador principal — es donde Habitissimo y Checkatrade ponen el
     peso real de su Premium, no en bloquear herramientas de gestión.

**Priorización sugerida:** empezar por (1) trial de 14 días sin pedir tarjeta
— no requiere infraestructura de pago nueva — y (4) la marca de agua en el PDF
como primera restricción nueva del plan gratis, por ser la más fácil de
implementar y la que menos fricción negativa genera. Dejar el punto 3 (activar
el trial por hito en vez de por fecha) para una segunda vuelta, una vez se
vea si el trial simple ya convierte razonablemente.

## 2. Otro grupo de referencias: pago por lead/contacto (no aplican directo, pero para el futuro)

Cronoshare, MyBuilder, Bark.com, Thumbtack y Angi no cobran suscripción: el
registro y la ficha son gratis siempre, y se paga por contacto/lead mediante
créditos prepago. No hay "trial" de tiempo porque no hay nada que probar más
allá de recibir contactos — en su lugar dan **crédito de bienvenida**:

- [Angi](https://pro.homeadvisor.com/r/100-leads-terms-conditions/) — 100$ en
  leads gratis al gastar los primeros 100$.
- Bark.com — hasta 5 respuestas gratis al mes en su plan Elite Pro.
- [Cronoshare](https://www.cronoshare.com/recomienda-gana) — regala "cronos"
  (créditos) por invitar a otros profesionales.
- [Checkatrade](https://join.checkatrade.com/april-2025-discount/) — es
  suscripción como todooficios.es, pero sin trial de producto: promociones
  puntuales de "1-2 meses gratis" sobre una cuota bastante más alta
  (£70-140/mes).

No aplica directo al modelo actual (ya se eligió suscripción, no pago por
lead), pero queda anotado como idea futura si algún día se quiere
complementar Premium con un sistema de créditos por contacto.

## 3. Campaña de publicidad de arranque + escalonado del Plan Premium (2026-08-24)

**Contexto:** se preparó un documento completo en Google Drive —
["Campaña de publicidad para arrancar"](https://docs.google.com/document/d/1PuDTJ_4haWO9djoqLhD92GZDoEgqFHby8pzpRPkWUvY/edit) —
con investigación de tácticas de captación (no solo monetización) y dos
banners de campaña publicados como
[artifact](https://claude.ai/code/artifact/0aa3913f-1e9e-4b81-92e6-b829d32f9aa5)
(ventajas de Premium / comparativa Premium vs. Gratis). Resumen de lo
acordado, para no repetir la investigación si se retoma el tema:

**Tácticas de captación validadas por la investigación** (no solo
modelos de precio, sino qué mueve tráfico y registros):
1. Concentrar el arranque en una única ciudad/comarca "faro" en vez de
   cubrir España entera desde el día uno (patrón Airbnb/Uber/Habitissimo).
2. Programa de referidos entre profesionales (1 mes de Premium gratis
   por invitación) — en marketplaces así, ~1/3 del crecimiento inicial
   de oferta viene de referidos, y es el tráfico de mejor calidad.
   Cronoshare ya lo hace con créditos ("cronos").
3. Landings oficio+ciudad pensadas para que SEO local y Google Ads
   apunten a la misma palabra clave (se complementan, no compiten).
4. El precio/promo de bienvenida como titular del propio anuncio, no
   como letra pequeña (patrón repetido en Habitissimo, Angi, Houzz Pro).

**Cambio de precio Premium propuesto — escalonado a 4 tramos** (en vez
de los 2 actuales: 4,99&nbsp;€ el año 1 y salto directo a 9,99&nbsp;€ desde
el mes 13):
- Año 1 (meses 1–12): 4,99 €/mes — ya implementado.
- Año 2 (meses 13–24): 6,99 €/mes — nuevo tramo intermedio.
- Año 3 (meses 25–36): 8,99 €/mes — nuevo tramo intermedio.
- Año 4 en adelante: 9,99 €/mes — techo, ya implementado
  (`PREMIUM_PRICE_RENEWAL`), no cambia.

Motivo: pasar de 4,99 € a 9,99 € de golpe es un +100&nbsp;%; repartido en
tres subidas (+40&nbsp;%/+29&nbsp;%/+11&nbsp;%) se percibe como progresión de
fidelización, no como subida agresiva (principio de "grandfathering"
gradual usado en SaaS). Cambio de código acotado: añadir 2 constantes
más y comparar por tramos de 12 meses en `premiumPrice()`
(`index.html`), sin tocar la pasarela de pago (sigue desactivada).

**Variante para la propia campaña de lanzamiento:** extender la promo
ya existente para los primeros profesionales (`PROMO_FREE_PRO_LIMIT`)
para que, además de los meses gratis iniciales, mantengan el precio de
4,99 €/mes durante 24 meses (en vez de 12) antes de entrar en el
escalonado normal — historia de marketing tipo "precio de fundador".

## 4. Diferenciación real Gratis vs. Premium por módulo (implementado 2026-08-24)

**Motivo:** más allá de los topes numéricos (clientes, gastos, presupuestos,
citas), varios módulos grandes del Panel de negocio —Materiales favoritos,
Asesor fiscal, Envío al gestor, Agente financiero— estaban completamente
abiertos en el plan gratuito, sin ninguna diferencia con Premium. Se
implementó en `index.html`, sobre el mismo patrón ya existente
(`premiumLockHTML`, ahora con soporte opcional de una lista de bullets):

- **Materiales favoritos**: tope de 5 en gratis (`FREE_LIMITS.materiales`),
  ilimitado en Premium — mismo patrón soft-cap que clientes/gastos/citas.
- **Asesor fiscal**: en gratis solo se ve el próximo vencimiento (la tarjeta
  `deadline-hero`); el calendario fiscal completo (`fiscal-timeline`, todos
  los modelos, histórico) y la estimación trimestral (`stat-grid`) pasan a
  ser exclusivos de Premium.
- **Envío al gestor**: en gratis se mantiene el recordatorio semanal y la
  lista de gastos de la semana, pero la generación automática del PDF y el
  correo prerrellenado (botones `asesor-ver-pdf` / `asesor-abrir-correo`)
  son exclusivos de Premium.
- **Agente financiero**: pestaña 100% exclusiva de Premium — en gratis se ve
  un teaser con lo que ofrece (avisos de vencimientos, envíos pendientes,
  gastos deducibles, comparativa trimestral) y el botón a Premium, sin el
  contenido real.
- Se dejaron **libres para todos** las calculadoras conectadas a
  presupuestos: son la puerta de entrada para que el plan gratuito vea
  valor antes de toparse con el límite de presupuestos/mes; restringirlas
  ahí habría cortado el embudo de conversión.

Verificado sin arrancar servidor de datos real: se simuló una cuenta
gratuita y una Premium (`account.featuredUntil` en el futuro) en un
navegador headless y se comprobó que cada pestaña renderiza el contenido
correcto según el plan.

## 5. Escalonado de precio Premium + precio fundador + banners actualizados (implementado 2026-08-25)

Se llevaron a código tres de los pendientes del bloque 3:

- **Escalonado a 4 tramos**: `premiumPrice()` en `index.html` ahora calcula
  el precio por meses de pago acumulados (`acc.premiumMonthsPaid`) en vez de
  un único salto a los 12 meses — año 1: 4,99 €, año 2: 6,99 €, año 3:
  8,99 €, año 4 en adelante: 9,99 € (techo). Verificado con 15 casos de
  prueba (con y sin `premiumPromo`) antes de aplicarlo.
- **Precio fundador de 24 meses**: cuentas con `acc.premiumPromo` (los
  primeros `PROMO_FREE_PRO_LIMIT` profesionales) usan 24 meses en vez de 12
  como duración del tramo a 4,99 €/mes antes de entrar al escalonado normal
  — vía la nueva constante `PREMIUM_FOUNDER_MONTHS`, dentro de la misma
  función.
- **Banners de campaña actualizados**: el banner de ventajas Premium
  (`Main.dc.html`) sustituyó dos bullets genéricos por "Agente financiero
  incluido" y "Asesor fiscal completo + envío al gestor"; el banner
  comparativo (`Comparativa.dc.html`) sumó 3 filas nuevas a la tabla (Agente
  financiero, Calendario fiscal completo, Envío de gastos al gestor).
  Republicado en el mismo enlace:
  [artifact](https://claude.ai/code/artifact/0aa3913f-1e9e-4b81-92e6-b829d32f9aa5).
- La **marca de agua en el PDF de presupuestos** (mencionada como pendiente
  en el bloque 3) resultó que ya estaba implementada en `index.html`
  (`abrirPresupuestoPDF`, línea ~3481): PDF con "Presupuesto generado con
  TodoOficios.es" en gratis, sin marca en Premium. No hizo falta tocar
  código para eso.

## Pendiente de retomar

- Decidir duración final del trial (14 vs 30 días) y si se pide tarjeta.
- Explorar si tiene sentido, más adelante, un sistema de créditos por
  contacto en paralelo a Premium (ver bloque 2).
- Elegir la ciudad/comarca faro para concentrar el arranque de la
  campaña (bloque 3) y activar el programa de referidos entre
  profesionales.
- Actualizar el documento de Google Drive "Campaña de publicidad para
  arrancar" con el escalonado de 4 tramos y el precio fundador de 24 meses
  (por ahora solo reflejado en este documento y en el código).
