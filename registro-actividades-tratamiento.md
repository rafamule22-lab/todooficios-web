# Registro de Actividades de Tratamiento (RAT)

Documento interno — **no publicado en el sitio**. Exigido por el artículo 30 RGPD para
responsables de tratamiento. No sustituye la revisión de una asesoría legal/DPO antes de
publicar, pero deja el trabajo de documentación ya hecho.

- **Responsable del tratamiento:** TodoOficios.es — *[razón social, NIF/CIF y domicilio
  pendientes de completar en `legal-config.js`]*.
- **Contacto:** contacto@todooficios.es / soporte@todooficios.es.
- **Delegado de Protección de Datos (DPO):** no designado — no aplica según el análisis
  legal de agosto 2026 (no hay tratamiento masivo de categorías especiales ni vigilancia
  sistemática a gran escala). Revisar si el volumen de usuarios cambia sustancialmente.
- **Última actualización:** 25 de agosto de 2026.

Cada tratamiento se documenta con: finalidad, base legal, interesados, categorías de
datos, encargados/destinatarios, transferencias internacionales, plazo de conservación y
medidas de seguridad. Las medidas de seguridad comunes a todos los tratamientos son:
contraseñas con hash (nunca en texto plano), conexiones HTTPS y control de acceso a la
base de datos en la nube (Supabase).

---

## 1. Cuenta y ficha pública de profesional

| Campo | Detalle |
|---|---|
| Finalidad | Crear y gestionar la cuenta del profesional, publicar su ficha (oficio, descripción, fotos de trabajo, zona) y mostrarla en resultados de búsqueda. |
| Base legal | Ejecución del contrato de prestación del servicio de intermediación. |
| Interesados | Profesionales autónomos o empresas que se registran en la plataforma. |
| Categorías de datos | Identificación (nombre, email, teléfono), oficio, descripción, fotos de trabajo, ubicación/zona, contraseña (hash), valoraciones recibidas. |
| Encargados / destinatarios | Supabase Inc. (alojamiento de la base de datos en la nube). La ficha es pública y visible para cualquier visitante del sitio. |
| Transferencias internacionales | Supabase puede alojar datos fuera del EEE — cubierto por Cláusulas Contractuales Tipo según su política de privacidad. |
| Conservación | Mientras la cuenta esté activa; hasta 6 años tras la baja si hay trascendencia fiscal/contractual. |

## 2. Cuenta de cliente

| Campo | Detalle |
|---|---|
| Finalidad | Crear y gestionar la cuenta del cliente, permitirle buscar y contactar profesionales. |
| Base legal | Ejecución de medidas precontractuales a petición del interesado / ejecución contractual una vez registrado. |
| Interesados | Particulares que buscan un profesional. |
| Categorías de datos | Identificación (nombre, email, teléfono), contraseña (hash), historial de solicitudes. |
| Encargados / destinatarios | Supabase Inc. |
| Transferencias internacionales | Igual que el tratamiento 1. |
| Conservación | Igual que el tratamiento 1. |

## 3. Geolocalización para resultados cercanos

| Campo | Detalle |
|---|---|
| Finalidad | Calcular distancias y mostrar profesionales cercanos al cliente. |
| Base legal | Consentimiento expreso, otorgado mediante el permiso de geolocalización del navegador. |
| Interesados | Clientes que conceden el permiso. |
| Categorías de datos | Ubicación geográfica aproximada. No se almacena de forma permanente asociada a la identidad; uso puntual en la sesión. |
| Encargados / destinatarios | Ninguno externo — cálculo en el propio cliente/servidor de la app. |
| Transferencias internacionales | No aplica. |
| Conservación | Duración de la sesión / hasta revocar el permiso en el navegador. |

## 4. Mensajería entre cliente y profesional

| Campo | Detalle |
|---|---|
| Finalidad | Permitir el contacto e intercambio de mensajes entre un cliente y un profesional. |
| Base legal | Ejecución contractual (prestación del servicio de intermediación) e interés legítimo en la trazabilidad de la relación. |
| Interesados | Clientes y profesionales que intercambian mensajes. |
| Categorías de datos | Contenido de los mensajes, remitente, destinatario, fecha. |
| Encargados / destinatarios | Supabase Inc. Visibles solo para los dos interlocutores de la conversación. |
| Transferencias internacionales | Igual que el tratamiento 1. |
| Conservación | Mientras la cuenta esté activa; ver política general de conservación. |

## 5. Reseñas y valoraciones

| Campo | Detalle |
|---|---|
| Finalidad | Publicar la valoración de un cliente sobre un profesional en el perfil público de este último, como señal de confianza para otros clientes. |
| Base legal | Interés legítimo (confianza del marketplace) y consentimiento del autor de la reseña al publicarla. |
| Interesados | Clientes que dejan reseña; profesionales que la reciben. |
| Categorías de datos | Texto de la reseña, puntuación, nombre del autor, fecha. |
| Encargados / destinatarios | Supabase Inc. Reseña visible públicamente en el perfil del profesional. |
| Transferencias internacionales | Igual que el tratamiento 1. |
| Conservación | Mientras el perfil del profesional esté activo, salvo retirada por denuncia fundada. |

## 6. Suscripción Premium y facturación

| Campo | Detalle |
|---|---|
| Finalidad | Cobrar la cuota Premium al profesional y gestionar su facturación. |
| Base legal | Ejecución contractual y cumplimiento de obligaciones fiscales (conservación de facturas). |
| Interesados | Profesionales con plan Premium. |
| Categorías de datos | Datos de facturación, historial de pagos. TodoOficios.es no almacena datos de tarjeta ni credenciales de pago — los gestiona PayPal directamente. |
| Encargados / destinatarios | PayPal (Europe) S.à r.l. et Cie, S.C.A. (responsable independiente para el procesamiento del pago). |
| Transferencias internacionales | Según la política de privacidad de PayPal. |
| Conservación | Hasta 6 años tras la baja, por obligaciones fiscales. |

## 7. Autenticación con Google (inicio de sesión)

| Campo | Detalle |
|---|---|
| Finalidad | Permitir el registro/inicio de sesión mediante cuenta de Google, como alternativa al registro con email y contraseña. |
| Base legal | Ejecución contractual (a petición del usuario que elige este método). |
| Interesados | Usuarios que eligen "Continuar con Google". |
| Categorías de datos | Nombre, email y foto de perfil de Google. |
| Encargados / destinatarios | Google LLC (responsable independiente del proceso de autenticación OAuth). |
| Transferencias internacionales | Según la política de privacidad de Google. |
| Conservación | Mientras la cuenta esté activa. |

## 8. Panel de negocio del profesional (presupuestos, gastos, clientes, agenda)

| Campo | Detalle |
|---|---|
| Finalidad | Herramienta de gestión interna para que el profesional cree presupuestos, registre gastos, gestione su cartera de clientes y su agenda de citas. |
| Base legal | Ejecución contractual (funcionalidad incluida en el plan gratuito/Premium). |
| Interesados | El profesional (usuario de la herramienta) y, de forma indirecta, sus propios clientes (terceros cuyos datos introduce el profesional: nombre, contacto, dirección de la obra). |
| Categorías de datos | Datos de los clientes del profesional (nombre, contacto, dirección), importes, materiales, fechas de citas. |
| Encargados / destinatarios | Supabase Inc. Para los datos de terceros (los clientes del profesional) que este introduce en la herramienta, **TodoOficios.es actúa como encargado del tratamiento del propio profesional** — conviene reflejarlo en las condiciones de uso para profesionales. |
| Transferencias internacionales | Igual que el tratamiento 1. |
| Conservación | Mientras la cuenta esté activa; el profesional puede borrar sus propios registros. |

## 9. Asesor fiscal (epígrafes IAE, calendario de modelos)

| Campo | Detalle |
|---|---|
| Finalidad | Orientar al profesional sobre su epígrafe IAE y el calendario de modelos fiscales aplicables (autónomo o SL), como herramienta informativa. |
| Base legal | Ejecución contractual (funcionalidad de la cuenta). |
| Interesados | Profesionales que usan la herramienta. |
| Categorías de datos | Oficio declarado, epígrafe elegido/confirmado, forma jurídica (autónomo/SL). No se comparte con la AEAT ni ningún tercero — es solo informativo. |
| Encargados / destinatarios | Supabase Inc. |
| Transferencias internacionales | Igual que el tratamiento 1. |
| Conservación | Mientras la cuenta esté activa. |

## 10. Atención de consultas y soporte

| Campo | Detalle |
|---|---|
| Finalidad | Responder consultas enviadas a contacto@ o soporte@todooficios.es. |
| Base legal | Interés legítimo y/o consentimiento del remitente. |
| Interesados | Cualquier persona que escribe al correo de contacto. |
| Categorías de datos | Nombre, email, contenido del mensaje. |
| Encargados / destinatarios | Proveedor de correo electrónico utilizado por TodoOficios.es. |
| Transferencias internacionales | Según el proveedor de correo que se contrate. |
| Conservación | El tiempo necesario para resolver la consulta, máximo 12 meses salvo obligación legal de conservar más tiempo. |

## 11. Analítica y publicidad — PREVISTO, NO ACTIVO

| Campo | Detalle |
|---|---|
| Finalidad | Medir visitas (analítica) y resultado de campañas (publicidad), p. ej. Google Analytics / Google Ads. |
| Base legal | Consentimiento explícito mediante el banner de cookies (implementado en `index.html`, agosto 2026). |
| Estado | **No activo todavía** — no hay ningún script de analítica/publicidad cargado en producción a fecha de este documento. El banner de consentimiento ya está listo (`initCookieConsent()` en `index.html`) para cuando se active. |
| Interesados | Visitantes del sitio que acepten estas cookies. |
| Categorías de datos | Datos de navegación, identificadores de cookie. |
| Encargados / destinatarios | Google LLC (cuando se active). |
| Transferencias internacionales | Según la política de privacidad de Google, en su momento. |
| Conservación | Según la configuración que se elija al activar el servicio (recomendado: máximo 14 meses, límite orientativo de Google Analytics). |

**Acción pendiente cuando se active:** actualizar este documento con la fecha de alta,
confirmar el DPA de Google Ads/Analytics (tratamiento 12 de la checklist legal) y revisar
si la mayor recogida de datos de navegación exige reconsiderar la designación de DPO.

## 12. Facturación de la suscripción Premium — PREVISTO, NO ACTIVO (bloqueado por `PAYMENTS_ENABLED = false`)

| Campo | Detalle |
|---|---|
| Finalidad | Emitir la factura fiscal de cada cobro de la cuota Premium (`generarFacturaPremium()` en `index.html`, tabla `invoices` en Supabase). |
| Base legal | Cumplimiento de una obligación legal (art. 29.2.e LGT, RD 1619/2012) y ejecución contractual. |
| Estado | Código implementado y probado (agosto 2026), pero no se emite ninguna factura real todavía: los pagos siguen desactivados (`PAYMENTS_ENABLED = false`) y, aunque se activaran, la función se niega a numerar mientras el emisor (TodoOficios.es) siga con datos fiscales pendientes en `legal-config.js`. |
| Interesados | Profesionales con plan Premium activo. |
| Categorías de datos | Nombre/razón social, NIF, email del profesional; importe, base, IVA y referencia de pago de PayPal. |
| Encargados / destinatarios | Supabase Inc. (tabla `invoices`). |
| Transferencias internacionales | Igual que el resto de tratamientos alojados en Supabase. |
| Conservación | Mínimo 4 años (LGT), recomendable 6 (Código de Comercio). |

**Aviso de seguridad (ver también `supabase-invoices-table.sql`):** la política de lectura de
la tabla `invoices` es tan abierta como el resto de esta app (cualquiera con la anon key
puede leer todas las facturas, no solo las propias). Es el mismo modelo que ya usa
`kv_store`, pero aquí hay NIF real de terceros — antes de activar pagos reales conviene
sustituirlo por Supabase Auth + una política por `profesional_email`, o mover la lectura a
una Edge Function con la service role key.

---

## Encargados del tratamiento — resumen y estado de los contratos (DPA)

| Encargado | Tratamientos en los que participa | DPA aceptado |
|---|---|---|
| Supabase Inc. | 1, 2, 3, 4, 5, 6 (parcial), 8, 9 | Pendiente de confirmar — normalmente se acepta al activar el proyecto en el panel de Supabase (Settings → Legal Documents / DPA). |
| PayPal (Europe) S.à r.l. et Cie, S.C.A. | 6 | Pendiente de confirmar — incluido en los términos comerciales al activar cobros reales (`PAYMENTS_ENABLED = true`). |
| Google LLC | 7, 11 (cuando se active) | Pendiente de confirmar — el DPA de Google Ads/Analytics se acepta desde la consola de la cuenta de Google Ads/Analytics cuando se cree. |

Este documento debe revisarse cada vez que se añada un tratamiento nuevo (p. ej. si se
implementa el envío semanal de facturas de gastos al gestor por email, mencionado como
idea pendiente en `ideas-rentabilidad-todooficios.md`) o un proveedor nuevo.
