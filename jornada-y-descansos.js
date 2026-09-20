/* TrenTurnos v5 — Descansos, enlaces de jornada y correos por retraso/descanso
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   MIGRACIÓN — Retrasos de pernocta a su celda real.
   Antes, el tramo 2 (vuelta) de una pernocta podía quedar guardado
   en la celda de origen (día 1) en vez de en la celda del día de
   vuelta. Esta función, puramente aditiva, reubica ese dato una
   sola vez: MUEVE el retraso de tramo 2 desde el registro de
   origen hasta el registro de TV[diaSiguiente], y lo retira del
   de origen. Nunca borra información sin haberla copiado antes.
   No toca ningún otro campo ni afecta a los turnos "mismo día".
═══════════════════════════════════════════════════════════ */
function migrarRetrasosPernocta(){
  try{
    var cambios = false;
    Object.keys(TV).forEach(function(k){
      var t = TV[k];
      if(!t) return;
      var esPernocta = (t.tipo==='ordinario'||t.tipo==='trabajado') && (t.modo==='pernocta'||t.modo==='pernocta3');
      if(!esPernocta || !t.diaSiguiente || !TV[t.diaSiguiente]) return;
      if(!t.retrasos || !t.retrasos.length) return;
      var tramo2 = t.retrasos.filter(function(r){ return r.tramo===2; })[0];
      if(!tramo2) return;
      var destino = TV[t.diaSiguiente];
      if(!destino.retrasos) destino.retrasos = [];
      // No sobrescribir si el destino ya tiene su propio tramo 2 registrado.
      var yaExiste = destino.retrasos.some(function(r){ return r.tramo===2; });
      if(!yaExiste){
        destino.retrasos.push({tramo:2, minutos:tramo2.minutos, tren:tramo2.tren||''});
        cambios = true;
      }
      // Retirar el tramo 2 del origen — su lugar correcto es el día de vuelta.
      t.retrasos = t.retrasos.filter(function(r){ return r.tramo!==2; });
      if(t.retrasos.length===0) delete t.retrasos;
      cambios = true;
    });
    if(cambios) saveTV();
  }catch(e){
    console.warn('No se pudo completar la migración de retrasos de pernocta; los datos originales se mantienen intactos.', e);
  }
}

/* ═══════════════════════════════════════
   CALENDARIO
═══════════════════════════════════════ */


/* ═══════════════════════════════════════
   GESTIÓN DE JORNADA
   checkRestTime(turnoA, turnoB) — verifica
   tiempo de descanso entre jornadas.
   Límites: 12h en base · 8h fuera de base
   Retraso: se guarda en TV[k].retrasoMin
═══════════════════════════════════════ */

// ── checkRestTime ─────────────────────────────────────────────
// L-01 FIX: ahora recibe las claves de fecha para calcular
// el descanso real teniendo en cuenta el salto de día.
// Funciona correctamente con pernocta y turnos consecutivos.
function checkRestTime(turnoA,turnoB,keyA,keyB){
  if(!turnoA||!turnoB)return{ok:true};
  var hFA=turnoA.hL2||turnoA.hL,hIB=turnoB.hF;
  if(!hFA||!hIB)return{ok:true};
  var retA=parseInt(turnoA.retrasoMin)||0;
  var toM=function(h){var p=h.split(':').map(Number);return p[0]*60+p[1];};
  var gD=function(k){if(!k)return 0;var p=k.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]).getTime()/(1000*60*1440);};
  var dif=Math.round(gD(keyB)-gD(keyA));
  var dM=(dif*1440+toM(hIB))-(toM(hFA)+retA);
  if(dM<0)dM+=1440;
  var enB=AJ.base&&turnoB.sal===AJ.base,lim=enB?720:480;
  var inc=dM<lim,dH=Math.floor(dM/60),dMin=dM%60,lH=lim/60;
  return{ok:!inc,incumple:inc,descMin:dM,limiteMin:lim,
    descStr:dH+'h '+('0'+dMin).slice(-2)+'m',limStr:lH+'h',esEnBase:enB,
    msg:inc?'⚠️ Solo '+dH+'h '+(dMin>0?dMin+'m ':'')+' de descanso (min. '+lH+'h '+(enB?'en base':'fuera de base')+')'
           :'✅ '+dH+'h '+(dMin>0?dMin+'m ':'')+' de descanso'};
}

/* ═══════════════════════════════════════════════════════════
   calcularEnlaceJornada(turnoA, turnoB, keyA, keyB) — matriz de
   decisión del enlace entre dos jornadas consecutivas. Reutiliza
   checkRestTime() para toda la matemática de descanso (12h en
   base / 8h fuera de base, ya existente) y solo añade la
   clasificación de a qué contador debe ir el tiempo incumplido,
   según un flag de tipo de jornada (Ordinaria / HTDL) de cada lado:

     · Ordinaria + Ordinaria → el descanso incumplido computa como
       Horas de Presencia del cómputo principal.
     · HTDL + HTDL           → el descanso incumplido SÍ computa
       para el pago (se suma al cómputo financiero de HTDL).
     · Ordinaria + HTDL (o al revés) → NO computa para nada; debe
       mostrarse el aviso "Ojo: este enlace no computa para el
       pago/cómputo" junto al popup de falta de descanso.

   No toca TV ni ningún dato guardado — es una función de solo
   lectura que interpreta lo que ya hay.
═══════════════════════════════════════════════════════════ */
// FIX — Confirmado por el usuario: el enlace entre dos días solo
// miraba el turno PRINCIPAL de cada día (TV[k]), ignorando por
// completo los turnos extra guardados en TV2[k]. En un día con más de
// un turno, el que de verdad marca cuándo se terminó de trabajar (o
// cuándo se empezó) puede ser uno de los de TV2, no el principal — así
// que el descanso se calculaba mal, y con él, las horas/el dinero del
// enlace. Estas dos funciones buscan, entre TV[k] y TODOS los de
// TV2[k], cuál es el que de verdad termina más tarde (para el lado que
// sale) o empieza más temprano (para el lado que entra) — sin tocar
// TV/TV2 ni checkRestTime(), solo eligiendo bien qué turno pasarle.
function _turnoFinDelDia(k){
  var candidatos = [TV[k]].concat(TV2[k]||[]).filter(Boolean);
  if(!candidatos.length) return null;
  var mejor = null, mejorMin = null;
  candidatos.forEach(function(t){
    var h = t.hL2||t.hL; if(!h) return;
    var p = h.split(':').map(Number), m = p[0]*60+p[1];
    if(mejorMin===null || m>mejorMin){ mejor=t; mejorMin=m; }
  });
  return mejor || candidatos[0];
}
function _turnoInicioDelDia(k){
  var candidatos = [TV[k]].concat(TV2[k]||[]).filter(Boolean);
  if(!candidatos.length) return null;
  var mejor = null, mejorMin = null;
  candidatos.forEach(function(t){
    var h = t.hF; if(!h) return;
    var p = h.split(':').map(Number), m = p[0]*60+p[1];
    if(mejorMin===null || m<mejorMin){ mejor=t; mejorMin=m; }
  });
  return mejor || candidatos[0];
}

function calcularEnlaceJornada(turnoA, turnoB, keyA, keyB){
  var resultado = checkRestTime(turnoA, turnoB, keyA, keyB);
  if(!turnoA || !turnoB) return resultado;

  resultado.computaPresencia = false;
  resultado.computaFinanciero = false;
  resultado.avisoNoComputa = '';

  // Prioridad absoluta: si cualquiera de los dos lados del enlace es
  // un Turno Intercambiado, nunca computa — ni siquiera aunque ambos
  // sean HTDL. Esta comprobación va ANTES de la matriz Ordinaria/HTDL
  // porque la sustituye por completo cuando aplica.
  if(turnoA.turno_referencia_externa || turnoB.turno_referencia_externa || turnoA.esTurnoIntercambiado || turnoB.esTurnoIntercambiado){
    resultado.tipoEnlace = 'TURNO_INTERCAMBIADO';
    if(resultado.incumple){
      resultado.avisoNoComputa = 'Ojo: Este enlace de jornada no computa para el pago (Turno de cambio).';
    }
    return resultado;
  }

  // FIX — Confirmado por Alex (regla final, más simple que la anterior):
  // solo cuenta el enlace cuando los DOS lados son del MISMO tipo.
  //   · Ordinaria ↔ Ordinaria       → cuenta como Horas de Presencia.
  //   · HTDL ↔ HTDL                 → cuenta económicamente.
  //   · Art.51/52 ↔ Art.51/52       → cuenta económicamente (mismo trato que HTDL).
  //   · Cualquier combinación MIXTA (un lado Ordinaria y el otro
  //     HTDL/Art.51-52, en cualquier orden) → NO cuenta nada, solo el
  //     aviso informativo. Antes "HTDL/Art.51-52 → Ordinaria" sí
  //     computaba económicamente — eso ya no aplica.
  var esHTDL_A = (turnoA.tipo === 'trabajado' || turnoA.tipo === 'art5152');
  var esHTDL_B = (turnoB.tipo === 'trabajado' || turnoB.tipo === 'art5152');

  var tipoEnlace = 'ORDINARIA_ORDINARIA';
  if(esHTDL_A && esHTDL_B) tipoEnlace = 'HTDL_HTDL';
  else if(esHTDL_A !== esHTDL_B) tipoEnlace = 'MIXTO';

  resultado.tipoEnlace = tipoEnlace;

  if(resultado.incumple){
    if(tipoEnlace==='ORDINARIA_ORDINARIA'){
      // Jornada ordinaria (pernocta o ida/vuelta): las horas no
      // descansadas computan como Horas de Presencia.
      resultado.computaPresencia = true;
    } else if(tipoEnlace==='HTDL_HTDL'){
      // Enlace entre dos HTDL o dos Art.51/52: sí computa
      // económicamente, con la tarifa del lado A.
      resultado.computaFinanciero = true;
    } else {
      // MIXTO — un lado Ordinaria y el otro HTDL/Art.51-52, en
      // cualquier orden: enlace consentido/regulado aparte, no
      // computa ni en horas ni en dinero.
      resultado.avisoNoComputa = 'Ojo: Enlace entre Ordinaria y HTDL/Art.51-52 — no computa en horas ni en dinero.';
    }
  }
  return resultado;
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — procesarIncumplimientoDescanso(turnoAnterior, turnoNuevo,
   keyAnterior, keyNuevo): alias con el nombre solicitado. Delega por
   completo en calcularEnlaceJornada() — el motor real, ya probado y
   sin tocar — para no duplicar la matemática ni la matriz de
   decisión en dos sitios distintos que podrían desincronizarse.
   Devuelve el mismo resultado, con los mismos campos:
     .incumple            → true si hay incumplimiento de descanso
     .tipoEnlace           → 'ORDINARIA_ORDINARIA' | 'HTDL_HTDL' | 'MIXTO' | 'TURNO_INTERCAMBIADO'
     .computaPresencia     → true si tipoEnlace==='ORDINARIA_ORDINARIA'
     .computaFinanciero    → true si tipoEnlace==='HTDL_HTDL' (los dos
                             lados son HTDL y/o Art.51-52, en cualquier
                             combinación). El caso MIXTO (un lado
                             Ordinaria, el otro HTDL/Art.51-52) NO
                             computa ni en horas ni en dinero — solo
                             genera aviso.
     .descMin/.limiteMin   → minutos de descanso real / mínimo exigido
     .esEnBase             → true=12h exigidas, false=8h exigidas
   NOTA: el campo se sigue llamando "computaPresencia" por
   compatibilidad interna con calculateEarnings() (que ya lo lee con
   ese nombre) — y desde el arreglo del usuario, esas horas SÍ se
   contabilizan como Horas de Presencia (tal como dice el nombre del
   campo), no como Efectivas. Un cambio anterior lo había puesto mal
   en Efectivas por error; ya está corregido en el punto de
   integración de calculateEarnings().
═══════════════════════════════════════════════════════════ */
function procesarIncumplimientoDescanso(turnoAnterior, turnoNuevo, keyAnterior, keyNuevo){
  return calcularEnlaceJornada(turnoAnterior, turnoNuevo, keyAnterior, keyNuevo);
}

function verificarDescansosMes(){
  var y=curM.getFullYear(),m=curM.getMonth()+1;
  var pref=key(y,m,1).substring(0,7);
  var ksA=Object.keys(TV).filter(function(k){return k.startsWith(pref);}).sort();
  var mA=m===1?12:m-1,yA=m===1?y-1:y;
  var pA=key(yA,mA,1).substring(0,7);
  var ksAnt=Object.keys(TV).filter(function(k){return k.startsWith(pA);}).sort();
  var ks=(ksAnt.length?[ksAnt[ksAnt.length-1]]:[]).concat(ksA),alertas={};

  // Firma ligera: mes visible + horarios/tipos relevantes de los turnos
  // implicados. FIX — Confirmado por el usuario: ahora también incluye
  // TV2[k] (turnos extra) en la firma — si solo mirara TV[k], un
  // cambio en un turno adicional no invalidaría la caché y seguiría
  // mostrando el aviso viejo.
  var firma = pref+'|'+ks.map(function(k){
    var t=TV[k];
    var extra=(TV2[k]||[]).map(function(e){return e.tipo+e.hF+e.hL+e.hL2+e.retrasoMin;}).join('+');
    return (t?(t.tipo+t.hF+t.hL+t.hL2+t.retrasoMin):'x')+'#'+extra;
  }).join(',');
  if(firma === _descansosCacheKey){
    return _descansosCacheVal; // nada relevante cambió — reutilizar resultado
  }

  for(var i=1;i<ks.length;i++){
    var kA2=ks[i-1],kB=ks[i],tA=TV[kA2],tB=TV[kB];
    if(!tA||!tB)continue;
    if(['descanso','baja','comp','reserva'].indexOf(tA.tipo)>=0)continue;
    if(['descanso','baja','comp','reserva'].indexOf(tB.tipo)>=0)continue;
    // FIX — usa el turno que de verdad termina más tarde en el día A
    // (puede ser uno de los turnos extra de TV2, no siempre el
    // principal) y el que de verdad empieza más temprano en el día B.
    var tAReal = _turnoFinDelDia(kA2) || tA;
    var tBReal = _turnoInicioDelDia(kB) || tB;
    var r=calcularEnlaceJornada(tAReal,tBReal,kA2,kB);
    if(r.incumple)alertas[kB]=Object.assign({},r,{kAnterior:kA2});
  }

  // NUEVO — Descanso INTERNO de una pernocta: tramo1 (llegada, hL) →
  // tramo2 (firma, hF2), AMBOS dentro del MISMO registro guardado.
  // checkRestTime()/calcularEnlaceJornada() solo comparan días
  // distintos ya guardados por separado — nunca evaluaban este
  // descanso interno. Se añade aquí como comprobación aparte, sin
  // tocar ninguna de esas dos funciones. Si el día ya tiene un aviso
  // de enlace EXTERNO, ese tiene prioridad y no se sobrescribe.
  ks.forEach(function(k){
    if(alertas[k]) return;
    var t=TV[k];
    if(!t) return;
    // FIX — 'ordinario' estaba excluido de esta comprobación por
    // error; el aviso de descanso interno de pernocta debe aparecer
    // también en jornada Ordinaria, no solo en HTDL/Art.51-52.
    if(['ordinario','trabajado','art5152'].indexOf(t.tipo)<0) return;
    var esPernocta=(t.modo==='pernocta'||t.modo==='pernocta3');
    if(!esPernocta) return;
    var rInterno=checkDescansoInternoPernocta(t);
    if(rInterno && rInterno.incumple){
      alertas[k]=Object.assign({},rInterno,{kAnterior:k,esInternoPernocta:true});
    }
  });

  _descansosCacheKey = firma;
  _descansosCacheVal = alertas;
  return alertas;
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — checkDescansoInternoPernocta(turno): evalúa el descanso
   ENTRE el tramo 1 (llegada, turno.hL) y el tramo 2 (firma,
   turno.hF2) de una MISMA pernocta ya guardada — algo que
   checkRestTime() nunca hacía, porque esa función solo compara dos
   registros de días DISTINTOS. Misma matemática y mismos campos de
   salida que checkRestTime() (descMin/limiteMin/descStr/limStr/
   esEnBase/msg), para que el resto del sistema (banner, correo) lo
   trate exactamente igual. No toca TV ni ningún dato guardado.

   FIX — el retraso del tramo 2 (vuelta) se guarda en un registro
   DISTINTO (TV[turno.diaSiguiente], el día de la vuelta), no en
   este mismo "turno" (que es siempre el día de la IDA/origen). Antes
   solo se restaba turno.retrasoMin (el retraso de la ida) y el
   retraso metido en el día de la vuelta no se restaba de nada —
   así que un retraso en el tramo de vuelta no reducía el descanso
   ni generaba enlace de jornada, aunque estuviera guardado. Ahora
   se suman AMBOS retrasos (ida + vuelta, cada uno leído de su
   propio registro) antes de calcular el hueco de descanso.
═══════════════════════════════════════════════════════════ */
function checkDescansoInternoPernocta(turno){
  if(!turno || !turno.hL || !turno.hF2) return null;
  var toM=function(h){var p=h.split(':').map(Number);return p[0]*60+p[1];};
  var ret1Obj = turno.retrasos && turno.retrasos.filter(function(r){return r.tramo===1;})[0];
  var min1 = ret1Obj ? (parseInt(ret1Obj.minutos)||0) : (parseInt(turno.retrasoMin)||0);
  var min2 = 0;
  var tVuelta = turno.diaSiguiente ? TV[turno.diaSiguiente] : null;
  if(tVuelta){
    var ret2Obj = tVuelta.retrasos && tVuelta.retrasos.filter(function(r){return r.tramo===2;})[0];
    min2 = ret2Obj ? (parseInt(ret2Obj.minutos)||0) : (parseInt(tVuelta.retrasoMin)||0);
  }
  var retA = min1 + min2;
  // FIX — Confirmado por Alex (bug real, detectado comparando contra
  // el Cómputo Excel oficial): cuando la IDA tiene trenes de conexión
  // (continuidad), el descanso se estaba midiendo desde que acababa
  // el PRIMER tren (turno.hL) — pero si hay un tren de conexión
  // después, la persona sigue trabajando hasta que ACABA ESE tren, no
  // hasta el primero. Contar desde turno.hL en ese caso metía dentro
  // del "descanso" varias horas que en realidad eran trabajo real
  // (el tren de conexión), inflando muchísimo el resultado — se
  // comprobó un caso real donde salían 13h de descanso de más.
  // Ahora, si hay continuidad, se usa el fin del ÚLTIMO tramo de
  // conexión de la ida; si no hay continuidad, sigue siendo
  // turno.hL exactamente como antes — ningún caso simple cambia.
  var finIdaReal = turno.hL;
  if(turno.continuidad && turno.continuidad.length){
    var ultimoTramoIdaDesc = turno.continuidad[turno.continuidad.length-1];
    if(ultimoTramoIdaDesc && ultimoTramoIdaDesc.horaFin) finIdaReal = ultimoTramoIdaDesc.horaFin;
  }
  // Tramo 2 empieza siempre al día siguiente del fin del tramo 1
  // (misma lógica de "un día de diferencia" que ya usa checkRestTime
  // para los cruces de medianoche).
  var dM=(1440-toM(finIdaReal)-retA)+toM(turno.hF2);
  if(dM<0)dM+=1440;
  var estacionDescanso=turno.sal2||turno.lle||'';
  var enB=AJ.base&&estacionDescanso===AJ.base,lim=enB?720:480;
  var inc=dM<lim,dH=Math.floor(dM/60),dMin=dM%60,lH=lim/60;
  return{ok:!inc,incumple:inc,descMin:dM,limiteMin:lim,
    descStr:dH+'h '+('0'+dMin).slice(-2)+'m',limStr:lH+'h',esEnBase:enB,
    msg:inc?'⚠️ Solo '+dH+'h '+(dMin>0?dMin+'m ':'')+'de descanso en '+(estacionDescanso||'destino')+' (min. '+lH+'h '+(enB?'en base':'fuera de base')+')'
           :'✅ '+dH+'h '+(dMin>0?dMin+'m ':'')+' de descanso'};
}

// ALERTAS_DESCANSO declarada en bloque ESTADO GLOBAL (ver inicio del script)

/* ═══════════════════════════════════════════════════════════
   NUEVO — Detección de retraso en tren de IDA como causa de
   incumplimiento de descanso fuera de base.
   Función de solo lectura: no modifica TV, ALERTAS_DESCANSO,
   checkRestTime() ni calcularEnlaceJornada(). Únicamente lee
   los datos ya existentes (alerta + t.retrasos del turno
   anterior) y devuelve un objeto listo para pintar en el banner.
═══════════════════════════════════════════════════════════ */
function detectarCausaRetrasoIda(alerta){
  if(!alerta) return null;
  var turnoAnterior = TV[alerta.kAnterior];
  if(!turnoAnterior) return null;
  // Solo aplica cuando el incumplimiento es FUERA de base (esEnBase===false)
  if(alerta.esEnBase !== false) return null;
  // NUEVO: si el día anterior es la "vuelta" de una pernocta (2 o 3 días),
  // el tramo de IDA real vive en la celda de ORIGEN (origenPernocta),
  // no en esta celda de vuelta. Resolvemos esa referencia primero.
  var esVueltaDePernocta = (turnoAnterior.tipo === 'vuelta-pernocta' || turnoAnterior.tipo === 'pernocta3-intermedio');
  var turnoIda = (esVueltaDePernocta && turnoAnterior.origenPernocta && TV[turnoAnterior.origenPernocta])
    ? TV[turnoAnterior.origenPernocta]
    : turnoAnterior;
  var retrasos = turnoIda.retrasos || [];
  var rIda = retrasos.filter(function(r){ return r.tramo === 1; })[0];
  var minIda = rIda ? (parseInt(rIda.minutos)||0) : 0;
  var trenIda = rIda ? (rIda.tren||'').trim() : '';
  if(!(minIda > 0 && trenIda)) return null;
  return {trenIda:trenIda, minIda:minIda};
}

function construirMailtoRetrasoIda(causa, alerta, turnoActual, fechaLbl){
  var destinatario = 'programación@empresa.com';
  var asunto = encodeURIComponent('Incumplimiento de descanso — Tren '+causa.trenIda+' (ida)');
  var turnoUsuario = (turnoActual && (turnoActual.numTren || turnoActual.tipo)) || '—';
  var cuerpo = encodeURIComponent(
    'Buenas,\n\n'
    +'Se ha detectado un incumplimiento del descanso mínimo fuera de base '+fechaLbl+',\n'
    +'motivado por un retraso de '+causa.minIda+' min en el tren '+causa.trenIda+' de ida.\n\n'
    +'Turno afectado: '+turnoUsuario+'\n'
    +'Descanso registrado: '+(alerta.descStr||'—')+' (mínimo requerido: '+(alerta.limStr||'—')+')\n\n'
    +'Quedo a la espera de indicaciones.\n'
  );
  return 'mailto:'+destinatario+'?subject='+asunto+'&body='+cuerpo;
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — Mailto GENÉRICO para cualquier alerta de enlace de
   jornada, exista o no un tren de ida identificado. Complementa
   (no sustituye) a construirMailtoRetrasoIda: cuando hay causa
   específica se usa el texto detallado con tren+minutos; cuando
   no la hay, se usa el mensaje general con los datos que sí
   existen siempre en toda alerta (msg, descStr, limStr, kAnterior).
   Solo lectura — no modifica TV, ALERTAS_DESCANSO ni funciones
   de cálculo existentes.
═══════════════════════════════════════════════════════════ */
function construirMailtoAlertaJornada(alerta, turnoActual, fechaLbl, causaIda){
  var destinatario = 'programación@empresa.com';
  var turnoUsuario = (turnoActual && (turnoActual.numTren || turnoActual.tipo)) || '—';
  var turnoAnteriorLbl = (typeof _keyAFechaLbl === 'function') ? _keyAFechaLbl(alerta.kAnterior||'') : (alerta.kAnterior||'—');

  if(causaIda){
    // Delega en el mailto específico ya existente (mismo contenido, sin duplicar lógica)
    return construirMailtoRetrasoIda(causaIda, alerta, turnoActual, fechaLbl);
  }

  var asunto = encodeURIComponent('Incumplimiento de enlace de jornada — '+fechaLbl);
  var cuerpo = encodeURIComponent(
    'Buenas,\n\n'
    +'Se ha detectado un incumplimiento de descanso en el enlace de jornada '+fechaLbl+'.\n'
    +'Turno anterior: '+turnoAnteriorLbl+'\n\n'
    +'Detalle: '+(alerta.msg||'—')+'\n'
    +'Descanso registrado: '+(alerta.descStr||'—')+' (mínimo requerido: '+(alerta.limStr||'—')+')\n'
    +(alerta.avisoNoComputa ? ('Aviso adicional: '+alerta.avisoNoComputa+'\n') : '')
    +'\nTurno afectado: '+turnoUsuario+'\n\n'
    +'Quedo a la espera de indicaciones.\n'
  );
  return 'mailto:'+destinatario+'?subject='+asunto+'&body='+cuerpo;
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — Capa de UX intermedia: modal de confirmación antes
   de abrir el cliente de correo. Puramente aditivo: reutiliza
   ALERTAS_DESCANSO, TV, AJ, _keyAFechaLbl() y
   detectarCausaRetrasoIda() ya existentes, sin modificarlos.
   No sustituye construirMailtoAlertaJornada()/construirMailtoRetrasoIda()
   (siguen intactas y usables); esta capa solo añade un paso
   intermedio de revisión/edición antes de invocar el mailto: final.
═══════════════════════════════════════════════════════════ */

function _saludoPorHora(){
  var h = new Date().getHours();
  if(h < 12) return 'Buenos días';
  if(h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function _generarMensajeCorreoJornada(k){
  var alerta = ALERTAS_DESCANSO[k];
  var t = TV[k];
  if(!alerta || !t) return '';
  var causaIda = detectarCausaRetrasoIda(alerta);
  var fechaTurno = _keyAFechaLbl(k);
  var nombre = AJ.nombre || 'Nombre no configurado en Ajustes';
  var matricula = AJ.matricula || 'Matrícula no configurada en Ajustes';
  var saludo = _saludoPorHora().toLowerCase();
  var ambito = (alerta.esEnBase===false) ? 'fuera de base' : 'dentro de base';

  // ACTUALIZADO — tono cordial e informativo (antes sonaba a queja:
  // "no cumplo con las horas de descanso..."). Ahora es una
  // notificación formal y neutra, informando del hecho registrado
  // según horario grafiado o retraso, sin reclamar nada.
  var cuerpo = causaIda
    ? ('Os informo de que el día '+fechaTurno+' se registró un retraso de '+causaIda.minIda
       +' minutos en el tren '+causaIda.trenIda+' (tramo de ida). Como consecuencia, el descanso '
       +ambito+' entre jornadas ha quedado por debajo del mínimo reglamentario, generándose un enlace de jornada. '
       +'Os traslado esta notificación para su conocimiento y registro.')
    : ('Os informo de que el día '+fechaTurno+' se ha registrado un descanso '
       +ambito+' por debajo del mínimo reglamentario ('+(alerta.msg||'')+'), según el horario grafiado, '
       +'generándose un enlace de jornada. Os traslado esta notificación para su conocimiento y registro.');

  return 'Hola, '+saludo+'.\n\n'
    +cuerpo+'\n\n'
    +'Quedo a vuestra disposición para cualquier aclaración.\n\n'
    +'Un saludo,\n'+nombre+'\n'
    +'Matrícula: '+matricula+'\n\n'
    +'Solicitud generada automáticamente por TrenTurno V5';
}

function cerrarModalCorreoJornada(){
  closeOv('ov-correo-jornada');
}

function abrirModalCorreoJornada(k){
  var mensaje = _generarMensajeCorreoJornada(k);
  if(!mensaje) return;

  var body = document.getElementById('correo-jornada-body');
  if(!body) return;

  // ACTUALIZADO — destinatario EDITABLE (antes iba fijo por código,
  // con un acento sin codificar dentro de la URL — un bug real).
  // Mismo patrón .aj-nombre-* ya usado en el correo de Baja Médica.
  body.innerHTML =
    '<div class="aj-nombre-wrap" style="margin-bottom:10px"><span class="aj-nombre-ico">📧</span>'
      +'<input id="correo-jornada-destinatario" class="aj-nombre-inp" placeholder="Destinatario" value="programacion.sab@serveo.com"></div>'
    +'<div style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--tx3);margin-bottom:6px">MENSAJE (editable)</div>'
    +'<textarea id="correo-jornada-textarea" class="correo-modal-textarea" style="min-height:230px"></textarea>'
    +'<button onclick="enviarCorreoJornadaModal(\''+k+'\')" style="width:100%;margin-top:12px;padding:13px;'
    +'background:linear-gradient(135deg,var(--acc),var(--acc2));border:none;border-radius:12px;'
    +'color:#fff;font-size:14px;font-weight:800;cursor:pointer">✉️ Abrir en Correo</button>';

  // FIX — texto limpio: se pasa por sanitizarTexto() (misma función
  // ya usada en Mix Art.51/52 y Baja Médica) antes de mostrarse, para
  // eliminar acentos y cualquier carácter que pueda llegar roto al
  // cliente de correo. Se asigna por .value (no por HTML) para evitar
  // cualquier problema de escapado.
  var ta = document.getElementById('correo-jornada-textarea');
  if(ta) ta.value = (typeof sanitizarTexto==='function') ? sanitizarTexto(mensaje) : mensaje;

  openOv('ov-correo-jornada');
}

function enviarCorreoJornadaModal(k){
  var dest = (document.getElementById('correo-jornada-destinatario')||{}).value.trim() || 'programacion.sab@serveo.com';
  var ta = document.getElementById('correo-jornada-textarea');
  var cuerpoRaw = ta ? ta.value : '';
  var cuerpoFinal = (typeof sanitizarTexto==='function') ? sanitizarTexto(cuerpoRaw) : cuerpoRaw;
  var alerta = ALERTAS_DESCANSO[k];
  var causaIda = alerta ? detectarCausaRetrasoIda(alerta) : null;
  var asuntoTxt = causaIda
    ? ('Notificacion de enlace de jornada - Tren '+causaIda.trenIda+' (ida)')
    : ('Notificacion de enlace de jornada - '+_keyAFechaLbl(k));
  var asuntoLimpio = (typeof sanitizarTexto==='function') ? sanitizarTexto(asuntoTxt) : asuntoTxt;
  // FIX — destinatario SIN codificar (igual que el resto de correos
  // de la app): codificar la dirección de email convierte la @ en
  // %40. Solo asunto y cuerpo se codifican con encodeURIComponent(),
  // para que espacios, comas, acentos, puntos y saltos de línea
  // lleguen limpios y legibles al cliente de correo.
  var url = 'mailto:'+dest+'?subject='+encodeURIComponent(asuntoLimpio)+'&body='+encodeURIComponent(cuerpoFinal);
  window.location.href = url;
  cerrarModalCorreoJornada();
}
