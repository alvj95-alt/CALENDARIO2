/* TrenTurnos v5 — Cálculo de jornada diaria y continuidad
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   calcularJornadaDiaria(turnos, fecha) — ÚNICA fuente de verdad
   para Horas Efectivas / Presencia de UN día completo.
   Recibe TODOS los turnos de ese día (turno principal + turnos
   adicionales, vía getTurnosDia(k)) y devuelve:
     { efectivasMin, presenciaMin, esHTDL }
   Reglas aplicadas, en este orden:
     1) Ordinario/Trabajado: su propia duración (ida+vuelta) a
        Efectivas; DH y escalas de continuidad, igual que antes,
        a Presencia (o restando de Efectivas si el DH es del
        mismo tren — ver comentarios inline).
     2) Reserva: sin activar → 8h fijas de Presencia. Activada →
        de "hora toma" a "hora llegada del tren" es Efectivas;
        el resto hasta completar 8h sigue siendo Presencia.
     3) Hueco de Presencia: si hay 2+ turnos ordinario/trabajado
        ese día, el tiempo entre el fin de uno y el inicio del
        siguiente se suma a Presencia (nunca a Efectivas).
   esHTDL=true si CUALQUIER turno del día es 'trabajado' — así el
   llamante decide en qué acumulador (ordinario o HTDL) sumar el
   resultado, sin que este cálculo interno sepa nada de esa
   segregación (responsabilidad de calculateEarnings).
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   NUEVO — calcularContinuidad(tipoJornada)
   Resuelve a qué "bucket" de STATS pertenece un tramo de continuidad
   según el tipo de jornada al que está asociado: 'general' (jornada
   ordinaria) o 'HTDL' (trabajado / art5152).

   IMPORTANTE — por qué NO suma nada aquí:
   La suma real de los tramos de continuidad YA ocurre dentro de
   calcularJornadaDiaria() (más abajo), que agrega sus minutos a
   efectivas/presencia del día, y calculateEarnings() ya enruta esos
   minutos a minEfectivasCal/minPresenciaCal (general) o
   minEfectivasHTDL/minPresenciaHTDL (HTDL) según el flag esHTDL de
   esa jornada. Si esta función volviera a sumar los mismos minutos
   en un objeto aparte (statsGeneral/statsHTDL), el resultado final
   se DUPLICARÍA. Por eso calcularContinuidad() es una función pura
   de solo lectura: únicamente informa el destino correcto, para
   usarlo en etiquetas del formulario y del pop-up (por ejemplo,
   "Este tramo aparecerá en HTDL"), nunca para sumar minutos.
═══════════════════════════════════════════════════════════ */
function calcularContinuidad(tipoJornada){
  return (tipoJornada==='trabajado' || tipoJornada==='HTDL' || tipoJornada==='art5152')
    ? 'HTDL'
    : 'general';
}

function calcularJornadaDiaria(turnos, fecha){
  // FIX — antes había una única bandera esHTDL para TODO el día: si
  // CUALQUIER turno del día era 'trabajado'/'art5152', el día entero
  // (incluidas las horas del Turno Principal Ordinario) se enrutaba
  // al bucket HTDL, dejando Efectivas/Presencia ordinarias en 0. Esto
  // se rompía en cuanto existía un día mixto (Turno Principal
  // Ordinario + Turno Adicional HTDL vía "He trabajado este
  // descanso"). Ahora cada turno decide su PROPIO bucket según su
  // propio tipo, y se devuelven los 4 totales por separado — el
  // llamante ya no elige "uno u otro", suma ambos siempre.
  var efectivasCal = 0, presenciaCal = 0;
  var efectivasHTDL = 0, presenciaHTDL = 0;
  var intervalosCal = [], intervalosHTDL = []; // huecos: solo entre turnos del MISMO bucket

  (turnos||[]).forEach(function(t){
    if(!t) return;
    // Turno Intercambiado / Referencia Informativa: no suma nada a
    // ningún contador — ni Efectivas, ni Presencia, ni huecos de
    // escala. Filtro EXPLÍCITO por las dos propiedades posibles
    // (turno_referencia_externa es la actual; esTurnoIntercambiado se
    // mantiene por compatibilidad con registros ya guardados). Es la
    // única condición que activa este comportamiento; cualquier turno
    // sin ninguna de las dos sigue calculándose exactamente igual que
    // siempre — el objeto jornada original del usuario, sin tocar.
    if(t.turno_referencia_externa || t.esTurnoIntercambiado) return;

    // NUEVO — Confirmado por Alex: si este turno tiene horas GRABADAS
    // (se congelaron en el momento exacto en que pasó a secundario,
    // ver _escribirCopiaTurno()/_escribirDiaPernoctaConDemota()), se
    // usan tal cual, sin volver a calcular nada — así quedan
    // garantizadas pase lo que pase con el resto del día. Esto NO
    // sustituye al cálculo normal para turnos nuevos, solo aplica a
    // los ya congelados en su momento.
    if(t._horasGarantizadas){
      efectivasCal  += t._horasGarantizadas.efectivasMin||0;
      presenciaCal  += t._horasGarantizadas.presenciaMin||0;
      efectivasHTDL += t._horasGarantizadas.efectivasHTDLMin||0;
      presenciaHTDL += t._horasGarantizadas.presenciaHTDLMin||0;
      return;
    }
    // FIX — bucket POR TURNO, no por día completo.
    var esHTDLEste = (t.tipo==='trabajado' || t.tipo==='art5152');

    // NUEVO: art5152 se procesa con el mismo bloque de cálculo que
    // ordinario/trabajado (comparte exactamente los mismos campos:
    // hF/hL/hF2/hL2/continuidad/continuidadVuelta), para que sus
    // tramos de continuidad también se contabilicen. esHTDLEste ya
    // enruta este turno concreto al bucket HTDL, sin afectar a los
    // demás turnos del mismo día.
    if(t.tipo==='ordinario' || t.tipo==='trabajado' || t.tipo==='art5152'){
      var minI = (t.hF&&t.hL) ? calcMins(t.hF,t.hL) : 0;
      var minV = (t.hF2&&t.hL2) ? calcMins(t.hF2,t.hL2) : 0;

      // Escala entre ida y vuelta del MISMO turno (mismo día): el hueco
      // entre la llegada de ida (hL) y la salida de vuelta (hF2) es
      // tiempo de Presencia obligatorio — nunca se descarta ni se
      // cuenta como Efectivas.
      // FIX — esto solo vale cuando ida y vuelta son del MISMO día
      // (modo 'ida'). En una pernocta (modo 'pernocta'/'pernocta3'),
      // hL es la llegada del día 1 y hF2 es la salida del día 2:
      // calcMins() da la vuelta al reloj cuando hF2 < hL (para poder
      // calcular jornadas nocturnas normales), así que sin este
      // filtro el descanso nocturno ENTERO de la pernocta se estaba
      // sumando a Presencia como si fuera una escala del mismo día.
      // En pernocta ese descanso no debe contar para nada.
      var esPernoctaTurno = (t.modo==='pernocta' || t.modo==='pernocta3');

      // NUEVO — Confirmado por Alex (Opción A: repartir por mes real,
      // cuidando de no romper nada más): en pernocta, la parte de
      // VUELTA (minV, su propio DH, su continuidadVuelta y el retraso
      // del tramo 2) ya NO se cuenta aquí — se mueve a la rama
      // 'vuelta-pernocta' más abajo, que vive en la celda del día
      // REAL de llegada. Así, si ida y vuelta caen en el mismo mes
      // (el caso normal), el total del mes no cambia — solo se
      // reparte entre las dos celdas; si cruzan de mes, cada parte
      // cuenta para su mes de verdad. Para un turno NO-pernocta (ida
      // y vuelta el mismo día), nada de esto cambia: sigue exactamente
      // igual que antes.
      var efEste = esPernoctaTurno ? minI : (minI + minV);
      var prEste = 0;

      // FIX — cuando la ida tiene tramos de continuidad (más de un
      // tren), el hueco hacia la vuelta se estaba midiendo SIEMPRE
      // desde t.hL — que es el fin del PRIMER tramo de la ida, no el
      // último. Si había continuidad, ese hueco se solapaba con el
      // trabajo real de esos tramos (ya contado aparte como
      // Efectivas) y con su propia escala (ya contada aparte como
      // Presencia), contando dos veces el mismo tiempo — de ahí
      // salían totales inflados. Ahora se usa el fin del ÚLTIMO
      // tramo de continuidad de la ida cuando existe; si no hay
      // continuidad, sigue siendo t.hL, exactamente como antes.
      var finIdaReal = t.hL;
      if(t.continuidad && t.continuidad.length){
        var ultimoTramoIda = t.continuidad[t.continuidad.length-1];
        if(ultimoTramoIda && ultimoTramoIda.horaFin) finIdaReal = ultimoTramoIda.horaFin;
      }
      if(!esPernoctaTurno && finIdaReal && t.hF2){
        var huecoIdaVuelta = calcMins(finIdaReal, t.hF2);
        if(huecoIdaVuelta>0){
          // FIX — a petición del usuario: para el CONTEO de horas
          // (Efectivas/Presencia en Stats), HTDL/Art.51-52 cuentan
          // exactamente igual que jornada ordinaria — la escala entre
          // ida y vuelta es Presencia, no Efectivas, sea cual sea el
          // tipo de turno. El DINERO sigue pagando el bloque completo
          // igual que siempre (eso vive en calculateEarnings, con su
          // propia variable hEscalaHTDL — no se toca aquí); esto es
          // solo el desglose de horas que se muestra en Stats.
          prEste += huecoIdaVuelta;
        }
      }

      if(t.estadoServicio==='dh' && typeof t.dhMismoTren==='boolean' && t.dhMinutos!=null){
        if(t.dhMismoTren) efEste = Math.max(0, efEste - t.dhMinutos);
        prEste += t.dhMinutos;
      }
      // NUEVO — DH de vuelta: solo se aplica aquí si NO es pernocta
      // (mismo día). En pernocta, esto se mueve a la rama
      // 'vuelta-pernocta', que ya usa este mismo campo pero leído
      // desde la celda de llegada.
      if(!esPernoctaTurno && t.estadoServicioVuelta==='dh' && typeof t.dhMismoTrenVuelta==='boolean' && t.dhMinutosVuelta!=null){
        if(t.dhMismoTrenVuelta) efEste = Math.max(0, efEste - t.dhMinutosVuelta);
        prEste += t.dhMinutosVuelta;
      }
      // NUEVO — continuidadVuelta: solo se procesa aquí si NO es
      // pernocta — en pernocta se mueve también a la rama
      // 'vuelta-pernocta'. La continuidad de IDA (t.continuidad)
      // sigue procesándose siempre aquí, sea o no pernocta.
      var _arraysContinuidad = esPernoctaTurno ? [t.continuidad] : [t.continuidad, t.continuidadVuelta];
      _arraysContinuidad.forEach(function(arr){
        if(!arr || !arr.length) return;
        arr.forEach(function(c){
          if(c.horaInicio && c.horaFin){
            var durC = calcMins(c.horaInicio, c.horaFin);
            // FIX — el DH de un tramo de continuidad es PARCIAL (desde/
            // hasta una estación concreta dentro del tramo, no el tramo
            // entero — ver abrirDHContinuidadPopup). Antes, marcar DH
            // mandaba TODA la duración del tramo a Presencia, aunque
            // solo una parte fuera realmente sin trabajar — de ahí
            // salían horas "raras". Ahora: si hay rango parcial
            // (dhHoraInicio/dhHoraFin), solo ESOS minutos van a
            // Presencia y el resto del tramo sigue siendo Efectiva.
            // Si el tramo está marcado 'dh' pero SIN rango parcial
            // (turnos guardados antes de que existiera esa opción, con
            // el interruptor simple de todo-o-nada), se mantiene el
            // comportamiento anterior: el tramo entero va a Presencia.
            if(c.tipoTramo==='dh'){
              if(c.dhHoraInicio && c.dhHoraFin){
                var durDH = calcMins(c.dhHoraInicio, c.dhHoraFin);
                durDH = Math.min(durDH, durC); // nunca más que el propio tramo
                prEste += durDH;
                efEste += Math.max(0, durC - durDH);
              } else {
                prEste += durC;
              }
            } else {
              efEste += durC;
            }
          }
          // FIX — a petición del usuario: la escala de un tramo de
          // continuidad también cuenta como Presencia en HTDL/
          // Art.51-52 para el desglose de Stats, exactamente igual
          // que en jornada ordinaria. El dinero (calculateEarnings)
          // sigue sin tocarse.
          if(c.escalaMin!=null && c.escalaMin>0){
            prEste += c.escalaMin;
          }
        });
      });

      // FIX — Retraso del tramo de VUELTA (tramo 2): suma a Efectivas
      // en todos los tipos de turno (ordinario, HTDL, Art.51/52) —
      // salvo en pernocta, donde ahora se cuenta en la rama
      // 'vuelta-pernocta' (vive de verdad en la celda de llegada).
      // El retraso del tramo de IDA (tramo 1) es solo informativo —
      // nunca cambia ninguna hora.
      if(!esPernoctaTurno){
        var minRetT2 = 0;
        if(t.retrasos && t.retrasos.length){
          t.retrasos.forEach(function(r){ if(r.tramo===2) minRetT2 += r.minutos||0; });
        } else if(t.retrasoMin>0 && !t.retrasos){
          minRetT2 += t.retrasoMin; // retraso legacy sin tramo: se trata como T2
        }
        efEste += minRetT2;
      }

      // FIX — cada turno suma a SU bucket (Cal u HTDL) según su
      // propio tipo, no al del día completo.
      if(esHTDLEste){ efectivasHTDL += efEste; presenciaHTDL += prEste; }
      else { efectivasCal += efEste; presenciaCal += prEste; }

      // Límites del turno (inicio de ida → fin de vuelta, o fin de ida
      // si no hay vuelta) para poder calcular el hueco con el siguiente
      // turno del MISMO bucket.
      // NUEVO — en pernocta, el "fin" de este bloque (para huecos con
      // otro turno del MISMO día) es el fin de la IDA, no de la
      // vuelta (que ahora vive en otro día/celda por completo).
      var inicioMin = t.hF ? _horasToMin(t.hF) : null;
      var finMin = (!esPernoctaTurno && t.hF2&&t.hL2) ? _horasToMin(t.hL2) : (t.hL ? _horasToMin(t.hL) : null);
      if(inicioMin!=null && finMin!=null){
        (esHTDLEste?intervalosHTDL:intervalosCal).push({inicio:inicioMin, fin:finMin});
      }

    } else if(t.tipo==='vuelta-pernocta'){
      // NUEVO — Confirmado por Alex (Opción A): esta es la celda del
      // día REAL de llegada de una pernocta. Antes no contaba nada
      // (todo se contaba de golpe en el día de origen/salida) — ahora
      // recupera aquí la parte de VUELTA (sus propias horas, su DH,
      // su continuidadVuelta y el retraso del tramo 2), leyéndolas
      // del turno de origen (TV[origenPernocta]), que es donde siguen
      // guardadas de verdad. Así, esta celda se lleva sus horas para
      // SU PROPIO mes/día real, en vez de que se las lleve siempre el
      // día de salida — que es justo lo que arregla que una pernocta
      // que cruza de mes contara mal las horas de vuelta.
      var origenV = t.origenPernocta ? TV[t.origenPernocta] : null;
      if(origenV && (origenV.tipo==='ordinario' || origenV.tipo==='trabajado' || origenV.tipo==='art5152')){
        var esHTDLVuelta = (origenV.tipo==='trabajado' || origenV.tipo==='art5152');
        var efV = (origenV.hF2&&origenV.hL2) ? calcMins(origenV.hF2,origenV.hL2) : 0;
        var prV = 0;
        if(origenV.estadoServicioVuelta==='dh' && typeof origenV.dhMismoTrenVuelta==='boolean' && origenV.dhMinutosVuelta!=null){
          if(origenV.dhMismoTrenVuelta) efV = Math.max(0, efV - origenV.dhMinutosVuelta);
          prV += origenV.dhMinutosVuelta;
        }
        if(origenV.continuidadVuelta && origenV.continuidadVuelta.length){
          origenV.continuidadVuelta.forEach(function(c){
            if(c.horaInicio && c.horaFin){
              var durC = calcMins(c.horaInicio, c.horaFin);
              if(c.tipoTramo==='dh'){
                if(c.dhHoraInicio && c.dhHoraFin){
                  var durDH = calcMins(c.dhHoraInicio, c.dhHoraFin);
                  durDH = Math.min(durDH, durC);
                  prV += durDH;
                  efV += Math.max(0, durC - durDH);
                } else {
                  prV += durC;
                }
              } else {
                efV += durC;
              }
            }
            if(c.escalaMin!=null && c.escalaMin>0){
              prV += c.escalaMin;
            }
          });
        }
        // Retraso del tramo 2: vive de verdad en ESTA celda (t.retrasos),
        // no en la de origen — mismo dato que ya leía antes la rama de
        // arriba vía TV[diaSiguiente], ahora leído directamente porque
        // "t" YA ES esa celda.
        var minRetT2v = 0;
        if(t.retrasos && t.retrasos.length){
          t.retrasos.forEach(function(r){ if(r.tramo===2) minRetT2v += r.minutos||0; });
        } else if(t.retrasoMin>0 && !t.retrasos){
          minRetT2v += t.retrasoMin;
        }
        efV += minRetT2v;

        if(esHTDLVuelta){ efectivasHTDL += efV; presenciaHTDL += prV; }
        else { efectivasCal += efV; presenciaCal += prV; }
      }

    } else if(t.tipo==='reserva'){
      // Reserva siempre va al bucket Cal (ordinaria) — no existe una
      // "reserva HTDL", igual que antes de este fix.
      if(t.reservaActiva && t.reservaHoraToma && t.reservaHoraLlegada){
        var trabajado = calcMins(t.reservaHoraToma, t.reservaHoraLlegada);
        efectivasCal += trabajado;
        presenciaCal += Math.max(0, 480 - trabajado); // resto hasta 8h de jornada
      } else if(t.reservaHoraToma && t.reservaHoraLlegada){
        // NUEVO — reserva con toma/deje registrados pero SIN pinchar
        // todavía: el intervalo completo computa como Presencia (no
        // como Efectivas). En cuanto se pincha/verifica (que convierte
        // la reserva en un turno 'ordinario' con tramos reales vía
        // verificarReserva(), sin tocar), las horas pasan a computarse
        // como Efectivas de forma natural, por la rama de arriba.
        var duracionReserva = calcMins(t.reservaHoraToma, t.reservaHoraLlegada);
        presenciaCal += duracionReserva;
      } else {
        presenciaCal += 480; // reserva sin ningún dato = 8h de Presencia por defecto
      }
    }
  });

  // ── Hueco de Presencia entre turnos del mismo día — solo dentro
  // del mismo bucket (Cal con Cal, HTDL con HTDL). Un hueco entre un
  // Turno Principal Ordinario y un Turno Adicional HTDL no es una
  // escala real de la misma jornada: son dos servicios distintos.
  function _sumarHuecos(arr){
    arr.sort(function(a,b){ return a.inicio - b.inicio; });
    var total = 0;
    for(var i=0; i<arr.length-1; i++){
      var hueco = arr[i+1].inicio - arr[i].fin;
      if(hueco>0) total += hueco;
    }
    return total;
  }
  presenciaCal  += _sumarHuecos(intervalosCal);
  presenciaHTDL += _sumarHuecos(intervalosHTDL);

  return {
    efectivasMin: Math.round(efectivasCal),
    presenciaMin: Math.round(presenciaCal),
    efectivasHTDLMin: Math.round(efectivasHTDL),
    presenciaHTDLMin: Math.round(presenciaHTDL),
    // esHTDL: compat — true si TODO lo que hay en este día es HTDL y
    // nada es Cal (día HTDL "puro", el caso normal antes de hoy).
    // Ya no decide el enrutado (los llamantes nuevos usan los 4
    // campos de arriba), solo se mantiene por si algún llamante
    // antiguo todavía lo lee.
    esHTDL: (efectivasCal===0 && presenciaCal===0 && (efectivasHTDL>0 || presenciaHTDL>0))
  };
}
