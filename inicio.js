/* TrenTurnos v5 — init(), saludo y limpieza de datos obsoletos
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
// NUEVO — saludo personal según la hora del día, con el primer nombre
// de Ajustes si está puesto (si no, un saludo genérico). Se llama al
// arrancar y cada vez que se actualiza el reloj de la cabecera (cada
// 15s), así el saludo cambia solo de "buenos días" a "buenas tardes"
// sin que la persona tenga que recargar la app.
// NUEVO — extrae el nombre de pila de un nombre guardado como
// "APELLIDOS ,NOMBRE" (formato del Horario General, ej. "ALVARADO
// RODRIGUEZ ,JOSE ALEJANDRO") — antes se cogía la primera palabra del
// texto completo, que con este formato daba el APELLIDO ("ALVARADO"),
// no el nombre real. Si no hay coma (alguien escribió su nombre a
// mano, "normal"), se coge la primera palabra tal cual, como antes.
function _primerNombreDesde(nombreCompleto){
  if(!nombreCompleto) return '';
  var texto = String(nombreCompleto).trim();
  var partes = texto.split(',');
  var pila = (partes.length > 1 ? partes[1] : partes[0]).trim().split(/\s+/)[0] || '';
  if(!pila) return '';
  return pila.charAt(0).toUpperCase() + pila.slice(1).toLowerCase();
}

function actualizarSaludo(){
  var el = document.getElementById('saludo-personal');
  if(!el) return;
  var hora = new Date().getHours();
  var momento = (hora>=6 && hora<12) ? 'buenos días' : (hora>=12 && hora<20) ? 'buenas tardes' : 'buenas noches';
  // NUEVO — si la persona puso un nombre propio para el saludo
  // (AJ.nombrePila, editable en Ajustes), se usa ese tal cual; si no,
  // se calcula solo a partir del nombre completo.
  var primerNombre = (AJ.nombrePila && AJ.nombrePila.trim()) || _primerNombreDesde(AJ.nombre);
  el.textContent = 'Hola' + (primerNombre ? ', '+primerNombre : '') + ', '+momento;
}

function init(){
  // Limpiar claves de versiones anteriores (ya no necesarias)
  ['tv3','tv4','aj3','aj4'].forEach(function(k){localStorage.removeItem(k);});
  // Detectar y limpiar datos con días comp en mes incorrecto
  limpiarDatosObsoletos();
  // Reubicar retrasos de tramo 2 guardados antes de esta versión en la
  // celda de origen de una pernocta — pasan a vivir en la celda del día
  // de vuelta, que es donde ocurren realmente. Solo mueve datos, nunca
  // los elimina.
  migrarRetrasosPernocta();

  setInterval(function(){var n=new Date();document.getElementById('sbt').textContent=pad(n.getHours())+':'+pad(n.getMinutes());actualizarSaludo();},15000);
  var n=new Date();document.getElementById('sbt').textContent=pad(n.getHours())+':'+pad(n.getMinutes());
  actualizarSaludo();
  loadAjUI();
  renderCal();
  renderStats();
  initSwipe(); // activar swipe táctil en calendario
  // Desbloquear AudioContext en primer toque (requisito Android/iOS)
  // FIX SWIPE: diferido con setTimeout(0) para que nunca compita con
  // touchstart del calendario (captura de coordenadas para el gesto).
  document.addEventListener('touchstart', function(){ setTimeout(alarmaDesbloquear, 0); }, {passive:true});
  document.addEventListener('click', function(){ setTimeout(alarmaDesbloquear, 0); }, {passive:true});
  // Arrancar alarmas si estaban activas
  if(AJ.alarmas && AJ.alarmas.activas) alarmaIniciar();
  // Cargar Lista Negra para mostrar el resumen en Ajustes
  cargarListaNegra();
  actualizarResumenListaNegra();
  // Lanzar tour guiado solo la primera vez (independiente, no bloqueante)
  iniciarTourSiEsLaPrimeraVez();
  // Verificar recordatorio HTDL pospuesto
  checkRecordatorioHTDL();
  // Mostrar novedades si es la primera vez con esta versión
  mostrarNovedadesSiNuevas();
}

function limpiarDatosObsoletos(){
  // SEGURIDAD: función desactivada para evitar borrado accidental de datos.
  // La lógica original borraba TV completo si cualquier día comp
  // estaba en mes incorrecto — demasiado destructivo.
  // Los datos se mantienen intactos.
  return;
}
