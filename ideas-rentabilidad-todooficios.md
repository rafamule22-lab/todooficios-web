# Ideas de rentabilidad — todooficios.es

Documento vivo para ir acumulando ideas de monetización a lo largo de varias
conversaciones. Cada entrada indica de dónde viene la inspiración (con fuente),
por qué encajaría o no en la etapa actual del negocio, y qué haría falta para
probarla.

## Estado del negocio (referencia rápida)

- Cuenta profesional gratuita para siempre, con ficha visible en búsquedas.
- Plan Premium: 4,99 €/mes durante los primeros 12 meses pagados, 9,99 €/mes
  desde el mes 13. Da mejor posicionamiento en búsquedas y hasta 10 fotos de
  trabajos (gratis: 3 fotos).
- Límites del plan gratuito en el Panel de negocio (`FREE_LIMITS`): 5 clientes,
  5 gastos/mes, 3 presupuestos/mes, 5 citas activas simultáneas. Premium sin
  límite en ninguna herramienta (gastos, clientes, presupuestos, agenda,
  materiales favoritos, calculadoras conectadas a presupuestos).
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

## Pendiente de retomar

- Decidir duración final del trial (14 vs 30 días) y si se pide tarjeta.
- Diseñar la restricción de marca de agua en el PDF antes de tocar código.
- Explorar si tiene sentido, más adelante, un sistema de créditos por
  contacto en paralelo a Premium (ver bloque 2).
