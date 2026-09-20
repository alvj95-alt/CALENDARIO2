/* TrenTurnos v5 — Tarjetas y acordeones de turno (multi-turno)
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ─────────────────────────────────────────────────────────── */


/* ═══════════════════════════════════════════════════════════
   MÓDULO MULTI-TURNO — renderTarjetaTurno
   Renderiza cualquier turno (principal o extra) como tarjeta.
   No toca TV[], TV2[], ni lógica de guardado.
   Solo visualización.
═══════════════════════════════════════════════════════════ */
function renderTarjetaTurno(turno, k, esExtra, idxExtra){
  if(!turno) return '';
  var t   = turno;
  var ti  = TIPO_INFO[t.tipo] || {ico:'📋', lbl:t.tipo||'Turno', col:'var(--tx2)'};
  var kp  = k.split('-').map(Number);
  var y=kp[0], mo=kp[1], dd=kp[2];
  var dt  = new Date(y, mo-1, dd);
  var DIAS_H = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var wd  = dt.getDay();

  // Cabecera de la tarjeta
  var header = '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px 8px;'
    + 'background:var(--s2);border-bottom:1px solid var(--div)'
    + (esExtra?';border-top:2px solid rgba(99,102,241,.3)':'')+'">'
    + '<span style="font-size:22px">'+ti.ico+'</span>'
    + '<div style="flex:1">'
    + '<div style="font-size:9px;font-weight:800;letter-spacing:.6px;color:'+(esExtra?'var(--acc)':'var(--tx3)')+';">'
    + (esExtra ? 'TURNO ADICIONAL '+(idxExtra+1) : DIAS_H[wd]+' '+dd+' '+MESES_C[mo-1])
    + '</div>'
    + '<div style="font-size:14px;font-weight:800;color:'+ti.col+'">'+ti.lbl+'</div>'
    + '</div>'
    + (t.nocturno ? '<span title="Nocturnidad" style="font-size:16px">🌙</span>' : '')
    + (t.plusIntlAuto ? '<span title="Plus Internacional" style="font-size:16px">🌍</span>' : '')
    + '<div style="display:flex;gap:4px;margin-left:4px">'
    + '<button onclick="'+(esExtra ? "editarTurnoExtra('"+k+"',"+idxExtra+")" : "editarTurno()")+'" '
      + 'style="background:rgba(37,99,235,.12);border:1px solid rgba(37,99,235,.3);'
      + 'border-radius:7px;color:var(--acc2);font-size:10px;padding:2px 8px;cursor:pointer">✏️</button>'
    + '<button onclick="'+(esExtra ? "eliminarTurnoExtra('"+k+"',"+idxExtra+")" : "pedirEliminar()")+'" '
      + 'style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);'
      + 'border-radius:7px;color:#f87171;font-size:10px;padding:2px 8px;cursor:pointer">🗑</button>'
    + '</div>'
    + '</div>';

  // Filas de detalle
  var rows = '';
  var fila = function(lbl, val, col){
    if(!val) return '';
    return '<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 14px;border-bottom:1px solid var(--div)">'
      + '<span style="font-size:9px;font-weight:800;letter-spacing:.4px;color:var(--tx3);min-width:56px;padding-top:2px">'+lbl+'</span>'
      + '<span style="font-size:12px;color:'+(col||'var(--tx2)')+';font-weight:600;flex:1;line-height:1.4;min-width:0;word-wrap:break-word;overflow-wrap:break-word;white-space:normal">'+val+'</span>'
      + '</div>';
  };

  // Marca visual — no sustituye a las filas de tren/horario normales
  // (que siguen mostrando lo que trabajaste), solo añade el aviso de
  // que este bloque no computa en los contadores.
  if(t.turno_referencia_externa){
    var tipoServicioLbl = {idaVuelta:'Ida y Vuelta', pernocta2:'Pernocta 2 días', pernocta3:'Pernocta 3 días'}[t.tipoServicio] || '';
    rows += '<div style="display:flex;align-items:center;gap:8px;padding:9px 14px;'
      + 'background:rgba(245,158,11,.1);border-bottom:1px solid var(--div)">'
      + '<span style="font-size:14px">📎</span>'
      + '<span style="font-size:11px;font-weight:800;color:var(--amber2)">'
      + 'Referencia Informativa'+(t.companeroNombre?' — '+t.companeroNombre:'')+': No computa para horas'
      + '</span></div>';
    // Aviso de Desajuste — no bloqueó el registro, solo lo señala aquí
    // en el historial (ver validación en guardarRegistroIntercambio()).
    if(t.avisoDesajuste){
      rows += '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;'
        + 'background:rgba(220,38,38,.12);border-bottom:1px solid var(--div)">'
        + '<span style="font-size:14px">⚠️</span>'
        + '<span style="font-size:10px;font-weight:800;color:var(--red2)">'
        + 'Aviso de Desajuste — el tipo de servicio no coincide con tu jornada habitual'
        + '</span></div>';
    }
    if(t.companeroMatricula) rows += fila('MATRÍCULA', t.companeroMatricula, 'var(--tx2)');
    if(tipoServicioLbl) rows += fila('SERVICIO', tipoServicioLbl, 'var(--tx2)');
    // TREN DÍA 3 — el único tren que no cubren las filas genéricas
    // TREN IDA / TREN VUELTA de más abajo (que ya leen t.numTren /
    // t.numTrenVuelta). Solo aparece en Pernocta 3 días.
    if(t.trenes && t.trenes.dia3) rows += fila('TREN DÍA 3', '🚆 #'+t.trenes.dia3, 'var(--amber2)');
    // Recorre TODOS los tramos guardados (ida+vuelta, o los días de
    // la pernocta) — nunca solo el primero. t.tramos es el campo
    // actual; t.dias se mantiene por compatibilidad con registros
    // guardados antes de esta corrección (usaba etiqueta "DÍA N" fija).
    (t.tramos || t.dias || []).forEach(function(d, idx){
      var trenTxt = d.tren ? '🚆 #'+d.tren : '';
      var rutaTxt = (d.estacionInicio||d.estacionFinal) ? (d.estacionInicio||'—')+' → '+(d.estacionFinal||'—') : '';
      var horaTxt = (d.horaInicio&&d.horaFinal) ? d.horaInicio+' – '+d.horaFinal : '';
      var valorTxt = [trenTxt, rutaTxt, horaTxt].filter(Boolean).join(' · ');
      var etiqueta = d.etiqueta || ('DÍA '+(idx+1));
      if(valorTxt) rows += fila(etiqueta, valorTxt, 'var(--tx)');
    });
  } else if(t.esTurnoIntercambiado){
    // Compatibilidad con registros guardados con el formato anterior
    rows += '<div style="display:flex;align-items:center;gap:8px;padding:9px 14px;'
      + 'background:rgba(245,158,11,.1);border-bottom:1px solid var(--div)">'
      + '<span style="font-size:14px">🔁</span>'
      + '<span style="font-size:11px;font-weight:800;color:var(--amber2)">'
      + 'Turno de cambio'+(t.companeroNombre?' con '+t.companeroNombre:'')+': No computa para horas'
      + '</span></div>';
    if(t.estacionInicio||t.estacionFinal)
      rows += fila('RUTA', (t.estacionInicio||'—')+' → '+(t.estacionFinal||'—'), 'var(--tx)');
  }

  // Tren ida (+ tramos de continuidad, si los hay) — una fila por tramo
  if(t.numTren){
    rows += fila('TREN IDA', '🚆 #'+t.numTren, 'var(--nar2)');
    (t.continuidad||[]).forEach(function(c, idx){
      if(!c.tren) return;
      var horaTxt = (c.horaInicio&&c.horaFin) ? ' · '+c.horaInicio+'–'+c.horaFin : '';
      rows += fila('CONT. '+(idx+2), '🚆 #'+c.tren+horaTxt, 'var(--nar2)');
    });
  }
  // Ruta ida
  if(t.sal||t.lle)
    rows += fila('IDA', (t.sal||'—')+' → '+(t.lle||'—'), 'var(--tx)');
  // Horario ida
  if(t.hF||t.hL)
    rows += fila('HORARIO', (t.hF||'—')+' – '+(t.hL||'—'), 'var(--tx2)');
  // Tren vuelta (+ tramos de continuidad, si los hay) — una fila por tramo
  if(t.numTrenVuelta){
    rows += fila('TREN VUELTA', (t.modo==='pernocta'?'🌙 ':'↩ ')+'#'+t.numTrenVuelta, 'var(--amber2)');
    (t.continuidadVuelta||[]).forEach(function(c, idx){
      if(!c.tren) return;
      var horaTxtV = (c.horaInicio&&c.horaFin) ? ' · '+c.horaInicio+'–'+c.horaFin : '';
      rows += fila('CONT. '+(idx+2), '🚆 #'+c.tren+horaTxtV, 'var(--amber2)');
    });
  }
  // Ruta vuelta
  if(t.sal2||t.lle2)
    rows += fila('VUELTA', (t.sal2||'—')+' → '+(t.lle2||'—'), 'var(--tx)');
  // Horario vuelta
  if(t.hF2||t.hL2)
    rows += fila('H. VUELTA', (t.hF2||'—')+' – '+(t.hL2||'—'), 'var(--tx2)');
  // Línea
  if(t.linea)
    rows += fila('LÍNEA', t.linea, 'var(--tx2)');
  // Base (de AJ)
  if(!esExtra && AJ.base)
    rows += fila('BASE', AJ.base, 'var(--tx3)');
  // HTDL / Compensación
  if(t.comp==='dinero' && t.importe)
    rows += fila('HTDL', t.importe.toFixed(2)+' €', 'var(--acc2)');
  if(t.comp==='dias' && t.diasComp && t.diasComp.length)
    rows += fila('COMP.', t.diasComp.length+' días asignados', 'var(--cyan2)');
  // Retrasos
  if(t.retrasos && t.retrasos.length){
    var retTxt = t.retrasos.map(function(r){
      return 'T'+r.tramo+' +'+r.minutos+'min'+(r.tren?' #'+r.tren:'');
    }).join(' · ');
    rows += fila('RETRASO', '⏱ '+retTxt, 'var(--amber2)');
  } else if(t.retrasoMin > 0){
    rows += fila('RETRASO', '⏱ +'+t.retrasoMin+' min', 'var(--amber2)');
  }
  // Nota
  if(t.notas && t.notas.trim())
    rows += fila('NOTA', t.notas.trim(), 'var(--acc)');

  var borderColor = esExtra ? 'rgba(99,102,241,.25)' : 'var(--div)';
  return '<div style="border:1px solid '+borderColor+';border-radius:12px;overflow:hidden;'
    + 'margin-bottom:8px;background:var(--s1);box-shadow:var(--sh-card)">'
    + header
    + (rows || '<div style="padding:10px 14px;font-size:11px;color:var(--tx3)">'+ti.lbl+' registrado</div>')
    + '</div>';
}
/* ═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   MÓDULO MULTI-TURNO — renderDiaAreaMulti
   Lee TV[k] (principal) + TV2[k][] (extras) y renderiza
   una tarjeta por turno en el modal ov-dia-card.
   Se llama desde renderDiaArea cuando el modal está abierto
   y hay más de un turno en el día.
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   NUEVO — renderAccordionTurno(turno, k, esExtra, idxExtra, abiertoPorDefecto)
   Pinta UN turno del día como sección de acordeón (mismo componente
   visual .acc-section/.acc-head/.acc-body que ya usa el Buscador de
   Compañeros), con la cabecera de siempre (icono, etiqueta, editar/
   eliminar) y el CUERPO reutilizando renderizarPopUpSimplificado —
   así el multi-turno se ve exactamente igual que un día normal
   (cajas de tramo con borde) y también dispara la búsqueda de
   compañeros de viaje, que antes no aparecía aquí.
   El toggle de abrir/cerrar es un onclick inline autocontenido (no
   depende del listener delegado que solo engancha los .acc-head
   presentes en el DOM al cargar la página).
═══════════════════════════════════════════════════════════ */
function renderAccordionTurno(turno, k, esExtra, idxExtra, abiertoPorDefecto, tipoHTDLDia){
  if(!turno) return '';
  var t  = turno;
  var esVueltaInformativa = !!t.vueltaPernoctaInformativa;
  var ti = TIPO_INFO[t.tipo] || {ico:'📋', lbl:t.tipo||'Turno', col:'var(--tx2)'};
  // Si el día es HTDL/Art.51-52 (turno principal) y este es un turno
  // adicional guardado con otro tipo (p.ej. 'ordinario'), se muestra
  // con el mismo icono/etiqueta/color que el principal — visualmente
  // ya no existen turnos mixtos, aunque el dato guardado no cambie.
  if(esExtra && tipoHTDLDia && t.tipo!==tipoHTDLDia && TIPO_INFO[tipoHTDLDia]){
    ti = TIPO_INFO[tipoHTDLDia];
  }
  // NUEVO — la vuelta/intermedio informativa tiene su propio icono y
  // color (verde, como el resto de avisos "ya contado"), en vez del
  // genérico de 'ordinario'.
  if(esVueltaInformativa){
    ti = {ico:'🌙', lbl:'Vuelta Pernocta', col:'var(--green2)'};
  }

  var editBtn = '<button onclick="event.stopPropagation();'
    + (esExtra ? "editarTurnoExtra('"+k+"',"+idxExtra+")" : 'editarTurno()')
    + '" style="background:rgba(37,99,235,.12);border:1px solid rgba(37,99,235,.3);'
    + 'border-radius:7px;color:var(--acc2);font-size:10px;padding:3px 8px;cursor:pointer">✏️</button>';
  var delBtn = '<button onclick="event.stopPropagation();'
    + (esExtra ? "eliminarTurnoExtra('"+k+"',"+idxExtra+")" : 'pedirEliminar()')
    + '" style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);'
    + 'border-radius:7px;color:#f87171;font-size:10px;padding:3px 8px;cursor:pointer">🗑</button>';
  // NUEVO — la vuelta informativa no se edita (no es un turno tuyo
  // real editable), solo se puede quitar la nota si hiciera falta.
  if(esVueltaInformativa) editBtn = '';

  var header = '<div class="acc-head" style="cursor:pointer" '
    + 'onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
    + '<div class="acc-ico" style="background:transparent;font-size:20px">'+ti.ico+'</div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:9px;font-weight:800;letter-spacing:.6px;color:'+(esExtra?'var(--acc)':'var(--tx3)')+'">'
    + (esVueltaInformativa ? 'VUELTA PERNOCTA' : (esExtra ? 'TURNO ADICIONAL '+(idxExtra+1) : 'TURNO PRINCIPAL'))
    + '</div>'
    + '<div style="font-size:14px;font-weight:800;color:'+ti.col+'">'+ti.lbl
    // FIX — en pernocta, hL2 es la llegada del día 2, no de hoy: no se
    // mezcla con hF (inicio de hoy) para evitar un rango engañoso tipo
    // "08:00–12:00" cuando lo real de hoy es "08:00–11:00". Solo se usa
    // hF–hL2 cuando ida y vuelta son del MISMO día (turno normal).
    + (t.hF ? ' · '+t.hF+(((t.hL2)&&t.modo!=='pernocta'&&t.modo!=='pernocta3')?'–'+t.hL2:(t.hL?'–'+t.hL:'')) : '')
    + '</div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:5px">'+editBtn+delBtn
    + '<div class="acc-chev">›</div></div>'
    + '</div>';

  var cuerpo = '';
  // NUEVO — vuelta/intermedio de pernocta protegido: tarjeta con
  // detalle real (tren, ruta, horario), igual que vería un turno de
  // pernocta normal, pero dejando claro que el dinero ya está
  // contado completo en el día de origen — no se suma nada aquí.
  if(t.vueltaPernoctaInformativa){
    var kop2 = (t.origenPernocta||'').split('-').map(Number);
    var lblOrig = kop2.length===3 ? (kop2[2]+' de '+MESES[kop2[1]-1].toLowerCase()) : '';
    cuerpo += '<div style="display:flex;align-items:center;gap:8px;padding:9px 0;'
      + 'border-bottom:1px solid var(--div);margin-bottom:10px">'
      + '<span style="font-size:14px">💰</span>'
      + '<span style="font-size:10.5px;font-weight:800;color:var(--green2)">'
      + 'Ya contado completo el día '+lblOrig+' — aquí no suma nada aparte'
      + '</span></div>';
    if(t.numTren){
      cuerpo += '<div style="background:var(--s2);border:1px solid var(--div);border-radius:11px;padding:11px 13px;margin-bottom:8px">'
        + '<div style="font-size:9px;color:var(--tx3);font-weight:700;margin-bottom:3px">TREN</div>'
        + '<div style="font-size:14px;font-weight:800;color:var(--tx)">'+t.numTren+'</div></div>';
    }
    if(t.sal || t.lle){
      cuerpo += '<div style="background:var(--s2);border:1px solid var(--div);border-radius:11px;padding:11px 13px;margin-bottom:8px">'
        + '<div style="font-size:9px;color:var(--tx3);font-weight:700;margin-bottom:3px">RUTA</div>'
        + '<div style="font-size:13px;font-weight:700;color:var(--tx)">'+(t.sal||'—')+' → '+(t.lle||'—')+'</div></div>';
    }
    if(t.hF || t.hL){
      cuerpo += '<div style="background:var(--s2);border:1px solid var(--div);border-radius:11px;padding:11px 13px">'
        + '<div style="font-size:9px;color:var(--tx3);font-weight:700;margin-bottom:3px">HORARIO</div>'
        + '<div style="font-size:14px;font-weight:800;color:var(--tx)">'+(t.hF||'—')+' – '+(t.hL||'—')+'</div></div>';
    }
  } else if(t.turno_referencia_externa){
    var tipoServicioLbl = {idaVuelta:'Ida y Vuelta', pernocta2:'Pernocta 2 días', pernocta3:'Pernocta 3 días'}[t.tipoServicio] || '';
    cuerpo += '<div style="display:flex;align-items:center;gap:8px;padding:9px 0;'
      + 'border-bottom:1px solid var(--div);margin-bottom:8px">'
      + '<span style="font-size:14px">📎</span>'
      + '<span style="font-size:11px;font-weight:800;color:var(--amber2)">'
      + 'Referencia Informativa'+(t.companeroNombre?' — '+t.companeroNombre:'')+': No computa para horas'
      + '</span></div>';
    if(t.avisoDesajuste){
      cuerpo += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;'
        + 'border-bottom:1px solid var(--div);margin-bottom:8px">'
        + '<span style="font-size:14px">⚠️</span>'
        + '<span style="font-size:10px;font-weight:800;color:var(--red2)">'
        + 'Aviso de Desajuste — el tipo de servicio no coincide con tu jornada habitual'
        + '</span></div>';
    }
    // NUEVO — si al registrar el cambio marcaste que tu compañero
    // tenía descanso ese día, se muestra el aviso + el botón para,
    // si al final SÍ trabajas, convertirlo en HTDL/Art.51-52. Tu
    // turno original (arriba) sigue contando sus horas exactamente
    // igual — esto solo AÑADE un turno adicional aparte si eliges
    // trabajarlo, nunca sustituye ni borra nada.
    if(t.companeroTeniaDescanso){
      cuerpo += '<div style="display:flex;align-items:center;gap:8px;padding:9px 0;'
        + 'border-bottom:1px solid var(--div);margin-bottom:8px">'
        + '<span style="font-size:14px">🧘</span>'
        + '<span style="font-size:11px;font-weight:800;color:var(--green2)">'
        + 'Descansas hoy (cambio'+(t.companeroNombre?' con '+t.companeroNombre:'')+')'
        + '</span></div>'
        + '<button onclick="event.stopPropagation();abrirConversionCambioDescanso(\''+k+'\')" '
        + 'style="width:100%;margin-bottom:8px;padding:9px;background:rgba(139,92,246,.1);'
        + 'border:1px solid rgba(139,92,246,.3);border-radius:9px;color:#C4B5FD;font-size:12px;'
        + 'font-weight:700;cursor:pointer">💼 He trabajado este descanso</button>';
    }
  }
  if(!t.vueltaPernoctaInformativa){
    // NUEVO — Confirmado por Alex: el día de la vuelta debe mostrar
    // también sus tramos de continuidad (ej. la escala de Madrid antes
    // de llegar a Barcelona), no solo el primer tramo. Esos tramos
    // viven guardados en el día de ORIGEN (continuidadVuelta) — aquí
    // solo se toman prestados para PINTARLOS, sin duplicar el dato
    // real ni tocar TV, así que no hay riesgo de que se desincronicen
    // si editas uno de los dos días.
    var tParaMostrar = t;
    if((t.tipo==='vuelta-pernocta') && t.origenPernocta && TV[t.origenPernocta] &&
       TV[t.origenPernocta].continuidadVuelta && TV[t.origenPernocta].continuidadVuelta.length &&
       (!t.continuidad || !t.continuidad.length)){
      tParaMostrar = {};
      for(var _kcv in t) tParaMostrar[_kcv] = t[_kcv];
      tParaMostrar.continuidad = TV[t.origenPernocta].continuidadVuelta;
    }
    cuerpo += renderizarPopUpSimplificado(tParaMostrar, false, true);
  }
  if(t.notas && t.notas.trim()){
    cuerpo += '<div style="margin-top:8px;padding:8px 0;border-top:1px solid var(--div);'
      + 'font-size:11px;color:var(--acc)"><b style="color:var(--tx3);font-size:9px;'
      + 'letter-spacing:.4px">NOTA</b><br>'+t.notas.trim()+'</div>';
  }

  return '<div class="acc-section'+(abiertoPorDefecto?' open':'')+'" '
    + 'style="margin:0 0 8px;'+(esExtra?'border-color:rgba(99,102,241,.35)':'')+'">'
    + header
    + '<div class="acc-body"><div class="acc-body-inner" style="padding:10px 14px">'+cuerpo+'</div></div>'
    + '</div>';
}

function renderDiaAreaMulti(){
  if(!selDay) return;
  var k   = selDay.k;
  var all = getTurnosDia(k);   // TV[k] + TV2[k][] — función existente
  if(!all.length) return;

  var ovCard  = document.getElementById('ov-dia-card');
  var useModal= ovCard && ovCard.classList.contains('on');
  var area    = useModal
    ? document.getElementById('dia-card-body')
    : document.getElementById('dia-area');
  if(!area) return;

  var kp = k.split('-').map(Number);
  var DIAS_H = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var dt = new Date(kp[0],kp[1]-1,kp[2]);
  var fechaTxt = DIAS_H[dt.getDay()]+', '+kp[2]+' de '+MESES[kp[1]-1].toLowerCase()+' de '+kp[0];

  // Cabecera del modal con fecha y conteo
  var html = '<div style="padding:8px 14px 6px;background:var(--s2);border-bottom:1px solid var(--div)">'
    + '<div style="font-size:10px;font-weight:800;color:var(--tx3);letter-spacing:.5px">'+fechaTxt+'</div>'
    + '<div style="font-size:12px;color:var(--tx2);margin-top:2px">'
    + all.length+' turno'+(all.length>1?'s registrados':' registrado')+'</div>'
    + '</div>';

  // Contenedor con scroll
  html += '<div style="overflow-y:auto;max-height:65vh;padding:10px 10px 0">';

  // NUEVO — TOTAL DEL DÍA COMBINADO: un único total arriba de los
  // acordeones (no uno repetido por turno), calculado con la misma
  // función que ya usan Stats (calcularJornadaDiaria) para que el
  // número mostrado aquí sea siempre coherente con el que se paga/
  // cuenta — incluye ambos turnos, sus escalas internas y el hueco
  // entre turno 1 y turno 2, tal como corresponde a un día HTDL.
  // NUEVO — Confirmado por Alex: el "TOTAL DEL DÍA" combinado no debe
  // sumar un turno que pasó a secundario por haber sido pisado (era
  // el principal antes) — solo debe reflejar el turno nuevo. Esas
  // horas del turno viejo siguen contando en Stats del mes con
  // normalidad (calcularJornadaDiaria no cambia); aquí solo se filtra
  // qué entra en ESTE total concreto de la tarjeta del día.
  // NUEVO — Confirmado por Alex: cuando el día de la vuelta/intermedio
  // es el turno PRINCIPAL de ese día (por "Copiar turno" o por
  // registrarlo a mano encima de algo), su propio "TOTAL DEL DÍA"
  // debe mostrar sus horas — pero calcularJornadaDiaria() solo sabe
  // sumar tipo 'ordinario'/'trabajado'/'art5152', nunca
  // 'vuelta-pernocta'/'pernocta3-intermedio' (para el cálculo MENSUAL
  // eso está bien: esas horas ya se cuentan una vez, desde el día de
  // origen). Aquí, para ESTE total del día en concreto, se traduce
  // una copia SOLO PARA EL CÁLCULO (no se guarda nada) al tipo real
  // del origen, con sus propios datos como si fueran la "ida" de ese
  // día — así sus horas sí entran en la suma, sin tocar cómo vive
  // guardado ni duplicar nada en Stats del mes.
  var allParaTotal = all.filter(function(x){ return !x.esAntiguoPrincipal; }).map(function(x){
    if(x.tipo!=='vuelta-pernocta' && x.tipo!=='pernocta3-intermedio') return x;
    var origen = x.origenPernocta ? TV[x.origenPernocta] : null;
    var tipoReal = (origen && (origen.tipo==='trabajado'||origen.tipo==='art5152')) ? origen.tipo : 'ordinario';
    var traducido = {}; for(var _kt in x) traducido[_kt] = x[_kt];
    traducido.tipo = tipoReal;
    if(origen && origen.continuidadVuelta && origen.continuidadVuelta.length && (!x.continuidad||!x.continuidad.length)){
      traducido.continuidad = origen.continuidadVuelta;
    }
    return traducido;
  });
  var jornadaCombo = calcularJornadaDiaria(allParaTotal, k);
  // FIX — el total real del día es la suma de los CUATRO buckets. Antes
  // solo se sumaban efectivasMin+presenciaMin (bucket Ordinario), asi
  // que un dia mixto (Turno Principal Ordinario + Turno Adicional HTDL)
  // perdia por completo las horas HTDL del total mostrado aqui.
  var totalCalMin  = jornadaCombo.efectivasMin + jornadaCombo.presenciaMin;
  var totalHTDLMin = jornadaCombo.efectivasHTDLMin + jornadaCombo.presenciaHTDLMin;
  var totalComboMin = totalCalMin + totalHTDLMin;
  // NUEVO — si el turno principal es HTDL/Art.51-52, el día entero lo
  // es (no existen turnos mixtos): se propaga a los acordeones para
  // que los adicionales se VEAN también como HTDL, aunque su propio
  // campo 'tipo' guardado siga siendo 'ordinario' (el dinero ya los
  // trata como HTDL desde el fix anterior; esto es solo apariencia).
  var tipoHTDLDia = (all[0] && (all[0].tipo==='trabajado' || all[0].tipo==='art5152')) ? all[0].tipo : null;
  if(totalComboMin > 0){
    html += '<div style="background:rgba(59,127,255,.08);border:1px solid rgba(59,127,255,.25);'
      +'border-radius:10px;padding:9px 13px;margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between">'
      +'<span style="font-size:11px;font-weight:800;color:var(--acc2)">⏱ TOTAL DEL DÍA</span>'
      +'<span style="font-size:15px;font-weight:900;color:var(--tx);font-variant-numeric:tabular-nums">'
      +Math.floor(totalComboMin/60)+'h '+pad(totalComboMin%60)+'m</span>'
      +'</div>';
    // NUEVO — desglose de dónde vienen esas horas: solo se muestra
    // cuando el día combina AMBOS buckets (mixto); si es un día
    // homogéneo (todo Ordinario o todo HTDL) no aporta nada nuevo y
    // se omite para no repetir el mismo número dos veces.
    if(totalCalMin>0 && totalHTDLMin>0){
      html += '<div style="display:flex;gap:14px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(59,127,255,.2)">'
        +'<span style="font-size:10px;color:var(--tx3)">🚆 Ordinario: <b style="color:var(--tx2)">'
        +Math.floor(totalCalMin/60)+'h '+pad(totalCalMin%60)+'m</b></span>'
        +'<span style="font-size:10px;color:var(--tx3)">🚂 HTDL/Art.51-52: <b style="color:var(--tx2)">'
        +Math.floor(totalHTDLMin/60)+'h '+pad(totalHTDLMin%60)+'m</b></span>'
        +'</div>';
    }
    html += '</div>';
  }


  // NUEVO — acordeones: cada turno del día (principal + adicionales)
  // se pinta con el MISMO contenido que el modal de un solo turno
  // (renderizarPopUpSimplificado: cajas de tramo con borde + "Viajas
  // con"), colapsado por defecto salvo el primero, en vez de la
  // tarjeta plana anterior — resuelve que faltaran compañeros y que
  // el aspecto no coincidiera con el de un día normal.
  // FIX — Confirmado por Alex: el TURNO PRINCIPAL (all[0]) tiene que
  // salir SIEMPRE arriba del todo, y ser el que se abre por defecto —
  // antes el bucle iba al revés (de los adicionales hacia el
  // principal), así que el principal quedaba abajo y era el
  // adicional el que se abría solo.
  for(var ii=0; ii<all.length; ii++){
    html += renderAccordionTurno(all[ii], k, ii>0, ii-1, ii===0, tipoHTDLDia);
  }

  html += '</div>';

  // Botones de acción (Cambio/Añadir turno son globales del día;
  // Editar/Eliminar ya viven en cada tarjeta individual — ver arriba)
  var t = all[0];
  var retrasoMin = parseInt(t.retrasoMin)||0;
  html += '<div class="dct-foot-v2">'
    + '<div class="dct-row-main">'
    + '<button class="dct-btn-cambio" onclick="abrirCambio()">🔄 Cambio</button>'
    + '<button class="dct-btn-add" onclick="guardarTurnoExtra()">➕ Añadir turno</button>'
    + '</div>'
    + ((t.tipo==='ordinario'||t.tipo==='trabajado'||t.tipo==='art5152'||t.tipo==='vuelta-pernocta'||t.tipo==='pernocta3-intermedio')
      ? '<div class="dct-row-sec"><button class="dct-btn-sec sec-amber" onclick="abrirRetraso()">⏱ '+(retrasoMin>0?'+'+retrasoMin+'m':'Registrar retraso')+'</button></div>'
      : '')
    + ((t.tipo==='ordinario'||t.tipo==='trabajado'||t.tipo==='art5152'||t.tipo==='vuelta-pernocta'||t.tipo==='pernocta3-intermedio'||t.tipo==='descanso')
      ? '<div class="dct-row-sec"><button class="dct-btn-sec" onclick="abrirCopiarTurno(\''+k+'\')">📋 Copiar turno</button></div>'
      : '')
    + '</div>';

  area.innerHTML = html;

  // NUEVO — rellenar "Viajas con" en cada acordeón, igual que ya
  // hace renderDiaArea() para el camino de un solo turno. Antes esta
  // llamada no existía aquí, por eso los compañeros nunca aparecían
  // en un día con varios turnos.
  // FIX — Confirmado por Alex (mismo bug real, misma causa): mismo
  // mes real derivado de "k", para no comparar contra el Horario
  // General de un mes distinto al que se está viendo.
  var _mesDeEsteDia2 = (function(){ var p = k.split('-'); return {anio: parseInt(p[0],10), mes: parseInt(p[1],10)}; })();
  rellenarCompanerosAutomaticos(area, _mesDeEsteDia2);
}
