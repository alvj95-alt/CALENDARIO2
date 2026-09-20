/* TrenTurnos v5 — Utilidades (key/pad/tiempos), overlays, navegación de pestañas, toast
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════
   HELPERS
═══════════════════════════════════════ */
function key(y,m,d){return y+'-'+pad(m)+'-'+pad(d);}
function pad(n){return String(n).padStart(2,'0');}

function calcMins(h1,h2){
  var _h1=h1.split(':').map(Number);var a=_h1[0],b=_h1[1];var _h2r=h2.split(':').map(Number);var c=_h2r[0],d=_h2r[1];
  var m=(c*60+d)-(a*60+b);if(m<0)m+=1440;return m;
}
function calcDur(h1,h2){if(!h1||!h2)return '--';var m=calcMins(h1,h2);return Math.floor(m/60)+'h '+pad(m%60)+'m';}

// NUEVO — texto de reparto Efectiva/Presencia de un tramo de
// continuidad, coherente con el cálculo real de calculateEarnings():
// si el DH es parcial (dhHoraInicio/dhHoraFin), se reparte en dos
// trozos; si es un DH "todo el tramo" (turnos antiguos, sin rango
// parcial), se muestra entero a Presencia, como siempre.
function _etiquetaRepartoDH(c){
  if(c.tipoTramo!=='dh') return 'Suma a Efectiva';
  if(c.dhHoraInicio && c.dhHoraFin && c.horaInicio && c.horaFin){
    var durTotal = calcMins(c.horaInicio, c.horaFin);
    var durDH = Math.min(calcMins(c.dhHoraInicio, c.dhHoraFin), durTotal);
    var durEf = Math.max(0, durTotal - durDH);
    if(durEf>0) return durDH+' min Presencia (DH) + '+durEf+' min Efectiva';
    return 'Suma a Presencia (DH completo)';
  }
  return 'Suma a Presencia';
}

// NUEVO — "con quién viajas": hueco vacío que se rellena solo, sin
// que el usuario tenga que hacer nada, en cuanto el detalle del día
// se muestra en pantalla (ver rellenarCompanerosAutomaticos() más
// abajo, disparada al final de renderDiaArea). diaKey es la clave
// ISO del día (selDay.k, ej. '2026-08-15') — se extrae el número de
// día del mes de ahí, que es el formato que usa el Horario General.
function _huecoCompaneros(tren, diaKey){
  var diaNum = String(parseInt(diaKey.slice(8,10), 10));
  return '<div class="tramo-companeros-cal" data-tren="'+tren+'" data-dia="'+diaNum+'" data-buscado="0"></div>';
}

// Recorre TODOS los huecos pendientes dentro del área del día que se
// acaba de mostrar y los rellena, uno a uno, buscando en el Horario
// General ya publicado (o cargándolo la primera vez que haga falta).
async function rellenarCompanerosAutomaticos(areaEl, mesObjetivo){
  if(!areaEl) return;
  var huecos = areaEl.querySelectorAll('.tramo-companeros-cal[data-buscado="0"]');
  if(!huecos.length) return;
  huecos.forEach(function(h){ h.dataset.buscado='1'; h.innerHTML='<div class="tc-cargando">🔍 Buscando compañeros...</div>'; });
  if(typeof window.asegurarHorarioGeneralCargado !== 'function' || typeof window.buscarCompanerosParaTrenDia !== 'function'){
    huecos.forEach(function(h){ h.innerHTML=''; });
    return;
  }
  var listo = false;
  try{ listo = await window.asegurarHorarioGeneralCargado(mesObjetivo); }catch(e){ listo = false; }
  huecos.forEach(function(h){
    if(!listo){
      h.innerHTML = '<div class="tc-vacio">Sin Horario General publicado todavía.</div>';
      return;
    }
    // FIX — antes, si algo fallaba al construir el HTML de ESTE hueco
    // (ida o vuelta), el error cortaba en seco el forEach entero y el
    // OTRO hueco se quedaba colgado para siempre en "Buscando
    // compañeros..." sin ningún aviso. Ahora cada hueco es
    // independiente: un fallo en uno no afecta al otro, y si algo
    // sale mal se ve un aviso en vez de quedarse colgado.
    try{
      var tren = h.dataset.tren, dia = h.dataset.dia;
      var nombres = [];
      try{ nombres = window.buscarCompanerosParaTrenDia(tren, dia) || []; }catch(e){ nombres = []; }
      if(!nombres.length){
        h.innerHTML = '<div class="tc-vacio">Nadie más de tu base hace el tren '+tren+' ese día.</div>';
      } else {
        h.innerHTML = '<div class="tc-tit">🧑‍🤝‍🧑 Viajas con:</div>'
          + nombres.map(function(n){ return '<div class="tc-nombre">'+(n&&n.name?n.name:n)+_chipUmDhTexto(n&&n.tren, n&&n.cell)+'</div>'; }).join('');
      }
    }catch(errHueco){
      h.innerHTML = '<div class="tc-vacio">No se pudo mostrar: '+(errHueco&&errHueco.message?errHueco.message:String(errHueco))+'</div>';
      console.warn('Error al pintar hueco de compañeros:', errHueco);
    }
  });
}

// NUEVO — total de minutos del día (ida y/o vuelta + tramos de
// continuidad + escalas + hueco entre ida y vuelta si hay ambas). Se
// usa para mostrar "⏱ TOTAL DEL DÍA" arriba del resumen. Acepta qué
// lado incluir (para pernocta, donde cada día del calendario solo
// muestra un lado del mismo registro — si no se filtrara, el día 1
// de una pernocta sumaría también las horas de la vuelta del día 2,
// que es de otro día).
function calcularTotalDiaMin(t, incluirIda, incluirVuelta){
  if(incluirIda===undefined) incluirIda=true;
  if(incluirVuelta===undefined) incluirVuelta=true;
  var total = 0;
  var tieneIda = incluirIda && t.hF && t.hL;
  var tieneVuelta = incluirVuelta && t.hF2 && t.hL2;
  var tieneContinuidad = !!(incluirIda && t.continuidad && t.continuidad.length);

  if(tieneIda) total += calcMins(t.hF, t.hL);
  if(tieneVuelta) total += calcMins(t.hF2, t.hL2);

  // FIX — el hueco "directo" entre IDA y VUELTA (t.hL → t.hF2) solo
  // tiene sentido cuando NO hay tramos de continuidad entre medio.
  // Si los hay (como un CONT.2), ese mismo intervalo de tiempo YA
  // queda representado por la duración + escala de cada tramo de
  // continuidad (más abajo) — sumar también el hueco completo aquí
  // duplicaba por entero esas horas. Esto es lo que producía totales
  // imposibles de más de 24h en un solo día.
  if(tieneIda && tieneVuelta && !tieneContinuidad){
    var hueco = calcMins(t.hL, t.hF2);
    if(hueco>0) total += hueco;
  }

  if(tieneContinuidad){
    var horaFinUltimoTramo = t.hL; // arranca justo al final de la IDA
    t.continuidad.forEach(function(c){
      if(c.horaInicio && c.horaFin){
        total += calcMins(c.horaInicio, c.horaFin);
        horaFinUltimoTramo = c.horaFin;
      }
      if(c.escalaMin!=null && c.escalaMin>0) total += c.escalaMin;
    });
    // FIX — el hueco entre el ÚLTIMO tramo de continuidad y la VUELTA
    // (si la hay) antes no se contaba en ningún sitio. Ahora se suma
    // solo ESTE tramo final del hueco, no el hueco completo desde la
    // IDA como hacía antes.
    if(tieneVuelta && horaFinUltimoTramo){
      var huecoFinal = calcMins(horaFinUltimoTramo, t.hF2);
      if(huecoFinal>0) total += huecoFinal;
    }
  }

  if(incluirVuelta && t.continuidadVuelta && t.continuidadVuelta.length){
    t.continuidadVuelta.forEach(function(c){
      if(c.horaInicio && c.horaFin) total += calcMins(c.horaInicio, c.horaFin);
      if(c.escalaMin!=null && c.escalaMin>0) total += c.escalaMin;
    });
  }
  return total;
}

/* ═══════════════════════════════════════════════════════════
   ESCALA ENTRE SERVICIOS — función nueva e independiente.
   Calcula los minutos de espera entre el cierre (CO) de un
   tren/turno y el inicio (CI) del siguiente. Reutiliza
   calcMins() ya existente, sin modificarla. Aplica tanto entre
   tramos de una misma pernocta (Tren 1→2, Tren 2→3) como entre
   dos turnos distintos del mismo día.
   Devuelve {min: minutos, txt: "Xh Ym"} o null si faltan datos.
═══════════════════════════════════════════════════════════ */
function calcularEscala(horaFinAnterior, horaInicioSiguiente){
  if(!horaFinAnterior || !horaInicioSiguiente) return null;
  var min = calcMins(horaFinAnterior, horaInicioSiguiente);
  return {
    min: min,
    txt: Math.floor(min/60)+'h '+pad(min%60)+'m'
  };
}

// Calcula importe completo de un turno (horas × tarifa + pluses activos)
function calcImp(horas,hF,hL,linea,plusAct,plusJT,plusIntlAuto){
  var vh  = parseFloat(AJ.vh)||12.5;
  var noc = parseFloat(AJ.nocturnidad)||0;
  var p   = AJ.pluses[AJ.rol]||PLUS_DEF[AJ.rol];
  var hayNoc = hF ? esHoraNocturna(hF)||(hL?esHoraNocturna(hL):false) : false;
  var tasa   = vh+(hayNoc?noc:0);
  var pA = plusAct      ? parseFloat(p.activacion||0)   : 0;
  var pJ = plusJT       ? parseFloat(p.jt||0)           : 0;
  var pI = plusIntlAuto ? parseFloat(p.internacional||0) : 0;
  return Math.round((horas*tasa+pA+pJ+pI)*100)/100;
}

// NUEVO — recalcula EN VIVO el importe de Art.51/52 (rama 'dinero' o
// 'mix'), con la tarifa/base/pluses ACTUALES de Ajustes, a partir de
// las horas ya guardadas (esas sí son un hecho fijo). Mismo criterio
// que ya usan calculateEarnings() y mostrarDetalleArt5152() — este
// helper solo lo centraliza para reutilizarlo también en las vistas
// resumidas (popup de día y acordeón "Turnos del mes") que hasta
// ahora mostraban el € congelado del momento de guardar. No toca
// ningún dato guardado, solo cambia de dónde saca el número a MOSTRAR.
function calcImporteArt5152Vivo(t, esMix){
  if(!t || t.tipo!=='art5152') return 0;
  var monto = parseFloat(AJ.art5152Monto)||0;
  var base  = parseFloat(AJ.art5152ValorBase)||0;
  var horas = esMix ? ((t.mixDinero&&t.mixDinero.horas)||0) : (t.horasEfectivas||0);
  var p     = AJ.pluses[AJ.rol]||PLUS_DEF[AJ.rol];
  var pAct  = t.plusAct      ? parseFloat(p.activacion||0)    : 0;
  var pJT   = t.plusJT       ? parseFloat(p.jt||0)            : 0;
  var pIntl = t.plusIntlAuto ? parseFloat(p.internacional||0) : 0;
  return Math.round((horas*monto+base+pAct+pJT+pIntl)*100)/100;
}

function esHoraNocturna(h){var hr=parseInt(h.split(':')[0]);return hr>=22||hr<6;}

// Detecta si un turno es "Parking": firma (CI) antes de las 06:00,
// o llegada final (CO) después de las 23:30. Usa el mismo patrón de
// comparación segura por horas/minutos que esHoraNocturna, sin tocarla.
// Solo lectura — no modifica ningún dato del turno.
function esTurnoParking(t){
  if(!t) return false;
  var ci = t.hF;                    // hora de firma (CI)
  var co = t.hL2 || t.hL;           // llegada final: si hay vuelta (hL2), esa es la real
  var esParkingCI = false, esParkingCO = false;
  if(ci){
    var p = ci.split(':').map(Number);
    esParkingCI = (p[0] < 6);                          // antes de las 06:00
  }
  if(co){
    var p2 = co.split(':').map(Number);
    esParkingCO = (p2[0] > 23) || (p2[0]===23 && p2[1] >= 30);  // después de las 23:30
  }
  return esParkingCI || esParkingCO;
}
function limiteHoras(sal){return AJ.base&&sal===AJ.base?12:8;}
function saveTV(){localStorage.setItem('tv5',JSON.stringify(TV));}
function openOv(id){
  var el = document.getElementById(id);
  if(!el) return;
  // FIX — Confirmado por Alex (bug real, detectado en producción): si
  // este overlay tenía pendiente un cierre con animación (ver
  // closeOv(), 140ms de retraso), cancelarlo aquí — abrirlo de nuevo
  // significa que hay algo nuevo que mostrar, y el cierre retrasado de
  // la vez anterior no debe llegar a quitarle la clase 'on' a esto.
  el.classList.remove('closing');
  el.classList.add('on');
}
// Cierre del formulario de turno — limpia las banderas de edición de
// turnos adicionales (TV2) para que un cierre a medias nunca deje el
// siguiente turno que se guarde apuntando por error al array TV2.
function cerrarFormTurno(){
  _tv2_guardando = false;
  _tv2_editando_idx = null;
  closeOv('ov-form');
}
function closeOv(id){
  var el=document.getElementById(id);
  if(!el||!el.classList.contains('on')) return;
  el.classList.add('closing');
  setTimeout(function(){
    // FIX — Confirmado por Alex (bug real, detectado en producción):
    // si mientras tanto se volvió a abrir este mismo overlay
    // (openOv() ya quitó 'closing' al reabrir), este cierre retrasado
    // ya no tiene nada que ver con lo que hay en pantalla ahora mismo
    // — no se toca nada, para no cerrar por error algo que se acaba
    // de mostrar de verdad (ej. el siguiente conflicto al cargar un
    // PDF con varios días ya guardados).
    if(!el.classList.contains('closing')) return;
    el.classList.remove('on');
    el.classList.remove('closing');
  },140);
}
function goP(n){
  ['cal','horario','stats','ajustes','companeros','nomina'].forEach(function(p){
    var elPanel = document.getElementById(p==='companeros' ? 'p-companeros' : 'p-'+p);
    var elNav = document.getElementById('nav-'+p);
    if(elPanel) elPanel.className='panel'+(p===n?' on':'');
    if(elNav) elNav.className='bni'+(p===n?' on':'');
  });
  var ap=document.getElementById(n==='companeros' ? 'p-companeros' : 'p-'+n);
  if(ap){ap.classList.remove('anim-in');void ap.offsetWidth;ap.classList.add('anim-in');}
  // SINCRONIZACIÓN: al entrar en Stats, alinear su mes con el del calendario
  if(n==='stats'){
    statsM=new Date(curM.getFullYear(), curM.getMonth(), 1);
    renderStats();
  }
  if(n==='ajustes')loadAjUI();
  // NUEVO — Nómina pública: al entrar, se pinta con el mes actual (si
  // es la primera vez) y se comprueba el aviso legal de "esto no es
  // una nómina real", que solo debe aparecer una vez al día.
  if(n==='nomina'){
    if(!nomM) nomM = new Date(curM.getFullYear(), curM.getMonth(), 1);
    renderNominaPublica();
    mostrarAvisoNominaSiCorresponde();
  }
  // NUEVO — Confirmado por Alex: el Social Bar (Adsterra) solo debe
  // aparecer en Ajustes, no en toda la app. Se carga al ENTRAR en
  // Ajustes, y se retira (elimina del DOM) al SALIR — el propio
  // script de Adsterra no sabe distinguir pantallas por sí solo, así
  // que ese control lo hace este mismo goP().
  if(n==='ajustes'){
    if(typeof cargarSocialBarSiConsentido==='function') cargarSocialBarSiConsentido();
  } else {
    if(typeof quitarSocialBar==='function') quitarSocialBar();
  }
  // NUEVO — refresca la píldora ✅ Check-in (visible/oculta según rol,
  // y en azul si ya hay check-in subido hoy) cada vez que se entra en
  // Calendario, para que nunca quede desactualizada de una sesión a otra.
  if(n==='cal' && typeof mostrarPillCheckinSiCorresponde==='function') mostrarPillCheckinSiCorresponde();
  // NUEVO — al entrar en Calendario, refresca las Notificaciones del
  // Admin (banner arriba del todo) por si hay algo nuevo publicado
  // desde la última vez. Mismo patrón defensivo que el check-in de
  // justo arriba: no rompe nada si la función aún no existe.
  if(n==='cal' && typeof refrescarNotificacionesActivas==='function') refrescarNotificacionesActivas();
  // NUEVO — Confirmado por el usuario: al entrar en Calendario, sube
  // en silencio el detalle de tus turnos a la nube (para "Solicitar
  // cambio de turno") — solo LEE de TV/TV2, nunca escribe en ellos.
  if(n==='cal' && typeof sincronizarTurnosDetalle==='function') sincronizarTurnosDetalle();
  // NUEVO — Confirmado por el usuario: carga las solicitudes de
  // cambio de turno (y pinta el banner si hay algo) nada más entrar
  // en Calendario, sin esperar a que se despliegue la sección.
  if(n==='cal' && typeof cargarCambiosTurno==='function') cargarCambiosTurno();
  // NUEVO — Confirmado por el usuario: mismo momento de carga que
  // "Nueva solicitud de cambio", para las notificaciones de
  // "Publicar un cambio" (ofertas nuevas / ofertas mías aceptadas).
  if(n==='cal' && typeof cargarNotificacionesPublicaciones==='function') cargarNotificacionesPublicaciones();
  // NUEVO: refrescar la lista individual de meses al entrar en Horario
  if(n==='horario' && typeof renderMonthListIndividual==='function') renderMonthListIndividual();
  // NUEVO — al entrar en la pestaña Compañeros, dispara la misma
  // comprobación/carga que antes hacía el botón dentro de Horario
  // (matrícula ya validada → entra directo; si no, pide matrícula+
  // descargo la primera vez). No repite la carga si ya está activa.
  if(n==='companeros' && typeof abrirAccesoBuscadorCompaneros==='function') abrirAccesoBuscadorCompaneros();
}
function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('on');setTimeout(function(){t.classList.remove('on');},2500);}
