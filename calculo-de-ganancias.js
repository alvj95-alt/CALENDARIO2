/* TrenTurnos v5 — calculateEarnings(): cálculo económico del mes
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function calculateEarnings(ks){
  var p=AJ.pluses[AJ.rol]||PLUS_DEF[AJ.rol];
  var HTDL=parseFloat(AJ.vh||12.5),NOC=parseFloat(AJ.nocturnidad||0);
  // NUEVO — Confirmado por Alex (Art. 58 y Art. 64 del Convenio Serveo):
  // Plus Traslación y Rebase, con el mismo criterio ya usado para
  // HTDL/Nocturnidad — se puede personalizar en Ajustes (AJ.rebase/
  // AJ.plusTrasl); si no se ha guardado nada propio, se usa la tarifa
  // por rol ya existente en TARIFAS_ROL (esta tabla ya estaba, solo
  // que hasta ahora nadie la leía desde aquí).
  var _tarifaRolActual = TARIFAS_ROL[AJ.rol]||TARIFAS_ROL.tripulante;
  var REBASE = parseFloat(AJ.rebase) || _tarifaRolActual.rebase || 0;
  var PLUSTRASL = parseFloat(AJ.plusTrasl) || _tarifaRolActual.plusTrasl || 0;
  var P_ACT=parseFloat(p.activacion||0),P_JT=parseFloat(p.jt||0),P_INTL=parseFloat(p.internacional||0);
  var tH=0,tN=0,tA=0,tJ=0,tI=0,tHr=0,hHTDL=0;
  // NUEVO — acumuladores de Rebase y Plus Traslación (Art. 64 y 58).
  var tRebase=0, tPlusTrasl=0;
  var dRebase=[], dPlusTrasl=[];
  var minEfectivasCal=0, minPresenciaCal=0; // Horas Efectivas/Presencia — jornada ordinaria (DH validado)
  var minEfectivasHTDL=0, minPresenciaHTDL=0; // Horas Efectivas/Presencia — EXCLUSIVO días HTDL, nunca se mezcla con lo anterior
  var dN=[],dA=[],dJ=[],dI=[],dHTDL=[];
  var cn = function(hF, hL){
    if(!hF||!hL) return 0;
    var tm = function(h){
      var p = h.split(':').map(Number);
      return p[0]*60 + p[1];
    };
    var ii=tm(hF); var ff=tm(hL);
    if(ff<=ii) ff+=1440;
    var nn=Math.max(0, Math.min(ff,1440) - Math.max(ii,1320));
    nn += Math.max(0, Math.min(ff,1800) - Math.max(ii,1440));
    if(ii<360) nn += Math.max(0, Math.min(ff,360) - ii);
    return Math.round(nn/60*100)/100;
  };
  // retrasos del mes
  var retMes=[];
  ks.forEach(function(k){
    var t=TV[k];if(!t)return;
    var _ks2=k.split('-');var mo2=parseInt(_ks2[1]),dd2=_ks2[2];
    var dL2=parseInt(dd2)+' '+MESES_C[parseInt(mo2)-1];
    // Si esta celda es un día derivado de pernocta (vuelta o intermedio),
    // el "es HTDL por dinero" se determina por el turno de ORIGEN, ya que
    // el campo comp solo vive en el registro de origen.
    var origenParaComp = t.origenPernocta ? TV[t.origenPernocta] : t;
    var esCompDinero = !!(origenParaComp && origenParaComp.comp==='dinero');
    // NUEVO — si este día pertenece a una pernocta y el retraso (de
    // cualquiera de los dos tramos) hace que no se cumplan las 8h de
    // descanso interno (enlace de jornada), el tramo 1 (ida) TAMBIÉN
    // pasa a ser económico aquí abajo, no solo informativo — porque
    // ya está generando dinero real por el bloque de "descanso interno
    // de pernocta" en el cálculo principal. Se reutiliza
    // checkDescansoInternoPernocta() (solo lectura) sobre el registro
    // de ORIGEN, sea cual sea la celda (ida o vuelta) que estemos
    // mirando ahora mismo.
    var esPernoctaParaEnlace = !!(origenParaComp && (origenParaComp.modo==='pernocta'||origenParaComp.modo==='pernocta3'));
    var esEnlacePernocta = false;
    if(esPernoctaParaEnlace && typeof checkDescansoInternoPernocta==='function'){
      var _rIntMes = checkDescansoInternoPernocta(origenParaComp);
      esEnlacePernocta = !!(_rIntMes && _rIntMes.incumple);
    }
    // Retrasos nuevos (con tramo+tren)
    if(t.retrasos&&t.retrasos.length){
      t.retrasos.forEach(function(r){
        retMes.push({fecha:dL2,tramo:r.tramo,minutos:r.minutos,tren:r.tren||'',numTren:t.numTren||'',esHTDL:esCompDinero,esEnlacePernocta:esEnlacePernocta});
      });
    } else if(t.retrasoMin>0){
      // Retrasos antiguos (solo minutos)
      retMes.push({fecha:dL2,tramo:0,minutos:t.retrasoMin,tren:'',numTren:t.numTren||'',esHTDL:esCompDinero,esEnlacePernocta:esEnlacePernocta});
    }
  });


  ks.forEach(function(k){
   try{
    var t=TV[k];if(!t)return;
    var _ks=k.split('-');var mo=parseInt(_ks[1]),dd=_ks[2];
    var dL=parseInt(dd)+' '+MESES_C[parseInt(mo)-1];
    var hI=(t.hF&&t.hL)?Math.round(calcMins(t.hF,t.hL)/60*100)/100:0;
    var hV=(t.hF2&&t.hL2)?Math.round(calcMins(t.hF2,t.hL2)/60*100)/100:0;
    var h=Math.round((hI+hV)*100)/100;
    // ── Horas Efectivas / Presencia — única fuente de verdad ──
    // Se calculan para el DÍA COMPLETO (turno principal + turnos
    // adicionales de TV2, huecos entre ellos y reservas) con
    // calcularJornadaDiaria(). Puramente aditivo: no modifica
    // tHr/tH/hHTDL, que siguen su propio cálculo más abajo.
    var jornada = calcularJornadaDiaria(getTurnosDia(k), k);
    // FIX — ya no se elige "uno u otro" bucket para todo el día: se
    // suman los dos por separado (un día mixto aporta a ambos).
    minEfectivasCal  += jornada.efectivasMin;
    minPresenciaCal  += jornada.presenciaMin;
    minEfectivasHTDL += jornada.efectivasHTDLMin;
    minPresenciaHTDL += jornada.presenciaHTDLMin;
    // NUEVO — Confirmado por Alex (Opción A del dinero, mismo criterio
    // que ya se aplicó a las horas): en pernocta, la parte de VUELTA
    // del dinero (nocturnidad de esos tramos, el HTDL económico de la
    // vuelta) ya no se cuenta aquí — se mueve a la rama
    // 'vuelta-pernocta' de más abajo, que vive en el día REAL de
    // llegada. Así, si ida y vuelta caen en el mismo mes, el total no
    // cambia — solo se reparte; si cruzan de mes, cada parte cuenta
    // para su mes de verdad (el "mes vencido" ya queda bien aplicado
    // también al dinero, no solo a las horas).
    var esPernoctaDinero = (t.modo==='pernocta' || t.modo==='pernocta3');
    // NUEVO — Confirmado por Alex (Art. 64 del Convenio): Rebase =
    // las horas que excedan de la 9ª hora dentro del mismo día
    // natural. VERSIÓN SIMPLE: todavía no resta las horas que ya se
    // paguen como Presencia/Extraordinarias (el convenio dice que se
    // "absorben" en ese caso, pero no está claro aún si es por día o
    // por mes — pendiente de afinar).
    // FIX — Confirmado por Alex (2 bugs reales, encontrados
    // comparando contra el Cómputo Excel oficial de junio):
    //   1) El Rebase NO se aplica en días HTDL/Art.51-52 — el Excel
    //      oficial confirma que esos días siempre salen con Rebase en
    //      0,00, porque Serveo mete TODO el tiempo en la bolsa de
    //      HTDL, nunca lo cuenta aparte como Rebase. Antes se estaba
    //      aplicando también ahí, sumando de más.
    //   2) No se tenían en cuenta los trenes de CONEXIÓN (continuidad/
    //      continuidadVuelta) al medir cuánto dura el día — un día con
    //      un tren enlazado (ej. 697→697C) se quedaba corto, porque
    //      solo se miraba el primer tramo. Ahora se usa el fin del
    //      ÚLTIMO tramo real del día, incluyendo las conexiones.
    // Aplica solo a jornada ORDINARIA (no a HTDL/Art.51-52). En
    // pernocta, aquí solo se mide la IDA (día natural de salida) más
    // su propia continuidad; la VUELTA (con la suya) se mide en su
    // propia celda, en la rama 'vuelta-pernocta' — mismo reparto por
    // día real que ya se usa para todo lo demás.
    if(t.tipo==='ordinario'){
      var finRebase;
      if(esPernoctaDinero){
        // Solo ida: el fin es el último tramo de continuidad de la
        // ida, si lo hay; si no, el fin del tramo principal (t.hL).
        finRebase = t.hL;
        if(t.continuidad && t.continuidad.length){
          var ultContIda = t.continuidad[t.continuidad.length-1];
          if(ultContIda && ultContIda.horaFin) finRebase = ultContIda.horaFin;
        }
      } else {
        // Mismo día completo (ida+vuelta): el fin es el último tramo
        // de continuidadVuelta si lo hay; si no, el de continuidad si
        // lo hay; si no, hL2 (vuelta) o hL (solo ida) — el que exista.
        finRebase = (t.hF2&&t.hL2) ? t.hL2 : t.hL;
        if(t.continuidad && t.continuidad.length){
          var ultCont = t.continuidad[t.continuidad.length-1];
          if(ultCont && ultCont.horaFin) finRebase = ultCont.horaFin;
        }
        if(t.continuidadVuelta && t.continuidadVuelta.length){
          var ultContV = t.continuidadVuelta[t.continuidadVuelta.length-1];
          if(ultContV && ultContV.horaFin) finRebase = ultContV.horaFin;
        }
      }
      var spanRebaseMin = (t.hF&&finRebase) ? calcMins(t.hF,finRebase) : 0;
      var minRebase = Math.max(0, spanRebaseMin - 540); // 540min = 9h
      if(minRebase>0){
        var hRebaseDia = Math.round(minRebase/60*100)/100;
        tRebase += hRebaseDia*REBASE;
        dRebase.push({lbl:dL, tren:t.numTren||'', horas:hRebaseDia, importe:Math.round(hRebaseDia*REBASE*100)/100});
      }
    }
    if(t.tipo==='ordinario'){tHr+=h;
      if(t.nocturno&&h>0){
        var nOrd1=cn(t.hF,t.hL), nOrd2=cn(t.hF2,t.hL2);
        // FIX — la nocturnidad de los tramos de Continuidad (ida y
        // vuelta) no se calculaba en absoluto: solo se miraban el
        // tramo principal de ida (t.hF-t.hL) y el de vuelta
        // (t.hF2-t.hL2). Si un CONT.2 caía dentro del horario
        // nocturno (22:00-06:00), esa nocturnidad real se perdía por
        // completo — no es una etiqueta mal puesta, es dinero real
        // que faltaba.
        var nOrdContIda = 0, nOrdContVuelta = 0;
        if(t.continuidad && t.continuidad.length){
          t.continuidad.forEach(function(c){ if(c.horaInicio && c.horaFin) nOrdContIda += cn(c.horaInicio, c.horaFin); });
        }
        // NUEVO — la continuidad de VUELTA solo se suma aquí si NO es
        // pernocta (mismo día); en pernocta se mueve a la rama
        // 'vuelta-pernocta', igual que su propia nocturnidad (nOrd2).
        if(!esPernoctaDinero && t.continuidadVuelta && t.continuidadVuelta.length){
          t.continuidadVuelta.forEach(function(c){ if(c.horaInicio && c.horaFin) nOrdContVuelta += cn(c.horaInicio, c.horaFin); });
        }
        // NUEVO — en pernocta, nOrd2 (nocturnidad de la vuelta) tampoco
        // se suma aquí — se cuenta en la celda de vuelta.
        var nOrd = esPernoctaDinero ? (nOrd1+nOrdContIda) : (nOrd1+nOrd2+nOrdContIda+nOrdContVuelta);
        if(nOrd>0){
          tN+=nOrd*NOC;
          dN.push({lbl:dL,tren:t.numTren||'',hF1:t.hF,hL1:t.hL,hF2:t.hF2,hL2:t.hL2,hNoc:nOrd,importe:Math.round(nOrd*NOC*100)/100});
        }
      }
      if(t.plusAct){tA+=P_ACT;dA.push(dL);}if(t.plusJT){tJ+=P_JT;dJ.push(dL);}if(t.plusIntlAuto){tI+=P_INTL;dI.push(dL);}
    }
    if(t.tipo==='trabajado'){tHr+=h;
      if(t.comp==='dinero'){
        // ── Regla de cómputo económico HTDL ──
        // · Ida y vuelta el mismo día → cuenta EXCLUSIVAMENTE el tramo 2 (vuelta).
        // · Pernocta (2 o 3 días) → se acumulan el tramo de ida (día 1) y el
        //   tramo de vuelta (día 2/3); ambos ya viven combinados en este mismo
        //   registro de origen (hF/hL = ida, hF2/hL2 = vuelta).
        var esPernoctaHTDL = (t.modo==='pernocta'||t.modo==='pernocta3');
        // MÓDULO A: Retraso T2 en HTDL suma al computable
        // T1 = solo informativo. T2 = suma económica.
        // En pernocta, el tramo 2 (vuelta) ocurre en la celda del día
        // siguiente — su retraso vive en esa celda, no en la de origen.
        var minRetT2=0;
        if(esPernoctaHTDL){
          var tVuelta = t.diaSiguiente ? TV[t.diaSiguiente] : null;
          if(tVuelta && tVuelta.retrasos && tVuelta.retrasos.length){
            tVuelta.retrasos.forEach(function(r){
              if(r.tramo===2) minRetT2+=r.minutos||0;
            });
          } else if(tVuelta && tVuelta.retrasoMin>0){
            minRetT2=tVuelta.retrasoMin;
          }
        } else {
          if(t.retrasos&&t.retrasos.length){
            t.retrasos.forEach(function(r){
              if(r.tramo===2) minRetT2+=r.minutos||0;
            });
          } else if(t.retrasoMin>0 && !t.retrasos){
            // retraso legacy (sin tramo) — tratamos como T2 para no perder datos
            minRetT2=t.retrasoMin;
          }
        }
        var hRetT2=Math.round(minRetT2/60*100)/100;
        // FIX — antes 'hEscalaHTDL' se calculaba como el hueco COMPLETO
        // entre el fin de la ida (t.hL) y el inicio de la vuelta
        // (t.hF2), sin tener en cuenta que puede haber un tramo de
        // Continuidad (p.ej. un CONT.2) trabajándose en medio de ese
        // hueco. Esas horas de trabajo real quedaban etiquetadas como
        // "escala" en el desglose que se le muestra a la persona —
        // aunque el TOTAL en € siempre fue correcto (toda la jornada
        // HTDL se paga igual, esté repartida como esté), el desglose
        // mostrado era engañoso: parecía que había 8h de espera cuando
        // en realidad casi todo era trabajo.
        // Ahora se separan en dos cifras: los minutos de continuidad
        // REALMENTE trabajados (hContinuidadHTDL) y la escala REAL —
        // solo el hueco antes del primer tramo de continuidad + el
        // hueco entre el último tramo de continuidad y la vuelta.
        var minContinuidadHTDL = 0;
        var minEscalaHTDL = 0;
        var finIdaRealHTDL = t.hL;
        // FIX — en pernocta, los tramos de continuidad de la IDA
        // (estés trabajando, en DH o lo que sea) SÍ deben pagarse
        // completos, igual que en ida-y-vuelta el mismo día — lo
        // único que no se paga en pernocta es la escala/hueco (el
        // descanso nocturno real entre ida y vuelta). Antes esto
        // estaba todo excluido en bloque para pernocta ("!esPernoctaHTDL"),
        // así que la continuidad se perdía del dinero por completo.
        // Ahora solo la escala (minEscalaHTDL) se sigue excluyendo en
        // pernocta; la duración de cada tramo de continuidad se suma
        // siempre.
        // FIX — Confirmado por Alex: las esperas/escalas entre trenes
        // conectados SÍ deben pagarse también en pernocta (antes se
        // excluían siempre con "!esPernoctaHTDL", igual que ya se
        // corrigió en guardarTurno() y en Copiar Turno — esta era la
        // TERCERA copia de la misma fórmula, usada aquí para el
        // desglose en vivo de Stats, que se había quedado sin
        // arreglar). La duración de cada tramo de continuidad
        // siempre se suma.
        if(t.continuidad && t.continuidad.length){
          t.continuidad.forEach(function(c){
            if(c.horaInicio && c.horaFin) minContinuidadHTDL += calcMins(c.horaInicio, c.horaFin);
            if(c.escalaMin!=null && c.escalaMin>0) minEscalaHTDL += c.escalaMin;
            if(c.horaFin) finIdaRealHTDL = c.horaFin;
          });
        }
        if(!esPernoctaHTDL && finIdaRealHTDL && t.hF2){
          var huecoFinalHTDL = calcMins(finIdaRealHTDL, t.hF2);
          if(huecoFinalHTDL>0) minEscalaHTDL += huecoFinalHTDL;
        }
        var hContinuidadHTDL = Math.round(minContinuidadHTDL/60*100)/100;
        // FIX — mismo problema que la continuidad de la IDA, pero más
        // grave: la continuidad de la VUELTA (t.continuidadVuelta, p.
        // ej. un CONT. después del tramo principal de vuelta) no se
        // estaba contando EN ABSOLUTO en el dinero de HTDL — ni como
        // "continuidad" ni como "escala" ni de ninguna forma. Esas
        // horas trabajadas de verdad se perdían del total en €, no
        // solo de la etiqueta. Se suman aquí exactamente igual que la
        // continuidad de la ida: duración de cada tramo de
        // continuidadVuelta siempre; su escalaMin (el hueco antes de
        // cada uno) también siempre, ya sea pernocta o no.
        var minContinuidadVueltaHTDL = 0;
        if(t.continuidadVuelta && t.continuidadVuelta.length){
          t.continuidadVuelta.forEach(function(c){
            if(c.horaInicio && c.horaFin) minContinuidadVueltaHTDL += calcMins(c.horaInicio, c.horaFin);
            if(c.escalaMin!=null && c.escalaMin>0) minEscalaHTDL += c.escalaMin;
          });
        }
        var hContinuidadVueltaHTDL = Math.round(minContinuidadVueltaHTDL/60*100)/100;
        // FIX — 'hEscalaHTDL' se calcula AQUÍ (no antes) porque tiene
        // que incluir también las esperas de la continuidadVuelta que
        // se acaban de sumar arriba — antes se calculaba demasiado
        // pronto y esos minutos se perdían de esta cifra (aunque
        // seguían sumando al total final, solo faltaban del desglose
        // por partes).
        var hEscalaHTDL = Math.round(minEscalaHTDL/60*100)/100;
        // NUEVO — TURNOS ADICIONALES (TV2) EN DÍA HTDL: no existen días
        // mixtos. Si el turno principal del día es HTDL ('trabajado'),
        // cualquier turno adicional guardado ese mismo día (aunque su
        // propio tipo sea 'ordinario') pasa a formar parte del MISMO
        // bloque económico HTDL — se paga puerta a puerta, desde la
        // toma del turno principal hasta el deje del último turno
        // adicional, incluyendo el hueco entre ambos (igual que ya se
        // hace con la escala interna ida-vuelta de un mismo turno).
        // Solo aplica al caso "ida y vuelta el mismo día" (no pernocta,
        // que ya se paga como bloque cerrado con 'h'). Los turnos
        // adicionales no soportan Continuidad ni Retrasos en esta
        // versión, así que solo se suman sus tramos ida/vuelta propios
        // y los huecos de escala — sin tocar minRetT2, que sigue
        // atado exclusivamente al turno principal.
        var minExtraHTDL = 0;
        if(!esPernoctaHTDL && TV2[k] && TV2[k].length){
          var finVueltaRealHTDL = t.hL2 || finIdaRealHTDL;
          if(t.continuidadVuelta && t.continuidadVuelta.length){
            var ultimoCV = t.continuidadVuelta[t.continuidadVuelta.length-1];
            if(ultimoCV && ultimoCV.horaFin) finVueltaRealHTDL = ultimoCV.horaFin;
          }
          var bloquesExtraHTDL = TV2[k].slice().sort(function(a,b){
            return (a&&a.hF?_horasToMin(a.hF):0) - (b&&b.hF?_horasToMin(b.hF):0);
          });
          var cursorFinHTDL = finVueltaRealHTDL;
          bloquesExtraHTDL.forEach(function(ex){
            if(!ex || !ex.hF) return;
            if(cursorFinHTDL){
              var huecoEntreTurnosHTDL = calcMins(cursorFinHTDL, ex.hF);
              if(huecoEntreTurnosHTDL>0) minEscalaHTDL += huecoEntreTurnosHTDL;
            }
            var minIdaEx = (ex.hF&&ex.hL) ? calcMins(ex.hF, ex.hL) : 0;
            var minVueltaEx = (ex.hF2&&ex.hL2) ? calcMins(ex.hF2, ex.hL2) : 0;
            if(ex.hL && ex.hF2){
              var minEscalaInternaEx = calcMins(ex.hL, ex.hF2);
              if(minEscalaInternaEx>0) minEscalaHTDL += minEscalaInternaEx;
            }
            minExtraHTDL += minIdaEx + minVueltaEx;
            cursorFinHTDL = (ex.hF2&&ex.hL2) ? ex.hL2 : (ex.hL || cursorFinHTDL);
          });
          hEscalaHTDL = Math.round(minEscalaHTDL/60*100)/100; // recalculado con los huecos añadidos
        }
        var hExtraHTDL = Math.round(minExtraHTDL/60*100)/100;
        // NOTA — Confirmado por Alex: la dormida entre ida y vuelta NO
        // se paga aquí — eso lo cubre por separado el mecanismo ya
        // existente checkDescansoInternoPernocta() (sección "Descanso
        // INTERNO de una pernocta", más abajo en esta función), que
        // sigue atado al mes del día de ORIGEN por ahora.
        // NUEVO — Confirmado por Alex (Opción A del dinero): en
        // pernocta, esta celda (el origen/día de salida) ya SOLO
        // cuenta la parte de IDA (hI + su continuidad) — la vuelta
        // (hV, su continuidadVuelta, la escala y el retraso T2) se
        // cuenta aparte, en la rama 'vuelta-pernocta' de más abajo,
        // que vive en el día REAL de llegada. Si ida y vuelta caen en
        // el mismo mes, el total no cambia — solo se reparte entre
        // las dos celdas; si cruzan de mes, cada parte cuenta para su
        // mes de verdad.
        var hComputable = esPernoctaHTDL
          ? Math.round((hI+hContinuidadHTDL)*100)/100
          : Math.round((hI+hEscalaHTDL+hContinuidadHTDL+hV+hContinuidadVueltaHTDL+hExtraHTDL)*100)/100;
        var hTotalHTDL = esPernoctaHTDL
          ? hComputable // el retraso T2 y todo lo demás de la vuelta van en su propia celda
          : Math.round((hComputable+hRetT2)*100)/100;
        hHTDL+=hTotalHTDL;
        tH+=hTotalHTDL*HTDL;
        // Guardar detalle: fecha, tren, horas desglosadas
        dHTDL.push({
          lbl:dL,
          // NUEVO — fecha real de la VUELTA cuando es pernocta (el
          // tramo de vuelta ocurre físicamente al día siguiente — o
          // dos días después en pernocta de 3 días — no el mismo día
          // que la ida). Solo se rellena en pernocta; en HTDL del
          // mismo día, ida y vuelta comparten fecha y no hace falta.
          lblVuelta: (function(){
            if(!esPernoctaHTDL) return null;
            var kVta = _diaSiguienteKey(k);
            if(t.modo==='pernocta3') kVta = _diaSiguienteKey(kVta);
            var pV = kVta.split('-');
            return parseInt(pV[2])+' '+MESES_C[parseInt(pV[1])-1];
          })(),
          tren:t.numTren||'',
          esPernocta:esPernoctaHTDL,
          // NUEVO — en pernocta, esta ficha ya solo representa la
          // IDA (la vuelta tiene su propia ficha, en su propia celda)
          soloIda: esPernoctaHTDL,
          hIda:hI,
          hEscala: esPernoctaHTDL ? 0 : hEscalaHTDL,
          hContinuidad:hContinuidadHTDL,
          hContinuidadVuelta: esPernoctaHTDL ? 0 : hContinuidadVueltaHTDL,
          hVuelta: esPernoctaHTDL ? 0 : hV,
          hRetT2: esPernoctaHTDL ? 0 : hRetT2,
          minRetT2: esPernoctaHTDL ? 0 : minRetT2,
          hExtra:hExtraHTDL,
          hTotal:hTotalHTDL,
          importe:Math.round(hTotalHTDL*HTDL*100)/100
        });
      }
      var nTrab1=cn(t.hF,t.hL), nTrab2=cn(t.hF2,t.hL2);
      // FIX — mismo problema que en jornada ordinaria: la nocturnidad
      // de los tramos de Continuidad no se calculaba. Se suma aquí
      // igual, para HTDL.
      var nTrabContIda = 0, nTrabContVuelta = 0;
      if(t.continuidad && t.continuidad.length){
        t.continuidad.forEach(function(c){ if(c.horaInicio && c.horaFin) nTrabContIda += cn(c.horaInicio, c.horaFin); });
      }
      // NUEVO — en pernocta, la nocturnidad de la vuelta (nTrab2 y su
      // continuidadVuelta) se mueve a la rama 'vuelta-pernocta' — se
      // cuenta ahí, en el día real de llegada.
      if(!esPernoctaDinero && t.continuidadVuelta && t.continuidadVuelta.length){
        t.continuidadVuelta.forEach(function(c){ if(c.horaInicio && c.horaFin) nTrabContVuelta += cn(c.horaInicio, c.horaFin); });
      }
      var nTrab = esPernoctaDinero ? (nTrab1+nTrabContIda) : (nTrab1+nTrab2+nTrabContIda+nTrabContVuelta);
      if(nTrab>0&&t.nocturno){
        tN+=nTrab*NOC;
        dN.push({lbl:dL,tren:t.numTren||'',hF1:t.hF,hL1:t.hL,hF2:t.hF2,hL2:t.hL2,hNoc:nTrab,importe:Math.round(nTrab*NOC*100)/100});
      }
      if(t.plusAct){tA+=P_ACT;dA.push(dL);}if(t.plusJT){tJ+=P_JT;dJ.push(dL);}if(t.plusIntlAuto){tI+=P_INTL;dI.push(dL);}
    }
    if(t.tipo==='vuelta-pernocta'){
      // NUEVO — Confirmado por Alex (Opción A del dinero, mismo
      // criterio ya aplicado a las horas): esta es la celda del día
      // REAL de llegada de una pernocta. Antes no aportaba nada de
      // dinero (todo se contaba de golpe en el día de origen/salida)
      // — ahora recupera aquí la parte de VUELTA (su nocturnidad y su
      // HTDL económico), leídas del turno de origen
      // (TV[origenPernocta]), que es donde siguen guardadas de
      // verdad. Así esta celda se lleva su dinero para SU PROPIO
      // mes/día real — el "mes vencido" ya aplica también al dinero,
      // no solo a las horas.
      var origenDinero2 = t.origenPernocta ? TV[t.origenPernocta] : null;
      if(origenDinero2){
        // Retraso del tramo 2: vive de verdad en ESTA celda
        // (t.retrasos), no en la de origen.
        var minRetT2b = 0;
        if(t.retrasos && t.retrasos.length){
          t.retrasos.forEach(function(r){ if(r.tramo===2) minRetT2b += r.minutos||0; });
        } else if(t.retrasoMin>0 && !t.retrasos){
          minRetT2b = t.retrasoMin;
        }
        var hRetT2b = Math.round(minRetT2b/60*100)/100;

        // ── Nocturnidad de la vuelta (aplica igual a Ordinario y a HTDL/Art.51-52) ──
        if(origenDinero2.nocturno){
          var nVuelta2 = cn(origenDinero2.hF2, origenDinero2.hL2);
          var nVueltaCont = 0;
          if(origenDinero2.continuidadVuelta && origenDinero2.continuidadVuelta.length){
            origenDinero2.continuidadVuelta.forEach(function(c){ if(c.horaInicio && c.horaFin) nVueltaCont += cn(c.horaInicio, c.horaFin); });
          }
          var nVueltaTotal = nVuelta2 + nVueltaCont;
          if(nVueltaTotal>0){
            tN += nVueltaTotal*NOC;
            dN.push({lbl:dL, tren:origenDinero2.numTren||'', hF1:null, hL1:null, hF2:origenDinero2.hF2, hL2:origenDinero2.hL2, hNoc:nVueltaTotal, importe:Math.round(nVueltaTotal*NOC*100)/100});
          }
        }

        // ── Rebase de la vuelta (Art. 64) — mismo criterio que la ida:
        // excede de la 9ª hora del día natural. Se mide aquí, en el
        // día real de llegada, con las horas propias de la vuelta.
        // FIX — Confirmado por Alex (mismos 2 bugs que en la ida,
        // encontrados comparando contra el Cómputo Excel oficial):
        //   1) Solo aplica si el origen es Ordinario — nunca en
        //      HTDL/Art.51-52 (ahí todo va a la bolsa de HTDL, el
        //      Excel oficial confirma Rebase=0,00 siempre en esos días).
        //   2) Se incluye el último tramo de continuidadVuelta (trenes
        //      de conexión de la vuelta) al medir el fin del día — antes
        //      solo se miraba hL2, dejando corto el día si había un
        //      tren enlazado después.
        if(origenDinero2.tipo==='ordinario'){
          var finRebaseVuelta = (origenDinero2.hF2&&origenDinero2.hL2) ? origenDinero2.hL2 : null;
          if(origenDinero2.continuidadVuelta && origenDinero2.continuidadVuelta.length){
            var ultContVRebase = origenDinero2.continuidadVuelta[origenDinero2.continuidadVuelta.length-1];
            if(ultContVRebase && ultContVRebase.horaFin) finRebaseVuelta = ultContVRebase.horaFin;
          }
          var spanRebaseVuelta = (origenDinero2.hF2&&finRebaseVuelta) ? calcMins(origenDinero2.hF2, finRebaseVuelta) : 0;
          var minRebaseVuelta = Math.max(0, spanRebaseVuelta - 540);
          if(minRebaseVuelta>0){
            var hRebaseVuelta = Math.round(minRebaseVuelta/60*100)/100;
            tRebase += hRebaseVuelta*REBASE;
            dRebase.push({lbl:dL, tren:origenDinero2.numTren||'', horas:hRebaseVuelta, importe:Math.round(hRebaseVuelta*REBASE*100)/100});
          }
        }

        // ── Plus Traslación (Art. 58) — "un euro bruto por hora que
        // exceda de las 8 primeras horas desde el deje del servicio
        // hasta la toma del viaje siguiente". Reutiliza
        // checkDescansoInternoPernocta() (solo lectura, ya existente)
        // para el descanso real entre ida y vuelta — no duplica esa
        // matemática. Confirmado por el propio convenio: "el Plus de
        // traslación de los viajes que se inician en un mes y
        // finalizan en el siguiente se computarán en el mes en que
        // finalicen" — por eso se cuenta aquí, en la celda de
        // llegada, igual que ya hacemos con todo lo demás de la
        // vuelta.
        if(typeof checkDescansoInternoPernocta==='function'){
          var _descansoTrasl = checkDescansoInternoPernocta(origenDinero2);
          if(_descansoTrasl && _descansoTrasl.descMin){
            var minExcesoTrasl = Math.max(0, _descansoTrasl.descMin - 480); // 480min = 8h
            if(minExcesoTrasl>0){
              var hExcesoTrasl = Math.round(minExcesoTrasl/60*100)/100;
              tPlusTrasl += hExcesoTrasl*PLUSTRASL;
              dPlusTrasl.push({lbl:dL, tren:origenDinero2.numTren||'', horas:hExcesoTrasl, importe:Math.round(hExcesoTrasl*PLUSTRASL*100)/100});
            }
          }
        }

        // ── HTDL económico de la vuelta (solo si el origen es
        // trabajado/art5152 y se paga en dinero, no en días) ──
        if((origenDinero2.tipo==='trabajado'||origenDinero2.tipo==='art5152') && origenDinero2.comp==='dinero'){
          var hV2 = (origenDinero2.hF2&&origenDinero2.hL2) ? Math.round(calcMins(origenDinero2.hF2,origenDinero2.hL2)/60*100)/100 : 0;
          var minContinuidadVueltaHTDLb = 0;
          var minEscalaHTDLb = 0;
          if(origenDinero2.continuidadVuelta && origenDinero2.continuidadVuelta.length){
            origenDinero2.continuidadVuelta.forEach(function(c){
              if(c.horaInicio && c.horaFin) minContinuidadVueltaHTDLb += calcMins(c.horaInicio, c.horaFin);
              if(c.escalaMin!=null && c.escalaMin>0) minEscalaHTDLb += c.escalaMin;
            });
          }
          var hContinuidadVueltaHTDLb = Math.round(minContinuidadVueltaHTDLb/60*100)/100;
          var hEscalaHTDLb = Math.round(minEscalaHTDLb/60*100)/100;
          // NOTA — el "enlace de jornada" (dormida por debajo del
          // mínimo legal) NO se calcula aquí — ya lo cubre, por
          // separado, el mecanismo existente
          // checkDescansoInternoPernocta() más abajo en esta misma
          // función (sección "Descanso INTERNO de una pernocta").
          // Sumarlo también aquí lo contaría dos veces. Ese mecanismo,
          // de momento, sigue atado al mes del día de ORIGEN — no se
          // ha movido al mes de la vuelta todavía (pendiente, a
          // decidir aparte si Alex lo pide).
          var hVueltaPortionHTDL = Math.round((hV2+hContinuidadVueltaHTDLb+hEscalaHTDLb+hRetT2b)*100)/100;
          if(hVueltaPortionHTDL>0){
            hHTDL += hVueltaPortionHTDL;
            tH += hVueltaPortionHTDL*HTDL;
            dHTDL.push({
              lbl: dL,
              lblVuelta: null,
              tren: origenDinero2.numTren||'',
              esPernocta: true,
              soloVuelta: true,
              hIda: 0, hEscala: hEscalaHTDLb, hContinuidad: 0, hContinuidadVuelta: hContinuidadVueltaHTDLb,
              hVuelta: hV2, hRetT2: hRetT2b, minRetT2: minRetT2b, hExtra: 0,
              hTotal: hVueltaPortionHTDL,
              importe: Math.round(hVueltaPortionHTDL*HTDL*100)/100
            });
          }
        }
      }
    }
    if(['reserva','descanso','baja'].includes(t.tipo)){
      if(t.plusAct){tA+=P_ACT;dA.push(dL);}if(t.plusJT){tJ+=P_JT;dJ.push(dL);}if(t.plusIntlAuto){tI+=P_INTL;dI.push(dL);}
    }
    // NUEVO — dinero de turnos adicionales (TV2) HTDL/Art.51-52
    // INDEPENDIENTES del principal (p.ej. "He trabajado este descanso"
    // con el principal en Ordinario). Antes nunca se contaban aquí —
    // solo se procesaba TV[k] (el principal) — así que ni el dinero ni
    // la ficha en el desglose de HTDL aparecían para estos días. Se
    // excluye a propósito el caso donde el principal YA es HTDL/Art52
    // (ese ya lo procesa el bloque de arriba, "TURNOS ADICIONALES (TV2)
    // EN DÍA HTDL", para no sumar el mismo turno dos veces).
    if(TV2[k] && TV2[k].length && t.tipo!=='trabajado' && t.tipo!=='art5152'){
      TV2[k].forEach(function(ex){
        if(!ex || !ex.independienteDeTipoPrincipal) return;
        if(ex.tipo!=='trabajado' && ex.tipo!=='art5152') return;
        // 'dias'/'mix' en un adicional independiente: no se procesan
        // como dinero aquí todavía (fuera de alcance de este fix). Los
        // registros existentes sin campo comp (guardados antes de este
        // fix) se tratan como 'dinero' — es lo que el usuario esperaba
        // ver, y es la opción por defecto del formulario.
        if(ex.comp && ex.comp!=='dinero') return;
        var esPernoctaEx = (ex.modo==='pernocta'||ex.modo==='pernocta3');
        var hIdaEx = (ex.hF&&ex.hL) ? Math.round(calcMins(ex.hF,ex.hL)/60*100)/100 : 0;
        var hVueltaEx = (ex.hF2&&ex.hL2) ? Math.round(calcMins(ex.hF2,ex.hL2)/60*100)/100 : 0;
        var hEscalaEx = 0;
        if(!esPernoctaEx && ex.hL && ex.hF2){
          var huecoEx = calcMins(ex.hL, ex.hF2);
          if(huecoEx>0) hEscalaEx = Math.round(huecoEx/60*100)/100;
        }
        var hComputableEx = Math.round((hIdaEx+hEscalaEx+hVueltaEx)*100)/100;
        if(hComputableEx<=0) return;
        hHTDL += hComputableEx;
        tH += hComputableEx*HTDL;
        dHTDL.push({
          lbl: dL,
          lblVuelta: (function(){
            if(!esPernoctaEx || !ex.diaSiguiente) return null;
            var pV = ex.diaSiguiente.split('-');
            return parseInt(pV[2])+' '+MESES_C[parseInt(pV[1])-1];
          })(),
          tren: ex.numTren||'',
          esPernocta: esPernoctaEx,
          hIda: hIdaEx, hEscala: hEscalaEx,
          hContinuidad: 0, hContinuidadVuelta: 0,
          hVuelta: hVueltaEx, hRetT2: 0, minRetT2: 0, hExtra: 0,
          hTotal: hComputableEx,
          importe: Math.round(hComputableEx*HTDL*100)/100,
          esAdicional: true
        });
        if(ex.nocturno){
          var nEx = cn(ex.hF, ex.hL) + cn(ex.hF2, ex.hL2);
          if(nEx>0){
            tN += nEx*NOC;
            dN.push({lbl:dL, tren:ex.numTren||'', hF1:ex.hF, hL1:ex.hL, hF2:ex.hF2, hL2:ex.hL2, hNoc:nEx, importe:Math.round(nEx*NOC*100)/100});
          }
        }
        if(ex.plusAct){tA+=P_ACT;dA.push(dL);}
        if(ex.plusJT){tJ+=P_JT;dJ.push(dL);}
        if(ex.plusIntlAuto){tI+=P_INTL;dI.push(dL);}
      });
    }
   } catch(errDia){
     // NUEVO — diagnóstico visible sin herramientas de desarrollador:
     // si el cálculo de UN día concreto falla, antes rompía todo el
     // bucle silenciosamente (los días siguientes del mes se quedaban
     // sin sumar, sin ningún aviso). Ahora se avisa con el día y el
     // error exactos — con alert() en vez de toast() para que el
     // mensaje se quede fijo en pantalla (el toast desaparece solo a
     // los 2,5s, muy poco tiempo para leerlo y copiarlo) — y se sigue
     // con el resto del mes.
     console.error('Error calculando el día', k, errDia);
     alert('⚠️ Error calculando '+k+':\n'+(errDia&&errDia.message||errDia)+'\n\n(Haz captura de esto y envíasela a soporte)');
   }
  });

  // ── Enlaces de jornada: descanso incumplido entre días consecutivos ──
  // Puramente aditivo: construido sobre calcularEnlaceJornada(), que a
  // su vez reutiliza checkRestTime() sin duplicar su matemática. No
  // toca ningún dato de TV, solo decide en qué contador entra el
  // tiempo de descanso incumplido — SIEMPRE el hueco COMPLETO entre el
  // final de un turno y el inicio del siguiente, no solo lo que falta
  // para llegar al mínimo exigido — según la matriz de decisión:
  //   Ordinaria + Ordinaria           → Horas de Presencia (minPresenciaCal).
  //   HTDL/Art.51-52 + HTDL/Art.51-52 → Impacto Económico (hHTDL / tH),
  //                                     con la tarifa del lado que corresponda.
  //   Cualquier combinación MIXTA
  //   (un lado Ordinaria, el otro
  //   HTDL/Art.51-52)                 → no se suma a ningún contador; el
  //                                     aviso ya se muestra en el banner
  //                                     del día (ALERTAS_DESCANSO / avisoNoComputa).
  var ksOrdenados = ks.slice().sort();
  for(var iEnl=1; iEnl<ksOrdenados.length; iEnl++){
    var kAEnl=ksOrdenados[iEnl-1], kBEnl=ksOrdenados[iEnl];
    var tAEnl=TV[kAEnl], tBEnl=TV[kBEnl];
    if(!tAEnl || !tBEnl) continue;
    if(['descanso','baja','comp','reserva'].indexOf(tAEnl.tipo)>=0) continue;
    if(['descanso','baja','comp','reserva'].indexOf(tBEnl.tipo)>=0) continue;
    // FIX — Confirmado por el usuario: en un día con más de un turno
    // guardado (TV2), el que de verdad termina más tarde (o empieza
    // más temprano) puede no ser el turno principal — usar siempre
    // TV[k] hacía que el descanso, y con él las horas/el dinero del
    // enlace, se calculara mal en esos días.
    var tAEnlReal = _turnoFinDelDia(kAEnl) || tAEnl;
    var tBEnlReal = _turnoInicioDelDia(kBEnl) || tBEnl;
    var enlace = calcularEnlaceJornada(tAEnlReal, tBEnlReal, kAEnl, kBEnl);
    if(!enlace.incumple) continue;
    if(enlace.computaPresencia){
      // FIX — Confirmado por el usuario (corrige un error suyo
      // anterior, que hizo que esto se sumara mal a Efectivas): en
      // Ordinaria+Ordinaria, TODO el tiempo entre el final de un
      // turno y el inicio del siguiente (no solo lo que falta para
      // llegar al mínimo exigido) cuenta como Horas de PRESENCIA —
      // desde que se deja el turno anterior hasta la firma del
      // siguiente. NUNCA se paga en dinero. Mismo valor ya calculado
      // por checkRestTime() (enlace.descMin, el hueco completo), solo
      // cambia a qué contador se suma.
      minPresenciaCal += enlace.descMin;
    } else if(enlace.computaFinanciero){
      // FIX — HTDL y Art.51/52 tienen tarifas DISTINTAS. Se usa la
      // del turno que recibe el enlace (tBEnlReal): si es Art.51/52, su
      // propia tarifa configurada (AJ.art5152Monto); si es HTDL
      // ('trabajado'), la tarifa HTDL (AJ.vh, variable HTDL ya
      // existente). Solo las horas de HTDL puro se suman a hHTDL
      // (esa cifra alimenta la fila "⏱ HTDL Xh × Y€" del desglose,
      // que usa la tarifa HTDL — mezclar horas de Art.51/52 ahí
      // descuadraría esa fila).
      var horasEnlaceHTDL = Math.round((enlace.descMin/60)*100)/100;
      // FIX — ahora computaFinanciero=true SOLO cuando tipoEnlace es
      // 'HTDL_HTDL' (los dos lados son HTDL/Art.51-52, en cualquier
      // combinación) — el caso mixto con una Ordinaria ya no llega
      // aquí (avisoNoComputa). La tarifa se elige por si alguno de
      // los dos lados es Art.51/52.
      var turnoTarifaEnl = (tBEnlReal.tipo==='art5152') ? tBEnlReal : (tAEnlReal.tipo==='art5152' ? tAEnlReal : tAEnlReal);
      if(turnoTarifaEnl.tipo==='art5152'){
        var tarifaArtEnl = parseFloat(AJ.art5152Monto)||0;
        tH += horasEnlaceHTDL*tarifaArtEnl;
      } else {
        hHTDL += horasEnlaceHTDL;
        tH += horasEnlaceHTDL*HTDL;
      }
    }
  }

  // ── NUEVO — Descanso INTERNO de una pernocta (tramo1 llegada → tramo2
  // firma, dentro del MISMO registro guardado). Mismo criterio de
  // reparto que los enlaces entre días de arriba:
  //   Ordinaria (pernocta)          → Horas Efectivas (minEfectivasCal).
  //   HTDL o Art.51/52 (pernocta)   → Impacto Económico (hHTDL / tH).
  // Reutiliza checkDescansoInternoPernocta() (solo lectura, ya
  // existente) — no duplica su matemática ni toca TV.
  ks.forEach(function(kInt){
    var tInt = TV[kInt];
    if(!tInt) return;
    if(['ordinario','trabajado','art5152'].indexOf(tInt.tipo)<0) return;
    var esPernoctaInt = (tInt.modo==='pernocta'||tInt.modo==='pernocta3');
    if(!esPernoctaInt) return;
    var rInterno = checkDescansoInternoPernocta(tInt);
    if(!rInterno || !rInterno.incumple) return;
    // FIX — misma corrección de tarifa: Art.51/52 usa su propia
    // tarifa (AJ.art5152Monto), HTDL usa la suya (AJ.vh / HTDL). Solo
    // las horas de HTDL puro alimentan hHTDL (para no descuadrar la
    // fila "⏱ HTDL Xh × Y€" del desglose).
    if(tInt.tipo==='trabajado'){
      var horasInternoHTDL = Math.round((rInterno.descMin/60)*100)/100;
      hHTDL += horasInternoHTDL;
      tH += horasInternoHTDL*HTDL;
    } else if(tInt.tipo==='art5152'){
      var horasInternoArt = Math.round((rInterno.descMin/60)*100)/100;
      var tarifaArtInt = parseFloat(AJ.art5152Monto)||0;
      tH += horasInternoArt*tarifaArtInt;
    } else {
      // Ordinaria: nunca se paga en dinero, solo Horas Efectivas.
      minEfectivasCal += rInterno.descMin;
    }
  });

  // ── NUEVO — Baja Médica: si es la PRIMERA baja del año y el turno
  // que sustituyó era Ordinaria o Reserva, esas horas SÍ deben seguir
  // contando en Registro App (Efectivas/Presencia) — la empresa se
  // hace cargo económicamente, pero el cómputo de horas de esa
  // jornada no cambia. Si el turno pisado era HTDL o Art.51/52, NUNCA
  // cuenta aquí (tienen su propio contador económico aparte, con o
  // sin baja).
  // ACTUALIZADO — regla de retribución de bajas:
  //   Primera baja del año            → 100% de las horas (presencia y efectivas).
  //   NO es la primera (días 1-3)     → 0% (descuento total, sin retribución).
  //   NO es la primera (día 4 y sig.) → 75% de las horas acumuladas.
  // Reutiliza calcularJornadaDiaria() ya existente sobre el turno
  // pisado guardado en TV — solo lectura, no se modifica TV.
  ks.forEach(function(kBaja){
    var tBaja = TV[kBaja];
    if(!tBaja || tBaja.tipo!=='baja' || !tBaja.turnoPisado) return;
    var tipoPisado = tBaja.turnoPisado.tipo;
    if(tipoPisado!=='ordinario' && tipoPisado!=='reserva') return; // HTDL/Art.51-52 nunca cuentan aquí

    var factorRetribucion = 0;
    if(tBaja.primeraBajaAnio === true){
      factorRetribucion = 1; // 100%
    } else if(tBaja.primeraBajaAnio === false){
      var indiceDia = tBaja.diaIndiceBaja || 1;
      factorRetribucion = (indiceDia >= 4) ? 0.75 : 0; // 75% desde el 4º día; 0% en los 3 primeros
    }
    if(factorRetribucion <= 0) return;

    var jornadaPisada = calcularJornadaDiaria([tBaja.turnoPisado], kBaja);
    minEfectivasCal += Math.round(jornadaPisada.efectivasMin * factorRetribucion);
    minPresenciaCal += Math.round(jornadaPisada.presenciaMin * factorRetribucion);
  });

  // diasHTDL is now array of objects with detail
  var diasHTDLlbl=dHTDL.map(function(d){return d.tren?d.lbl+' #'+d.tren:d.lbl;});
  return{HTDL:HTDL,NOC:NOC,REBASE:REBASE,PLUSTRASL:PLUSTRASL,
    totalHTDL:Math.round(tH*100)/100,totalNoc:Math.round(tN*100)/100,
    totalAct:Math.round(tA*100)/100,totalJT:Math.round(tJ*100)/100,totalIntl:Math.round(tI*100)/100,
    // NUEVO — Confirmado por Alex (Art. 64 y 58 del Convenio): Rebase
    // y Plus Traslación, calculados desde el calendario — antes solo
    // se podían leer del Excel oficial. Se suman también al Bruto,
    // igual que el resto de conceptos variables.
    totalRebase:Math.round(tRebase*100)/100,totalPlusTrasl:Math.round(tPlusTrasl*100)/100,
    totalBruto:Math.round((tH+tN+tA+tJ+tI+tRebase+tPlusTrasl)*100)/100,
    totalHoras:Math.round(tHr*100)/100,horasHTDL:Math.round(hHTDL*100)/100,
    horasRebase:Math.round(dRebase.reduce(function(s,d){return s+d.horas;},0)*100)/100,
    horasPlusTrasl:Math.round(dPlusTrasl.reduce(function(s,d){return s+d.horas;},0)*100)/100,
    efectivasCalMin:minEfectivasCal,presenciaCalMin:minPresenciaCal,
    efectivasHTDLMin:minEfectivasHTDL,presenciaHTDLMin:minPresenciaHTDL,
    diasNocDetail:dN,
    diasNoc:dN.map(function(d){return typeof d==='object'?d.lbl+(d.tren?' #'+d.tren:''):d;}),
    diasAct:dA,diasJT:dJ,diasIntl:dI,
    diasHTDL:diasHTDLlbl,diasHTDLdetail:dHTDL,
    diasRebaseDetail:dRebase,diasPlusTraslDetail:dPlusTrasl,
    retrasos:retMes};
}
