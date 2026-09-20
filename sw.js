/* TrenTurnos v5 — service worker (uso sin conexión).
 *
 * QUÉ HACE
 *  • Al instalarse guarda una copia de todos los archivos de la app (lista ARCHIVOS).
 *  • Archivos de la propia app: "red primero" → si hay internet siempre se descarga la
 *    versión más reciente (y se actualiza la copia); si no hay internet, usa la copia.
 *  • Librerías externas (pdf.js, xlsx, supabase, tesseract, fuentes): usa la copia guardada
 *    al instante y la refresca en segundo plano.
 *  • NO intercepta nada más (Supabase, anuncios, correo...): esas peticiones van directas.
 *
 * CUÁNDO TOCARLO
 *  • Cada vez que publiques cambios, cambia VERSION (por ejemplo, la fecha). Así todos los
 *    móviles descartan la copia vieja y guardan la nueva.
 *  • Si añades o renombras un archivo .js/.css/imagen, añádelo también a ARCHIVOS.
 */
const VERSION = '2026-09-21-1';
const CACHE = 'trenturnos-' + VERSION;

/* Rutas relativas a este archivo (sw.js). */
const ARCHIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/01-base-y-calendario.css",
  "css/02-overlays-y-formulario.css",
  "css/03-ajustes-y-estadisticas.css",
  "css/04-animaciones-y-tarjeta-del-dia.css",
  "css/05-alarmas-legal-y-acordeones.css",
  "css/06-cambios-de-turno-y-tablon.css",
  "css/07-panel-hoy-y-horario-individual.css",
  "css/08-popup-simplificado-y-dh.css",
  "css/09-companeros-buscador-y-admin.css",
  "css/10-splash-checkin-nomina-y-chatbot.css",
  "js/arranque/registro-service-worker.js",
  "js/arranque/splash.js",
  "js/datos/convenio-data.js",
  "js/nucleo/persistencia.js",
  "js/nomina/nomina-estimada.js",
  "js/nomina/nomina-real.js",
  "js/nomina/nomina-publica.js",
  "js/ayuda/ayuda-convenio-y-chatbot.js",
  "js/nucleo/inicio.js",
  "js/turnos/jornada-y-descansos.js",
  "js/turnos/art-51-52-y-mix.js",
  "js/turnos/retrasos-e-impacto-economico.js",
  "js/turnos/copiar-turno.js",
  "js/turnos/estaciones-y-autocompletado.js",
  "js/calendario/calendario.js",
  "js/calendario/popup-simplificado.js",
  "js/compartir/compartir-turno.js",
  "js/turnos/tipos-y-cambios-de-turno.js",
  "js/turnos/formulario-de-turno.js",
  "js/turnos/guardar-y-eliminar-turno.js",
  "js/turnos/borrado-multiple-y-baja-medica.js",
  "js/ui/selector-estaciones-y-teclado-hora.js",
  "js/ajustes/ajustes.js",
  "js/estadisticas/estadisticas.js",
  "js/companeros/agenda.js",
  "js/nucleo/utilidades-y-navegacion.js",
  "js/calculos/jornada-y-continuidad.js",
  "js/calculos/calculo-de-ganancias.js",
  "js/turnos/correo-de-compensacion-y-vistas.js",
  "js/turnos/multiturno-y-companero.js",
  "js/turnos/tarjetas-multiturno.js",
  "js/alarmas/alarmas.js",
  "js/ui/acordeones.js",
  "js/horario/render-principal.js",
  "js/horario/importar-pdf-individual.js",
  "js/horario/pdf-worker-y-meses.js",
  "js/horario/auditoria-y-computo-oficial.js",
  "js/horario/validacion-dh-y-gestion-de-meses.js",
  "js/htdl/solicitud-htdl-y-correos.js",
  "js/ayuda/novedades-y-tour.js",
  "js/horario/dh-y-solo-ida.js",
  "js/companeros/lista-negra.js",
  "js/checkin/checkin-del-dia.js",
  "js/legal/cookies-y-publicidad.js",
  "js/admin/panel-de-administrador.js",
  "js/nube/horario-en-la-nube.js",
  "js/nube/cuentas-y-acceso.js",
  "js/estado/constantes-y-estado.js",
  "js/estado/parches-y-arranque.js",
  "js/estado/sesion-y-cuentas.js",
  "js/modulos/companeros-interventor-y-cambios.js",
  "js/modulos/portal-de-perfil.js",
  "js/modulos/notificaciones-del-admin.js",
  "assets/icons/icon-192.webp",
  "assets/icons/icon-512.webp",
  "assets/icons/apple-touch-icon.png"
];

const CDN = /(^|\.)(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ARCHIVOS.map((u) =>
        c.add(new Request(u, { cache: 'reload' })).catch(() => { /* un archivo que falle no bloquea la instalación */ })
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) ev.respondWith(redPrimero(req));
  else if (CDN.test(url.hostname)) ev.respondWith(copiaYActualiza(req));
  /* cualquier otra cosa: sin interceptar */
});

async function redPrimero(req) {
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res && res.ok) {
      const c = await caches.open(CACHE);
      c.put(req, res.clone());
    }
    return res;
  } catch (e) {
    const guardado = await caches.match(req, { ignoreSearch: true });
    if (guardado) return guardado;
    if (req.mode === 'navigate') {
      const indice = await caches.match('index.html');
      if (indice) return indice;
    }
    return Response.error();
  }
}

async function copiaYActualiza(req) {
  const c = await caches.open(CACHE);
  const guardado = await c.match(req);
  const actualizada = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  }).catch(() => null);
  return guardado || (await actualizada) || Response.error();
}
