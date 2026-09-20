# 🚆 TrenTurnos v5

App web (PWA) para tripulación de tren: calendario de turnos, horas, compensaciones (HTDL, Art. 51/52), nómina estimada, buscador de compañeros, cambios de turno y check-in.
Funciona en el navegador y se puede "instalar" en el móvil (Añadir a pantalla de inicio). Los datos del usuario se guardan en su propio dispositivo (`localStorage`); Supabase se usa solo para el panel de admin, horarios publicados, cuentas por matrícula, cambios de turno y check-in.

Este proyecto es el antiguo HTML único **separado en archivos**, sin cambiar la lógica de la app.

---

## Cómo publicarlo en GitHub Pages (paso a paso)

1. En GitHub crea un repositorio (por ejemplo `trenturnos`). Puede ser público o privado con Pages activado.
2. Entra en el repositorio → **Add file → Upload files**.
3. Descomprime el ZIP y arrastra **el contenido** de la carpeta `trenturnos/` (no la carpeta en sí): tiene que quedar `index.html` en la raíz del repositorio, junto a `css/`, `js/`, `assets/`, `sw.js` y `manifest.webmanifest`.
   *(Son unos 70 archivos, GitHub admite hasta 100 por subida. Si tu navegador no sube la carpeta vacía `.nojekyll`, no pasa nada: es opcional.)*
4. Pulsa **Commit changes**.
5. Ve a **Settings → Pages** → *Build and deployment* → **Deploy from a branch** → rama `main`, carpeta `/ (root)` → **Save**.
6. En un par de minutos la app estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

> Si ya tenías la app publicada con otro nombre de archivo o con un `sw.js` propio, sustitúyelos por estos. El `sw.js` nuevo borra automáticamente las cachés antiguas de los móviles que ya la tenían instalada.

## Cómo actualizar la app después

1. Edita el archivo que toque (mira el mapa de abajo) desde GitHub (icono del lápiz) o con `git`.
2. **Cambia `VERSION` en `sw.js`** (por ejemplo a la fecha de hoy). Así los móviles descartan la copia vieja y guardan la nueva.
3. Haz *Commit*. En 1–2 minutos GitHub Pages lo publica.

Si alguien sigue viendo la versión antigua: cerrar la app del todo y volverla a abrir; si persiste, en el navegador *Ajustes del sitio → Borrar datos*. (Ojo: eso borra sus turnos locales; usar antes la opción de **Backup** (exportar datos) de la app.)

## Probarlo en tu ordenador

Abrir `index.html` con doble clic ya funciona. Para probarlo como en GitHub Pages (con service worker y modo sin conexión):

```bash
cd trenturnos
python3 -m http.server 8000      # y abre http://localhost:8000
```

---

## ⚠️ Reglas para no romper nada (léelas antes de editar)

El HTML original tenía **un solo `<script>` gigante**. En JavaScript, las funciones (`function nombre(){}`) de un script se "elevan" y existen desde el principio, pero las variables y el código que se ejecuta al cargar no. Para conservar **exactamente** ese comportamiento, el código está separado así:

1. **`js/<carpeta>/…` (funciones):** contienen solo declaraciones `function`. Se cargan primero. Puedes editar, añadir o mover funciones entre estos archivos con libertad.
2. **`js/estado/…` (código que se ejecuta al cargar):** constantes, estado (`AJ`, `TV`…), parches de funciones y `init()`. Se cargan **después** de todas las funciones y **en ese orden**.
   - `parches-y-arranque.js` **no se puede partir**: `init()` y los parches dependen de variables declaradas ahí mismo.
   - Si una función nueva necesita ejecutarse al arrancar, llámala desde este archivo, no desde uno de funciones.
3. **`js/modulos/companeros-interventor-y-cambios.js`** es un único bloque `(function(){ … })();` con estado compartido. Lo que deba usarse desde un `onclick` del HTML tiene que exponerse con `window.nombre = nombre;` (ya está hecho para todo lo existente).
4. **El orden de los `<script>` en `index.html` importa.** Si añades un archivo nuevo de funciones, ponlo en el grupo de funciones (antes de `js/estado/…`) y añádelo también a `ARCHIVOS` en `sw.js`.
5. Los `onclick="..."` del HTML siguen llamando a funciones globales. No las conviertas en variables locales ni en módulos ES.

## Mapa de archivos

```
index.html                 Estructura de la app (HTML) y orden de carga
manifest.webmanifest       Datos de la PWA (nombre, colores, iconos)
sw.js                      Service worker: uso sin conexión y actualizaciones
assets/icons/              Iconos de la app (192, 512 y apple-touch-icon)
css/                       Estilos, en el orden exacto del <style> original (01 → 10)
js/arranque/               Registro del service worker y pantalla de carga (splash)
js/datos/                  Texto del Convenio Colectivo (solo datos)
js/<carpetas>/             Funciones agrupadas por funcionalidad
js/estado/                 Constantes, estado global, parches y arranque
js/modulos/                Módulos aislados: compañeros/interventor/cambios, portal de perfil, notificaciones
```

| Archivo | Qué contiene |
|---|---|
| `js/admin/panel-de-administrador.js` | Panel de administrador (sesión, horario general, intervención, solicitudes) |
| `js/ajustes/ajustes.js` | Ajustes: perfil, rol, pluses, guardado |
| `js/alarmas/alarmas.js` | Alarmas y alarma persistente |
| `js/arranque/registro-service-worker.js` | Registro del service worker (PWA / uso sin conexión) |
| `js/arranque/splash.js` | Pantalla de carga animada (tren) |
| `js/ayuda/ayuda-convenio-y-chatbot.js` | Tutorial, aviso de publicidad, lector del Convenio y chatbot de ayuda |
| `js/ayuda/novedades-y-tour.js` | Novedades, tour guiado y ayuda |
| `js/calculos/calculo-de-ganancias.js` | calculateEarnings(): cálculo económico del mes |
| `js/calculos/jornada-y-continuidad.js` | Cálculo de jornada diaria y continuidad |
| `js/calendario/calendario.js` | Calendario: render de mes, swipe, clic en día, hoy |
| `js/calendario/popup-simplificado.js` | Pop-up simplificado del día y detalles en historial |
| `js/checkin/checkin-del-dia.js` | Check-in del día (foto, OCR, vista por hora/vía) |
| `js/companeros/agenda.js` | Agenda de compañeros |
| `js/companeros/lista-negra.js` | Lista negra de compañeros |
| `js/compartir/compartir-turno.js` | Compartir turno (imagen/texto) |
| `js/datos/convenio-data.js` | Datos del Convenio Colectivo (texto completo, solo lectura) |
| `js/estadisticas/estadisticas.js` | Estadísticas y Desglose Económico (TAS) |
| `js/estado/constantes-y-estado.js` | Constantes, tarifas, ajustes (AJ), turnos (TV) y estado global |
| `js/estado/parches-y-arranque.js` | Parches de funciones, estado de módulos, init() y listeners de arranque |
| `js/estado/sesion-y-cuentas.js` | Restauración de sesión y estado de cuentas en la nube |
| `js/horario/auditoria-y-computo-oficial.js` | Auditoría de horas y comparativa con el Cómputo Oficial (Excel) |
| `js/horario/dh-y-solo-ida.js` | Módulo DH y "solo ida" |
| `js/horario/importar-pdf-individual.js` | Lectura del PDF individual y carga automática al calendario |
| `js/horario/pdf-worker-y-meses.js` | Worker de PDF.js y almacén de meses del Horario individual |
| `js/horario/render-principal.js` | renderAll / renderToday (panel Horario y Hoy) |
| `js/horario/validacion-dh-y-gestion-de-meses.js` | Validación asistida DH y gestión/eliminación de meses |
| `js/htdl/solicitud-htdl-y-correos.js` | Solicitud de HTDL, recordatorios y correos |
| `js/legal/cookies-y-publicidad.js` | Consentimiento de cookies y carga de anuncios |
| `js/modulos/companeros-interventor-y-cambios.js` | Horario General, Buscador de Compañeros, Interventor, Cambios de turno, Notificaciones push y Tablón |
| `js/modulos/notificaciones-del-admin.js` | Notificaciones del Admin a todos los trabajadores (bloque aislado) |
| `js/modulos/portal-de-perfil.js` | Portal de perfil: Tripulante vs Interventor (bloque aislado) |
| `js/nomina/nomina-estimada.js` | Nómina Estimada: conceptos fijos, devengo de pagas, apertura del panel |
| `js/nomina/nomina-publica.js` | Pantalla pública de Nómina, aviso legal y cálculo en vivo |
| `js/nomina/nomina-real.js` | Nómina Real (PDF/foto): lectura, comparación y diferencias |
| `js/nube/cuentas-y-acceso.js` | Cuenta con matrícula + PIN, solicitudes de acceso y sesión |
| `js/nube/horario-en-la-nube.js` | Mi horario personal en la nube |
| `js/nucleo/inicio.js` | init(), saludo y limpieza de datos obsoletos |
| `js/nucleo/persistencia.js` | Lectura/escritura segura de localStorage y guardados de estado |
| `js/nucleo/utilidades-y-navegacion.js` | Utilidades (key/pad/tiempos), overlays, navegación de pestañas, toast |
| `js/turnos/art-51-52-y-mix.js` | Artículos 51/52, compensación Mix y correo asociado |
| `js/turnos/borrado-multiple-y-baja-medica.js` | Borrado múltiple y módulo de Baja médica |
| `js/turnos/copiar-turno.js` | Copiar un turno a otro día |
| `js/turnos/correo-de-compensacion-y-vistas.js` | Correo de solicitud de compensación y modo de vista |
| `js/turnos/estaciones-y-autocompletado.js` | Servicios frecuentes, Estaciones y Horarios, autocompletado de tren |
| `js/turnos/formulario-de-turno.js` | Formulario de turno (tramos, continuidad, pernocta) |
| `js/turnos/guardar-y-eliminar-turno.js` | Guardar y eliminar turno |
| `js/turnos/jornada-y-descansos.js` | Descansos, enlaces de jornada y correos por retraso/descanso |
| `js/turnos/multiturno-y-companero.js` | Horario de compañero, TV2 (turnos adicionales) y panel de hoy |
| `js/turnos/retrasos-e-impacto-economico.js` | Retrasos, impacto económico de enlaces/baja y detalle Art. 51/52 |
| `js/turnos/tarjetas-multiturno.js` | Tarjetas y acordeones de turno (multi-turno) |
| `js/turnos/tipos-y-cambios-de-turno.js` | Tipos de turno, DOP, descansos compensatorios, cambios y registro de intercambio |
| `js/ui/acordeones.js` | Acordeones de Ajustes y de Hoy |
| `js/ui/selector-estaciones-y-teclado-hora.js` | Selector de estaciones y teclado numérico de hora |

## Correcciones incluidas respecto al HTML anterior

- `parsePageWords` se expone globalmente: crear cuenta con matrícula funciona cuando el Horario General es un **PDF**.
- `autoRellenarNombrePorMatricula` estaba dentro de `loadAjUI()` y no se podía llamar desde el `onblur` del campo matrícula; ahora es global.
- El botón "🔍 Diagnóstico: ver agentes detectados" del panel de admin ya funciona (`diagnosticarIntervencionAdmin` expuesta).
- Las lecturas de `localStorage` usan `_leerJSONseguro()`: si un dato se corrompe, la app arranca igualmente y guarda una copia del texto ilegible en `<clave>__corrupto`.
- **Mis publicaciones** muestra ahora trenes y horas (antes solo el Tablón los mostraba).

## Seguridad — pendiente (no se ha cambiado)

- La clave de Supabase del código es **publishable** (pensada para ir en el navegador). La protección real depende de las políticas **RLS** de cada tabla en Supabase: revísalas.
- La comprobación del PIN de las cuentas por matrícula se hace en el navegador (`pin_hash` con SHA-256 sin sal y PIN de 4–6 dígitos). Si la tabla `cuentas_matricula` es legible con la clave pública, los PIN se pueden deducir. Lo correcto es verificarlo en el servidor (función RPC / Edge Function).
