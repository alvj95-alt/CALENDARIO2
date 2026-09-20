/* TrenTurnos v5 — Tipos de turno, DOP, descansos compensatorios, cambios y registro de intercambio
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════
   TIPO TURNO
═══════════════════════════════════════ */
function resetF(tipo){
  F={tipo:tipo,linea:null,sal:AJ.base||null,lle:null,hF:null,hL:null,
     sal2:null,lle2:null,hF2:null,hL2:null,
     modo:null,comp:null,horas:0,diasComp:[],notas:'',
     numTren:'', numTrenVuelta:'',
     plusAct:false,plusJT:false,plusIntlAuto:false};
}

function abrirTipo(){
  if(!selDay)return;
  var _sm=selDay.k.split('-').map(Number);var y=_sm[0],mo=_sm[1];
  var dt=new Date(y,mo-1,selDay.d);
  var wd=(dt.getDay()+6)%7;
  document.getElementById('tipo-fecha-lbl').textContent=DIAS_L[wd]+' '+selDay.d+' '+MESES_C[mo-1];
  openOv('ov-tipo');
}

function contarDOPAnio(anio){
  if(!anio) anio = new Date().getFullYear();
  var total = 0;
  var meses = []; // meses donde ya hay DOP
  var keys = Object.keys(TV);
  for(var i=0; i<keys.length; i++){
    var p = keys[i].split('-').map(Number);
    if(p[0]===anio && TV[keys[i]] && TV[keys[i]].tipo==='dop'){
      total++;
      meses.push(p[1]);
    }
  }
  return {total:total, meses:meses, max:DOP_MAX_ANUAL, restantes:Math.max(0,DOP_MAX_ANUAL-total)};
}

function esDOPDisponible(anio, mes){
  var keys = Object.keys(TV);
  for(var i=0; i<keys.length; i++){
    var k = keys[i];
    var partes = k.split('-').map(Number);
    if(partes[0]===anio && partes[1]===mes && TV[k] && TV[k].tipo==='dop'){
      return false; // ya hay un DOP este mes
    }
  }
  return true; // mes libre
}

/* ═══════════════════════════════════════════════════════════
   generarCuerpoCorreo(datos) — función base ÚNICA para el cuerpo
   de cualquier correo saliente de la app. Todas las funciones que
   generan un correo (DOP, Cambio de turno, Compensación —manual y
   automática—, Disponibilidad HTDL) pasan por aquí para las dos
   partes que antes vivían duplicadas, cada una con su propia
   suerte: la referencia al tren y el cierre con la firma.
     datos.saludo       — cadena ya resuelta ('Buenos dias', etc.)
     datos.mensaje       — texto propio de ese correo, ya redactado
                            por quien llama (cada tipo de correo
                            sigue teniendo su propia redacción)
     datos.mostrarTren   — true si este correo debe incluir un
                            bloque de tren; false en correos que no
                            aplican (DOP, disponibilidad HTDL)
     datos.tramosIda     — array de números de tren de ida,
                            incluyendo los tramos de continuidad
     datos.tramosVuelta  — array de números de tren de vuelta,
                            incluyendo los tramos de continuidad
     datos.firma         — nombre del remitente
     datos.matricula     — matrícula del remitente
   Si mostrarTren es true y no hay ningún número de tren disponible,
   imprime "Sin tren asignado" — nunca deja el hueco en blanco.
   La marca de agua final se añade SIEMPRE, aquí y solo aquí, así
   que es matemáticamente imposible que un correo salga sin ella.
═══════════════════════════════════════════════════════════ */
function generarCuerpoCorreo(datos){
  datos = datos || {};
  var partes = [];
  partes.push((datos.saludo||'Buenos dias')+'.');
  if(datos.mensaje) partes.push(datos.mensaje);

  if(datos.mostrarTren){
    var ida = (datos.tramosIda||[]).filter(Boolean);
    var vuelta = (datos.tramosVuelta||[]).filter(Boolean);
    var trenTxt;
    if(!ida.length && !vuelta.length){
      trenTxt = 'Sin tren asignado';
    } else if(ida.length && vuelta.length){
      trenTxt = ida.map(function(n){return 'Tren '+n;}).join(' - ')
        +' - '+vuelta.map(function(n){return 'Tren '+n;}).join(' - ');
    } else {
      trenTxt = (ida.length?ida:vuelta).map(function(n){return 'Tren '+n;}).join(' - ');
    }
    partes.push('Referencia: '+trenTxt+'.');
  }

  partes.push('Atentamente,\n'+(datos.firma||'')+'\nMatricula: '+(datos.matricula||''));

  return partes.join('\n\n')+'\n\nSolicitud generada automaticamente por TrenTurno V5';
}

// Punto de entrada al seleccionar DOP en el selector de tipos.
function elegirDOP(){
  if(!selDay){ toast('Selecciona un día primero'); return; }
  var partes = selDay.k.split('-').map(Number);
  var anio=partes[0], mes=partes[1], dd=partes[2];

  if(!esDOPDisponible(anio, mes)){
    toast('⭐ Ya has solicitado un DOP este mes');
    closeOv('ov-tipo');
    return;
  }

  // Guardar el DOP en TV
  var d = {tipo:'dop'};
  TV[selDay.k] = d;
  selDay.t = d;
  saveTV();
  renderCal();

  // ── Alerta DOP con conteo anual ──
  var dopInfo = contarDOPAnio(anio);
  toast('⭐ DOP registrado — llevas ' + dopInfo.total + ' de ' + dopInfo.max);

  // Generar y mostrar el correo automáticamente
  var fstr = dd+' de '+MESES[mes-1].toLowerCase()+' de '+anio;
  var mn = AJ.nombre||'', mm = AJ.matricula||'';
  var hora = new Date().getHours();
  var sal = hora<13?'Buenos dias':hora<20?'Buenas tardes':'Buenas noches';
  var cuerpo = generarCuerpoCorreo({
    saludo: sal,
    mensaje: 'Me gustaria solicitar el dia '+fstr+' como DOP. Espero su confirmacion.',
    mostrarTren: false,
    firma: mn,
    matricula: mm
  });
  var asunto = 'Solicitud DOP - '+fstr;

  closeOv('ov-tipo');
  // Abrir popup de correo (sin botón Posponer — es una solicitud puntual)
  setTimeout(function(){
    handleEmailSubmission('Solicitud de DOP', fstr, asunto, cuerpo, function(){}, false);
  }, 200);
}

function elegirTipo(tipo){
  closeOv('ov-tipo');

  // NUEVO — 'baja' tiene su propio flujo dedicado (preguntar cuántos
  // días dura + notificación por correo), en vez de guardarse como
  // día único. Se intercepta AQUÍ, antes del guardado simple
  // compartido, sin tocar cómo se guardan vacaciones/descanso/reserva.
  if(tipo==='baja'){
    if(!selDay){ return; }
    abrirModalDiasBaja();
    return;
  }

  // NUEVO — 'art5152' ahora pregunta primero si es Reserva o Jornada
  // Normal, antes de abrir el formulario de tramos. Se intercepta
  // aquí, sin tocar el resto de tipos con formulario (ordinario,
  // trabajado, comp).
  if(tipo==='art5152'){
    if(!selDay){ return; }
    abrirModalModoArt5152();
    return;
  }

  // NUEVO — 'reserva' ahora pregunta obligatoriamente la hora de toma
  // y de deje mediante un pop-up, en vez de guardarse directa y vacía.
  if(tipo==='reserva'){
    if(!selDay){ return; }
    abrirModalTomaDejeReserva();
    return;
  }

  // NUEVO — 'trabajado' (HTDL / Descanso trabajado) ahora pregunta
  // primero si es Reserva o Jornada Normal, mismo patrón que Art.51/52
  // pero con su propia tarifa (HTDL, AJ.vh).
  if(tipo==='trabajado'){
    if(!selDay){ return; }
    abrirModalModoTrabajado();
    return;
  }

  // Tipos simples: guardar directo sin abrir formulario
  if(tipo==='vacaciones'||tipo==='descanso'){
    if(selDay){
      var k=selDay.k;
      if(TV[k]&&TV[k].tipo!==tipo){
        if(!confirm('Este día ya tiene un turno asignado. ¿Cambiar a '+tipo+'?')){
          clearSelDay(); return;
        }
      }
      TV[k]={tipo:tipo,simple:true};
      saveTV();
      ALERTAS_DESCANSO=verificarDescansosMes();
    }
    clearSelDay(); // seguro: ya guardamos, no necesitamos selDay
    renderCal();
    renderStats();
    return;
  }

  // Tipos con formulario: ordinario, trabajado, comp
  // CRÍTICO: NO llamar clearSelDay aquí — abrirForm necesita selDay
  resetF(tipo);
  abrirForm(false);
  // clearSelDay se llamará cuando el usuario cierre el formulario
}

function editarTurno(){
  if(!selDay||!selDay.t) return;
  var t=selDay.t;

  // ── Día de compensación → popup especial ─────────────────────
  if(t.tipo==='comp'){
    abrirEditComp();
    return;
  }

  // ── Vuelta pernocta o día intermedio → ir al día de ida y editarlo ──
  if(t.tipo==='vuelta-pernocta' || t.tipo==='pernocta3-intermedio'){
    if(t.origenPernocta && TV[t.origenPernocta]){
      var kOri=t.origenPernocta;
      var _ko=kOri.split('-').map(Number);var y=_ko[0],mo=_ko[1],dd=_ko[2];
      var tOri=TV[kOri];
      // C-02 FIX: No llamada recursiva — cargamos F directamente con el turno origen
      // y abrimos el formulario. Evita el bucle infinito si selDay no se actualiza a tiempo.
      selDay={d:dd, k:kOri, t:tOri};
      curM=new Date(y,mo-1,1);
      F={tipo:tOri.tipo, linea:tOri.linea||null,
         sal:tOri.sal||(AJ.base||null), lle:tOri.lle||null,
         hF:tOri.hF||null, hL:tOri.hL||null,
         sal2:tOri.sal2||null, lle2:tOri.lle2||null,
         hF2:tOri.hF2||null, hL2:tOri.hL2||null,
         sal3:(tOri.diaIntermedio&&TV[tOri.diaIntermedio]&&TV[tOri.diaIntermedio].sal)||null,
         lle3:(tOri.diaIntermedio&&TV[tOri.diaIntermedio]&&TV[tOri.diaIntermedio].lle)||null,
         hF3:(tOri.diaIntermedio&&TV[tOri.diaIntermedio]&&TV[tOri.diaIntermedio].hF)||null,
         hL3:(tOri.diaIntermedio&&TV[tOri.diaIntermedio]&&TV[tOri.diaIntermedio].hL)||null,
         modo:tOri.modo||null, comp:tOri.comp||null,
         horas:tOri.horas||0, diasComp:(tOri.diasComp||[]).slice(), notas:tOri.notas||'',
         numTren:tOri.numTren||'', numTrenVuelta:tOri.numTrenVuelta||'',
         numTrenIntermedio:tOri.numTrenIntermedio||'',
         estadoServicio:tOri.estadoServicio||'ordinario',
         estadoServicioDetalle:tOri.estadoServicioDetalle||'',
         estadoServicioVuelta:tOri.estadoServicioVuelta||'ordinario',
         estadoServicioVueltaDetalle:tOri.estadoServicioVueltaDetalle||'',
         plusAct:tOri.plusAct||false, plusJT:tOri.plusJT||false,
         plusIntlAuto:(tOri.linea||'').includes('Internacional')};
      renderCal();
      abrirForm(true);
    } else {
      toast('⚠️ El turno de ida ya no existe');
    }
    return;
  }

  // ── Cualquier otro tipo → edición normal ─────────────────────
  F={tipo:t.tipo,linea:t.linea||null,
     sal:t.sal||(AJ.base||null),lle:t.lle||null,hF:t.hF||null,hL:t.hL||null,
     sal2:t.sal2||null,lle2:t.lle2||null,hF2:t.hF2||null,hL2:t.hL2||null,
     sal3:(t.diaIntermedio&&TV[t.diaIntermedio]&&TV[t.diaIntermedio].sal)||null,
     lle3:(t.diaIntermedio&&TV[t.diaIntermedio]&&TV[t.diaIntermedio].lle)||null,
     hF3:(t.diaIntermedio&&TV[t.diaIntermedio]&&TV[t.diaIntermedio].hF)||null,
     hL3:(t.diaIntermedio&&TV[t.diaIntermedio]&&TV[t.diaIntermedio].hL)||null,
     modo:t.modo||null,comp:t.comp||null,
     horas:t.horas||0,diasComp:(t.diasComp||[]).slice(),notas:t.notas||'',
     numTren:t.numTren||'', numTrenVuelta:t.numTrenVuelta||'',
     numTrenIntermedio:t.numTrenIntermedio||'',
     estadoServicio:t.estadoServicio||'ordinario',
     estadoServicioDetalle:t.estadoServicioDetalle||'',
     estadoServicioVuelta:t.estadoServicioVuelta||'ordinario',
     estadoServicioVueltaDetalle:t.estadoServicioVueltaDetalle||'',
     dhMismoTren:(typeof t.dhMismoTren==='boolean')?t.dhMismoTren:null,
     dhTrenDH:t.dhTrenDH||'', dhOrigen:t.dhOrigen||null,
     dhHoraInicio:t.dhHoraInicio||'', dhHoraFin:t.dhHoraFin||'',
     dhMinutos:(t.dhMinutos!=null)?t.dhMinutos:null,
     dhMismoTrenVuelta:(typeof t.dhMismoTrenVuelta==='boolean')?t.dhMismoTrenVuelta:null,
     dhTrenDHVuelta:t.dhTrenDHVuelta||'', dhOrigenVuelta:t.dhOrigenVuelta||null,
     dhHoraInicioVuelta:t.dhHoraInicioVuelta||'', dhHoraFinVuelta:t.dhHoraFinVuelta||'',
     dhMinutosVuelta:(t.dhMinutosVuelta!=null)?t.dhMinutosVuelta:null,
     continuidad:(t.continuidad||[]).map(function(c){return Object.assign({},c);}),
     continuidadVuelta:(t.continuidadVuelta||[]).map(function(c){return Object.assign({},c);}),
     plusAct:t.plusAct||false,plusJT:t.plusJT||false,
     // NUEVO — modoArt5152: 'reserva' | 'normal'. Los turnos guardados
     // ANTES de esta función no tienen este campo — se asume 'normal'
     // por defecto, para que sigan editándose exactamente igual que
     // siempre (con tramos), sin romper nada.
     modoArt5152:t.modoArt5152||'normal',
     horaTomaArt:t.horaTomaArt||'', horaDejeArt:t.horaDejeArt||'',
     // NUEVO — modoTrabajado: al EDITAR un HTDL ya guardado, siempre
     // se abre en modo 'normal' (con tramos), independientemente de
     // si se creó originalmente como Reserva — porque el registro ya
     // guardado tiene hF/hL/numTren editables directamente ahí. Esto
     // es justo el mecanismo de "pinchar/verificar": abrir y editar.
     modoTrabajado:'normal',
     plusIntlAuto:(t.linea||'').includes('Internacional')};
  abrirForm(true);
}

function verificarReserva(){
  if(!selDay)return;
  resetF('ordinario');
  abrirForm(false,true);
}

// NUEVO — Pinchar/Verificar una Reserva de Art.51/52: convierte el
// registro de reserva simple (toma/deje) en un turno de Art.51/52
// con tramos reales, cargando automáticamente la hora de toma como
// hora de firma del Tramo 1 — mismo patrón que verificarReserva()
// para la reserva normal, sin tocarla.
function verificarReservaArt5152(){
  if(!selDay || !selDay.t || selDay.t.tipo!=='art5152' || selDay.t.modoArt5152!=='reserva') return;
  var tRes = selDay.t;
  resetF('art5152');
  // Modo Normal: activa el flujo de tramos ya existente (ida/vuelta/
  // pernocta/pernocta3), exactamente igual que si se hubiera elegido
  // "Jornada Normal" desde el principio.
  F.modoArt5152 = 'normal';
  // Carga automática de la hora de firma ya registrada al guardar la
  // reserva — el usuario no tiene que volver a escribirla.
  F.hF = tRes.horaTomaArt || null;
  abrirForm(false, true);
}

// Activación ligera de una reserva: NO la convierte en 'ordinario' (eso
// lo sigue haciendo "Verificar reserva"). Solo marca que una parte de
// la guardia fue trabajo real, para que calcularJornadaDiaria() reparta
// sus horas entre Efectivas y Presencia en vez de contarla íntegra como
// Presencia (8h por defecto).
function toggleReservaActiva(activa){
  if(!selDay||!selDay.t||selDay.t.tipo!=='reserva') return;
  TV[selDay.k].reservaActiva = activa;
  saveTV();
  selDay.t = TV[selDay.k];
  renderDiaArea();
}

function convertirDescanso(){
  if(!selDay)return;
  resetF('trabajado');
  abrirForm(false);
}

/* ═══════════════════════════════════════
   EDICIÓN DE DÍA COMPENSATORIO
   Permite convertirlo en turno real o eliminarlo
═══════════════════════════════════════ */
function abrirEditComp(){
  if(!selDay||!selDay.t)return;
  var t=selDay.t,k=selDay.k;
  var kd=k.split('-').map(Number);var y=kd[0],mo=kd[1],dd=kd[2];
  var wd=(new Date(y,mo-1,dd).getDay()+6)%7;
  var fs=DIAS_L[wd]+' '+dd+' de '+MESES[mo-1].toLowerCase();
  var oI='';
  if(t.origen&&TV[t.origen]){var kop=t.origen.split('-').map(Number);var lbl=kop[2]+' '+['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][kop[1]-1]+' '+kop[0];oI='<div style="font-size:10px;color:var(--tx3);margin-top:4px">Generado por turno del <strong style="color:var(--tx2)">'+lbl+'</strong></div>';}
  document.getElementById('edit-comp-tit').textContent=fs;
  document.getElementById('edit-comp-body').innerHTML=
    '<div style="padding:14px 16px">'
    +'<div class="ibox" style="background:rgba(8,145,178,.08);border:1px solid rgba(8,145,178,.25);margin-bottom:12px"><span class="ibox-i">📅</span><div><div style="font-size:12px;font-weight:700;color:var(--cyan2)">Dia de Compensacion</div>'+oI+'</div></div>'
    +'<div style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--tx3);margin-bottom:8px">QUE QUIERES HACER?</div>'
    // FIX — antes "Trabajar este día" abría un turno 'ordinario'
    // cualquiera. Un día de compensación es, por definición, un
    // descanso que se te debe — si lo trabajas, solo hay dos formas
    // válidas de que se te pague: HTDL (automático, según las reglas
    // de descanso) o Art. 51/52 (manual). Se ofrecen ambas por
    // separado, en vez de la opción genérica de antes.
    +'<div onclick="compConvertir(\'trabajado\')" style="display:flex;align-items:center;gap:11px;padding:13px 14px;background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.25);border-radius:12px;cursor:pointer;margin-bottom:8px" onmouseover="this.style.background=\'rgba(37,99,235,.16)\'" onmouseout="this.style.background=\'rgba(37,99,235,.08)\'"><span style="font-size:22px">🚂</span><div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--acc2)">Turno normal (HTDL)</div><div style="font-size:10px;color:var(--tx3)">Se marca solo como HTDL, por trabajar un día de descanso</div></div><span style="color:var(--tx3);font-size:16px">›</span></div>'
    +'<div onclick="compConvertir(\'art5152\')" style="display:flex;align-items:center;gap:11px;padding:13px 14px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.25);border-radius:12px;cursor:pointer;margin-bottom:8px" onmouseover="this.style.background=\'rgba(139,92,246,.16)\'" onmouseout="this.style.background=\'rgba(139,92,246,.08)\'"><span style="font-size:22px">📋</span><div style="flex:1"><div style="font-size:13px;font-weight:700;color:#C4B5FD">Art. 51/52</div><div style="font-size:10px;color:var(--tx3)">Compensación por Artículo 51/52</div></div><span style="color:var(--tx3);font-size:16px">›</span></div>'
    +'<div onclick="compConvertir(\'descanso\')" style="display:flex;align-items:center;gap:11px;padding:13px 14px;background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.25);border-radius:12px;cursor:pointer;margin-bottom:8px" onmouseover="this.style.background=\'rgba(22,163,74,.16)\'" onmouseout="this.style.background=\'rgba(22,163,74,.08)\'"><span style="font-size:22px">🧘</span><div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--green2)">Marcar como descanso</div><div style="font-size:10px;color:var(--tx3)">El dia sigue libre</div></div><span style="color:var(--tx3);font-size:16px">›</span></div>'
    +'<div onclick="compEliminar()" style="display:flex;align-items:center;gap:11px;padding:13px 14px;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:12px;cursor:pointer" onmouseover="this.style.background=\'rgba(220,38,38,.14)\'" onmouseout="this.style.background=\'rgba(220,38,38,.06)\'"><span style="font-size:22px">🗑</span><div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--red2)">Quitar compensacion</div><div style="font-size:10px;color:var(--tx3)">Liberar este dia</div></div><span style="color:var(--tx3);font-size:16px">›</span></div>'
    +'</div>';
  openOv('ov-edit-comp');
}

// Convertir día comp en turno real (ordinario o descanso)
function compConvertir(nuevoTipo){
  // NO cerrar el overlay todavía — primero guardar el dato
  var k = selDay.k;
  var t = TV[k];

  if(nuevoTipo === 'descanso'){
    // FIX — el desvincular (quitar 'k' de ori.diasComp) se hace SOLO
    // aquí, al marcar descanso: eso sí libera de verdad el día. Antes
    // se desvinculaba también al elegir "trabajar" (HTDL/Art.51/52),
    // y eso hacía que STATS perdiera el registro de qué días se
    // habían solicitado el mes anterior en cuanto se trabajaban —
    // justo lo contrario de lo que se quiere: un historial que se
    // conserve aunque el día ya se haya trabajado.
    if(t.origen && TV[t.origen]){
      var oriD = TV[t.origen];
      if(oriD.diasComp){
        oriD.diasComp = oriD.diasComp.filter(function(d){ return d !== k; });
      }
    }
    // 1. Guardar primero
    TV[k] = {tipo:'descanso'};
    selDay.t = TV[k];
    saveTV();
    // 2. Cerrar después de guardar exitosamente
    closeOv('ov-edit-comp');
    closeOv('ov-form');
    renderCal();
    renderStats();
    toast('Día convertido a descanso');
  } else {
    // 'trabajado' (HTDL automático) o 'art5152' — NO se desvincula de
    // ori.diasComp, para que STATS siga mostrando este día como
    // "solicitado" aunque ya esté trabajado (registro histórico).
    closeOv('ov-edit-comp');
    resetF(nuevoTipo);
    abrirForm(false);
  }
}

// Eliminar la compensación de este día
function compEliminar(){
  var k=selDay.k,t=TV[k];
  if(t.origen&&TV[t.origen]){var ori=TV[t.origen];if(ori.diasComp)ori.diasComp=ori.diasComp.filter(function(d){return d!==k;});}
  delete TV[k];selDay.t=null;saveTV();closeOv('ov-edit-comp');renderCal();renderStats();toast('📅 Compensación eliminada');
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — "He trabajado este descanso" tras un Cambio registrado
   (companeroTeniaDescanso=true). A diferencia de abrirEditComp()/
   compConvertir() (pensadas para un día 'comp' generado por el
   propio sistema, donde TV[k] SÍ se reescribe), aquí TU TURNO
   ORIGINAL (TV[k]) NUNCA SE TOCA — sigue contando sus horas
   exactamente igual. Si eliges HTDL o Art.51/52, se añade como
   turno ADICIONAL aparte, forzado a ese tipo aunque tu turno
   principal sea Ordinario (ver _forzarTipoTurnoAdicional).
   Reutiliza el mismo overlay ov-edit-comp, solo cambia el
   contenido y a qué funciones apuntan los botones.
═══════════════════════════════════════════════════════════ */
function abrirConversionCambioDescanso(k){
  if(selDay && selDay.k !== k){ selDay = {d: parseInt(k.split('-')[2],10), k:k, t: TV[k]}; }
  var kd=k.split('-').map(Number);var y=kd[0],mo=kd[1],dd=kd[2];
  var wd=(new Date(y,mo-1,dd).getDay()+6)%7;
  var fs=DIAS_L[wd]+' '+dd+' de '+MESES[mo-1].toLowerCase();
  document.getElementById('edit-comp-tit').textContent=fs;
  document.getElementById('edit-comp-body').innerHTML=
    '<div style="padding:14px 16px">'
    +'<div class="ibox" style="background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.25);margin-bottom:12px"><span class="ibox-i">🧘</span><div><div style="font-size:12px;font-weight:700;color:var(--green2)">Descansas hoy (cambio)</div><div style="font-size:10px;color:var(--tx3);margin-top:2px">Tu turno original sigue contando sus horas igual — esto solo añade un turno adicional aparte si lo trabajas.</div></div></div>'
    +'<div style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--tx3);margin-bottom:8px">¿TRABAJASTE ESTE DESCANSO?</div>'
    +'<div onclick="_convertirCambioDescanso(\'trabajado\')" style="display:flex;align-items:center;gap:11px;padding:13px 14px;background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.25);border-radius:12px;cursor:pointer;margin-bottom:8px" onmouseover="this.style.background=\'rgba(37,99,235,.16)\'" onmouseout="this.style.background=\'rgba(37,99,235,.08)\'"><span style="font-size:22px">🚂</span><div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--acc2)">Turno normal (HTDL)</div><div style="font-size:10px;color:var(--tx3)">Se añade como HTDL, aparte de tu turno de hoy</div></div><span style="color:var(--tx3);font-size:16px">›</span></div>'
    +'<div onclick="_convertirCambioDescanso(\'art5152\')" style="display:flex;align-items:center;gap:11px;padding:13px 14px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.25);border-radius:12px;cursor:pointer;margin-bottom:8px" onmouseover="this.style.background=\'rgba(139,92,246,.16)\'" onmouseout="this.style.background=\'rgba(139,92,246,.08)\'"><span style="font-size:22px">📋</span><div style="flex:1"><div style="font-size:13px;font-weight:700;color:#C4B5FD">Art. 51/52</div><div style="font-size:10px;color:var(--tx3)">Se añade como Art.51/52, aparte de tu turno de hoy</div></div><span style="color:var(--tx3);font-size:16px">›</span></div>'
    +'<div onclick="closeOv(\'ov-edit-comp\')" style="display:flex;align-items:center;gap:11px;padding:13px 14px;background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.25);border-radius:12px;cursor:pointer" onmouseover="this.style.background=\'rgba(22,163,74,.16)\'" onmouseout="this.style.background=\'rgba(22,163,74,.08)\'"><span style="font-size:22px">🧘</span><div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--green2)">Sigue en descanso</div><div style="font-size:10px;color:var(--tx3)">No trabajaste nada más — no se añade ningún turno</div></div><span style="color:var(--tx3);font-size:16px">›</span></div>'
    +'</div>';
  openOv('ov-edit-comp');
}

function _convertirCambioDescanso(nuevoTipo){
  closeOv('ov-edit-comp');
  _forzarTipoTurnoAdicional = nuevoTipo;
  guardarTurnoExtra();
}

/* ═══════════════════════════════════════
   CAMBIO CON COMPAÑERO — universal
═══════════════════════════════════════ */
// NUEVO — el botón "Cambio" ahora pregunta primero qué quieres hacer,
// en vez de ir directo a solicitar el cambio con un compañero. La
// opción nueva ("Cambiar tipo de turno") reutiliza toda la lógica ya
// construida para "Copiar turno" (popups de tipo/compensación,
// cálculo de dinero) — no se reimplementa nada de cero.
function abrirCambio(){
  if(!selDay)return;
  document.getElementById('cambio-tit').textContent='¿Qué quieres hacer?';
  document.getElementById('cambio-body').innerHTML =
    '<div style="padding:14px 16px">'
    + '<button onclick="_abrirSolicitudCambioTurno()" style="width:100%;margin-bottom:10px;text-align:left;padding:14px;background:var(--s2);border:1px solid var(--div);border-radius:12px;color:var(--tx);cursor:pointer">'
    + '<b>🔄 Solicitar cambio de turno</b><br><span style="font-size:11px;color:var(--tx3);font-weight:400">Pide el cambio a un compañero por correo</span></button>'
    + '<button onclick="_abrirCambioTipoTurno()" style="width:100%;text-align:left;padding:14px;background:var(--s2);border:1px solid var(--div);border-radius:12px;color:var(--tx);cursor:pointer">'
    + '<b>🔁 Cambiar tipo de turno</b><br><span style="font-size:11px;color:var(--tx3);font-weight:400">Pásalo a Ordinario, Art.51/52 o HTDL sin borrarlo</span></button>'
    + '</div>';
  openOv('ov-cambio');
}

function _abrirSolicitudCambioTurno(){
  if(!selDay)return;
  var t=selDay.t||{},k=selDay.k;
  var kw=k.split('-').map(Number);var y=kw[0],mo=kw[1],dd=kw[2];
  var wd=(new Date(y,mo-1,dd).getDay()+6)%7;
  var fL=DIAS_L[wd]+', '+dd+' de '+MESES[mo-1].toLowerCase()+' de '+y;
  var tL=(TIPO_INFO[t.tipo]?TIPO_INFO[t.tipo].lbl:'Sin tipo')||'Sin tipo';
  document.getElementById('cambio-tit').textContent='🔄 Solicitar Cambio de Turno';
  var tH=t.numTren?'<div style="font-size:20px;font-weight:900;color:var(--nar2)">🚆 #'+t.numTren+'</div>'
    :'<div style="font-size:10px;color:var(--amber2);margin-top:2px">⚠️ Sin numero de tren - edita para añadir</div>';
  var rH=(t.sal||t.lle)?'<div style="font-size:11px;color:var(--tx2);margin-top:2px">'+(t.sal||'—')+' '+(t.lle?'→ '+t.lle:'')+'</div>':'';
  var wH=(!AJ.nombre||!AJ.matricula)?'<div style="font-size:9px;color:var(--amber2);margin-top:3px">⚠️ Configura nombre y matricula en Ajustes</div>':'';
  document.getElementById('cambio-body').innerHTML=
    '<div style="padding:14px 16px">'
    +'<div style="background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.2);border-radius:12px;padding:11px 13px;margin-bottom:14px">'
    +'<div style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--acc2);margin-bottom:5px">MI TURNO</div>'
    +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">'
    +'<span style="font-size:12px;color:var(--tx2)">'+fL+'</span>'
    +'<span style="font-size:9px;color:var(--tx3);background:var(--s2);padding:1px 7px;border-radius:6px">'+tL+'</span></div>'
    +tH+rH
    +'<div style="font-size:10px;color:var(--tx3);margin-top:3px">👤 '+(AJ.nombre||'—')+' · 🪪 '+(AJ.matricula||'—')+'</div>'+wH+'</div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
    +'<div style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--tx3)">DATOS DEL COMPAÑERO</div>'
    +'<button onclick="abrirAgenda()" style="background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.3);border-radius:8px;color:var(--acc2);font-size:11px;font-weight:700;padding:4px 10px;cursor:pointer">📒 Agenda</button></div>'
    +'<div style="position:relative;margin-bottom:7px"><div class="aj-nombre-wrap"><span class="aj-nombre-ico">👤</span>'
    +'<input id="cbio-nombre" class="aj-nombre-inp" placeholder="Nombre completo" oninput="actualizarPrevCambio();sugerirContacto(\'nombre\',this.value)" autocomplete="off"></div>'
    +'<div id="sug-nombre" class="sug-box" style="display:none"></div></div>'
    +'<div style="position:relative;margin-bottom:7px"><div class="aj-nombre-wrap"><span class="aj-nombre-ico">🪪</span>'
    +'<input id="cbio-mat" class="aj-nombre-inp" placeholder="Matricula del companero" oninput="actualizarPrevCambio();sugerirContacto(\'mat\',this.value)" autocomplete="off"></div>'
    +'<div id="sug-mat" class="sug-box" style="display:none"></div></div>'
    +'<div class="aj-nombre-wrap" style="margin-bottom:14px"><span class="aj-nombre-ico">🚆</span>'
    +'<input id="cbio-tren" class="aj-nombre-inp" inputmode="numeric" placeholder="Num tren del companero" oninput="actualizarPrevCambio()" style="font-size:15px;font-weight:800"></div>'
    +'<div style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--tx3);margin-bottom:6px">VISTA PREVIA</div>'
    +'<div id="cbio-prev" style="background:var(--s2);border:1px solid var(--div);border-radius:10px;padding:11px 13px;font-size:11px;color:var(--tx2);line-height:1.65;margin-bottom:14px;white-space:pre-wrap;max-height:150px;overflow-y:auto"></div>'
    +'<button onclick="enviarCambio()" style="width:100%;padding:14px;background:linear-gradient(135deg,var(--nar),var(--nar2));border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:var(--sh-nar)">✉️ Abrir en Correo</button>'
    +'<div style="font-size:9px;color:var(--tx3);text-align:center;margin-top:7px">Abre tu app de correo con el mensaje completo</div>'
    +'<div style="height:1px;background:var(--div);margin:16px 0"></div>'
    +'<button onclick="abrirRegistrarIntercambio()" style="width:100%;padding:12px;background:var(--s2);'
    +'border:1.5px dashed var(--div);border-radius:11px;color:var(--tx2);font-size:12px;font-weight:700;cursor:pointer">'
    +'🔁 Registrar Intercambio</button>'
    +'</div>';
  actualizarPrevCambio();
}

function _abrirCambioTipoTurno(){
  if(!selDay) return;
  var k = selDay.k;
  var t = TV[k];
  if(!t){ toast('⚠️ No hay turno guardado este día'); return; }
  var esDerivado = (t.tipo==='vuelta-pernocta' || t.tipo==='pernocta3-intermedio');
  var kReal = esDerivado ? t.origenPernocta : k;
  var tReal = esDerivado ? TV[kReal] : t;
  if(!tReal){ toast('⚠️ No se encontró el turno de origen de la pernocta'); return; }
  if(tReal.tipo!=='ordinario' && tReal.tipo!=='trabajado' && tReal.tipo!=='art5152'){
    toast('⚠️ Este tipo de día no se puede reclasificar así');
    return;
  }
  var dias = (tReal.modo==='pernocta3') ? 3 : (tReal.modo==='pernocta') ? 2 : 1;
  _cambioTipoOrigen = {k:kReal, t:tReal, dias:dias};

  document.getElementById('cambio-tit').textContent = '¿A qué tipo lo cambiamos?';
  document.getElementById('cambio-body').innerHTML =
    '<div style="padding:14px 16px">'
    + '<button onclick="_elegirTipoCambioEstado(\'ordinario\')" style="width:100%;margin-bottom:8px;text-align:left;padding:14px;background:var(--s2);border:1px solid var(--div);border-radius:12px;color:var(--tx);cursor:pointer">'
    + '<b>Ordinario</b><br><span style="font-size:11px;color:var(--tx3);font-weight:400">Jornada normal de trabajo</span></button>'
    + '<button onclick="_elegirTipoCambioEstado(\'art5152\')" style="width:100%;margin-bottom:8px;text-align:left;padding:14px;background:var(--s2);border:1px solid var(--div);border-radius:12px;color:var(--tx);cursor:pointer">'
    + '<b>Art. 51/52</b><br><span style="font-size:11px;color:var(--tx3);font-weight:400">Régimen especial de descanso</span></button>'
    + '<button onclick="_elegirTipoCambioEstado(\'htdl\')" style="width:100%;text-align:left;padding:14px;background:var(--s2);border:1px solid var(--div);border-radius:12px;color:var(--tx);cursor:pointer">'
    + '<b>HTDL</b><br><span style="font-size:11px;color:var(--tx3);font-weight:400">Trabajado en día libre</span></button>'
    + '</div>';
}

function _elegirTipoCambioEstado(tipoElegido){
  _cambioTipoElegido = tipoElegido;
  if(tipoElegido==='art5152' || tipoElegido==='htdl'){
    var esPernocta = _cambioTipoOrigen.dias>1;
    document.getElementById('cambio-tit').textContent = '¿Cómo se compensa?';
    document.getElementById('cambio-body').innerHTML =
      '<div style="padding:14px 16px">'
      + '<button onclick="_aplicarCambioTipoTurno(\'dinero\')" style="width:100%;margin-bottom:8px;text-align:left;padding:14px;background:var(--s2);border:1px solid var(--div);border-radius:12px;color:var(--tx);cursor:pointer">'
      + '<b>Dinero</b><br><span style="font-size:11px;color:var(--tx3);font-weight:400">Se paga directamente</span></button>'
      + '<button onclick="_abrirFormParaCambioTipo(\'dias\')" style="width:100%;'+(esPernocta?'margin-bottom:8px;':'')+'text-align:left;padding:14px;background:var(--s2);border:1px solid var(--div);border-radius:12px;color:var(--tx);cursor:pointer">'
      + '<b>Días</b><br><span style="font-size:11px;color:var(--tx3);font-weight:400">Genera día(s) libres el mes siguiente</span></button>'
      + (esPernocta ? ('<button onclick="_abrirFormParaCambioTipo(\'mix\')" style="width:100%;text-align:left;padding:14px;background:var(--s2);border:1px solid var(--div);border-radius:12px;color:var(--tx);cursor:pointer">'
        + '<b>Mixto</b><br><span style="font-size:11px;color:var(--tx3);font-weight:400">Parte dinero, parte días</span></button>') : '')
      + '</div>';
  } else {
    _aplicarCambioTipoTurno(null);
  }
}

// "Dinero" (u Ordinario, que no necesita compensación): se aplica
// directamente sobre el mismo día, sin abrir el formulario completo.
function _aplicarCambioTipoTurno(modoComp){
  var o = _cambioTipoOrigen.t;
  var k = _cambioTipoOrigen.k;
  var dias = _cambioTipoOrigen.dias;
  var esHTDL = (_cambioTipoElegido==='htdl');
  var esArt5152 = (_cambioTipoElegido==='art5152');
  var tipoFinal = esHTDL ? 'trabajado' : _cambioTipoElegido;

  var nuevo = {}; for(var campo in o) nuevo[campo]=o[campo];
  nuevo.tipo = tipoFinal;
  if(modoComp==='dinero') _aplicarDineroCopia(nuevo, esHTDL, esArt5152, dias>1);
  else { delete nuevo.comp; delete nuevo.compensacion; delete nuevo.importe; delete nuevo.horasEfectivas; }

  TV[k] = nuevo;
  saveTV();
  closeOv('ov-cambio');
  renderCal(); renderStats();
  selDay = {d:selDay.d, k:selDay.k, t:TV[selDay.k]};
  renderDiaArea();
  toast('✅ Turno actualizado a '+(TIPO_INFO[tipoFinal]?TIPO_INFO[tipoFinal].lbl:tipoFinal));
}

// "Días"/"Mixto": igual que en "Copiar turno", se enruta al
// formulario real (mismo mini-calendario de compensación ya
// probado) — pre-rellenado y apuntando al MISMO día, no a uno nuevo.
function _abrirFormParaCambioTipo(modoComp){
  closeOv('ov-cambio');
  var o = _cambioTipoOrigen.t;
  var k = _cambioTipoOrigen.k;
  var tipoFinal = (_cambioTipoElegido==='htdl') ? 'trabajado' : 'art5152';
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

  selDay = {d:selDay.d, k:k, t:TV[k]};
  abrirForm(true);
  toast('📋 Elige el/los día(s) de compensación y guarda');
} // idaVuelta | pernocta2 | pernocta3

function abrirRegistrarIntercambio(){
  var pop1 = document.getElementById('ov-cambio');
  if(pop1) pop1.classList.add('standby');

  // Autocompletar Nombre/Matrícula/Tren desde el Pop-up 1
  var nombre = (document.getElementById('cbio-nombre')||{}).value || '';
  var mat = (document.getElementById('cbio-mat')||{}).value || '';
  var tren = (document.getElementById('cbio-tren')||{}).value || '';
  var elN = document.getElementById('reg-interc-nombre'); if(elN) elN.value = nombre;
  var elM = document.getElementById('reg-interc-mat'); if(elM) elM.value = mat;
  var elT = document.getElementById('reg-interc-tren'); if(elT) elT.value = tren;

  _intercambioTipoServicio = 'idaVuelta';
  _pintarSeleccionTipoServicioIntercambio();
  _renderDiasIntercambio();

  openOvTop('ov-registrar-intercambio');
}

function cerrarRegistrarIntercambio(){
  closeOv('ov-registrar-intercambio');
  var pop1 = document.getElementById('ov-cambio');
  if(pop1) pop1.classList.remove('standby');
}

function seleccionarTipoServicioIntercambio(tipo){
  _intercambioTipoServicio = tipo;
  _pintarSeleccionTipoServicioIntercambio();
  _renderDiasIntercambio();
}

function _pintarSeleccionTipoServicioIntercambio(){
  ['idaVuelta','pernocta2','pernocta3'].forEach(function(tipo){
    var btn = document.getElementById('reg-interc-tipo-'+tipo);
    if(!btn) return;
    var activo = (tipo===_intercambioTipoServicio);
    btn.style.background = activo ? 'rgba(245,158,11,.15)' : 'var(--s2)';
    btn.style.borderColor = activo ? 'var(--amber2)' : 'var(--div)';
    btn.style.color = activo ? 'var(--amber2)' : 'var(--tx2)';
  });
}

function _numDiasIntercambio(){
  if(_intercambioTipoServicio==='pernocta3') return 3;
  if(_intercambioTipoServicio==='pernocta2') return 2;
  return 2; // Ida y Vuelta: DOS tramos (ida + vuelta), aunque sea el mismo día —
            // antes devolvía 1 y la vuelta nunca tenía dónde guardarse.
}

// Etiqueta de cada bloque según el tipo de servicio: en Ida y Vuelta
// son "IDA"/"VUELTA" (mismo día, dos tramos); en pernocta son días
// de calendario reales ("DÍA 1", "DÍA 2"...).
function _etiquetaTramoIntercambio(idx){
  if(_intercambioTipoServicio==='idaVuelta') return idx===0 ? 'IDA' : 'VUELTA';
  return 'DÍA '+(idx+1);
}

// Despliega dinámicamente 2 o 3 bloques según el tipo de servicio
// elegido — nunca un número fijo de campos.
function _renderDiasIntercambio(){
  var cont = document.getElementById('reg-interc-dias');
  if(!cont) return;
  var n = _numDiasIntercambio();
  var html = '';
  // Etiqueta del TREN de cada tramo — distinta de la etiqueta del bloque
  // (que ya usa _etiquetaTramoIntercambio para IDA/VUELTA o DÍA N):
  // siempre "Tren Ida" en el primer tramo y "Tren Vuelta" en el último,
  // para que el usuario entienda de un vistazo qué tren es cada uno,
  // sea cual sea el tipo de servicio elegido. El tramo intermedio de
  // Pernocta 3 días (tránsito) usa "Tren Día 2".
  var etiquetaTren = function(idx){
    if(idx===0) return 'Tren Ida';
    if(idx===n-1) return 'Tren Vuelta';
    return 'Tren Día '+(idx+1);
  };
  for(var i=1; i<=n; i++){
    html += '<div style="background:var(--s2);border:1px solid var(--div);border-radius:11px;padding:12px;margin-bottom:10px">'
      + '<div style="font-size:10px;font-weight:800;letter-spacing:.5px;color:var(--tx3);margin-bottom:8px">'+_etiquetaTramoIntercambio(i-1)+'</div>'
      + '<div style="margin-bottom:7px"><div class="aj-nombre-wrap"><span class="aj-nombre-ico">🚆</span>'
      + '<input id="reg-interc-tren-'+i+'" class="aj-nombre-inp" inputmode="numeric" placeholder="'+etiquetaTren(i-1)+'" style="font-size:14px;font-weight:800" oninput="autocompletarTramoIntercambio('+i+')"></div></div>'
      + '<div style="display:flex;gap:7px;margin-bottom:7px">'
      + '<input id="reg-interc-est-ini-'+i+'" placeholder="Estación inicio" style="flex:1;background:var(--s1);'
      + 'border:1.5px solid var(--div);border-radius:9px;color:var(--tx);font-size:12px;padding:9px 10px;outline:none">'
      + '<input id="reg-interc-est-fin-'+i+'" placeholder="Estación final" style="flex:1;background:var(--s1);'
      + 'border:1.5px solid var(--div);border-radius:9px;color:var(--tx);font-size:12px;padding:9px 10px;outline:none">'
      + '</div>'
      + '<div style="display:flex;gap:7px">'
      + '<input id="reg-interc-hini-'+i+'" type="time" style="flex:1;background:var(--s1);border:1.5px solid var(--div);'
      + 'border-radius:9px;color:var(--tx);font-size:13px;padding:9px 10px;outline:none;text-align:center;font-family:inherit;color-scheme:dark">'
      + '<input id="reg-interc-hfin-'+i+'" type="time" style="flex:1;background:var(--s1);border:1.5px solid var(--div);'
      + 'border-radius:9px;color:var(--tx);font-size:13px;padding:9px 10px;outline:none;text-align:center;font-family:inherit;color-scheme:dark">'
      + '</div>'
      + '</div>';
  }
  cont.innerHTML = html;
  // Primer tramo (Ida): si el usuario ya escribió un tren "general"
  // arriba (reg-interc-tren, autocompletado desde el Pop-up 1), se
  // precarga aquí como punto de partida — nunca se pierde ese dato.
  var trenGeneralEl = document.getElementById('reg-interc-tren');
  var trenIdaEl = document.getElementById('reg-interc-tren-1');
  if(trenGeneralEl && trenIdaEl && trenGeneralEl.value.trim() && !trenIdaEl.value){
    trenIdaEl.value = trenGeneralEl.value.trim();
  }
}

async function guardarRegistroIntercambio(){
  if(!selDay) return;
  var nombreEl = document.getElementById('reg-interc-nombre');
  var matEl = document.getElementById('reg-interc-mat');
  var trenEl = document.getElementById('reg-interc-tren');
  var nombre = nombreEl ? nombreEl.value.trim() : '';
  var mat = matEl ? matEl.value.trim() : '';
  var tren = trenEl ? trenEl.value.trim() : '';
  // NUEVO — si estaba marcada, se guarda la nota "compañero tenía
  // descanso" junto al registro. El turno original tuyo (TV[k]) NUNCA
  // se toca por esto — sigue contando sus horas exactamente igual.
  var companeroDescansoEl = document.getElementById('reg-interc-companero-descanso');
  var companeroTeniaDescanso = !!(companeroDescansoEl && companeroDescansoEl.checked);

  if(!nombre){ if(nombreEl){nombreEl.style.borderColor='#ef4444';setTimeout(function(){nombreEl.style.borderColor='';},1500);} return; }
  if(!tren){ if(trenEl){trenEl.style.borderColor='#ef4444';setTimeout(function(){trenEl.style.borderColor='';},1500);} return; }

  // Array de tramos — nunca un objeto único. Antes, "Ida y Vuelta"
  // solo generaba 1 bloque de campos, así que al guardar solo existía
  // un tramo (la ida) y la vuelta no tenía dónde quedar registrada.
  // Ahora se recorren SIEMPRE los N bloques reales que hay en el DOM
  // (2 en Ida y Vuelta, 2 o 3 en pernocta) y se guardan todos juntos.
  var n = _numDiasIntercambio();
  var tramos = [];
  for(var i=1; i<=n; i++){
    var trenTramoEl = document.getElementById('reg-interc-tren-'+i);
    var estIniEl = document.getElementById('reg-interc-est-ini-'+i);
    var estFinEl = document.getElementById('reg-interc-est-fin-'+i);
    var hIniEl = document.getElementById('reg-interc-hini-'+i);
    var hFinEl = document.getElementById('reg-interc-hfin-'+i);
    tramos.push({
      etiqueta: _etiquetaTramoIntercambio(i-1),
      tren: (trenTramoEl?trenTramoEl.value.trim():'') || null,
      estacionInicio: (estIniEl?estIniEl.value.trim():'') || null,
      estacionFinal: (estFinEl?estFinEl.value.trim():'') || null,
      horaInicio: (hIniEl?hIniEl.value:'') || null,
      horaFinal: (hFinEl?hFinEl.value:'') || null
    });
  }

  var k = selDay.k;
  var ultimoTramo = tramos.length ? tramos[tramos.length-1] : null;

  // ── DESGLOSE ESTRUCTURADO DE TRENES ──────────────────────────
  // Tren_Ida = primer tramo, Tren_Vuelta = segundo tramo, y
  // Tren_Dia3 = tercer tramo SOLO si aplica (Pernocta 3 días).
  // Si el usuario no rellenó el tren de un tramo concreto, se cae
  // en el campo general "tren" (reg-interc-tren) para no perder el
  // dato ya escrito arriba.
  var trenes = {
    ida: (tramos[0] && tramos[0].tren) || tren || null,
    vuelta: (tramos[1] && tramos[1].tren) || null
  };
  if(n===3) trenes.dia3 = (tramos[2] && tramos[2].tren) || null;

  // ── VALIDACIÓN DE JORNADA (peso del turno) ──────────────────
  // Compara el "peso" del turno PROPIO (selDay.t.modo: ida | pernocta |
  // pernocta3 — el mismo campo que ya usa el resto de la app, ver
  // esPernocta más arriba) con el tipo de servicio elegido para el
  // compañero (_intercambioTipoServicio: idaVuelta | pernocta2 | pernocta3).
  // Si no coinciden (ej: tu turno es Ida y Vuelta pero registras un
  // Pernocta para el compañero), NO se bloquea el guardado — solo se
  // marca el registro con avisoDesajuste=true (para el historial) y se
  // avisa al final con un toast, tal y como ya hace esta función con
  // el resto de avisos no bloqueantes.
  var miTurno = selDay.t || {};
  var MODO_A_SERVICIO = {ida:'idaVuelta', pernocta:'pernocta2', pernocta3:'pernocta3'};
  var miServicioEquivalente = MODO_A_SERVICIO[miTurno.modo] || null;
  var hayDesajuste = !!(miServicioEquivalente && miServicioEquivalente !== _intercambioTipoServicio);

  var esPernoctaRegistro = (_intercambioTipoServicio==='pernocta2' || _intercambioTipoServicio==='pernocta3');

  if(esPernoctaRegistro){
    // PERNOCTA: cada tramo se guarda en la fecha de calendario que le
    // corresponde de verdad (día 1 en k, día 2 en k+1, etc.) — ver
    // registrarTurnoPernocta(). No se usa el guardado de "un solo día"
    // de más abajo para este caso.
    registrarTurnoPernocta(k, tramos, {
      notas: 'Referencia informativa (cambio) con '+nombre,
      companeroNombre: nombre,
      companeroMatricula: mat,
      tipoServicio: _intercambioTipoServicio,
      avisoDesajuste: hayDesajuste,
      companeroTeniaDescanso: companeroTeniaDescanso
    });
  } else {
    // IDA Y VUELTA (mismo día): comportamiento existente, sin cambios.
    var dd = {
      tipo: 'ordinario',
      // Se reutilizan numTren/numTrenVuelta — los MISMOS campos que ya
      // sabe pintar renderTarjetaTurno() como filas "TREN IDA"/"TREN
      // VUELTA" para un turno normal — así el historial muestra el
      // desglose preciso sin duplicar ninguna lógica de renderizado.
      numTren: trenes.ida,
      numTrenVuelta: trenes.vuelta,
      hF: tramos[0] ? tramos[0].horaInicio : null,
      hL: tramos[0] ? tramos[0].horaFinal : null,
      // hL2: fin real del ÚLTIMO tramo del bloque (la vuelta) —
      // checkRestTime ya prioriza hL2 sobre hL como "fin de la
      // jornada" para el chequeo de descanso con el turno siguiente.
      hL2: (tramos.length>1 && ultimoTramo) ? ultimoTramo.horaFinal : null,
      notas: 'Referencia informativa (cambio) con '+nombre,
      turno_referencia_externa: true,
      companeroNombre: nombre,
      companeroMatricula: mat,
      companeroTren: trenes.ida,
      tipoServicio: _intercambioTipoServicio,
      companeroTeniaDescanso: companeroTeniaDescanso,
      // Desglose estructurado — Tren_Ida / Tren_Vuelta. Es la fuente
      // que lee el correo (generarMensajeCambio) para redactar de
      // forma natural, y la que usa el historial.
      trenes: trenes,
      // Ambos tramos (ida+vuelta) se guardan JUNTOS bajo esta misma
      // clave — un único registro de referencia, mismo día.
      tramos: tramos,
      // Etiqueta de aviso para el historial — ver renderTarjetaTurno().
      avisoDesajuste: hayDesajuste
    };
    if(!TV2[k]) TV2[k] = [];
    TV2[k].push(dd);
    saveTV2();

    verificarEnlaceTurnoIntercambiado(k, dd);
  }

  renderCal();
  renderDiaArea();
  cerrarRegistrarIntercambio();

  if(hayDesajuste){
    var SERVICIO_LBL = {idaVuelta:'Ida y Vuelta', pernocta2:'Pernocta 2 días', pernocta3:'Pernocta 3 días'};
    toast('⚠️ Aviso de Desajuste: tu turno es "'+(SERVICIO_LBL[miServicioEquivalente]||miTurno.modo)+'" y registraste "'+(SERVICIO_LBL[_intercambioTipoServicio]||_intercambioTipoServicio)+'" para el compañero. Guardado igualmente — revisa si es correcto.');
  } else if(esPernoctaRegistro){
    toast('📎 Pernocta guardada — un registro por cada día, no computa en tus horas');
  } else {
    toast('📎 Referencia informativa guardada — no computa en tus horas');
  }
}

/* ═══════════════════════════════════════════════════════════
   registrarTurnoPernocta() — FUNCIÓN AUXILIAR NUEVA Y AISLADA.
   Distribuye los tramos de una Pernocta (2 o 3 días) en la fecha
   de calendario real que le corresponde a cada uno, en vez de
   agruparlos todos bajo el día en que se abrió el formulario.
   No toca ni reutiliza el guardado de "Ida y Vuelta" (mismo día),
   que sigue intacto dentro de guardarRegistroIntercambio().
   Puramente informativo: cada entrada se guarda en TV2 (nunca en
   TV) con turno_referencia_externa=true, así que
   calcularJornadaDiaria() la sigue excluyendo del cálculo de horas
   exactamente igual que cualquier otra referencia — esa función no
   se toca ni se necesita tocar.
═══════════════════════════════════════════════════════════ */
function registrarTurnoPernocta(kInicio, tramos, datosComunes){
  var partes = kInicio.split('-').map(Number);
  var dtBase = new Date(partes[0], partes[1]-1, partes[2]);
  var entradas = []; // {k, dd} de cada día, en orden — para el chequeo de enlace de descanso

  tramos.forEach(function(tramo, idx){
    // Salto de fecha: día 0 = kInicio, día 1 = kInicio+1, día 2 =
    // kInicio+2 — el mismo criterio +1/+2 día que ya usa el resto de
    // la app para pernoctas (ver dtVuelta.setDate(...+1) / (...+2)
    // en la lógica de creación de turnos propios).
    var dtDia = new Date(dtBase);
    dtDia.setDate(dtDia.getDate() + idx);
    var kDia = key(dtDia.getFullYear(), dtDia.getMonth()+1, dtDia.getDate());

    var dd = {
      tipo: 'ordinario',
      // OJO: aquí NO se usa numTren/numTrenVuelta (los campos
      // genéricos que sí se reutilizan en el caso "Ida y Vuelta"
      // mismo día). Cada entrada de una pernocta es UN solo día, así
      // que etiquetarlo siempre como "TREN IDA" sería incorrecto en
      // el día de vuelta o en el día intermedio. El tren de este día
      // se muestra en su lugar dentro de la fila del tramo (ver
      // renderTarjetaTurno → tramos.forEach), que ya usa la etiqueta
      // correcta (IDA / VUELTA / DÍA N) guardada en tramo.etiqueta.
      hF: tramo.horaInicio,
      hL: tramo.horaFinal,
      notas: datosComunes.notas,
      turno_referencia_externa: true,
      companeroNombre: datosComunes.companeroNombre,
      companeroMatricula: datosComunes.companeroMatricula,
      companeroTren: tramo.tren,
      tipoServicio: datosComunes.tipoServicio,
      companeroTeniaDescanso: !!datosComunes.companeroTeniaDescanso,
      // Solo el tramo de ESTE día — ya vive en su propia fecha, no
      // hace falta repetir el array completo de los demás días.
      tramos: [tramo],
      // El aviso de desajuste (si lo hay) solo se muestra una vez,
      // en el primer día, para no repetir la misma advertencia N
      // veces en el historial.
      avisoDesajuste: idx===0 ? !!datosComunes.avisoDesajuste : false
    };

    if(!TV2[kDia]) TV2[kDia] = [];
    TV2[kDia].push(dd);
    entradas.push({k:kDia, dd:dd});
  });

  saveTV2();

  // Chequeo de enlace de descanso — se reutiliza la función EXISTENTE
  // (sin tocarla), aplicada a los dos extremos reales de la pernocta:
  // el primer día (enlace con el turno propio del día anterior) y el
  // último día (enlace con el turno propio del día siguiente).
  if(entradas.length){
    verificarEnlaceTurnoIntercambiado(entradas[0].k, entradas[0].dd);
    if(entradas.length>1){
      verificarEnlaceTurnoIntercambiado(entradas[entradas.length-1].k, entradas[entradas.length-1].dd);
    }
  }
}

// Comprueba el enlace de descanso entre el turno intercambiado recién
// guardado y los turnos ORIGINALES tuyos del día anterior/siguiente.
// Si detecta que uno de los dos lados del enlace es un turno
// intercambiado, el aviso "no computa (Turno de cambio)" tiene
// prioridad sobre cualquier otra clasificación — ver
// calcularEnlaceJornada(), que ya centraliza esa regla.
function verificarEnlaceTurnoIntercambiado(k, turnoIntercambiado){
  var partes = k.split('-').map(Number);
  var dtHoy = new Date(partes[0], partes[1]-1, partes[2]);
  var dtAyer = new Date(dtHoy); dtAyer.setDate(dtAyer.getDate()-1);
  var dtManana = new Date(dtHoy); dtManana.setDate(dtManana.getDate()+1);
  var kAyer = key(dtAyer.getFullYear(), dtAyer.getMonth()+1, dtAyer.getDate());
  var kManana = key(dtManana.getFullYear(), dtManana.getMonth()+1, dtManana.getDate());

  var avisos = [];
  if(TV[kAyer]){
    var enlaceAntes = calcularEnlaceJornada(TV[kAyer], turnoIntercambiado, kAyer, k);
    if(enlaceAntes.incumple && enlaceAntes.avisoNoComputa) avisos.push(enlaceAntes.avisoNoComputa);
  }
  if(TV[kManana]){
    var enlaceDespues = calcularEnlaceJornada(turnoIntercambiado, TV[kManana], k, kManana);
    if(enlaceDespues.incumple && enlaceDespues.avisoNoComputa) avisos.push(enlaceDespues.avisoNoComputa);
  }
  if(avisos.length) toast('⚠️ '+avisos[0]);
}

// Une varios números de tren de forma natural para el texto del correo
// ("621 y 634" / "621, 634 y 812") — nunca con separadores técnicos
// como guiones ("621 - 634"). La usan tanto la vista previa como el
// envío real, para que ambas coincidan y no se dupliquen dos criterios
// distintos de redacción.
function _unirTrenesNatural(lista){
  var trenes = (lista||[]).filter(Boolean);
  if(trenes.length===0) return '';
  if(trenes.length===1) return trenes[0];
  return trenes.slice(0,-1).join(', ')+' y '+trenes[trenes.length-1];
}

// Busca si ya existe una Referencia Informativa (Registrar Intercambio)
// guardada en TV2 para este mismo día y compañero, y si tiene el
// desglose estructurado de trenes (trenes.ida/vuelta/dia3). Se usa
// para redactar el correo con los trenes reales del compañero sin
// tener que volver a pedirlos — reutiliza el dato ya guardado.
function _trenesCompaneroGuardados(k, nombre, mat){
  var ref = (TV2[k]||[]).filter(function(r){
    return r.turno_referencia_externa && r.trenes
      && ((nombre && r.companeroNombre===nombre) || (mat && r.companeroMatricula===mat));
  }).pop();
  if(!ref) return null;
  return [ref.trenes.ida, ref.trenes.vuelta, ref.trenes.dia3];
}

function actualizarPrevCambio(){
  var t=(selDay&&selDay.t)||{};
  var k=selDay?selDay.k:null;
  if(!k) return;
  var _kf1=k.split('-').map(Number);var y=_kf1[0],mo=_kf1[1],dd=_kf1[2];
  var fstr = dd+' de '+MESES[mo-1].toLowerCase()+' de '+y;
  var hora = new Date().getHours();
  var saludo = hora<13?'buenos días':hora<20?'buenas tardes':'buenas noches';
  var nombre   = (document.getElementById('cbio-nombre')?document.getElementById('cbio-nombre').value.trim():'[Nombre compañero]');
  var mat      = (document.getElementById('cbio-mat')?document.getElementById('cbio-mat').value.trim():'[Matrícula]');
  var trenComp = (document.getElementById('cbio-tren')?document.getElementById('cbio-tren').value.trim():'[Nº tren]');
  var trenesGuardados = _trenesCompaneroGuardados(k, nombre, mat);
  if(trenesGuardados) trenComp = _unirTrenesNatural(trenesGuardados) || trenComp;
  var miNombre = AJ.nombre||'[Mi nombre]';
  var miMat    = AJ.matricula||'[Mi matrícula]';
  var miTrenesIda = [t.numTren].concat((t.continuidad||[]).map(function(c){return c.tren;})).filter(Boolean);
  var miTrenesVuelta = [t.numTrenVuelta].concat((t.continuidadVuelta||[]).map(function(c){return c.tren;})).filter(Boolean);
  var miTren   = _unirTrenesNatural(miTrenesIda.concat(miTrenesVuelta)) || '[Mi Nº tren]';
  var prev = document.getElementById('cbio-prev');
  if(prev) prev.textContent = generarMensajeCambio({fstr,miTren,nombre,mat,trenComp,miNombre,miMat,saludo});
}

function generarMensajeCambio(params){
  var fstr=params.fstr,miTren=params.miTren,nombre=params.nombre,mat=params.mat;
  var trenComp=params.trenComp,miNombre=params.miNombre,miMat=params.miMat,saludo=params.saludo;
  return generarCuerpoCorreo({
    saludo: 'Hola, '+saludo,
    mensaje: 'Me gustaria solicitar un cambio de turno para el dia '+fstr+'.\n\n'
      +'Quiero intercambiar mi turno '+miTren+' con la companera '+nombre+' (Matricula: '+mat+'), '
      +'quien realiza el servicio en el tren '+trenComp+'.\n\n'
      +'Yo realizare su turno y ella realizara el mio. Quedo a la espera de su aprobacion.',
    mostrarTren: false,
    firma: miNombre,
    matricula: miMat
  });
}

function enviarCambio(){
  // VALIDACIÓN LISTA NEGRA — capa extra, no bloqueante por sí sola.
  // Se ejecuta antes de tomar los datos para el correo, exactamente
  // como se pidió. Si no hay coincidencia, sigue el flujo normal sin
  // ningún retraso ni cambio de comportamiento.
  var nombreChk = (document.getElementById('cbio-nombre')?document.getElementById('cbio-nombre').value.trim():'');
  var matChk    = (document.getElementById('cbio-mat')?document.getElementById('cbio-mat').value.trim():'');
  var bloqueado = esCompaneroBloqueado(matChk) || esCompaneroBloqueado(nombreChk);
  if(bloqueado){
    mostrarAvisoListaNegra(bloqueado, function(){ _ejecutarEnvioCambio(); });
    return;
  }
  _ejecutarEnvioCambio();
}

// Lógica original de enviarCambio(), sin alterar ni una línea — solo
// se trasladó dentro de esta función para que la validación de arriba
// pueda decidir si la ejecuta inmediatamente o tras la confirmación.
function _ejecutarEnvioCambio(){
  var t=(selDay&&selDay.t)||{};
  var k=selDay?selDay.k:null;
  if(!k) return;
  var _kf2=k.split('-').map(Number);var y=_kf2[0],mo=_kf2[1],dd=_kf2[2];
  var fstr   = dd+' de '+MESES[mo-1].toLowerCase()+' de '+y;
  var hora   = new Date().getHours();
  var saludo = hora<13?'buenos días':hora<20?'buenas tardes':'buenas noches';
  var nombre   = (document.getElementById('cbio-nombre')?document.getElementById('cbio-nombre').value.trim():'—');
  var mat      = (document.getElementById('cbio-mat')?document.getElementById('cbio-mat').value.trim():'—');
  var trenComp = (document.getElementById('cbio-tren')?document.getElementById('cbio-tren').value.trim():'—');
  var trenesGuardados = _trenesCompaneroGuardados(k, nombre, mat);
  if(trenesGuardados) trenComp = _unirTrenesNatural(trenesGuardados) || trenComp;
  var miNombre = AJ.nombre||'—';
  var miMat    = AJ.matricula||'—';
  var miTrenesIda = [t.numTren].concat((t.continuidad||[]).map(function(c){return c.tren;})).filter(Boolean);
  var miTrenesVuelta = [t.numTrenVuelta].concat((t.continuidadVuelta||[]).map(function(c){return c.tren;})).filter(Boolean);
  var miTren   = _unirTrenesNatural(miTrenesIda.concat(miTrenesVuelta)) || '—';
  var asunto   = encodeURIComponent('Solicitud de Cambio de Turno - Tren '+miTren+' - '+fstr);
  var cuerpo   = encodeURIComponent(sanitizarTexto(generarMensajeCambio({fstr,miTren,nombre,mat,trenComp,miNombre,miMat,saludo})));
  // Marcar que se solicitó cambio en este turno (persiste en localStorage)
  if(TV[k]){ TV[k].cambioSolicitado=true; saveTV(); renderDiaArea(); renderAcordeon(); }

  // FIX CORREO VACÍO: preguntarGuardarContacto() usa confirm() — un diálogo
  // nativo BLOQUEANTE. Antes se ejecutaba 800ms DESPUÉS de mailto:, lo cual
  // podía interrumpir la transición de Android hacia el cliente de correo
  // justo cuando estaba procesando el parámetro body, dejándolo vacío.
  // Ahora se ejecuta ANTES, para que mailto: sea la última acción y no
  // tenga ningún diálogo compitiendo con la entrega del cuerpo del mensaje.
  preguntarGuardarContacto(
    nombre  || '',
    mat     || '',
    trenComp|| ''
  );

  // Abrir correo — ahora es la última acción, sin nada bloqueante después
  window.location.href='mailto:?subject='+asunto+'&body='+cuerpo;
}
