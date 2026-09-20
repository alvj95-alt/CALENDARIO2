/* TrenTurnos v5 — Artículos 51/52, compensación Mix y correo asociado
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   NUEVO — MÓDULO ARTÍCULO 51 y 52 (100% aditivo)
   No modifica: TV existente (usa su propio tipo 'art5152'),
   AJ existente (solo añade art5152Monto/art5152ValorBase),
   guardarTurno() (usa su propio flujo de guardado independiente),
   renderStats() ni loadAjUI() (se enganchan mediante wrappers
   definidos MÁS ABAJO, después de sus declaraciones originales,
   sin tocar ni una línea de su código fuente).
   Persistencia: TV[k] vía saveTV() ya existente; ART5152_DIAS y
   ART5152_USO vía sus propias claves de localStorage.
═══════════════════════════════════════════════════════════ */

function _art5152MesSiguiente(k){
  var p = k.split('-').map(Number);
  var d = new Date(p[0], p[1]-1, p[2]);
  d.setMonth(d.getMonth()+1);
  return d.getFullYear()+'-'+pad(d.getMonth()+1);
}

function _diaSiguienteKey(k){
  var p=k.split('-').map(Number);
  var dt=new Date(p[0],p[1]-1,p[2]);
  dt.setDate(dt.getDate()+1);
  return key(dt.getFullYear(), dt.getMonth()+1, dt.getDate());
}

// ── Entrada desde el menú "Artículo 51 y 52" ──
// REESCRITO: en vez de abrir un modal propio, reutiliza EXACTAMENTE
// el mismo formulario nativo que usa Ordinario/Trabajado (HTDL),
// llamando a elegirTipo() sin modificarla en absoluto — 'art5152'
// no está en su lista de "tipos simples", así que ya cae de forma
// natural en la rama resetF(tipo)+abrirForm(false).
function elegirArt5152(){
  if(!selDay){ toast('Selecciona un día primero'); return; }
  elegirTipo('art5152');
}

// NUEVO — Selector previo Reserva/Jornada Normal para Art.51/52.
function abrirModalModoArt5152(){
  if(!selDay) return;
  openOv('ov-modo-art5152');
}

function elegirModoArt5152(modo){
  closeOv('ov-modo-art5152');
  resetF('art5152');
  // F.modoArt5152: 'reserva' | 'normal'. resetF() ya se ejecutó, así
  // que este campo se añade DESPUÉS para que no se pierda.
  F.modoArt5152 = modo;
  abrirForm(false);
}

// NUEVO — Reserva Normal (no Art.51/52): pop-up obligatorio de
// toma/deje. Si no se pincha después, computa como Presencia
// (ver calcularJornadaDiaria, rama t.tipo==='reserva'); si se pincha
// (verificarReserva(), ya existente y sin tocar), pasa a Efectivas.
function abrirModalTomaDejeReserva(){
  if(!selDay) return;
  var tomaInput = document.getElementById('reserva-toma-input');
  var dejeInput = document.getElementById('reserva-deje-input');
  var existente = TV[selDay.k];
  if(tomaInput) tomaInput.value = (existente&&existente.reservaHoraToma)||'';
  if(dejeInput) dejeInput.value = (existente&&existente.reservaHoraLlegada)||'';
  openOv('ov-toma-deje-reserva');
}

function confirmarTomaDejeReserva(){
  if(!selDay) return;
  var toma = (document.getElementById('reserva-toma-input')||{}).value;
  var deje = (document.getElementById('reserva-deje-input')||{}).value;
  if(!toma || !deje){
    toast('⚠️ Indica la hora de toma y de deje');
    return;
  }
  var k = selDay.k;
  if(TV[k] && TV[k].tipo!=='reserva'){
    if(!confirm('Este día ya tiene un turno asignado. ¿Cambiar a reserva?')){
      closeOv('ov-toma-deje-reserva'); clearSelDay(); return;
    }
  }
  // reservaActiva se deja SIN establecer (false) — la reserva cuenta
  // como Presencia hasta que se pinche/verifique con "Pinchar/Verificar"
  // (verificarReserva(), ya existente, la convierte en 'ordinario').
  TV[k] = {tipo:'reserva', simple:true, reservaHoraToma:toma, reservaHoraLlegada:deje};
  saveTV();
  if(typeof verificarDescansosMes==='function') ALERTAS_DESCANSO = verificarDescansosMes();
  closeOv('ov-toma-deje-reserva');
  clearSelDay();
  renderCal();
  renderStats();
  toast('✅ Reserva guardada ('+toma+' – '+deje+')');
}

// NUEVO — Selector Reserva/Jornada Normal para HTDL (mismo patrón
// visual que Art.51/52, con su propia tarifa: AJ.vh, no art5152Monto).
function abrirModalModoTrabajado(){
  if(!selDay) return;
  openOv('ov-modo-trabajado');
}

function elegirModoTrabajado(modo){
  closeOv('ov-modo-trabajado');
  resetF('trabajado');
  // F.modoTrabajado: 'reserva' | 'normal'. Se añade DESPUÉS de
  // resetF() para que no se pierda.
  F.modoTrabajado = modo;
  abrirForm(false);
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — calcularMix()
   Compara los dos tramos de una pernocta (ida vs vuelta) y decide
   cuál va a compensación económica (el de MÁS horas) y cuál a
   días de descanso (el de MENOS horas, siempre 2 días fijos).
   Función pura, de solo lectura.
═══════════════════════════════════════════════════════════ */
function calcularMix(horasIda, horasVuelta, kIda, kVuelta){
  var esIdaMayor = horasIda >= horasVuelta;
  return {
    diaDinero:   esIdaMayor ? kIda    : kVuelta,
    horasDinero: esIdaMayor ? horasIda: horasVuelta,
    diaDias:     esIdaMayor ? kVuelta : kIda,
    horasDias:   esIdaMayor ? horasVuelta : horasIda,
    diasGenerados: 2
  };
}

// NUEVO — Aviso (sin mover nada): comprueba si un retraso añadido
// DESPUÉS de guardar un Mix de Art.51/52 haría que el lado "días"
// pasara a tener más horas que el lado "dinero" (sumando cada tramo
// —ida y vuelta— con su propio retraso, tal y como se pidió). Solo
// informa; NO reasigna el dinero ni mueve los días de descanso ya
// generados en el calendario, porque eso movería fechas que el
// usuario ya da por hechas. k = celda de origen (ida) del turno.
function _art5152MixAvisoRetraso(k, t){
  if(!t || t.tipo!=='art5152' || t.compensacion!=='mix' || !t.mixDinero || !t.mixDias || !t.diaSiguiente) return null;
  var tVuelta = TV[t.diaSiguiente];
  var sumarRetrasos = function(reg){
    if(!reg) return 0;
    if(reg.retrasos && reg.retrasos.length){
      var s=0; reg.retrasos.forEach(function(r){ s+=r.minutos||0; }); return s;
    }
    if(reg.retrasoMin>0) return reg.retrasoMin;
    return 0;
  };
  var retIdaH = Math.round(sumarRetrasos(t)/60*100)/100;         // celda de origen = ida
  var retVueltaH = Math.round(sumarRetrasos(tVuelta)/60*100)/100; // celda del día siguiente = vuelta

  var eraIdaDinero = (t.mixDinero.dia===k);
  var horasIdaBase = eraIdaDinero ? t.mixDinero.horas : t.mixDias.horas;
  var horasVueltaBase = eraIdaDinero ? t.mixDias.horas : t.mixDinero.horas;

  var horasIdaTotal = Math.round((horasIdaBase + retIdaH)*100)/100;
  var horasVueltaTotal = Math.round((horasVueltaBase + retVueltaH)*100)/100;
  var seriaIdaDinero = horasIdaTotal >= horasVueltaTotal;

  if((retIdaH>0 || retVueltaH>0) && eraIdaDinero !== seriaIdaDinero){
    return {
      cambiaria:true,
      horasIdaTotal:horasIdaTotal, horasVueltaTotal:horasVueltaTotal,
      ladoActual: eraIdaDinero?'ida':'vuelta', ladoNuevo: seriaIdaDinero?'ida':'vuelta'
    };
  }
  return {cambiaria:false, horasIdaTotal:horasIdaTotal, horasVueltaTotal:horasVueltaTotal};
}

// ── Selector de compensación DENTRO del propio formulario ──
// Mismo patrón que setComp() (HTDL), pero con su propio campo
// F.compArt5152 para no interferir en absoluto con F.comp de HTDL.
function setCompArt5152(c){ F.compArt5152=c; renderFormBody(); }

/* ═══════════════════════════════════════════════════════════
   NUEVO — secArt5152Flow()
   Sección de compensación de Artículo 51/52, insertada dentro del
   MISMO formulario que Ordinario/Trabajado (ver renderFormBody).
   Replica al 100% las clases visuales de secDescFlow() (HTDL):
   .fsec, .fsec-lbl, .cc-btn/.cci/.ccl/.ccs, .calc-result, .cr-row,
   .cr-total — no se inventa ningún componente nuevo.
   secDescFlow() (HTDL) permanece intacta y sin usar este campo.
═══════════════════════════════════════════════════════════ */
// NUEVO — Reserva (Art.51/52): formulario simple de toma/deje, sin
// tramos ni trenes. Se paga en dinero, con la tarifa de Art.51/52
// configurada según el rol (AJ.art5152Monto/AJ.art5152ValorBase) —
// mismos campos que ya lee guardarTurno() para el modo normal.
// NUEVO — Reserva (HTDL): mismo formulario simple de toma/deje que
// Art.51/52, pero informando con la tarifa de HTDL (AJ.vh). El
// cálculo REAL de horas/dinero no lo hace esta función — al guardar,
// F.hF/F.hL se rellenan con toma/deje y el turno se guarda como
// 'trabajado' normal, así que pasa por calcularJornadaDiaria() y
// calculateEarnings() YA EXISTENTES, sin tocarlas ni un carácter.
function secReservaHTDL(){
  var tarifaHTDL = parseFloat(AJ.vh)||12.5;
  var toma = F.horaTomaHTDL||'';
  var deje = F.horaDejeHTDL||'';
  var horas = (toma&&deje) ? Math.round(calcMins(toma,deje)/60*100)/100 : 0;
  var importeAprox = Math.round(horas*tarifaHTDL*100)/100;

  var h = '<div class="fsec">'
    +'<div class="fsec-lbl">Reserva — HTDL / Descanso trabajado</div>'
    +'<div style="font-size:10px;color:var(--tx2);margin-bottom:10px;line-height:1.5">'
    +'Indica la hora de toma y de deje. Se pagará el intervalo completo a la tarifa de HTDL configurada en Ajustes.</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:10px">'
    +'<div style="flex:1">'
      +'<div class="fsec-lbl" style="margin-top:0">Hora de toma</div>'
      +'<input type="time" value="'+toma+'" oninput="F.horaTomaHTDL=this.value;F.hF=this.value;renderFormBody()" '
      +'style="width:100%;background:var(--s2);border:1.5px solid var(--div);border-radius:10px;'
      +'color:var(--tx);font-size:18px;font-weight:800;padding:9px 11px;outline:none">'
    +'</div>'
    +'<div style="flex:1">'
      +'<div class="fsec-lbl" style="margin-top:0">Hora de deje</div>'
      +'<input type="time" value="'+deje+'" oninput="F.horaDejeHTDL=this.value;F.hL=this.value;renderFormBody()" '
      +'style="width:100%;background:var(--s2);border:1.5px solid var(--div);border-radius:10px;'
      +'color:var(--tx);font-size:18px;font-weight:800;padding:9px 11px;outline:none">'
    +'</div>'
    +'</div>';

  if(toma && deje){
    h += '<div class="calc-result">'
      +'<div class="cr-row"><span class="cr-l">Horas HTDL</span><span class="cr-v">'+horas+' h</span></div>'
      +'<div class="cr-div"></div>'
      +'<div class="cr-row"><span class="cr-l">💶 Importe aprox. ('+horas+'h × '+tarifaHTDL.toFixed(2)+'€/h)</span>'
      +'<span class="cr-v" style="color:var(--green2)">'+importeAprox.toFixed(2)+' €</span></div>'
      +'<div style="font-size:9px;color:var(--tx3);margin-top:6px">El TAS recalculará el importe exacto con nocturnidad/pluses si aplican.</div>'
      +'</div>';
  } else {
    h += '<div style="font-size:10px;color:var(--tx3);text-align:center;padding:8px 0">Introduce ambas horas para ver el cálculo</div>';
  }
  h += '</div>';
  return h;
}

function secReservaArt5152(){
  var monto = parseFloat(AJ.art5152Monto)||0;
  var base  = parseFloat(AJ.art5152ValorBase)||0;
  var toma  = F.horaTomaArt||'';
  var deje  = F.horaDejeArt||'';
  var horas = (toma&&deje) ? Math.round(calcMins(toma,deje)/60*100)/100 : 0;
  var importe = Math.round((horas*monto+base)*100)/100;

  var h = '<div class="fsec">'
    +'<div class="fsec-lbl">Reserva — Artículo 51 y 52</div>'
    +'<div style="font-size:10px;color:var(--tx2);margin-bottom:10px;line-height:1.5">'
    +'Indica la hora de toma y de deje. Se pagará el intervalo completo a la tarifa de Art.51/52 configurada en Ajustes.</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:10px">'
    +'<div style="flex:1">'
      +'<div class="fsec-lbl" style="margin-top:0">Hora de toma</div>'
      +'<input type="time" value="'+toma+'" oninput="F.horaTomaArt=this.value;renderFormBody()" '
      +'style="width:100%;background:var(--s2);border:1.5px solid var(--div);border-radius:10px;'
      +'color:var(--tx);font-size:18px;font-weight:800;padding:9px 11px;outline:none">'
    +'</div>'
    +'<div style="flex:1">'
      +'<div class="fsec-lbl" style="margin-top:0">Hora de deje</div>'
      +'<input type="time" value="'+deje+'" oninput="F.horaDejeArt=this.value;renderFormBody()" '
      +'style="width:100%;background:var(--s2);border:1.5px solid var(--div);border-radius:10px;'
      +'color:var(--tx);font-size:18px;font-weight:800;padding:9px 11px;outline:none">'
    +'</div>'
    +'</div>';

  if(toma && deje){
    h += '<div class="calc-result">'
      +'<div class="cr-row"><span class="cr-l">Horas de reserva</span><span class="cr-v">'+horas+' h</span></div>'
      +'<div class="cr-div"></div>'
      +'<div class="cr-row"><span class="cr-l">💶 Importe ('+horas+'h × '+monto.toFixed(2)+'€/h'+(base>0?' + '+base.toFixed(2)+'€':'')+')</span>'
      +'<span class="cr-v" style="color:var(--green2)">'+importe.toFixed(2)+' €</span></div>'
      +'</div>';
  } else {
    h += '<div style="font-size:10px;color:var(--tx3);text-align:center;padding:8px 0">Introduce ambas horas para ver el cálculo</div>';
  }
  h += '</div>';
  return h;
}

function secArt5152Flow(){
  if(!F.modo) return '';
  var esPernocta = (F.modo==='pernocta'||F.modo==='pernocta3');
  var monto = parseFloat(AJ.art5152Monto)||0;
  var base  = parseFloat(AJ.art5152ValorBase)||0;
  var comp  = F.compArt5152||'dinero';

  var hIda    = F.hF&&F.hL?Math.round(calcMins(F.hF,F.hL)/60*100)/100:0;
  var hVuelta = F.hF2&&F.hL2?Math.round(calcMins(F.hF2,F.hL2)/60*100)/100:0;
  var hTotal  = Math.round((hIda+hVuelta)*100)/100;
  var nDias   = esPernocta ? 4 : 2;
  // NUEVO — Pluses (mismo origen de datos y mismas variables que ya
  // usa secDescFlow() para HTDL): Activación/JT son manuales (toggle
  // del usuario), Internacional es automático según la línea.
  var pArt51    = AJ.pluses[AJ.rol]||PLUS_DEF[AJ.rol];
  var pActArt   = F.plusAct      ? parseFloat(pArt51.activacion||0)    : 0;
  var pJTArt    = F.plusJT       ? parseFloat(pArt51.jt||0)            : 0;
  var pIntlArt  = F.plusIntlAuto ? parseFloat(pArt51.internacional||0) : 0;

  var h = '<div class="fsec" style="border-top:1px solid var(--div)">'
    +'<div class="fsec-lbl">Compensación — Artículo 51 y 52</div>'
    +'<div style="display:flex;gap:6px;margin-bottom:10px">'
    +'<div class="cc-btn '+(comp==='dinero'?'on':'')+'" onclick="setCompArt5152(\'dinero\')">'
    +'<div class="cci">💶</div><div class="ccl">En dinero</div><div class="ccs">Tiempo efectivo</div></div>'
    +'<div class="cc-btn '+(comp==='dias'?'on':'')+'" onclick="setCompArt5152(\'dias\')">'
    +'<div class="cci">📅</div><div class="ccl">'+nDias+' días</div><div class="ccs">Mes siguiente</div></div>';
  if(esPernocta){
    h += '<div class="cc-btn '+(comp==='mix'?'on':'')+'" onclick="setCompArt5152(\'mix\')">'
      +'<div class="cci">🔀</div><div class="ccl">Mix</div><div class="ccs">Dinero + días</div></div>';
  }
  h += '</div>';

  if(comp==='dinero'||comp==='dias'){
    h += '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);'
      +'border-radius:8px;padding:7px 10px;margin-bottom:10px;font-size:9px;color:var(--amber2)">'
      +'⚠️ Este artículo (Dinero o Días) solo puede registrarse una vez al mes y un máximo de 3 veces al año.</div>';
  }

  h += '<div id="calc-result-cont" class="calc-result">';
  if(comp==='mix' && esPernocta){
    if(hIda>0 && hVuelta>0){
      var mix = calcularMix(hIda, hVuelta, selDay.k, _diaSiguienteKey(selDay.k));
      var importeMix = Math.round((mix.horasDinero*monto+base+pActArt+pJTArt+pIntlArt)*100)/100;
      h += '<div class="cr-row"><span class="cr-l">Horas ida</span><span class="cr-v">'+hIda+' h</span></div>'
        +'<div class="cr-row"><span class="cr-l">Horas vuelta</span><span class="cr-v">'+hVuelta+' h</span></div>'
        +'<div class="cr-div"></div>'
        +'<div class="cr-row"><span class="cr-l">💶 Tramo a Dinero ('+mix.horasDinero+'h)</span>'
        +'<span class="cr-v" style="color:var(--green2)">'+importeMix.toFixed(2)+' €</span></div>'
        +(pActArt>0?'<div class="cr-row"><span class="cr-l">Plus Activación</span><span class="cr-v">+'+pActArt.toFixed(2)+' €</span></div>':'')
        +(pJTArt>0?'<div class="cr-row"><span class="cr-l">Plus JT</span><span class="cr-v">+'+pJTArt.toFixed(2)+' €</span></div>':'')
        +(pIntlArt>0?'<div class="cr-row"><span class="cr-l">Plus Internacional</span><span class="cr-v">+'+pIntlArt.toFixed(2)+' €</span></div>':'')
        +'<div class="cr-row"><span class="cr-l">📅 Tramo a Días</span>'
        +'<span class="cr-v" style="color:var(--cyan2)">+'+mix.diasGenerados+' día(s)</span></div>'
        +'<div style="font-size:9px;color:var(--tx3);margin-top:4px">📧 Al guardar se abrirá un correo automático para Programación.</div>'
        // FIX: selector de calendario para elegir los 2 días concretos
        // (antes esta rama no incluía el contenedor y no aparecía nada).
        +'<div style="font-size:10px;color:var(--tx2);margin-top:8px">📅 Selecciona los 2 días en el mes siguiente:</div>'
        +'<div id="mini-cal-cont"></div>';
    } else {
      h += '<div style="font-size:10px;color:var(--tx3)">⚠️ Completa ambos tramos (ida y vuelta) para calcular el Mix</div>';
    }
  } else if(comp==='dinero'){
    // NUEVO — Toggles de pluses manuales (mismo componente plusToggle()
    // que ya usa HTDL, sin duplicar el helper).
    h += '<div style="margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:800;letter-spacing:1px;color:var(--tx3);'
      + 'margin-bottom:7px;text-transform:uppercase">Pluses activos este viaje</div>';
    h += plusToggle('plusAct', F.plusAct, 'Plus Activación',
      parseFloat(pArt51.activacion||0), '€ fijo × viaje',
      'togglePlus(\'plusAct\')');
    h += plusToggle('plusJT', F.plusJT, 'Plus JT',
      parseFloat(pArt51.jt||0), '€ fijo × viaje',
      'togglePlus(\'plusJT\')');
    if(F.plusIntlAuto){
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;'
        + 'background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.3);'
        + 'border-radius:9px;margin-bottom:6px">'
        + '<span style="font-size:13px">🌍</span>'
        + '<div style="flex:1"><div style="font-size:11px;font-weight:700;color:var(--cyan2)">Plus Internacional</div>'
        + '<div style="font-size:9px;color:var(--tx3)">Activado automáticamente · línea Internacional</div></div>'
        + '<span style="font-size:12px;font-weight:800;color:var(--cyan2)">+'+parseFloat(pArt51.internacional||0).toFixed(2)+' €</span>'
        + '</div>';
    }
    h += '</div>';
    // NUEVO: mismo criterio que el cálculo real de guardarTurno() —
    // Ida y vuelta → Ida + Escala + Vuelta. Pernocta → solo trenes.
    // FIX — misma corrección que en guardarTurno(): separar el
    // trabajo real de continuidad (ida y vuelta) de la escala real,
    // para que esta vista previa coincida con lo que de verdad se va
    // a guardar (antes, con continuidad de por medio, la vista previa
    // ya salía mal desde antes de guardar).
    var minContinuidadPrev = 0, minEscalaPrevCalc = 0, finIdaRealPrev = F.hL;
    if(F.continuidad && F.continuidad.length){
      F.continuidad.forEach(function(c){
        if(c.horaInicio && c.horaFin) minContinuidadPrev += calcMins(c.horaInicio, c.horaFin);
        if(!esPernocta && c.escalaMin!=null && c.escalaMin>0) minEscalaPrevCalc += c.escalaMin;
        if(c.horaFin) finIdaRealPrev = c.horaFin;
      });
    }
    if(!esPernocta && finIdaRealPrev && F.hF2){
      var huecoFinalPrev = calcMins(finIdaRealPrev, F.hF2);
      if(huecoFinalPrev>0) minEscalaPrevCalc += huecoFinalPrev;
    }
    var minContinuidadVueltaPrev = 0;
    if(F.continuidadVuelta && F.continuidadVuelta.length){
      F.continuidadVuelta.forEach(function(c){
        if(c.horaInicio && c.horaFin) minContinuidadVueltaPrev += calcMins(c.horaInicio, c.horaFin);
        if(!esPernocta && c.escalaMin!=null && c.escalaMin>0) minContinuidadVueltaPrev += c.escalaMin;
      });
    }
    var hEscalaPrev = Math.round(minEscalaPrevCalc/60*100)/100;
    var hContinuidadPrev = Math.round(minContinuidadPrev/60*100)/100;
    var hContinuidadVueltaPrev = Math.round(minContinuidadVueltaPrev/60*100)/100;
    // FIX — en pernocta, la continuidad de la ida y de la vuelta SÍ
    // deben sumarse al total (son horas realmente trabajadas); lo
    // único que sigue sin sumarse es la escala/hueco de descanso
    // entre ambos tramos. Antes se descartaba TODO en bloque.
    var hTotalPrev  = esPernocta
      ? Math.round((hTotal+hContinuidadPrev+hContinuidadVueltaPrev)*100)/100
      : Math.round((hIda+hEscalaPrev+hContinuidadPrev+hVuelta+hContinuidadVueltaPrev)*100)/100;
    if(hTotalPrev>0){
      h += '<div class="cr-row"><span class="cr-l">Horas ida</span><span class="cr-v">'+hIda+' h</span></div>';
      if(!esPernocta && hEscalaPrev>0) h += '<div class="cr-row"><span class="cr-l">Horas escala</span><span class="cr-v">'+hEscalaPrev+' h</span></div>';
      if(hContinuidadPrev>0) h += '<div class="cr-row"><span class="cr-l">Horas continuidad'+(esPernocta?' (ida)':'')+'</span><span class="cr-v">'+hContinuidadPrev+' h</span></div>';
      if(hVuelta>0) h += '<div class="cr-row"><span class="cr-l">Horas vuelta</span><span class="cr-v">'+hVuelta+' h</span></div>';
      if(hContinuidadVueltaPrev>0) h += '<div class="cr-row"><span class="cr-l">Horas continuidad'+(esPernocta?' (vuelta)':' vuelta')+'</span><span class="cr-v">'+hContinuidadVueltaPrev+' h</span></div>';
      h += '<div class="cr-row"><span class="cr-l"><strong>Total horas</strong></span><span class="cr-v"><strong>'+hTotalPrev+' h</strong></span></div>'
        +'<div class="cr-row"><span class="cr-l">Tarifa Art. 51/52</span><span class="cr-v">'+monto.toFixed(2)+' €/h</span></div>'
        +(base>0?'<div class="cr-row"><span class="cr-l">Valor base</span><span class="cr-v">+'+base.toFixed(2)+' €</span></div>':'')
        +(pActArt>0?'<div class="cr-row"><span class="cr-l">Plus Activación</span><span class="cr-v">+'+pActArt.toFixed(2)+' €</span></div>':'')
        +(pJTArt>0?'<div class="cr-row"><span class="cr-l">Plus JT</span><span class="cr-v">+'+pJTArt.toFixed(2)+' €</span></div>':'')
        +(pIntlArt>0?'<div class="cr-row"><span class="cr-l">Plus Internacional</span><span class="cr-v">+'+pIntlArt.toFixed(2)+' €</span></div>':'')
        +'<div class="cr-div"></div>'
        +'<div class="cr-total"><span class="cr-tl">Total a cobrar</span><span class="cr-tv">'+Math.round((hTotalPrev*monto+base+pActArt+pJTArt+pIntlArt)*100)/100+' €</span></div>'
        +(esPernocta?'<div style="font-size:9px;color:var(--tx3);margin-top:4px">Pernocta: tiempo en tren + continuidad (sin escala/descanso nocturno).</div>':'');
    } else {
      h += '<div style="font-size:10px;color:var(--tx3)">⚠️ Completa los tramos para ver el cálculo</div>';
    }
  } else {
    h += '<div style="font-size:11px;color:var(--tx2)">➕ '+nDias+' día(s) de descanso se sumarán automáticamente al mes siguiente al guardar.</div>'
    // FIX: reutiliza el MISMO contenedor y componente (#mini-cal-cont /
    // renderMiniCal()) que ya usa HTDL para elegir los días — no se crea
    // nada nuevo. Antes faltaba este div, por lo que renderMiniCal()
    // encontraba el contenedor inexistente y no pintaba nada.
    +'<div id="mini-cal-cont"></div>';
  }
  h += '</div>'; // cierra #calc-result-cont
  h += '</div>'; // NUEVO: cierra el contenedor .fsec exterior (antes faltaba)
  return h;
}
function _abrirAvisoLimiteArt5152(motivo){
  // Mismo overlay estático de siempre (.ov/.confirm-sh, igual que
  // "Eliminar turno" y "Borrar todo") — solo cambia el TEXTO según
  // qué límite se ha superado, para que el aviso sea preciso sin
  // dejar de ser visualmente idéntico en ambos casos.
  var txt = document.getElementById('aviso-art5152-txt');
  if(txt){
    txt.textContent = (motivo==='anual')
      ? 'Por reglamento, el uso de este artículo está permitido un máximo de 3 veces al año. ¿Desea continuar con el registro?'
      : 'Por reglamento, el uso de este artículo está permitido solo una vez al mes. ¿Desea continuar con el registro?';
  }
  openOv('ov-aviso-art5152');
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — Correo automático del Mix (sin cambios respecto a la
   versión anterior; solo se invoca ahora desde guardarTurno()).
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   UNIFICACIÓN — Correo de compensación Mix (HTDL y Art. 51/52)
   Sustituye el pop-up anterior (div flotante) por el MISMO modal
   estándar que ya usa la app para "Cambio de Turno": overlay
   .ov + .sh, abierto/cerrado con openOv()/closeOv() — cero
   componentes nuevos, solo se reutiliza el patrón existente.
   mixInfo = {diaDinero, diaDias, trenDinero}
═══════════════════════════════════════════════════════════ */
function _generarMensajeMixUnificado(kIda, kVuelta, mixInfo){
  var lblIda = _keyAFechaLbl(kIda), lblVuelta = _keyAFechaLbl(kVuelta);
  var lblDinero = _keyAFechaLbl(mixInfo.diaDinero);
  var lblDias   = _keyAFechaLbl(mixInfo.diaDias);
  var nombre = AJ.nombre || 'Nombre no configurado en Ajustes';
  var matricula = AJ.matricula || 'Matricula no configurada en Ajustes';
  var trenDinero = mixInfo.trenDinero || 'sin numero asignado';
  var trenDias   = mixInfo.trenDias   || 'sin numero asignado';

  // Fechas de descanso REALMENTE seleccionadas en el mini calendario
  // (mixInfo.diasDescanso, viene de d.mixDias.diasComp).
  var descansos = mixInfo.diasDescanso || [];
  var fechaDescanso1 = descansos[0] ? _keyAFechaLbl(descansos[0]) : 'pendiente de seleccionar';
  var fechaDescanso2 = descansos[1] ? _keyAFechaLbl(descansos[1]) : 'pendiente de seleccionar';

  // Plantilla EXACTA solicitada. Los parentesis del tren se dejan tal
  // cual en el texto; sanitizarTexto() (ya existente, se aplica al
  // generar y al enviar) los retira automáticamente igual que hace
  // con cualquier otro símbolo, dejando el resultado en texto plano.
  // FIX: saludo dinámico según la hora de envío, reutilizando
  // _saludoPorHora() (la misma función que ya usa el correo de
  // Enlace de Jornada) — antes estaba fijo en "buenos dias" sin
  // importar la hora real.
  var saludo = _saludoPorHora().toLowerCase();

  return 'Hola, '+saludo+'.\n\n'
    +'Informo que para la pernocta de los dias '+lblIda+' y '+lblVuelta+', '
    +'he seleccionado el tramo del dia '+lblDinero+' (tren '+trenDinero+') '
    +'para la compensacion economica.\n\n'
    +'Asimismo, solicito que el tramo del dia '+lblDias+' (tren '+trenDias+') '
    +'sea compensado con los dias '+fechaDescanso1+' y '+fechaDescanso2+' del mes '
    +'siguiente como mis dias de descanso compensatorio.\n\n'
    +'Atentamente,\n'
    +nombre+'\n'
    +'Matricula: '+matricula+'\n\n'
    +'Solicitud generada automaticamente por TrenTurnos V5.';
}

function _abrirCorreoMixUnificado(kIda, kVuelta, mixInfo, origenTipo){
  var body = document.getElementById('correo-mix-body');
  if(!body) return;
  // Guardamos el origen (HTDL o Art.51/52) para poder generar el
  // asunto correcto al pulsar "Enviar", sin tener que volver a pasarlo.
  _correoMixOrigenActual = origenTipo || 'trabajado';
  body.innerHTML =
    '<div class="aj-nombre-wrap" style="margin-bottom:10px"><span class="aj-nombre-ico">📧</span>'
      +'<input id="mix-correo-destinatario" class="aj-nombre-inp" placeholder="Destinatario (opcional)" value=""></div>'
    +'<div style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--tx3);margin-bottom:6px">MENSAJE (editable)</div>'
    +'<textarea id="mix-correo-textarea" class="correo-modal-textarea" style="min-height:230px"></textarea>'
    +'<button onclick="enviarCorreoMixUnificado()" style="width:100%;margin-top:12px;padding:13px;'
      +'background:linear-gradient(135deg,var(--acc),var(--acc2));border:none;border-radius:12px;'
      +'color:#fff;font-size:14px;font-weight:800;cursor:pointer">✉️ Abrir en Correo</button>'
    +'<div style="font-size:9px;color:var(--tx3);text-align:center;margin-top:7px">Abre tu app de correo con el mensaje completo</div>';
  // FIX: el texto que se muestra en el textarea (editable por el
  // usuario) ya sale limpio con sanitizarTexto() — así lo que ve en
  // pantalla es exactamente lo que se enviará, sin sorpresas.
  document.getElementById('mix-correo-textarea').value = sanitizarTexto(_generarMensajeMixUnificado(kIda, kVuelta, mixInfo));
  openOv('ov-correo-mix');
} // 'trabajado' (HTDL) | 'art5152'

function enviarCorreoMixUnificado(){
  var dest = (document.getElementById('mix-correo-destinatario')||{}).value.trim() || '';
  var cuerpo = sanitizarTexto((document.getElementById('mix-correo-textarea')||{}).value || '');
  // NUEVO: asunto dinámico según el origen del registro. Pasa por
  // sanitizarTexto() también, para que quede igual de limpio.
  var asunto = sanitizarTexto((_correoMixOrigenActual==='art5152')
    ? 'Compensacion por forzoso'
    : 'Compensacion por dia de trabajo HTDL');
  // FIX: el destinatario NUNCA se codifica con encodeURIComponent —
  // igual que hace enviarCambio() (mailto:?subject=...), que deja el
  // destinatario tal cual o vacío. Codificar el email metía símbolos
  // como %40 en lugar de la @, que es justo el problema reportado.
  // Solo subject y body (los únicos parámetros de la query) se
  // codifican, y solo una vez.
  var url = 'mailto:'+dest+'?subject='+encodeURIComponent(asunto)+'&body='+encodeURIComponent(cuerpo);
  window.location.href = url;
  closeOv('ov-correo-mix');
}

// ── Compatibilidad: mismo punto de entrada que ya llama guardarTurno() ──
function _abrirCorreoMixArt5152(kIda, kVuelta, d, origenTipo){
  var mixInfo = {
    diaDinero: d.mixDinero.dia,
    diaDias: d.mixDias.dia,
    trenDinero: (d.mixDinero.dia===kIda) ? (d.numTren||'') : (d.numTrenVuelta||d.numTren||''),
    // NUEVO: número de tren del tramo asignado a días (antes no se
    // calculaba; el correo solo mencionaba el tren del tramo a dinero).
    trenDias: (d.mixDias.dia===kIda) ? (d.numTren||'') : (d.numTrenVuelta||d.numTren||''),
    // Fechas realmente elegidas en el mini calendario para los días
    // de descanso (antes no se recuperaban ni se incluían).
    diasDescanso: (d.mixDias && d.mixDias.diasComp) ? d.mixDias.diasComp : []
  };
  _abrirCorreoMixUnificado(kIda, kVuelta, mixInfo, origenTipo);
}
