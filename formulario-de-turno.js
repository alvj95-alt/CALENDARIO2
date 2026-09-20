/* TrenTurnos v5 — Formulario de turno (tramos, continuidad, pernocta)
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════
   FORMULARIO
═══════════════════════════════════════ */
function abrirForm(edicion,verificando){
  if(verificando===undefined) verificando=false;
  if(!selDay)return;
  // NUEVO — refresca las sugerencias de "tren · estación" del datalist
  // cada vez que se abre el formulario, por si se guardó algún tren
  // nuevo desde la última vez.
  if(typeof actualizarDatalistTrenes==='function') actualizarDatalistTrenes();
  var d=selDay.d;
  var k=selDay.k;
  var _km4=k.split('-').map(Number);
  var y=_km4[0],mo=_km4[1];
  var dt=new Date(y,mo-1,d);
  var wd=(dt.getDay()+6)%7;
  var ti=TIPO_INFO[F.tipo] || {ico:'📋',lbl:F.tipo||'Turno',col:'var(--acc)',cls:''};
  document.getElementById('form-ico').textContent=verificando?'✅':ti.ico;
  document.getElementById('form-tit').textContent=DIAS_L[wd]+' '+d+' de '+MESES[mo-1].toLowerCase();
  document.getElementById('form-sub').textContent=verificando?'Pinchar / Verificar':(edicion?'Editando '+ti.lbl.toLowerCase():'Nuevo '+ti.lbl.toLowerCase());
  document.getElementById('m-del').style.display=edicion?'flex':'none';
  var mc=mo===12?new Date(y+1,0,1):new Date(y,mo,1);
  miniM=mc;
  diasComp=(F.diasComp||[]).slice();
  renderFormBody();
  openOv('ov-form');
}

function secPlusesViaje(){
  var p = AJ.pluses[AJ.rol] || PLUS_DEF[AJ.rol];
  var pAct  = parseFloat(p.activacion   || 0);
  var pJT   = parseFloat(p.jt          || 0);
  var pIntl = parseFloat(p.internacional|| 0);
  var h = '<div class="fsec" style="border-top:1px solid var(--div)">'
    + '<div class="fsec-lbl" style="margin-bottom:8px">Pluses por viaje</div>';
  h += plusToggle('plusAct', F.plusAct, 'Plus Activación', pAct,
    '€ fijo × viaje', "togglePlus('plusAct')");
  h += plusToggle('plusJT',  F.plusJT,  'Plus JT',         pJT,
    '€ fijo × viaje', "togglePlus('plusJT')");
  if(F.plusIntlAuto){
    h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;'
      + 'background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.3);'
      + 'border-radius:9px;margin-top:4px">'
      + '<span style="font-size:13px">🌍</span>'
      + '<div style="flex:1"><div style="font-size:11px;font-weight:700;color:var(--cyan2)">Plus Internacional</div>'
      + '<div style="font-size:9px;color:var(--tx3)">Activado automáticamente</div></div>'
      + '<span style="font-size:11px;font-weight:800;color:var(--cyan2)">+'
      + pIntl.toFixed(2) + ' €</span></div>';
  }
  return h + '</div>';
}

function renderFormBody(){
  var b=document.getElementById('form-body');
  var t=F.tipo;var h='';

  if((t==='trabajado'&&F.modoTrabajado!=='reserva')||t==='ordinario'||(t==='art5152'&&F.modoArt5152!=='reserva')){
    h+=secLinea();
    h+=secPreguntaPernocta();
    h+=secTramo('ida');
    // Los tramos 2 y 3 se envuelven en contenedor-vuelta para que
    // toggleSoloIda pueda ocultarlos/mostrarlos como grupo
    if(F.modo){
      h+='<div id="contenedor-vuelta">';
      if(F.modo==='pernocta3') h+=secTramoIntermedio();
      h+=secTramo('vuelta');
      h+='</div>';
    }
    if(t==='trabajado') h+=secDescFlow();
    if(t==='art5152') h+=secArt5152Flow();
  } else if(t==='trabajado'&&F.modoTrabajado==='reserva'){
    // NUEVO — Reserva (HTDL): formulario simple de toma/deje. Al
    // guardar, F.hF/F.hL ya están rellenos (ver secReservaHTDL) y el
    // turno se guarda como 'trabajado' normal — pasa íntegro por el
    // motor de cálculo ya existente, sin ninguna rama especial.
    h+=secReservaHTDL();
  } else if(t==='art5152'&&F.modoArt5152==='reserva'){
    // NUEVO — Reserva (Art.51/52): formulario simple de toma/deje, sin
    // tramos, rutas ni trenes. Se paga directamente en dinero con la
    // tarifa de Art.51/52 configurada según el rol en Ajustes.
    h+=secReservaArt5152();
  } else if(t==='reserva'){
    h+='<div class="fsec"><div class="ibox blue"><span class="ibox-i">⏳</span><span>La reserva se guardará. Usa "Pinchar / Verificar" desde la tarjeta del día si trabajas.</span></div></div>';
  } else if(t==='descanso'){
    h+=secDescansoOpciones();
  } else if(t==='baja'){
    h+='<div class="fsec"><div class="ibox red"><span class="ibox-i">🏥</span><span>Baja médica o laboral. Se registra en el calendario.</span></div></div>';
  }
  h+=secPlusesViaje();
  h+='<div class="notas-wrap"><textarea class="notas-inp" rows="2" placeholder="Notas opcionales…" oninput="F.notas=this.value">'+( F.notas||'')+'</textarea></div>';
  b.innerHTML=h;
  if(F.comp==='dias' || F.comp==='mix' || (F.tipo==='art5152' && (F.compArt5152==='dias'||F.compArt5152==='mix'))) renderMiniCal();
}

function secLinea(){
  var modoActivo = F.modo;
  var h = '<div class="fsec">';

  // ── Chips de línea (restaurados) ──
  h += '<div class="fsec-lbl">Línea</div>';
  h += '<div class="linea-chips">'
     + Object.keys(LINEAS).map(function(l){
         return '<div class="lchip '+(F.linea===l?'on':'')+'" onclick="setLinea(\''+l+'\')">'+l+'</div>';
       }).join('')
     + '</div>';

  // ── Switch Solo Ida + contenedor-vuelta (restaurados) ──
  // Solo visible cuando hay modo (ida/pernocta/pernocta3)
  if(modoActivo){
    var esP = modoActivo==='pernocta'||modoActivo==='pernocta3';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;'
      +'padding:10px 12px;background:var(--s2);border:1px solid var(--div);'
      +'border-radius:12px;margin-bottom:8px;margin-top:4px">'
      +'<div style="display:flex;align-items:center;gap:7px">'
      +'<span style="font-size:14px">'+(esP?'🌙':'↩')+'</span>'
      +'<div><div style="font-size:9px;font-weight:800;color:var(--amber2);letter-spacing:.5px">'
      +(modoActivo==='pernocta3'?'TRAMOS 2 y 3':'TRAMO 2')+'</div>'
      +'<div style="font-size:9px;color:var(--tx3);margin-top:1px">Desactiva si solo hay un tramo</div></div>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:7px;cursor:pointer" onclick="toggleSoloIda()">'
      +'<span id="solo-ida-lbl" style="font-size:10px;font-weight:800;color:var(--tx3)">Solo Tramo 1</span>'
      +'<div id="solo-ida-sw" style="width:38px;height:22px;background:var(--div);border-radius:11px;'
      +'position:relative;transition:background .25s;flex-shrink:0">'
      +'<div id="solo-ida-knob" style="width:18px;height:18px;background:var(--tx3);border-radius:50%;'
      +'position:absolute;top:2px;left:2px;transition:left .25s;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>'
      +'</div></div></div>';
  }

  h += '</div>';
  return h;
}

function secPreguntaPernocta(){
  return '<div class="fsec" style="padding-bottom:5px"><div class="fsec-lbl">¿Cuándo vuelves?</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
    +'<div class="da-btn w-verde '+(F.modo==='ida'?'on':'')+'" onclick="setModo(\'ida\')">'
    +'<div class="da-ico">🔄</div><div class="da-lbl">Mismo día</div><div class="da-sub">Ida y vuelta hoy</div></div>'
    +'<div class="da-btn w-amber '+(F.modo==='pernocta'?'on':'')+'" onclick="setModo(\'pernocta\')">'
    +'<div class="da-ico">🌙</div><div class="da-lbl">Pernocta</div><div class="da-sub">Vuelta al día siguiente</div></div>'
    +'<div class="da-btn w-amber '+(F.modo==='pernocta3'?'on':'')+'" onclick="setModo(\'pernocta3\')">'
    +'<div class="da-ico">🌙🌙</div><div class="da-lbl">Pernocta 3 días</div><div class="da-sub">Vuelta a los 2 días</div></div>'
    +'</div></div>';
}

function secTramo(tramo){
  var esV=tramo==='vuelta';
  var sk=esV?'sal2':'sal',lk=esV?'lle2':'lle',hFk=esV?'hF2':'hF',hLk=esV?'hL2':'hL';
  var sv=F[sk]||'',lv=F[lk]||'',hFv=F[hFk]||'',hLv=F[hLk]||'';
  var isBase=!esV&&sv&&sv===AJ.base;
  var sShow=sv;
  var lShow=lv;
  var esPernocta=(F.modo==='pernocta'||F.modo==='pernocta3');

  // ── Etiquetas por tramo/día ──
  var hdrColor, hdrTxtColor, hdrIco, hdrTxt;
  if(esV){
    if(F.modo==='pernocta3'){
      hdrIco='3️⃣'; hdrTxt='TRAMO 3 — Día 3';
      hdrColor='rgba(245,158,11,.12)'; hdrTxtColor='var(--amber2)';
    } else if(esPernocta){
      hdrIco='2️⃣'; hdrTxt='TRAMO 2 — Día 2';
      hdrColor='rgba(245,158,11,.12)'; hdrTxtColor='var(--amber2)';
    } else {
      hdrIco='2️⃣'; hdrTxt='TRAMO 2 — Mismo día';
      hdrColor='rgba(59,127,255,.1)'; hdrTxtColor='var(--acc2)';
    }
  } else {
    hdrIco='1️⃣'; hdrTxt='TRAMO 1 — Día 1';
    hdrColor='rgba(59,127,255,.08)'; hdrTxtColor='var(--acc2)';
  }

  // ── Nº Tren (propio de este tramo) ──
  var trenKey   = esV ? 'numTrenVuelta' : 'numTren';
  var trenVal   = F[trenKey] || '';
  var trenId    = esV ? 'inp-numtren2' : 'inp-numtren';
  var trenBCol  = trenVal ? 'var(--acc2)' : 'var(--div)';

  // ── DH de este tramo ──
  var dhTramoKey = esV ? 'vuelta' : 'ida';
  var dhActivo   = esV ? F.estadoServicioVuelta==='dh' : F.estadoServicio==='dh';
  var dhDetalle  = esV ? (F.estadoServicioVueltaDetalle||'') : (F.estadoServicioDetalle||'');
  var dhHTML = '';
  if(dhActivo){
    dhHTML = '<div onclick="abrirDHPopup(\''+dhTramoKey+'\')" style="'
      +'display:flex;align-items:center;gap:10px;'
      +'background:rgba(245,158,11,.15);border:2px solid var(--amber2);'
      +'border-radius:12px;padding:10px 14px;cursor:pointer;margin-bottom:8px;'
      +'box-shadow:0 0 0 3px rgba(245,158,11,.1)">'
      +'<span style="font-size:18px">🔀</span>'
      +'<div style="flex:1">'
      +'<div style="font-size:10px;font-weight:900;color:var(--amber2)">SERVICIO DH ACTIVO</div>'
      +'<div style="font-size:10px;color:var(--tx2);margin-top:2px">📍 '+dhDetalle+'</div>'
      +'</div>'
      +'<span style="font-size:10px;color:var(--amber2);font-weight:700">Editar ›</span>'
      +'</div>';
  } else {
    dhHTML = '<button onclick="abrirDHPopup(\''+dhTramoKey+'\')" style="'
      +'padding:7px 12px;border-radius:8px;border:1.5px solid var(--div);'
      +'background:var(--s2);color:var(--tx3);font-size:11px;font-weight:700;'
      +'cursor:pointer;display:inline-flex;align-items:center;gap:5px;'
      +'margin-bottom:8px;transition:all .15s">'
      +'🔀 Marcar DH</button>';
  }

  // ── Duración y nocturnidad ──
  var dur=hFv&&hLv?'<div class="dur-badge" id="dur-'+(esV?'v':'i')+'">⏱ '+calcDur(hFv,hLv)+'</div>':'<div id="dur-'+(esV?'v':'i')+'"></div>';
  var hayNocEste = esV
    ? ((F.hF2&&esHoraNocturna(F.hF2))||(F.hL2&&esHoraNocturna(F.hL2)))
    : ((F.hF&&esHoraNocturna(F.hF))||(F.hL&&esHoraNocturna(F.hL)));
  var nocBadge = hayNocEste
    ? '<div style="display:inline-flex;align-items:center;gap:5px;'
      +'background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);'
      +'border-radius:7px;padding:4px 10px;font-size:10px;font-weight:700;'
      +'color:var(--amber2);margin-bottom:6px">'
      +'🌙 Nocturnidad activa · +'+parseFloat(AJ.nocturnidad||0).toFixed(2)+' €/h</div>'
    : '';

  // ── Tramos de continuidad — mismo servicio, tren y horario propios ──
  // REDISEÑO — misma apariencia y componentes que el tramo normal
  // (SALIDA/LLEGADA y FIRMA/LLEGADA con el mismo selector de siempre,
  // en vez de inputs de texto sueltos). El tiempo de escala ya NO se
  // escribe a mano: se calcula solo a partir de la hora de llegada
  // del tramo anterior y la hora de salida de este.
  var contKey = esV ? 'continuidadVuelta' : 'continuidad';
  var contArr = F[contKey] || [];
  // Se recalcula la escala informativa cada vez que se renderiza, por
  // si acaba de cambiar alguna hora (autocompletado o edición manual).
  recalcularContinuidad(esV ? (F.hL2||'') : (F.hL||''), contArr);
  var contHTML = contArr.length
    ? '<div class="fsec-lbl" style="margin-top:8px">Tramos de continuidad <span style="color:var(--tx3)">(mismo servicio, otro tren)</span></div>'
    : '';
  contArr.forEach(function(c, idx){
    c = c || {};
    var kSal = _contKeyGen('Sal', tramo, idx), kLle = _contKeyGen('Lle', tramo, idx);
    var kHF  = _contKeyGen('HF',  tramo, idx), kHL  = _contKeyGen('HL',  tramo, idx);
    var esDHCont = c.tipoTramo === 'dh';

    // ── DH de este tramo de continuidad — misma estética que "Marcar
    // DH" del tramo principal (tarjeta grande en ámbar cuando activo),
    // pero abre un popup propio (abrirDHContinuidadPopup) que pregunta
    // desde/hasta estación y hora de inicio/fin de la parte SIN
    // trabajar — igual que hace el DH del tramo principal, en vez de
    // marcar el tramo entero de golpe.
    var dhRangoTxt = (c.dhDesde||c.dhHasta)
      ? ((c.dhDesde||'inicio del tramo')+' → '+(c.dhHasta||'?'))
      : '';
    var dhHorasTxt = (c.dhHoraInicio&&c.dhHoraFin) ? (c.dhHoraInicio+' – '+c.dhHoraFin) : '';
    var dhContHTML = esDHCont
      ? '<div onclick="abrirDHContinuidadPopup(\''+tramo+'\','+idx+')" style="'
        +'display:flex;align-items:center;gap:10px;background:rgba(245,158,11,.15);'
        +'border:2px solid var(--amber2);border-radius:12px;padding:10px 14px;cursor:pointer;'
        +'margin-bottom:8px;box-shadow:0 0 0 3px rgba(245,158,11,.1)">'
        +'<span style="font-size:18px">🔀</span>'
        +'<div style="flex:1">'
        +'<div style="font-size:10px;font-weight:900;color:var(--amber2)">DH · SUMA A PRESENCIA</div>'
        +'<div style="font-size:10px;color:var(--tx2);margin-top:2px">'+(dhRangoTxt||'Toca para indicar desde/hasta dónde')+(dhHorasTxt?' · '+dhHorasTxt:'')+'</div>'
        +'</div>'
        +'<span style="font-size:10px;color:var(--amber2);font-weight:700">Editar ›</span>'
        +'</div>'
      : '<button onclick="abrirDHContinuidadPopup(\''+tramo+'\','+idx+')" style="'
        +'padding:7px 12px;border-radius:8px;border:1.5px solid var(--div);'
        +'background:var(--s2);color:var(--tx3);font-size:11px;font-weight:700;'
        +'cursor:pointer;display:inline-flex;align-items:center;gap:5px;'
        +'margin-bottom:8px;transition:all .15s">'
        +'🔀 Marcar DH (viajas sin trabajar)</button>';

    // ── Escala informativa (ya NO es un campo que se escriba a mano:
    // se calcula sola a partir de la llegada del tramo anterior y la
    // salida de este, igual que pide la regla de oro del horario real).
    var escalaInfo = (c.escalaMin!=null)
      ? '<div style="font-size:10px;color:var(--tx3);margin-top:2px">⏳ Escala: '+c.escalaMin+' min (calculada)</div>'
      : '<div style="font-size:10px;color:var(--tx3);margin-top:2px">La escala se calculará sola en cuanto haya hora de llegada del tramo anterior y hora de salida de este.</div>';

    var sSal = c.salida, sLle = c.llegada, sHF = c.horaInicio, sHL = c.horaFin;

    contHTML += '<div class="tramo-container" data-tramo="continuidad" data-subtramo="'+tramo+'" data-idx="'+idx+'" '
      +'style="border-top:1px solid var(--div);padding-top:10px;margin-top:6px">'
      +'<div class="tramo-hdr" style="background:rgba(59,127,255,.08);margin-bottom:5px">'
      +'<span>🚆</span>'
      +'<span style="font-size:9px;font-weight:800;color:var(--acc2);flex:1">CONT. '+(idx+2)+(esDHCont?' · DH':'')+'</span>'
      +'<span onclick="quitarTramoContinuidad(\''+tramo+'\','+idx+')" style="font-size:11px;font-weight:700;color:var(--tx3);cursor:pointer">✕ Quitar</span>'
      +'</div>'
      // Nº Tren — mismo tamaño/estilo que el tramo principal
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
      +'<div style="font-size:16px">🚆</div>'
      +'<input type="text" inputmode="numeric" placeholder="Nº tren, ej: 2081" value="'+(c.tren||'')+'" autocomplete="off"'
      +' oninput="autocompletarTramo(this);mostrarSugerenciasTren(this)" onblur="setTimeout(cerrarSugerenciasTren,180)"'
      +' style="flex:1;background:var(--s2);border:1.5px solid '+(c.tren?'var(--acc2)':'var(--div)')+';border-radius:10px;'
      +'color:var(--tx);font-size:22px;font-weight:800;padding:8px 13px;outline:none;'
      +'font-variant-numeric:tabular-nums;-moz-appearance:textfield;letter-spacing:1px">'
      +'</div>'
      +dhContHTML
      // Trayecto — mismos selectores SALIDA/LLEGADA que el tramo normal
      +'<div class="fsec-lbl">Trayecto</div>'
      +'<div class="sf '+(sSal?'fil':'')+'" onclick="openEstSheet(\''+kSal+'\')">'
      +'<div class="sf-i">🚉</div><div class="sf-b"><div class="sf-lbl">SALIDA</div>'
      +'<div class="sf-val '+(sSal?'':'ph')+'" data-f="'+kSal+'">'+(sSal||'Seleccionar')+'</div>'
      +'</div><span class="sf-arr">⌄</span></div>'
      +'<div class="sf '+(sLle?'fil':'')+'" onclick="openEstSheet(\''+kLle+'\')">'
      +'<div class="sf-i">🏁</div><div class="sf-b"><div class="sf-lbl">LLEGADA</div>'
      +'<div class="sf-val '+(sLle?'':'ph')+'" data-f="'+kLle+'">'+(sLle||'Seleccionar')+'</div>'
      +'</div><span class="sf-arr">⌄</span></div>'
      // Horario — mismos selectores FIRMA/LLEGADA que el tramo normal
      +'<div class="fsec-lbl" style="margin-top:5px">Horario</div>'
      +'<div class="hora-row">'
      +'<div class="sf '+(sHF?'fil':'')+'" onclick="openHora(\''+kHF+'\')">'
      +'<div class="sf-i">⏱</div><div class="sf-b"><div class="sf-lbl">FIRMA</div>'
      +'<div class="sf-val '+(sHF?'hv':'ph')+'" data-hora="'+kHF+'">'+(sHF||'--:--')+'</div>'
      +'</div></div>'
      +'<div class="sf '+(sHL?'fil':'')+'" onclick="openHora(\''+kHL+'\')">'
      +'<div class="sf-i">🔚</div><div class="sf-b"><div class="sf-lbl">LLEGADA</div>'
      +'<div class="sf-val '+(sHL?'hv':'ph')+'" data-hora="'+kHL+'">'+(sHL||'--:--')+'</div>'
      +'</div></div>'
      +'</div>'
      +escalaInfo
      +'<div style="font-size:9px;color:var(--tx3);margin-top:4px">'
      +'Este tramo se sumará a: <strong style="color:var(--acc3)">'+(esDHCont?'Presencia':'Efectiva')+'</strong></div>'
      +(sHF&&sHL?'<div class="dur-badge" style="margin-top:6px">⏱ '+calcDur(sHF,sHL)+'</div>':'')
      +'</div>';
  });
  contHTML += '<button onclick="agregarTramoContinuidad(\''+tramo+'\')" style="width:100%;padding:9px;'
    +'background:var(--s2);border:1.5px dashed var(--div);border-radius:10px;color:var(--tx2);'
    +'font-size:12px;font-weight:700;cursor:pointer;margin-bottom:8px">+ Añadir tramo de continuidad</button>';

  return '<div class="fsec tramo-container" data-tramo="'+(esV?'vuelta':'ida')+'" style="border-top:1px solid var(--div)">'
    +'<div class="tramo-hdr" style="background:'+hdrColor+';margin-bottom:5px">'
    +'<span>'+hdrIco+'</span>'
    +'<span style="font-size:9px;font-weight:800;color:'+hdrTxtColor+'">'+hdrTxt+'</span>'
    +'</div>'
    // Nº Tren — SIEMPRE arriba, dentro del bloque
    +'<div class="fsec-lbl">Nº Tren</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
    +'<div style="font-size:20px">🚆</div>'
    +'<input id="'+trenId+'" data-campo-tren="'+trenKey+'" type="text" inputmode="numeric" placeholder="Ej: 2080" autocomplete="off"'
    +' value="'+trenVal+'"'
    +' oninput="autocompletarTramo(this);mostrarSugerenciasTren(this)" onblur="setTimeout(cerrarSugerenciasTren,180)"'
    +' style="flex:1;background:var(--s2);border:1.5px solid '+trenBCol+';border-radius:10px;'
    +'color:var(--tx);font-size:22px;font-weight:800;padding:8px 13px;outline:none;'
    +'font-variant-numeric:tabular-nums;-moz-appearance:textfield;letter-spacing:1px">'
    +'</div>'
    +dhHTML
    // Trayecto
    +'<div class="fsec-lbl">Trayecto</div>'
    +'<div class="sf '+(sShow?'fil':'')+'" onclick="openEstSheet(\''+sk+'\')">'
    +'<div class="sf-i">🚉</div><div class="sf-b"><div class="sf-lbl">SALIDA</div>'
    +'<div class="sf-val '+(sShow?'':'ph')+'" data-f="'+sk+'">'+(sShow||'Seleccionar')+'</div>'
    +(isBase?'<div class="sf-base">🏠 Base</div>':'')
    +'</div><span class="sf-arr">⌄</span></div>'
    +'<div class="sf '+(lShow?'fil':'')+'" onclick="openEstSheet(\''+lk+'\')">'
    +'<div class="sf-i">🏁</div><div class="sf-b"><div class="sf-lbl">LLEGADA</div>'
    +'<div class="sf-val '+(lShow?'':'ph')+'" data-f="'+lk+'">'+(lShow||'Seleccionar')+'</div>'
    +'</div><span class="sf-arr">⌄</span></div>'
    // Horario
    +'<div class="fsec-lbl" style="margin-top:5px">Horario</div>'
    +'<div class="hora-row">'
    +'<div class="sf '+(hFv?'fil':'')+'" onclick="openHora(\''+hFk+'\')">'
    +'<div class="sf-i">⏱</div><div class="sf-b"><div class="sf-lbl">FIRMA</div>'
    +'<div class="sf-val '+(hFv?'hv':'ph')+'" data-hora="'+hFk+'">'+(hFv||'--:--')+'</div>'
    +'</div></div>'
    +'<div class="sf '+(hLv?'fil':'')+'" onclick="openHora(\''+hLk+'\')">'
    +'<div class="sf-i">🔚</div><div class="sf-b"><div class="sf-lbl">LLEGADA</div>'
    +'<div class="sf-val '+(hLv?'hv':'ph')+'" data-hora="'+hLk+'">'+(hLv||'--:--')+'</div>'
    +'</div></div>'
    +'</div>'+nocBadge+dur
    // FIX — el bloque "TRAMOS DE CONTINUIDAD" (tren 2, 3...) ahora va
    // AQUÍ, después de que el Tramo 1 esté completo del todo (su
    // propio tren + trayecto + horario). Antes se insertaba justo
    // después del número de tren del Tramo 1, ANTES de su propia
    // Trayecto/Horario — así que al rellenar salía primero el tramo 2
    // entero y solo al final los datos del tramo 1, en el orden
    // contrario al que se lee (Tren → Estación → Horario, Tren 2 →
    // Estación → Horario, y no al revés).
    +contHTML
    +'</div>';
}

/* ═══════════════════════════════════════════════════════════
   TRAMOS DE CONTINUIDAD — mismo servicio, tren y horario propios.
   Cada tramo añadido es un objeto independiente:
     { tren, horaInicio, horaFin, escalaMin }
   El tiempo de escala es EXCLUSIVO de estos tramos añadidos — el
   tramo principal (ida/vuelta) nunca lo usa ni lo muestra. Se
   guardan como array (F.continuidad / F.continuidadVuelta), nunca
   como variables fijas tramo1/tramo2. El cálculo de Efectivas y
   Presencia vive únicamente en calculateEarnings() — ver el bloque
   "Horas Efectivas / Presencia — DH validado" para la inyección.
═══════════════════════════════════════════════════════════ */
// NUEVO — claves virtuales para que los tramos de continuidad puedan
// reutilizar EXACTAMENTE los mismos selectores de estación/hora que ya
// usa el tramo normal (openEstSheet/openHora), en vez de inputs de
// texto sueltos. Formato: 'contSal_ida_0', 'contHF_vuelta_1', etc.
function _contKeyGen(tipo, tramo, idx){ return 'cont'+tipo+'_'+tramo+'_'+idx; }
function _contKeyParse(key){
  var m = /^cont(Sal|Lle|HF|HL)_(ida|vuelta)_(\d+)$/.exec(String(key||''));
  if(!m) return null;
  return { tipo: m[1], tramo: m[2], idx: parseInt(m[3],10) };
}
function _contArrFor(info){
  var k = info.tramo==='vuelta' ? 'continuidadVuelta' : 'continuidad';
  if(!F[k]) F[k]=[];
  if(!F[k][info.idx]) F[k][info.idx] = {tren:'', horaInicio:'', horaFin:'', escalaMin:null, salida:'', llegada:'', tipoTramo:'trabajado'};
  return F[k];
}

// FIX — REDISEÑO: antes había que escribir a mano los "minutos de
// escala" y la app calculaba horaInicio/horaFin sumando esos minutos a
// la llegada del tramo anterior (tiempos inventados, no los reales del
// tren). Ahora horaInicio/horaFin se autocompletan del tren guardado
// (o se eligen a mano con el mismo selector de hora de siempre) — la
// ESCALA pasa a ser un dato INFORMATIVO, calculado como la diferencia
// entre la llegada del tramo anterior y la salida de este. Se
// mantiene compatibilidad con tramos ya guardados solo con
// escalaMin (flujo antiguo): esos siguen derivando sus horas igual
// que siempre.
function recalcularContinuidad(horaLlegadaTramoAnterior, arr){
  var horaAnterior = horaLlegadaTramoAnterior || '';
  (arr||[]).forEach(function(c){
    if(c.horaInicio){
      if(horaAnterior){
        var mIni = _horasToMin(horaAnterior), mFin = _horasToMin(c.horaInicio);
        var diff = mFin - mIni; if(diff<0) diff += 1440;
        c.escalaMin = diff;
      }
    } else if(c.escalaMin!=null && c.escalaMin>=0){
      var m = horaAnterior ? _horasToMin(horaAnterior) : null;
      if(m!=null){
        m += c.escalaMin; if(m>=1440) m-=1440;
        c.horaInicio = horaAnterior;
        c.horaFin = _minToHoras(m);
      }
    }
    horaAnterior = c.horaFin || horaAnterior;
  });
}

function agregarTramoContinuidad(tramo){
  var key = tramo==='vuelta' ? 'continuidadVuelta' : 'continuidad';
  if(!F[key]) F[key] = [];
  F[key].push({tren:'', horaInicio:'', horaFin:'', escalaMin:null, salida:'', llegada:'', tipoTramo:'trabajado'});
  renderFormBody();
}
function quitarTramoContinuidad(tramo, idx){
  var key = tramo==='vuelta' ? 'continuidadVuelta' : 'continuidad';
  if(!F[key]) return;
  F[key].splice(idx, 1);
  renderFormBody();
}
function actualizarTramoContinuidad(tramo, idx, campo, valor){
  var key = tramo==='vuelta' ? 'continuidadVuelta' : 'continuidad';
  if(!F[key]) F[key] = [];
  if(!F[key][idx]) F[key][idx] = {tren:'', horaInicio:'', horaFin:'', escalaMin:null, salida:'', llegada:'', tipoTramo:'trabajado'};
  if(campo==='escalaMin'){
    var n = parseInt(valor);
    F[key][idx][campo] = isNaN(n) ? null : n;
  } else if(campo==='tipoTramo'){
    // NUEVO: 'trabajado' (Efectiva) o 'dh' (Presencia). No requiere
    // re-render completo del formulario (solo cambia un estilo), pero
    // se llama a renderFormBody() para reflejar el botón activo.
    F[key][idx][campo] = valor;
    renderFormBody();
    return;
  } else {
    F[key][idx][campo] = valor.trim();
  }
} // {tramo:'ida'|'vuelta', idx:N}

function abrirDHContinuidadPopup(tramo, idx){
  _dhContEditando = {tramo:tramo, idx:idx};
  var arr = _contArrFor(_dhContEditando);
  var c = arr[idx];
  var tit = document.getElementById('dhcont-tit');
  if(tit) tit.textContent = 'DH — Tren de continuidad '+(idx+2)+(c.tren?' · Tren #'+c.tren:'');
  var dIn = document.getElementById('dhcont-desde');
  var hIn = document.getElementById('dhcont-hasta');
  var iIn = document.getElementById('dhcont-hora-inicio');
  var fIn = document.getElementById('dhcont-hora-fin');
  if(dIn) dIn.value = c.dhDesde || '';
  if(hIn) hIn.value = c.dhHasta || '';
  if(iIn) iIn.value = c.dhHoraInicio || '';
  if(fIn) fIn.value = c.dhHoraFin || '';
  openOv('ov-dh-cont');
}

function guardarDHContinuidad(){
  if(!_dhContEditando) return;
  var hasta = (document.getElementById('dhcont-hasta').value||'').trim();
  var horaIni = document.getElementById('dhcont-hora-inicio').value||'';
  var horaFin = document.getElementById('dhcont-hora-fin').value||'';
  if(!hasta || !horaIni || !horaFin){
    alert('Faltan datos: indica al menos hasta qué estación y las horas de inicio y fin de la parte sin trabajar.');
    return;
  }
  var arr = _contArrFor(_dhContEditando);
  var c = arr[_dhContEditando.idx];
  c.dhDesde = (document.getElementById('dhcont-desde').value||'').trim();
  c.dhHasta = hasta;
  c.dhHoraInicio = horaIni;
  c.dhHoraFin = horaFin;
  c.tipoTramo = 'dh';
  closeOv('ov-dh-cont');
  renderFormBody();
}

function quitarDHContinuidad(){
  if(!_dhContEditando) return;
  var arr = _contArrFor(_dhContEditando);
  var c = arr[_dhContEditando.idx];
  c.tipoTramo = 'trabajado';
  c.dhDesde = ''; c.dhHasta = ''; c.dhHoraInicio = ''; c.dhHoraFin = '';
  closeOv('ov-dh-cont');
  renderFormBody();
}

function secDescansoOpciones(){
  return '<div class="fsec"><div class="ibox green"><span class="ibox-i">🧘</span>'
    +'<span>Día de descanso. ¿Lo has trabajado?</span></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">'
    +'<div class="da-btn w-verde" onclick="guardarDescansoSimple()">'
    +'<div class="da-ico">✅</div><div class="da-lbl">Solo descanso</div><div class="da-sub">Día libre</div></div>'
    +'<div class="da-btn w-violet" onclick="abrirTrabajoEnDescanso()">'
    +'<div class="da-ico">💼</div><div class="da-lbl">He trabajado</div><div class="da-sub">Con compensación</div></div>'
    +'</div></div>';
}

/* ═══════════════════════════════════════════════════════════
   PERNOCTA 3 DÍAS — tercer tramo (campo nuevo, aditivo)
   Reutiliza el mismo estilo visual de secTramo() pero opera
   sobre campos NUEVOS (sal3/lle3/hF3/hL3), sin tocar en
   absoluto los campos sal/lle/hF/hL (ida) ni sal2/lle2/hF2/hL2
   (vuelta) que ya usan los turnos "ida y vuelta" y "pernocta".
═══════════════════════════════════════════════════════════ */
function secTramoIntermedio(){
  var sv=F.sal3||'',lv=F.lle3||'',hFv=F.hF3||'',hLv=F.hL3||'';
  // SIN sugerencias cruzadas — cada campo muestra SOLO lo que tiene
  var sShow=sv;
  var lShow=lv;
  var numTrenIntVal = F.numTrenIntermedio||'';
  var dur=hFv&&hLv?'<div class="dur-badge" id="dur-i3">⏱ '+calcDur(hFv,hLv)+'</div>':'<div id="dur-i3"></div>';

  // Escalas informativas (solo lectura, no modifican datos)
  var escala12 = calcularEscala(F.hL, hFv);
  var escalaBadge12 = escala12
    ? '<div style="display:inline-flex;align-items:center;gap:5px;background:rgba(59,130,246,.1);'
      +'border:1px solid rgba(59,130,246,.3);border-radius:7px;padding:4px 10px;font-size:10px;'
      +'font-weight:700;color:var(--acc2);margin-bottom:6px">⏳ Escala Tramo 1→2: '+escala12.txt+'</div>'
    : '';
  var hayNocEste=(hFv&&esHoraNocturna(hFv))||(hLv&&esHoraNocturna(hLv));
  var nocBadge=hayNocEste
    ? '<div style="display:inline-flex;align-items:center;gap:5px;'
      +'background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);'
      +'border-radius:7px;padding:4px 10px;font-size:10px;font-weight:700;'
      +'color:var(--amber2);margin-bottom:6px">'
      +'🌙 Nocturnidad activa · +'+parseFloat(AJ.nocturnidad||0).toFixed(2)+' €/h</div>'
    : '';
  var escala23 = calcularEscala(hLv, F.hF2);
  var escalaBadge23 = escala23
    ? '<div style="display:inline-flex;align-items:center;gap:5px;background:rgba(59,130,246,.1);'
      +'border:1px solid rgba(59,130,246,.3);border-radius:7px;padding:4px 10px;font-size:10px;'
      +'font-weight:700;color:var(--acc2);margin-bottom:6px;margin-left:6px">⏳ Escala Tramo 2→3: '+escala23.txt+'</div>'
    : '';

  return '<div class="fsec tramo-container" data-tramo="intermedio" style="border-top:1px solid var(--div)">'
    +'<div class="tramo-hdr" style="background:rgba(139,92,246,.12);margin-bottom:5px">'
    +'<span>2️⃣</span>'
    +'<span style="font-size:9px;font-weight:800;color:var(--violet2)">TRAMO 2 — Día 2</span>'
    +'</div>'
    +escalaBadge12+escalaBadge23
    +'<div class="fsec-lbl">Nº Tren (tramo intermedio)</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
    +'<div style="font-size:18px">🚆</div>'
    +'<input id="inp-numtren3" data-campo-tren="numTrenIntermedio" type="text" inputmode="numeric" placeholder="Ej: 2095" autocomplete="off"'
    +' oninput="autocompletarTramo(this);mostrarSugerenciasTren(this)" onblur="setTimeout(cerrarSugerenciasTren,180)"'
    +' value="'+numTrenIntVal+'"'
    +' style="flex:1;background:var(--s2);border:1.5px solid '+(numTrenIntVal?'var(--amber2)':'var(--div)')+';border-radius:10px;'
    +'color:var(--tx);font-size:18px;font-weight:800;padding:7px 12px;outline:none;'
    +'font-variant-numeric:tabular-nums;letter-spacing:1px">'
    +'</div>'
    +'<div class="fsec-lbl">Trayecto</div>'
    +'<div class="sf '+(sShow?'fil':'')+'" onclick="openEstSheet(\'sal3\')">'
    +'<div class="sf-i">🚉</div><div class="sf-b"><div class="sf-lbl">SALIDA</div>'
    +'<div class="sf-val '+(sShow?'':'ph')+'" data-f="sal3">'+(sShow||'Seleccionar')+'</div>'
    +'</div><span class="sf-arr">⌄</span></div>'
    +'<div class="sf '+(lShow?'fil':'')+'" onclick="openEstSheet(\'lle3\')">'
    +'<div class="sf-i">🏁</div><div class="sf-b"><div class="sf-lbl">LLEGADA</div>'
    +'<div class="sf-val '+(lShow?'':'ph')+'" data-f="lle3">'+(lShow||'Seleccionar')+'</div>'
    +'</div><span class="sf-arr">⌄</span></div>'
    +'<div class="fsec-lbl" style="margin-top:5px">Horario</div>'
    +'<div class="hora-row">'
    +'<div class="sf '+(hFv?'fil':'')+'" onclick="openHora(\'hF3\')">'
    +'<div class="sf-i">⏱</div><div class="sf-b"><div class="sf-lbl">FIRMA</div>'
    +'<div class="sf-val '+(hFv?'hv':'ph')+'" data-hora="hF3">'+(hFv||'--:--')+'</div>'
    +'</div></div>'
    +'<div class="sf '+(hLv?'fil':'')+'" onclick="openHora(\'hL3\')">'
    +'<div class="sf-i">🔚</div><div class="sf-b"><div class="sf-lbl">LLEGADA</div>'
    +'<div class="sf-val '+(hLv?'hv':'ph')+'" data-hora="hL3">'+(hLv||'--:--')+'</div>'
    +'</div></div>'
    +'</div>'+nocBadge+dur+'</div>';
}

function secDescFlow(){
  if(!F.modo) return '';

  var vh    = parseFloat(AJ.vh)||12.5;
  var noc   = parseFloat(AJ.nocturnidad)||0;
  var p     = AJ.pluses[AJ.rol]||PLUS_DEF[AJ.rol];
  var nDias = F.modo==='pernocta3'?6:(F.modo==='pernocta'?4:2);

  // Solo calculamos si eligió "dinero"
  var hayNoc  = F.hF?esHoraNocturna(F.hF)||(F.hL?esHoraNocturna(F.hL):false):false;
  var tasa    = vh+(hayNoc?noc:0);
  var hIda    = F.hF&&F.hL?Math.round(calcMins(F.hF,F.hL)/60*100)/100:0;
  var hVuelta = F.hF2&&F.hL2?Math.round(calcMins(F.hF2,F.hL2)/60*100)/100:0;
  var hTotal  = Math.round((hIda+hVuelta)*100)/100;

  // Pluses:
  // - Activación y JT: solo si el usuario los activó manualmente (toggle)
  // - Internacional: automático si la línea es Internacional
  var pAct  = F.plusAct      ? parseFloat(p.activacion||0)    : 0;
  var pJT   = F.plusJT       ? parseFloat(p.jt||0)            : 0;
  var pIntl = F.plusIntlAuto ? parseFloat(p.internacional||0) : 0;
  var imp   = Math.round((hTotal*tasa + pAct + pJT + pIntl)*100)/100;

  var h = '<div class="fsec" style="border-top:1px solid var(--div)">'
    +'<div class="fsec-lbl">Compensación — '+nDias+' días en mes siguiente</div>'
    +'<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">'
    +'<div class="cc-btn '+(F.comp==='dinero'?'on':'')+'" onclick="setComp(\'dinero\')">'
    +'<div class="cci">💶</div><div class="ccl">En dinero</div><div class="ccs">Pago €</div></div>'
    +'<div class="cc-btn '+(F.comp==='dias'?'on':'')+'" onclick="setComp(\'dias\')">'
    +'<div class="cci">📅</div><div class="ccl">'+nDias+' días</div><div class="ccs">Mes siguiente</div></div>'
    +((F.modo==='pernocta'||F.modo==='pernocta3')
      ? ('<div class="cc-btn '+(F.comp==='mix'?'on':'')+'" onclick="setComp(\'mix\')">'
        +'<div class="cci">🔀</div><div class="ccl">Mix</div><div class="ccs">Dinero + días</div></div>')
      : '')
    +'</div>';

  // ── Solo muestra cálculo si eligió DINERO ────────────────────
  if(F.comp==='dinero'){
    // Info tarifa
    h+='<div style="background:rgba(59,127,255,.06);border:1px solid rgba(59,127,255,.15);'
      +'border-radius:8px;padding:8px 11px;margin-bottom:10px;font-size:10px;color:var(--acc2);'
      +'display:flex;align-items:center;gap:6px">'
      +'<span>'+(AJ.rol==='tripulante'?'🚆':'🎫')+'</span>'
      +'<span>'+vh.toFixed(2)+' €/h'
      +(hayNoc?' <span style="color:var(--amber2)">+ noc '+noc.toFixed(2)+' €/h</span>':'')
      +' · Límite '+limiteHoras(F.sal)+'h</span></div>';

    // ── Toggles de pluses manuales ────────────────────────────
    h+='<div style="margin-bottom:10px">'
      +'<div style="font-size:8px;font-weight:800;letter-spacing:1px;color:var(--tx3);'
      +'margin-bottom:7px;text-transform:uppercase">Pluses activos este viaje</div>';

    // Toggle Plus Activación
    h+=plusToggle('plusAct', F.plusAct, 'Plus Activación',
      parseFloat(p.activacion||0), '€ fijo × viaje',
      'togglePlus(\'plusAct\')');

    // Toggle Plus JT
    h+=plusToggle('plusJT', F.plusJT, 'Plus JT',
      parseFloat(p.jt||0), '€ fijo × viaje',
      'togglePlus(\'plusJT\')');

    // Plus Internacional — automático, no toggle
    if(F.plusIntlAuto){
      h+='<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;'
        +'background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.3);'
        +'border-radius:9px;margin-bottom:6px">'
        +'<span style="font-size:13px">🌍</span>'
        +'<div style="flex:1"><div style="font-size:11px;font-weight:700;color:var(--cyan2)">Plus Internacional</div>'
        +'<div style="font-size:9px;color:var(--tx3)">Activado automáticamente · línea Internacional</div></div>'
        +'<span style="font-size:12px;font-weight:800;color:var(--cyan2)">+'+parseFloat(p.internacional||0).toFixed(2)+' €</span>'
        +'</div>';
    }

    h+='</div>';

    // ── Resultado ────────────────────────────────────────────
    h+='<div id="calc-result-cont" class="calc-result">';
    if(hTotal>0){
      h+='<div class="cr-row"><span class="cr-l">Horas ida</span><span class="cr-v">'+hIda+' h</span></div>';
      if(hVuelta>0) h+='<div class="cr-row"><span class="cr-l">Horas vuelta</span><span class="cr-v">'+hVuelta+' h</span></div>';
      h+='<div class="cr-row"><span class="cr-l"><strong>Total horas</strong></span><span class="cr-v"><strong>'+hTotal+' h</strong></span></div>';
      h+='<div class="cr-row"><span class="cr-l">Tarifa'+(hayNoc?' + nocturnidad':'')+'</span><span class="cr-v">'+tasa.toFixed(2)+' €/h</span></div>';
      if(pAct>0)  h+='<div class="cr-row"><span class="cr-l">Plus Activación</span><span class="cr-v">+'+pAct.toFixed(2)+' €</span></div>';
      if(pJT>0)   h+='<div class="cr-row"><span class="cr-l">Plus JT</span><span class="cr-v">+'+pJT.toFixed(2)+' €</span></div>';
      if(pIntl>0) h+='<div class="cr-row"><span class="cr-l">Plus Internacional</span><span class="cr-v">+'+pIntl.toFixed(2)+' €</span></div>';
      h+='<div class="cr-div"></div>'
        +'<div class="cr-total"><span class="cr-tl">Total a cobrar</span>'
        +'<span class="cr-tv">'+imp.toFixed(2)+' €</span></div>';
    } else {
      h+='<div style="font-size:10px;color:var(--tx3);padding:3px 0">'
        +'⚠️ Completa los tramos para ver el cálculo</div>';
    }
    h+='</div>';
  }

  // ── NUEVO — Mix (solo pernocta): compara ida vs vuelta con calcularMix()
  //    (función ya existente y compartida con Art.51/52, sin duplicar
  //    lógica). El tramo de más horas va a Dinero con la MISMA tarifa
  //    y pluses que ya calcula HTDL arriba; el de menos horas, a 2 días
  //    con selector de calendario (mismo mini-cal reutilizado). ──
  if(F.comp==='mix' && (F.modo==='pernocta'||F.modo==='pernocta3') && hIda>0 && hVuelta>0){
    var kIdaMix = selDay ? selDay.k : null;
    var kVueltaMix = kIdaMix ? _diaSiguienteKey(kIdaMix) : null;
    var mixHTDL = calcularMix(hIda, hVuelta, kIdaMix, kVueltaMix);
    var esIdaDinero = mixHTDL.diaDinero===kIdaMix;
    var horasDineroMix = mixHTDL.horasDinero;
    var impMix = Math.round((horasDineroMix*tasa + pAct + pJT + pIntl)*100)/100;
    h+='<div id="calc-result-cont" class="calc-result">'
      +'<div class="cr-row"><span class="cr-l">Tramo a Dinero</span><span class="cr-v">'+(esIdaDinero?'Ida':'Vuelta')+' · '+horasDineroMix+' h</span></div>'
      +'<div class="cr-row"><span class="cr-l">Tarifa'+(hayNoc?' + nocturnidad':'')+'</span><span class="cr-v">'+tasa.toFixed(2)+' €/h</span></div>'
      +(pAct>0?'<div class="cr-row"><span class="cr-l">Plus Activación</span><span class="cr-v">+'+pAct.toFixed(2)+' €</span></div>':'')
      +(pJT>0?'<div class="cr-row"><span class="cr-l">Plus JT</span><span class="cr-v">+'+pJT.toFixed(2)+' €</span></div>':'')
      +(pIntl>0?'<div class="cr-row"><span class="cr-l">Plus Internacional</span><span class="cr-v">+'+pIntl.toFixed(2)+' €</span></div>':'')
      +'<div class="cr-div"></div>'
      +'<div class="cr-total"><span class="cr-tl">Total a cobrar</span><span class="cr-tv">'+impMix.toFixed(2)+' €</span></div>'
      +'</div>'
      +'<div style="font-size:10px;color:var(--tx2);background:rgba(6,182,212,.06);'
      +'border:1px solid rgba(6,182,212,.18);border-radius:8px;padding:8px 10px;margin:8px 0">'
      +'📅 Tramo a <strong style="color:var(--cyan2)">Días</strong>: '+(esIdaDinero?'Vuelta':'Ida')+'. '
      +'Selecciona <strong style="color:var(--cyan2)">2 días</strong> en el mes siguiente.</div>'
      +'<div id="mini-cal-cont"></div>';
  }

  // ── Días de compensación (NO muestra cálculo económico) ──────
  if(F.comp==='dias'){
    h+='<div style="font-size:10px;color:var(--tx2);background:rgba(6,182,212,.06);'
      +'border:1px solid rgba(6,182,212,.18);border-radius:8px;padding:8px 10px;margin-bottom:8px">'
      +'📅 Selecciona <strong style="color:var(--cyan2)">'+nDias+' días</strong> en el mes siguiente. '
      +(F.modo==='pernocta'?'Pernocta → 4 días.':'Ida y vuelta → 2 días.')
      +'<br><span style="color:var(--tx3);font-size:9px">Solo días del mes posterior.</span></div>'
      +'<div id="mini-cal-cont"></div>';
  }

  h+='</div>';
  return h;
}

// Helper: genera un toggle de plus manual
function plusToggle(campo, activo, lbl, valor, sub, onclick){
  var col = activo ? 'var(--green)' : 'var(--div)';
  var bgCol = activo ? 'rgba(34,197,94,.1)' : 'var(--s2)';
  var txtCol = activo ? 'var(--green2)' : 'var(--tx2)';
  return '<div onclick="'+onclick+'" style="display:flex;align-items:center;gap:9px;'
    +'padding:9px 11px;background:'+bgCol+';border:1px solid '+col+';'
    +'border-radius:9px;cursor:pointer;transition:all .18s;margin-bottom:6px;user-select:none">'
    +'<div style="flex:1">'
    +'<div style="font-size:11px;font-weight:700;color:'+txtCol+'">'+lbl+'</div>'
    +'<div style="font-size:9px;color:var(--tx3)">'+valor.toFixed(2)+' '+sub+'</div>'
    +'</div>'
    +'<div style="width:40px;height:22px;border-radius:11px;background:'
    +(activo?'var(--green)':'var(--div)')+';position:relative;transition:background .2s;flex-shrink:0">'
    +'<div style="position:absolute;top:3px;left:'+(activo?'19px':'3px')
    +';width:16px;height:16px;border-radius:8px;background:#fff;transition:left .2s"></div>'
    +'</div></div>';
}

// Toggle manual de plus
function togglePlus(campo){
  F[campo]=!F[campo];
  renderFormBody();
}

/* ── Mini-cal compensación ── */
/* ═══════════════════════════════════════════════════════════
   NUEVO — Capa de validación de disponibilidad para días
   compensatorios (Art.51, Art.52 y HTDL). 100% aditiva: no toca
   ninguna fórmula de cálculo de horas ni de compensación — solo
   comprueba, justo antes de guardar, que los días elegidos siguen
   libres. Usa el MISMO criterio de ocupación que ya aplica el
   selector visual (renderMiniCal, más abajo), para que ambas capas
   nunca se contradigan entre sí.

   estaDiaDisponible(fecha, origenExcluido):
     · fecha: 'YYYY-MM-DD' a comprobar.
     · origenExcluido (opcional): key del turno que se está guardando
       — si el día ya es un 'comp' que pertenece a ESE MISMO turno
       (se va a regenerar de todas formas), no cuenta como ocupado.
   Devuelve true si el día está libre, false si está ocupado.
═══════════════════════════════════════════════════════════ */
function estaDiaDisponible(fecha, origenExcluido){
  var t = TV[fecha];
  // FIX — antes se exceptuaba 'descanso', tratándolo como disponible.
  // Ahora CUALQUIER día con un turno ya asignado (descanso, jornada
  // ordinaria/trabajada, baja, vacaciones, reserva, art5152, etc.)
  // cuenta como ocupado. La única excepción sigue siendo un día
  // 'comp' que pertenece al propio turno que se está editando (se va
  // a regenerar de todas formas, no es una ocupación real ajena).
  if(t){
    var esCompDeEsteTurno = t.tipo==='comp' && origenExcluido && t.origen===origenExcluido;
    if(!esCompDeEsteTurno) return false;
  }
  if(TV2[fecha] && TV2[fecha].length>0) return false;
  return true;
}

function renderMiniCal(){
  var cont=document.getElementById('mini-cal-cont');
  if(!cont||!miniM)return;
  // Asegurar que miniM es el mes siguiente al del turno
  if(selDay){
    var _ssm=selDay.k.split('-').map(Number);var sy=_ssm[0],sm=_ssm[1];
    var mExp=sm===12?1:sm+1,yExp=sm===12?sy+1:sy;
    if(miniM.getFullYear()<yExp||(miniM.getFullYear()===yExp&&miniM.getMonth()+1<mExp))
      miniM=new Date(yExp,mExp-1,1);
  }
  var y=miniM.getFullYear(),m=miniM.getMonth();
  var ultimo=new Date(y,m+1,0).getDate();
  var esMixActivo = (F.comp==='mix') || (F.tipo==='art5152' && F.compArt5152==='mix');
  var nDias = esMixActivo
    ? 2                                                          // Mix: siempre 2 días (HTDL y Art.51/52)
    : F.tipo==='art5152'
      ? ((F.modo==='pernocta'||F.modo==='pernocta3') ? 4 : 2)     // Art.51/52: 2 o 4, nunca 6
      : (F.modo==='pernocta3'?6:(F.modo==='pernocta'?4:2));       // HTDL: sin cambios
  var sd=new Date(y,m,1).getDay();sd=sd===0?6:sd-1;
  var cells='';
  for(var i=0;i<sd;i++)cells+='<div class="mc-d mc-dis">·</div>';
  for(var d=1;d<=ultimo;d++){
    var iso=key(y,m+1,d);
    var sel=diasComp.includes(iso);
    // FIX — un día marcado como 'comp' que pertenece a ESTE MISMO
    // turno (TV[iso].origen === el día que se está editando) nunca
    // debe bloquearse, aunque el usuario lo haya deseleccionado
    // momentáneamente para elegir otro. Antes, al quitar la marca de
    // un día ya guardado, ese día quedaba "atrapado" como si lo
    // ocupara otro turno y no se podía volver a seleccionar en la
    // misma edición.
    // NUEVO — se unifica el criterio visual con la MISMA función
    // maestra que ahora valida en el guardado (estaDiaDisponible),
    // para que el selector y el guardado nunca se contradigan entre
    // sí. Se mantiene la excepción de "esDeEsteTurno" integrada
    // dentro de la propia función (origenExcluido).
    var disponible = estaDiaDisponible(iso, selDay?selDay.k:null);
    var bloq = !disponible && !sel;
    cells+='<div class="mc-d '+(sel?'mc-sel':'')+(bloq?' mc-dis bloqueado':'')+'" onclick="toggleComp(\''+iso+'\','+nDias+')">'+d+'</div>';
  }
  var _ss3=selDay?selDay.k.split('-').map(Number):[y,m+1];var sy=_ss3[0],sm=_ss3[1];
  var mMin=sm===12?1:sm+1,yMin=sm===12?sy+1:sy;
  var puedeRetro=y>yMin||(y===yMin&&m+1>mMin);
  cont.innerHTML='<div class="mini-cal-wrap">'
    +'<div class="mc-hdr">'
    +'<button class="mc-nav" onclick="chMiniCal(-1)" '+(puedeRetro?'':'style="opacity:.3;pointer-events:none"')+'>‹</button>'
    +'<div class="mc-mes">'+MESES[m]+' '+y+'</div>'
    +'<button class="mc-nav" onclick="chMiniCal(1)">›</button>'
    +'</div>'
    +'<div class="mc-dow"><div class="mc-dh">L</div><div class="mc-dh">M</div><div class="mc-dh">X</div><div class="mc-dh">J</div><div class="mc-dh">V</div><div class="mc-dh">S</div><div class="mc-dh">D</div></div>'
    +'<div class="mc-grid">'+cells+'</div>'
    +'<div class="mc-count"><span>'+diasComp.length+'/'+nDias+'</span> días '+MESES[m]+' '+y+(diasComp.length===nDias?' ✅':'')+'</div>'
    +'</div>';
}

function chMiniCal(dir){
  if(!selDay)return;
  miniM.setMonth(miniM.getMonth()+dir);
  var _ssm2=selDay.k.split('-').map(Number);var sy=_ssm2[0],sm=_ssm2[1];
  var mMin=sm===12?1:sm+1,yMin=sm===12?sy+1:sy;
  if(miniM.getFullYear()<yMin||(miniM.getFullYear()===yMin&&miniM.getMonth()+1<mMin))
    miniM=new Date(yMin,mMin-1,1);
  renderMiniCal();
}

function toggleComp(iso,max){
  var idx=diasComp.indexOf(iso);
  if(idx>=0)diasComp.splice(idx,1);
  else if(diasComp.length<max)diasComp.push(iso);
  F.diasComp=diasComp.slice();
  renderMiniCal();
}

/* ── Setters ── */
function setLinea(l){
  F.linea=l;
  if(l.indexOf('Internacional')>=0){F.plusIntlAuto=true;}
  else{F.plusIntlAuto=[F.sal,F.lle,F.sal2,F.lle2].filter(Boolean).some(function(e){return ESTACIONES_INTERNACIONALES.has(e);});}
  renderFormBody();
}
function setModo(m){
  // L-03 FIX: avisar antes de perder días de compensación ya seleccionados
  if(F.comp==='dias' && diasComp.length>0 && F.modo && F.modo!==m){
    if(!confirm('¿Cambiar el modo? Se perderán los días de compensación seleccionados.')){
      return;
    }
    diasComp=[]; F.diasComp=[];
  }
  F.modo=m; F.comp=null;
  // Pernocta: NO autocompletar sal2/lle2 — cada tramo es independiente.
  renderFormBody();
}
function setComp(c){F.comp=c;renderFormBody();if(c==='dias')setTimeout(renderMiniCal,50);}
function guardarDescansoSimple(){
  if(!selDay)return;
  TV[selDay.k]={tipo:'descanso'};selDay.t=TV[selDay.k];saveTV();
  closeOv('ov-form');renderCal();toast('🧘 Descanso guardado');
}
function abrirTrabajoEnDescanso(){F.tipo='trabajado';renderFormBody();}
