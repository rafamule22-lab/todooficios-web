# Definición de terminado

Bar transversal que aplica a cualquier cambio en este repo, independientemente de qué skill esté activa. Complementa los criterios de aceptación de cada tarea, no los sustituye.

Un cambio está terminado cuando:

1. **El comportamiento se verificó, no se asumió.** Para el bot de blog (`scripts/`), eso significa que `npm test` pasa. Para el sitio estático (HTML/JS sin build ni tests), significa haber leído el código modificado con atención a los flujos que toca y, cuando sea posible, probarlo en un navegador real.
2. **No hay regresiones evidentes.** Si el cambio toca `calculadoras.js`, `index.html` o `presupuesto-publico.js`, se revisó que las funciones que dependen de lo modificado (búsquelas por `grep`) siguen recibiendo lo que esperan.
3. **No se han introducido secretos ni credenciales en texto plano.** Las claves van por variables de entorno (ver `scripts/generate-blog-post.mjs` como referencia).
4. **La documentación relevante quedó actualizada** si el cambio afecta a algo descrito en `CLAUDE.md` (stack, convenciones, modelo de datos).
5. **No se ha ampliado el alcance más allá de lo pedido** (ver "Maintain Scope Discipline" en `using-agent-skills/SKILL.md`).

Este proyecto no tiene CI de lint/build para el sitio estático ni entorno de staging: la verificación manual cuidadosa importa más aquí que en un proyecto con esa red de seguridad.
