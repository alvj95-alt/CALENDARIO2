/* TrenTurnos v5 — Horario de compañero, TV2 (turnos adicionales) y panel de hoy
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   NUEVO — SISTEMA HORARIO COMPAÑERO (terminado).
   COMP_DATA = {id, name, days:{"1":"turno...", ...}, anio, mes}
   Se importa desde el Buscador de Compañeros (ver
   importarComoCompanero() en el módulo del portal) — reutiliza los
   mismos datos ya extraídos del PDF de Horario General, sin pedir
   ningún archivo nuevo.
═══════════════════════════════════════════════════════════ */

// Pinta el turno del compañero en cada celda del mes que se está
// viendo, SOLO si ese mes/año coincide con el mes que se importó
// (COMP_DATA.anio/mes). Puramente aditivo sobre el grid ya construido
// por renderSlide() — no modifica ninguna clase ni dato existente de
// las celdas, solo añade un elemento visual encima.
function aplicarVistaCompanero(grid, y, m){
  // FIX — antes, al volver a "Mis turnos", la función se salía aquí
  // mismo sin quitar la clase que atenúa la celda — si venías de
  // "Compañero", esa apariencia se quedaba "pegada" aunque ya
  // estuvieras en Mis turnos. Ahora se limpia siempre primero, así
  // Mis turnos vuelve a verse exactamente como antes de esta función.
  grid.classList.remove('cal-modo-comp-solo');
  if(vistaMode==='mio') return;
  if(!COMP_DATA || !COMP_DATA.days || !Object.keys(COMP_DATA.days).length) return;
  // FIX — versión anterior (fijar el mes a mano) se rompía en cuanto
  // cambiaba el PDF. La versión de después (no comprobar nada) traía
  // turnos del compañero a CUALQUIER mes que se mirase, incluso meses
  // donde ese PDF ni siquiera está cargado — el fallo que se acaba de
  // reportar. Ahora se usa el mes/año REAL, leído de la cabecera del
  // propio PDF al importar (COMP_DATA.anio/mes) — solo se pinta si
  // coincide con el mes que se está viendo. Si no se pudo leer el mes
  // del PDF (caso raro), se sigue mostrando como antes, avisando ya
  // en el momento de importar (ver importarComoCompanero).
  if(COMP_DATA.anio!=null && COMP_DATA.mes!=null && (COMP_DATA.anio!==y || COMP_DATA.mes!==m)) return;

  if(vistaMode==='comp') grid.classList.add('cal-modo-comp-solo'); else grid.classList.remove('cal-modo-comp-solo');

  var celdas = grid.querySelectorAll('[data-k]');
  celdas.forEach(function(c){
    var k = c.dataset.k;
    var d = parseInt(k.split('-')[2], 10);
    var texto = COMP_DATA.days[String(d)] || '';
    if(!texto) return;
    var corto = texto.length>9 ? texto.slice(0,8)+'…' : texto;
    var badge = document.createElement('span');
    badge.className = 'dc-comp-badge';
    badge.title = COMP_DATA.name+': '+texto;
    badge.textContent = corto;
    c.appendChild(badge);
  });
}

// Se llama desde el botón "👤 Ver su horario junto al mío" del perfil
// de un compañero en el Buscador. `entry` es la misma tupla que ya
// usa renderProfile(): [id, name, days, sede, ...].
//
// LIMITACIÓN CONOCIDA: el Horario General publicado no incluye el
// año/mes exacto de forma fiable en todos los casos — el resto del
// Buscador (weekdayForDay/buscarInterventor) ya asume "agosto 2026"
// para esta misma tanda de PDFs, así que se usa el mismo supuesto
// aquí para que ambas partes coincidan. Si el mes real cambia, este
// valor habrá que actualizarlo (o, mejor, sacarlo del propio PDF —
// pendiente para una mejora futura, no bloquea esta función).
function importarComoCompanero(id, name, days, horasCI, horasCO, rutaPorDia){
  // NUEVO — se guarda también el mes/año REAL del PDF (leído de su
  // propia cabecera, ej. "AGOSTO 2026" — ver extraerMesAnioPDF), para
  // que el compañero solo se muestre en el mes que de verdad
  // corresponde. Antes esto o se adivinaba a mano (frágil, se rompía
  // si el PDF cambiaba de mes) o no se comprobaba en absoluto (por
  // eso aparecían turnos en meses donde ese PDF ni siquiera estaba
  // cargado — el fallo que se acaba de corregir).
  var mesAnioReal = (typeof BASES!=='undefined' && BASES.global && BASES.global.mesAnio) ? BASES.global.mesAnio : null;
  COMP_DATA = {
    id:id, name:name, days:days,
    horasCI:horasCI||{}, horasCO:horasCO||{}, rutaPorDia:rutaPorDia||{},
    anio: mesAnioReal ? mesAnioReal.anio : null,
    mes: mesAnioReal ? mesAnioReal.mes : null
  };
  saveComp();
  if(!mesAnioReal){
    toast('⚠️ '+name+' importado, pero no se pudo leer el mes del PDF — puede que se muestre en más meses de los que debería.');
  } else {
    toast('👤 '+name+' importado como Compañero — mira el Calendario');
  }
  renderVistaToggle();
  setVistaMode('ambos');
}

function quitarCompanero(){
  COMP_DATA = {};
  saveComp();
  renderVistaToggle();
  setVistaMode('mio');
  toast('Compañero quitado del Calendario');
} // null = turno nuevo · número = índice de TV2[k] que se está editando

function saveTV2(){
  localStorage.setItem('tv2_extra', JSON.stringify(TV2));
}

function getTurnosDia(k){
  var r = [];
  if(TV[k]) r.push(TV[k]);
  if(TV2[k] && TV2[k].length){
    for(var ii=0; ii<TV2[k].length; ii++) r.push(TV2[k][ii]);
  }
  return r;
}

function guardarTurnoExtra(){
  if(!selDay) return;
  _tv2_guardando = true;
  // NUEVO — el adicional hereda el tipo del turno principal del día
  // desde el momento de abrir el formulario (antes siempre forzaba
  // 'ordinario', que era la causa real de los turnos mixtos).
  var tipoPrincipalDia = _forzarTipoTurnoAdicional || ((TV[selDay.k] && TV[selDay.k].tipo) ? TV[selDay.k].tipo : 'ordinario');
  resetF(tipoPrincipalDia);
  abrirForm(false);
}

function editarTurnoExtra(kk, idx){
  if(!TV2[kk] || !TV2[kk][idx]) return;
  var t = TV2[kk][idx];
  _tv2_guardando = true;
  _tv2_editando_idx = idx; // identifica el turno exacto a actualizar al guardar
  F = {tipo:t.tipo, linea:t.linea||null,
       sal:t.sal||(AJ.base||null), lle:t.lle||null, hF:t.hF||null, hL:t.hL||null,
       sal2:t.sal2||null, lle2:t.lle2||null, hF2:t.hF2||null, hL2:t.hL2||null,
       modo:t.modo||null, notas:t.notas||'',
       numTren:t.numTren||'', numTrenVuelta:t.numTrenVuelta||'',
       plusAct:t.plusAct||false, plusJT:t.plusJT||false,
       plusIntlAuto:t.plusIntlAuto||false};
  abrirForm(true);
}

function guardarTurnoEnTV2(){
  if(!selDay) return;
  var kk = selDay.k;
  var hI = (F.hF&&F.hL) ? Math.round(calcMins(F.hF,F.hL)/60*100)/100 : 0;
  var hV = (F.hF2&&F.hL2) ? Math.round(calcMins(F.hF2,F.hL2)/60*100)/100 : 0;
  // NUEVO — el turno adicional SIEMPRE hereda el tipo del turno
  // principal del día (no existen turnos mixtos: HTDL con HTDL,
  // ordinario con ordinario, Art.51/52 con Art.51/52). Se ignora
  // F.tipo aquí a propósito, por si alguna vez llegara distinto.
  var tipoHeredado = _forzarTipoTurnoAdicional || ((TV[kk] && TV[kk].tipo) ? TV[kk].tipo : (F.tipo || 'ordinario'));
  var eraForzado = !!_forzarTipoTurnoAdicional;
  _forzarTipoTurnoAdicional = null;
  var dd = {
    tipo: tipoHeredado, linea: F.linea,
    independienteDeTipoPrincipal: eraForzado,
    sal: F.sal, lle: F.lle, hF: F.hF, hL: F.hL,
    sal2: F.sal2, lle2: F.lle2, hF2: F.hF2, hL2: F.hL2,
    modo: F.modo||'ida',
    // FIX — la forma de compensación (dinero/días/mix) elegida en el
    // formulario se perdía al guardar: nunca se copiaba a dd, así que
    // un HTDL/Art.51-52 registrado como turno adicional nunca podía
    // contarse en dinero (ni en ningún sitio) más adelante.
    comp: F.comp || 'dinero',
    diasComp: (F.diasComp||[]).slice(),
    numTren: F.numTren||'', numTrenVuelta: F.numTrenVuelta||'',
    horas: Math.round((hI+hV)*100)/100,
    notas: F.notas||'',
    plusAct: F.plusAct||false, plusJT: F.plusJT||false,
    plusIntlAuto: F.plusIntlAuto||false,
    nocturno: !!((F.hF&&esHoraNocturna(F.hF))||(F.hL&&esHoraNocturna(F.hL))||
                 (F.hF2&&esHoraNocturna(F.hF2))||(F.hL2&&esHoraNocturna(F.hL2)))
  };
  if(!TV2[kk]) TV2[kk] = [];
  var estabaEditando = (_tv2_editando_idx!=null && TV2[kk][_tv2_editando_idx]);
  if(estabaEditando){
    TV2[kk][_tv2_editando_idx] = dd; // solo se reemplaza ESTE objeto; el array conserva todo lo demás
  } else {
    TV2[kk].push(dd);
  }
  // NUEVO — FIX: hasta ahora, si la pernocta se registraba como
  // "Turno Adicional" (en vez de como turno principal del día), el
  // tramo de vuelta (o intermedio, en pernocta de 3 días) nunca se
  // vinculaba a ningún sitio — no aparecía ni el puntero normal ni
  // el aviso de protección. Se aplica aquí la MISMA lógica que ya
  // usa guardarTurno() para el turno principal (protección incluida
  // si el día de destino ya tiene algo real), sin duplicar código.
  if(dd.modo==='pernocta'){
    var _kkp2 = kk.split('-').map(Number);
    var _sig = new Date(_kkp2[0], _kkp2[1]-1, _kkp2[2]); _sig.setDate(_sig.getDate()+1);
    var _kSigTV2 = key(_sig.getFullYear(), _sig.getMonth()+1, _sig.getDate());
    _escribirDiaPernoctaConDemota(_kSigTV2, kk, {tipo:'vuelta-pernocta', linea:dd.linea,
      sal:dd.sal2||null, lle:dd.lle2||null, hF:dd.hF2||null, hL:dd.hL2||null,
      numTren:dd.numTrenVuelta||'', nocturno:dd.nocturno, origenPernocta:kk});
    dd.diaSiguiente = _kSigTV2;
  } else if(dd.modo==='pernocta3'){
    var _kkp3 = kk.split('-').map(Number);
    var _int = new Date(_kkp3[0], _kkp3[1]-1, _kkp3[2]); _int.setDate(_int.getDate()+1);
    var _kIntTV2 = key(_int.getFullYear(), _int.getMonth()+1, _int.getDate());
    var _fin = new Date(_kkp3[0], _kkp3[1]-1, _kkp3[2]); _fin.setDate(_fin.getDate()+2);
    var _kFinTV2 = key(_fin.getFullYear(), _fin.getMonth()+1, _fin.getDate());
    var _nocInt = !!((F.hF3&&esHoraNocturna(F.hF3))||(F.hL3&&esHoraNocturna(F.hL3)));
    _escribirDiaPernoctaConDemota(_kIntTV2, kk, {tipo:'pernocta3-intermedio', linea:dd.linea,
      sal:F.sal3||'', lle:F.lle3||'', hF:F.hF3||'', hL:F.hL3||'',
      numTren:F.numTrenIntermedio||'', nocturno:_nocInt, origenPernocta:kk});
    _escribirDiaPernoctaConDemota(_kFinTV2, kk, {tipo:'vuelta-pernocta', linea:dd.linea,
      sal:dd.sal2||null, lle:dd.lle2||null, hF:dd.hF2||null, hL:dd.hL2||null,
      numTren:dd.numTrenVuelta||'', nocturno:dd.nocturno, origenPernocta:kk});
    dd.numTrenIntermedio = F.numTrenIntermedio||'';
    dd.diaIntermedio = _kIntTV2;
    dd.diaSiguiente = _kFinTV2;
  }
  saveTV();
  saveTV2();
  _tv2_guardando = false;
  _tv2_editando_idx = null;
  closeOv('ov-form');
  renderCal();
  renderTV2DiaCard(kk);
  toast(estabaEditando ? 'Turno adicional actualizado' : 'Turno adicional guardado');
}

function eliminarTurnoExtra(kk, idx){
  if(!TV2[kk]||!TV2[kk][idx]) return;
  if(!confirm('Eliminar este turno adicional?')) return;
  TV2[kk].splice(idx, 1);
  if(TV2[kk].length===0) delete TV2[kk];
  saveTV2();
  renderTV2DiaCard(kk);
  renderCal();
  toast('Turno adicional eliminado');
}

function renderTV2DiaCard(kk){
  var cont = document.getElementById('tv2lista' + kk.replace(/-/g,''));
  if(!cont) return;
  var extras = TV2[kk] || [];
  if(!extras.length){ cont.innerHTML=''; return; }
  var h = '';
  for(var ii=0; ii<extras.length; ii++){
    var ex  = extras[ii];
    var ti  = TIPO_INFO[ex.tipo] || {ico:'📋', lbl:ex.tipo||'Turno'};
    var tren= ex.numTren ? ' #'+ex.numTren : '';
    var ruta= (ex.sal&&ex.lle) ? ex.sal+' → '+ex.lle+(ex.horas?' · '+ex.horas+'h':'') : (ex.horas?ex.horas+'h':'');
    h += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;'
       + 'background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.2);'
       + 'border-radius:9px;margin-top:4px" id="tv2item'+kk.replace(/-/g,'')+'x'+ii+'">'
       + '<span style="font-size:16px">'+ti.ico+'</span>'
       + '<div style="flex:1">'
       + '<div style="font-size:11px;font-weight:700;color:var(--tx)">'+ti.lbl+tren+'</div>'
       + (ruta ? '<div style="font-size:10px;color:var(--tx3)">'+ruta+'</div>' : '')
       + (ex.notas ? '<div style="font-size:10px;color:var(--tx2)">📝 '+ex.notas+'</div>' : '')
       + '</div>'
       + '<button id="tv2btn'+kk.replace(/-/g,'')+'x'+ii+'" style="background:rgba(239,68,68,.12);'
       + 'border:1px solid rgba(239,68,68,.3);border-radius:7px;color:#f87171;'
       + 'font-size:11px;padding:3px 8px;cursor:pointer">X</button>'
       + '</div>';
  }
  cont.innerHTML = h;
  // Attach onclick handlers after render
  for(var jj=0; jj<extras.length; jj++){
    (function(idx2, k2){
      var btn = document.getElementById('tv2btn'+k2.replace(/-/g,'')+'x'+idx2);
      if(btn) btn.onclick = function(){ eliminarTurnoExtra(k2, idx2); };
    })(jj, kk);
  }
}

function renderTV2Bloque(kk){
  var extras = TV2[kk] || [];
  var safeK  = kk.replace(/-/g,'');
  // Solo muestra la lista de turnos extra — sin cabecera ni botón (el botón está en los botones de acción)
  if(!extras.length) return '<div id="tv2lista'+safeK+'"></div>';
  return '<div style="margin-top:6px;border-top:1px solid var(--div);padding-top:6px">'
    + (extras.length ? '<div style="font-size:9px;font-weight:800;color:var(--acc);letter-spacing:.5px;margin-bottom:4px">+ '+ extras.length +' turno'+(extras.length>1?'s adicionales':' adicional')+'</div>' : '')
    + '<div id="tv2lista'+safeK+'"></div>'
    + '</div>';
}

function getTV2Badge(kk){
  return (TV2[kk]&&TV2[kk].length)
    ? '<span style="position:absolute;bottom:1px;left:1px;font-size:7px;background:var(--acc);color:#fff;border-radius:4px;padding:0 3px;line-height:1.4;font-weight:800">+'+TV2[kk].length+'</span>'
    : '';
}
/* ═══════ FIN MÓDULO TV2 ════════════════════════════════════ */


function renderPanelHoy(){
  var cont=document.getElementById('panel-hoy-top');
  if(!cont) return;
  var hoy=new Date();
  var k=key(hoy.getFullYear(),hoy.getMonth()+1,hoy.getDate());
  var t=TV[k];
  var DIAS_H=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var diaNom=DIAS_H[hoy.getDay()];
  var diaNum=hoy.getDate();
  var mesNom=MESES_C[hoy.getMonth()];

  if(!t){
    cont.innerHTML=
      '<div class="hoy-header">'
      +'<div class="hoy-ico">📅</div>'
      +'<div style="flex:1">'
      +'<div class="hoy-fecha">HOY · '+diaNom+' '+diaNum+' '+mesNom+'</div>'
      +'<div class="hoy-tipo" style="color:var(--tx3)">Sin turno registrado</div>'
      +'</div></div>'
      +'<div class="hoy-vacio">Pulsa un día en el calendario para añadir tu turno</div>';
    return;
  }

  var ti=TIPO_INFO[t.tipo]||{ico:'📋',lbl:t.tipo||'Turno'};
  var rows='';

  // ── Info DH para sincronizar con la cuadrícula (fuente única) ──
  var infoDHIdaHoy = obtenerInfoDHTramo(t, 'ida');
  var infoDHVtaHoy = obtenerInfoDHTramo(t, 'vuelta');
  var esDHIda    = !!infoDHIdaHoy;
  var esDHVuelta = !!infoDHVtaHoy;

  // Tren ida — con formato DH si aplica
  if(t.numTren){
    var trenIdaTxt = '#'+t.numTren;
    var dhIdaBadge = '';
    if(infoDHIdaHoy){
      if(infoDHIdaHoy.mismoTren){
        var partA = infoDHIdaHoy.origenEsBase ? infoDHIdaHoy.trenServicio+' DH' : infoDHIdaHoy.trenServicio;
        var partB = infoDHIdaHoy.origenEsBase ? infoDHIdaHoy.trenServicio       : infoDHIdaHoy.trenServicio+' DH';
        trenIdaTxt = partA + ' - ' + partB;
      } else {
        trenIdaTxt = 'Tren DH: '+infoDHIdaHoy.trenDH+' (DH) | Tren Servicio: '+infoDHIdaHoy.trenServicio;
      }
      dhIdaBadge = ' <span style="background:rgba(245,158,11,.2);border:1px solid var(--amber2);'
        +'border-radius:5px;padding:1px 6px;font-size:9px;font-weight:800;color:var(--amber2);'
        +'margin-left:6px">🔀 DH</span>';
    }
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">Tren ida</span>'
      +'<span class="hoy-card-val hi">🚆 '+trenIdaTxt+dhIdaBadge+'</span></div>';
  }
  // Ruta ida
  if(t.sal||t.lle){
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">Ida</span>'
      +'<span class="hoy-card-val">'+(t.sal||'—')+' → '+(t.lle||'—')+'</span></div>';
  }
  // Horario ida
  if(t.hF||t.hL){
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">Horario</span>'
      +'<span class="hoy-card-val">'+(t.hF||'—')+' – '+(t.hL||'—')+'</span></div>';
  }
  // Detalle DH ida (desde X hasta Y)
  if(esDHIda && t.estadoServicioDetalle){
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">DH Ida</span>'
      +'<span class="hoy-card-val" style="color:var(--amber2);font-size:11px">🔀 '+t.estadoServicioDetalle+'</span></div>';
  }
  // Tren vuelta — con formato DH si aplica
  if(t.numTrenVuelta){
    var trenVtaTxt = '#'+t.numTrenVuelta;
    var dhVtaBadge = '';
    if(infoDHVtaHoy){
      if(infoDHVtaHoy.mismoTren){
        var vA = infoDHVtaHoy.origenEsBase ? infoDHVtaHoy.trenServicio+' DH' : infoDHVtaHoy.trenServicio;
        var vB = infoDHVtaHoy.origenEsBase ? infoDHVtaHoy.trenServicio       : infoDHVtaHoy.trenServicio+' DH';
        trenVtaTxt = vA + ' - ' + vB;
      } else {
        trenVtaTxt = 'Tren DH: '+infoDHVtaHoy.trenDH+' (DH) | Tren Servicio: '+infoDHVtaHoy.trenServicio;
      }
      dhVtaBadge = ' <span style="background:rgba(245,158,11,.2);border:1px solid var(--amber2);'
        +'border-radius:5px;padding:1px 6px;font-size:9px;font-weight:800;color:var(--amber2);'
        +'margin-left:6px">🔀 DH</span>';
    }
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">Tren vuelta</span>'
      +'<span class="hoy-card-val hi">'+(t.modo==='pernocta'?'🌙':'↩')+' '+trenVtaTxt+dhVtaBadge+'</span></div>';
  }
  // Detalle DH vuelta (desde X hasta Y)
  if(esDHVuelta && t.estadoServicioVueltaDetalle){
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">DH Vuelta</span>'
      +'<span class="hoy-card-val" style="color:var(--amber2);font-size:11px">🔀 '+t.estadoServicioVueltaDetalle+'</span></div>';
  }
  // Ruta vuelta
  if(t.sal2||t.lle2){
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">Vuelta</span>'
      +'<span class="hoy-card-val">'+(t.sal2||'—')+' → '+(t.lle2||'—')+'</span></div>';
  }
  // Horario vuelta
  if(t.hF2||t.hL2){
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">H. Vuelta</span>'
      +'<span class="hoy-card-val">'+(t.hF2||'—')+' – '+(t.hL2||'—')+'</span></div>';
  }
  // Linea
  if(t.linea){
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">Línea</span>'
      +'<span class="hoy-card-val">'+t.linea+'</span></div>';
  }
  // Base
  if(AJ.base){
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">Base</span>'
      +'<span class="hoy-card-val">'+AJ.base+'</span></div>';
  }
  // Nota
  if(t.notas&&t.notas.trim()){
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">Nota</span>'
      +'<span class="hoy-card-val" style="color:var(--acc);font-style:italic">'+t.notas.trim()+'</span></div>';
  }
  // Retrasos
  if(t.retrasos&&t.retrasos.length){
    var retTxt=t.retrasos.map(function(r){return 'T'+r.tramo+' +'+r.minutos+'m'+(r.tren?' #'+r.tren:'');}).join(' · ');
    rows+='<div class="hoy-card">'
      +'<span class="hoy-card-lbl">Retraso</span>'
      +'<span class="hoy-card-val" style="color:var(--amber2)">⏱ '+retTxt+'</span></div>';
  }

  cont.innerHTML=
    '<div class="hoy-header">'
    +'<div class="hoy-ico">'+ti.ico+'</div>'
    +'<div style="flex:1">'
    +'<div class="hoy-fecha">HOY · '+diaNom+' '+diaNum+' '+mesNom+'</div>'
    +'<div class="hoy-tipo">'+ti.lbl+'</div>'
    +'</div>'
    +(t.nocturno?'<span style="font-size:14px">🌙</span>':'')
    +(t.plusIntlAuto?'<span style="font-size:14px">🌍</span>':'')
    +'</div>'
    +(rows?'<div class="hoy-cards">'+rows+'</div>':'<div class="hoy-vacio">'+ti.lbl+' registrado</div>');
}


/* ── MÓDULO OTRA ESTACIÓN ────────────────────────────────── */
function selEstOtra(){
  // Mostrar el input manual y darle foco
  var wrap=document.getElementById('est-manual-wrap');
  if(wrap){
    wrap.style.display='block';
    var inp=document.getElementById('est-manual-inp');
    if(inp){inp.value='';inp.focus();}
    var prev=document.getElementById('est-manual-preview');
    if(prev) prev.textContent='';
  }
}

function previsualizarEstManual(val){
  var prev=document.getElementById('est-manual-preview');
  if(!prev) return;
  var v=val.trim();
  if(!v){ prev.textContent=''; return; }
  var esIntl=ESTACIONES_INTERNACIONALES.has(v);
  prev.textContent=esIntl?'🌍 Activará Plus Internacional':'📍 Estación personalizada';
  prev.style.color=esIntl?'var(--cyan2)':'var(--tx3)';
}

function confirmarEstManual(){
  var inp=document.getElementById('est-manual-inp');
  if(!inp) return;
  var v=inp.value.trim();
  if(!v){ toast('Escribe el nombre de la estación'); return; }
  // Reutiliza selEst para mantener toda la lógica de Internacional, badges, etc.
  selEst(v);
  // Ocultar el panel manual tras confirmar
  var wrap=document.getElementById('est-manual-wrap');
  if(wrap) wrap.style.display='none';
}
