/* TrenTurnos v5 — Novedades, tour guiado y ayuda
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   MÓDULO LISTA NEGRA — completamente aditivo.
   Almacena en localStorage('listaNegraApp'), totalmente
   aislado de tv5/aj5/TV/AJ. Borrar el calendario o los
   ajustes nunca afecta esta lista, y viceversa.
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   MÓDULO AYUDA Y CONCEPTOS — completamente aditivo.
   Contenido estático, no depende de ningún dato de la app.
═══════════════════════════════════════════════════════════ */
function abrirAyuda(){
  openOv('ov-ayuda');
}
function _obtenerPasosTour(){
  return [
    {ico:'👋', tit:'¡Bienvenido a TrenTurnos!', txt:'Una guía rápida de 30 segundos para que conozcas las funciones principales. Puedes saltarla en cualquier momento.'},
    {ico:'📅', tit:'Tu Calendario', txt:'Toca cualquier día para registrar tu turno: ordinario, descanso, reserva, pernocta... Cada tipo tiene su propio color para que lo veas de un vistazo.'},
    {ico:'🗂️', tit:'Horario y PDF', txt:'En la pestaña Horario puedes subir el cuadrante oficial en PDF y solicitar tus horas HTDL con un correo ya redactado.'},
    {ico:'📊', tit:'Tus Estadísticas', txt:'La pestaña Stats calcula automáticamente tus horas trabajadas y el desglose económico del mes, a partir de los turnos que registres.'},
    {ico:'⚙️', tit:'Todo a tu medida', txt:'En Ajustes puedes configurar tu perfil, tu estación base, tus tarifas, y consultar esta misma ayuda cuando la necesites. ¡Ya estás listo!'}
  ];
}

/* ═══════════════════════════════════════════════════════════
   MÓDULO NOVEDADES — popup dinámico basado en listaNovedades[].
   Para añadir una versión futura:
     1. Edita listaNovedades con los nuevos objetos
     2. Cambia NOV_VERSION a 'nov_v8' (o la siguiente)
     3. Cambia NOV_FECHA a la fecha real de publicación (fija, no se
        calcula sola — antes usaba la fecha de "hoy" al abrir el
        popup, lo cual era incorrecto si alguien lo veía días después)
   El popup volverá a salir automáticamente a todos los usuarios.
   Clave localStorage: NOV_VERSION — aislada de TV/AJ/turnos.
═══════════════════════════════════════════════════════════ */

function mostrarNovedades(){
  // Renderizar lista desde el array — estilo "billete de tren"
  // (maqueta aprobada por Alex): icono en caja + título + descripción,
  // separados por línea, igual que los resguardos de un billete.
  var ul = document.getElementById('nov-lista');
  if(!ul) return;
  ul.innerHTML = listaNovedades.map(function(n){
    return '<li class="nov2-stub">'
      +'<div class="nov2-stub-ico">'+n.ico+'</div>'
      +'<div>'
      +'<div class="nov2-stub-title">'+n.titulo+'</div>'
      +'<div class="nov2-stub-desc">'+n.desc+'</div>'
      +'</div>'
      +'</li>';
  }).join('');
  // FIX — "BCN" ahora vive en su propia línea de ruta (junto a los
  // puntitos), así que aquí solo va la fecha, para no repetir "BCN"
  // dos veces.
  var lbl = document.getElementById('nov-version-lbl');
  if(lbl) lbl.textContent = NOV_FECHA;
  openOv('ov-novedades');
}

function cerrarNovedades(){
  // Marcar como vista — no vuelve a aparecer hasta que cambie NOV_VERSION
  try{ localStorage.setItem(NOV_VERSION, '1'); }catch(e){}
  closeOv('ov-novedades');
}

function mostrarNovedadesSiNuevas(){
  // APAGADO — Confirmado por Alex: el popup de "Novedades" queda
  // desactivado para todo el mundo, a propósito, hasta nuevo aviso.
  // No se borra nada (ni este código, ni listaNovedades, ni el HTML
  // del modal) — el día que haya una actualización grande que merezca
  // avisar con el popup, basta con quitar este "return" para
  // reactivarlo tal cual estaba.
  return;
  try{
    if(!localStorage.getItem(NOV_VERSION)){
      setTimeout(mostrarNovedades, 1200);
    }
  }catch(e){}
}

function iniciarTourSiEsLaPrimeraVez(){
  try{
    if(localStorage.getItem('tourCompletado')) return;
  }catch(e){ return; } // si localStorage falla (modo privado), no forzar el tour
  _tourPasoActual = 0;
  mostrarPasoTour();
  var overlay = document.getElementById('tour-overlay');
  var card = document.getElementById('tour-card');
  if(!overlay || !card) return;
  overlay.style.display = 'flex';
  setTimeout(function(){
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  }, 30);
}

function mostrarPasoTour(){
  var pasos = _obtenerPasosTour();
  var paso = pasos[_tourPasoActual];
  if(!paso) return;
  document.getElementById('tour-ico').textContent = paso.ico;
  document.getElementById('tour-tit').textContent = paso.tit;
  document.getElementById('tour-txt').textContent = paso.txt;
  var dotsCont = document.getElementById('tour-dots');
  dotsCont.innerHTML = pasos.map(function(_, i){
    return '<div style="width:'+(i===_tourPasoActual?14:6)+'px;height:6px;border-radius:3px;background:'+(i===_tourPasoActual?'var(--amber2)':'var(--div)')+';transition:all .2s"></div>';
  }).join('');
  var btnNext = document.getElementById('tour-btn-next');
  btnNext.textContent = (_tourPasoActual === pasos.length-1) ? '¡Empezar!' : 'Siguiente →';
}

function avanzarTour(){
  _tourPasoActual++;
  if(_tourPasoActual >= _obtenerPasosTour().length){
    cerrarTour();
    return;
  }
  var card = document.getElementById('tour-card');
  card.style.opacity = '0';
  card.style.transform = 'translateY(10px)';
  setTimeout(function(){
    mostrarPasoTour();
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  }, 180);
}

function saltarTour(){
  cerrarTour();
}

function cerrarTour(){
  try{ localStorage.setItem('tourCompletado', '1'); }catch(e){}
  var overlay = document.getElementById('tour-overlay');
  var card = document.getElementById('tour-card');
  if(card){ card.style.opacity = '0'; card.style.transform = 'translateY(14px)'; }
  setTimeout(function(){
    if(overlay) overlay.style.display = 'none';
  }, 250);
}
