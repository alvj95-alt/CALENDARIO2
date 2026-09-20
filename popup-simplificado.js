/* TrenTurnos v5 — Pop-up simplificado del día y detalles en historial
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   POP-UP SIMPLIFICADO — Vista Resumida del día
   Genera SOLO lo esencial para el bloque de tren: número
   (con formato DH "12345 / 12345-DH"), ruta y horario.
   No borra ni transforma ningún dato de TV[] — es una capa
   puramente de presentación. El detalle completo (importes,
   nocturnidad exacta, retrasos con impacto económico, pluses,
   compensación, etc.) sigue disponible íntegro en el listado
   "Turnos del mes" (acordeón) vía renderAcordeon(), que ya
   incluye todos esos campos sin cambios.
═══════════════════════════════════════════════════════════ */
function renderizarPopUpSimplificado(t, esDiaVuelta, ocultarTotalDia){
  var h = '';

  // ── Determinar qué día del itinerario estamos viendo ──
  // Para turnos de un solo día (ida-y-vuelta), mostrar todo.
  // Para pernoctas, filtrar: día 1 → solo ida, último día → solo vuelta,
  // día intermedio (pernocta3) → tránsito.
  var esPernocta  = t.modo==='pernocta' || t.modo==='pernocta3';
  var esPernocta3 = t.modo==='pernocta3';

  // Detectar qué día concreto tocó el usuario
  var kClicado = (typeof selDay !== 'undefined' && selDay) ? selDay.k : null;
  var tClicadoRaw = kClicado ? TV[kClicado] : null;
  var tipoClicado = tClicadoRaw ? tClicadoRaw.tipo : (t.tipo||'');

  var mostrarIda    = true;
  var mostrarVuelta = true;
  var etiquetaDia   = '';

  if(esPernocta){
    if(tipoClicado === 'vuelta-pernocta'){
      // Último día: solo vuelta
      mostrarIda    = false;
      mostrarVuelta = true;
      etiquetaDia   = esPernocta3 ? 'Día 3 de 3' : 'Día 2 de 2';
    } else if(tipoClicado === 'pernocta3-intermedio'){
      // Día intermedio (pernocta3): en tránsito
      mostrarIda    = false;
      mostrarVuelta = false;
      etiquetaDia   = 'Día 2 de 3';
    } else {
      // Día 1: solo ida
      mostrarIda    = true;
      mostrarVuelta = false;
      etiquetaDia   = esPernocta3 ? 'Día 1 de 3' : 'Día 1 de 2';
    }
  }

  // Indicador de día de pernocta
  if(etiquetaDia){
    h += '<div class="tv-pernocta-dia">'
      + '<span class="tv-pernocta-badge">🌙 '+etiquetaDia+'</span>'
      + '</div>';
  }

  // Fila de mini-badges
  var badges = '';
  if(t.nocturno)     badges += '<span class="tv-badge-mini" title="Nocturnidad activa">🌙</span>';
  if(t.plusIntlAuto) badges += '<span class="tv-badge-mini" title="Plus Internacional">🌍</span>';
  if(t.plusAct)      badges += '<span class="tv-badge-mini" title="Plus Activación">⚡</span>';
  if(t.plusJT)       badges += '<span class="tv-badge-mini" title="Plus JT">🕐</span>';
  if(badges) h += '<div class="tv-badges-row">'+badges+'</div>';

  // FIX — antes esto se excluía del todo en pernocta ("!esPernocta"),
  // así que en un día 1/2 o último día con tramo de continuidad nunca
  // salía el total, aunque sí tuviera datos. Ahora sale siempre que
  // haya algo que sumar — en pernocta se cuenta SOLO el lado de este
  // día concreto (mostrarIda/mostrarVuelta, ya calculados arriba),
  // para no mezclar horas del día 1 con las del día 2.
  var totalDiaMin = calcularTotalDiaMin(t, mostrarIda, mostrarVuelta);
  if(totalDiaMin > 0 && !ocultarTotalDia){
    h += '<div class="tv-total-dia" style="display:flex;align-items:center;justify-content:space-between;'
      +'background:rgba(59,127,255,.08);border:1px solid rgba(59,127,255,.25);border-radius:10px;'
      +'padding:9px 13px;margin-bottom:8px">'
      +'<span style="font-size:11px;font-weight:800;color:var(--acc2)">⏱ TOTAL DEL DÍA</span>'
      +'<span style="font-size:15px;font-weight:900;color:var(--tx);font-variant-numeric:tabular-nums">'
      +Math.floor(totalDiaMin/60)+'h '+pad(totalDiaMin%60)+'m</span>'
      +'</div>';
  }

  // ═══ Bloque IDA ═══ (solo si corresponde al día seleccionado)
  if(mostrarIda && (t.numTren || (t.sal&&t.lle))){
    var infoDHIda = obtenerInfoDHTramo(t, 'ida');
    var idaEsDH = !!infoDHIda;
    var numIdaHTML = '';

    if(infoDHIda && infoDHIda.mismoTren){
      var trenA = infoDHIda.origenEsBase ? infoDHIda.trenServicio+'-DH' : infoDHIda.trenServicio;
      var trenB = infoDHIda.origenEsBase ? infoDHIda.trenServicio       : infoDHIda.trenServicio+'-DH';
      numIdaHTML = '<div class="tv-num-row">'
        + '<span class="tv-num-part'+(infoDHIda.origenEsBase?' tv-num-dh':'')+'">'+trenA+'</span>'
        + '<span class="tv-num-sep">/</span>'
        + '<span class="tv-num-part'+(!infoDHIda.origenEsBase?' tv-num-dh':'')+'">'+trenB+'</span>'
        + '</div>';
    } else if(infoDHIda){
      numIdaHTML = '<div class="tv-num-row">'
        + '<span class="tv-num-part tv-num-dh">Tren DH: '+infoDHIda.trenDH+' (DH)</span>'
        + '<span class="tv-num-sep">|</span>'
        + '<span class="tv-num-part">Tren Servicio: '+infoDHIda.trenServicio+'</span>'
        + '</div>';
    } else if(t.numTren){
      numIdaHTML = '<div class="tv-num">'+t.numTren+'</div>';
    }

    var dhIdaTag = '';
    if(idaEsDH){
      dhIdaTag = '<div class="tv-dh-tag">'
        + '<span class="tv-dh-badge">🔀 DH</span>'
        + '<span class="tv-dh-detail">'+(t.estadoServicioDetalle||'servicio parcial')+'</span>'
        + '</div>';
    }

    // NUEVO — Confirmado por Alex: cuando este bloque en realidad
    // pertenece al día de la VUELTA (o intermedio) de una pernocta —
    // dispara aquí porque guarda sus datos en los mismos campos que
    // "ida" (sal/hF/hL/numTren), no porque lo sea — la etiqueta debe
    // decir lo que es de verdad, no "IDA". El resto del bloque (DH,
    // ruta, horas, "Viajas con") ya sale igual, solo cambia el rótulo.
    var etiquetaBloqueIda = '🚂 IDA';
    if(t.tipo==='vuelta-pernocta') etiquetaBloqueIda = '↩ VUELTA';
    else if(t.tipo==='pernocta3-intermedio') etiquetaBloqueIda = '🏨 TRAMO INTERMEDIO';

    h += '<div class="tv-block ida'+(idaEsDH?' tv-block-dh':'')+'">'
      + '<div class="tv-block-tag">'+etiquetaBloqueIda+'</div>'
      + numIdaHTML
      + dhIdaTag
      + (t.sal&&t.lle?'<div class="tv-route">'+t.sal+' → '+t.lle+'</div>':'')
      + (t.hF&&t.hL?'<div class="tv-hours">'+t.hF+' – '+t.hL+'</div>':'')
      // FIX: desglose del total de este tramo (antes el pop-up solo
      // mostraba el total del primer tramo, arriba en la cabecera).
      + (t.hF&&t.hL?'<div class="tv-hours" style="opacity:.65;font-size:10px">⏱ Duración: '+calcDur(t.hF,t.hL)+'</div>':'')
      // NUEVO — "con quién viajas": hueco que se rellena solo, en
      // cuanto este detalle se muestra en pantalla (ver el disparador
      // al final de renderDiaArea). Solo si hay un número de tren
      // claro (no en casos DH mixtos, más complejos de identificar).
      + (t.numTren&&selDay&&selDay.k ? _huecoCompaneros(t.numTren, selDay.k) : '')
      + '</div>';

    // Tramos de continuidad (T2, T3...): un bloque independiente por
    // cada uno, con su propio nº de tren y horario. Se muestran
    // SIEMPRE que existan, tenga o no DH activo el tramo principal —
    // son datos independientes y no deben ocultarse entre sí.
    if(t.continuidad && t.continuidad.length){
      t.continuidad.forEach(function(c, idx){
        if(!c || !c.tren) return;
        var dhInfoTxt = (c.tipoTramo==='dh' && (c.dhHasta||c.dhHoraInicio))
          ? '<div class="tv-dh-tag"><span class="tv-dh-badge">🔀 DH</span>'
            + '<span class="tv-dh-detail">'+((c.dhDesde||'inicio')+' → '+(c.dhHasta||'?'))
            + (c.dhHoraInicio&&c.dhHoraFin?' · '+c.dhHoraInicio+'–'+c.dhHoraFin:'')+'</span></div>'
          : '';
        h += '<div class="tv-block ida'+(c.tipoTramo==='dh'?' tv-block-dh':'')+'">'
          + '<div class="tv-block-tag">🚆 CONT. '+(idx+2)+(c.tipoTramo==='dh'?' · DH':'')+'</div>'
          + '<div class="tv-num">'+c.tren+'</div>'
          + dhInfoTxt
          + (c.salida&&c.llegada?'<div class="tv-route">'+c.salida+' → '+c.llegada+'</div>':'')
          + (c.horaInicio&&c.horaFin?'<div class="tv-hours">'+c.horaInicio+' – '+c.horaFin+'</div>':'')
          + (c.escalaMin!=null?'<div class="tv-route">⏳ Escala: '+c.escalaMin+' min</div>':'')
          + '<div class="tv-hours" style="opacity:.65;font-size:9px">'
          + _etiquetaRepartoDH(c)+'</div>'
          + (c.tren&&selDay&&selDay.k ? _huecoCompaneros(c.tren, selDay.k) : '')
          + '</div>';
      });
    }
  }

  // ═══ Bloque INTERMEDIO (pernocta3, día 2) ═══
  // Lee datos PROPIOS del registro del día intermedio, no del origen.
  if(esPernocta3 && tipoClicado === 'pernocta3-intermedio'){
    // El día intermedio tiene sus propios datos (t = turno origen).
    // Pero para renderizar el día 2, necesitamos leer TV[selDay.k] directamente.
    var tInt = tClicadoRaw || {};
    var tieneTramoInt = tInt.numTren || (tInt.sal && tInt.lle);
    if(tieneTramoInt){
      h += '<div class="tv-block" style="border-left:3px solid var(--violet2)">'
        + '<div class="tv-block-tag">🏨 TRAMO INTERMEDIO</div>'
        + (tInt.numTren?'<div class="tv-num">'+tInt.numTren+'</div>':'')
        + (tInt.sal&&tInt.lle?'<div class="tv-route">'+tInt.sal+' → '+tInt.lle+'</div>':'')
        + (tInt.hF&&tInt.hL?'<div class="tv-hours">'+tInt.hF+' – '+tInt.hL+'</div>':'')
        + '</div>';
    } else {
      h += '<div class="tv-block" style="border-left:3px solid var(--violet2)">'
        + '<div class="tv-block-tag">🏨 DÍA INTERMEDIO</div>'
        + '<div style="font-size:11px;color:var(--tx3);padding:4px 0">Sin datos de servicio registrados para este día.</div>'
        + '</div>';
    }
  }

  // ═══ Bloque VUELTA ═══ (solo si corresponde al día seleccionado)
  if(mostrarVuelta && (t.numTrenVuelta || (t.sal2&&t.lle2))){
    var esP = t.modo==='pernocta'||t.modo==='pernocta3';
    var infoDHVta = obtenerInfoDHTramo(t, 'vuelta');
    var vtaEsDH = !!infoDHVta;
    var numVtaHTML = '';

    if(infoDHVta && infoDHVta.mismoTren){
      var vA = infoDHVta.origenEsBase ? infoDHVta.trenServicio+'-DH' : infoDHVta.trenServicio;
      var vB = infoDHVta.origenEsBase ? infoDHVta.trenServicio       : infoDHVta.trenServicio+'-DH';
      numVtaHTML = '<div class="tv-num-row">'
        + '<span class="tv-num-part'+(infoDHVta.origenEsBase?' tv-num-dh':'')+'">'+vA+'</span>'
        + '<span class="tv-num-sep">/</span>'
        + '<span class="tv-num-part'+(!infoDHVta.origenEsBase?' tv-num-dh':'')+'">'+vB+'</span>'
        + '</div>';
    } else if(infoDHVta){
      numVtaHTML = '<div class="tv-num-row">'
        + '<span class="tv-num-part tv-num-dh">Tren DH: '+infoDHVta.trenDH+' (DH)</span>'
        + '<span class="tv-num-sep">|</span>'
        + '<span class="tv-num-part">Tren Servicio: '+infoDHVta.trenServicio+'</span>'
        + '</div>';
    } else if(t.numTrenVuelta){
      numVtaHTML = '<div class="tv-num">'+t.numTrenVuelta+'</div>';
    }

    var dhVtaTag = '';
    if(vtaEsDH){
      dhVtaTag = '<div class="tv-dh-tag">'
        + '<span class="tv-dh-badge">🔀 DH</span>'
        + '<span class="tv-dh-detail">'+(t.estadoServicioVueltaDetalle||'servicio parcial')+'</span>'
        + '</div>';
    }

    h += '<div class="tv-block vuelta'+(vtaEsDH?' tv-block-dh':'')+'">'
      + '<div class="tv-block-tag">'+(esP?'🌙 VUELTA':'↩ VUELTA')+'</div>'
      + numVtaHTML
      + dhVtaTag
      + (t.sal2&&t.lle2?'<div class="tv-route">'+t.sal2+' → '+t.lle2+'</div>':'')
      + (t.hF2&&t.hL2?'<div class="tv-hours">'+t.hF2+' – '+t.hL2+'</div>':'')
      // FIX: desglose del total de este tramo, igual que en IDA.
      + (t.hF2&&t.hL2?'<div class="tv-hours" style="opacity:.65;font-size:10px">⏱ Duración: '+calcDur(t.hF2,t.hL2)+'</div>':'')
      // NUEVO — "con quién viajas", igual que en IDA.
      + (t.numTrenVuelta&&selDay&&selDay.k ? _huecoCompaneros(t.numTrenVuelta, selDay.k) : '')
      + '</div>';

    // Tramos de continuidad de la vuelta (T2, T3...): se muestran
    // siempre que existan, tenga o no DH activo el tramo de vuelta.
    if(t.continuidadVuelta && t.continuidadVuelta.length){
      t.continuidadVuelta.forEach(function(c, idx){
        if(!c || !c.tren) return;
        var dhInfoTxtV = (c.tipoTramo==='dh' && (c.dhHasta||c.dhHoraInicio))
          ? '<div class="tv-dh-tag"><span class="tv-dh-badge">🔀 DH</span>'
            + '<span class="tv-dh-detail">'+((c.dhDesde||'inicio')+' → '+(c.dhHasta||'?'))
            + (c.dhHoraInicio&&c.dhHoraFin?' · '+c.dhHoraInicio+'–'+c.dhHoraFin:'')+'</span></div>'
          : '';
        h += '<div class="tv-block vuelta'+(c.tipoTramo==='dh'?' tv-block-dh':'')+'">'
          + '<div class="tv-block-tag">🚆 CONT. '+(idx+2)+(c.tipoTramo==='dh'?' · DH':'')+'</div>'
          + '<div class="tv-num">'+c.tren+'</div>'
          + dhInfoTxtV
          + (c.salida&&c.llegada?'<div class="tv-route">'+c.salida+' → '+c.llegada+'</div>':'')
          + (c.horaInicio&&c.horaFin?'<div class="tv-hours">'+c.horaInicio+' – '+c.horaFin+'</div>':'')
          + (c.escalaMin!=null?'<div class="tv-route">⏳ Escala: '+c.escalaMin+' min</div>':'')
          + '<div class="tv-hours" style="opacity:.65;font-size:9px">'
          + _etiquetaRepartoDH(c)+'</div>'
          + (c.tren&&selDay&&selDay.k ? _huecoCompaneros(c.tren, selDay.k) : '')
          + '</div>';
      });
    }
  }

  if(!h) h = '<div style="font-size:11px;color:var(--tx3);padding:6px 0">Sin datos de tren para este turno.</div>';

  return h;
}

// Lleva al usuario del pop-up al listado "Turnos del mes" (acordeón),
// donde vive el detalle completo del día. No duplica datos, solo
// navega y expande la entrada correspondiente si existe.
function verDetallesEnHistorial(k){
  closeOv('ov-dia-card');
  // NUEVO: si el acordeón general "Turnos del mes" está plegado,
  // se despliega primero — si no, el salto al día concreto quedaría
  // oculto dentro de un contenedor invisible.
  var contAcordeon = document.getElementById('acordeon');
  if(contAcordeon && contAcordeon.style.display === 'none'){
    toggleTurnosMesAcordeon();
  }
  setTimeout(function(){
    var id = 'ac-'+k;
    var el = document.getElementById(id);
    if(el){
      if(!el.classList.contains('open')) toggleAc(id);
      el.scrollIntoView({behavior:'smooth', block:'center'});
    } else {
      toast('Este día no aparece en el listado del mes visible');
    }
  }, 160);
}
