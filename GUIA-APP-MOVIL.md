# Guía: convertir TodoOficios.es en app (Google Play / iOS)

Estado actual: la web ya está preparada como PWA (`manifest.json`, `sw.js` con
caché offline básica, iconos en `assets/`). No hace falta reescribir nada del
sitio para publicarlo como app — solo "envolverlo".

## Antes de nada

- Recuerda que `.htaccess` tiene un modo construcción que redirige casi todo a
  `proximamente.html`. `sw.js` y `.well-known/` ya están en la lista blanca,
  pero si añades más rutas nuevas para la app, revisa esa lista.
- Cache-Control está puesto a `no-cache` para todo en `.htaccess`. No afecta
  al Service Worker (usa su propia caché), pero tenlo en cuenta si algo se ve
  desactualizado.

## Android (Google Play) — vía TWA con Bubblewrap

TWA (Trusted Web Activity) abre la web dentro de una app nativa real, en
pantalla completa, usando el navegador del sistema por debajo. Es la opción
más rápida porque reutiliza el 100% del código web.

1. **Instala Bubblewrap** (requiere Node.js y Java JDK):
   ```
   npm i -g @bubblewrap/cli
   ```

2. **Inicializa el proyecto** apuntando al manifest en producción:
   ```
   bubblewrap init --manifest https://todooficios.es/manifest.json
   ```
   Te preguntará el *package name* (ej. `es.todooficios.app`) y generará una
   clave de firma (guárdala, la necesitarás para futuras actualizaciones).

3. **Copia la huella SHA256** que te muestra Bubblewrap al terminar y pégala
   en `.well-known/assetlinks.json`, sustituyendo el placeholder
   `REEMPLAZA_ESTO_CON_TU_HUELLA_SHA256`. También ajusta `package_name` si
   usaste uno distinto a `es.todooficios.app`. Sube ese archivo a producción
   — Google lo comprueba para verificar que la app y la web son tuyas.

4. **Genera el paquete**:
   ```
   bubblewrap build
   ```
   Esto produce un `.aab` (Android App Bundle).

5. **Publícalo en Google Play Console**:
   - Cuenta de desarrollador: pago único de 25$.
   - Sube el `.aab`, rellena ficha (capturas, descripción, política de
     privacidad — ya tienes `politica-privacidad.html`, puedes enlazarla).
   - Revisión de Google: normalmente 1-3 días.

6. **Actualizaciones futuras**: como es una TWA, casi nunca necesitas volver
   a subir un `.aab` — al cambiar la web, la app se actualiza sola porque
   carga el contenido en vivo. Solo tendrías que regenerar el paquete si
   cambias el manifest, el nombre, los iconos o el package name.

## iOS (App Store)

Apple no tiene equivalente a TWA. Dos caminos:

### Opción A — Sin pasar por la App Store (gratis, ya funciona)
Los usuarios de iPhone pueden instalar la web como app desde Safari:
"Compartir" → "Añadir a pantalla de inicio". Gracias al `manifest.json` ya
configurado, se abre en pantalla completa como una app. Cero coste, cero
revisión de Apple, pero no aparece en la App Store (menos visibilidad).

### Opción B — Publicar en la App Store con Capacitor
Envuelve el mismo código web en un proyecto Xcode nativo.

1. Necesitas un **Mac** (para compilar con Xcode) y una cuenta de **Apple
   Developer** (99$/año).
2. Instala Capacitor en un proyecto nuevo:
   ```
   npm install @capacitor/core @capacitor/cli
   npx cap init "TodoOficios" "es.todooficios.app"
   npx cap add ios
   ```
3. Configura Capacitor para cargar la web en vivo (server.url) en vez de
   copiar los archivos dentro de la app, así se sigue actualizando sola
   igual que la TWA de Android:
   ```json
   // capacitor.config.json
   { "server": { "url": "https://todooficios.es" } }
   ```
4. Abre el proyecto en Xcode (`npx cap open ios`), configura iconos/splash,
   compílalo y súbelo a App Store Connect con Xcode o Transporter.
5. Revisión de Apple: más estricta que Google. Es habitual que rechacen apps
   que son "solo una web envuelta" sin nada nativo añadido — ayuda incluir
   alguna función nativa (notificaciones push, compartir nativo, etc.) o
   dejar claro en la ficha que es un directorio de servicios con
   funcionalidad real (presupuestos, calculadoras, contacto).

## Resumen de costes

| Plataforma | Coste | Tiempo estimado |
|---|---|---|
| PWA (ya la tenéis) | Gratis | — |
| Android (TWA) | 25$ (pago único) | 1-2 días de trabajo |
| iOS (Safari, sin tienda) | Gratis | — |
| iOS (App Store, Capacitor) | 99$/año + Mac | 3-5 días de trabajo + revisión Apple |

## Checklist antes de publicar

- [ ] Web fuera del modo construcción (o con el dominio verificado igualmente)
- [ ] `assetlinks.json` con el `package_name` y SHA256 reales
- [ ] Iconos de buena calidad (ideal: añadir variante "maskable" 512x512)
- [ ] Política de privacidad enlazada (ya existe: `politica-privacidad.html`)
- [ ] Probar la app instalada en un móvil real, no solo en el navegador
