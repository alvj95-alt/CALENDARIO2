/* TrenTurnos v5 — Módulo DH y "solo ida"
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   MÓDULO DH + SOLO IDA — completamente aditivo.
   Añade el botón DH junto al número de tren y el switch
   "Solo Ida" sobre el bloque de vuelta. El popup pregunta
   hasta qué estación se trabaja en servicio DH.
   Datos en F.estadoServicio / F.estadoServicioVuelta
   (ya definidos en sesión anterior, guardados en TV[k]).
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   determinarTramoDH(t, campo) — lógica de posición del DH.
   Lee el detalle guardado en estadoServicioDetalle /
   estadoServicioVueltaDetalle y determina si el DH ocurre
   en el primer tramo o en el segundo.

   Regla:
     · Si 'desde' está vacío o coincide con la Base → DH desde
       el inicio → 'primerTramo'  →  visualización: DH-XXXX / XXXX
     · Si 'desde' tiene contenido distinto a la Base → el usuario
       trabaja hasta esa estación y luego hace DH → 'segundoTramo'
       →  visualización: XXXX / XXXX-DH

   @param detalle  string — valor de estadoServicioDetalle,
                   formato: "hasta X" o "hasta X · desde Y"
   @param base     string — AJ.base del usuario
   @returns 'primerTramo' | 'segundoTramo'
═══════════════════════════════════════════════════════════ */
function determinarTramoDH(detalle, base){
  if(!detalle) return 'primerTramo';
  // Extraer la parte "desde Y" si existe
  var partes = detalle.split(' · desde ');
  var desde  = partes.length > 1 ? partes[1].trim() : '';
  return _esEstacionBase(desde, base) ? 'primerTramo' : 'segundoTramo';
}

// Normaliza un nombre de estación para comparar (minúsculas, sin tildes).
// Única función de comparación de estaciones — evita recalcular la misma
// normalización en distintos puntos del código (DH del calendario, pop-up).
function _normalizarEstacion(s){
  return (s||'').toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').trim();
}
// Vacío o igual a la Base → true (la estación ES la Base).
function _esEstacionBase(estacion, base){
  var e = _normalizarEstacion(estacion);
  if(!e) return true;
  return e === _normalizarEstacion(base||AJ.base||'');
}

/* ═══════════════════════════════════════════════════════════
   INFO DH DE UN TRAMO — única función que decide QUÉ pintar.
   La usan tanto renderizarPopUpSimplificado() como renderPanelHoy()
   para no recalcular la misma lógica dos veces. Cada función de
   render solo decide el HTML/estilo; el dato sale de aquí.
   Devuelve null si el tramo no es DH.
═══════════════════════════════════════════════════════════ */
function obtenerInfoDHTramo(t, campo){
  var esDH = campo==='ida' ? (t.estadoServicio==='dh') : (t.estadoServicioVuelta==='dh');
  if(!esDH) return null;
  var trenServicio = campo==='ida' ? (t.numTren||'') : (t.numTrenVuelta||'');
  var mismoTren = campo==='ida' ? t.dhMismoTren : t.dhMismoTrenVuelta;
  var trenDH = campo==='ida' ? (t.dhTrenDH||trenServicio) : (t.dhTrenDHVuelta||trenServicio);
  var detalle = campo==='ida' ? t.estadoServicioDetalle : t.estadoServicioVueltaDetalle;
  return {
    mismoTren: (mismoTren !== false), // por defecto true (compatibilidad con datos previos)
    trenServicio: trenServicio,
    trenDH: trenDH,
    origenEsBase: determinarTramoDH(detalle, AJ.base) === 'primerTramo'
  };
} // true | false | null (sin responder)
// Hora de toma/firma del tramo que se está registrando — es la
// referencia real de "cuándo entras de servicio" ya guardada en el
// formulario, sin pedirle nada nuevo al usuario.
function _horaFirmaTramoDH(tramo){
  return tramo==='ida' ? (F.hF||'') : (F.hF2||'');
}
function _restarMinutosHora(hora, minutos){
  var m=_horasToMin(hora);
  if(m==null) return '';
  m-=minutos; if(m<0) m+=1440;
  return _minToHoras(m);
}
// Origen del DH inferido directamente del campo "¿A partir de qué
// estación?" — sin botones: vacío o igual a la Base → 'base';
// cualquier otro texto → 'otra'. Reutiliza _esEstacionBase(), la
// misma comparación que ya usa determinarTramoDH() para el calendario.
function _origenActualDH(){
  var desdeEl = document.getElementById('dh-desde');
  var desde = desdeEl ? desdeEl.value.trim() : '';
  return _esEstacionBase(desde, AJ.base) ? 'base' : 'otra';
}

function abrirDHPopup(tramo){
  _dhTramo = tramo;
  var num = tramo==='ida' ? (F.numTren||'') : (F.numTrenVuelta||'');
  var label = tramo==='ida' ? 'Ida' : 'Vuelta';
  var titEl = document.getElementById('dh-popup-tit');
  if(titEl) titEl.textContent = 'Servicio DH — Tren '+label+(num?' #'+num:'');
  // Precargar con el detalle ya guardado, si existe
  var prevDetalle = tramo==='ida'
    ? (F.estadoServicioDetalle||'')
    : (F.estadoServicioVueltaDetalle||'');
  var parts = prevDetalle ? prevDetalle.split(' · desde ') : ['',''];
  var hastaEl = document.getElementById('dh-hasta');
  var desdeEl = document.getElementById('dh-desde');
  if(hastaEl) hastaEl.value = parts[0].replace('hasta ','') || '';
  if(desdeEl) desdeEl.value = parts[1] || '';

  // Precargar mismo tren / tren DH / tren servicio, si ya se habían respondido
  var dhMismoTren     = tramo==='ida' ? F.dhMismoTren       : F.dhMismoTrenVuelta;
  var dhTrenDH        = tramo==='ida' ? (F.dhTrenDH||'')    : (F.dhTrenDHVuelta||'');
  _dhMismoTren = (typeof dhMismoTren==='boolean') ? dhMismoTren : null;
  var trenEl = document.getElementById('dh-tren');
  var trenServEl = document.getElementById('dh-tren-servicio');
  if(trenEl) trenEl.value = (_dhMismoTren===false) ? dhTrenDH : '';
  if(trenServEl) trenServEl.value = num;
  _pintarSeleccionMismoTrenDHCal();
  _actualizarVisibilidadTrenDH();

  // Precargar horario, si ya se había respondido
  var dhHoraFin    = tramo==='ida' ? F.dhHoraFin    : F.dhHoraFinVuelta;
  var dhHoraInicio = tramo==='ida' ? F.dhHoraInicio : F.dhHoraInicioVuelta;
  var finEl = document.getElementById('dh-hora-fin');
  var iniEl = document.getElementById('dh-hora-inicio');
  // Hora Fin DH: si ya existe, se respeta; si no, se sugiere la hora
  // de toma del tramo como salida del tren de servicio detectada.
  if(finEl) finEl.value = dhHoraFin || _horaFirmaTramoDH(tramo);
  if(iniEl) iniEl.value = dhHoraInicio || '';
  if(!dhHoraInicio) _autocalcularHoraInicioDH(); else _actualizarDuracionPreviewDH();

  openOv('ov-dh');
  setTimeout(function(){ if(hastaEl) hastaEl.focus(); }, 350);
}

function seleccionarMismoTrenDHCal(esMismo){
  _dhMismoTren = esMismo;
  _pintarSeleccionMismoTrenDHCal();
  _actualizarVisibilidadTrenDH();
}

function _pintarSeleccionMismoTrenDHCal(){
  var btnMismo = document.getElementById('dh-btn-mismo');
  var btnDif   = document.getElementById('dh-btn-dif');
  if(!btnMismo || !btnDif) return;
  var activo = function(el){
    el.style.background='rgba(245,158,11,.15)';
    el.style.borderColor='var(--amber2)';
    el.style.color='var(--amber2)';
  };
  var inactivo = function(el){
    el.style.background='var(--s2)';
    el.style.borderColor='var(--div)';
    el.style.color='var(--tx2)';
  };
  if(_dhMismoTren===true){ activo(btnMismo); inactivo(btnDif); }
  else if(_dhMismoTren===false){ activo(btnDif); inactivo(btnMismo); }
  else { inactivo(btnMismo); inactivo(btnDif); }
}

// Muestra el bloque correcto según mismo/diferente tren:
//  · Mismo tren → solo informativo, se reutiliza el tren de servicio.
//  · Tren diferente → dos campos independientes (nunca se duplica un
//    único número: Tren DH y Tren Servicio son datos distintos).
function _actualizarVisibilidadTrenDH(){
  var infoMismo = document.getElementById('dh-tren-mismo-info');
  var camposDif = document.getElementById('dh-tren-dif-fields');
  var numMismo  = document.getElementById('dh-tren-mismo-num');
  if(!infoMismo || !camposDif) return;
  var num = _dhTramo==='ida' ? (F.numTren||'—') : (F.numTrenVuelta||'—');
  if(numMismo) numMismo.textContent = '#'+num;
  if(_dhMismoTren===false){
    infoMismo.style.display='none';
    camposDif.style.display='block';
  } else {
    infoMismo.style.display='block';
    camposDif.style.display='none';
  }
}

function _autocalcularHoraInicioDH(){
  var iniEl = document.getElementById('dh-hora-inicio');
  var finEl = document.getElementById('dh-hora-fin');
  if(!iniEl) return;
  if(_origenActualDH()==='base'){
    iniEl.value = _horaFirmaTramoDH(_dhTramo);
  } else {
    var fin = finEl ? finEl.value.trim() : '';
    iniEl.value = fin ? _restarMinutosHora(fin, 45) : '';
  }
  _actualizarDuracionPreviewDH();
}

function _actualizarDuracionPreviewDH(){
  var prev = document.getElementById('dh-duracion-preview');
  if(!prev) return;
  var ini = document.getElementById('dh-hora-inicio').value.trim();
  var fin = document.getElementById('dh-hora-fin').value.trim();
  if(!ini || !fin){ prev.textContent=''; return; }
  var m = calcMins(ini, fin);
  var origenTxt = _origenActualDH()==='base' ? 'desde la Base' : 'desde otra estación';
  prev.textContent = 'Duración calculada ('+origenTxt+'): '+m+' min → Horas de Presencia';
}

function _marcarCampoDHCalInvalido(el){
  if(el){
    el.style.borderColor='#ef4444';
    setTimeout(function(){ el.style.borderColor='var(--div)'; }, 1500);
  }
}

function cancelarDH(){
  // Si el usuario cancela sin haber confirmado antes, revertir estado
  if(_dhTramo==='ida' && F.estadoServicio==='dh' && !F.estadoServicioDetalle){
    F.estadoServicio='ordinario';
    _actualizarBtnDH('ida', false);
  }
  if(_dhTramo==='vuelta' && F.estadoServicioVuelta==='dh' && !F.estadoServicioVueltaDetalle){
    F.estadoServicioVuelta='ordinario';
    _actualizarBtnDH('vuelta', false);
  }
  _dhMismoTren = null;
  closeOv('ov-dh');
}

function confirmarDH(){
  var hastaEl = document.getElementById('dh-hasta');
  var hasta = hastaEl ? hastaEl.value.trim() : '';
  if(!hasta){
    if(hastaEl){
      hastaEl.style.borderColor='#ef4444';
      hastaEl.placeholder='⚠️ Campo obligatorio';
      setTimeout(function(){
        hastaEl.style.borderColor='var(--amber2)';
        hastaEl.placeholder='Ej: Zaragoza Delicias';
      }, 1500);
    }
    return;
  }
  // Validación obligatoria: mismo/diferente tren y los horarios de
  // los que se deriva la duración. El origen se infiere del campo
  // "desde" — no hace falta validarlo por separado.
  if(_dhMismoTren !== true && _dhMismoTren !== false){
    var btnMismo = document.getElementById('dh-btn-mismo');
    if(btnMismo) _marcarCampoDHCalInvalido(btnMismo);
    return;
  }

  var tramo = _dhTramo;
  var trenDH, trenServicio;
  if(_dhMismoTren === false){
    // Tren diferente: dos campos independientes, ninguno se duplica.
    var trenEl = document.getElementById('dh-tren');
    var trenServEl = document.getElementById('dh-tren-servicio');
    trenDH = trenEl ? trenEl.value.trim() : '';
    trenServicio = trenServEl ? trenServEl.value.trim() : '';
    if(!trenDH){ _marcarCampoDHCalInvalido(trenEl); return; }
    if(!trenServicio){ _marcarCampoDHCalInvalido(trenServEl); return; }
    // El tren de servicio vive en el formulario principal — se sincroniza
    // aquí mismo para que nunca queden dos valores distintos ("fantasma").
    if(tramo==='ida') F.numTren = trenServicio; else F.numTrenVuelta = trenServicio;
  } else {
    // Mismo tren: se reutiliza el tren de servicio ya introducido.
    trenServicio = tramo==='ida' ? (F.numTren||'') : (F.numTrenVuelta||'');
    trenDH = trenServicio;
  }

  var finEl = document.getElementById('dh-hora-fin');
  var iniEl = document.getElementById('dh-hora-inicio');
  var horaFin = finEl ? finEl.value.trim() : '';
  var horaInicio = iniEl ? iniEl.value.trim() : '';
  var horaValida = /^\d{1,2}:\d{2}$/;
  if(!horaValida.test(horaFin)){ _marcarCampoDHCalInvalido(finEl); return; }
  if(!horaValida.test(horaInicio)){ _marcarCampoDHCalInvalido(iniEl); return; }
  var minutos = calcMins(horaInicio, horaFin);
  var origen = _origenActualDH();

  var desdeEl = document.getElementById('dh-desde');
  var desde = desdeEl ? desdeEl.value.trim() : '';
  var detalle = 'hasta '+hasta+(desde?' · desde '+desde:'');
  if(tramo==='ida'){
    F.estadoServicio='dh';
    F.estadoServicioDetalle=detalle;
    F.dhMismoTren=_dhMismoTren;
    F.dhTrenDH=trenDH;
    F.dhOrigen=origen;
    F.dhHoraInicio=horaInicio;
    F.dhHoraFin=horaFin;
    F.dhMinutos=minutos;
  } else {
    F.estadoServicioVuelta='dh';
    F.estadoServicioVueltaDetalle=detalle;
    F.dhMismoTrenVuelta=_dhMismoTren;
    F.dhTrenDHVuelta=trenDH;
    F.dhOrigenVuelta=origen;
    F.dhHoraInicioVuelta=horaInicio;
    F.dhHoraFinVuelta=horaFin;
    F.dhMinutosVuelta=minutos;
  }
  _actualizarBtnDH(tramo, true, detalle);
  renderFormBody();
  closeOv('ov-dh');
  toast('✓ DH — '+detalle+' · '+minutos+' min a Presencia');
}

function _actualizarBtnDH(tramo, activo, detalle){
  var btn = document.getElementById('dh-'+tramo+'-btn');
  var badge = document.getElementById('dh-'+tramo+'-badge');
  if(btn){
    if(activo){
      btn.style.background='rgba(245,158,11,.18)';
      btn.style.borderColor='var(--amber2)';
      btn.style.color='var(--amber2)';
      btn.textContent='🔀 DH activo';
    } else {
      btn.style.background='var(--s2)';
      btn.style.borderColor='var(--div)';
      btn.style.color='var(--tx3)';
      btn.textContent='🔀 Marcar DH';
    }
  }
  if(badge){
    if(activo && detalle){
      badge.textContent='📍 '+detalle;
      badge.style.display='block';
      badge.style.marginTop='6px';
    } else {
      badge.style.display='none';
    }
  }
}

function toggleSoloIda(){
  _soloIda = !_soloIda;
  _aplicarSoloIda();
  toast(_soloIda ? 'Solo Ida activado 🔒' : 'Vuelta reactivada ↩');
}

function _aplicarSoloIda(){
  var sw    = document.getElementById('solo-ida-sw');
  var knob  = document.getElementById('solo-ida-knob');
  var lbl   = document.getElementById('solo-ida-lbl');
  // ID específico para máxima fiabilidad — cubre numtren-vuelta-wrap y dh-vuelta-wrap juntos
  var contenedorVuelta = document.getElementById('contenedor-vuelta');
  if(_soloIda){
    if(sw)   sw.style.background='var(--nar)';
    if(knob){ knob.style.left='18px'; knob.style.background='#fff'; }
    if(lbl){ lbl.textContent='Solo Ida ●'; lbl.style.color='var(--nar)'; }
    if(contenedorVuelta) contenedorVuelta.style.display='none';
    F.modo = null;
  } else {
    if(sw)   sw.style.background='var(--div)';
    if(knob){ knob.style.left='2px'; knob.style.background='var(--tx3)'; }
    if(lbl){ lbl.textContent='Solo Ida'; lbl.style.color='var(--tx3)'; }
    if(contenedorVuelta) contenedorVuelta.style.display='';
    F.modo = F.modo || 'ida';
  }
}
