/* TrenTurnos v5 — Retrasos, impacto económico de enlaces/baja y detalle Art. 51/52
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   NUEVO — Botón "Compartir" (Ajustes → Apoyo al Desarrollador)
═══════════════════════════════════════════════════════════ */
async function compartirApp() {
  const urlCompartir = 'https://trenturnov5.es/';
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'TrenTurnos v5',
        text: 'Gestiona tus turnos de manera profesional con TrenTurnos v5.',
        url: urlCompartir
      });
    } catch (err) { console.log('Error al compartir:', err); }
  } else {
    navigator.clipboard.writeText(urlCompartir);
    alert('URL copiada al portapapeles');
  }
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — Impacto de Baja Médica en el TAS (Desglose Económico).
   100% observador: lee TV (turnoPisado guardado al marcar la baja)
   y reutiliza calcularJornadaDiaria() YA EXISTENTE, sin modificarla,
   para saber cuántas horas de presencia/efectivas tenía el turno
   que la baja sustituyó. Como esos días ya están marcados con
   tipo:'baja' (que calcularJornadaDiaria() no computa, por diseño
   ya existente de la función), esas horas YA quedan excluidas de
   los totales generales automáticamente — esta función solo AÑADE
   una fila informativa mostrando el detalle, sin tocar ningún total.
═══════════════════════════════════════════════════════════ */
function _renderImpactoBajaEnStats(){
  var cs = document.getElementById('cs-box');
  if(!cs || !cs.innerHTML) return;

  var y=statsM.getFullYear(), m=statsM.getMonth()+1;
  var pref = y+'-'+pad(m);
  var diasBajaConDescuento = [];
  var diasBajaContados = [];
  var diasBaja75 = [];
  var horasEfectivasPerdidas = 0, horasPresenciaPerdidas = 0;
  var horasEfectivasContadas = 0, horasPresenciaContadas = 0;

  Object.keys(TV).filter(function(k){ return k.startsWith(pref); }).forEach(function(k){
    var t = TV[k];
    if(!t || t.tipo!=='baja' || !t.turnoPisado) return;
    var tipoPisado = t.turnoPisado.tipo;
    var esOrdinariaOReserva = (tipoPisado==='ordinario' || tipoPisado==='reserva');
    if(!esOrdinariaOReserva) return; // HTDL/Art.51-52 nunca se muestran aquí, tienen su propio contador
    // checkRestTime()/calcularJornadaDiaria() se reutilizan tal cual,
    // solo para leer cuántas horas tenía el turno pisado — de solo
    // lectura, no se guarda nada ni se recalculan alertas.
    var jornadaPisada = calcularJornadaDiaria([t.turnoPisado], k);
    var hEf = Math.round((jornadaPisada.efectivasMin/60)*100)/100;
    var hPr = Math.round((jornadaPisada.presenciaMin/60)*100)/100;
    var indiceDia = t.diaIndiceBaja || 1;

    if(t.primeraBajaAnio===true){
      // Primera baja del año → 100% (empresa se hace cargo).
      horasEfectivasContadas += hEf;
      horasPresenciaContadas += hPr;
      diasBajaContados.push({fecha:_keyAFechaLbl(k), tren:t.turnoPisado.numTren||t.turnoPisado.numTrenVuelta||'', hEf:hEf, hPr:hPr});
    } else if(t.primeraBajaAnio===false && indiceDia<=3){
      // NO es la primera + días 1-3 → 0% (descuento total).
      horasEfectivasPerdidas += hEf;
      horasPresenciaPerdidas += hPr;
      diasBajaConDescuento.push({fecha:_keyAFechaLbl(k), tren:t.turnoPisado.numTren||t.turnoPisado.numTrenVuelta||'', hEf:hEf, hPr:hPr, dia:indiceDia});
    } else if(t.primeraBajaAnio===false && indiceDia>=4){
      // NO es la primera + día 4 en adelante → 75%.
      diasBaja75.push({fecha:_keyAFechaLbl(k), tren:t.turnoPisado.numTren||t.turnoPisado.numTrenVuelta||'', hEf:Math.round(hEf*0.75*100)/100, hPr:Math.round(hPr*0.75*100)/100, dia:indiceDia});
    }
  });

  if(!diasBajaConDescuento.length && !diasBajaContados.length && !diasBaja75.length) return;

  var html = '<div class="cr-div" style="margin:6px 0"></div>';

  if(diasBajaContados.length){
    html += '<div class="cs-r"><span class="cl cv-pos" style="font-weight:800">🏥 Baja (primera del año) — 100% en Registro App</span>'
      +'<span class="cv cv-pos">'+diasBajaContados.length+' día'+(diasBajaContados.length>1?'s':'')+'</span></div>';
    diasBajaContados.forEach(function(d){
      html += '<div class="cs-r cs-r-sub">'
        +'<span class="cl">'+d.fecha+(d.tren?' · Tren #'+d.tren:'')+'</span>'
        +'<span class="cv cv-pos">+'+d.hEf.toFixed(2)+'h efectivas · +'+d.hPr.toFixed(2)+'h presencia</span></div>';
    });
  }

  if(diasBaja75.length){
    html += '<div class="cs-r"><span class="cl" style="font-weight:800;color:var(--acc3)">🏥 Baja (día 4 y siguientes) — 75% en Registro App</span>'
      +'<span class="cv" style="color:var(--acc3)">'+diasBaja75.length+' día'+(diasBaja75.length>1?'s':'')+'</span></div>';
    diasBaja75.forEach(function(d){
      html += '<div class="cs-r cs-r-sub">'
        +'<span class="cl">'+d.fecha+' · día '+d.dia+(d.tren?' · Tren #'+d.tren:'')+'</span>'
        +'<span class="cv" style="color:var(--acc3)">+'+d.hEf.toFixed(2)+'h efectivas · +'+d.hPr.toFixed(2)+'h presencia (75%)</span></div>';
    });
  }

  if(diasBajaConDescuento.length){
    html += '<div class="cs-r"><span class="cl cv-warn" style="font-weight:800">🏥 Baja (días 1-3, no primera) — 0% descuento total</span>'
      +'<span class="cv cv-warn">'+diasBajaConDescuento.length+' día'+(diasBajaConDescuento.length>1?'s':'')+'</span></div>';
    diasBajaConDescuento.forEach(function(d){
      html += '<div class="cs-r cs-r-sub">'
        +'<span class="cl">'+d.fecha+' · día '+d.dia+(d.tren?' · Tren #'+d.tren:'')+'</span>'
        +'<span class="cv cv-warn">-'+d.hEf.toFixed(2)+'h efectivas · -'+d.hPr.toFixed(2)+'h presencia</span></div>';
    });
    html += '<div class="cs-r" style="padding-left:12px;opacity:.8">'
      +'<span class="cl" style="font-size:10px">Total descontado</span>'
      +'<span class="cv cv-warn" style="font-size:10px">-'+horasEfectivasPerdidas.toFixed(2)+'h efectivas · -'+horasPresenciaPerdidas.toFixed(2)+'h presencia</span></div>';
  }

  cs.insertAdjacentHTML('beforeend', html);
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — calcularImpactoEnlacesEconomico(ks): observador puro de
   solo lectura. Repite la MISMA iteración de pares de días
   consecutivos que ya hace calculateEarnings(), pero en un cálculo
   aparte, únicamente para poder mostrar el total de "Impacto
   Económico por Enlaces" como línea separada en el TAS — sin tocar
   ni checkRestTime(), ni calcularEnlaceJornada(), ni los contadores
   ya existentes (hHTDL/tH dentro de calculateEarnings siguen
   exactamente igual). Misma tarifa (AJ.vh) que ya usa el cálculo
   original, no una fórmula nueva.
═══════════════════════════════════════════════════════════ */
function calcularImpactoEnlacesEconomico(ks){
  var tarifaHTDL = parseFloat(AJ.vh||12.5);
  var tarifaArt5152 = parseFloat(AJ.art5152Monto)||0;
  var horas = 0, importe = 0, detalle = [];
  var ksOrdenados = ks.slice().sort();
  for(var i=1; i<ksOrdenados.length; i++){
    var kA=ksOrdenados[i-1], kB=ksOrdenados[i];
    var tA=TV[kA], tB=TV[kB];
    if(!tA || !tB) continue;
    if(['descanso','baja','comp','reserva'].indexOf(tA.tipo)>=0) continue;
    if(['descanso','baja','comp','reserva'].indexOf(tB.tipo)>=0) continue;
    // FIX — mismo arreglo que en el resto de sitios: usa el turno que
    // de verdad termina más tarde el día A y el que de verdad empieza
    // más temprano el día B (puede ser uno de TV2, no el principal).
    var tAReal = _turnoFinDelDia(kA) || tA;
    var tBReal = _turnoInicioDelDia(kB) || tB;
    var enlace = procesarIncumplimientoDescanso(tAReal, tBReal, kA, kB);
    if(!enlace.incumple || !enlace.computaFinanciero) continue;
    var h = Math.round((enlace.descMin/60)*100)/100;
    // FIX — mismo criterio que en calculateEarnings(): ahora que solo
    // computaFinanciero=true cuando LOS DOS lados son HTDL/Art.51-52
    // (tipoEnlace==='HTDL_HTDL'), la tarifa se elige por si alguno de
    // los dos es Art.51/52 (tiene su propia tarifa distinta a HTDL).
    var turnoTarifaObs = (tBReal.tipo==='art5152') ? tBReal : (tAReal.tipo==='art5152' ? tAReal : tAReal);
    var tarifaAplic = (turnoTarifaObs.tipo==='art5152') ? tarifaArt5152 : tarifaHTDL;
    var imp = Math.round(h*tarifaAplic*100)/100;
    horas += h; importe += imp;
    detalle.push({fecha:_keyAFechaLbl(kB), tren:tBReal.numTren||tBReal.numTrenVuelta||'', horas:h, importe:imp});
  }
  // Descanso INTERNO de pernocta (HTDL o Art.51/52), para que esta
  // línea del TAS coincida con lo que realmente se suma en
  // calculateEarnings().
  ksOrdenados.forEach(function(kInt){
    var tInt = TV[kInt];
    if(!tInt) return;
    if(tInt.tipo!=='trabajado' && tInt.tipo!=='art5152') return;
    var esPernoctaInt=(tInt.modo==='pernocta'||tInt.modo==='pernocta3');
    if(!esPernoctaInt) return;
    var rInterno = checkDescansoInternoPernocta(tInt);
    if(!rInterno || !rInterno.incumple) return;
    var hInt = Math.round((rInterno.descMin/60)*100)/100;
    // FIX — misma tarifa correcta según tipo.
    var tarifaAplicInt = (tInt.tipo==='art5152') ? tarifaArt5152 : tarifaHTDL;
    var impInt = Math.round(hInt*tarifaAplicInt*100)/100;
    horas += hInt; importe += impInt;
    detalle.push({fecha:_keyAFechaLbl(kInt)+' (interno)', tren:tInt.numTren||'', horas:hInt, importe:impInt});
  });
  return {horas:Math.round(horas*100)/100, importe:Math.round(importe*100)/100, detalle:detalle};
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — mostrarDetalleArt5152(k)
   Modal de detalle AUTOCONTENIDO para un registro de Art.51/52.
   No depende de renderAcordeon() ni del mes visible en el
   calendario (curM) — por eso funciona siempre, aunque STATS esté
   mostrando un mes distinto al del calendario, que era la causa
   real de que "Ver detalle" no reaccionara.
   Reutiliza el mismo patrón .ov/.sh ya usado por ov-cambio y
   ov-correo-mix — ningún componente visual nuevo.
═══════════════════════════════════════════════════════════ */
function mostrarDetalleArt5152(k){
  var t = TV[k];
  if(!t || t.tipo!=='art5152'){
    toast('No se encontró el registro de este día');
    return;
  }
  var sub = document.getElementById('art5152-detalle-sub');
  var body = document.getElementById('art5152-detalle-body');
  if(!body) return;

  if(sub) sub.textContent = _keyAFechaLbl(k)+' · '+(t.modo==='pernocta'?'Pernocta':'Ida y vuelta');

  var fila = function(lbl, val, col){
    return '<div class="cs-r"><span class="cl">'+lbl+'</span>'
      +'<span class="cv" style="color:'+(col||'var(--tx2)')+'">'+val+'</span></div>';
  };

  var html = '<div class="cs-box">';

  // FIX — mismo recálculo en vivo que en el TAS: las horas ya
  // guardadas son un hecho fijo, pero el importe se recalcula con la
  // tarifa ACTUAL de Ajustes, no con la que hubiera cuando se guardó.
  var montoArtDetalle = parseFloat(AJ.art5152Monto)||0;
  var baseArtDetalle = parseFloat(AJ.art5152ValorBase)||0;
  // NUEVO — pluses recalculados en vivo, mismo criterio que arriba.
  var pArt51Detalle    = AJ.pluses[AJ.rol]||PLUS_DEF[AJ.rol];
  var pActArtDetalle   = t.plusAct      ? parseFloat(pArt51Detalle.activacion||0)    : 0;
  var pJTArtDetalle    = t.plusJT       ? parseFloat(pArt51Detalle.jt||0)            : 0;
  var pIntlArtDetalle  = t.plusIntlAuto ? parseFloat(pArt51Detalle.internacional||0) : 0;
  var pTotalArtDetalle = pActArtDetalle + pJTArtDetalle + pIntlArtDetalle;

  // FIX — Retraso del tramo de vuelta (T2), en vivo, mismo criterio
  // que en el TAS (calculateEarnings): T1 es informativo, T2 suma.
  // En pernocta vive en la celda del día siguiente.
  var esPernoctaDetalle = (t.modo==='pernocta' || t.modo==='pernocta3');
  var _tRetDetalle = (esPernoctaDetalle && t.diaSiguiente) ? TV[t.diaSiguiente] : t;
  var minRetT2Detalle = 0;
  if(_tRetDetalle){
    if(_tRetDetalle.retrasos && _tRetDetalle.retrasos.length){
      _tRetDetalle.retrasos.forEach(function(r){ if(r.tramo===2) minRetT2Detalle += r.minutos||0; });
    } else if(_tRetDetalle.retrasoMin>0 && !_tRetDetalle.retrasos){
      minRetT2Detalle += _tRetDetalle.retrasoMin;
    }
  }
  var hRetT2Detalle = Math.round(minRetT2Detalle/60*100)/100;

  if(t.compensacion==='mix' && t.mixDinero && t.mixDias){
    var horasMixDetalle = Math.round(((t.mixDinero.horas||0) + hRetT2Detalle)*100)/100;
    var importeMixDetalle = Math.round((horasMixDetalle*montoArtDetalle + baseArtDetalle + pTotalArtDetalle)*100)/100;
    html += '<div class="cs-t">🔀 Compensación Mix</div>';
    html += fila('Tramo mayor horas', _keyAFechaLbl(t.mixDinero.dia)+' · '+t.mixDinero.horas+' h', 'var(--acc3)');
    if(hRetT2Detalle>0) html += fila('Retraso tramo vuelta', '+'+hRetT2Detalle+' h', 'var(--amber2)');
    if(pActArtDetalle>0) html += fila('Plus Activación', '+'+pActArtDetalle.toFixed(2)+' €', 'var(--green2)');
    if(pJTArtDetalle>0) html += fila('Plus JT', '+'+pJTArtDetalle.toFixed(2)+' €', 'var(--green2)');
    if(pIntlArtDetalle>0) html += fila('Plus Internacional', '+'+pIntlArtDetalle.toFixed(2)+' €', 'var(--green2)');
    html += fila('Compensación económica', importeMixDetalle.toFixed(2)+' €', 'var(--green2)');
    html += fila('Tramo menor horas', _keyAFechaLbl(t.mixDias.dia)+' · '+t.mixDias.horas+' h', 'var(--acc3)');
    html += fila('Días de descanso', '+'+t.mixDias.diasGenerados+' día(s) → '+t.mixDias.mesDestino, 'var(--cyan2)');
    if(t.mixDias.diasComp && t.mixDias.diasComp.length){
      html += fila('Fechas elegidas', t.mixDias.diasComp.map(_keyAFechaLbl).join(' y '), 'var(--cyan2)');
    }
    // NUEVO — aviso (sin mover nada): si el retraso hace que el lado
    // "días" tenga ahora más horas que el lado "dinero", se avisa
    // aquí para que el usuario revise y decida manualmente — no se
    // reasigna el dinero ni se mueven los días de descanso ya
    // generados en el calendario.
    var _avisoMixDetalle = _art5152MixAvisoRetraso(k, t);
    if(_avisoMixDetalle && _avisoMixDetalle.cambiaria){
      html += '<div style="margin-top:8px;padding:9px 10px;background:rgba(245,158,11,.12);'
        +'border:1px solid rgba(245,158,11,.4);border-radius:9px;font-size:11px;color:#FCD34D;line-height:1.5">'
        +'⚠️ Con el retraso incluido, ida suma '+_avisoMixDetalle.horasIdaTotal+' h y vuelta '+_avisoMixDetalle.horasVueltaTotal+' h. '
        +'El lado con más horas ahora sería <b>'+_avisoMixDetalle.ladoNuevo+'</b> (actualmente el dinero está asignado a <b>'+_avisoMixDetalle.ladoActual+'</b>). '
        +'No se ha movido nada automáticamente — revísalo y corrígelo a mano si hace falta.'
        +'</div>';
    }
  } else if(t.compensacion==='dinero'){
    var horasDineroDetalle = Math.round(((t.horasEfectivas||0) + hRetT2Detalle)*100)/100;
    var importeDineroDetalle = Math.round((horasDineroDetalle*montoArtDetalle + baseArtDetalle + pTotalArtDetalle)*100)/100;
    html += '<div class="cs-t">💶 Compensación económica</div>';
    html += fila('Horas efectivas', (t.horasEfectivas||0)+' h', 'var(--acc3)');
    if(hRetT2Detalle>0) html += fila('Retraso tramo vuelta', '+'+hRetT2Detalle+' h', 'var(--amber2)');
    if(pActArtDetalle>0) html += fila('Plus Activación', '+'+pActArtDetalle.toFixed(2)+' €', 'var(--green2)');
    if(pJTArtDetalle>0) html += fila('Plus JT', '+'+pJTArtDetalle.toFixed(2)+' €', 'var(--green2)');
    if(pIntlArtDetalle>0) html += fila('Plus Internacional', '+'+pIntlArtDetalle.toFixed(2)+' €', 'var(--green2)');
    html += fila('Importe', importeDineroDetalle.toFixed(2)+' €', 'var(--green2)');
  } else if(t.compensacion==='dias'){
    html += '<div class="cs-t">📅 Días de descanso</div>';
    html += fila('Días generados', '+'+(t.diasGenerados||0)+' día(s)', 'var(--cyan2)');
    html += fila('Mes destino', t.mesDestino||'—', 'var(--cyan2)');
    if(t.diasComp && t.diasComp.length){
      html += fila('Fechas elegidas', t.diasComp.map(_keyAFechaLbl).join(' y '), 'var(--cyan2)');
    }
  }

  // Datos de tren/ruta comunes, si existen
  if(t.numTren || t.sal){
    html += '<div class="cr-div" style="margin:6px 0"></div>';
    if(t.numTren) html += fila('Tren ida', '#'+t.numTren);
    if(t.sal&&t.lle) html += fila('Ruta ida', t.sal+' → '+t.lle);
    if(t.numTrenVuelta) html += fila('Tren vuelta', '#'+t.numTrenVuelta);
    if(t.sal2&&t.lle2) html += fila('Ruta vuelta', t.sal2+' → '+t.lle2);
  }

  html += '</div>';
  body.innerHTML = html;
  openOv('ov-art5152-detalle');
}

function _renderArt5152Stats(){
  var box = document.getElementById('a5152-stats-box');
  if(!box) return;

  var y=statsM.getFullYear(), m=statsM.getMonth()+1;
  var pref = y+'-'+pad(m);
  var diasRecibidos = ART5152_DIAS[pref] || 0;
  var usosMes = ART5152_USO[pref] || 0;

  // NUEVO — el importe en dinero (Dinero puro y la porción Dinero de
  // Mix) SÍ se muestra aquí ahora, reutilizando calcImporteArt5152Vivo()
  // ya existente (la misma que ya usan el popup de día y el acordeón
  // "Turnos del mes"). Sigue sumándose también dentro de "HTDL" en el
  // total del mes — mostrarlo aquí es solo para verlo desglosado, no
  // se duplica el dinero real, solo la cifra visible.
  var registros = [];
  var totalDinero = 0;
  Object.keys(TV).filter(function(k){return k.startsWith(pref);}).forEach(function(k){
    var t = TV[k];
    if(t && t.tipo==='art5152'){
      registros.push({k:k, t:t});
      if(t.compensacion==='dinero') totalDinero += calcImporteArt5152Vivo(t, false);
      else if(t.compensacion==='mix') totalDinero += calcImporteArt5152Vivo(t, true);
    }
  });
  totalDinero = Math.round(totalDinero*100)/100;

  if(!diasRecibidos && !usosMes && !registros.length){
    box.innerHTML = '';
    return;
  }

  var _cab = totalDinero>0
    ? totalDinero.toFixed(2)+' €'
    : (registros.length ? registros.length+' turno'+(registros.length!==1?'s':'') : '');
  var html = '<div class="acc-section" style="margin:0 0 10px;background:var(--s1);border:1px solid var(--div);border-radius:14px;overflow:hidden">'
    +'<div class="acc-head" style="cursor:pointer" onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
    +'<div class="acc-ico" style="background:transparent;font-size:18px">⚖️</div>'
    +'<div class="acc-title">Artículo 51 y 52</div>'
    +'<div style="font-size:13px;font-weight:800;color:'+(totalDinero>0?'var(--green2)':'var(--acc3)')+';margin-right:6px">'+_cab+'</div>'
    +'<div class="acc-chev">›</div></div>'
    +'<div class="acc-body"><div class="acc-body-inner" style="padding:8px 15px 12px">';
  if(usosMes>0){
    html += '<div class="cs-r"><span class="cl">Usos este mes (Dinero/Días)</span>'
      +'<span class="cv" style="color:'+(usosMes>1?'var(--amber2)':'var(--tx2)')+'">'+usosMes+' / 1</span></div>';
  }
  registros.forEach(function(r){
    var lbl = _keyAFechaLbl(r.k)+' · '+(r.t.modo==='pernocta'?'Pernocta':'Ida y vuelta');
    var val;
    if(r.t.compensacion==='mix'){
      var _impMix = calcImporteArt5152Vivo(r.t, true);
      val = '🔀 '+_impMix.toFixed(2)+' € + '+r.t.mixDias.diasGenerados+' día(s)';
      // NUEVO — aviso (sin mover nada) si un retraso posterior haría
      // que el lado "días" pasara a tener más horas que el lado
      // "dinero". Ver _art5152MixAvisoRetraso().
      var _avisoMix = _art5152MixAvisoRetraso(r.k, r.t);
      if(_avisoMix && _avisoMix.cambiaria){
        val += ' ⚠️';
      }
    } else if(r.t.compensacion==='dias'){
      val = '+'+r.t.diasGenerados+' día(s) → '+r.t.mesDestino;
    } else {
      val = calcImporteArt5152Vivo(r.t, false).toFixed(2)+' €';
    }
    // FIX: antes llamaba a verDetallesEnHistorial(k), que depende del
    // acordeón "Turnos del mes" del calendario — si STATS estaba
    // mostrando un mes distinto al del calendario (curM ≠ statsM), ese
    // elemento no existía y el botón no hacía nada perceptible. Ahora
    // usa mostrarDetalleArt5152(k), un modal propio y autocontenido
    // que siempre funciona, sin depender de ningún otro panel.
    html += '<div class="cs-r" style="padding-left:12px;align-items:center">'
      +'<span class="cl" style="font-size:10px">'+lbl+'</span>'
      +'<span style="display:flex;align-items:center;gap:6px">'
      +'<span class="cv" style="font-size:10px;color:'+(r.t.compensacion==='dias'?'var(--cyan2)':'var(--green2)')+'">'+val+'</span>'
      +'<button onclick="mostrarDetalleArt5152(\''+r.k+'\')" '
      +'style="background:var(--s2);border:1px solid var(--div);border-radius:6px;color:var(--acc2);'
      +'font-size:9px;font-weight:700;padding:2px 7px;cursor:pointer">Ver detalle</button>'
      +'</span></div>';
  });
  if(diasRecibidos>0){
    html += '<div class="cr-div" style="margin:4px 0"></div>'
      +'<div class="cs-r"><span class="cl" style="font-weight:800">📅 Días recibidos este mes</span>'
      +'<span class="cv" style="color:var(--cyan2);font-weight:900">+'+diasRecibidos+' día(s)</span></div>';
  }
  html += '</div></div></div>';
  box.innerHTML = html;
}

// ── Gestión de Retrasos ───────────────────────────────────────
// Cada retraso vive en la celda/día donde ocurre realmente:
//  · Ida y vuelta el mismo día → los dos tramos siguen en la misma celda.
//  · Pernocta → el tramo de ida (día 1) se guarda en la celda del día 1;
//    el tramo de vuelta (día 2, o día 3 en pernocta de 3 días) se guarda
//    en la celda propia de ese día (tipo 'vuelta-pernocta'), nunca en la
//    del día de origen.
//  · Día intermedio de una pernocta de 3 días (tránsito) tiene su propio
//    y único tramo, independiente de ida/vuelta.

function cerrarRetrasoPanel(){var rp=document.getElementById('retraso-panel');if(rp)rp.remove();}
function abrirRetraso(){
  if(!selDay||!selDay.t) return;
  var t=selDay.t; // t === TV[selDay.k]: el registro real de ESTA celda
  var wrap=document.getElementById('retraso-panel');
  if(wrap){wrap.remove();return;}

  var esOrigenPernocta = (t.tipo==='ordinario'||t.tipo==='trabajado'||t.tipo==='art5152') && (t.modo==='pernocta'||t.modo==='pernocta3');
  var esVueltaPernocta = (t.tipo==='vuelta-pernocta');
  var esIntermedioPernocta = (t.tipo==='pernocta3-intermedio');
  var soloUnTramo = esOrigenPernocta || esVueltaPernocta || esIntermedioPernocta;
  // Tramo fijo que corresponde a ESTA celda cuando solo aplica uno:
  var tramoFijo = esVueltaPernocta ? 2 : 1;
  var etiquetaTramoFijo = esVueltaPernocta ? '2 · Vuelta (este día)'
                        : (esIntermedioPernocta ? 'Tránsito (este día)' : '1 · Ida (este día)');

  var retrasos=t.retrasos||[];
  var r1=retrasos.filter(function(r){return r.tramo===(soloUnTramo?tramoFijo:1);})[0]
        ||{minutos:parseInt(t.retrasoMin)||0,tren:t.numTren||''};
  var r2=retrasos.filter(function(r){return r.tramo===2;})[0]||{minutos:0,tren:t.numTrenVuelta||''};
  // NUEVO — tramos de continuidad (3, 4...) en el desplegable, solo
  // cuando se ve el día de origen directamente (no en un día derivado
  // de pernocta). Numeración: continuidad[0]→tramo 3, [1]→tramo 4...
  var contList = (!soloUnTramo && t.continuidad && t.continuidad.length) ? t.continuidad : [];
  var contOptsHTML = contList.map(function(c,idx){
    return '<option value="'+(idx+3)+'">'+(idx+3)+' · Continuidad (tren '+(c.tren||'?')+')</option>';
  }).join('');
  wrap=document.createElement('div');
  wrap.id='retraso-panel';
  wrap.className='retraso-wrap';
  wrap.style.cssText='flex-direction:column;gap:8px;padding:10px 12px';
  var filaTramo = soloUnTramo
    ? ('<div style="display:flex;gap:6px;align-items:center">'
      +'<span style="font-size:10px;color:var(--tx3);width:52px">Tramo</span>'
      +'<div style="flex:1;background:var(--s2);border:1px solid var(--div);border-radius:8px;'
      +'color:var(--tx2);font-size:12px;padding:5px 8px">'+etiquetaTramoFijo+'</div>'
      +'</div>')
    : ('<div style="display:flex;gap:6px;align-items:center">'
      +'<span style="font-size:10px;color:var(--tx3);width:52px">Tramo</span>'
      +'<select id="sel-tramo-ret" style="flex:1;background:var(--s2);border:1px solid var(--div);border-radius:8px;color:var(--tx);font-size:12px;padding:5px 8px;outline:none">'
      +'<option value="1">1 Tramo ida</option>'
      +'<option value="2">2 Tramo vuelta</option>'
      +contOptsHTML
      +'</select></div>');
  wrap.innerHTML=
    '<div style="font-size:10px;font-weight:800;color:var(--amber2);margin-bottom:2px">RETRASO</div>'
    +filaTramo
    +'<div style="display:flex;gap:6px;align-items:center">'
    +'<span style="font-size:10px;color:var(--tx3);width:52px">Minutos</span>'
    +'<input id="inp-retraso" class="retraso-inp" type="number" inputmode="numeric" min="0" max="999"'
    +' value="'+r1.minutos+'" placeholder="0" oninput="previsualizarRetraso(this.value)" style="flex:1">'
    +'</div>'
    +'<div style="display:flex;gap:6px;align-items:center">'
    +'<span style="font-size:10px;color:var(--tx3);width:52px">Tren</span>'
    +'<input id="inp-tren-ret" type="text" inputmode="numeric" placeholder="Num tren"'
    +' value="'+r1.tren+'"'
    +' style="flex:1;background:var(--s2);border:1px solid var(--div);border-radius:8px;color:var(--tx);font-size:12px;padding:5px 8px;outline:none">'
    +'</div>'
    +'<div id="retraso-preview" style="font-size:10px;color:var(--tx3);padding:3px 0"></div>'
    +'<div style="display:flex;gap:6px;margin-top:2px">'
    +'<button onclick="guardarRetraso()" style="flex:1;padding:7px;background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.4);border-radius:8px;color:var(--amber2);font-size:11px;font-weight:800;cursor:pointer">Aplicar</button>'
    +'<button onclick="cerrarRetrasoPanel()" style="padding:7px 12px;background:none;border:1px solid var(--div);border-radius:8px;color:var(--tx3);font-size:12px;cursor:pointer">X</button>'
    +'</div>';
  if(soloUnTramo){
    wrap.dataset.tramoFijo = tramoFijo;
  } else {
    var selEl=wrap.querySelector('[id=sel-tramo-ret]');
    if(selEl) selEl.onchange=function(){
      var tv=parseInt(this.value);
      var rv;
      if(tv===1) rv=r1;
      else if(tv===2) rv=r2;
      else {
        // NUEVO — tramo de continuidad (3, 4...): coge el retraso ya
        // guardado para ese tramo, si lo hay, y el tren de ese tramo.
        var cEntry = t.continuidad ? t.continuidad[tv-3] : null;
        rv = retrasos.filter(function(r){return r.tramo===tv;})[0]
             || {minutos:0, tren:(cEntry&&cEntry.tren)||''};
      }
      var ii=document.getElementById('inp-retraso');
      var ti=document.getElementById('inp-tren-ret');
      if(ii)ii.value=rv.minutos||0;
      if(ti)ti.value=rv.tren||'';
      // La previsualización de descanso solo tiene sentido para el
      // tramo de VUELTA (afecta al enlace con el día siguiente) — en
      // continuidad se limpia para no mostrar un aviso que no aplica.
      if(tv===2) previsualizarRetraso(rv.minutos||0);
      else { var prev=document.getElementById('retraso-preview'); if(prev) prev.textContent=''; }
    };
  }
  // FIX: buscar .dc-turno en modal (dia-card-body) Y en dia-area como fallback
  var dct=null;
  var cardBody=document.getElementById('dia-card-body');
  if(cardBody) dct=cardBody.querySelector('.dc-turno');
  if(!dct){var area=document.getElementById('dia-area');if(area) dct=area.querySelector('.dc-turno');}
  if(!dct&&cardBody) dct=cardBody;
  if(!dct){var area2=document.getElementById('dia-area');if(area2) dct=area2;}
  if(dct){
    dct.appendChild(wrap);
    setTimeout(function(){var inp=document.getElementById('inp-retraso');if(inp)inp.focus();},50);
  }
}

function previsualizarRetraso(val){
  var min=parseInt(val)||0;
  var t=selDay?selDay.t:null;
  if(!t) return;
  var kActual=selDay.k;
  var ks=Object.keys(TV).sort();
  var idx2=ks.indexOf(kActual);
  if(idx2<0||idx2>=ks.length-1) return;
  var kSig=ks[idx2+1];
  var tSig=TV[kSig];
  if(!tSig) return;
  var tSim=Object.assign({},t,{retrasoMin:min});
  var r=checkRestTime(tSim,tSig,kActual,kSig);
  var prev=document.getElementById('retraso-preview');
  if(!prev){
    prev=document.createElement('div');
    prev.id='retraso-preview';
    prev.style.cssText='font-size:10px;margin-top:5px;padding:4px 8px;border-radius:7px;font-weight:600';
    var rp=document.getElementById('retraso-panel');
    if(rp) rp.appendChild(prev);
  }
  if(r.incumple){
    prev.style.color='var(--red2)';
    prev.style.background='rgba(220,38,38,.08)';
    prev.textContent='⚠️ '+r.msg;
  } else if(tSig.hF){
    prev.style.color='var(--green2)';
    prev.style.background='rgba(22,163,74,.08)';
    prev.textContent=r.msg;
  } else {
    prev.textContent='';
  }
}

// NUEVO — Desplaza en cadena las horas de un tramo de continuidad por
// un retraso: alarga la hora de fin de ESE tramo, y empuja inicio+fin
// de todos los tramos de continuidad siguientes, más la vuelta
// (hF2/hL2) si la hay. No toca tipoTramo/dhHoraInicio/dhHoraFin —
// cada tramo sigue contando como Efectiva o Presencia según ya
// estaba clasificado, solo con más (o menos) minutos.
function _desplazarContinuidadPorRetraso(t, idxContinuidad, deltaMin){
  if(!t || !t.continuidad || !t.continuidad[idxContinuidad] || !deltaMin) return;
  var c0 = t.continuidad[idxContinuidad];
  if(c0.horaFin) c0.horaFin = _pdfSumarMinutos(c0.horaFin, deltaMin);
  for(var i=idxContinuidad+1; i<t.continuidad.length; i++){
    if(t.continuidad[i].horaInicio) t.continuidad[i].horaInicio = _pdfSumarMinutos(t.continuidad[i].horaInicio, deltaMin);
    if(t.continuidad[i].horaFin) t.continuidad[i].horaFin = _pdfSumarMinutos(t.continuidad[i].horaFin, deltaMin);
  }
  if(t.hF2) t.hF2 = _pdfSumarMinutos(t.hF2, deltaMin);
  if(t.hL2) t.hL2 = _pdfSumarMinutos(t.hL2, deltaMin);
}
