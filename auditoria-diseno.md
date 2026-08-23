# Auditoría de diseño: TodoOficios.es

*Basado en index.html tal como está en tu carpeta local (sin publicar), capturado en escritorio (1440px) y móvil (390px), más inspección directa del código fuente (variables de color y font-family reales, no solo apreciación visual).*

## Impresión general
La base es más sólida de lo que parece a primera vista: paleta disciplinada (negro, blanco, un único ámbar de acento), un sistema tipográfico de 3 familias con roles claros, y contenido real de confianza (perfiles, "cómo funciona", contacto en el pie). Pero todo eso queda tapado por dos cosas que gritan más fuerte que el resto de la página: los avisos rojos de configuración técnica justo debajo de la cabecera, y que el teléfono/contacto no aparece hasta el final del todo. Un visitante que busca un fontanero con urgencia ve primero "esto está a medio construir" y tiene que hacer scroll hasta el pie para encontrar un número al que llamar — eso, no la estética, es lo que más te está costando ahora mismo.

## Tipografía
- [✓] **Corrección a mi propio análisis anterior:** al inspeccionar el CSS directamente (no solo la captura), el sitio usa un sistema de **3 familias con roles bien definidos**: Space Grotesk para títulos, IBM Plex Sans para cuerpo/interfaz, IBM Plex Mono para etiquetas y metadatos (roles, distancias, fechas). No es una mezcla accidental — es una decisión de diseño coherente, más cercana a "3 con propósito" que a "caos tipográfico". *(Nota: en mis capturas, Space Grotesk se renderizó como una serif de sistema porque este entorno no tiene acceso a Google Fonts — revisa tú mismo en un navegador normal que el título se vea con la fuente correcta; si ya se ve bien, ignora cualquier comentario mío anterior sobre "mezcla de serif y sans-serif".)*
- [✓] Jerarquía de tamaños clara en el hero: etiqueta pequeña → H1 grande (54px) → subtítulo intermedio. Un vistazo basta para saber qué es lo importante ahí.
- [✗] El uso de IBM Plex Mono para tantos elementos distintos (rol del profesional, distancia, fecha de reseña, "SERVICIOS DESTACADOS") funciona como "etiqueta técnica", pero conviviendo con los emoji de los chips de servicio (🔧⚡🔒🎨🧱🪟) rompe ese tono cuidado — es informal donde el resto del sistema es deliberadamente serio.

## Colores
- [✓] La paleta base es realmente disciplinada a nivel de código: solo 5 variables de color (negro `#141412`, blanco, un gris-crema claro, y un único ámbar `#F2B705` con su variante oscura). Esto es exactamente lo que recomienda cualquier manual de marketing — no te sobran colores.
- [✗] El problema no es cuántos colores hay, sino cuántos significados carga el único acento: el ámbar marca a la vez el ítem de menú activo ("Inicio"), el CTA principal ("Soy profesional") y el texto del banner de lanzamiento ("6 meses gratis"). Cuando un solo color significa "aquí estás", "haz clic" y "oferta" a la vez, deja de guiar la mirada hacia la acción que más te interesa.
- [✗] Los dos avisos de configuración están en rojo/rosa — la asociación instintiva es "error", justo lo contrario de lo que necesita transmitir la primera pantalla de un marketplace de confianza.

## Jerarquía visual y espaciado
- [✓] Las tarjetas de "Perfiles destacados" y los 4 bloques de "Cómo funciona" tienen aire suficiente y se distinguen bien unas de otras — esta parte de la página, más abajo, está bien resuelta.
- [✗] Los dos avisos rojos ocupan el primer contacto visual, empujando el hero (la propuesta de valor real) más abajo de lo necesario.
- [✗] Navegación duplicada: 6 enlaces completos en línea (Inicio, Soy profesional, Buscar, Soy cliente, Calculadoras, Blog) más un botón "☰ Menú" aparte — no queda claro qué contiene ese menú si casi todo ya está visible.

## Confianza y contacto
- [✗] **Este es el hallazgo más importante de toda la auditoría:** el teléfono (+34 910 00 00 00) y el email de contacto existen, pero solo aparecen en el pie de página — tras el hero, el banner, los servicios, los perfiles y el "cómo funciona". Para un negocio de oficios, donde mucha gente busca con urgencia, obligar a hacer scroll completo antes de encontrar un contacto es el error más costoso del sitio.
- [✓] Sí hay contenido real de confianza más abajo: perfiles con nombre, oficio, años de experiencia, ubicación y valoración (Franco Medina, Cecilia Basle, Matías Servant), y una sección "Cómo funciona" que explica el modelo con claridad. *(Si estos tres perfiles son datos de ejemplo y no profesionales reales todavía, dilo en algún sitio o susstitúyelos antes de publicar — un perfil falso descubierto mina la confianza más que no tener ninguno.)*
- [✗] El pie de página muestra literalmente "Titular: PENDIENTE_RAZÓN_SOCIAL", "NIF/CIF: PENDIENTE_NIF_CIF", "Domicilio: PENDIENTE_DOMICILIO_FISCAL" — visible para cualquiera que llegue hasta abajo. Junto con los avisos rojos, refuerza la sensación de "página a medio terminar" en dos puntos distintos de la misma visita.

## Uso en móvil
- [✗] En móvil, los 6 enlaces de navegación se apilan como botones de ancho completo antes de llegar a los avisos rojos y luego al hero — alguien tiene que desplazarse por una pared de botones para llegar a una sola palabra sobre el servicio.
- [✓] Los botones sí son de ancho completo y fáciles de tocar con el pulgar allí donde se ven (CTA del hero, "Ver perfil", tarjetas de "Cómo funciona").
- [✗] El problema de "contacto solo en el pie" es aún más grave en móvil: implica un scroll mucho más largo (pantalla estrecha = más scroll) para llegar al teléfono.

## Llamada a la acción
- [✗] Dos CTAs en el hero con pesos distintos: "Soy profesional" (relleno ámbar, fuerte) vs. "Busco un profesional" (contorno, débil). Si el tráfico prioritario es gente buscando ayuda, el botón con más fuerza visual apunta a la audiencia equivocada — conviene confirmar que es intencionado.
- [✗] El enlace "plan gratuito para siempre" dentro del banner de lanzamiento usa el mismo ámbar que el CTA principal — un tercer elemento "clicable y dorado" compitiendo en la misma pantalla.

## Comparado con Habitissimo/Instapro y Linear
Habitissimo (ahora Instapro), el marketplace español de oficios/reformas más comparable, resuelve la tensión de "dos audiencias" con un buscador dominante para el cliente y relega el acceso de profesionales a un enlace secundario — la jerarquía deja claro a quién se dirige la portada, algo que TodoOficios.es aún no decide. Linear, fuera del sector pero ejemplo extremo de disciplina visual, usa un único acento de color para una única acción por pantalla — ilustra que la paleta de TodoOficios.es ya tiene la contención correcta (un solo color de acento a nivel de código), solo le falta aplicar esa misma disciplina a *cuántas cosas distintas* significa ese color.

## Qué mejorar primero
1. **Cambios rápidos (bajo esfuerzo, impacto notable)**
   - Quitar los dos avisos rojos de configuración de la vista pública — es lo más urgente de todo el informe.
   - Completar los datos del pie (razón social, NIF/CIF, domicilio) o, si aún no los tienes, ocultar esas líneas en vez de mostrar "PENDIENTE_...".
   - Subir un teléfono/WhatsApp visible y fijo en la cabecera (no solo en el pie) — es el cambio con más impacto real en llamadas.
   - Reservar el ámbar solo para el CTA principal; dar al banner de lanzamiento y al ítem de menú activo un tratamiento visual distinto.

2. **Cambios de fondo (más trabajo, pero lo eleva de verdad)**
   - En móvil, colapsar la navegación bajo un único icono de menú en vez de apilar los 6 enlaces completos más el botón "☰ Menú".
   - Decidir qué audiencia es prioritaria (cliente que busca ayuda vs. profesional que se da de alta) y dar a ese CTA el peso visual dominante.
   - Confirmar (y decirlo en el sitio si aplica) si los perfiles destacados son reales o de ejemplo, para no arriesgar credibilidad cuando se publique.
