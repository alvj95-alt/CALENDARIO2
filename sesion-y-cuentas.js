/* TrenTurnos v5 — Restauración de sesión y estado de cuentas en la nube
   Separado del HTML único original SIN cambiar la lógica.
   Sentencias ejecutables en su orden original.
   El orden de carga está en index.html (importa: no lo alteres). */
// perfilAdminActual ya se declara mucho más arriba, junto a curM/
// statsM (ver fix) — no se repite aquí para evitar una redeclaración
// de "let".

// NUEVO — cualquier persona con sesión iniciada (admin o con
// matrícula+PIN), para la copia de seguridad personal en la nube.
// perfilAdminActual sigue siendo SOLO para verificar el rol admin
// (Panel de Control); usuarioActual es más amplio: "hay alguien
// logueado", sea quien sea, y sirve para guardar/cargar SU propio
// horario. Un admin logueado también cuenta como usuarioActual.
let usuarioActual = null; // {id, matricula|null, email|null}
let _emailAdminPendiente = null;

// FIX — al recargar la app, esto ya NO abre el panel solo: se limita
// a comprobar en silencio si sigues logueado (para que el icono se
// pinte en ámbar si eres admin), sin interrumpir lo que estés
// haciendo.
// FIX — REDISEÑO: la sesión de matrícula+PIN ya NO vive en Supabase
// Auth (ver crearCuentaConMatricula), así que ya no llega aquí por
// onAuthStateChange. Se restaura leyendo directamente lo que quedó
// guardado en este dispositivo la última vez que se creó cuenta o se
// inició sesión con matrícula. onAuthStateChange, más abajo, sigue
// existiendo tal cual para la sesión de ADMIN (esa sí es un login
// real de Supabase Auth con email/contraseña, y no cambia).
(function _restaurarSesionMatricula(){
  var mat = localStorage.getItem('sesionMatriculaActiva');
  if(mat){
    usuarioActual = { id: null, email: null, matricula: mat };
    // Seguro llamarla aquí aunque esté declarada más abajo en el
    // archivo: las funciones "function nombre(){...}" quedan
    // disponibles desde el principio del script (hoisting).
    actualizarUICuentaNube();
  }
})();

// FIX — Confirmado por Alex (bug real detectado en producción —
// segunda causa raíz, del mismo tipo que la de sbAdmin de arriba):
// esta llamada daba por hecho que sbAdmin siempre existía. Pero si
// Supabase no llegaba a cargar (red mala, CDN caído — muy plausible
// en el tren), el try/catch de un poco más arriba deja sbAdmin en
// null A PROPÓSITO para no romper nada más. Esta línea no comprobaba
// eso: llamaba a sbAdmin.auth.onAuthStateChange(...) igual, y revienta
// con "Cannot read properties of null (reading 'auth')" sin capturar el
// error — y al ser código de nivel superior (no dentro de una
// función), eso cortaba en seco la ejecución de TODO lo que viniera
// después en este mismo <script>, incluyendo activateBase(),
// mostrarSelectorCompaneros() y mostrarDetalleCompaneros() (los
// botones "Por nombre"/"Por número de tren" de Compañeros) — de ahí
// que se vieran normales pero no hicieran nada al pulsarlos. Ahora se
// comprueba primero que sbAdmin exista, igual que ya hace el resto
// del archivo en cualquier otro sitio donde se usa.
if(sbAdmin){
sbAdmin.auth.onAuthStateChange(function(event, session){
  if(session && session.user){
    // Con el rediseño, si hay sesión de Supabase Auth es SIEMPRE una
    // cuenta real de admin (email+contraseña) — las cuentas de
    // matrícula+PIN ya no pasan por aquí.
    usuarioActual = { id: session.user.id, email: session.user.email || null, matricula: null };
    cargarPerfilYVerificarAdmin(session.user, false);
    actualizarUICuentaNube();
  } else if(event === 'SIGNED_OUT'){
    // Si quien cerró sesión era el admin, se limpia usuarioActual —
    // salvo que en este dispositivo siga activa una sesión de
    // matrícula+PIN (independiente de Supabase Auth), en cuyo caso se
    // mantiene.
    var mat = localStorage.getItem('sesionMatriculaActiva');
    usuarioActual = mat ? { id: null, email: null, matricula: mat } : null;
    actualizarUICuentaNube();
  }
});
}

/* ═══════════════════════════════════════════════════════════
   MI HORARIO PERSONAL EN LA NUBE — módulo aditivo, independiente
   de config_global (que es la que comparten todos los compañeros).
   Usa la tabla PROPIA "datos_personales" (una fila por user_id, con
   RLS: cada usuario solo puede leer/escribir la suya — ver el SQL
   aparte que crea esta tabla). Guarda TV (turnos) y el horario
   individual (horarios:index + cada horario:MESKEY del localStore ya
   existente). Nunca se carga sola: siempre pide confirmación primero
   mediante el pop-up ov-cargar-nube, porque sobrescribiría los datos
   de este dispositivo.
═══════════════════════════════════════════════════════════ */
var _datosNubePendientes = null;

// Alterna el bloque entre "crear cuenta" y "iniciar sesión" (la
// confirmación de PIN solo hace falta al crear la cuenta).
var _modoCuentaNube = 'crear';
