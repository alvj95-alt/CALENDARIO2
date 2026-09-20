/* TrenTurnos v5 — Lectura del PDF individual y carga automática al calendario
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
// === PARSER DEL PDF (formato individual) ===
function parseSchedulePdfText(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);

  let empleado = null, mes = null;
  for(const l of lines){
    const m = l.match(/(\d{6,8}-[A-ZÁÉÍÓÚÑ ,]+)/);
    if(m){ empleado = m[1].trim(); break; }
  }
  const mesMatch = text.match(/(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+\d{4}/i);
  if(mesMatch) mes = mesMatch[0].toUpperCase();

  const diasOut = [];
  const dayLineRegex = /^(\d{1,2})\s+(DOM|LUN|MAR|MIÉ|MIE|JUE|VIE|SÁB|SAB)\s+(.*)$/;

  for(const l of lines){
    const m = l.match(dayLineRegex);
    if(!m) continue;
    const numero = parseInt(m[1],10);
    const diaSemana = m[2].replace('MIE','MIÉ').replace('SAB','SÁB');
    let resto = m[3];

    let entry = {n: numero, d: diaSemana, codigo: null, tipo: null, tramos: [], HE: null, HP: null, HDJ: null};

    // FIX — Confirmado por Alex (bug real, detectado en producción con
    // su PDF de julio 2026): antes se buscaban las columnas finales
    // HE/HP(/HDJ) con un regex "a ciegas" sobre TODA la línea, antes
    // de leer los tramos. Si el día tenía DOS tramos (ida y vuelta el
    // mismo día — ej. "9730 BSN 12:20...14:25  632 ZAZ 14:57...22:22
    // 07:25 02:37"), ese regex confundía la hora de llegada (CO) del
    // SEGUNDO tramo (22:22) con una de las columnas finales — rompiendo
    // los datos de ese tramo entero. Ahora se extraen primero TODOS
    // los tramos reales de la línea, y HE/HP(/HDJ) se leen de lo que
    // sobra DESPUÉS del último tramo — nunca se pueden confundir, sea
    // cual sea el número de tramos que tenga el día.
    const extraerColaHoras = function(str, destino){
      const toks = str.trim().split(/\s+/).filter(function(t){ return /^\d{1,3}:\d{2}$/.test(t); });
      if(toks.length>=3){ destino.HE=toks[0]; destino.HP=toks[1]; destino.HDJ=toks[2]; }
      else if(toks.length===2){ destino.HE=toks[0]; destino.HP=toks[1]; }
    };

    if(/DÍA LIBRE|DIA LIBRE/i.test(resto)){
      entry.tipo = 'LIBRE'; entry.codigo = 'DO';
      extraerColaHoras(resto, entry);
    } else if(/DISPONIBLE/i.test(resto)){
      entry.tipo = 'RESERVA'; entry.codigo = 'R';
      extraerColaHoras(resto, entry);
    } else if(/\bCP\b/i.test(resto)){
      // NUEVO — Confirmado por Alex: "CP" son días de vacaciones.
      entry.tipo = 'VACACIONES'; entry.codigo = 'CP';
      extraerColaHoras(resto, entry);
    } else {
      entry.tipo = 'SERVICIO';
      const parts = resto.split(/\s+/);
      entry.codigo = parts[0];
      const rest2 = resto.slice(entry.codigo.length).trim();

      const tramoRegex = /([0-9A-Z]+)\s+([A-Z]{2,6})\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})/g;
      let tm, finUltimoTramo = 0;
      while((tm = tramoRegex.exec(rest2)) !== null){
        entry.tramos.push({tren: tm[1], est: tm[2], CI: tm[3], dep: tm[4], arr: tm[5], CO: tm[6]});
        finUltimoTramo = tramoRegex.lastIndex;
      }
      // Todo lo que quede DESPUÉS del último tramo real es la cola de
      // HE/HP(/HDJ) — así no importa si el día tiene 1, 2, 3 o más
      // tramos, nunca se confunde un CO real con una de estas columnas.
      extraerColaHoras(rest2.slice(finUltimoTramo), entry);
    }
    diasOut.push(entry);
  }

  // FIX — Confirmado por Alex (mismo bug, misma causa): la línea de
  // totales al final del PDF también trae 3 valores ("74:25 18:10
  // 01:00" = Total HE, Total HP, Total HDJ), no 2 — el regex exigía
  // EXACTAMENTE 2 valores en toda la línea, así que nunca la
  // encontraba, y totalHE/totalHP se quedaban siempre en null (por
  // eso el resumen de "Horas efectivas/presencia" en Stats salía
  // vacío). Ahora acepta también la línea con 3 valores.
  let totalHE = null, totalHP = null, totalHDJ = null;
  const totalLine = lines.find(l=>/^\d{1,3}:\d{2}\s+\d{1,3}:\d{2}(\s+\d{1,3}:\d{2})?\s*$/.test(l));
  if(totalLine){
    const partes = totalLine.trim().split(/\s+/);
    totalHE = partes[0]; totalHP = partes[1];
    if(partes.length>=3) totalHDJ = partes[2];
  }

  return {dias: diasOut, meta: {empleado, mes, totalHE, totalHP, totalHDJ}};
}

function _pdfMesAnio(mesTexto){
  if(!mesTexto) return null;
  var m = mesTexto.match(/([A-ZÁÉÍÓÚ]+)\s+(\d{4})/i);
  if(!m) return null;
  var nombre = m[1].toUpperCase().replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I').replace(/Ó/g,'O').replace(/Ú/g,'U');
  var mesNum = MESES_PDF_MAP[nombre];
  if(!mesNum) return null;
  return {anio: parseInt(m[2],10), mes: mesNum};
}

// Agrupa los días SERVICIO en bloques de 1 (turno normal), 2 (pernocta)
// o 3 (pernocta3) días consecutivos con el MISMO código de actividad.
function _pdfDetectarBloques(dias){
  var servicio = dias.filter(function(e){ return e.tipo==='SERVICIO' && e.tramos && e.tramos.length; })
                      .sort(function(a,b){ return a.n-b.n; });
  var bloques = [];
  var i = 0;
  while(i < servicio.length){
    var grupo = [servicio[i]];
    var j = i+1;
    while(j < servicio.length && grupo.length < 3 &&
          servicio[j].n === grupo[grupo.length-1].n+1 &&
          servicio[j].codigo === grupo[0].codigo){
      grupo.push(servicio[j]);
      j++;
    }
    bloques.push(grupo);
    i = j;
  }
  return bloques;
}

// NOTA — Confirmado por el usuario: se retira definitivamente
// _pdfBuscarLlegadaSF() (limpieza de código sin usar). Adivinaba la
// estación de llegada con el historial de Servicios Frecuentes (SF),
// que podía sustituir en silencio el destino real del PDF por una
// ruta guardada de otro momento con el mismo número de tren — bug
// real detectado por Alex, ya corregido dejando de usar esta función
// en la carga automática de PDF.

/* ═══════════════════════════════════════════════════════════
   NUEVO — Detección de tramos DH a partir del propio código de
   actividad del PDF (confirmado con Alex sobre datos reales):
   - Un número de tren aparece SOLO con DH (ej. "34609DH", sin
     "34609" suelto en el mismo código) → el tramo entero es DH
     (100% Presencia).
   - Un número de tren aparece DOS veces, una normal y otra con DH
     (ej. "3304" y "3304DH") → es UN solo tramo (una fila de horario)
     donde a mitad de trayecto pasas de pasajero a trabajador (o al
     revés) — la mitad de esas horas van a Presencia y la mitad a
     Efectivas.
   Devuelve { numTren: 'total'|'mitad', ... } solo para los trenes
   que sí tienen marca DH en el código.
═══════════════════════════════════════════════════════════ */
function _pdfClasificarDH(codigo){
  var partes = (codigo||'').split('-').filter(Boolean);
  var tieneDH = {}, tienePlano = {};
  partes.forEach(function(p){
    if(/DH$/i.test(p)) tieneDH[p.slice(0, -2)] = true;
    else tienePlano[p] = true;
  });
  var resultado = {};
  Object.keys(tieneDH).forEach(function(base){
    resultado[base] = tienePlano[base] ? 'mitad' : 'total';
  });
  return resultado;
}

// Suma/resta minutos a una hora "HH:MM", con vuelta de reloj.
function _pdfSumarMinutos(hhmm, mins){
  var p = hhmm.split(':').map(Number);
  var total = ((p[0]*60+p[1]+mins) % 1440 + 1440) % 1440;
  var h = Math.floor(total/60), m = total%60;
  return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
}
function _guardarEstacionesPdf(){
  try{ localStorage.setItem('pdfEstMap', JSON.stringify(ESTACIONES_PDF)); }catch(e){}
}
// Devuelve el nombre completo si ya se conoce esa sigla; null si no.
function _pdfTraducirEstacion(codigo){
  if(!codigo) return null;
  return ESTACIONES_PDF[codigo] || null;
}
// Recorre todas las siglas del PDF y devuelve las que aún no conoce.
// Antes intenta reconocer sola tu estación base: la sigla que más se
// repite como primera parada del día, si coincide en frecuencia con
// tener AJ.base configurado, se guarda automáticamente como tu base
// (sin preguntar — es tu propia Estación Base ya guardada en Ajustes).
function _pdfCodigosDesconocidos(dias){
  var vistos = {};
  dias.forEach(function(e){
    if(e.tipo!=='SERVICIO') return;
    (e.tramos||[]).forEach(function(t){ if(t.est) vistos[t.est]=(vistos[t.est]||0)+1; });
  });
  if(AJ.base){
    var mejorCod=null, mejorCount=0;
    Object.keys(vistos).forEach(function(c){ if(vistos[c]>mejorCount){ mejorCount=vistos[c]; mejorCod=c; } });
    if(mejorCod && !ESTACIONES_PDF[mejorCod] && mejorCount>=2){
      ESTACIONES_PDF[mejorCod] = AJ.base;
      _guardarEstacionesPdf();
    }
  }
  return Object.keys(vistos).filter(function(c){ return !ESTACIONES_PDF[c]; });
}

// Construye ida+vuelta a partir de los tramos de UN SOLO día suelto
// (bloque de 1 día): primer tramo = ida, último tramo = vuelta,
// los del medio = continuidad. Es el caso normal ida-vuelta o los
// días con escalas que no cruzan a otro día.
function _pdfConstruirDiaSuelto(entry){
  var tramos = entry.tramos;
  var dhMap = _pdfClasificarDH(entry.codigo);
  var out = {sal:null,lle:null,hF:null,hL:null,numTren:'',
             sal2:null,lle2:null,hF2:null,hL2:null,numTrenVuelta:'',
             continuidad:[], incompleto:false};
  if(!tramos.length){ out.incompleto = true; return out; }
  var primero = tramos[0], ultimo = tramos[tramos.length-1];
  var salTxt = _pdfTraducirEstacion(primero.est);
  out.sal = salTxt || primero.est; out.hF = primero.CI; out.numTren = primero.tren;
  if(!salTxt) out.incompleto = true;
  if(tramos.length===1){
    // FIX — Confirmado por Alex (bug real detectado en producción): antes
    // se adivinaba aquí la estación de llegada con el historial de
    // Servicios Frecuentes (SF) — esa lista guarda, por número de tren,
    // la última ruta usada CUALQUIER día anterior, y un mismo número de
    // tren puede tener destinos distintos según el día. Eso sustituía en
    // silencio el destino real de ESTE PDF por un dato guardado de otro
    // momento, sin avisar. El PDF individual no trae el nombre de la
    // estación de llegada del único tramo del día, así que ahora se deja
    // sin adivinar: el día queda marcado para revisar/completar a mano,
    // nunca con un dato inventado o heredado.
    out.lle = null;
    // FIX — este es el ÚNICO tramo del día (nada continúa después), así
    // que el final real de la jornada es el CHECK-OUT (CO), no la mera
    // llegada del tren (arr). El PDF ya deja claro que ese margen final
    // (arr→CO) también cuenta como parte de las horas del día — antes
    // se perdía sin más, ni como Efectivas ni como Presencia.
    out.hL = primero.CO || primero.arr || null;
    if(!out.lle) out.incompleto = true;
  } else {
    var lleTxt = _pdfTraducirEstacion(tramos[1].est);
    out.lle = lleTxt || tramos[1].est; out.hL = primero.arr || null;
    if(!lleTxt) out.incompleto = true;
    var sal2Txt = _pdfTraducirEstacion(ultimo.est);
    out.sal2 = sal2Txt || ultimo.est; out.hF2 = ultimo.CI; out.numTrenVuelta = ultimo.tren;
    if(!sal2Txt) out.incompleto = true;
    // FIX — Confirmado por Alex (bug real detectado en producción): mismo
    // problema que arriba — no se adivina más con el historial de
    // Servicios Frecuentes (SF), que puede guardar una ruta de otro día
    // con ese mismo número de tren y sustituir en silencio el destino
    // real. El final del día vuelve a tu Estación Base (mismo criterio
    // que ya se usa para el cierre de una pernocta), nunca al historial.
    out.lle2 = AJ.base || null;
    // FIX — mismo criterio: 'ultimo' es el ÚLTIMO tramo del día (la
    // vuelta), nada continúa después, así que el final real es su
    // CO, no su arr.
    out.hL2 = ultimo.CO || ultimo.arr || null;
    if(!out.lle2) out.incompleto = true;
    for(var m=1; m<tramos.length-1; m++){
      var salM = _pdfTraducirEstacion(tramos[m].est);
      var lleM = _pdfTraducirEstacion(tramos[m+1].est);
      if(!salM || !lleM) out.incompleto = true;
      // FIX — la espera real entre el tramo anterior y este (llegada
      // de uno → toma del siguiente) no se estaba calculando, así que
      // esos minutos desaparecían de "Presencia" en Stats. Se saca
      // directamente del propio PDF (arr del tramo anterior → CI de
      // este), igual que harías al meterlo a mano.
      var esperaM = (tramos[m-1].arr && tramos[m].CI) ? calcMins(tramos[m-1].arr, tramos[m].CI) : null;
      var contM = {
        tren: tramos[m].tren, salida: salM||tramos[m].est, llegada: lleM||tramos[m+1].est,
        horaInicio: tramos[m].CI, horaFin: tramos[m].arr, escalaMin:esperaM, tipoTramo:'trabajado'
      };
      // NUEVO — DH confirmado por Alex: si este tramo intermedio lleva
      // marca DH en el código, se reparte igual que en cualquier otro
      // tramo con DH (ver _pdfClasificarDH arriba).
      var dhCont = dhMap[tramos[m].tren];
      if(dhCont){
        contM.tipoTramo = 'dh';
        if(dhCont==='mitad'){
          var durCont = calcMins(tramos[m].CI, tramos[m].arr);
          contM.dhHoraInicio = tramos[m].CI;
          contM.dhHoraFin = _pdfSumarMinutos(tramos[m].CI, Math.round(durCont/2));
        }
        // si es 'total', se deja sin dhHoraInicio/dhHoraFin: el tramo
        // entero cuenta como Presencia (comportamiento ya existente).
      }
      out.continuidad.push(contM);
    }
  }
  // NUEVO — DH en el tramo de IDA (primero) o VUELTA (último), fuera
  // de continuidad — usa el mismo campo que ya usa la app para
  // turnos guardados a mano (estadoServicio/estadoServicioVuelta +
  // dhMismoTren + dhMinutos).
  var dhIda = dhMap[primero.tren];
  if(dhIda && out.hF && out.hL){
    var durIda = calcMins(out.hF, out.hL);
    out.estadoServicio = 'dh';
    out.dhMismoTren = true;
    out.dhMinutos = (dhIda==='total') ? durIda : Math.round(durIda/2);
    out.estadoServicioDetalle = 'DH automático (PDF · '+dhIda+')';
  }
  if(tramos.length>1){
    var dhVta = dhMap[ultimo.tren];
    if(dhVta && out.hF2 && out.hL2){
      var durVta = calcMins(out.hF2, out.hL2);
      out.estadoServicioVuelta = 'dh';
      out.dhMismoTrenVuelta = true;
      out.dhMinutosVuelta = (dhVta==='total') ? durVta : Math.round(durVta/2);
      out.estadoServicioVueltaDetalle = 'DH automático (PDF · '+dhVta+')';
    }
  }
  return out;
}

// Construye UNA dirección completa (todos los tramos de un día
// tratados como un único trayecto, no como ida+vuelta) — se usa
// para cada día de una pernocta/pernocta3, donde el día ENTERO es
// solo la ida, o solo la vuelta, o solo el tramo intermedio.
function _pdfDireccionCompleta(entry){
  var tramos = entry.tramos;
  var dhMap = _pdfClasificarDH(entry.codigo);
  var out = {salida:null,horaInicio:null,numTren:'',destino:null,llegadaCabeza:null,horaFinal:null,continuidad:[],incompleto:false,
             esDH:null, dhMinutosCabeza:0};
  if(!tramos.length){ out.incompleto = true; return out; }
  var salTxt = _pdfTraducirEstacion(tramos[0].est);
  out.salida = salTxt || tramos[0].est; out.horaInicio = tramos[0].CI; out.numTren = tramos[0].tren;
  // FIX — BUG GRAVE: esto usaba la llegada del ÚLTIMO tramo del día
  // como "horaFinal" del tramo principal (hF2/hL2 en el turno final).
  // Como los tramos intermedios/segundo tramo YA se cuentan aparte en
  // 'continuidad' (con su propia duración sumando a Efectivas), ese
  // mismo tiempo se estaba contando DOS VECES: una metido dentro del
  // rango CI→última-llegada, y otra vez en continuidad. Eso es
  // exactamente lo que inflaba "Horas Efectivas" muy por encima del
  // PDF oficial en días de pernocta con más de un tramo por lado.
  // horaFinal debe ser SOLO la llegada del primer tramo (la "cabeza"),
  // igual que ya hace correctamente _pdfConstruirDiaSuelto.
  out.horaFinal = tramos[0].arr || null;
  if(!salTxt) out.incompleto = true;
  if(tramos.length===1){
    // FIX — si es el ÚNICO tramo de esta dirección, nada continúa
    // después, así que el final real es su CO (check-out), igual que
    // en _pdfConstruirDiaSuelto — si no, se perdía ese margen final.
    out.horaFinal = tramos[0].CO || tramos[0].arr || null;
    // FIX — Confirmado por Alex (bug real detectado en producción): antes
    // se adivinaba aquí con el historial de Servicios Frecuentes (SF) —
    // mismo problema que en _pdfConstruirDiaSuelto: un mismo número de
    // tren puede tener destinos distintos en días distintos, y esto
    // sustituía en silencio la conexión real del PDF por una ruta
    // guardada de otro momento. Se deja sin resolver: _pdfConstruirEscrituras
    // ya lo rellena después con datos 100% reales — la salida real del
    // día siguiente del propio bloque, o tu Estación Base si es el
    // último día de la pernocta.
    out.destino = null;
    out.llegadaCabeza = null;
  } else {
    for(var i=1;i<tramos.length;i++){
      // FIX — Confirmado por Alex (bug real detectado en producción):
      // mismo problema que en el resto de este bug — no se adivina el
      // destino del ÚLTIMO tramo con el historial de Servicios Frecuentes
      // (SF). Si se rellenaba aquí con SF, "out.destino" (más abajo)
      // quedaba con un valor "ya puesto" y el respaldo correcto de
      // _pdfConstruirEscrituras (salida real del día siguiente, o tu
      // Estación Base si es el último día) nunca llegaba a aplicarse. Se
      // deja sin resolver aquí para que ese respaldo con datos 100%
      // reales sí pueda entrar en acción.
      var llegadaTxt = (i+1<tramos.length) ? _pdfTraducirEstacion(tramos[i+1].est) : null;
      var llegadaCodigoBruto = (i+1<tramos.length) ? tramos[i+1].est : null;
      if(i+1<tramos.length && !llegadaTxt) out.incompleto = true;
      // FIX — misma corrección que en _pdfConstruirDiaSuelto: la
      // espera real entre tramos conectados (arr del anterior → CI de
      // este) se saca del propio PDF en vez de dejarla en null, para
      // que sí sume a "Presencia" en Stats.
      var esperaI = (tramos[i-1].arr && tramos[i].CI) ? calcMins(tramos[i-1].arr, tramos[i].CI) : null;
      // FIX — si este es el ÚLTIMO tramo de la dirección (i === último
      // índice), nada continúa después → su final real es el CO, no
      // el arr, mismo criterio que arriba.
      var esUltimoTramo = (i === tramos.length-1);
      var contI = {
        tren: tramos[i].tren, salida: _pdfTraducirEstacion(tramos[i].est)||tramos[i].est,
        llegada: llegadaTxt || llegadaCodigoBruto,
        horaInicio: tramos[i].CI,
        horaFin: esUltimoTramo ? (tramos[i].CO || tramos[i].arr) : tramos[i].arr,
        escalaMin:esperaI, tipoTramo:'trabajado'
      };
      // NUEVO — DH confirmado por Alex, mismo criterio que en
      // _pdfConstruirDiaSuelto (ver _pdfClasificarDH).
      var dhI = dhMap[tramos[i].tren];
      if(dhI){
        contI.tipoTramo = 'dh';
        if(dhI==='mitad'){
          var durI = calcMins(contI.horaInicio, tramos[i].arr);
          contI.dhHoraInicio = contI.horaInicio;
          contI.dhHoraFin = _pdfSumarMinutos(contI.horaInicio, Math.round(durI/2));
        }
      }
      out.continuidad.push(contI);
    }
    out.destino = out.continuidad[out.continuidad.length-1].llegada;
    // NUEVO — Confirmado por Alex: 'destino' es el final de TODA la
    // cadena de tramos de este día (se usa para enlazar con el día
    // siguiente de la pernocta) — pero para MOSTRAR el tramo de la
    // "cabeza" (el primer tren) hace falta su propia llegada, que es
    // sencillamente donde arranca el segundo tramo (ahí es donde
    // conecta). Antes se usaba 'destino' para las dos cosas, y el
    // tramo de cabeza mostraba el destino final de todo el viaje en
    // vez del suyo propio (ej. mostraba "Barcelona" en vez de
    // "Madrid Chamartín" para un tren que solo llega hasta ahí).
    // FIX — Confirmado por Alex: se había probado a usar el historial
    // de trenes (SF) con prioridad aquí, para el caso de un traslado
    // real entre dos estaciones de la misma ciudad que el PDF no
    // refleja (ej. Chamartín → Atocha). Pero un mismo NÚMERO de tren
    // se reutiliza en días distintos para combinaciones distintas —
    // el 3304 de un día puede conectar en Atocha, y el 3304 de otro
    // día, en Chamartín. "Aprender" el destino por número de tren
    // aplicaba esa memoria a TODOS los días con ese número, aunque no
    // hiciera falta ninguna corrección ese día en concreto — el
    // resultado dejaba de coincidir con lo que decía el PDF de
    // verdad. Ahora se confía siempre en la conexión real del PDF
    // (dónde sale el siguiente tramo); si algún día hay un traslado
    // real de por medio, se corrige a mano ESE día, sin que quede
    // "pegado" al número de tren para siempre.
    out.llegadaCabeza = out.continuidad[0].salida;
  }
  // NUEVO — DH en la CABECERA de esta dirección (tramos[0]) — se
  // devuelve para que el llamante (_pdfConstruirEscrituras) decida si
  // va en estadoServicio (ida) o estadoServicioVuelta (vuelta), según
  // qué lado de la pernocta sea esta dirección.
  var dhCabeza = dhMap[tramos[0].tren];
  if(dhCabeza && out.horaInicio && out.horaFinal){
    var durCabeza = calcMins(out.horaInicio, out.horaFinal);
    out.esDH = dhCabeza;
    out.dhMinutosCabeza = (dhCabeza==='total') ? durCabeza : Math.round(durCabeza/2);
  }
  if(!out.destino) out.incompleto = true;
  return out;
}

// Construye las escrituras TV/TV2 (sin escribir todavía) para una
// unidad de carga: un día LIBRE (descanso) o un bloque de 1-3 días
// SERVICIO. Devuelve {escrituras:[{k,data}], incompletos:[k,...]}.
function _pdfConstruirEscrituras(bloque, anio, mesNum){
  var kDe = function(n){ return key(anio, mesNum, n); };

  // Día libre (LD/DO) → descanso. Nunca se agrupa (bloque de 1).
  if(bloque.length===1 && bloque[0].tipo==='LIBRE'){
    return {escrituras:[{k:kDe(bloque[0].n), data:{tipo:'descanso', cargadoDesdePdf:true}}], incompletos:[]};
  }

  // NUEVO — Confirmado por Alex: "R" (DISPONIBLE/RESERVA) es un día
  // de oficina — se guarda igual que un turno de reserva simple hecho
  // a mano ({tipo:'reserva', simple:true}), que la app YA sabe contar
  // como 8h de Presencia por defecto (calcularJornadaDiaria, rama
  // 'reserva', sin reservaHoraToma/Llegada). Tampoco se agrupa nunca.
  if(bloque.length===1 && bloque[0].tipo==='RESERVA'){
    return {escrituras:[{k:kDe(bloque[0].n), data:{tipo:'reserva', simple:true, cargadoDesdePdf:true}}], incompletos:[]};
  }

  // NUEVO — "CP" (vacaciones), mismo patrón que descanso/reserva.
  if(bloque.length===1 && bloque[0].tipo==='VACACIONES'){
    return {escrituras:[{k:kDe(bloque[0].n), data:{tipo:'vacaciones', simple:true, cargadoDesdePdf:true}}], incompletos:[]};
  }

  var escrituras = [], incompletos = [];

  if(bloque.length===1){
    var d1 = _pdfConstruirDiaSuelto(bloque[0]);
    var kUnico = kDe(bloque[0].n);
    if(d1.incompleto) incompletos.push(kUnico);
    var horasU = (d1.hF&&d1.hL?Math.round(calcMins(d1.hF,d1.hL)/60*100)/100:0) +
                 (d1.hF2&&d1.hL2?Math.round(calcMins(d1.hF2,d1.hL2)/60*100)/100:0);
    var dataUnico = {
      // FIX — 'ordinario' es el turno normal de trabajo; 'trabajado' es
      // específicamente HTDL (descanso trabajado). Un turno cargado
      // desde el PDF de tu horario oficial es SIEMPRE Ordinario.
      tipo:'ordinario', modo:'ida', estadoServicio:'ordinario', linea:null,
      sal:d1.sal, lle:d1.lle, hF:d1.hF, hL:d1.hL, numTren:d1.numTren,
      sal2:d1.sal2, lle2:d1.lle2, hF2:d1.hF2, hL2:d1.hL2, numTrenVuelta:d1.numTrenVuelta,
      continuidad:d1.continuidad, continuidadVuelta:[],
      horas: horasU,
      nocturno: !!((d1.hF&&esHoraNocturna(d1.hF))||(d1.hL&&esHoraNocturna(d1.hL))||
                   (d1.hF2&&esHoraNocturna(d1.hF2))||(d1.hL2&&esHoraNocturna(d1.hL2))),
      cargadoDesdePdf:true
    };
    // NUEVO — DH confirmado por Alex en ida y/o vuelta de un día suelto
    // (ver _pdfConstruirDiaSuelto → estadoServicio/estadoServicioVuelta).
    if(d1.estadoServicio==='dh'){
      dataUnico.estadoServicio = 'dh';
      dataUnico.dhMismoTren = d1.dhMismoTren;
      dataUnico.dhMinutos = d1.dhMinutos;
      dataUnico.estadoServicioDetalle = d1.estadoServicioDetalle;
    }
    if(d1.estadoServicioVuelta==='dh'){
      dataUnico.estadoServicioVuelta = 'dh';
      dataUnico.dhMismoTrenVuelta = d1.dhMismoTrenVuelta;
      dataUnico.dhMinutosVuelta = d1.dhMinutosVuelta;
      dataUnico.estadoServicioVueltaDetalle = d1.estadoServicioVueltaDetalle;
    }
    escrituras.push({k:kUnico, data:dataUnico});
  } else {
    var direcciones = bloque.map(_pdfDireccionCompleta);
    var ks = bloque.map(function(e){ return kDe(e.n); });

    // FIX — la llegada de cada tramo de una pernocta NO se adivina con
    // el historial de trenes (SF): se enlaza directamente con la
    // SALIDA del día siguiente del propio bloque, que es un dato real
    // ya sacado del PDF (ahí es donde de verdad duermes/continúas).
    // Solo el último día (la vuelta final) no tiene "día siguiente"
    // dentro del bloque — ese vuelve a la base, así que si no hay dato
    // mejor (SF), se asume tu Estación Base.
    for(var di=0; di<direcciones.length-1; di++){
      direcciones[di].destino = direcciones[di+1].salida;
    }
    var dirFinal = direcciones[direcciones.length-1];
    if(!dirFinal.destino) dirFinal.destino = AJ.base || null;
    // FIX — Confirmado por Alex (bug real detectado en producción):
    // cuando la dirección de un día tenía un solo tramo, "llegadaCabeza"
    // (lo que de verdad se guarda como lle/lle2 del turno final) se dejó
    // vacío a propósito en _pdfDireccionCompleta, para no adivinarlo con
    // el historial de Servicios Frecuentes (SF). Se rellena aquí con el
    // "destino" YA CORREGIDO justo arriba con datos 100% reales (la
    // salida real del día siguiente del propio bloque, o tu Estación
    // Base en el último día) — nunca con el historial de otro momento.
    direcciones.forEach(function(dir){
      if(!dir.llegadaCabeza) dir.llegadaCabeza = dir.destino;
    });
    // Si ese día tenía tramos de continuidad, su último tramo interno
    // apuntaba al mismo destino sin resolver — se sincroniza para que
    // también se vea su ruta (antes se quedaba con salida pero sin
    // llegada, y por eso tampoco pintaba esa línea).
    direcciones.forEach(function(dir){
      if(dir.continuidad.length) dir.continuidad[dir.continuidad.length-1].llegada = dir.destino;
    });

    direcciones.forEach(function(dir,idx){ if(!dir.salida || !dir.destino) incompletos.push(ks[idx]); });

    var dIda = direcciones[0], dVta = direcciones[direcciones.length-1];
    var kIda = ks[0], kVta = ks[ks.length-1];
    var horasIda = (dIda.horaInicio&&dIda.horaFinal?Math.round(calcMins(dIda.horaInicio,dIda.horaFinal)/60*100)/100:0);
    var horasVta = (dVta.horaInicio&&dVta.horaFinal?Math.round(calcMins(dVta.horaInicio,dVta.horaFinal)/60*100)/100:0);
    var principal = {
      tipo:'ordinario', linea:null, estadoServicio:'ordinario',
      sal:dIda.salida, lle:dIda.llegadaCabeza, hF:dIda.horaInicio, hL:dIda.horaFinal, numTren:dIda.numTren,
      sal2:dVta.salida, lle2:dVta.llegadaCabeza, hF2:dVta.horaInicio, hL2:dVta.horaFinal, numTrenVuelta:dVta.numTren,
      continuidad:dIda.continuidad, continuidadVuelta:dVta.continuidad,
      nocturno: !!((dIda.horaInicio&&esHoraNocturna(dIda.horaInicio))||(dVta.horaFinal&&esHoraNocturna(dVta.horaFinal))),
      cargadoDesdePdf:true
    };
    // NUEVO — DH confirmado por Alex en la cabecera de ida y/o vuelta
    // (ver _pdfDireccionCompleta → esDH/dhMinutosCabeza).
    if(dIda.esDH){
      principal.estadoServicio = 'dh';
      principal.dhMismoTren = true;
      principal.dhMinutos = dIda.dhMinutosCabeza;
      principal.estadoServicioDetalle = 'DH automático (PDF · '+dIda.esDH+')';
    }
    if(dVta.esDH){
      principal.estadoServicioVuelta = 'dh';
      principal.dhMismoTrenVuelta = true;
      principal.dhMinutosVuelta = dVta.dhMinutosCabeza;
      principal.estadoServicioVueltaDetalle = 'DH automático (PDF · '+dVta.esDH+')';
    }
    if(bloque.length===2){
      principal.modo='pernocta';
      principal.horas = Math.round((horasIda+horasVta)*100)/100;
      principal.diaSiguiente = kVta;
      escrituras.push({k:kIda, data:principal});
      escrituras.push({k:kVta, data:{
        tipo:'vuelta-pernocta', linea:null,
        sal:dVta.salida, lle:dVta.llegadaCabeza, hF:dVta.horaInicio, hL:dVta.horaFinal, numTren:dVta.numTren,
        nocturno: !!((dVta.horaInicio&&esHoraNocturna(dVta.horaInicio))||(dVta.horaFinal&&esHoraNocturna(dVta.horaFinal))),
        origenPernocta:kIda, cargadoDesdePdf:true
      }});
    } else { // 3 días — pernocta3
      var dInt = direcciones[1], kInt = ks[1];
      principal.modo='pernocta3';
      principal.numTrenIntermedio = dInt.numTren;
      principal.diaIntermedio = kInt;
      principal.diaSiguiente = kVta;
      principal.horas = Math.round((horasIda+horasVta)*100)/100; // igual que hace guardarTurno (el intermedio no suma aquí)
      escrituras.push({k:kIda, data:principal});
      escrituras.push({k:kInt, data:{
        tipo:'pernocta3-intermedio', linea:null,
        sal:dInt.salida, lle:dInt.llegadaCabeza, hF:dInt.horaInicio, hL:dInt.horaFinal, numTren:dInt.numTren,
        nocturno: !!((dInt.horaInicio&&esHoraNocturna(dInt.horaInicio))||(dInt.horaFinal&&esHoraNocturna(dInt.horaFinal))),
        origenPernocta:kIda, cargadoDesdePdf:true
      }});
      escrituras.push({k:kVta, data:{
        tipo:'vuelta-pernocta', linea:null,
        sal:dVta.salida, lle:dVta.llegadaCabeza, hF:dVta.horaInicio, hL:dVta.horaFinal, numTren:dVta.numTren,
        nocturno: !!((dVta.horaInicio&&esHoraNocturna(dVta.horaInicio))||(dVta.horaFinal&&esHoraNocturna(dVta.horaFinal))),
        origenPernocta:kIda, cargadoDesdePdf:true
      }});
    }
  }
  return {escrituras: escrituras, incompletos: incompletos};
}
function cargarPdfEnCalendarioAuto(){
  if(_cargaPdfEnProgreso){
    toast('⏳ Ya hay una carga en curso — resuelve el diálogo que tienes en pantalla antes de volver a pulsar');
    return;
  }
  if(!horarioActualDias || !horarioActualDias.length){
    toast('⚠️ Primero sube el PDF de este mes en Horario individual');
    return;
  }
  var mesAnio = _pdfMesAnio(horarioActualMeta && horarioActualMeta.mes);
  if(!mesAnio){
    toast('⚠️ No se pudo identificar el mes/año de este horario');
    return;
  }
  _cargaPdfAnio = mesAnio.anio; _cargaPdfMes = mesAnio.mes;

  var pendientesEst = _pdfCodigosDesconocidos(horarioActualDias);
  if(pendientesEst.length){
    _mostrarFormularioEstacionesPdf(pendientesEst);
  } else {
    _iniciarColaCargaPdf();
  }
}

// NUEVO — FIX UX: antes preguntaba una sigla por pantalla, en fila
// (molesto si había varias). Ahora se preguntan TODAS las siglas
// desconocidas de una sola vez, en un único formulario con un campo
// por sigla, y se guardan todas juntas al pulsar un solo botón.
function _mostrarFormularioEstacionesPdf(pendientes){
  _cargaPdfEstPendientes = pendientes;
  document.getElementById('cpdf-est-restantes').textContent =
    pendientes.length===1 ? '1 sigla nueva' : (pendientes.length+' siglas nuevas');
  var html = pendientes.map(function(cod){
    return '<div style="margin-bottom:10px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--tx3);margin-bottom:4px">Sigla del PDF: <b style="color:var(--tx)">'+cod+'</b></div>'
      + '<input type="text" class="aj-nombre-inp" data-cpdf-cod="'+cod+'" placeholder="Ej. Barcelona Sants" style="width:100%;box-sizing:border-box">'
      + '</div>';
  }).join('');
  document.getElementById('cpdf-est-lista').innerHTML = html;
  openOv('ov-carga-pdf-estacion');
}

function _guardarTodasEstacionesPdf(){
  var inputs = document.querySelectorAll('#cpdf-est-lista input[data-cpdf-cod]');
  inputs.forEach(function(inp){
    var val = inp.value.trim();
    if(val) ESTACIONES_PDF[inp.getAttribute('data-cpdf-cod')] = val;
  });
  _guardarEstacionesPdf();
  closeOv('ov-carga-pdf-estacion');
  _iniciarColaCargaPdf();
}

function _omitirEstacionesPdf(){
  // Las que se dejen en blanco no se guardan — esos días quedarán
  // marcados para revisar y se volverá a preguntar la próxima carga.
  _guardarTodasEstacionesPdf();
}

function _iniciarColaCargaPdf(){
  var bloques = _pdfDetectarBloques(horarioActualDias);
  var descansos = horarioActualDias.filter(function(e){ return e.tipo==='LIBRE'; }).map(function(e){ return [e]; });
  // NUEVO — días "R" (reserva/disponible) también se cargan, mismo
  // patrón que los descansos: nunca se agrupan, un día = un bloque.
  var reservas = horarioActualDias.filter(function(e){ return e.tipo==='RESERVA'; }).map(function(e){ return [e]; });
  // NUEVO — días "CP" (vacaciones), mismo patrón.
  var vacaciones = horarioActualDias.filter(function(e){ return e.tipo==='VACACIONES'; }).map(function(e){ return [e]; });
  var cola = bloques.concat(descansos).concat(reservas).concat(vacaciones).sort(function(a,b){ return a[0].n-b[0].n; });
  if(!cola.length){
    toast('No hay días de servicio, descansos ni reservas que cargar en este horario');
    return;
  }
  _cargaPdfCola = cola; _cargaPdfIdx = 0;
  _cargaPdfResumen = {cargados:0, sobrescritos:0, extra:0, omitidos:0, revisar:[]};
  _cargaPdfEnProgreso = true; // se libera en _finalizarCargaPdf()
  toast('📅 Cargando '+cola.length+' día(s) del PDF...');
  _procesarSiguienteBloquePdf();
}

function _bloqueTieneConflicto(escrituras){
  return escrituras.some(function(esc){
    return !!TV[esc.k] || (TV2[esc.k] && TV2[esc.k].length);
  });
}

function _procesarSiguienteBloquePdf(){
  if(_cargaPdfIdx >= _cargaPdfCola.length){ _finalizarCargaPdf(); return; }
  var bloque = _cargaPdfCola[_cargaPdfIdx];
  // NUEVO — Confirmado por Alex: si un bloque concreto falla al
  // procesarse (por ejemplo, un día con restos de una pernocta cuyo
  // otro día ya se borró), antes se quedaba todo colgado en silencio,
  // sin avisar de nada — parecía que la carga "no hacía nada". Ahora
  // se avisa con el error exacto y se salta ese día para seguir con
  // el resto del PDF, en vez de bloquear la carga entera.
  try{
    var res = _pdfConstruirEscrituras(bloque, _cargaPdfAnio, _cargaPdfMes);

    // Confirmado por Alex: cuando un día ya tiene guardado exactamente
    // el mismo tipo simple que trae el PDF para ese día — sea día
    // libre (DO/DL/DOP), Vacaciones (CP) o Reserva (R) — ya coincide,
    // no hay nada que preguntar. Los descansos, además, cubren DOP y
    // COMPE como "ya coincide" (ver detalle de cada uno abajo); no se
    // sobrescribe ninguno de los dos (perderían su marca especial y su
    // enlace al turno de origen) — se saltan sin más.
    //   · 'descanso' (DO/DL del PDF) coincide con: descanso, dop, comp
    //     — DOP = "Día Libre Pedido" (marcado a mano), COMPE = "LD" en
    //     el PDF, el descanso que genera un HTDL trabajado el mes
    //     anterior (compensación "por día").
    //   · 'vacaciones' (CP del PDF) coincide con: vacaciones.
    //   · 'reserva' (R del PDF) coincide con: reserva.
    var MAPA_TIPOS_YA_COINCIDEN = {
      'descanso':   ['descanso', 'dop', 'comp'],
      'vacaciones': ['vacaciones'],
      'reserva':    ['reserva']
    };
    if(res.escrituras.length===1 && MAPA_TIPOS_YA_COINCIDEN[res.escrituras[0].data.tipo]){
      var kSimple = res.escrituras[0].k;
      var existenteSimple = TV[kSimple];
      var tiposValidos = MAPA_TIPOS_YA_COINCIDEN[res.escrituras[0].data.tipo];
      if(existenteSimple && tiposValidos.indexOf(existenteSimple.tipo)!==-1){
        _cargaPdfResumen.yaCoincidian = (_cargaPdfResumen.yaCoincidian||0) + 1;
        _cargaPdfIdx++;
        _procesarSiguienteBloquePdf();
        return;
      }
    }

    if(!_bloqueTieneConflicto(res.escrituras)){
      _escribirBloquePdf(res, 'directo');
      if(res.incompletos.length) _cargaPdfResumen.revisar = _cargaPdfResumen.revisar.concat(res.incompletos);
      _cargaPdfIdx++;
      _procesarSiguienteBloquePdf();
    } else {
      _mostrarConflictoPdf(bloque, res);
    }
  } catch(errBloque){
    console.error('Error procesando el día', bloque[0].n, errBloque);
    alert('⚠️ Error en el día '+bloque[0].n+':\n'+(errBloque&&errBloque.message||errBloque)+'\n\n(Haz captura de esto y envíasela a soporte — se sigue con el resto del PDF)');
    _cargaPdfResumen.revisar.push('día '+bloque[0].n+' (falló, ver aviso)');
    _cargaPdfIdx++;
    _procesarSiguienteBloquePdf();
  }
}

function _mostrarConflictoPdf(bloque, res){
  var etiquetas = bloque.map(function(e){ return e.n+' '+e.d; }).join(' → ');
  document.getElementById('cpdf-dias').textContent = etiquetas;
  document.getElementById('cpdf-codigo').textContent = bloque[0].codigo || '';
  var existentes = res.escrituras.map(function(esc){
    return TV[esc.k] ? ('· '+esc.k+' ya tiene un turno guardado ('+(TV[esc.k].tipo||'')+')') : null;
  }).filter(Boolean).join('<br>');
  document.getElementById('cpdf-existente').innerHTML = existentes || 'Ya hay algo guardado en uno de estos días.';
  window._cpdfPendiente = res;
  openOv('ov-carga-pdf-conflicto');
}

function _resolverConflictoPdf(accion){
  var res = window._cpdfPendiente;
  closeOv('ov-carga-pdf-conflicto');
  // NUEVO — Confirmado por Alex: si algo falla aquí dentro (un turno
  // guardado con una estructura rara, por ejemplo restos de una
  // pernocta cuyo otro día ya se borró), antes se quedaba todo
  // colgado en silencio — el botón parecía "no hacer nada", sin
  // ningún aviso de qué había pasado. Ahora, si algo revienta, se
  // avisa con el error exacto en vez de quedarse callado, y aun así
  // se intenta seguir con el resto de la cola.
  try{
    if(accion==='sobrescribir'){
      _escribirBloquePdf(res, 'sobrescribir');
      if(res.incompletos.length) _cargaPdfResumen.revisar = _cargaPdfResumen.revisar.concat(res.incompletos);
    } else if(accion==='extra'){
      _escribirBloquePdf(res, 'extra');
    } else if(accion==='editar'){
      _cargaPdfResumen.revisar.push('día '+_cargaPdfCola[_cargaPdfIdx][0].n+' (marcado para editar a mano)');
    } else {
      _cargaPdfResumen.omitidos++;
    }
  } catch(errConflicto){
    console.error('Error al resolver conflicto del día', _cargaPdfCola[_cargaPdfIdx][0].n, errConflicto);
    alert('⚠️ Error en el día '+_cargaPdfCola[_cargaPdfIdx][0].n+':\n'+(errConflicto&&errConflicto.message||errConflicto)+'\n\n(Haz captura de esto y envíasela a soporte — se sigue con el resto del PDF)');
    _cargaPdfResumen.revisar.push('día '+_cargaPdfCola[_cargaPdfIdx][0].n+' (falló, ver aviso)');
  }
  _cargaPdfIdx++;
  _procesarSiguienteBloquePdf();
}

function _escribirBloquePdf(res, modo){
  res.escrituras.forEach(function(esc){
    if(modo==='extra'){
      var tipoHeredado = (TV[esc.k] && TV[esc.k].tipo) || 'ordinario';
      if(!TV2[esc.k]) TV2[esc.k]=[];
      var ddExtra = {};
      for(var campo in esc.data) ddExtra[campo]=esc.data[campo];
      ddExtra.tipo = tipoHeredado; ddExtra.comp = 'dinero'; ddExtra.diasComp = [];
      TV2[esc.k].push(ddExtra);
    } else {
      // FIX — Confirmado por Alex: al "Sobrescribir" un día que ya
      // tenía un turno real puesto, ese turno YA NO se pierde — pasa
      // a SECUNDARIO con sus horas congeladas en este mismo momento,
      // exactamente el mismo mecanismo que ya usan "Copiar turno" y
      // "Cambiar tipo de turno". Antes se pisaba directo y esas horas
      // desaparecían de la Auditoría de golpe, en vez de seguir
      // sumando según su tipo (Ordinario→Efectiva/Presencia,
      // HTDL/Art.51-52→dinero/días).
      var existentePdf = TV[esc.k];
      if(existentePdf && existentePdf.tipo!=='descanso'){
        if(!TV2[esc.k]) TV2[esc.k]=[];
        var ddViejoPdf={}; for(var campoVP in existentePdf) ddViejoPdf[campoVP]=existentePdf[campoVP];
        ddViejoPdf.esAntiguoPrincipal = true;
        try{
          ddViejoPdf._horasGarantizadas = calcularJornadaDiaria([existentePdf], esc.k);
        }catch(errGarantiaPdf){ /* si falla, calcularJornadaDiaria() recalcula como siempre */ }
        TV2[esc.k].push(ddViejoPdf);
      }
      if(modo==='sobrescribir' && TV[esc.k] && TV[esc.k].diaSiguiente && TV[esc.k].diaSiguiente!==esc.data.diaSiguiente){
        if(TV[TV[esc.k].diaSiguiente] && TV[TV[esc.k].diaSiguiente].origenPernocta===esc.k) delete TV[TV[esc.k].diaSiguiente];
      }
      TV[esc.k] = esc.data;
    }
  });
  if(modo==='extra') _cargaPdfResumen.extra++;
  else if(modo==='sobrescribir') _cargaPdfResumen.sobrescritos++;
  else _cargaPdfResumen.cargados++;
}

function _finalizarCargaPdf(){
  _cargaPdfEnProgreso = false;
  saveTV(); saveTV2();
  renderCal(); renderStats();
  var r = _cargaPdfResumen;
  var msg = '✅ '+r.cargados+' nuevos · '+r.sobrescritos+' sobrescritos · '+r.extra+' como extra · '+r.omitidos+' omitidos';
  if(r.yaCoincidian) msg += ' · '+r.yaCoincidian+' descansos ya coincidían';
  if(r.revisar.length) msg += ' · Revisar: '+r.revisar.join(', ');
  toast(msg);
}
