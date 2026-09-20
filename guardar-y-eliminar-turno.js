/* TrenTurnos v5 — Guardar y eliminar turno
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════
   GUARDAR TURNO
═══════════════════════════════════════ */
// NUEVO — Confirmado por Alex: cuando el día de vuelta/intermedio de
// una pernocta ya tenía un turno REAL guardado, ya no se protege sin
// tocar (eso dejaba una nota informativa sin datos reales) — pasa a
// SECUNDARIO conservando TODOS sus datos tal cual (si es Ordinario,
// sus horas siguen sumando a Efectivas/Presencia con normalidad, sin
// generar dinero aparte — el dinero extra solo lo genera HTDL/Art.51-
// 52, que Ordinario no tiene, así que no hay riesgo de duplicar
// nada). El día de vuelta/intermedio nuevo entra como PRINCIPAL, con
// la misma estructura que ya usa siempre esa celda (tipo
// 'vuelta-pernocta'/'pernocta3-intermedio'), para que se vea igual
// que cualquier otra (con compañeros, DH, etc., si esa información
// llega a calcularse ahí). Si el día estaba en descanso o vacío, se
// sobrescribe limpio, sin nada que conservar.
function _escribirDiaPernoctaConDemota(kDestino, kOrigen, nuevoDato){
  var existente = TV[kDestino];
  var esPunteroDeEstaMismaPernocta = existente && existente.origenPernocta === kOrigen;
  var esVacioODescanso = !existente || !existente.tipo || existente.tipo==='descanso';
  var esPunteroHuerfano = existente && (existente.tipo==='vuelta-pernocta' || existente.tipo==='pernocta3-intermedio');
  if(existente && !esVacioODescanso && !esPunteroDeEstaMismaPernocta && !esPunteroHuerfano){
    if(!TV2[kDestino]) TV2[kDestino]=[];
    var ddViejo={}; for(var campo in existente) ddViejo[campo]=existente[campo];
    // NUEVO — misma marca que en "Copiar turno": para que "TOTAL DEL
    // DÍA" no sume estas horas junto al nuevo día de vuelta/intermedio.
    // Stats del mes no se ve afectado, ahí sigue sumando igual.
    ddViejo.esAntiguoPrincipal = true;
    // NUEVO — mismas horas grabadas en el momento del pisado, ver el
    // comentario igual en _escribirCopiaTurno().
    try{
      ddViejo._horasGarantizadas = calcularJornadaDiaria([existente], kDestino);
    }catch(errGarantia){ /* si falla, se recalcula como siempre */ }
    TV2[kDestino].push(ddViejo);
  }
  TV[kDestino] = nuevoDato;
  saveTV2();
}

function guardarTurno(){
  if(_tv2_guardando){ guardarTurnoEnTV2(); return; }
  if(!selDay)return;
  var k=selDay.k, t=F.tipo;

  // NUEVO — Reserva (HTDL): validación ligera obligatoria. El
  // guardado en sí NO se separa del flujo normal — F.hF/F.hL ya
  // están rellenos desde secReservaHTDL(), así que sigue el mismo
  // camino compartido de 'trabajado' de siempre (sin tocarlo).
  if(t==='trabajado' && F.modoTrabajado==='reserva'){
    if(!F.hF || !F.hL){
      toast('⚠️ HTDL (Reserva) requiere hora de toma y de deje');
      return;
    }
  }

  // NUEVO — Reserva (Art.51/52): rama de guardado AUTOCONTENIDA y
  // separada del flujo normal de tramos. Se resuelve aquí por
  // completo y se sale con `return` — el resto de guardarTurno()
  // (tramos, rutas, pernoctas, DH) queda exactamente igual que antes
  // para el modo Normal.
  if(t==='art5152' && F.modoArt5152==='reserva'){
    if(!F.horaTomaArt || !F.horaDejeArt){
      toast('⚠️ Art. 51/52 (Reserva) requiere hora de toma y de deje');
      return;
    }
    var mesOrigenRes = k.slice(0,7), anioOrigenRes = k.slice(0,4);
    if(!_a5152SaltarAvisoMensual){
      if((ART5152_USO[mesOrigenRes]||0) >= 1){ _abrirAvisoLimiteArt5152('mensual'); return; }
      if((ART5152_USO_ANUAL[anioOrigenRes]||0) >= 3){ _abrirAvisoLimiteArt5152('anual'); return; }
    }
    _a5152SaltarAvisoMensual = false;

    var montoRes = parseFloat(AJ.art5152Monto)||0;
    var baseRes  = parseFloat(AJ.art5152ValorBase)||0;
    var horasRes = Math.round(calcMins(F.horaTomaArt,F.horaDejeArt)/60*100)/100;
    var importeRes = Math.round((horasRes*montoRes+baseRes)*100)/100;

    var dRes = {
      tipo:'art5152', modoArt5152:'reserva',
      horaTomaArt:F.horaTomaArt, horaDejeArt:F.horaDejeArt,
      horasEfectivas:horasRes, compensacion:'dinero', importe:importeRes,
      notas:F.notas||''
    };
    TV[k]=dRes; selDay.t=dRes; saveTV();
    if(typeof verificarDescansosMes==='function') ALERTAS_DESCANSO = verificarDescansosMes();

    ART5152_USO[mesOrigenRes] = (ART5152_USO[mesOrigenRes]||0)+1; _saveArt5152Uso();
    ART5152_USO_ANUAL[anioOrigenRes] = (ART5152_USO_ANUAL[anioOrigenRes]||0)+1; _saveArt5152UsoAnual();

    closeOv('ov-form');
    renderCal();
    renderStats();
    toast('✅ Reserva Art.51/52 guardada: '+horasRes+'h → '+importeRes.toFixed(2)+'€');
    return;
  }

  // ── NUEVO: validaciones y aviso normativo específicos de Art. 51/52 ──
  // (no afectan en absoluto a ordinario/trabajado/otros tipos)
  if(t==='art5152'){
    if(!F.numTren || !F.sal || !F.lle){
      toast('⚠️ Art. 51/52 requiere número de tren, estación de salida y de llegada');
      return;
    }
    var compEl = F.compArt5152||'dinero';
    if((compEl==='dinero'||compEl==='dias') && !_a5152SaltarAvisoMensual){
      var mesOrigenChk = k.slice(0,7);
      var anioOrigenChk = k.slice(0,4);
      if((ART5152_USO[mesOrigenChk]||0) >= 1){
        _abrirAvisoLimiteArt5152('mensual');
        return;
      }
      // NUEVO — límite anual (máx. 3 veces/año), universal para
      // pernocta e ida-vuelta desde el primer momento, igual que el
      // mensual. Mismo pop-up, mensaje adaptado.
      if((ART5152_USO_ANUAL[anioOrigenChk]||0) >= 3){
        _abrirAvisoLimiteArt5152('anual');
        return;
      }
    }
    _a5152SaltarAvisoMensual = false;
  }

  var d={tipo:t};

  // FIX — al guardar una edición de un día 'baja' (p.ej. solo tocar un
  // plus o escribir una nota), 'd' se construía desde cero y jamás
  // recuperaba turnoPisado/simple/diaIndiceBaja/primeraBajaAnio del
  // TV[k] ya existente — se perdían en cada guardado, y por eso
  // "Quitar Baja Laboral" dejaba de tener nada que recuperar aunque el
  // botón siguiera visible. Se preservan aquí explícitamente, ya que
  // el formulario de baja nunca deja tocar estos campos.
  if(t==='baja'){
    var _bajaExistente = TV[k] || {};
    d.simple = true;
    d.turnoPisado = _bajaExistente.turnoPisado || null;
    if(_bajaExistente.diaIndiceBaja!=null) d.diaIndiceBaja = _bajaExistente.diaIndiceBaja;
    if(_bajaExistente.primeraBajaAnio!==undefined) d.primeraBajaAnio = _bajaExistente.primeraBajaAnio;
  }

  if(t==='ordinario'||t==='trabajado'||t==='art5152'){
    d.linea=F.linea;d.sal=F.sal;d.lle=F.lle;d.hF=F.hF;d.hL=F.hL;
    d.modo=F.modo||'ida';
    d.numTren=F.numTren||'';
    d.numTrenVuelta=F.numTrenVuelta||'';
    d.estadoServicio=F.estadoServicio||'ordinario';
    d.estadoServicioDetalle=F.estadoServicioDetalle||'';
    d.estadoServicioVuelta=F.estadoServicioVuelta||'ordinario';
    d.estadoServicioVueltaDetalle=F.estadoServicioVueltaDetalle||'';
    d.dhMismoTren=(typeof F.dhMismoTren==='boolean')?F.dhMismoTren:null;
    d.dhTrenDH=F.dhTrenDH||'';
    d.dhOrigen=F.dhOrigen||null;
    d.dhHoraInicio=F.dhHoraInicio||'';
    d.dhHoraFin=F.dhHoraFin||'';
    d.dhMinutos=(F.dhMinutos!=null)?F.dhMinutos:null;
    d.dhMismoTrenVuelta=(typeof F.dhMismoTrenVuelta==='boolean')?F.dhMismoTrenVuelta:null;
    d.dhTrenDHVuelta=F.dhTrenDHVuelta||'';
    d.dhOrigenVuelta=F.dhOrigenVuelta||null;
    d.dhHoraInicioVuelta=F.dhHoraInicioVuelta||'';
    d.dhHoraFinVuelta=F.dhHoraFinVuelta||'';
    d.dhMinutosVuelta=(F.dhMinutosVuelta!=null)?F.dhMinutosVuelta:null;
    // FIX — antes este mapeo solo guardaba {tren, escalaMin} y
    // descartaba en silencio salida/llegada/tipoTramo que el usuario
    // ya había rellenado en el formulario — por eso el resumen del
    // día podía salir incompleto. Ahora se guardan todos los campos.
    d.continuidad=(F.continuidad||[])
      .map(function(c){return {
        tren:(c.tren||'').trim(),
        salida:c.salida||null,
        llegada:c.llegada||null,
        horaInicio:c.horaInicio||'',
        horaFin:c.horaFin||'',
        escalaMin:(c.escalaMin!=null?c.escalaMin:null),
        tipoTramo:c.tipoTramo||'trabajado',
        // NUEVO — parte concreta del tramo que es DH (desde/hasta
        // estación + horas), en vez de marcar el tramo entero.
        dhDesde:c.dhDesde||'', dhHasta:c.dhHasta||'',
        dhHoraInicio:c.dhHoraInicio||'', dhHoraFin:c.dhHoraFin||''
      };})
      .filter(function(c){return c.tren;});
    recalcularContinuidad(F.hL||'', d.continuidad);
    d.continuidadVuelta=(F.continuidadVuelta||[])
      .map(function(c){return {
        tren:(c.tren||'').trim(),
        salida:c.salida||null,
        llegada:c.llegada||null,
        horaInicio:c.horaInicio||'',
        horaFin:c.horaFin||'',
        escalaMin:(c.escalaMin!=null?c.escalaMin:null),
        tipoTramo:c.tipoTramo||'trabajado',
        dhDesde:c.dhDesde||'', dhHasta:c.dhHasta||'',
        dhHoraInicio:c.dhHoraInicio||'', dhHoraFin:c.dhHoraFin||''
      };})
      .filter(function(c){return c.tren;});
    recalcularContinuidad(F.hL2||'', d.continuidadVuelta);
    d.sal2=F.sal2||null;
    d.lle2=F.lle2||null;
    d.hF2=F.hF2;d.hL2=F.hL2;
    var hIda=F.hF&&F.hL?Math.round(calcMins(F.hF,F.hL)/60*100)/100:0;
    var hVuelta=F.hF2&&F.hL2?Math.round(calcMins(F.hF2,F.hL2)/60*100)/100:0;
    d.horas=Math.round((hIda+hVuelta)*100)/100;

    // FIX — antes solo se miraban las horas de ida/vuelta principal
    // para decidir si el turno "tiene nocturnidad activa". Si la ida y
    // la vuelta eran de día pero un tramo de Continuidad (p.ej. un
    // CONT.2) caía dentro del horario nocturno, d.nocturno quedaba en
    // false y esa nocturnidad NUNCA se calculaba — ni con el arreglo
    // de más abajo en calculateEarnings(), porque ese cálculo solo se
    // ejecuta cuando t.nocturno es true.
    var algunaContinuidadNocturna = false;
    [F.continuidad, F.continuidadVuelta].forEach(function(arr){
      if(!arr || !arr.length) return;
      arr.forEach(function(c){
        if((c.horaInicio && esHoraNocturna(c.horaInicio)) || (c.horaFin && esHoraNocturna(c.horaFin))){
          algunaContinuidadNocturna = true;
        }
      });
    });
    d.nocturno = !!(
      (F.hF && esHoraNocturna(F.hF)) ||
      (F.hL && esHoraNocturna(F.hL)) ||
      (F.hF2 && esHoraNocturna(F.hF2)) ||
      (F.hL2 && esHoraNocturna(F.hL2)) ||
      algunaContinuidadNocturna
    );
    d.plusIntlAuto = F.plusIntlAuto || false;

    if(F.modo==='pernocta'){
      var _ks2=k.split('-').map(Number);var y=_ks2[0],mo=_ks2[1],dd=_ks2[2];
      var sig=new Date(y,mo-1,dd);sig.setDate(sig.getDate()+1);
      var kSig=key(sig.getFullYear(),sig.getMonth()+1,sig.getDate());
      _escribirDiaPernoctaConDemota(kSig, k, {tipo:'vuelta-pernocta',linea:F.linea,
        sal:d.sal2||null,lle:d.lle2||null,hF:F.hF2||null,hL:F.hL2||null,
        numTren:F.numTrenVuelta||'',
        nocturno:d.nocturno,origenPernocta:k});
      d.diaSiguiente=kSig;
      // Limpiar restos de una pernocta3 previa en este mismo día de origen
      if(selDay.t&&selDay.t.diaIntermedio) delete TV[selDay.t.diaIntermedio];
    } else if(F.modo==='pernocta3'){
      // PERNOCTA 3 DÍAS — genera DOS días extra: intermedio (día 2) y vuelta final (día 3)
      var _ks3=k.split('-').map(Number);var y3=_ks3[0],mo3=_ks3[1],dd3=_ks3[2];
      var diaInt=new Date(y3,mo3-1,dd3);diaInt.setDate(diaInt.getDate()+1);
      var kInt=key(diaInt.getFullYear(),diaInt.getMonth()+1,diaInt.getDate());
      var diaFin=new Date(y3,mo3-1,dd3);diaFin.setDate(diaFin.getDate()+2);
      var kFin=key(diaFin.getFullYear(),diaFin.getMonth()+1,diaFin.getDate());
      var nocIntermedio=!!((F.hF3&&esHoraNocturna(F.hF3))||(F.hL3&&esHoraNocturna(F.hL3)));
      _escribirDiaPernoctaConDemota(kInt, k, {tipo:'pernocta3-intermedio',linea:F.linea,
        sal:F.sal3||'',lle:F.lle3||'',hF:F.hF3||'',hL:F.hL3||'',
        numTren:F.numTrenIntermedio||'',
        nocturno:nocIntermedio,origenPernocta:k});
      _escribirDiaPernoctaConDemota(kFin, k, {tipo:'vuelta-pernocta',linea:F.linea,
        sal:d.sal2||null,lle:d.lle2||null,hF:F.hF2||null,hL:F.hL2||null,
        numTren:F.numTrenVuelta||'',
        nocturno:d.nocturno,origenPernocta:k});
      d.numTrenIntermedio=F.numTrenIntermedio||'';
      d.diaIntermedio=kInt;
      d.diaSiguiente=kFin;
    } else {
      if(selDay.t&&selDay.t.diaSiguiente) delete TV[selDay.t.diaSiguiente];
      if(selDay.t&&selDay.t.diaIntermedio) delete TV[selDay.t.diaIntermedio];
    }
  }

  // Variable compartida HTDL/Art.51-52 — se usa después de guardar para
  // saber si hay que abrir el correo automático de Mix (ver más abajo).
  var _art5152MixInfo = null;

  if(t==='trabajado'){
    d.comp=F.comp;
    if(F.comp==='dinero'){
      // Misma regla que en calculateEarnings(): mismo día → suma ida +
      // escala + vuelta; pernocta → se suman ida (día 1) y vuelta (día 2/3).
      var esPernoctaImp = (F.modo==='pernocta'||F.modo==='pernocta3');
      // FIX — mismo problema que ya se arregló en calculateEarnings():
      // el hueco se calculaba directamente entre F.hL y F.hF2 sin
      // tener en cuenta tramos de Continuidad (ida y/o vuelta)
      // trabajándose en medio. d.importe es lo que queda GUARDADO en
      // el turno — si había continuidad de vuelta, ese dinero real
      // faltaba del importe guardado, no solo del desglose.
      // FIX — Confirmado por Alex: las esperas/escalas ENTRE TRENES
      // conectados (ej. 63 min esperando el siguiente tren) también
      // deben pagarse en HTDL, sea o no pernocta — antes solo se
      // pagaban en un día suelto, y en pernocta se descartaban por
      // completo. La única espera que sigue SIN pagar es la de la
      // propia pernocta entre ida y vuelta (el descanso nocturno real,
      // ver el guard "!esPernoctaImp" más abajo, que se mantiene
      // igual) — esa no es una espera entre trenes, es tu descanso.
      var minContinuidadImp = 0, minEscalaImp = 0, finIdaRealImp = F.hL;
      if(F.continuidad && F.continuidad.length){
        F.continuidad.forEach(function(c){
          if(c.horaInicio && c.horaFin) minContinuidadImp += calcMins(c.horaInicio, c.horaFin);
          if(c.escalaMin!=null && c.escalaMin>0) minEscalaImp += c.escalaMin;
          if(c.horaFin) finIdaRealImp = c.horaFin;
        });
      }
      if(!esPernoctaImp && finIdaRealImp && F.hF2){
        var huecoFinalImp = calcMins(finIdaRealImp, F.hF2);
        if(huecoFinalImp>0) minEscalaImp += huecoFinalImp;
      }
      var minContinuidadVueltaImp = 0;
      if(F.continuidadVuelta && F.continuidadVuelta.length){
        F.continuidadVuelta.forEach(function(c){
          if(c.horaInicio && c.horaFin) minContinuidadVueltaImp += calcMins(c.horaInicio, c.horaFin);
          if(c.escalaMin!=null && c.escalaMin>0) minEscalaImp += c.escalaMin;
        });
      }
      var hEscalaImp = Math.round(minEscalaImp/60*100)/100;
      var hContinuidadImp = Math.round(minContinuidadImp/60*100)/100;
      var hContinuidadVueltaImp = Math.round(minContinuidadVueltaImp/60*100)/100;
      // NUEVO — Confirmado por Alex: la dormida entre ida y vuelta NO
      // se paga — salvo que sea un ENLACE DE JORNADA (el descanso real
      // quedó por debajo del mínimo legal: 12h si duermes en tu base,
      // 8h si duermes fuera). Ahí la dormida entera pasa a contar,
      // igual que cualquier otra espera. Mismo cálculo que ya usa
      // checkDescansoInternoPernocta(), sin depender de si el día
      // siguiente ya está guardado en TV (aquí puede que aún no lo
      // esté, se está guardando ahora mismo).
      var hEnlaceJornadaImp = 0;
      if(esPernoctaImp && finIdaRealImp && F.hF2){
        var toMinImp=function(h){var p=h.split(':').map(Number);return p[0]*60+p[1];};
        var dMImp=(1440-toMinImp(finIdaRealImp))+toMinImp(F.hF2); if(dMImp<0)dMImp+=1440;
        var estDescansoImp = F.sal2||F.lle||'';
        var limImp = (AJ.base && estDescansoImp===AJ.base) ? 720 : 480;
        if(dMImp < limImp) hEnlaceJornadaImp = Math.round(dMImp/60*100)/100;
      }
      // FIX — en pernocta, la continuidad de ida y de vuelta SÍ suman
      // al importe guardado (d.importe); antes se descartaban en
      // bloque y el importe del día quedaba por debajo del real,
      // aunque el total mensual de Stats (calculateEarnings) ya lo
      // calculaba bien por su cuenta — de ahí la descuadre entre la
      // ficha del día y el total del mes.
      var horasComputablesHTDL = esPernoctaImp
        ? Math.round((d.horas+hEscalaImp+hContinuidadImp+hContinuidadVueltaImp+hEnlaceJornadaImp)*100)/100
        : Math.round((hIda+hEscalaImp+hContinuidadImp+hVuelta+hContinuidadVueltaImp)*100)/100;
      var hFparaTasa = esPernoctaImp ? F.hF : F.hF2;
      var hLparaTasa = esPernoctaImp ? F.hL : F.hL2;
      d.importe=calcImp(horasComputablesHTDL,hFparaTasa,hLparaTasa,F.linea,F.plusAct,F.plusJT,F.plusIntlAuto);
      d.plusAct=F.plusAct; d.plusJT=F.plusJT;
    }
    if(F.comp==='dias'&&diasComp.length>0){
      var _km5=k.split('-').map(Number);var y2=_km5[0],mo2=_km5[1];
      var mC=mo2===12?1:mo2+1, yC=mo2===12?y2+1:y2;
      var nE=F.modo==='pernocta3'?6:(F.modo==='pernocta'?4:2);
      var dv=diasComp.filter(function(iso){
        var _di=iso.split('-').map(Number);var dy=_di[0],dm=_di[1];
        return dy===yC&&dm===mC;
      }).slice(0,nE);
      // NUEVO — Capa de validación: si algún día elegido ya está
      // ocupado (por otro turno, no por este mismo en modo edición),
      // se aborta el guardado ANTES de tocar TV. No se pierde nada.
      var diaOcupadoHTDL = dv.filter(function(iso){ return !estaDiaDisponible(iso, k); })[0];
      if(diaOcupadoHTDL){
        toast('Error: El día '+_keyAFechaLbl(diaOcupadoHTDL)+' ya tiene un turno asignado. Elige una fecha libre.');
        return;
      }
      d.diasComp=dv;
      // FIX — limpieza robusta: recorre TV directamente buscando
      // cualquier día 'comp' que pertenezca a ESTE turno (origen===k)
      // y que ya NO esté en la nueva selección (dv), en vez de fiarse
      // de selDay.t.diasComp (que podía no reflejar la lista real).
      // Así, si al editar quitas un día, desaparece de verdad.
      Object.keys(TV).forEach(function(isoOld){
        if(TV[isoOld] && TV[isoOld].tipo==='comp' && TV[isoOld].origen===k && dv.indexOf(isoOld)===-1){
          delete TV[isoOld];
        }
      });
      dv.forEach(function(iso){ TV[iso]={tipo:'comp',origen:k}; });
    }
    // ── NUEVO — Mix en HTDL (solo pernocta): reutiliza calcularMix()
    //    (ya existente, compartida con Art.51/52) y calcImp() (ya
    //    existente, la misma que usa la rama Dinero de arriba) — no
    //    se duplica ninguna fórmula, solo se combinan las dos. ──
    if(F.comp==='mix' && (F.modo==='pernocta'||F.modo==='pernocta3') && hIda>0 && hVuelta>0){
      var kVueltaHTDL = _diaSiguienteKey(k);
      var mixHTDLsave = calcularMix(hIda, hVuelta, k, kVueltaHTDL);
      var esIdaDineroHTDL = mixHTDLsave.diaDinero===k;
      var hFmix = esIdaDineroHTDL ? F.hF : F.hF2;
      var hLmix = esIdaDineroHTDL ? F.hL : F.hL2;
      var impMixHTDL = calcImp(mixHTDLsave.horasDinero, hFmix, hLmix, F.linea, F.plusAct, F.plusJT, F.plusIntlAuto);
      var mesDestinoHTDL = _art5152MesSiguiente(k);
      d.mixDinero = {dia:mixHTDLsave.diaDinero, horas:mixHTDLsave.horasDinero, importe:impMixHTDL};
      d.mixDias   = {dia:mixHTDLsave.diaDias, horas:mixHTDLsave.horasDias, diasGenerados:mixHTDLsave.diasGenerados, mesDestino:mesDestinoHTDL};
      var _pHm=mesDestinoHTDL.split('-').map(Number); var yHm=_pHm[0], mHm=_pHm[1];
      var dvHm = diasComp.filter(function(iso){
        var _diHm=iso.split('-').map(Number);
        return _diHm[0]===yHm && _diHm[1]===mHm;
      }).slice(0, mixHTDLsave.diasGenerados);
      // NUEVO — Capa de validación (igual que en HTDL días).
      var diaOcupadoMixHTDL = dvHm.filter(function(iso){ return !estaDiaDisponible(iso, k); })[0];
      if(diaOcupadoMixHTDL){
        toast('Error: El día '+_keyAFechaLbl(diaOcupadoMixHTDL)+' ya tiene un turno asignado. Elige una fecha libre.');
        return;
      }
      d.mixDias.diasComp = dvHm;
      // FIX — antes esta rama (Mix en HTDL) no limpiaba NINGÚN día
      // antiguo al editar; los días previamente elegidos se quedaban
      // para siempre en el calendario. Mismo barrido robusto que en
      // 'días' puro.
      Object.keys(TV).forEach(function(isoOld){
        if(TV[isoOld] && TV[isoOld].tipo==='comp' && TV[isoOld].origen===k && dvHm.indexOf(isoOld)===-1){
          delete TV[isoOld];
        }
      });
      dvHm.forEach(function(iso){ TV[iso] = {tipo:'comp', origen:k}; });
      _art5152MixInfo = {kIda:k, kVuelta:kVueltaHTDL, origen:'trabajado'};
    }
  }
  if(t==='art5152'){
    var compArt = F.compArt5152 || 'dinero';
    d.compensacion = compArt;
    var esPernoctaArt = (F.modo==='pernocta'||F.modo==='pernocta3');
    var montoArt = parseFloat(AJ.art5152Monto)||0;
    var baseArt  = parseFloat(AJ.art5152ValorBase)||0;
    // NUEVO — se guardan plusAct/plusJT (antes nunca se persistían
    // para Art.51/52, por eso el dinero final nunca los reflejaba).
    // Mismo origen de datos que HTDL (AJ.pluses/PLUS_DEF).
    d.plusAct = F.plusAct||false;
    d.plusJT  = F.plusJT||false;
    var pArt51Save   = AJ.pluses[AJ.rol]||PLUS_DEF[AJ.rol];
    var pActArtSave  = F.plusAct      ? parseFloat(pArt51Save.activacion||0)    : 0;
    var pJTArtSave   = F.plusJT       ? parseFloat(pArt51Save.jt||0)            : 0;
    var pIntlArtSave = F.plusIntlAuto ? parseFloat(pArt51Save.internacional||0) : 0;
    var mesOrigenArt = k.slice(0,7);

    if(compArt==='mix' && esPernoctaArt){
      var kVueltaArt = d.diaSiguiente || _diaSiguienteKey(k);
      var mixR = calcularMix(hIda, hVuelta, k, kVueltaArt);
      d.mixDinero = {dia:mixR.diaDinero, horas:mixR.horasDinero, importe:Math.round((mixR.horasDinero*montoArt+baseArt+pActArtSave+pJTArtSave+pIntlArtSave)*100)/100};
      d.mixDias   = {dia:mixR.diaDias,  horas:mixR.horasDias,  diasGenerados:mixR.diasGenerados, mesDestino:_art5152MesSiguiente(k)};
      // FIX: usar los días concretos elegidos en el mini-calendario
      // (mismo patrón que la rama 'dias' de arriba) en vez de solo
      // sumar un contador invisible.
      var _pM5=d.mixDias.mesDestino.split('-').map(Number); var yM5=_pM5[0], mM5=_pM5[1];
      var dvM5 = diasComp.filter(function(iso){
        var _diM5=iso.split('-').map(Number);
        return _diM5[0]===yM5 && _diM5[1]===mM5;
      }).slice(0, mixR.diasGenerados);
      // NUEVO — Capa de validación (igual que en los demás flujos).
      var diaOcupadoMixArt = dvM5.filter(function(iso){ return !estaDiaDisponible(iso, k); })[0];
      if(diaOcupadoMixArt){
        toast('Error: El día '+_keyAFechaLbl(diaOcupadoMixArt)+' ya tiene un turno asignado. Elige una fecha libre.');
        return;
      }
      d.mixDias.diasComp = dvM5;
      // FIX — antes esta rama (Mix en Art.51/52) no limpiaba NINGÚN
      // día antiguo al editar. Mismo barrido robusto.
      Object.keys(TV).forEach(function(isoOld){
        if(TV[isoOld] && TV[isoOld].tipo==='comp' && TV[isoOld].origen===k && dvM5.indexOf(isoOld)===-1){
          delete TV[isoOld];
        }
      });
      dvM5.forEach(function(iso){ TV[iso] = {tipo:'comp', origen:k}; });
      ART5152_DIAS[d.mixDias.mesDestino] = (ART5152_DIAS[d.mixDias.mesDestino]||0) + mixR.diasGenerados;
      _saveArt5152Dias();
      _art5152MixInfo = {kIda:k, kVuelta:kVueltaArt, origen:'art5152'};
    } else if(compArt==='dias'){
      var diasArt = esPernoctaArt ? 4 : 2;
      var mesDestinoArt = _art5152MesSiguiente(k);
      d.diasGenerados = diasArt;
      d.mesDestino = mesDestinoArt;
      // FIX: usar los días concretos elegidos en el mini-calendario
      // (diasComp — mismo componente que ya usa HTDL) en vez de solo
      // sumar un contador invisible. Se limita al mes destino correcto
      // y al máximo de días permitido (2 o 4), igual que hace HTDL.
      var _p5=mesDestinoArt.split('-').map(Number); var yC5=_p5[0], mC5=_p5[1];
      var dv5 = diasComp.filter(function(iso){
        var _di5=iso.split('-').map(Number);
        return _di5[0]===yC5 && _di5[1]===mC5;
      }).slice(0, diasArt);
      // NUEVO — Capa de validación (igual que en los demás flujos).
      var diaOcupadoArt5152 = dv5.filter(function(iso){ return !estaDiaDisponible(iso, k); })[0];
      if(diaOcupadoArt5152){
        toast('Error: El día '+_keyAFechaLbl(diaOcupadoArt5152)+' ya tiene un turno asignado. Elige una fecha libre.');
        return;
      }
      d.diasComp = dv5;
      // FIX — mismo barrido robusto que en HTDL: ya no depende de
      // selDay.t.diasComp.
      Object.keys(TV).forEach(function(isoOld){
        if(TV[isoOld] && TV[isoOld].tipo==='comp' && TV[isoOld].origen===k && dv5.indexOf(isoOld)===-1){
          delete TV[isoOld];
        }
      });
      dv5.forEach(function(iso){ TV[iso] = {tipo:'comp', origen:k}; });
      // El contador mensual (bolsa por si no se eligieron días concretos)
      // se mantiene como respaldo para no perder la compensación generada.
      ART5152_DIAS[mesDestinoArt] = (ART5152_DIAS[mesDestinoArt]||0) + diasArt;
      _saveArt5152Dias();
    } else {
      // NUEVO: mismo criterio que HTDL (ver bloque t==='trabajado' arriba) —
      // Ida y vuelta el mismo día → Ida + Escala + Vuelta.
      // Pernocta → SOLO tiempo efectivo en los trenes (ida + vuelta),
      // la escala/descanso fuera de base queda excluida a propósito.
      // FIX — mismo problema que ya se arregló en HTDL: antes se
      // calculaba 'hEscalaArt' como el hueco COMPLETO entre F.hL y
      // F.hF2, sin tener en cuenta que puede haber tramos de
      // Continuidad (ida y/o vuelta) trabajándose en medio. En Art.51/52
      // eso no solo mal-etiquetaba el desglose — el dinero en sí salía
      // mal si había continuidad de vuelta, porque esa parte no se
      // contaba en ningún sitio. Ahora se separan igual que en HTDL:
      // trabajo real de continuidad (ida y vuelta) aparte de la
      // escala real.
      // FIX — Confirmado por Alex: las esperas/escalas entre trenes
      // conectados también deben pagarse en Art.51/52, sea o no
      // pernocta — mismo criterio aplicado a HTDL. La única espera
      // que se sigue excluyendo es la de la pernocta en sí (el
      // descanso nocturno real entre ida y vuelta, guard
      // "!esPernoctaArt" más abajo, sin cambios).
      var minContinuidadArt = 0;
      var minEscalaArt = 0;
      var finIdaRealArt = F.hL;
      if(F.continuidad && F.continuidad.length){
        F.continuidad.forEach(function(c){
          if(c.horaInicio && c.horaFin) minContinuidadArt += calcMins(c.horaInicio, c.horaFin);
          if(c.escalaMin!=null && c.escalaMin>0) minEscalaArt += c.escalaMin;
          if(c.horaFin) finIdaRealArt = c.horaFin;
        });
      }
      if(!esPernoctaArt && finIdaRealArt && F.hF2){
        var huecoFinalArt = calcMins(finIdaRealArt, F.hF2);
        if(huecoFinalArt>0) minEscalaArt += huecoFinalArt;
      }
      var minContinuidadVueltaArt = 0;
      if(F.continuidadVuelta && F.continuidadVuelta.length){
        F.continuidadVuelta.forEach(function(c){
          if(c.horaInicio && c.horaFin) minContinuidadVueltaArt += calcMins(c.horaInicio, c.horaFin);
          if(c.escalaMin!=null && c.escalaMin>0) minContinuidadVueltaArt += c.escalaMin;
        });
      }
      var hEscalaArt = Math.round(minEscalaArt/60*100)/100;
      var hContinuidadArt = Math.round(minContinuidadArt/60*100)/100;
      var hContinuidadVueltaArt = Math.round(minContinuidadVueltaArt/60*100)/100;
      // NUEVO — mismo criterio que en HTDL: enlace de jornada (descanso
      // real por debajo del mínimo legal: 12h en base, 8h fuera) hace
      // que la dormida entera pase a contar.
      var hEnlaceJornadaArt = 0;
      if(esPernoctaArt && finIdaRealArt && F.hF2){
        var toMinArt=function(h){var p=h.split(':').map(Number);return p[0]*60+p[1];};
        var dMArt=(1440-toMinArt(finIdaRealArt))+toMinArt(F.hF2); if(dMArt<0)dMArt+=1440;
        var estDescansoArt = F.sal2||F.lle||'';
        var limArt = (AJ.base && estDescansoArt===AJ.base) ? 720 : 480;
        if(dMArt < limArt) hEnlaceJornadaArt = Math.round(dMArt/60*100)/100;
      }
      // FIX — igual que en HTDL: en pernocta, la continuidad de ida y
      // de vuelta SÍ suman al total de horas de Art.51/52 (y por tanto
      // al dinero, d.importe, calculado justo debajo); antes se
      // descartaban en bloque para pernocta y esas horas trabajadas
      // de verdad se perdían del importe guardado.
      var horasCompArt = esPernoctaArt
        ? Math.round((d.horas+hEscalaArt+hContinuidadArt+hContinuidadVueltaArt+hEnlaceJornadaArt)*100)/100
        : Math.round((hIda+hEscalaArt+hContinuidadArt+hVuelta+hContinuidadVueltaArt)*100)/100;
      d.horasEfectivas = horasCompArt;
      d.hEscala = hEscalaArt;
      d.hContinuidad = hContinuidadArt;
      d.hContinuidadVuelta = hContinuidadVueltaArt;
      d.importe = Math.round((horasCompArt*montoArt + baseArt + pActArtSave + pJTArtSave + pIntlArtSave)*100)/100;
    }

    // El contador de "una vez al mes" y el de "3 veces al año" SOLO se
    // incrementan para Dinero/Días — Mix y HTDL quedan explícitamente
    // fuera de esta restricción.
    if(compArt==='dinero' || compArt==='dias'){
      ART5152_USO[mesOrigenArt] = (ART5152_USO[mesOrigenArt]||0) + 1;
      _saveArt5152Uso();
      var anioOrigenArt = k.slice(0,4);
      ART5152_USO_ANUAL[anioOrigenArt] = (ART5152_USO_ANUAL[anioOrigenArt]||0) + 1;
      _saveArt5152UsoAnual();
    }
  }

  if(t==='descanso'||t==='vacaciones') d.simple=true;
  if(F.notas) d.notas=F.notas;
  d.plusAct=F.plusAct||false;
  d.plusJT=F.plusJT||false;

  var anterior=TV[k];
  // FIX — antes esto desvinculaba SIEMPRE que un día 'comp' se
  // sobrescribía con cualquier cosa, sin importar con qué. Por eso,
  // al trabajar un día de compensación (HTDL o Art.51/52), este
  // guardado general lo desvinculaba de todas formas — aunque
  // compConvertir() ya NO lo hiciera por su lado — y STATS perdía el
  // registro de qué días se habían solicitado. Ahora se exceptúan
  // esos dos tipos: solo se desvincula si el día se convierte en
  // OTRA cosa (descanso, ordinario, etc.), que sí libera el día de
  // verdad.
  if(anterior && anterior.tipo==='comp' && anterior.origen && t!=='trabajado' && t!=='art5152'){
    var ori=TV[anterior.origen];
    if(ori&&ori.diasComp) ori.diasComp=ori.diasComp.filter(function(iso){return iso!==k;});
  }

  // GUARDAR — primero datos, luego cerrar
  TV[k]=d; selDay.t=d; saveTV();

  // FIX — se había perdido esta llamada: sin ella, ALERTAS_DESCANSO
  // quedaba desactualizado tras guardar/editar Ordinario, HTDL o
  // Art.51/52, y el aviso de descanso mínimo (8h fuera de base / 12h
  // en base) dejaba de reflejar el turno recién guardado. Se ejecuta
  // justo después de guardar y antes de cualquier otra cosa, para que
  // el resto del flujo (re-render, correo, etc.) ya vea el estado
  // correcto. No toca ninguna fórmula: solo reactiva la llamada a la
  // función de cálculo que ya existía intacta.
  ALERTAS_DESCANSO = verificarDescansosMes();

  // Escenario B: si el turno tiene días compensatorios asignados,
  // disparar el popup de correo de solicitud de compensación.
  if(d.comp==='dias' && d.diasComp && d.diasComp.length > 0){
    setTimeout(function(){ enviarSolicitudCompensacion(k); }, 350);
  }

  // NUEVO: si el registro de Art. 51/52 fue Mix, abrir el correo automático
  if(_art5152MixInfo){
    setTimeout(function(){ _abrirCorreoMixArt5152(_art5152MixInfo.kIda, _art5152MixInfo.kVuelta, d, _art5152MixInfo.origen); }, 350);
  }

  if(d.numTren&&(t==='ordinario'||t==='trabajado')){
    guardarServicioFrecuente({
      numTren:d.numTren, linea:d.linea,
      sal:d.sal, lle:d.lle, hF:d.hF, hL:d.hL,
      sal2:d.sal2, lle2:d.lle2, hF2:d.hF2, hL2:d.hL2
    });
    if(d.numTrenVuelta&&d.numTrenVuelta!==d.numTren){
      guardarServicioFrecuente({
        numTren:d.numTrenVuelta, linea:d.linea,
        sal:d.sal2||d.lle, lle:d.lle2||d.sal,
        hF:d.hF2, hL:d.hL2
      });
    }
    if(F.modo==='pernocta3' && F.numTrenIntermedio && F.numTrenIntermedio!==d.numTren){
      guardarServicioFrecuente({
        numTren:F.numTrenIntermedio, linea:d.linea,
        sal:F.sal3||'', lle:F.lle3||'',
        hF:F.hF3||'', hL:F.hL3||''
      });
    }
  }

  // CERRAR solo después de guardar exitosamente
  closeOv('ov-form');
  renderCal();
  renderStats();
  toast('Turno guardado');
}
/* (calcImp, esHoraNocturna, limiteHoras → ver sección HELPERS al final) */

/* ═══════════════════════════════════════
   ELIMINAR
═══════════════════════════════════════ */
function pedirEliminar(){if(!selDay||!selDay.t)return;openOv('ov-del');}
function confirmarEliminar(){
  if(!selDay)return;
  var k=selDay.k, t=TV[k];
  // FIX — si el turno que se elimina es un Art.51/52 con compensación
  // 'dinero' o 'dias' (las dos únicas que cuentan para el límite de
  // "una vez al mes"/"3 veces al año"), hay que DECREMENTAR esos
  // mismos contadores aquí. Antes solo se incrementaban al crear y
  // nunca se liberaban al borrar, así que un Art.51/52 eliminado
  // seguía bloqueando el mes/año como si siguiera existiendo.
  if(t && t.tipo==='art5152' && (t.compensacion==='dinero' || t.compensacion==='dias')){
    var mesOrigenDel = k.slice(0,7);
    var anioOrigenDel = k.slice(0,4);
    if(ART5152_USO[mesOrigenDel]){
      ART5152_USO[mesOrigenDel] = Math.max(0, ART5152_USO[mesOrigenDel]-1);
      _saveArt5152Uso();
    }
    if(ART5152_USO_ANUAL[anioOrigenDel]){
      ART5152_USO_ANUAL[anioOrigenDel] = Math.max(0, ART5152_USO_ANUAL[anioOrigenDel]-1);
      _saveArt5152UsoAnual();
    }
  }
  if(t && t.diasComp && t.diasComp.length){
    t.diasComp.forEach(function(iso){
      if(TV[iso] && TV[iso].origen===k) delete TV[iso];
    });
  }
  // NUEVO — FIX: limpiar también los días de compensación del Mix de
  // Art.51/52 (t.mixDias.diasComp), que antes no se liberaban al
  // eliminar y quedaban "huérfanos" en el calendario.
  if(t && t.mixDias && t.mixDias.diasComp && t.mixDias.diasComp.length){
    t.mixDias.diasComp.forEach(function(iso){
      if(TV[iso] && TV[iso].origen===k) delete TV[iso];
    });
  }
  if(t && t.diaSiguiente && TV[t.diaSiguiente] && TV[t.diaSiguiente].origenPernocta===k){
    delete TV[t.diaSiguiente];
  }
  // NUEVO — FIX: limpiar el día intermedio de una pernocta de 3 días
  // (mismo campo y patrón que ya usa guardarTurno() al re-guardar,
  // ver línea ~8250 — aquí faltaba en el flujo de eliminar).
  if(t && t.diaIntermedio && TV[t.diaIntermedio] && TV[t.diaIntermedio].origenPernocta===k){
    delete TV[t.diaIntermedio];
  }
  delete TV[k]; selDay.t=null;
  // NUEVO — FIX: si el día tenía turnos extra (TV2[k]), se eliminan
  // también al pulsar "Eliminar" — antes sobrevivían al borrado del
  // turno principal y la celda seguía mostrando el badge "+N" o
  // contenido, dando la sensación de que no se pudo eliminar.
  if(TV2[k]){ delete TV2[k]; if(typeof saveTV2==='function') saveTV2(); }
  saveTV();
  // Cerrar TODOS los overlays relevantes y limpiar UI de golpe
  closeOv('ov-del'); closeOv('ov-form'); closeOv('ov-dia-card');
  clearSelDay();
  document.getElementById('dia-area').innerHTML='';
  renderCal(); renderStats(); toast('Turno eliminado');
}
