/* TrenTurnos v5 — Selector de estaciones y teclado numérico de hora
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function openEstSheet(field){
  estField=field;
  var labs={sal:'Estación de Salida',lle:'Estación de Llegada',
              sal2:'Salida Vuelta',lle2:'Llegada Vuelta',
              sal3:'Salida Tramo Intermedio',lle3:'Llegada Tramo Intermedio',base:'Estación Base'};
  var icos={sal:'🚉',lle:'🏁',sal2:'🌙',lle2:'🌙',sal3:'🌙',lle3:'🌙',base:'🏠'};
  var tit=document.getElementById('est-tit');
  // NUEVO — título dinámico para tramos de continuidad, ya que sus
  // claves son generadas (contSal_ida_0...) y no están en 'labs'.
  var contInfo = _contKeyParse(field);
  if(contInfo){
    var lblCont = (contInfo.tipo==='Sal'?'Salida':'Llegada')+' · Tramo '+(contInfo.idx+2);
    tit.innerHTML='<span style="font-size:20px">'+(contInfo.tipo==='Sal'?'🚉':'🏁')+'</span><span>'+lblCont+'</span>';
  } else {
    tit.innerHTML='<span style="font-size:20px">'+(icos[field]||'📍')+'</span>'
      +'<span>'+(labs[field]||'Estación')+'</span>';
  }
  document.getElementById('est-srch-inp').value='';
  renderEstList('');
  openOv('ov-est');
  // NO hacemos focus automático — no queremos que el teclado aparezca
}

function renderEstList(q){
  var lista=document.getElementById('est-list');
  // NUEVO — valor actual también para campos de continuidad (para
  // resaltar la estación ya elegida en ese tramo, si la hay).
  var contInfoCur = _contKeyParse(estField);
  var cur = contInfoCur
    ? _contArrFor(contInfoCur)[contInfoCur.idx][contInfoCur.tipo==='Sal'?'salida':'llegada']
    : (estField==='base'?AJ.base:F[estField]);
  var lin=estField==='base'?null:F.linea;
  var grupos=lin?{}:LINEAS;if(lin)grupos[lin]=LINEAS[lin];
  var h='';
  Object.keys(grupos).forEach(function(l){
    var ests=grupos[l];
    var fil=q?ests.filter(function(e){return e.toLowerCase().indexOf(q.toLowerCase())>=0;}):ests;
    if(!fil.length) return;
    var esI=l.indexOf('Internacional')>=0;
    h+='<div class="est-grp-hdr">'+(esI?'🌍':'🚆')+' '+l+'</div>';
    fil.forEach(function(e){
      var sel=e===cur,esIE=ESTACIONES_INTERNACIONALES.has(e);
      h+='<div class="est-card'+(sel?' sel':'')+(esIE?' intl':'')+'" onclick="selEst(\''+e.replace(/'/g,"\\'")+'\')">'
        +'<div class="est-card-ico">'+(esIE?'🌍':'🚂')+'</div>'
        +'<div class="est-card-info"><div class="est-card-name">'+e+'</div>'+(esIE?'<div class="est-card-badge">+Plus Internacional</div>':'')+'</div>'
        +(sel?'<div class="est-card-check">✓</div>':'')+'</div>';
    });
  });
  // ── MÓDULO OTRA ESTACIÓN ──────────────────────────────────
  if(!q){
    h+='<div class="est-grp-hdr">✏️ Entrada manual</div>'
      +'<div class="est-card" onclick="selEstOtra()">'
      +'<div class="est-card-ico">✏️</div>'
      +'<div class="est-card-info"><div class="est-card-name">Otra estación...</div>'
      +'<div class="est-card-badge" style="color:var(--tx3)">Escribir manualmente</div></div>'
      +'</div>'
      +'<div id="est-manual-wrap" style="display:none;padding:10px 12px;background:var(--s2);border-top:1px solid var(--div)">'
      +'<div style="font-size:9px;font-weight:800;color:var(--tx3);letter-spacing:.5px;margin-bottom:6px">NOMBRE DE LA ESTACIÓN</div>'
      +'<div style="display:flex;gap:8px;align-items:center">'
      +'<input id="est-manual-inp" type="text" placeholder="Escribe el nombre exacto..." autocomplete="off"'
      +' style="flex:1;background:var(--s1);border:1.5px solid var(--acc);border-radius:10px;'
      +'color:var(--tx);font-size:13px;padding:9px 12px;outline:none"'
      +' oninput="previsualizarEstManual(this.value)">'
      +'<button onclick="confirmarEstManual()" style="padding:9px 14px;background:var(--acc);border:none;'
      +'border-radius:10px;color:#fff;font-size:12px;font-weight:800;cursor:pointer">OK</button>'
      +'</div>'
      +'<div id="est-manual-preview" style="font-size:10px;color:var(--tx3);margin-top:5px"></div>'
      +'</div>';
  }
  // ─────────────────────────────────────────────────────────
  lista.innerHTML=h||'<div style="padding:24px;text-align:center;color:var(--tx3)">Sin resultados</div>';
}

/* ── onStationSelected ───────────────────────────────────────
   Lógica central: detecta si la estación es internacional
   y activa esPlusInternacional automáticamente.
   Se aplica tanto en turno nuevo como en edición.
──────────────────────────────────────────────────────────── */
function selEst(e){
  // NUEVO — si el campo es de un tramo de continuidad (clave virtual
  // 'contSal_.../contLle_...'), se guarda en su propio array en vez de
  // en una propiedad plana de F, y se sale ya sin tocar la lógica de
  // encadenamiento de pernocta (que no aplica aquí).
  var contInfo = _contKeyParse(estField);
  if(contInfo){
    var arr = _contArrFor(contInfo);
    arr[contInfo.idx][contInfo.tipo==='Sal' ? 'salida' : 'llegada'] = e;
    closeOv('ov-est');
    renderFormBody();
    return;
  }
  if(estField==='base'){AJ.base=e;var bv=document.getElementById('aj-base-v');bv.textContent=e;bv.className='aj-base-val';closeOv('ov-est');
    // NUEVO — si la matrícula ya estaba puesta ANTES de fijar la
    // Estación Base (orden natural al rellenar el formulario de
    // arriba a abajo), reintenta el autocompletado del nombre ahora
    // que ya se sabe qué sede mirar.
    if(typeof autoRellenarNombrePorMatricula==='function') autoRellenarNombrePorMatricula();
    return;}
  F[estField]=e;
  var hayI=[F.sal,F.lle,F.sal2,F.lle2].filter(Boolean).some(function(x){return ESTACIONES_INTERNACIONALES.has(x);});
  var antI=F.plusIntlAuto;F.plusIntlAuto=hayI;

  // Lógica de encadenamiento de destinos
  // Pernocta 2 días:  Llegada día 1 (lle) → Salida día 2 (sal2), en tiempo real
  // Pernocta 3 días:  Llegada día 1 (lle)  → Salida día 2 (sal3), en tiempo real
  //                   Llegada día 2 (lle3) → Salida día 3 (sal2), en tiempo real
  //                   Llegada día 3 (lle2) → se fija automáticamente a la Base (cierre del ciclo A→B→C→A)
  if(estField==='lle' && (F.modo==='pernocta' || F.modo==='pernocta3') ){
    var destinoSiguiente = F.modo==='pernocta3' ? 'sal3' : 'sal2';
    F[destinoSiguiente]=e;
  } else if(estField==='lle3' && F.modo==='pernocta3'){
    // Pernocta3: NO autocompletar sal2/lle2 — el usuario elige cada campo.
  }

  var el=document.querySelector('[data-f="'+estField+'"]');
  if(el){el.textContent=e;el.className='sf-val';var sfP=el.closest('.sf');if(sfP)sfP.classList.add('fil');
    if(hayI!==antI)actualizarBadgeIntl();
    if(F.tipo==='trabajado'&&F.comp==='dinero')actualizarCalculo();
    // Si se autocompletó algún campo del siguiente tramo, refrescar todo el formulario
    // para que el usuario vea el campo ya relleno (en vez de quedar visualmente vacío).
    if(estField==='lle' || estField==='lle3') renderFormBody();
  }else renderFormBody();
  closeOv('ov-est');
}

// Muestra/oculta el badge de Plus Internacional en el formulario
function actualizarBadgeIntl(){
  // Buscar si ya existe el badge
  var badge = document.getElementById('badge-plus-intl');
  if(F.plusIntlAuto){
    if(!badge){
      // Insertar justo antes del primer secTramo
      var formBody = document.getElementById('form-body');
      var primerTramo = formBody ? formBody.querySelector('.fsec[style*="border-top"]') : null;
      var div = document.createElement('div');
      div.id = 'badge-plus-intl';
      div.className = 'plus-intl-badge';
      div.innerHTML = '🌍 <span><strong>Plus Internacional</strong> activado automáticamente</span>';
      if(primerTramo) primerTramo.insertAdjacentElement('beforebegin', div);
      else if(formBody) formBody.appendChild(div);
    }
  } else {
    if(badge) badge.remove();
  }
}

/* ═══════════════════════════════════════
   HORA — TECLADO NUMÉRICO TÁCTIL
   Sin ruedas, sin scroll, sin bugs Android.
   Estado: TP.field, TP.H, TP.M, TP.foco ('h'|'m'), TP.buf
═══════════════════════════════════════ */
function openHora(field){
  TP.field = field;
  // NUEVO — leer el valor actual también para campos de continuidad
  // (guardados en su propio array, no como propiedad plana de F).
  var contInfo = _contKeyParse(field);
  var ex = contInfo
    ? _contArrFor(contInfo)[contInfo.idx][contInfo.tipo==='HF' ? 'horaInicio' : 'horaFin']
    : F[field];
  if(ex && ex.includes(':')){
    var p = ex.split(':');
    TP.H = p[0]; TP.M = p[1];
  } else {
    TP.H = '08'; TP.M = '00';
  }
  // Empezar editando horas
  TP.foco = 'h';
  TP.buf  = '';

  // Label
  var labs = {hF:'⏱ Firma — ida', hL:'🔚 Llegada — ida',
                hF2:'🌙 Firma — vuelta', hL2:'🔚 Llegada — vuelta'};
  if(contInfo){
    document.getElementById('hora-tit').textContent =
      (contInfo.tipo==='HF'?'⏱ Firma':'🔚 Llegada')+' · Tramo '+(contInfo.idx+2);
  } else {
    document.getElementById('hora-tit').textContent = labs[field] || '⏱ Hora';
  }

  horaRefresh();
  openOv('ov-hora');
}

// Actualiza el display y el resaltado
function horaRefresh(){
  var dh = document.getElementById('hd-h');
  var dm = document.getElementById('hd-m');
  var lbl= document.getElementById('hora-cursor-lbl');
  if(!dh||!dm) return;

  dh.textContent = TP.buf && TP.foco==='h' ? TP.buf.padStart(2,'0') : TP.H;
  dm.textContent = TP.buf && TP.foco==='m' ? TP.buf.padStart(2,'0') : TP.M;

  dh.className = 'hora-seg' + (TP.foco==='h' ? ' activo' : '');
  dm.className = 'hora-seg' + (TP.foco==='m' ? ' activo' : '');

  lbl.textContent = TP.foco==='h' ? 'Editando horas' : 'Editando minutos';
}

// Cambiar foco con toque en el segmento
function horaFocus(f){
  TP.foco = f;
  TP.buf  = '';
  horaRefresh();
}

// Tecla numérica — lógica limpia y sin bugs
function hpNum(n){
  TP.buf += String(n);

  if(TP.foco === 'h'){
    var v = parseInt(TP.buf);
    if(TP.buf.length === 1){
      if(v >= 3){
        // 3–9 como primer dígito de hora: solo puede ser 3–9 sin segundo → confirmar ya
        TP.H   = pad(Math.min(v, 23));
        TP.buf = '';
        TP.foco= 'm';
      }
      // 0,1,2 → esperamos el segundo dígito
    } else {
      // Segundo dígito de hora
      TP.H   = pad(v >= 0 && v <= 23 ? v : Math.min(parseInt(String(n)), 9));
      TP.buf = '';
      TP.foco= 'm';
    }
  } else {
    // Minutos
    var v = parseInt(TP.buf);
    if(TP.buf.length === 1){
      if(v >= 6){
        // 6–9 como primer dígito: no puede haber decena válida (60+ > 59)
        // Lo guardamos directamente como 06–09
        TP.M   = pad(v);
        TP.buf = '';
        // No pasamos el foco — el usuario puede seguir editando minutos
      }
      // 0–5 → esperamos el segundo dígito
    } else {
      // Segundo dígito de minutos
      TP.M   = pad(v >= 0 && v <= 59 ? v : Math.min(v, 59));
      TP.buf = '';
    }
  }
  horaRefresh();
}

// Cambiar entre horas y minutos
function hpTab(){
  TP.foco = TP.foco==='h' ? 'm' : 'h';
  TP.buf  = '';
  horaRefresh();
}

// Borrar último dígito del buffer
function hpBorrar(){
  if(TP.buf.length > 0){
    TP.buf = TP.buf.slice(0, -1);
  } else {
    // Sin buffer: limpiar el campo actual
    if(TP.foco==='h') TP.H='00'; else TP.M='00';
  }
  horaRefresh();
}

// Confirmar — guarda en F y actualiza UI
function confHora(){
  // Aplicar cualquier buffer pendiente
  if(TP.buf){
    var v = parseInt(TP.buf);
    if(TP.foco==='h') TP.H = pad(Math.min(v,23));
    else              TP.M = pad(Math.min(v,59));
    TP.buf = '';
  }

  var hora = TP.H + ':' + TP.M;

  // NUEVO — si es un tramo de continuidad, se guarda en su propio
  // array (no como propiedad plana de F) y se refresca el formulario
  // entero para que se recalcule la escala informativa a partir de
  // esta nueva hora — el resto de la función (badges de duración,
  // etc.) es específico del tramo principal y no aplica aquí.
  var contInfo = _contKeyParse(TP.field);
  if(contInfo){
    var arr = _contArrFor(contInfo);
    arr[contInfo.idx][contInfo.tipo==='HF' ? 'horaInicio' : 'horaFin'] = hora;
    closeOv('ov-hora');
    renderFormBody();
    return;
  }

  F[TP.field] = hora;
  closeOv('ov-hora');

  // Actualizar elemento visual in-place
  var elVal = document.querySelector('[data-hora="'+TP.field+'"]');
  if(elVal){
    elVal.textContent = hora;
    elVal.className   = 'sf-val hv';
    var sfParent = elVal.closest('.sf');
    if(sfParent) sfParent.classList.add('fil');
    // Badge duración
    var esV  = TP.field==='hF2'||TP.field==='hL2';
    var hFk  = esV?'hF2':'hF', hLk = esV?'hL2':'hL';
    var badge= document.getElementById('dur-'+(esV?'v':'i'));
    if(badge && F[hFk] && F[hLk]){
      badge.textContent  = '⏱ '+calcDur(F[hFk],F[hLk]);
      badge.style.display= 'inline-flex';
    }
    if(F.tipo==='trabajado' && F.comp==='dinero') actualizarCalculo();
  } else {
    // Fallback: elemento no encontrado en DOM (cambio de modo, etc.) → reconstruir
    renderFormBody();
  }
}

function actualizarCalculo(){
  var cont=document.getElementById('calc-result-cont');
  if(!cont)return;
  var vh=parseFloat(AJ.vh)||12.5;
  var noc=parseFloat(AJ.nocturnidad)||0;
  var p=AJ.pluses[AJ.rol]||PLUS_DEF[AJ.rol];
  var hayNoc=F.hF?esHoraNocturna(F.hF)||(F.hL?esHoraNocturna(F.hL):false):false;
  var tasa=vh+(hayNoc?noc:0);
  var hIda=F.hF&&F.hL?Math.round(calcMins(F.hF,F.hL)/60*100)/100:0;
  var hVuelta=F.hF2&&F.hL2?Math.round(calcMins(F.hF2,F.hL2)/60*100)/100:0;
  var hT=Math.round((hIda+hVuelta)*100)/100;
  var pAct=F.plusAct     ? parseFloat(p.activacion||0)   : 0;
  var pJT =F.plusJT      ? parseFloat(p.jt||0)           : 0;
  var pIntl=F.plusIntlAuto? parseFloat(p.internacional||0): 0;
  var imp=Math.round((hT*tasa+pAct+pJT+pIntl)*100)/100;
  if(hT>0){
    cont.innerHTML='<div class="cr-row"><span class="cr-l">Horas ida</span><span class="cr-v">'+hIda+' h</span></div>'
      +(hVuelta>0?'<div class="cr-row"><span class="cr-l">Horas vuelta</span><span class="cr-v">'+hVuelta+' h</span></div>':'')
      +'<div class="cr-row"><span class="cr-l">Total horas</span><span class="cr-v"><strong>'+hT+' h</strong></span></div>'
      +'<div class="cr-row"><span class="cr-l">Tarifa</span><span class="cr-v">'+tasa.toFixed(2)+' €/h</span></div>'
      +(pAct>0?'<div class="cr-row"><span class="cr-l">Plus Activación</span><span class="cr-v">+'+pAct.toFixed(2)+' €</span></div>':'')
      +(pJT>0?'<div class="cr-row"><span class="cr-l">Plus JT</span><span class="cr-v">+'+pJT.toFixed(2)+' €</span></div>':'')
      +(pIntl>0?'<div class="cr-row"><span class="cr-l">Plus Intl.</span><span class="cr-v">+'+pIntl.toFixed(2)+' €</span></div>':'')
      +'<div class="cr-div"></div>'
      +'<div class="cr-total"><span class="cr-tl">Total</span><span class="cr-tv">'+imp.toFixed(2)+' €</span></div>';
  } else {
    cont.innerHTML='<div style="font-size:10px;color:var(--tx3)">⚠️ Completa los tramos para ver el cálculo</div>';
  }
}
