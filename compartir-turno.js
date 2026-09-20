/* TrenTurnos v5 — Compartir turno (imagen/texto)
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   MÓDULO COMPARTIR TURNO (Snapshot) — módulo independiente.
   Genera una imagen del turno seleccionado y la comparte con
   navigator.share() (WhatsApp, Telegram, Correo... lo que el
   usuario elija en el selector nativo). Sin librerías externas:
   la imagen se dibuja a mano sobre un <canvas>. Si el navegador
   no soporta compartir archivos, cae a copiar el texto del turno
   al portapapeles — nunca se queda sin hacer nada.
═══════════════════════════════════════════════════════════ */
function compartirTurnoSeleccionado(){
  if(!selDay || !selDay.t){ toast('Selecciona un turno primero'); return; }
  abrirModalCompartir();
}

// ── Modal de edición social — mensaje previo, editable, antes de generar la imagen ──
function abrirModalCompartir(){
  var input = document.getElementById('compartir-mensaje-input');
  if(input) input.value = 'Hola compis, cambio este turno por otro';
  openOv('ov-compartir-edit');
  setTimeout(function(){ if(input) input.focus(); }, 350);
}
function cancelarModalCompartir(){
  // Cierra sin dejar residuos: no se llama a generarSnapshot ni se
  // toca ninguna plantilla — el turno seleccionado queda intacto.
  closeOv('ov-compartir-edit');
}
function confirmarModalCompartir(){
  var input = document.getElementById('compartir-mensaje-input');
  var mensaje = input ? input.value.trim() : '';
  closeOv('ov-compartir-edit');
  if(!selDay || !selDay.t){ toast('Selecciona un turno primero'); return; }
  setTimeout(function(){ generarSnapshot(selDay.t, mensaje); }, 160);
}

function _formatearFechaCorta(dt){
  return dt.getDate()+' '+MESES_C[dt.getMonth()];
}

/* ── _obtenerBloquesDelTurno(turno, ...fechas) — construye la lista
   de "bloques de jornada" del turno: cada bloque es un día real con
   su propia fecha y sus propios tramos (principal + continuidad +
   DH). No hay límite de "ida y vuelta" — es un array cuya longitud
   depende de los datos: 2 bloques en un servicio normal, 3 en una
   pernocta de 2 días, o 3 bloques distintos (ida, intermedio, vuelta)
   en una pernocta de 3 días. Si el modelo de datos incorporase un día
   más en el futuro, bastaría con añadir un bloque aquí — el resto del
   módulo (que recorre el array con forEach) no necesitaría cambios. ── */
function _obtenerBloquesDelTurno(turno, fechaIda, fechaVuelta, fechaIntermedio){
  var bloques = [];

  bloques.push({
    fecha: fechaIda,
    principal: turno.numTren ? {tren:turno.numTren, origen:turno.sal, destino:turno.lle, hIni:turno.hF, hFin:turno.hL} : null,
    continuidad: turno.continuidad || [],
    dh: (turno.estadoServicio==='dh' && turno.dhTrenDH)
      ? {tren:turno.dhTrenDH, hIni:turno.dhHoraInicio, hFin:turno.dhHoraFin} : null
  });

  // Día intermedio de una pernocta de 3 días: su ruta/horario NO vive
  // en "turno" (solo su número de tren) — se lee, en modo lectura, del
  // registro TV propio de ese día (turno.diaIntermedio), igual que ya
  // hace el resto de la app al reabrir un turno para editar.
  if(turno.diaIntermedio && TV[turno.diaIntermedio]){
    var tInt = TV[turno.diaIntermedio];
    bloques.push({
      fecha: fechaIntermedio,
      principal: turno.numTrenIntermedio ? {tren:turno.numTrenIntermedio, origen:tInt.sal, destino:tInt.lle, hIni:tInt.hF, hFin:tInt.hL} : null,
      continuidad: [],
      dh: null
    });
  }

  bloques.push({
    fecha: fechaVuelta,
    principal: turno.numTrenVuelta ? {tren:turno.numTrenVuelta, origen:turno.sal2, destino:turno.lle2, hIni:turno.hF2, hFin:turno.hL2} : null,
    continuidad: turno.continuidadVuelta || [],
    dh: (turno.estadoServicioVuelta==='dh' && turno.dhTrenDHVuelta)
      ? {tren:turno.dhTrenDHVuelta, hIni:turno.dhHoraInicioVuelta, hFin:turno.dhHoraFinVuelta} : null
  });

  return bloques;
}

// _obtenerTramosDelTurno(turno, ...fechas) — aplana los bloques de
// _obtenerBloquesDelTurno() en una lista única de tramos, con un
// forEach por bloque y otro por sus tramos de continuidad. La
// longitud del resultado depende siempre de bloques.length y de
// cada continuidad.length — nunca de un contador fijo (i<2, etc.).
function _obtenerTramosDelTurno(turno, fechaIda, fechaVuelta, fechaIntermedio){
  var bloques = _obtenerBloquesDelTurno(turno, fechaIda, fechaVuelta, fechaIntermedio);
  var tramos = [];
  bloques.forEach(function(bloque){
    if(bloque.principal){
      tramos.push({tren:bloque.principal.tren, origen:bloque.principal.origen, destino:bloque.principal.destino,
        hIni:bloque.principal.hIni, hFin:bloque.principal.hFin, fecha:bloque.fecha});
    }
    bloque.continuidad.forEach(function(c){
      if(c.tren) tramos.push({tren:c.tren, origen:null, destino:null, hIni:c.horaInicio, hFin:c.horaFin, fecha:bloque.fecha});
    });
    if(bloque.dh){
      tramos.push({tren:bloque.dh.tren, origen:null, destino:null, hIni:bloque.dh.hIni, hFin:bloque.dh.hFin, esDH:true, fecha:bloque.fecha});
    }
  });
  return tramos;
}

// Formatea un tramo como una única línea "Fecha | Tren #N | Origen ->
// Destino | Hora Inicio - Hora Fin". Prioridad explícita: SIEMPRE se
// usa t.fecha (la fecha propia de ESE tramo) si existe; solo si un
// tramo concreto no la trajera, se recurre a fechaPadre (la fecha
// principal del turno) como respaldo — nunca al revés, y nunca queda
// vacía. El resto de partes se omiten si no tienen dato.
function _formatearLineaTramo(t, fechaPadre){
  var fecha = (t.fecha!=null && t.fecha!=='') ? t.fecha : (fechaPadre || '—');
  var partes = [fecha];
  partes.push('🚆 Tren #'+t.tren+(t.esDH?' (DH)':''));
  if(t.origen && t.destino) partes.push(t.origen+' → '+t.destino);
  if(t.hIni && t.hFin) partes.push(t.hIni+' - '+t.hFin);
  return partes.join(' | ');
}

// Formato de DOS líneas para el diseño de lista fluida (sin cuadros):
// línea 1 = icono + tren + ruta; línea 2 = horario, siempre en su
// propia línea para que nunca se corte. No sustituye a
// _formatearLineaTramo() (esa la sigue usando el texto plano de
// respaldo/portapapeles, que no se ha tocado).
function _formatearLineasTramo(t){
  var linea1Partes = ['🚆 Tren #'+t.tren+(t.esDH?' (DH)':'')];
  if(t.origen && t.destino) linea1Partes.push(t.origen+' → '+t.destino);
  return {
    linea1: linea1Partes.join(' | '),
    linea2: (t.hIni && t.hFin) ? (t.hIni+' - '+t.hFin) : ''
  };
}

function generarSnapshot(turno, mensajePersonalizado){
  if(!turno) return;
  var cont = document.getElementById('share_container_template');
  if(!cont) return;

  var DIAS_H = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var ti = TIPO_INFO[turno.tipo] || {ico:'📋', lbl:turno.tipo||'Turno'};

  // 1) Rellenar cabecera de la plantilla con los datos reales del turno.
  // La imagen SOLO lleva datos del viaje — el mensaje del usuario nunca
  // se escribe en esta plantilla; viaja aparte, como texto plano.
  var titEl = document.getElementById('share_titulo');
  if(titEl) titEl.textContent = ti.lbl;
  var k = selDay ? selDay.k : null;
  var dtBase = null;
  if(k){
    var kp = k.split('-').map(Number);
    dtBase = new Date(kp[0], kp[1]-1, kp[2]);
  }
  var fechaEl = document.getElementById('share_fecha');
  if(fechaEl){
    fechaEl.textContent = dtBase
      ? DIAS_H[dtBase.getDay()]+' '+dtBase.getDate()+' de '+MESES[dtBase.getMonth()].toLowerCase()+' '+dtBase.getFullYear()
      : '';
  }

  // 1b) Fecha real de cada bloque de jornada: en una pernocta, cada
  // día siguiente ocurre en una fecha distinta al de origen (día+1
  // para la vuelta de una pernocta de 2 días; día+1 para el
  // intermedio y día+2 para la vuelta en una pernocta de 3 días).
  // Cada tramo refleja SU propia fecha, sea cual sea el número de
  // días que sume la jornada.
  var fechaIdaCorta = dtBase ? _formatearFechaCorta(dtBase) : '—';
  var fechaVueltaCorta = fechaIdaCorta;
  var fechaIntermediaCorta = fechaIdaCorta;
  if(dtBase){
    var dtVuelta = new Date(dtBase);
    if(turno.modo==='pernocta') dtVuelta.setDate(dtVuelta.getDate()+1);
    else if(turno.modo==='pernocta3') dtVuelta.setDate(dtVuelta.getDate()+2);
    fechaVueltaCorta = _formatearFechaCorta(dtVuelta);

    if(turno.modo==='pernocta3'){
      var dtIntermedia = new Date(dtBase);
      dtIntermedia.setDate(dtIntermedia.getDate()+1);
      fechaIntermediaCorta = _formatearFechaCorta(dtIntermedia);
    }
  }

  // 2) Recorrer TODOS los bloques de jornada del turno (principal,
  // intermedio si existe, y vuelta), y dentro de cada uno todos sus
  // tramos (continuidad y DH) con forEach — sin límite de días.
  var tramos = _obtenerTramosDelTurno(turno, fechaIdaCorta, fechaVueltaCorta, fechaIntermediaCorta);

  var tramosEl = document.getElementById('share_tramos');
  if(tramosEl){
    if(!tramos.length){
      tramosEl.innerHTML = '<div style="font-size:12px;color:#9AABC2;text-align:center;padding:10px 0">Sin tramos de tren registrados</div>';
    } else {
      // Agrupación por fecha con reduce(): cada fecha se convierte en
      // la clave de un objeto índice; todos los tramos de ese mismo
      // día caen bajo esa misma clave, en el orden en que ya venían
      // (ida, continuidad, DH, vuelta...). Los objetos en JS conservan
      // el orden de inserción de sus claves, así que "15 jul" sale
      // siempre antes que "16 jul" sin necesidad de ordenar aparte.
      var grupos = tramos.reduce(function(acc, t){
        var clave = t.fecha || fechaIdaCorta;
        if(!acc[clave]) acc[clave] = [];
        acc[clave].push(t);
        return acc;
      }, {});

      tramosEl.innerHTML = Object.keys(grupos).map(function(fecha){
        var itemsHtml = grupos[fecha].map(function(t){
          var l = _formatearLineasTramo(t);
          return '<div class="share-tren-item" style="margin-bottom:12px">'
            + '<div data-linea1 style="font-size:14px;font-weight:700;color:#E8EDF5;line-height:1.4">'+l.linea1+'</div>'
            + (l.linea2 ? '<div data-linea2 style="font-size:13px;font-weight:600;color:#9AABC2;margin-top:2px">'+l.linea2+'</div>' : '')
            + '</div>';
        }).join('');
        return '<div class="share-fecha-grupo" style="margin-bottom:16px">'
          + '<div class="share-fecha-titulo" style="font-size:15px;font-weight:800;color:#93C5FD;'
            + 'padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,.1)">'+fecha+'</div>'
          + itemsHtml
          + '</div>';
      }).join('');
    }
  }

  // 3) La plantilla ya está poblada con los datos reales — ahora se
  // dibuja el canvas LEYENDO ese mismo contenido, nunca datos aparte.
  dibujarSnapshotEnCanvas(function(blob){
    compartirOFallback(blob, tramos, mensajePersonalizado);
  });
}

function dibujarSnapshotEnCanvas(onBlobReady){
  try{
    var tramosEl = document.getElementById('share_tramos');
    var gruposDom = tramosEl ? tramosEl.querySelectorAll('.share-fecha-grupo') : [];

    var ancho = 380;
    var altoCabecera = 76;
    var altoTitulo = 34;   // cabecera de cada grupo de fecha
    var altoItem = 46;     // línea 1 + línea 2 de cada tren
    var espacioGrupo = 16; // margen tras cada grupo

    // Altura total: se mide recorriendo los mismos grupos que ya
    // están en el DOM, sin recalcular ni un solo dato aparte.
    var altoTramos = 0;
    gruposDom.forEach(function(grupo){
      var items = grupo.querySelectorAll('.share-tren-item');
      altoTramos += altoTitulo + items.length*altoItem + espacioGrupo;
    });
    var alto = altoCabecera + (altoTramos || 46) + 20;

    // ── Escalado HD fijo a 3x: se dibuja en coordenadas "CSS" normales,
    // pero el lienzo real tiene el triple de píxeles. Un solo ctx.scale()
    // al principio hace que TODO lo que sigue se pinte nítido, sin tener
    // que multiplicar cada coordenada de dibujo a mano. ──
    var escalaHD = 3;

    var canvas = document.createElement('canvas');
    canvas.width = ancho*escalaHD;
    canvas.height = alto*escalaHD;
    var ctx = canvas.getContext('2d');
    if(!ctx){ onBlobReady(null); return; }
    ctx.scale(escalaHD, escalaHD);

    // Fondo — mismo tono oscuro que la plantilla HTML
    ctx.fillStyle = '#07111F';
    ctx.fillRect(0,0,ancho,alto);

    // Cabecera: icono del tren + "TrenTurno V5" como marca integrada.
    ctx.fillStyle = '#E8EDF5';
    ctx.font = '28px Arial';
    ctx.fillText('🚆', 20, 44);
    ctx.fillStyle = '#5B6B82';
    ctx.font = '800 17px Arial';
    ctx.fillText('TrenTurno V5', 58, 42);

    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.moveTo(20,altoCabecera-10); ctx.lineTo(ancho-20,altoCabecera-10); ctx.stroke();

    // Tramos — agrupados por fecha, como agenda: el título de fecha
    // sale una sola vez, y debajo una lista fluida SIN cuadros: cada
    // tren en dos líneas propias (tren+ruta, y horario aparte), leídas
    // directamente de [data-linea1]/[data-linea2].
    var y = altoCabecera + 14;
    if(!gruposDom.length){
      ctx.fillStyle = '#9AABC2';
      ctx.font = '13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Sin tramos de tren registrados', ancho/2, y+22);
      ctx.textAlign = 'left';
    } else {
      gruposDom.forEach(function(grupo){
        var tituloEl = grupo.querySelector('.share-fecha-titulo');
        ctx.fillStyle = '#93C5FD';
        ctx.font = '800 15px Arial';
        ctx.fillText(tituloEl ? tituloEl.textContent : '', 20, y+14);
        y += 22;
        ctx.strokeStyle = 'rgba(255,255,255,.1)';
        ctx.beginPath(); ctx.moveTo(20,y); ctx.lineTo(ancho-20,y); ctx.stroke();
        y += 12;

        var items = grupo.querySelectorAll('.share-tren-item');
        items.forEach(function(item){
          var l1 = item.querySelector('[data-linea1]');
          var l2 = item.querySelector('[data-linea2]');
          ctx.fillStyle = '#E8EDF5';
          ctx.font = '700 14px Arial';
          ctx.fillText(l1 ? l1.textContent : '', 20, y+14);
          if(l2 && l2.textContent){
            ctx.fillStyle = '#9AABC2';
            ctx.font = '600 13px Arial';
            ctx.fillText(l2.textContent, 20, y+32);
          }
          y += altoItem;
        });
        y += espacioGrupo;
      });
    }

    canvas.toBlob(function(blob){ onBlobReady(blob||null); }, 'image/png');
  }catch(e){
    console.warn('No se pudo generar la imagen del turno; se usará el modo texto.', e);
    onBlobReady(null);
  }
}

function _construirTextoPlanoTurno(tramos, mensajePersonalizado){
  var lineas = tramos.map(_formatearLineaTramo);
  var cuerpo = (lineas.length ? lineas.join('\n') : 'Sin tramos registrados');
  if(mensajePersonalizado) cuerpo = mensajePersonalizado+'\n\n'+cuerpo;
  return cuerpo+'\n\nGenerado por TrenTurno V5';
}

function _copiarTurnoAlPortapapeles(texto){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(texto).then(function(){
      toast('📋 Turno copiado — pégalo donde quieras compartirlo');
    }).catch(function(){
      toast('No se pudo copiar el turno');
    });
  } else {
    toast('No se pudo generar la imagen ni copiar el turno');
  }
}

function compartirOFallback(blob, tramos, mensajePersonalizado){
  if(!blob){
    // Sin imagen: el texto plano debe llevarlo todo, incluida la marca.
    _copiarTurnoAlPortapapeles(_construirTextoPlanoTurno(tramos, mensajePersonalizado));
    return;
  }
  var archivo = new File([blob], 'turno-trenturno.png', {type:'image/png'});
  if(navigator.canShare && navigator.canShare({files:[archivo]})){
    // Con imagen: el texto que acompaña es EXCLUSIVAMENTE el mensaje
    // del usuario — el tren, el horario y la marca de agua viajan
    // dentro del propio snapshot, nunca duplicados en el texto.
    navigator.share({files:[archivo], title:'Mi turno', text: mensajePersonalizado||''})
      .catch(function(err){
        if(err && err.name !== 'AbortError') _copiarTurnoAlPortapapeles(_construirTextoPlanoTurno(tramos, mensajePersonalizado));
      });
  } else {
    _copiarTurnoAlPortapapeles(_construirTextoPlanoTurno(tramos, mensajePersonalizado));
  }
}

// NUEVO — Sistema Horario Compañero (rediseño): vista de SOLO LECTURA
// para los modos "Compañero" y "Comparar". Nunca modifica nada, no
// tiene ningún botón de editar/añadir turno. Reutiliza COMP_DATA (el
// compañero, ya extraído del Horario General) y TV[k] (tu propio
// turno real, para "Comparar"), presentados con el mismo formato de
// tarjeta sencilla — pero claramente marcados como orientativos/
// bloqueados. El modo "Mis turnos" nunca llama a esto.
function _renderVistaSoloLecturaCompanero(d, k, t, fstr){
  var partes = [];
  partes.push('<div style="padding:2px 4px 10px;font-size:13px;color:var(--tx2);font-weight:700">'+fstr+'</div>');

  if(vistaMode==='ambos'){
    partes.push(_tarjetaOrientativaPropia(t));
  }

  // NUEVO — mismo motivo que en aplicarVistaCompanero(): si el
  // PDF importado es de otro mes distinto al que se está viendo, no
  // se muestra el turno del compañero (evita mostrar el día 5 de un
  // mes cuando el PDF cargado es de otro mes distinto).
  var _kParts = k.split('-').map(Number);
  var mesMostrado = _kParts[1]-1, anioMostrado = _kParts[0];
  var mesNoCoincide = (COMP_DATA.anio!=null && COMP_DATA.mes!=null) && (COMP_DATA.anio!==anioMostrado || COMP_DATA.mes!==mesMostrado);

  if(mesNoCoincide){
    partes.push('<div class="ibox" style="margin-top:10px;opacity:.7"><span class="ibox-i">📅</span><span>El horario importado de '+(COMP_DATA.name||'este compañero')+' es de otro mes — no se muestra aquí para evitar confusiones.</span></div>');
    return partes.join('');
  }

  var codigo = (COMP_DATA.days && COMP_DATA.days[String(d)]) || '';
  if(codigo){
    var ci = (COMP_DATA.horasCI||{})[d] || '';
    var co = (COMP_DATA.horasCO||{})[d] || '';
    var ruta = (COMP_DATA.rutaPorDia||{})[d] || '';
    partes.push(_tarjetaOrientativaCompanero(COMP_DATA.name, codigo, ci, co, ruta));
  } else {
    partes.push('<div class="ibox" style="margin-top:10px;opacity:.7"><span class="ibox-i">👤</span><span>'+(COMP_DATA.name||'Compañero')+' no tiene turno registrado este día (según el Horario General).</span></div>');
  }

  return partes.join('');
}

// Tarjeta de solo lectura para TU PROPIO turno, usada solo en modo
// "Comparar" — muestra los mismos datos reales de TV[k], pero sin
// ningún botón de acción (para editar, hay que volver a "Mis turnos").
function _tarjetaOrientativaPropia(t){
  if(!t) return '<div class="ibox" style="margin-bottom:10px;background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.25);border-radius:12px;padding:12px"><span class="ibox-i">📋</span><span>Sin turno propio registrado este día.</span></div>';
  var ti = (typeof TIPO_INFO!=='undefined' && TIPO_INFO[t.tipo]) ? TIPO_INFO[t.tipo] : {ico:'❓', lbl:t.tipo||''};
  var horas = (t.hF && t.hL) ? (t.hF+' → '+t.hL) : '';
  var ruta = (t.sal && t.lle) ? (t.sal+' → '+t.lle) : '';
  return '<div style="margin-bottom:10px;background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.3);border-radius:12px;padding:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center">'
    + '<span style="font-size:11px;font-weight:800;color:#93c5fd;text-transform:uppercase;letter-spacing:.3px">👤 Tú</span>'
    + (t.numTren ? '<span style="font-size:11px;color:var(--tx3)">🚆 Tren '+t.numTren+'</span>' : '')
    + '</div>'
    + (horas ? '<div style="font-size:14px;font-weight:700;color:var(--tx);margin-top:5px">'+horas+'</div>' : '<div style="font-size:12px;color:var(--tx2);margin-top:5px">'+(ti.lbl||'')+'</div>')
    + (ruta ? '<div style="font-size:11px;color:var(--tx2);margin-top:2px">'+ruta+'</div>' : '')
    + '<div style="font-size:9px;color:var(--tx3);margin-top:8px;font-style:italic">Vista de solo lectura — para modificar, cambia a "Mis turnos"</div>'
    + '</div>';
}

// Tarjeta de solo lectura para el turno del COMPAÑERO — datos
// orientativos extraídos del Horario General (código de turno tal
// cual, ruta aproximada, hora de toma/deje si se pudieron leer).
function _tarjetaOrientativaCompanero(nombre, codigo, ci, co, ruta){
  var trenMatch = codigo.match(/([0-9]{2,5})/);
  var tren = trenMatch ? trenMatch[1] : '';
  var rutaFmt = ruta ? ruta.split(/\s+/).join(' · ') : '';
  return '<div style="margin-bottom:10px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);border-radius:12px;padding:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center">'
    + '<span style="font-size:11px;font-weight:800;color:#6ee7b7;text-transform:uppercase;letter-spacing:.3px">👤 '+(nombre||'Compañero')+'</span>'
    + (tren ? '<span style="font-size:11px;color:var(--tx3)">🚆 Tren '+tren+'</span>' : '')
    + '</div>'
    + '<div style="font-size:13px;font-weight:700;color:var(--tx);margin-top:5px">'+codigo+'</div>'
    + ((ci||co) ? '<div style="font-size:12px;color:var(--tx2);margin-top:3px">'+(ci||'—')+' → '+(co||'—')+'</div>' : '')
    + (rutaFmt ? '<div style="font-size:11px;color:var(--tx2);margin-top:2px">'+rutaFmt+'</div>' : '')
    + '<div style="font-size:9px;color:var(--tx3);margin-top:8px;font-style:italic">Información orientativa — no editable</div>'
    + '</div>';
}

function renderDiaArea(){
  // MÓDULO MULTI-TURNO: si hay extras, delegamos en renderDiaAreaMulti
  if(selDay && selDay.k && TV2[selDay.k] && TV2[selDay.k].length > 0){
    renderDiaAreaMulti();
    return;
  }
  var ovCard=document.getElementById('ov-dia-card');
  var useModal=ovCard&&ovCard.classList.contains('on');
  var area=useModal
    ?document.getElementById('dia-card-body')
    :document.getElementById('dia-area');
  if(!area) area=document.getElementById('dia-area');
  if(!selDay){
    if(area) area.innerHTML='';
    var fb=document.getElementById('dia-area');
    if(fb) fb.innerHTML='';
    return;
  }
  var d=selDay.d;var k=selDay.k;var t=selDay.t;;
  var _km3=k.split('-').map(Number);var y=_km3[0],mo=_km3[1];
  var dt=new Date(y,mo-1,d);
  var wd=(dt.getDay()+6)%7;
  var fstr=DIAS_L[wd]+' '+d+' de '+MESES[mo-1].toLowerCase();

  // NUEVO — Sistema Horario Compañero, REDISEÑADO: cuando el modo de
  // vista no es 'mio' (Compañero/Comparar), este día se muestra por
  // un camino COMPLETAMENTE APARTE — tarjetas de solo lectura, con
  // el mismo aspecto que una tarjeta de turno normal, pero SIN
  // ningún botón de editar/añadir (bloqueado a propósito). El modo
  // 'Mis turnos' nunca entra aquí — sigue exactamente el camino de
  // siempre, sin ningún cambio de apariencia ni de comportamiento.
  if(typeof vistaMode!=='undefined' && vistaMode!=='mio' && typeof COMP_DATA!=='undefined' && COMP_DATA && COMP_DATA.days){
    area.innerHTML = _renderVistaSoloLecturaCompanero(d, k, t, fstr);
    return;
  }

  if(!t){
    area.innerHTML='<div class="dc-vacia" onclick="abrirTipo()">'
      +'<div class="dcv-ico">📋</div>'
      +'<div class="dcv-fecha">'+fstr+'</div>'
      +'<div class="dcv-hint">Sin turno asignado</div>'
      +'<button class="dcv-btn" onclick="abrirTipoDesdeCard()">➕ Agregar turno</button>'
      +'</div>';
    return;
  }

  var ti  = TIPO_INFO[t.tipo] || {ico:'❓', lbl:t.tipo||'Desconocido', col:'var(--tx2)', cls:''};
  var col = ti.col;

  // ── Verificar incumplimiento de descanso para este día ───────
  var alerta = ALERTAS_DESCANSO[k];
  var alertaBanner = '';
  if(alerta){
    // FIX — antes el motivo "Enlace de jornada" y las horas de
    // descanso (alerta.descStr, ya calculadas por checkRestTime()) se
    // repartían en líneas separadas, y cuando no había causa específica
    // el aviso quedaba genérico. Ahora se consolida en una frase
    // explícita y siempre visible, sin ocultar ningún dato existente.
    var causaIda = detectarCausaRetrasoIda(alerta);
    var motivoEspecificoHtml = causaIda
      ? ('<div style="font-size:10px;color:var(--tx2);margin-top:3px;line-height:1.4">'
         +'Motivo: Retraso en el tren <b style="color:var(--acc3)">'+causaIda.trenIda+'</b> de ida. '
         +'Se incumple el descanso fuera de base.</div>')
      : '';
    var avisoExplicito = 'AVISO: Enlace de Jornada detectado. Descanso insuficiente ('+alerta.descStr+', mínimo '+alerta.limStr+').';
    // NUEVO — si es un descanso interno de pernocta (tramo1 llegada →
    // tramo2 firma, dentro del MISMO registro), el texto "Turno
    // anterior" no tiene sentido — se cambia por una etiqueta propia.
    var etiquetaOrigen = alerta.esInternoPernocta
      ? 'Descanso interno entre tramos de esta pernocta'
      : 'Turno anterior: '+_keyAFechaLbl(alerta.kAnterior||'');
    var mailtoBtnHtml = '<button class="alerta-mail-btn" '
      +'title="Notificar a Programación por correo" '
      +'onclick="event.stopPropagation();abrirModalCorreoJornada(\''+k+'\')">✉️</button>';

    alertaBanner = '<div class="alerta-descanso">'
      +'<span class="alerta-ico">🔴</span>'
      +'<div style="flex:1"><div style="font-weight:800">'+avisoExplicito+'</div>'
      +'<div style="font-size:10px;opacity:.8">'+alerta.msg+'</div>'
      +motivoEspecificoHtml
      +'<div style="font-size:9px;color:var(--tx3);margin-top:2px">'
      +etiquetaOrigen+'</div>'
      +(alerta.avisoNoComputa
        ? '<div style="font-size:10px;font-weight:800;color:var(--amber2);margin-top:4px">⚠️ '+alerta.avisoNoComputa+'</div>'
        : '')
      +'</div>'
      +mailtoBtnHtml
      +'</div>';
  }

  // Retraso registrado
  var retrasoMin = parseInt(t.retrasoMin)||0;
  var retrasoTag = retrasoMin > 0
    ? '<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(245,158,11,.1);'
      +'border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:2px 8px;'
      +'font-size:10px;font-weight:700;color:var(--amber2);margin-left:5px">⏱ +'+retrasoMin+'min</div>'
    : '';

  var body='';
  // Si es ordinario/trabajado/art5152/vuelta-pernocta/pernocta3-intermedio,
  // mostrar alerta arriba del cuerpo.
  // FIX: 'vuelta-pernocta' y 'pernocta3-intermedio' añadidos — antes
  // quedaban fuera y el último día de una pernocta solo mostraba el
  // triángulo ⚠️ en el título, sin el aviso completo (AVISO: Enlace de
  // Jornada...) ni el botón de correo, aunque `alerta` sí existiera.
  var bodyPrefix = (alerta && (t.tipo==='ordinario'||t.tipo==='trabajado'||t.tipo==='art5152'||t.tipo==='vuelta-pernocta'||t.tipo==='pernocta3-intermedio')) ? alertaBanner : '';

  // NUEVO — Reserva de Art.51/52 SIN pinchar/verificar todavía: se
  // muestra su propio resumen (toma/deje + importe) y el botón
  // "Pinchar / Verificar", mismo patrón visual que la reserva normal.
  // No entra en la rama combinada de tramos (esta reserva no tiene
  // sal/lle/hF/hL — mostrarla ahí saldría vacía).
  if(t.tipo==='art5152' && t.modoArt5152==='reserva'){
    body='<div class="ibox blue"><span class="ibox-i">⏳</span><span>Reserva de Artículo 51/52 guardada. Usa <strong>"Pinchar / Verificar"</strong> si has realizado un servicio.</span></div>'
      +'<div class="calc-result" style="margin-top:8px">'
      +'<div class="cr-row"><span class="cr-l">Hora de toma</span><span class="cr-v">'+(t.horaTomaArt||'—')+'</span></div>'
      +'<div class="cr-row"><span class="cr-l">Hora de deje</span><span class="cr-v">'+(t.horaDejeArt||'—')+'</span></div>'
      +'<div class="cr-div"></div>'
      +'<div class="cr-row"><span class="cr-l">Horas de reserva</span><span class="cr-v">'+(t.horasEfectivas||0)+' h</span></div>'
      +'<div class="cr-row"><span class="cr-l">💶 Importe</span><span class="cr-v" style="color:var(--green2)">'+(t.importe||0).toFixed(2)+' €</span></div>'
      +'</div>'
      +'<button onclick="verificarReservaArt5152()" style="width:100%;margin-top:10px;padding:9px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:9px;color:#FCD34D;font-size:12px;font-weight:700;cursor:pointer">📌 Pinchar / Verificar</button>';
  } else if(t.tipo==='ordinario'||t.tipo==='trabajado'||t.tipo==='art5152'){
    // ── RESALTADO DE TRAMO PERNOCTA ──
    // Si selDay.k difiere de k (clave origen), el usuario tocó un día de
    // vuelta o intermedio → resaltar visualmente el tramo de vuelta.
    var kClicado = selDay ? selDay.k : k;
    var tClicadoRaw = TV[kClicado];
    var kOrigen = (tClicadoRaw && tClicadoRaw.origenPernocta) ? tClicadoRaw.origenPernocta : kClicado;
    var esDiaVuelta = (kClicado !== kOrigen) && (t.modo==='pernocta'||t.modo==='pernocta3');

    // VISTA RESUMIDA — solo nº de tren (con formato DH), ruta y horario.
    // Los importes, nocturnidad exacta, retrasos con impacto económico y
    // pluses siguen intactos y visibles en el acordeón "Turnos del mes".
    body += renderizarPopUpSimplificado(t, esDiaVuelta);

    // NUEVO — FIX: resumen de la compensación Art. 51/52 (Dinero/Días/Mix).
    // No existía ningún bloque para esto; por eso el resumen no aparecía.
    // No toca nada de HTDL (usa t.compensacion, campo exclusivo de art5152).
    if(t.tipo==='art5152'){
      if(t.compensacion==='dinero' && t.importe){
        body += '<div class="ac-imp" style="margin-top:6px"><span class="al">💶 Art. 51/52 — Dinero</span>'
          +'<span class="ar">'+calcImporteArt5152Vivo(t,false).toFixed(2)+' €</span></div>';
      } else if(t.compensacion==='dias' && t.diasGenerados){
        body += '<div class="ac-row" style="margin-top:6px"><span class="ak">📅 Art. 51/52 — Días</span>'
          +'<span class="av" style="color:var(--cyan2);font-weight:800">+'+t.diasGenerados+' → '+t.mesDestino+'</span></div>';
      } else if(t.compensacion==='mix' && t.mixDinero && t.mixDias){
        body += '<div class="ac-imp" style="margin-top:6px"><span class="al">🔀 Mix — Dinero ('+_keyAFechaLbl(t.mixDinero.dia)+')</span>'
          +'<span class="ar">'+calcImporteArt5152Vivo(t,true).toFixed(2)+' €</span></div>'
          +'<div class="ac-row"><span class="ak">🔀 Mix — Días ('+_keyAFechaLbl(t.mixDias.dia)+')</span>'
          +'<span class="av" style="color:var(--cyan2);font-weight:800">+'+t.mixDias.diasGenerados+' → '+t.mixDias.mesDestino+'</span></div>';
      }
    }
  } else if(t.tipo==='vuelta-pernocta' || t.tipo==='pernocta3-intermedio'){
    // ── Días derivados de pernocta — cada uno tiene sus propios datos ──
    // t.sal/t.lle/t.hF/t.hL/t.numTren son los datos PROPIOS de este día,
    // guardados al crear la pernocta. NO repetimos datos del día anterior.
    var esIntermedio = t.tipo==='pernocta3-intermedio';
    var diaLbl = esIntermedio ? 'Día 2 de 3 · En tránsito' : 'Último día · Vuelta';
    body = '<div class="tv-pernocta-dia"><span class="tv-pernocta-badge">🌙 '+diaLbl+'</span></div>';
    // NUEVO — total del día también aquí (antes solo existía en
    // renderizarPopUpSimplificado, así que el último día de una
    // pernocta con tramo de continuidad nunca lo mostraba). Este
    // registro derivado usa t.hF/t.hL para SU PROPIA vuelta (no
    // hF2/hL2), y sus tramos de continuidad viven en el origen — se
    // adapta a la forma que espera calcularTotalDiaMin() sin duplicar
    // esa lógica.
    var origenParaDHTotal = (t.origenPernocta && TV[t.origenPernocta]) ? TV[t.origenPernocta] : null;
    var totalDiaMinD2 = calcularTotalDiaMin({
      hF2: t.hF, hL2: t.hL,
      continuidadVuelta: (origenParaDHTotal && origenParaDHTotal.continuidadVuelta) ? origenParaDHTotal.continuidadVuelta : []
    }, false, true);
    if(totalDiaMinD2 > 0){
      body += '<div class="tv-total-dia" style="display:flex;align-items:center;justify-content:space-between;'
        +'background:rgba(59,127,255,.08);border:1px solid rgba(59,127,255,.25);border-radius:10px;'
        +'padding:9px 13px;margin-bottom:8px">'
        +'<span style="font-size:11px;font-weight:800;color:var(--acc2)">⏱ TOTAL DEL DÍA</span>'
        +'<span style="font-size:15px;font-weight:900;color:var(--tx);font-variant-numeric:tabular-nums">'
        +Math.floor(totalDiaMinD2/60)+'h '+pad(totalDiaMinD2%60)+'m</span>'
        +'</div>';
    }
    // FIX — DH de vuelta: el propio registro de este día (vuelta-pernocta)
    // no guarda estadoServicioVuelta ni numTrenVuelta — esos campos
    // viven en el registro ORIGEN de la pernocta. Se reutiliza
    // obtenerInfoDHTramo() (la MISMA función que ya usa el Día 1,
    // sin tocarla) pasándole el origen, para generar exactamente el
    // mismo formato grande "Tren DH: X (DH) | Tren Servicio: Y".
    var origenParaDH = (t.origenPernocta && TV[t.origenPernocta]) ? TV[t.origenPernocta] : null;
    var infoDHVtaDia2 = (!esIntermedio && origenParaDH) ? obtenerInfoDHTramo(origenParaDH, 'vuelta') : null;
    var dhVueltaActivo = !!infoDHVtaDia2;
    var numDia2HTML = '';
    if(infoDHVtaDia2 && infoDHVtaDia2.mismoTren){
      var vA2 = infoDHVtaDia2.origenEsBase ? infoDHVtaDia2.trenServicio+'-DH' : infoDHVtaDia2.trenServicio;
      var vB2 = infoDHVtaDia2.origenEsBase ? infoDHVtaDia2.trenServicio       : infoDHVtaDia2.trenServicio+'-DH';
      numDia2HTML = '<div class="tv-num-row">'
        + '<span class="tv-num-part'+(infoDHVtaDia2.origenEsBase?' tv-num-dh':'')+'">'+vA2+'</span>'
        + '<span class="tv-num-sep">/</span>'
        + '<span class="tv-num-part'+(!infoDHVtaDia2.origenEsBase?' tv-num-dh':'')+'">'+vB2+'</span>'
        + '</div>';
    } else if(infoDHVtaDia2){
      numDia2HTML = '<div class="tv-num-row">'
        + '<span class="tv-num-part tv-num-dh">Tren DH: '+infoDHVtaDia2.trenDH+' (DH)</span>'
        + '<span class="tv-num-sep">|</span>'
        + '<span class="tv-num-part">Tren Servicio: '+infoDHVtaDia2.trenServicio+'</span>'
        + '</div>';
    } else if(t.numTren){
      numDia2HTML = '<div class="tv-num">'+t.numTren+'</div>';
    }
    var dhVueltaTagDia2 = '';
    if(dhVueltaActivo){
      dhVueltaTagDia2 = '<div class="tv-dh-tag" style="margin-bottom:8px">'
        + '<span class="tv-dh-badge">🔀 DH</span>'
        + '<span class="tv-dh-detail">'+(origenParaDH.estadoServicioVueltaDetalle||'servicio parcial')+'</span>'
        + '</div>';
    }
    if(t.numTren || (t.sal&&t.lle)){
      body += '<div class="tv-block '+(esIntermedio?'':'vuelta')+(dhVueltaActivo?' tv-block-dh':'')+'" style="'
        +(esIntermedio?'border-left:3px solid var(--violet2)':'')
        +'">'
        + '<div class="tv-block-tag">'+(esIntermedio?'🏨 TRAMO INTERMEDIO':'↩ VUELTA')+(dhVueltaActivo?' · DH':'')+'</div>'
        + numDia2HTML
        + dhVueltaTagDia2
        + (t.sal&&t.lle?'<div class="tv-route">'+t.sal+' → '+t.lle+'</div>':'')
        + (t.hF&&t.hL?'<div class="tv-hours">'+t.hF+' – '+t.hL+'</div>':'')
        + (t.numTren&&selDay&&selDay.k ? _huecoCompaneros(t.numTren, selDay.k) : '')
        + '</div>';
    } else {
      body += '<div class="tv-block" style="border-left:3px solid var(--tx3)">'
        + '<div class="tv-block-tag">'+(esIntermedio?'🏨 EN TRÁNSITO':'↩ VUELTA')+'</div>'
        + '<div style="font-size:11px;color:var(--tx3);padding:4px 0">'
        + (esIntermedio?'Jornada intermedia — sin datos de tren asignados':'Sin datos de vuelta registrados')
        + '</div></div>';
    }
    // FIX — este día derivado (último día de la pernocta) no lleva sus
    // propios tramos de continuidad: viven en el registro de ORIGEN
    // (origenParaDH.continuidadVuelta), igual que ya pasa con el DH de
    // arriba (infoDHVtaDia2). Sin esto, cualquier tramo de continuidad
    // añadido en la vuelta desaparecía al ver este día en concreto,
    // aunque SÍ se hubiera guardado bien.
    if(!esIntermedio && origenParaDH && origenParaDH.continuidadVuelta && origenParaDH.continuidadVuelta.length){
      origenParaDH.continuidadVuelta.forEach(function(c, idx){
        if(!c || !c.tren) return;
        var dhInfoTxtD2 = (c.tipoTramo==='dh' && (c.dhHasta||c.dhHoraInicio))
          ? '<div class="tv-dh-tag"><span class="tv-dh-badge">🔀 DH</span>'
            + '<span class="tv-dh-detail">'+((c.dhDesde||'inicio')+' → '+(c.dhHasta||'?'))
            + (c.dhHoraInicio&&c.dhHoraFin?' · '+c.dhHoraInicio+'–'+c.dhHoraFin:'')+'</span></div>'
          : '';
        body += '<div class="tv-block vuelta'+(c.tipoTramo==='dh'?' tv-block-dh':'')+'">'
          + '<div class="tv-block-tag">🚆 CONT. '+(idx+2)+(c.tipoTramo==='dh'?' · DH':'')+'</div>'
          + '<div class="tv-num">'+c.tren+'</div>'
          + dhInfoTxtD2
          + (c.salida&&c.llegada?'<div class="tv-route">'+c.salida+' → '+c.llegada+'</div>':'')
          + (c.horaInicio&&c.horaFin?'<div class="tv-hours">'+c.horaInicio+' – '+c.horaFin+'</div>':'')
          + (c.escalaMin!=null?'<div class="tv-route">⏳ Escala: '+c.escalaMin+' min</div>':'')
          + '<div class="tv-hours" style="opacity:.65;font-size:9px">'
          + _etiquetaRepartoDH(c)+'</div>'
          + (c.tren&&selDay&&selDay.k ? _huecoCompaneros(c.tren, selDay.k) : '')
          + '</div>';
      });
    }
  } else if(t.tipo==='reserva'){
    var resActiva = !!t.reservaActiva;
    // ACTUALIZADO — se quita el aviso estático "8h de Presencia por
    // defecto" (ya no aplica: desde que la reserva pide toma/deje
    // obligatoriamente al guardarla, sin pinchar computa el intervalo
    // REAL, no una cifra fija). Ahora el horario real se muestra
    // siempre, de forma clara, arriba del todo.
    body='<div class="ibox blue"><span class="ibox-i">⏳</span><span>Reserva guardada.</span></div>'
      +'<div class="calc-result" style="margin-top:8px">'
      +'<div class="cr-row"><span class="cr-l">Hora de toma</span><span class="cr-v">'+(t.reservaHoraToma||'—')+'</span></div>'
      +'<div class="cr-row"><span class="cr-l">Hora de deje</span><span class="cr-v">'+(t.reservaHoraLlegada||'—')+'</span></div>'
      +'</div>'
      +'<button onclick="abrirModalTomaDejeReserva()" style="width:100%;margin-top:6px;padding:6px;background:none;border:none;color:var(--tx3);font-size:10px;font-weight:700;cursor:pointer;text-decoration:underline">✏️ Corregir horario</button>'
      // UNIFICADO — mismo texto e icono exactos que usan Art.51/52 y HTDL.
      +'<button onclick="verificarReserva()" style="width:100%;margin-top:4px;padding:9px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:9px;color:#FCD34D;font-size:12px;font-weight:700;cursor:pointer">📌 Pinchar / Verificar</button>'
      +'<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--div)">'
      +'<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--tx2);font-weight:600">'
      +'<input type="checkbox" '+(resActiva?'checked':'')+' onchange="toggleReservaActiva(this.checked)" style="width:16px;height:16px;accent-color:var(--acc)">'
      +'Parte de la reserva fue trabajo real'
      +'</label>'
      +(resActiva
        ? '<div style="font-size:10px;color:var(--tx3);margin-top:6px">De toma a deje = Horas Efectivas. El resto hasta 8h = Presencia.</div>'
        : '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Todo el intervalo (toma → deje) computa como Presencia.</div>')
      +'</div>';
  } else if(t.tipo==='descanso'){
    body='<div class="ibox green"><span class="ibox-i">🧘</span><span>Día de descanso.</span></div>'
      +'<button onclick="convertirDescanso()" style="width:100%;padding:9px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.3);border-radius:9px;color:#C4B5FD;font-size:12px;font-weight:700;cursor:pointer">💼 He trabajado este descanso</button>';
  } else if(t.tipo==='baja'){
    body='<div class="ibox red"><span class="ibox-i">🏥</span><span>Baja médica o laboral registrada.</span></div>';
    // NUEVO — si esta baja pisó un turno ya existente, se muestra de
    // forma clara (nunca se pierde el dato: sigue en t.turnoPisado).
    if(t.turnoPisado){
      var tp = t.turnoPisado;
      body += '<div class="ibox" style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);margin-top:8px">'
        +'<span class="ibox-i">📋</span><span>Turno pisado por esta baja: '
        +(tp.numTren?'Tren #'+tp.numTren+' · ':'')
        +(tp.sal&&tp.lle?tp.sal+' → '+tp.lle:tp.tipo)+'</span></div>'
        // NUEVO — permite deshacer la conversión: recupera el turno
        // guardado en turnoPisado y quita el estado de baja de este día.
        +'<button onclick="quitarBajaLaboral(\''+k+'\')" style="width:100%;margin-top:6px;padding:9px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:9px;color:#6EE7B7;font-size:12px;font-weight:700;cursor:pointer">↩️ Quitar Baja Laboral (recuperar turno)</button>';
      if(t.primeraBajaAnio===true){
        body += '<div style="font-size:10px;color:var(--green2);margin-top:6px">✅ Primera baja del año — a cargo de la empresa, sin descuento de horas.</div>';
      } else if(t.primeraBajaAnio===false){
        body += '<div style="font-size:10px;color:var(--amber2);margin-top:6px">⚠️ No es la primera baja del año — descuento de horas aplicado (ver Desglose Económico).</div>';
      }
    }
  } else if(t.tipo==='comp'){
    body='<div class="ibox" style="background:rgba(6,182,212,.07);border:1px solid rgba(6,182,212,.22)"><span class="ibox-i">📅</span><span>Día de compensación marcado automáticamente.</span></div>';
  }

  // VISTA RESUMIDA — cabecera ligera. Los nº de tren ya se muestran
  // dentro de los tv-block del cuerpo (sin duplicarlos aquí arriba);
  // solo se conservan indicadores breves de estado (alerta, cambio, retraso).
  area.innerHTML='<div class="dc-turno" style="border-color:'+(alerta?'rgba(220,38,38,.5)':col+'44')+'">'
    +'<div class="dct-hdr" style="background:'+(alerta?'rgba(220,38,38,.08)':col+'14')+';border-bottom:1px solid '+col+'20">'
    +'<div class="dct-ico">'+ti.ico+'</div>'
    +'<div class="dct-info"><div class="dct-fecha">'+fstr+'</div>'
    +'<div class="dct-tipo" style="color:'+(alerta?'var(--red2)':col)+'">'+ti.lbl+(alerta?' ⚠️':'')+'</div></div>'
    // QUITADO — este badge solo mostraba calcDur(t.hF,t.hL), es decir,
    // la duración de la IDA nada más (sin vuelta ni escala), y salía
    // sin contexto ni etiqueta. Confundía porque ya está el bloque
    // "⏱ TOTAL DEL DÍA" (con ida+vuelta+escala) más abajo, que es el
    // dato correcto y completo. Puramente visual — no participaba en
    // ningún cálculo, así que quitarlo no afecta a nada más.
    +(t.cambioSolicitado?'<div style="background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.25);border-radius:6px;padding:2px 7px;font-size:9px;font-weight:700;color:var(--nar2);margin-left:3px">🔄 Enviado</div>':'')
    +retrasoTag
    +'</div>'
    +'<div class="dct-body">'+bodyPrefix+body+'</div>'
    // NOTA — visible en TODOS los tipos de turno
    +(t&&t.notas&&t.notas.trim().length>0
      ? '<div style="margin:0 0 8px 0;padding:8px 11px;background:rgba(99,102,241,.07);'
        +'border:1px solid rgba(99,102,241,.2);border-radius:9px">'
        +'<div style="font-size:9px;font-weight:800;letter-spacing:.5px;color:var(--acc);margin-bottom:3px">📝 NOTA</div>'
        +'<div style="font-size:11px;color:var(--tx2);line-height:1.5">'+t.notas.trim()+'</div>'
        +'</div>'
      : '')
    +(selDay?renderTV2Bloque(selDay.k):'')
    +'<div class="dct-foot-v2">'
    +'<div class="dct-row-main">'
    +'<button class="dct-btn-cambio" onclick="abrirCambio()">🔄 Cambio</button>'
    +'<button class="dct-btn-add" onclick="guardarTurnoExtra()">➕ Añadir</button>'
    +'</div>'
    +'<div class="dct-row-main" style="margin-top:0">'
    +'<button class="dct-btn-edit" onclick="editarTurno()">✏️ Editar</button>'
    +'<button class="dct-btn-del2" onclick="pedirEliminar()">🗑 Eliminar</button>'
    +'</div>'
    +'<div class="dct-row-sec">'
    +((t.tipo==='ordinario'||t.tipo==='trabajado'||t.tipo==='art5152'||t.tipo==='vuelta-pernocta'||t.tipo==='pernocta3-intermedio')
      ? '<button class="dct-btn-sec sec-amber" onclick="abrirRetraso()">⏱ '+(retrasoMin>0?'+'+retrasoMin+'m':'Retraso')+'</button>'
      : '')
    +'<button class="dct-btn-sec sec-cyan" onclick="verDetallesEnHistorial(\''+k+'\')">📋 Detalles</button>'
    +'<button class="dct-btn-sec sec-green" onclick="compartirTurnoSeleccionado()">📤 Compartir</button>'
    +((t.tipo==='ordinario'||t.tipo==='trabajado'||t.tipo==='art5152'||t.tipo==='vuelta-pernocta'||t.tipo==='pernocta3-intermedio'||t.tipo==='descanso')
      ? '<button class="dct-btn-sec" onclick="abrirCopiarTurno(\''+k+'\')">📋 Copiar turno</button>'
      : '')
    +'</div>'
    // NUEVO — Convertir turno existente en Baja Laboral, directamente
    // desde el historial, sin borrar el día a mano. Solo aplica a
    // días con un turno real que tenga sentido "pisar" (no se ofrece
    // sobre baja/vacaciones, que ya son estados especiales).
    +((t.tipo!=='baja'&&t.tipo!=='vacaciones')
      ? '<div class="dct-row-sec" style="margin-top:8px">'
        +'<button class="dct-btn-sec sec-red" style="flex:1" onclick="convertirTurnoEnBaja(\''+k+'\')">🏥 Convertir en Baja Laboral</button>'
        +'</div>'
      : '')
    +'</div></div>';
  if(selDay) setTimeout(function(){renderTV2DiaCard(selDay.k);},10);
  // NUEVO — "con quién viajas": rellena automáticamente, bajo demanda
  // (solo el día que se está viendo, no todo el mes de golpe), los
  // huecos de compañeros que acaban de pintarse en este detalle.
  // FIX — Confirmado por Alex (bug real): se pasa el mes REAL del día
  // que se está viendo (derivado de "k", ej. "2026-08-14"), para que
  // siempre compare contra el Horario General de ESE mes — antes
  // podía quedarse con el último mes mirado en Compañeros/Interventor,
  // dando compañeros de un mes distinto al que de verdad se está viendo.
  var _mesDeEsteDia = (function(){ var p = k.split('-'); return {anio: parseInt(p[0],10), mes: parseInt(p[1],10)}; })();
  rellenarCompanerosAutomaticos(area, _mesDeEsteDia);
}

// NUEVO — Controla el plegado/despliegue de "Turnos del mes". No
// toca renderAcordeon() ni su contenido: solo muestra/oculta el
// contenedor #acordeon que esa función ya rellena exactamente igual
// que antes.
function toggleTurnosMesAcordeon(){
  var cont = document.getElementById('acordeon');
  var arr = document.getElementById('turnos-mes-arr');
  if(!cont) return;
  var abierto = cont.style.display !== 'none';
  cont.style.display = abierto ? 'none' : 'block';
  if(arr) arr.classList.toggle('abierto', !abierto);
}

function renderAcordeon(){
  var y=curM.getFullYear(),m=curM.getMonth()+1;
  var pref=key(y,m,1).substring(0,7);
  var ks=Object.keys(TV).filter(function(k){return k.startsWith(pref);}).sort();
  var ac=document.getElementById('acordeon');

  // OPTIMIZACIÓN: firma ligera de los datos visibles (mes + nº turnos +
  // última modificación aproximada). Si es idéntica a la del último
  // render, no se toca el DOM — evita reconstruir HTML innecesariamente
  // cuando solo se abre/cierra un acordeón sin cambiar datos.
  var firma = pref+'|'+ks.length+'|'+JSON.stringify(ks.map(function(k){return TV[k].tipo;}));
  if(firma === _acordeonCacheKey && ac.innerHTML !== ''){
    return; // nada cambió desde el último render — no reconstruir
  }
  _acordeonCacheKey = firma;

  // FIX ESTABILIDAD: capturar qué día estaba abierto ANTES de destruir
  // el HTML. renderAcordeon() se llama desde 24 sitios distintos
  // (incluido clickDia en el calendario); sin esto, cualquier toque
  // en el calendario colapsaba el acordeón mensual sin motivo.
  var abiertoPrevio = null;
  var itemAbierto = ac.querySelector('.ac-item.open');
  if(itemAbierto) abiertoPrevio = itemAbierto.id;

  if(!ks.length){ac.innerHTML='<div style="padding:12px;text-align:center;font-size:11px;color:var(--tx3)">Sin turnos este mes</div>';return;}
  ac.innerHTML=ks.map(function(k){
    var t=TV[k],dd=k.split('-')[2];
    var ti=TIPO_INFO[t.tipo]||{ico:'?',lbl:t.tipo,col:'var(--tx2)'};
    var dot='<div class="ac-dot" style="background:'+ti.col+'"></div>',det='';
    if(t.retrasos&&t.retrasos.length){t.retrasos.forEach(function(r){det+='<div class="ac-row"><span class="ak">T'+r.tramo+(r.tren?' #'+r.tren:'')+'</span><span class="av" style="color:var(--amber2)">+'+r.minutos+' min</span></div>';});}
    else if(t.retrasoMin){det+='<div class="ac-row"><span class="ak">Retraso</span><span class="av" style="color:var(--amber2)">+'+t.retrasoMin+' min</span></div>';}
    if(ALERTAS_DESCANSO[k])det+='<div class="ac-row"><span class="ak">🔴 Descanso</span><span class="av" style="color:var(--red2)">'+ALERTAS_DESCANSO[k].msg+'</span></div>';
    if(t.cambioSolicitado)det+='<div class="ac-row"><span class="ak">🔄 Cambio</span><span class="av" style="color:var(--nar2);font-weight:700">Solicitud enviada</span></div>';
    if(t.numTren){
      det+='<div class="ac-row"><span class="ak">Tren Ida</span><span class="av" style="color:var(--nar2);font-weight:800">#'+t.numTren+'</span></div>';
      (t.continuidad||[]).forEach(function(c, idx){
        if(!c.tren) return;
        var etiquetaHora = (c.horaInicio&&c.horaFin) ? ' · '+c.horaInicio+'–'+c.horaFin : '';
        det+='<div class="ac-row"><span class="ak">Tramo '+(idx+2)+'</span><span class="av" style="color:var(--nar2);font-weight:800">#'+c.tren+etiquetaHora+'</span></div>';
      });
    }
    if(t.numTrenVuelta){
      det+='<div class="ac-row"><span class="ak">'+(t.modo==='pernocta'?'Vuelta (noche)':'Tren Vuelta')+'</span><span class="av" style="color:var(--amber2);font-weight:800">#'+t.numTrenVuelta+'</span></div>';
      (t.continuidadVuelta||[]).forEach(function(c, idx){
        if(!c.tren) return;
        var etiquetaHoraV = (c.horaInicio&&c.horaFin) ? ' · '+c.horaInicio+'–'+c.horaFin : '';
        det+='<div class="ac-row"><span class="ak">Tramo '+(idx+2)+'</span><span class="av" style="color:var(--amber2);font-weight:800">#'+c.tren+etiquetaHoraV+'</span></div>';
      });
    }
    if(t.sal)det+='<div class="ac-row"><span class="ak">'+(t.tipo==='vuelta-pernocta'?'Vuelta':'Ida')+'</span><span class="av">'+t.sal+' → '+(t.lle||'')+'</span></div>';
    if(t.hF)det+='<div class="ac-row"><span class="ak">Firma</span><span class="av">'+t.hF+' - '+(t.hL||'')+'</span></div>';
    if(t.sal2)det+='<div class="ac-row"><span class="ak">Vuelta</span><span class="av">'+t.sal2+' → '+(t.lle2||'')+'</span></div>';
    if(t.hF2)det+='<div class="ac-row"><span class="ak">H. Vuelta</span><span class="av">'+t.hF2+' - '+(t.hL2||'')+'</span></div>';
    if(t.linea)det+='<div class="ac-row"><span class="ak">Linea</span><span class="av">'+t.linea+'</span></div>';
    if(t.nocturno)det+='<div class="ac-row"><span class="ak">Nocturnidad</span><span class="av" style="color:var(--amber2)">Activa 22:00-06:00</span></div>';
    if(t.plusIntlAuto)det+='<div class="ac-row"><span class="ak">Plus Intl.</span><span class="av" style="color:var(--cyan2)">Automatico</span></div>';
    if(t.modo)det+='<div class="ac-row"><span class="ak">Modo</span><span class="av">'+(t.modo==='pernocta'?'Pernocta':'Ida y vuelta')+'</span></div>';
    if(t.comp==='dinero'&&t.importe)det+='<div class="ac-imp"><span class="al">Compensacion economica</span><span class="ar">'+t.importe.toFixed(2)+' €</span></div>';
    if(t.comp==='dias'&&t.diasComp&&t.diasComp.length)det+='<div class="ac-row"><span class="ak">Dias comp.</span><span class="av" style="color:var(--cyan2)">'+t.diasComp.length+' dias</span></div>';
    // NUEVO — FIX: resumen de compensación Art. 51/52 (campo propio
    // t.compensacion, distinto de t.comp de HTDL — por eso no aparecía).
    if(t.tipo==='art5152'){
      if(t.compensacion==='dinero'&&t.importe)det+='<div class="ac-imp"><span class="al">⚖️ Art.51/52 — Dinero</span><span class="ar">'+calcImporteArt5152Vivo(t,false).toFixed(2)+' €</span></div>';
      if(t.compensacion==='dias'&&t.diasGenerados)det+='<div class="ac-row"><span class="ak">⚖️ Art.51/52 — Días</span><span class="av" style="color:var(--cyan2)">+'+t.diasGenerados+' → '+t.mesDestino+'</span></div>';
      if(t.compensacion==='mix'&&t.mixDinero&&t.mixDias){
        det+='<div class="ac-imp"><span class="al">🔀 Mix — Dinero</span><span class="ar">'+calcImporteArt5152Vivo(t,true).toFixed(2)+' €</span></div>';
        det+='<div class="ac-row"><span class="ak">🔀 Mix — Días</span><span class="av" style="color:var(--cyan2)">+'+t.mixDias.diasGenerados+' → '+t.mixDias.mesDestino+'</span></div>';
      }
    }
    if(t.tipo==='comp'&&t.origen)det+='<div class="ac-row"><span class="ak">HTDL Comp.</span><span class="av" style="color:var(--cyan2)">Descanso trabajado</span></div>';
    if(t.notas&&t.notas.trim().length>0)det+='<div class="ac-row" style="flex-direction:column;align-items:flex-start;gap:2px"><span class="ak">Nota</span><span style="font-size:10px;color:var(--tx2);padding-left:4px;line-height:1.4">'+t.notas.trim()+'</span></div>';
    return '<div class="ac-item" id="ac-'+k+'"><div class="ac-hdr" onclick="toggleAc(\'ac-'+k+'\')">'+dot
      +'<div class="ac-fecha"><strong>'+parseInt(dd)+' '+MESES_C[m-1]+'</strong></div>'
      +'<div class="ac-tipo">'+ti.ico+' '+ti.lbl+'</div><div class="ac-arr">›</div></div>'
      +'<div class="ac-body">'+(det||'<span style="color:var(--tx3)">Sin detalles</span>')+'</div></div>';
  }).join('');

  // FIX ESTABILIDAD: restaurar el día que estaba abierto, si sigue existiendo
  if(abiertoPrevio){
    var elRestaurar = document.getElementById(abiertoPrevio);
    if(elRestaurar) elRestaurar.classList.add('open');
  }
}

function toggleAc(id){
  var el=document.getElementById(id);
  if(!el) return;
  var isOpen=el.classList.contains('open');
  // Cerrar todos los demás (opcional: comentar para permitir múltiples abiertos)
  var items=document.querySelectorAll('.ac-item.open');
  for(var ii=0;ii<items.length;ii++){
    if(items[ii].id!==id) items[ii].classList.remove('open');
  }
  if(isOpen) el.classList.remove('open');
  else el.classList.add('open');
}
