/* TrenTurnos v5 — Copiar un turno a otro día
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
// Suma/resta N días a una clave "YYYY-MM-DD".
function _sumarDiasKey(k, n){
  var p = k.split('-').map(Number);
  var dt = new Date(p[0], p[1]-1, p[2]+n);
  return key(dt.getFullYear(), dt.getMonth()+1, dt.getDate());
}

function abrirCopiarTurno(k){
  var kOrigen = k || (selDay && selDay.k);
  if(!kOrigen || !TV[kOrigen]) return;
  var t = TV[kOrigen];
  // Si estás viendo el día derivado de una pernocta (vuelta o
  // intermedio), la copia se hace siempre desde el día de ORIGEN,
  // para poder copiar la pernocta completa igual que se guardó.
  var esDerivado = (t.tipo==='vuelta-pernocta' || t.tipo==='pernocta3-intermedio');
  var kReal = esDerivado ? t.origenPernocta : kOrigen;
  var tReal = esDerivado ? TV[kReal] : t;
  if(!tReal){ toast('⚠️ No se encontró el turno de origen de la pernocta'); return; }
  var dias = (tReal.modo==='pernocta3') ? 3 : (tReal.modo==='pernocta') ? 2 : 1;
  _copiarOrigen = {k:kReal, t:tReal, dias:dias};

  var kp = kReal.split('-').map(Number);
  var etiquetaDias = dias===1 ? (kp[2]+' '+MESES_C[kp[1]-1]) :
    (kp[2]+'-'+parseInt(_sumarDiasKey(kReal,dias-1).split('-')[2],10)+' '+MESES_C[kp[1]-1]);
  document.getElementById('cop-origen-lbl').textContent = 'Origen: '+etiquetaDias;
  var avisoEl = document.getElementById('cop-pernocta-aviso');
  if(dias>1){
    avisoEl.style.display='block';
    avisoEl.textContent = '🌙 Es una '+(dias===3?'pernocta de 3 días':'pernocta')+' — se copiarán juntos el día que elijas'+(dias===3?' + los 2 siguientes.':' + el siguiente.');
  } else {
    avisoEl.style.display='none';
  }

  _copiarMesCal = new Date(kp[0], kp[1]-1, 1);
  _copiarDestino = null;
  _renderCopiarCal();
  openOvTop('ov-copiar-cal');
}

function _copiarCalMesNav(delta){
  _copiarMesCal = new Date(_copiarMesCal.getFullYear(), _copiarMesCal.getMonth()+delta, 1);
  _renderCopiarCal();
}

function _renderCopiarCal(){
  var y=_copiarMesCal.getFullYear(), m=_copiarMesCal.getMonth();
  document.getElementById('cop-cal-mes').textContent =
    MESES[m].charAt(0).toUpperCase()+MESES[m].slice(1)+' '+y;
  var ultimo = new Date(y,m+1,0).getDate();
  var sd = new Date(y,m,1).getDay(); sd = sd===0?6:sd-1;
  var dias = _copiarOrigen ? _copiarOrigen.dias : 1;
  var html = ['L','M','X','J','V','S','D'].map(function(l){
    return '<div style="text-align:center;font-size:10px;color:var(--tx3);padding:4px 0">'+l+'</div>';
  }).join('');
  for(var i=0;i<sd;i++) html+='<div></div>';
  for(var d=1; d<=ultimo; d++){
    var kD = key(y,m+1,d);
    // Si es pernocta, los días que ocuparía (kD..kD+dias-1) que ya
    // tienen algo se marcan en ámbar para avisar de un vistazo, sin
    // bloquear la selección (el conflicto real se resuelve después).
    var ocupado = false;
    for(var j=0;j<dias;j++){ if(TV[_sumarDiasKey(kD,j)]) ocupado=true; }
    var esOrigen = (_copiarOrigen && kD>=_copiarOrigen.k && kD<_sumarDiasKey(_copiarOrigen.k,dias));
    var estilo = esOrigen
      ? 'background:var(--s2);color:var(--tx3);opacity:.4'
      : (ocupado ? 'background:rgba(249,115,22,.15);border:1px solid rgba(249,115,22,.4);color:#fdba74' : 'background:var(--s2);color:var(--tx2)');
    html += '<div onclick="'+(esOrigen?'':'_seleccionarDestinoCopiar('+y+','+(m+1)+','+d+')')+'" '
      + 'style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:12px;'+estilo+(esOrigen?'':';cursor:pointer')+'">'+d+'</div>';
  }
  document.getElementById('cop-cal-grid').innerHTML = html;
}

function _seleccionarDestinoCopiar(y,m,d){
  _copiarDestino = {y:y,m:m,d:d};
  closeOv('ov-copiar-cal');
  var origen = _copiarOrigen.t;
  var puedeElegirTipo = (origen.tipo==='ordinario'||origen.tipo==='trabajado'||origen.tipo==='art5152');
  if(puedeElegirTipo){
    var kDestino = key(y,m,d);
    document.getElementById('cop-tipo-destino-lbl').textContent = 'Destino: '+d+' '+MESES_C[m-1];
    openOvTop('ov-copiar-tipo');
  } else {
    // Días sin tipo que elegir (ej. descanso): se copian tal cual.
    _elegirTipoCopia(null);
  }
}

function _elegirTipoCopia(tipoElegido){
  closeOv('ov-copiar-tipo');
  _copiarTipoPendiente = tipoElegido;
  if(tipoElegido==='art5152' || tipoElegido==='htdl'){
    // NUEVO — Art.51/52 y HTDL necesitan saber cómo se compensa
    // (dinero/días/mix) antes de poder guardar nada — sin esto el
    // motor de dinero no tiene datos suficientes.
    document.getElementById('cop-comp-sub').textContent =
      (tipoElegido==='htdl'?'HTDL':'Art. 51/52')+' — cómo se compensa esta copia';
    // FIX — "Mixto" solo existe para pernoctas (confirmado por
    // Alex): el tramo con más horas va a dinero y el de menos a
    // día libre — eso no tiene sentido en un ida-vuelta de un solo
    // día, y el propio motor de dinero no lo calcula si no hay
    // modo pernocta. El formulario real ya oculta "Mix" en ese
    // caso (F.modo!=='pernocta'); aquí se hace lo mismo para no
    // dejar elegir una opción que luego no calcularía nada.
    var esPernocta = _copiarOrigen && _copiarOrigen.dias>1;
    document.getElementById('cop-comp-mix-btn').style.display = esPernocta ? '' : 'none';
    openOvTop('ov-copiar-comp');
    return;
  }
  _procesarCopiaConModo(tipoElegido, null);
}

function _elegirCompCopia(modoComp){
  closeOv('ov-copiar-comp');
  if(modoComp==='mix' && !(_copiarOrigen && _copiarOrigen.dias>1)){
    toast('⚠️ Mixto solo existe para pernoctas');
    return;
  }
  if(modoComp==='dinero'){
    _procesarCopiaConModo(_copiarTipoPendiente, 'dinero');
  } else {
    // "Días" y "Mixto" implican elegir día(s) concretos del mes
    // siguiente — en vez de reconstruir ese selector aparte, se
    // reutiliza el formulario real de creación de turno, ya
    // preparado para esto (mismo mini-calendario de compensación
    // que usas al crearlo a mano).
    _abrirFormParaCopiaDiasMixto(_copiarTipoPendiente, modoComp);
  }
}

function _procesarCopiaConModo(tipoElegido, modoComp){
  var res = _construirEscrituraCopia(_copiarOrigen, _copiarDestino, tipoElegido, modoComp);
  if(!res){ toast('⚠️ No se pudo preparar la copia'); return; }
  window._copiaConflictoPendiente = res;
  // NUEVO — regla confirmada por Alex, evaluada día por día (no todo
  // el bloque a la vez): si el día ya tenía DESCANSO, se sobrescribe
  // sin más (no hay nada que perder). Si ya tenía un turno REAL, ese
  // turno no se borra — pasa a SECUNDARIO (turno extra) y sus horas
  // siguen contando igual que ahora; la copia entra como principal.
  var hayAlgo = res.escrituras.some(function(esc){ return !!TV[esc.k]; });
  if(!hayAlgo){
    _escribirCopiaTurno(res);
  } else {
    var resumen = res.escrituras.map(function(esc){
      var existente = TV[esc.k];
      if(!existente) return '· '+esc.k+': vacío → se rellena';
      if(existente.tipo==='descanso') return '· '+esc.k+': tenía descanso → se sobrescribe';
      return '· '+esc.k+': tenía un turno guardado → pasa a secundario (sus horas se siguen contando)';
    });
    document.getElementById('cop-conflicto-dias').innerHTML = resumen.join('<br>');
    openOvTop('ov-copiar-conflicto');
  }
}

// NUEVO — Para "Días"/"Mixto": abre el formulario REAL de la app
// (el mismo que usas al crear un turno a mano), pre-rellenado con
// todo lo del turno de origen, apuntando ya al día destino elegido.
// Así el mini-calendario de días de compensación, el cálculo de
// Mix y el guardado final son exactamente los que ya tienes
// probados — no se duplica esa lógica aquí.
function _abrirFormParaCopiaDiasMixto(tipoElegido, modoComp){
  closeOv('ov-copiar-cal'); closeOv('ov-copiar-tipo'); closeOv('ov-copiar-comp'); closeOv('ov-copiar-conflicto');
  var o = _copiarOrigen.t;
  var destino = _copiarDestino;
  var kDestino = key(destino.y, destino.m, destino.d);
  var yaExistia = !!TV[kDestino];

  var tipoFinal = (tipoElegido==='htdl') ? 'trabajado' : 'art5152';
  var kIntOrigen = o.diaIntermedio;
  var tIntOrigen = kIntOrigen ? TV[kIntOrigen] : null;

  F={tipo:tipoFinal, linea:o.linea||null,
     sal:o.sal||(AJ.base||null), lle:o.lle||null, hF:o.hF||null, hL:o.hL||null,
     sal2:o.sal2||null, lle2:o.lle2||null, hF2:o.hF2||null, hL2:o.hL2||null,
     sal3:(tIntOrigen&&tIntOrigen.sal)||null, lle3:(tIntOrigen&&tIntOrigen.lle)||null,
     hF3:(tIntOrigen&&tIntOrigen.hF)||null, hL3:(tIntOrigen&&tIntOrigen.hL)||null,
     modo:o.modo||null,
     comp:(tipoFinal==='trabajado')?modoComp:null,
     compArt5152:(tipoFinal==='art5152')?modoComp:null,
     horas:o.horas||0, diasComp:[], notas:o.notas||'',
     numTren:o.numTren||'', numTrenVuelta:o.numTrenVuelta||'',
     numTrenIntermedio:o.numTrenIntermedio||'',
     estadoServicio:o.estadoServicio||'ordinario',
     estadoServicioDetalle:o.estadoServicioDetalle||'',
     estadoServicioVuelta:o.estadoServicioVuelta||'ordinario',
     estadoServicioVueltaDetalle:o.estadoServicioVueltaDetalle||'',
     dhMismoTren:(typeof o.dhMismoTren==='boolean')?o.dhMismoTren:null,
     dhMinutos:(o.dhMinutos!=null)?o.dhMinutos:null,
     dhMismoTrenVuelta:(typeof o.dhMismoTrenVuelta==='boolean')?o.dhMismoTrenVuelta:null,
     dhMinutosVuelta:(o.dhMinutosVuelta!=null)?o.dhMinutosVuelta:null,
     continuidad:(o.continuidad||[]).map(function(c){var cc={};for(var kk in c)cc[kk]=c[kk];return cc;}),
     continuidadVuelta:(o.continuidadVuelta||[]).map(function(c){var cc={};for(var kk in c)cc[kk]=c[kk];return cc;}),
     plusAct:o.plusAct||false, plusJT:o.plusJT||false,
     modoArt5152:o.modoArt5152||'normal',
     modoTrabajado:'normal',
     plusIntlAuto:(o.linea||'').includes('Internacional')};

  selDay = {d:destino.d, k:kDestino, t:TV[kDestino]||null};
  curM = new Date(destino.y, destino.m-1, 1);
  renderCal();
  abrirForm(yaExistia);
  toast(yaExistia
    ? '⚠️ '+kDestino+' ya tenía algo — revisa antes de guardar'
    : '📋 Copiado — elige el/los día(s) de compensación y guarda');
}

function _resolverConflictoCopia(accion){
  closeOv('ov-copiar-conflicto');
  var res = window._copiaConflictoPendiente;
  if(!res) return;
  if(accion==='confirmar') _escribirCopiaTurno(res);
  else toast('Copia cancelada');
}

// Construye las escrituras (sin aplicar todavía) para copiar el
// turno de origen al día destino elegido — mismo patrón que la
// carga del PDF: 1 día suelto, pernocta (2) o pernocta3 (3).
// modoComp ('dinero'|'dias'|'mix') solo se usa cuando tipoElegido es
// 'art5152' o 'htdl' — para 'dias'/'mix' esta función ya no se llama
// (se enruta al formulario real, ver _abrirFormParaCopiaDiasMixto).
// Calcula las "horas computables" para dinero — misma fórmula que
// usa guardarTurno() para HTDL (d.importe) y Art.51/52
// (d.horasEfectivas): en pernocta solo cuenta el trabajo real (ida +
// continuidad ida + continuidad vuelta + vuelta); en ida-vuelta del
// mismo día también entra la escala/hueco entre tramos.
function _horasComputablesParaDinero(d, esPernocta){
  // FIX — Confirmado por Alex: las esperas/escalas entre trenes
  // conectados también deben pagarse en pernocta, no solo en día
  // suelto — mismo criterio ya corregido en guardarTurno() para
  // mantener el cálculo idéntico se cree el turno a mano, se copie,
  // o se cambie de tipo. Sigue sin pagar el hueco propio de la
  // pernocta (descanso nocturno entre ida y vuelta) — ese guard no
  // cambia.
  var hIda = (d.hF&&d.hL) ? calcMins(d.hF,d.hL)/60 : 0;
  var hVuelta = (d.hF2&&d.hL2) ? calcMins(d.hF2,d.hL2)/60 : 0;
  var minEscala=0, minContinuidad=0, finIdaReal=d.hL;
  (d.continuidad||[]).forEach(function(c){
    if(c.horaInicio&&c.horaFin) minContinuidad += calcMins(c.horaInicio,c.horaFin);
    if(c.escalaMin!=null && c.escalaMin>0) minEscala += c.escalaMin;
    if(c.horaFin) finIdaReal = c.horaFin;
  });
  if(!esPernocta && finIdaReal && d.hF2){
    var hueco = calcMins(finIdaReal, d.hF2);
    if(hueco>0) minEscala += hueco;
  }
  var minContinuidadVuelta=0;
  (d.continuidadVuelta||[]).forEach(function(c){
    if(c.horaInicio&&c.horaFin) minContinuidadVuelta += calcMins(c.horaInicio,c.horaFin);
    if(c.escalaMin!=null && c.escalaMin>0) minEscala += c.escalaMin;
  });
  var hEscala = Math.round(minEscala/60*100)/100;
  var hContinuidad = Math.round(minContinuidad/60*100)/100;
  var hContinuidadVuelta = Math.round(minContinuidadVuelta/60*100)/100;
  // NUEVO — mismo criterio confirmado por Alex: si hay enlace de
  // jornada (descanso real por debajo del mínimo legal: 12h en base,
  // 8h fuera), la dormida entera pasa a contar. finIdaReal ya tiene
  // en cuenta el último tramo de continuidad de la ida, si lo hay.
  var hEnlaceJornada = 0;
  if(esPernocta && finIdaReal && d.hF2){
    var dM=(1440-calcMins('00:00',finIdaReal))+calcMins('00:00',d.hF2); if(dM<0)dM+=1440;
    var estDescanso = d.sal2||d.lle||'';
    var lim = (AJ.base && estDescanso===AJ.base) ? 720 : 480;
    if(dM < lim) hEnlaceJornada = Math.round(dM/60*100)/100;
  }
  if(esPernocta) return Math.round(((d.horas||0)+hEscala+hContinuidad+hContinuidadVuelta+hEnlaceJornada)*100)/100;
  return Math.round((hIda+hEscala+hContinuidad+hVuelta+hContinuidadVuelta)*100)/100;
}

// Aplica el modo de compensación 'dinero' a un registro ya construido
// (d), calculando importe/horasEfectivas EXACTAMENTE igual que hace
// guardarTurno() — antes esto se dejaba en blanco y el dinero no
// aparecía en Stats hasta entrar a editar el turno a mano.
function _aplicarDineroCopia(d, esHTDL, esArt5152, esPernocta){
  var horasComp = _horasComputablesParaDinero(d, esPernocta);
  if(esHTDL){
    d.comp = 'dinero';
    var hFparaTasa = esPernocta ? d.hF : d.hF2;
    var hLparaTasa = esPernocta ? d.hL : d.hL2;
    d.importe = calcImp(horasComp, hFparaTasa, hLparaTasa, d.linea, d.plusAct, d.plusJT, d.plusIntlAuto);
  } else if(esArt5152){
    d.compensacion = 'dinero';
    d.horasEfectivas = horasComp;
  }
}

function _construirEscrituraCopia(origen, destino, tipoElegido, modoComp){
  var o = origen.t;
  var kDestino = key(destino.y, destino.m, destino.d);
  var esHTDL = (tipoElegido==='htdl');
  var esArt5152 = (tipoElegido==='art5152');
  var tipoFinal = esHTDL ? 'trabajado' : (tipoElegido || o.tipo);
  var esPernocta = origen.dias>1;

  function clonar(obj){ return obj ? JSON.parse(JSON.stringify(obj)) : obj; }

  if(origen.dias===1){
    var d1 = clonar(o);
    d1.tipo = tipoFinal;
    delete d1.cargadoDesdePdf;
    // FIX — HTDL y Art.51/52 ahora se tratan EXACTAMENTE igual que
    // Ordinario a nivel de estructura (misma celda/celdas), la única
    // diferencia real es el tipo y cómo se compensa el dinero.
    if(modoComp==='dinero') _aplicarDineroCopia(d1, esHTDL, esArt5152, false);
    return {escrituras:[{k:kDestino, data:d1}], incompletos:[]};
  }

  // Pernocta (2) o pernocta3 (3): reconstruir cada día a partir de lo
  // que ya está guardado — el principal (o) trae ida y vuelta/resumen;
  // los derivados (vuelta-pernocta / intermedio) se leen de TV.
  var kVtaOrigen = o.diaSiguiente;
  var kIntOrigen = o.diaIntermedio;
  var tVtaOrigen = kVtaOrigen ? TV[kVtaOrigen] : null;
  var tIntOrigen = kIntOrigen ? TV[kIntOrigen] : null;
  if(!tVtaOrigen){ return null; }

  var kIdaD = kDestino;
  var kIntD = origen.dias===3 ? _sumarDiasKey(kDestino,1) : null;
  var kVtaD = _sumarDiasKey(kDestino, origen.dias-1);

  var principal = clonar(o);
  principal.tipo = tipoFinal;
  principal.diaSiguiente = kVtaD;
  if(origen.dias===3) principal.diaIntermedio = kIntD;
  delete principal.cargadoDesdePdf;
  if(modoComp==='dinero') _aplicarDineroCopia(principal, esHTDL, esArt5152, true);

  var escrituras = [{k:kIdaD, data:principal}];
  if(origen.dias===3 && tIntOrigen){
    var intD = clonar(tIntOrigen);
    intD.origenPernocta = kIdaD;
    delete intD.cargadoDesdePdf;
    escrituras.push({k:kIntD, data:intD});
  }
  var vtaD = clonar(tVtaOrigen);
  vtaD.origenPernocta = kIdaD;
  delete vtaD.cargadoDesdePdf;
  escrituras.push({k:kVtaD, data:vtaD});

  return {escrituras:escrituras, incompletos:[]};
}

function _escribirCopiaTurno(res){
  res.escrituras.forEach(function(esc){
    var existente = TV[esc.k];
    // NUEVO — regla confirmada por Alex: si ya había un turno REAL
    // (no descanso), no se pierde — pasa a SECUNDARIO (turno extra),
    // conservando todos sus datos tal cual, así que sus horas y su
    // dinero se siguen contando exactamente igual que antes. Solo
    // deja de ser el turno "oficial" del día — la copia pasa a serlo.
    if(existente && existente.tipo!=='descanso'){
      if(!TV2[esc.k]) TV2[esc.k]=[];
      var ddViejo={}; for(var campoV in existente) ddViejo[campoV]=existente[campoV];
      // NUEVO — marca de "era el principal de este día antes de la
      // copia" — se usa SOLO para que el contador "TOTAL DEL DÍA" no
      // lo sume junto al turno nuevo (así Alex puede ver de un
      // vistazo solo las horas del turno que acaba de agregar). NO
      // afecta a Stats del mes — ahí sus horas siguen contando igual
      // que siempre, sin este filtro.
      ddViejo.esAntiguoPrincipal = true;
      // NUEVO — Confirmado por Alex: sus horas se quedan GRABADAS en
      // este mismo momento, calculadas mientras el dato todavía es
      // 100% fiable (justo antes de pisarlo), en vez de fiarse de que
      // el cálculo mensual lo vuelva a procesar bien más adelante.
      // calcularJornadaDiaria() usa este valor directamente si existe
      // (ver el FIX correspondiente ahí), así que estas horas quedan
      // garantizadas pase lo que pase después.
      try{
        ddViejo._horasGarantizadas = calcularJornadaDiaria([existente], esc.k);
      }catch(errGarantia){ /* si falla, calcularJornadaDiaria() recalcula como siempre */ }
      TV2[esc.k].push(ddViejo);
    }
    // Limpieza de enlaces de pernocta huérfanos si el día pisado
    // apuntaba a otro día distinto del nuevo (evita dejar un
    // "vuelta-pernocta" colgando sin turno de origen real).
    if(existente && existente.diaSiguiente && existente.diaSiguiente!==esc.data.diaSiguiente){
      if(TV[existente.diaSiguiente] && TV[existente.diaSiguiente].origenPernocta===esc.k) delete TV[existente.diaSiguiente];
    }
    TV[esc.k] = esc.data;
  });
  saveTV(); saveTV2();
  renderCal(); renderStats();
  if(selDay) renderDiaArea();
  toast('✅ Turno copiado a '+res.escrituras[0].k);
}

function guardarRetraso(){
  if(!selDay||!selDay.t) return;
  var inp=document.getElementById('inp-retraso');
  if(!inp) return;
  var min=Math.max(0,parseInt(inp.value)||0);
  var wrap=document.getElementById('retraso-panel');
  var tramEl=document.getElementById('sel-tramo-ret');
  var trenEl=document.getElementById('inp-tren-ret');
  var tramo = tramEl
    ? (parseInt(tramEl.value)||1)
    : (wrap&&wrap.dataset.tramoFijo ? parseInt(wrap.dataset.tramoFijo)||1 : 1);
  var tren=trenEl?(trenEl.value.trim()||''):'';
  // NUEVO — para tramos de continuidad (3, 4...) hace falta saber
  // cuántos minutos tenía YA aplicados este tramo, para desplazar
  // solo la DIFERENCIA (si editas un retraso de 10min a 15min, el
  // tramo solo se alarga 5min más, no 15 de golpe).
  var minAntes = 0;
  if(tramo>=3 && TV[selDay.k].retrasos){
    var rAntes = TV[selDay.k].retrasos.filter(function(r){return r.tramo===tramo;})[0];
    minAntes = rAntes ? (rAntes.minutos||0) : 0;
  }
  TV[selDay.k].retrasoMin=min>0?min:undefined;
  if(!TV[selDay.k].retrasos) TV[selDay.k].retrasos=[];
  TV[selDay.k].retrasos=TV[selDay.k].retrasos.filter(function(r){return r.tramo!==tramo;});
  if(min>0) TV[selDay.k].retrasos.push({tramo:tramo,minutos:min,tren:tren});
  if(TV[selDay.k].retrasos.length===0) delete TV[selDay.k].retrasos;
  // NUEVO — desplazar en cadena las horas del tramo de continuidad
  // afectado (y de todo lo que venga después: siguientes tramos +
  // vuelta), tal como confirmaste: el retraso alarga ese tramo y
  // empuja lo que sigue, sin tocar el motor de dinero — las horas ya
  // desplazadas se cuentan solas como Efectiva o Presencia según el
  // tipo de cada tramo (igual que si las hubieras escrito a mano).
  if(tramo>=3){
    var deltaMin = min - minAntes;
    if(deltaMin!==0) _desplazarContinuidadPorRetraso(TV[selDay.k], tramo-3, deltaMin);
  }
  selDay.t=TV[selDay.k];
  saveTV();
  ALERTAS_DESCANSO=verificarDescansosMes();
  renderCal();
  renderDiaArea();
  if(min>0) toast('Retraso '+min+'min - Tren '+(tren||'?')+' Tramo '+tramo);
  else toast('Retraso eliminado');
}
