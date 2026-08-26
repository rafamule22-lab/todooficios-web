# Ideas de rentabilidad — todooficios.es Brasil (proyecto Brasil)

Documento vivo, hermano de `ideas-rentabilidad-todooficios.md`, para ir
acumulando ideas de modelo de negocio y monetización específicas de una
posible expansión a Brasil. Mismo formato: cada entrada indica de dónde viene
la inspiración (con fuente), por qué encajaría o no, y qué haría falta para
probarla. Todavía no hay nada lanzado en Brasil — este documento es
preparación, no un plan aprobado.

## Estado del negocio (referencia rápida)

El dashboard y la plantilla del negocio ya existen y están construidos para
España, en el `index.html` actual (panel de negocio, barra superior,
calculadoras, presupuestos en PDF). No se traslada ni se traduce código
todavía — la idea es partir de la misma base de producto cuando llegue el
momento, no reconstruir desde cero:

- Cuenta profesional gratuita para siempre, con ficha visible en búsquedas.
- Plan Premium: 4,99 €/mes durante los primeros 12 meses pagados, 9,99 €/mes
  desde el mes 13. Mejor posicionamiento en búsquedas y hasta 10 fotos de
  trabajos (gratis: 3 fotos).
- Límites del plan gratuito en el Panel de negocio (`FREE_LIMITS`): 5
  clientes, 5 gastos/mes, 3 presupuestos/mes, 5 citas activas simultáneas.
  Premium sin límite en ninguna herramienta.
- Pagos reales (PayPal) desactivados en producción (`PAYMENTS_ENABLED =
  false`) hasta configurar la pasarela — en Brasil, además, PayPal no sería
  el medio de pago principal (ver idea 4).

## Panorama de competidores en Brasil (resumen de la investigación de mercado)

Ver el informe completo (`Playbook Brasil`, artefacto de esta conversación)
para cifras y fuentes. Resumen de los cuatro jugadores relevantes y cómo
cobran, que es la base de las ideas 1-4 de abajo:

| Plataforma | Cómo cobra |
|---|---|
| GetNinjas (líder) | Pago por lead: el profesional compra "monedas" para desbloquear el contacto del cliente. |
| Triider (reformas) | Comisión del 16% sobre el importe cerrado con el cliente. |
| Tá Contratado | Gratis y sin comisión, negociación 100% directa. |
| Habitissimo Brasil | Ficha gratis + Premium por suscripción — el mismo modelo que ya usa todooficios.es. |

## 1. Pago por lead / créditos (referencia: GetNinjas)

**Por qué mirarlo:** es el modelo dominante en Brasil — el que ya conoce y
usa la mayoría de profesionales del sector. Copiarlo tal cual traiciona el
modelo de suscripción actual de todooficios.es; ignorarlo del todo puede ser
llegar con una propuesta que el mercado brasileño no reconoce.

**Cómo encajaría (si encaja):** no como sustituto de Premium, sino como
capa adicional para el plan gratuito — en vez de dejarlo solo con límites
numéricos (5 clientes, 3 presupuestos/mes, etc.), el profesional gratuito
podría comprar leads sueltos cuando los necesite, mientras que Premium
seguiría dando exposición y herramientas ilimitadas por suscripción. Esto ya
estaba anotado como idea futura en el documento de España (bloque 2), y
Brasil sería el mercado natural donde probarlo primero, porque aquí sí hay
precedente y expectativa del usuario.

**Qué haría falta para probarla:** sistema de créditos prepago, algo de
infraestructura de pago local (ver idea 4), y decidir el precio por lead
comparándolo con lo que cobra GetNinjas en cada categoría de oficio.

## 2. Comisión sobre el servicio cerrado (referencia: Triider)

**Por qué mirarlo:** Triider factura solo cuando el profesional gana un
trabajo (16% del importe), lo que alinea el incentivo de la plataforma con
el éxito real del profesional, no con el volumen de contactos vendidos.

**Por qué probablemente no encaja (todavía):** exige verificar el importe
final del servicio (o fiarse de que el profesional lo declare), lo cual es
mucho más pesado operativamente que vender leads o cobrar una suscripción
fija. Requeriría una capa de confianza/verificación que todooficios.es no
tiene hoy ni en España.

**Qué haría falta para probarla:** mecanismo de confirmación del trabajo
cerrado (firma digital del presupuesto aceptado, por ejemplo, apoyándose en
la función de presupuestos en PDF que ya existe) antes de poder cobrar nada
sobre ese importe con confianza.

## 3. Gratis + anuncios o destacados (referencia: Tá Contratado)

**Por qué mirarlo:** confirma que en Brasil también hay hueco para un
modelo sin fricción de pago para el profesional (cero comisión, cero coste
de entrada), que se financia de otra forma (posiciones destacadas pagadas,
publicidad).

**Por qué probablemente no encaja:** es esencialmente el plan gratuito
actual de todooficios.es sin ningún Premium — resigna el ingreso principal
del negocio en España a cambio de crecer más rápido en usuarios. Podría
tener sentido como estrategia de lanzamiento (fase 0, sin cobrar a nadie,
para ganar tracción), pero no como modelo permanente.

**Qué haría falta para probarla:** nada de desarrollo nuevo — es
literalmente ofrecer solo el plan gratuito actual al entrar en Brasil,
retrasando el lanzamiento de Premium unos meses hasta tener suficientes
profesionales registrados.

## 4. Suscripción Premium, igual que hoy (referencia: Habitissimo Brasil)

**Por qué mirarlo:** es el modelo que todooficios.es ya tiene construido y
además **ya está validado en Brasil** por Habitissimo, la misma referencia
de la que se tomó el modelo actual. Es la ruta de menor esfuerzo de
producto: no hay que rediseñar el negocio, solo lanzarlo.

**Riesgo:** competir directamente contra la versión brasileña de la propia
referencia (ver "Punto de atención" en el Playbook Brasil), en un mercado
donde el jugador más grande (GetNinjas) usa un modelo distinto y más
familiar para el profesional medio.

**Qué haría falta para probarla:** precio en R$ (a definir comparando con lo
que cobra Habitissimo Brasil en su plan Premium — pendiente de investigar,
ver más abajo), medio de pago local (Pix es el estándar de facto, por
delante de tarjeta) en vez de PayPal, y aviso legal conforme a la LGPD en
vez de una traducción del aviso legal español actual.

## Pendiente de retomar

- Investigar el precio exacto del plan Premium de Habitissimo Brasil, para
  saber si 4,99-9,99 €/mes (convertido a R$) queda caro, barato o alineado.
- Decidir si el lanzamiento en Brasil empieza en fase 0 sin cobrar (idea 3)
  o directamente con Premium activo (idea 4).
- Explorar en más detalle el sistema de créditos por lead (idea 1) como
  complemento del plan gratuito — tanto para España como, posiblemente
  primero, para Brasil.
- Confirmar medio de pago (Pix vs. tarjeta vs. boleto) antes de tocar
  `PAYMENTS_ENABLED`.
