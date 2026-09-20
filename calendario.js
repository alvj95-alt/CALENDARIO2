/* TrenTurnos v5 — Calendario: render de mes, swipe, clic en día, hoy
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function initSwipe(){
  var sw=document.getElementById('cal-swipe');if(!sw)return;
  var sx=0,sy=0,drag=false,vert=false,dx=0;
  sw.addEventListener('touchstart',function(e){var tc=e.touches[0];sx=tc.clientX;sy=tc.clientY;drag=false;vert=false;dx=0;},{passive:true});
  sw.addEventListener('touchmove',function(e){
    if(vert)return;var tc=e.touches[0];var dxv=tc.clientX-sx,dyv=tc.clientY-sy;
    if(!drag&&Math.abs(dxv)<8&&Math.abs(dyv)<8)return;
    if(!drag){if(Math.abs(dyv)>Math.abs(dxv)){vert=true;return;}drag=true;}
    dx=dxv;
  },{passive:true});
  sw.addEventListener('touchend',function(e){
    if(!drag)return;var dxv=e.changedTouches[0].clientX-sx,dyv=e.changedTouches[0].clientY-sy;
    if(Math.abs(dxv)>45&&Math.abs(dxv)>Math.abs(dyv)*1.5){if(dxv<0)animSwipe(1);else animSwipe(-1);}
    drag=false;vert=false;
  },{passive:true});
}

function animSwipe(dir){
  // FIX ESTRUCTURAL: arquitectura simplificada a UN solo grid visible.
  // Antes: 3 slides (anterior/actual/siguiente) coexistían siempre en
  // el DOM, desplazados con transform. Esto exponía al WebView de
  // algunos dispositivos a un bug de renderizado donde columnas de
  // un mes adyacente se filtraban visualmente junto al mes actual.
  // Ahora: solo existe el grid #days. Al cambiar de mes, se aplica
  // una transición de opacidad simple y se reconstruye el contenido
  // una sola vez — nunca hay dos meses presentes simultáneamente.
  if(_swipeEnCurso) return;
  _swipeEnCurso = true;

  var grid=document.getElementById('days');
  grid.style.transition='opacity .14s ease';
  grid.style.opacity='0';

  setTimeout(function(){
    curM.setMonth(curM.getMonth()+dir);
    selDay=null;
    renderCal();
    grid.style.opacity='1';
    _swipeEnCurso = false;
  },140);
}

function _keyAFechaLbl(k){
  if(!k) return '';
  var _km1=k.split('-').map(Number);var y=_km1[0],m=_km1[1],d=_km1[2];
  return d+' '+MESES_C[m-1];
}

function renderCal(){
  var y=curM.getFullYear(),m=curM.getMonth();
  document.getElementById('mn-lbl').textContent=MESES[m]+' '+y;
  document.getElementById('mn-sub').textContent=y;

  // NUEVO — píldora de Check-in del día: visible para todo el mundo
  // en cuanto hay Estación Base configurada (si no, no tendría sede
  // con la que consultar/subir el check-in).
  var pillCi = document.getElementById('btn-ci-pill');
  if(pillCi) pillCi.style.display = (typeof AJ!=='undefined' && AJ.base) ? '' : 'none';

  // OPTIMIZACIÓN: sincronizar TV con localStorage UNA sola vez aquí,
  // en vez de 3 veces (una por cada renderSlide). Mismo resultado,
  // 1/3 del coste de lectura+parse de JSON.
  var TVlocal = _leerJSONseguro('tv5', {});
  var keysLocal = Object.keys(TVlocal);
  for(var ki=0; ki<keysLocal.length; ki++){
    TV[keysLocal[ki]] = TVlocal[keysLocal[ki]];
  }

  // Recalcular alertas de descanso para el mes visible
  ALERTAS_DESCANSO = verificarDescansosMes();

  // FIX ESTRUCTURAL: ahora solo se renderiza el grid visible (#days).
  // days-prev y days-next ya no se usan — se deja de invocarlos para
  // no hacer trabajo innecesario, sin eliminar esos elementos del HTML.
  renderSlide('days', new Date(y,m,1));

  // Dots indicadores de mes (últimos 3 meses)
  var dots=document.getElementById('cal-dots');
  if(dots){
    dots.innerHTML=[-1,0,1].map(function(i){
      return '<div style="width:'+(i===0?16:5)+'px;height:5px;border-radius:3px;background:'+(i===0?'var(--acc)':'var(--div)')+';transition:all .2s"></div>';
    }).join('');
  }

  renderAcordeon();
  renderVistaToggle();
  renderPanelHoy();
  renderHoyResumen();
}

function renderSlide(gridId, fecha){
  var grid=document.getElementById(gridId);
  if(!grid) return;
  var y=fecha.getFullYear(), m=fecha.getMonth();
  var last=new Date(y,m+1,0).getDate();
  var sd=new Date(y,m,1).getDay(); sd=sd===0?6:sd-1;
  var hoy=new Date();

  // REVERTIDO: el cálculo dinámico de grid-template-rows vía JS causaba
  // un glitch de desalineación de columnas en algunos WebView de Android
  // (no reproducible en Chromium estándar, pero confirmado visualmente
  // por el usuario). Se vuelve al valor fijo de 6 filas definido en CSS
  // (.days{grid-template-rows:repeat(6,1fr)}), que es más compatible
  // universalmente. La fila vacía extra en meses de 5 filas es un
  // costo estético menor frente a la columna desalineada, que es un
  // bug funcional real.

  // OPTIMIZACIÓN: la sincronización con localStorage ahora se hace UNA
  // sola vez en renderCal() (antes de llamar a los 3 slides), no aquí.
  // Esto evita parsear el mismo JSON 3 veces por cada renderCal().

  // OPTIMIZACIÓN: construir todas las celdas en un DocumentFragment
  // (memoria) y hacer un único appendChild al final, en vez de 31+
  // inserciones individuales que fuerzan reflow del navegador en cada una.
  var frag = document.createDocumentFragment();

  for(var i=0;i<sd;i++){
    var c0=document.createElement('div');c0.className='dc dc-0';frag.appendChild(c0);
  }
  for(var d=1;d<=last;d++){
    var k=key(y,m+1,d);
    var t=TV[k];
    var isH=y===hoy.getFullYear()&&m===hoy.getMonth()&&d===hoy.getDate();
    var isS=selDay&&selDay.k===k;
    var tieneAlerta=ALERTAS_DESCANSO[k];
    var cls='dc';
    if(isS) cls+=' dc-sel';
    if(t) cls+=' '+(TIPO_INFO[t.tipo]?TIPO_INFO[t.tipo].cls:'');
    if(isH) cls+=' dc-hoy';
    if(tieneAlerta) cls+=' dc-alerta';
    // Metadatos adicionales en la celda
    if(t&&t.nocturno)   cls+=' dc-noc';
    if(t&&t.plusIntlAuto) cls+=' dc-intl';
    // NUEVO — indicador visual: esta baja pisó/sustituyó un turno ya
    // existente (el turno original se conserva en t.turnoPisado, solo
    // para referencia/desglose — no participa en ningún cálculo).
    if(t&&t.tipo==='baja'&&t.turnoPisado) cls+=' dc-baja-pisada';
    // NUEVO — distingue visualmente una Reserva de Art.51/52 SIN
    // pinchar/verificar todavía, ya que comparte el mismo icono ⚖️
    // que el turno ya desglosado con tramos.
    if(t&&t.tipo==='art5152'&&t.modoArt5152==='reserva') cls+=' dc-art5152-reserva-pendiente';
    var c=document.createElement('div');
    c.className=cls;
    c.dataset.k=k; // NUEVO — permite identificar la celda por fecha desde fuera (vista Compañero/Comparar)
    c.style.position='relative';
    var tieneRetraso2=t&&((t.retrasos&&t.retrasos.length>0)||(t.retrasoMin>0));
    var retBadge=tieneRetraso2?'<span style="position:absolute;top:1px;right:1px;font-size:8px;line-height:1">!</span>':'';
    var tv2Bg=getTV2Badge(k);
    // Icono "Turno Parking" — solo visual, no toca ningún dato del turno.
    var esParking = t && esTurnoParking(t);
    var parkingBadge = esParking
      ? '<span class="dc-parking-ico" '
        +'style="position:absolute;top:1px;left:1px;font-size:8px;line-height:1">🚗</span>'
      : '';
    // Badge DH — indicador visual compacto cuando el turno tiene DH activo en ida o vuelta.
    // Para días derivados (vuelta-pernocta, pernocta3-intermedio), subir al origen.
    var tParaDH = t;
    if(t && (t.tipo==='vuelta-pernocta'||t.tipo==='pernocta3-intermedio') && t.origenPernocta && TV[t.origenPernocta]){
      tParaDH = TV[t.origenPernocta];
    }
    var esDHIda    = tParaDH && tParaDH.estadoServicio === 'dh';
    var esDHVuelta = tParaDH && tParaDH.estadoServicioVuelta === 'dh';
    // ── CORRECCIÓN PERNOCTA ──
    // Cada celda solo muestra el DH de su propio tramo:
    //  · Celda de vuelta (vuelta-pernocta / pernocta3-intermedio) → solo DH vuelta
    //  · Celda de ida en PERNOCTA → solo DH ida (el DH vuelta se ve en su propio día)
    //  · Celda de ida-y-vuelta MISMO DÍA → ambos (DH×2 es correcto aquí)
    var esCeldaVuelta = t && (t.tipo==='vuelta-pernocta'||t.tipo==='pernocta3-intermedio');
    var esPernocta    = tParaDH && (tParaDH.modo==='pernocta'||tParaDH.modo==='pernocta3');
    var mostrarDH, celdaDHIda, celdaDHVta;
    if(esCeldaVuelta){
      celdaDHIda = false;
      celdaDHVta = esDHVuelta;
      mostrarDH  = esDHVuelta;
    } else if(esPernocta){
      celdaDHIda = esDHIda;
      celdaDHVta = false;
      mostrarDH  = esDHIda;
    } else {
      celdaDHIda = esDHIda;
      celdaDHVta = esDHVuelta;
      mostrarDH  = esDHIda || esDHVuelta;
    }

    // ── BADGE DE TREN — siempre visible si hay número ──
    // Para días derivados (vuelta-pernocta, pernocta3-intermedio), el número
    // de tren se lee del PROPIO registro (t.numTren), no del origen.
    // Solo DH sube al origen porque la info de estado DH vive allí.
    var trenBadge = '';

    if(esCeldaVuelta){
      // Celda de día derivado: leer t.numTren propio (guardado al crear la pernocta)
      var nPropio = t.numTren || '';
      if(nPropio){
        var tieneDHPropio = celdaDHVta;
        var textoPropio = nPropio + (tieneDHPropio?' DH':'');
        var bgP = tieneDHPropio ? 'rgba(245,158,11,.85)' : 'rgba(148,163,184,.45)';
        var txP = tieneDHPropio ? '#1a0a00' : '#fff';
        trenBadge = '<span '
          +'style="position:absolute;bottom:1px;left:50%;transform:translateX(-50%);'
          +'font-size:6px;line-height:1;white-space:nowrap;'
          +'background:'+bgP+';color:'+txP+';border-radius:3px;'
          +'padding:1px 3px;font-weight:900;letter-spacing:.2px">'
          +textoPropio+'</span>';
      }
    } else {
      // Celda de día de origen o turno de un solo día
      var tieneTren = tParaDH && (tParaDH.numTren || tParaDH.numTrenVuelta);
      if(tieneTren){
        var nI = tParaDH.numTren||'';
        var nV = tParaDH.numTrenVuelta||'';
        var texto = '';
        var tieneDH = mostrarDH;

        if(nI && nV && !esPernocta){
          texto = nI + (celdaDHIda?' DH':'')
                + ' - '
                + nV + (celdaDHVta?' DH':'');
        } else if(nI){
          texto = nI + (celdaDHIda?' DH':'');
        } else if(nV){
          texto = nV + (celdaDHVta?' DH':'');
        }

        if(texto){
          var bgColor = tieneDH ? 'rgba(245,158,11,.85)' : 'rgba(148,163,184,.45)';
          var txColor = tieneDH ? '#1a0a00' : '#fff';
          trenBadge = '<span '
            +'style="position:absolute;bottom:1px;left:50%;transform:translateX(-50%);'
            +'font-size:6px;line-height:1;white-space:nowrap;'
            +'background:'+bgColor+';color:'+txColor+';border-radius:3px;'
            +'padding:1px 3px;font-weight:900;letter-spacing:.2px">'
            +texto+'</span>';
        }
      }
    }
    // NUEVO — Confirmado por el usuario: aviso visual de "cambio de
    // turno" (morado, arriba de la celda) — puramente informativo,
    // no toca t ni ningún cálculo de esta función.
    var cambioTurnoBadge = (typeof _badgeCambioTurnoParaDia==='function') ? _badgeCambioTurnoParaDia(d) : '';
    c.innerHTML=retBadge+tv2Bg+parkingBadge+trenBadge+cambioTurnoBadge+'<span>'+d+'</span>'+(t&&!isS?'<span class="dc-ico">'+(TIPO_INFO[t.tipo]?TIPO_INFO[t.tipo].ico:'')+'</span>':'')+'<span class="dc-check-borrar">✓</span>';
    // FIX closure: capturar d, k, t correctamente en cada iteración
    // NUEVO — modo selección para borrado múltiple (maqueta A): tap
    // normal sigue abriendo el día como siempre; mantener pulsado
    // ~500ms entra en modo selección (empezando por ese día ya
    // marcado); un tap NORMAL mientras el modo está activo marca o
    // desmarca ese día en vez de abrirlo.
    (function(dd, kk, tt){
      var _pressTimer = null;
      var _yaEntroPorPulsacionLarga = false;
      function _empezarPulsacion(){
        _yaEntroPorPulsacionLarga = false;
        _pressTimer = setTimeout(function(){
          _yaEntroPorPulsacionLarga = true;
          _iniciarSeleccionBorrado(kk, c);
        }, 500);
      }
      function _cancelarPulsacion(){ clearTimeout(_pressTimer); }
      c.addEventListener('touchstart', _empezarPulsacion, {passive:true});
      c.addEventListener('touchend', _cancelarPulsacion);
      c.addEventListener('touchmove', _cancelarPulsacion);
      c.addEventListener('mousedown', _empezarPulsacion);
      c.addEventListener('mouseup', _cancelarPulsacion);
      c.addEventListener('mouseleave', _cancelarPulsacion);
      c.onclick=function(){
        if(_yaEntroPorPulsacionLarga){ _yaEntroPorPulsacionLarga=false; return; } // evita que el propio long-press dispare también un click
        if(_modoSeleccionBorrado){ _toggleSeleccionBorrado(kk, c); return; }
        clickDia(dd, kk, tt);
      };
    })(d, k, t);
    frag.appendChild(c);
  }

  // Una sola operación de DOM: vaciar + insertar todo de golpe
  grid.innerHTML='';
  grid.appendChild(frag);

  // NUEVO — si el modo selección de borrado ya estaba activo antes de
  // este renderizado (ej. un renderCal() en segundo plano mientras la
  // persona tenía días marcados), se reaplican la clase del grid y
  // las marcas de los días ya elegidos, para no perder la selección.
  if(_modoSeleccionBorrado){
    grid.classList.add('modo-seleccion-borrado');
    Object.keys(_diasSeleccionadosBorrar).forEach(function(kSel){
      var celda = grid.querySelector('[data-k="'+kSel+'"]');
      if(celda) celda.classList.add('dc-marcado-borrar');
    });
  }

  // NUEVO — Sistema Horario Compañero: si hay datos de un compañero
  // importados y el modo de vista no es 'mio', añade un overlay con
  // su turno en cada celda de este mes. Puramente aditivo — no toca
  // nada de la construcción de celdas de arriba.
  aplicarVistaCompanero(grid, y, m);
}

function abrirTipoDesdeCard(){
  if(!selDay) return;
  var d=selDay.d, k=selDay.k;
  var mo=parseInt(k.split('-')[1]);
  var dt=new Date(parseInt(k.split('-')[0]),mo-1,d);
  var wd=(dt.getDay()+6)%7;
  document.getElementById('tipo-fecha-lbl').textContent=DIAS_L[wd]+' '+d+' '+MESES_C[mo-1];
  openOv('ov-tipo');
}

/* ═══════════════════════════════════════════════════════════
   buscarTurnoPorFecha — búsqueda contextual de pernoctas.
   Si TV[k] está vacío o es un tipo derivado (vuelta-pernocta,
   pernocta3-intermedio), busca hacia atrás hasta encontrar el
   turno origen completo. Devuelve {k, t} del origen o del
   propio día si es un turno independiente.
   Puramente aditivo — no toca TV ni localStorage.
═══════════════════════════════════════════════════════════ */
function buscarTurnoPorFecha(k){
  var t = TV[k];

  // Caso 1: día con turno propio (cualquier tipo, incluyendo vuelta-pernocta
  // y pernocta3-intermedio). Devolver el registro TAL CUAL del día clicado
  // para que el popup muestre los datos PROPIOS de ese día.
  if(t){
    return {k:k, t:t};
  }

  // Caso 2: día vacío — buscar hacia atrás hasta 3 días
  // para ver si pertenece a una pernocta no registrada explícitamente
  var partes = k.split('-').map(Number);
  var fecha = new Date(partes[0], partes[1]-1, partes[2]);
  for(var dias=1; dias<=3; dias++){
    fecha.setDate(fecha.getDate()-1);
    var kAnterior = key(fecha.getFullYear(), fecha.getMonth()+1, fecha.getDate());
    var tAnterior = TV[kAnterior];
    if(!tAnterior) continue;
    if(tAnterior.tipo === 'ordinario' || tAnterior.tipo === 'trabajado'){
      var modo = tAnterior.modo;
      if(modo === 'pernocta' && dias <= 1) return {k:kAnterior, t:tAnterior};
      if(modo === 'pernocta3' && dias <= 2) return {k:kAnterior, t:tAnterior};
    }
  }

  // Caso 3: día realmente sin turno
  return {k:k, t:null};
}

function clickDia(d,k,t){
  // Segundo toque en el mismo día con turno → editar
  if(selDay && selDay.k===k && t){
    editarTurno();
    return;
  }

  // Buscar el turno real para este día (incluyendo pernoctas)
  var encontrado = buscarTurnoPorFecha(k);
  var tReal = encontrado.t;
  var kReal = encontrado.k;

  // ── PRIORIDAD: Referencia Informativa (Cambio con Compañero) ──
  // Si este día no tiene turno PROPIO (TV[k]/pernocta), pero sí existe
  // un registro informativo en TV2[k] (turno_referencia_externa —
  // el mismo flag que ya excluye estos registros del cálculo de
  // horas; esTurnoIntercambiado se revisa también por compatibilidad
  // con registros antiguos), se prioriza el resumen del día sobre el
  // selector de "Añadir Jornada". Solo se CONSULTA TV2 aquí — no se
  // toca su estructura de guardado.
  var hayTurnoIntercambiado = !tReal && !!(TV2[k] && TV2[k].some(function(r){
    return r.turno_referencia_externa || r.esTurnoIntercambiado;
  }));

  // selDay apunta siempre al día clicado (para la UI)
  // pero t viene del origen real si es una pernocta
  selDay={d:d, k:k, t:tReal};

  // Actualizar colores de celdas (selección visual)
  renderCal();

  if(!tReal && !hayTurnoIntercambiado){
    // Día vacío de verdad (sin turno propio ni referencia informativa) → selector de tipo
    var _km2=k.split('-').map(Number);
    var y=_km2[0],mo=_km2[1];
    var dt=new Date(y,mo-1,d);
    var wd=(dt.getDay()+6)%7;
    document.getElementById('tipo-fecha-lbl').textContent=DIAS_L[wd]+' '+d+' '+MESES_C[mo-1];
    openOv('ov-tipo');
  } else {
    // Día con turno (propio, de pernocta, o solo referencia informativa
    // del compañero) → modal con tarjeta completa. renderDiaArea() ya
    // sabe delegar en renderDiaAreaMulti() cuando hay entradas en TV2,
    // aunque no exista turno propio ese día — no hace falta tocar nada
    // de ese renderizado, ya funciona correctamente.
    openOv('ov-dia-card');
    renderDiaArea();
  }
}

function irHoy(){
  curM=new Date();
  var h=new Date();
  var k=key(h.getFullYear(),h.getMonth()+1,h.getDate());
  selDay={d:h.getDate(),k,t:TV[k]};
  renderCal();
}

function chM(dir){
  animSwipe(dir);
}
