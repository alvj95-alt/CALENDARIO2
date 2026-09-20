/* TrenTurnos v5 — Parches de funciones, estado de módulos, init() y listeners de arranque
   Separado del HTML único original SIN cambiar la lógica.
   NO se puede partir más sin cambiar el comportamiento: init() y los parches dependen de variables declaradas en este mismo archivo.
   El orden de carga está en index.html (importa: no lo alteres). */
// ── Enganche a loadAjUI() (rellenar campos) — wrapper, sin tocar el original ──
if(typeof loadAjUI === 'function'){
  var _loadAjUI_base_art5152 = loadAjUI;
  loadAjUI = function(){
    _loadAjUI_base_art5152.apply(this, arguments);
    var iM=document.getElementById('aj-art5152-monto'), iB=document.getElementById('aj-art5152-base');
    if(iM) iM.value = AJ.art5152Monto || 0;
    if(iB) iB.value = AJ.art5152ValorBase || 0;
    // NUEVO: refresca la tabla de "Estaciones y Horarios" cada vez
    // que se abre Ajustes, por si se guardó algún tren nuevo.
    if(typeof renderTablaEstacionesHorarios==='function') renderTablaEstacionesHorarios();
  };
}

// ── NUEVO — Enganche a saveAj() (wrapper, sin tocar el original) ──
// 1) Recoge los campos de Art.51/52 ANTES de que la función original
//    escriba en localStorage, ya que se eliminó su botón "Guardar"
//    propio — ahora viajan en el mismo guardado maestro.
// 2) Tras guardar, navega al calendario. window.location.hash se fija
//    tal cual se pidió; además se llama a goP('cal') porque esta app
//    navega entre pantallas con esa función (no hay listener de
//    hashchange), así que solo el hash no movería la vista por sí solo.
if(typeof saveAj === 'function'){
  var _saveAj_base_art5152 = saveAj;
  saveAj = function(){
    var iM=document.getElementById('aj-art5152-monto'), iB=document.getElementById('aj-art5152-base');
    if(iM) AJ.art5152Monto = parseFloat(iM.value)||0;
    if(iB) AJ.art5152ValorBase = parseFloat(iB.value)||0;

    _saveAj_base_art5152.apply(this, arguments);

    window.location.hash = '#calendario';
    if(typeof goP==='function') goP('cal');
  };
}

// ── Enganche a renderStats() (bloque en el panel STATS) — wrapper, sin tocar el original ──
if(typeof renderStats === 'function'){
  var _renderStats_base_art5152 = renderStats;
  renderStats = function(){
    _renderStats_base_art5152.apply(this, arguments);
    _renderArt5152Stats();
    _renderImpactoBajaEnStats();
  };
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — Integración de Art. 51/52 en la categoría HTDL de STATS.
   Dos wrappers, ninguno toca el código fuente de la función original:

   1) calcularJornadaDiaria(): un día con un registro 'art5152' debe
      clasificarse como jornada HTDL (esHTDL=true), igual que 'trabajado'.
      Esto hace que sus minutos vayan a efectivasHTDLMin/presenciaHTDLMin
      y NUNCA a efectivasCalMin/presenciaCalMin (Hora Efectiva/Presencia
      normal), tal y como se pidió.

   2) calculateEarnings(): suma el importe en dinero de Art. 51/52
      (compensación 'dinero', y la porción 'dinero' de un Mix) al MISMO
      total que ya usa HTDL (totalHTDL / totalBruto / diasHTDL), en vez
      de mostrarse en un bloque aparte — así aparece en la auditoría de
      horas como una fila más de HTDL, indistinguible en el resumen.
═══════════════════════════════════════════════════════════ */
if(typeof calcularJornadaDiaria === 'function'){
  var _calcularJornadaDiaria_base_art5152 = calcularJornadaDiaria;
  calcularJornadaDiaria = function(turnos, fecha){
    var r = _calcularJornadaDiaria_base_art5152.apply(this, arguments);
    if(!r.esHTDL && turnos && turnos.some(function(t){ return t && t.tipo==='art5152'; })){
      r.esHTDL = true;
    }
    return r;
  };
}

if(typeof calculateEarnings === 'function'){
  var _calculateEarnings_base_art5152 = calculateEarnings;
  calculateEarnings = function(ks){
    var e = _calculateEarnings_base_art5152.apply(this, arguments);
    // FIX — antes se sumaba t.importe / t.mixDinero.importe, un valor
    // CONGELADO en el momento de guardar el turno con la tarifa que
    // hubiera entonces. Si cambiabas de rol (o editabas la tarifa)
    // después, ese importe ya guardado nunca se actualizaba, y el TAS
    // seguía mostrando dinero calculado con la tarifa vieja. Ahora se
    // recalcula EN VIVO: mismas horas ya guardadas (t.horasEfectivas /
    // t.mixDinero.horas — esas SÍ son un hecho fijo, las horas
    // trabajadas no cambian), multiplicadas por la tarifa ACTUAL de
    // Ajustes (AJ.art5152Monto/AJ.art5152ValorBase). La fórmula en sí
    // (horas × monto + base) es exactamente la misma de siempre.
    var montoArtActual = parseFloat(AJ.art5152Monto)||0;
    var baseArtActual = parseFloat(AJ.art5152ValorBase)||0;
    // NUEVO — pluses recalculados en vivo con la tarifa ACTUAL de
    // Ajustes, igual que montoArtActual/baseArtActual de arriba.
    var pArt51Live = AJ.pluses[AJ.rol]||PLUS_DEF[AJ.rol];
    var extraHTDL = 0, extraDetalle = [], extraLbl = [];
    ks.forEach(function(k){
      var t = TV[k];
      if(!t || t.tipo!=='art5152') return;

      // FIX — Retraso del tramo de VUELTA (T2), recalculado EN VIVO
      // cada vez (nunca se congela), igual que ya hace HTDL en el
      // bucle principal de calculateEarnings(). T1 (ida) es solo
      // informativo, nunca cambia el importe. En pernocta, T2 vive
      // en la celda del día siguiente (t.diaSiguiente), no en esta
      // — mismo criterio ya usado para HTDL. La tarifa que se aplica
      // sigue siendo la de Art.51/52 (montoArtActual), NUNCA la de
      // HTDL (AJ.vh) — son importes distintos configurados por
      // separado en Ajustes.
      var esPernoctaArtLive = (t.modo==='pernocta' || t.modo==='pernocta3');
      var _tRetArt = (esPernoctaArtLive && t.diaSiguiente) ? TV[t.diaSiguiente] : t;
      var minRetT2Art = 0;
      if(_tRetArt){
        if(_tRetArt.retrasos && _tRetArt.retrasos.length){
          _tRetArt.retrasos.forEach(function(r){ if(r.tramo===2) minRetT2Art += r.minutos||0; });
        } else if(_tRetArt.retrasoMin>0 && !_tRetArt.retrasos){
          minRetT2Art += _tRetArt.retrasoMin;
        }
      }
      var hRetT2Art = Math.round(minRetT2Art/60*100)/100;
      var pActArtLive  = t.plusAct      ? parseFloat(pArt51Live.activacion||0)    : 0;
      var pJTArtLive   = t.plusJT       ? parseFloat(pArt51Live.jt||0)            : 0;
      var pIntlArtLive = t.plusIntlAuto ? parseFloat(pArt51Live.internacional||0) : 0;
      var pTotalArtLive = pActArtLive + pJTArtLive + pIntlArtLive;

      if(t.compensacion==='dinero' && t.horasEfectivas){
        var horasVivasArt = Math.round((t.horasEfectivas + hRetT2Art)*100)/100;
        var importeVivo = Math.round((horasVivasArt*montoArtActual + baseArtActual + pTotalArtLive)*100)/100;
        extraHTDL += importeVivo;
        var lbl1 = _keyAFechaLbl(k);
        extraDetalle.push({lbl:lbl1, tren:t.numTren||'', esPernocta:esPernoctaArtLive,
          hIda:0, hEscala:t.hEscala||0, hContinuidad:t.hContinuidad||0, hVuelta:0, hContinuidadVuelta:t.hContinuidadVuelta||0, hRetT2:hRetT2Art, minRetT2:minRetT2Art,
          hTotal:horasVivasArt, importe:importeVivo, art5152:true});
        extraLbl.push(t.numTren?lbl1+' #'+t.numTren+' (Art.51/52)':lbl1+' (Art.51/52)');
      } else if(t.compensacion==='mix' && t.mixDinero && t.mixDinero.horas){
        var horasMixVivasArt = Math.round((t.mixDinero.horas + hRetT2Art)*100)/100;
        var importeMixVivo = Math.round((horasMixVivasArt*montoArtActual + baseArtActual + pTotalArtLive)*100)/100;
        extraHTDL += importeMixVivo;
        var lbl2 = _keyAFechaLbl(t.mixDinero.dia);
        extraDetalle.push({lbl:lbl2, tren:t.numTren||'', esPernocta:true,
          hIda:0, hEscala:0, hVuelta:0, hRetT2:hRetT2Art, minRetT2:minRetT2Art,
          hTotal:horasMixVivasArt, importe:importeMixVivo, art5152:true, mix:true});
        extraLbl.push(t.numTren?lbl2+' #'+t.numTren+' (Mix Art.51/52)':lbl2+' (Mix Art.51/52)');
      }
    });
    // NUEVO — se exponen por separado, ANTES de fusionar, para poder
    // mostrar Art.51/52 como línea propia en Stats sin tocar cómo se
    // suman e.totalHTDL/e.totalBruto (siguen incluyendo ambos, igual
    // que siempre, para no romper nada que ya lea esos campos).
    e.totalHTDLPuro = e.totalHTDL;
    e.diasHTDLPuroDetail = (e.diasHTDLdetail||[]).slice();
    e.totalArt5152Dinero = extraHTDL>0 ? Math.round(extraHTDL*100)/100 : 0;
    e.diasArt5152Detail = extraDetalle;
    if(extraHTDL>0){
      extraHTDL = Math.round(extraHTDL*100)/100;
      e.totalHTDL  = Math.round((e.totalHTDL + extraHTDL)*100)/100;
      e.totalBruto = Math.round((e.totalBruto + extraHTDL)*100)/100;
      e.diasHTDL = (e.diasHTDL||[]).concat(extraLbl);
      e.diasHTDLdetail = (e.diasHTDLdetail||[]).concat(extraDetalle);
    }
    // NUEVO — expone el impacto económico de los Enlaces de Jornada
    // POR SEPARADO (e.impactoEnlaces*), sin alterar e.totalHTDL ni
    // e.totalBruto (esos ya incluyen este importe desde dentro del
    // núcleo — esto es solo para poder mostrarlo como línea propia
    // en el desglose, sin tocar los totales existentes).
    var impEnlaces = calcularImpactoEnlacesEconomico(ks);
    e.impactoEnlacesHoras = impEnlaces.horas;
    e.impactoEnlacesImporte = impEnlaces.importe;
    e.impactoEnlacesDetalle = impEnlaces.detalle;
    return e;
  };
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — COPIAR TURNO A OTRO DÍA.
   100% aditivo. Reutiliza el mismo lenguaje visual que ya usas en
   la carga del PDF (calendario propio, popup de tipo, popup de
   conflicto Sobrescribir/Extra/Omitir), pero con su propio estado
   — no toca _cargaPdfCola ni nada del módulo del PDF.
═══════════════════════════════════════════════════════════ */
var _copiarOrigen = null;      // {k, t, dias, tipoOriginal}
var _copiarMesCal = null;      // Date del mes visible en el mini-calendario
var _copiarDestino = null;     // {y,m,d}
var _copiarTipoPendiente = null;

// FIX ANCLAJE: flag de bloqueo para evitar swipes superpuestos
// que dejaban el calendario en una posición visual intermedia.
var _swipeEnCurso = false;

/* ─── ACORDEÓN — historial del mes (ExpansionTile) ─── */
// OPTIMIZACIÓN: caché de memoización para renderAcordeon.
// Evita reconstruir TODO el HTML del acordeón si el mes visible
// y los datos de ese mes no han cambiado desde el último render.
var _acordeonCacheKey = null;

/* ═══════════════════════════════════════════════════════════
   MÓDULO DOP — Día de Descanso Opcional Personal.
   Completamente aditivo. Usa TV[] existente con tipo='dop'.
   No modifica ninguna estructura de datos existente.
   Una sola solicitud por mes (validada en TV por año+mes).
═══════════════════════════════════════════════════════════ */

// Verifica si ya existe un DOP en el mes/año indicado.
// Busca en TV[] que es el mismo objeto ya cargado en memoria.
/* ═══════════════════════════════════════════════════════════
   CONTADOR DOP — Solo lectura. No modifica TV ni localStorage.
   Cuenta cuántos DOPs se han registrado en un año concreto.
   Máximo permitido por convenio: 6 al año (1 por mes).
═══════════════════════════════════════════════════════════ */
var DOP_MAX_ANUAL = 6;

/* ═══════════════════════════════════════════════════════════
   NUEVO — CAMBIAR TIPO DE TURNO (segunda opción del botón "Cambio").
   Reclasifica un turno YA GUARDADO (Ordinario ↔ Art.51/52 ↔ HTDL)
   sin borrarlo y volverlo a crear. Reutiliza el mismo lenguaje
   visual y las mismas funciones de dinero ya construidas para
   "Copiar turno" (_horasComputablesParaDinero, _aplicarDineroCopia),
   con su propio estado — no comparte variables con _copiarOrigen.
═══════════════════════════════════════════════════════════ */
var _cambioTipoOrigen = null;   // {k, t, dias}
var _cambioTipoElegido = null;

/* ═══════════════════════════════════════════════════════════
   REGISTRO DE INTERCAMBIO — flujo en dos niveles de pop-up.
   Pop-up 1 (ov-cambio) se queda "on" y visible detrás — solo se
   le añade la clase .standby (bloquea su interacción, lo atenúa)
   mientras el Pop-up 2 (ov-registrar-intercambio) está abierto
   encima, con openOvTop() — el mismo mecanismo de superposición
   que ya usa el resto de la app (z-index 400 de .ov-top por
   encima del z-index 200 base de .ov), sin inventar nada nuevo.
   Los datos del Pop-up 1 (nombre/matrícula/tren del compañero)
   nunca se tocan ni se pierden: siguen en su sitio en el DOM.

   Se guarda como turno_referencia_externa=true — el motor de
   cálculo lo excluye por completo (ver calcularJornadaDiaria).
   Mantiene compatibilidad con esTurnoIntercambiado (el metadato
   de la versión anterior de este mismo módulo), así que cualquier
   registro ya guardado sigue excluyéndose igual.
═══════════════════════════════════════════════════════════ */
var _intercambioTipoServicio = 'idaVuelta';

/* ═══════════════════════════════════════════════════════════
   DH DENTRO DE UN TRAMO DE CONTINUIDAD — a diferencia del tramo
   principal (que pregunta "mismo tren o diferente"), aquí ese dato
   no aplica: un tramo de continuidad ya es por definición otro tren.
   Solo se pide desde/hasta estación y hora de inicio/fin de la parte
   SIN trabajar — el resto del tramo sigue sumando a Efectiva. Se
   guarda en el propio objeto del tramo: dhDesde, dhHasta,
   dhHoraInicio, dhHoraFin (nombres distintos de horaInicio/horaFin,
   que son los del tramo COMPLETO, no de la parte DH).
═══════════════════════════════════════════════════════════ */
var _dhContEditando = null;
/* ═══════════════════════════════════════
   BACKUP — Exportar / Importar datos
   Guarda turnos + ajustes en un .json
   y los restaura sin tocar el código.
═══════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   NUEVO — BORRADO MÚLTIPLE POR SELECCIÓN (maqueta A, aprobada por
   Alex). Mantener pulsado un día entra en "modo selección"; tocar
   más días los añade/quita; una barra fija abajo confirma o cancela.
   100% aditivo — no toca clickDia() ni confirmarEliminar() (el
   borrado de un solo día desde la ficha sigue exactamente igual).
═══════════════════════════════════════════════════════════ */
var _modoSeleccionBorrado = false;
var _diasSeleccionadosBorrar = {};

/* ═══════════════════════════════════════
   ESTACIONES — Selector tipo Card
   onStationSelected: si la estación es Internacional
   → plusIntlAuto = true automáticamente
═══════════════════════════════════════ */

// Estaciones internacionales que activan el plus automáticamente
const ESTACIONES_INTERNACIONALES = new Set([
  'Lyon Part-Dieu','Aviñón TGV','Marsella St-Charles',
  'Perpignan','Narbonne','Montpellier St-Roch',
  'León'
]);

/* ═══════════════════════════════════════
   ESTADÍSTICAS
═══════════════════════════════════════ */
// NUEVO — Confirmado por Alex: rol elegido para la vista de
// "Conceptos Fijos" en Stats — empieza igual que AJ.rol, pero es
// independiente (para que el admin pueda mirar otros roles sin
// cambiar su propio perfil real).
var _rolVistaFijosStats = null;
// Cerrar overlays al tocar fuera
['ov-tipo','ov-form','ov-est','ov-hora','ov-del','ov-borrar','ov-edit-comp','ov-cambio','ov-agenda','ov-nuevo-contacto'].forEach(function(id){
  document.getElementById(id).addEventListener('click',function(e){if(e.target===this)closeOv(id);});
});

var _emailTurnoKey = null;

// ── Render toggle bar ────────────────────────────────────────


/* ═══════ MÓDULO MULTITURNO TV2 ════════════════════════════
   TV[k]  = turno principal — NO SE TOCA
   TV2[k] = array de turnos adicionales
   Clave localStorage: 'tv2_extra'
══════════════════════════════════════════════════════════ */
var TV2 = _leerJSONseguro('tv2_extra', {});
// NUEVO — MIGRACIÓN: no existen turnos mixtos el mismo día. Si algún
// turno adicional quedó guardado con un tipo distinto al del turno
// principal (p.ej. adicional 'ordinario' en un día 'trabajado'/HTDL o
// 'art5152'), se corrige aquí una sola vez y se persiste — no es solo
// un cambio de apariencia, el dato guardado pasa a ser el correcto.
// Solo toca el campo 'tipo'; ningún otro dato del turno se modifica.
(function _normalizarTiposTV2(){
  var huboCambios = false;
  for(var kk in TV2){
    if(!TV2.hasOwnProperty(kk)) continue;
    var principal = TV[kk];
    if(!principal || !principal.tipo) continue;
    var lista = TV2[kk];
    if(!lista || !lista.length) continue;
    for(var ii=0; ii<lista.length; ii++){
      if(!lista[ii]) continue;
      if(lista[ii].turno_referencia_externa || lista[ii].independienteDeTipoPrincipal) continue;
      if(lista[ii].tipo !== principal.tipo){
        lista[ii].tipo = principal.tipo;
        huboCambios = true;
      }
    }
  }
  if(huboCambios) localStorage.setItem('tv2_extra', JSON.stringify(TV2));
})();
var _tv2_guardando = false;
var _tv2_editando_idx = null;

// NUEVO — bandera temporal SOLO para el flujo "He trabajado este
// descanso" tras un Cambio: permite que el turno adicional sea HTDL o
// Art.51/52 aunque el turno principal del día sea Ordinario, sin
// afectar a ningún otro "Añadir turno" normal (que sigue heredando el
// tipo del principal como siempre). Se limpia justo después de usarse.
var _forzarTipoTurnoAdicional = null;
/* ═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   MÓDULO ALARMAS — TrenTurnos v5
   Comprueba cada 30 s si toca avisar al usuario.
   NO modifica TV, AJ (salvo leer), ni ningún render.
   Alarma 1: 5 min antes de hF (fichar) — tipos elegibles
   Alarma 2: 45 min antes de hF (tren fuera de base)
   Control: AJ.alarmas.activas (toggle en Ajustes)
═══════════════════════════════════════════════════════════ */

// IDs de las alarmas ya disparadas hoy (evita repetición)
var _alarmasDisparadas = {};
var _alarmaInterval    = null;

// AudioContext persistente (no crear uno nuevo cada vez)
var _audioCtx = null;
/* ═══════════════════════════════════════════════════════════
   FIN MÓDULO ALARMAS
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   MÓDULO ALARMA PERSISTENTE v2
   Añade loop de sonido (30 s) + vibración + botón Detener.
   NO modifica ninguna función existente.
   Se activa desde alarmaActivarPersistente() que es llamada
   al final de alarmaNotificar() mediante un hook aditivo.
═══════════════════════════════════════════════════════════ */

var _alarmaPersLoop   = null;   // intervalo del loop de sonido
var _alarmaPersVib    = null;   // intervalo de vibración
var _alarmaPersTicker = 0;      // contador de segundos
var _alarmaActivaId   = null;

init();
/* ═══════════════════════════════════════════════════════════
   MÓDULO PANEL HORARIO INDIVIDUAL
   Importado desde archivo subido por el usuario. Lee/escribe
   en localStorage con prefijo propio (ver dentro), totalmente
   aislado de TV/AJ/SF de la app principal. Nada de este bloque
   modifica ninguna función o variable existente arriba.
═══════════════════════════════════════════════════════════ */



const cont = document.getElementById('days-horario');
const todayWrap = document.getElementById('todayWrap');
const todayContent = document.getElementById('todayContent');
const chevronSvg = `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

/* ═══════════════════════════════════════════════════════════
   NUEVO — CARGA AUTOMÁTICA DEL PDF INDIVIDUAL AL CALENDARIO.
   100% aditivo: solo LEE horarioActualDias/horarioActualMeta (ya
   extraídos por parseSchedulePdfText) y ESCRIBE en TV/TV2 con la
   MISMA estructura que ya usa guardarTurno()/guardarTurnoEnTV2().
   No toca el parser, ni calculateEarnings, ni ninguna función
   existente. Alcance v1: solo turnos Ordinario (tipo:'trabajado',
   estadoServicio:'ordinario'); LIBRE/RESERVA se ignoran por ahora.

   DETECCIÓN DE PERNOCTA — confirmado contra un PDF real de Alex:
   cuando un servicio cruza la noche, el CÓDIGO de actividad
   ("438-437", "3304DH-3304-4565-...") aparece IDÉNTICO en los 2 (o 3)
   días consecutivos que forman el viaje, pero cada día solo trae SUS
   propios tramos. Se agrupan por eso — nunca por comparar estaciones.
═══════════════════════════════════════════════════════════ */
var MESES_PDF_MAP = {ENERO:1,FEBRERO:2,MARZO:3,ABRIL:4,MAYO:5,JUNIO:6,JULIO:7,AGOSTO:8,SEPTIEMBRE:9,OCTUBRE:10,NOVIEMBRE:11,DICIEMBRE:12};

/* ═══════════════════════════════════════════════════════════
   NUEVO — Diccionario de siglas de estación (PDF → nombre completo
   que ya usa la app en LINEAS/F.sal/F.lle). El PDF individual solo
   trae siglas (BSN, COR, ATO...), nunca el nombre completo. Se
   guarda en localStorage y se va enseñando la primera vez que
   aparece cada sigla que NO esté ya en este diccionario base —
   nunca se adivina una desconocida.

   Confirmadas por Alex (16/08/2026) — vienen de serie para que
   nadie tenga que volver a enseñarlas desde cero:
═══════════════════════════════════════════════════════════ */
var ESTACIONES_PDF_BASE = {
  BSN:'Barcelona-Sants',
  COR:'Córdoba',
  BIL:'Bilbao-Abando',
  FVL:'Figueres-Vilafant',
  ALC:'Alicante / Alacant',
  GRA:'Granada',
  ATO:'Madrid-Puerta de Atocha',
  CHA:'Madrid-Chamartín Clara Campoamor',
  VIG:'Vigo-Urzáiz',
  SVQ:'Sevilla-Santa Justa',
  SSB:'San Sebastián',
  PAM:'Pamplona',
  CAR:'Cartagena',
  AGP:'Málaga-María Zambrano',
  VLN:'Valencia Estació del Nord',
  // NOTA — VLC y VLJ, a petición de Alex, NO van en la lista base:
  // cada persona las enseña a mano la primera vez que le aparezcan.
  ZAZ:'Zaragoza-Delicias'
};
var ESTACIONES_PDF = (function(){
  var guardadas = {};
  try{ guardadas = JSON.parse(localStorage.getItem('pdfEstMap')||'{}'); }catch(e){ guardadas = {}; }
  // Las siglas base van primero; lo que el usuario ya haya aprendido
  // por su cuenta (o corregido a mano) tiene prioridad y no se pisa.
  var combinado = {};
  for(var k1 in ESTACIONES_PDF_BASE) combinado[k1] = ESTACIONES_PDF_BASE[k1];
  for(var k2 in guardadas) combinado[k2] = guardadas[k2];
  return combinado;
})();

// ── Orquestador: primero aprende las siglas de estación que falten,
//    luego procesa una cola secuencial con preguntas solo si hace falta ──
var _cargaPdfCola = [], _cargaPdfIdx = 0, _cargaPdfAnio=null, _cargaPdfMes=null;
var _cargaPdfResumen = {cargados:0, sobrescritos:0, extra:0, omitidos:0, revisar:[]};
var _cargaPdfEstPendientes = [];

// NUEVO — Confirmado por Alex con capturas reales: si se pulsa
// "Cargar en calendario" dos veces seguidas (por ejemplo porque
// parecía que no pasaba nada al primer toque), la segunda pulsación
// reiniciaba la cola de carga desde cero MIENTRAS la primera todavía
// estaba a mitad de un conflicto sin resolver — el diálogo de
// conflicto viejo se quedaba en pantalla, desincronizado del proceso
// nuevo, y pulsar sus botones ya no hacía nada coherente. Este
// seguro impide que se pueda arrancar una segunda carga mientras la
// primera sigue en marcha.
var _cargaPdfEnProgreso = false;

/* ═══════════════════════════════════════════════════════════
   NUEVO — Carga segura del worker de PDF.js para móviles.
   Motivo: esta app se abre habitualmente como archivo local
   (content://... en Android, file:// en iOS). Cuando el origen de
   la página es un archivo local, muchos navegadores móviles
   BLOQUEAN por seguridad que un Worker se cargue directamente desde
   un dominio externo (cdnjs.cloudflare.com) — de ahí el error
   intermitente al leer PDF en iPhone/Android.
   Solución: se descarga el código del worker con fetch() y se
   convierte en un Blob local (blob:) — los navegadores SÍ permiten
   Workers desde blob: aunque la página esté en un origen local.
   Si el fetch falla (sin conexión), se cae al enlace directo como
   último recurso, igual que se hacía antes.
   No toca parseSchedulePdfText() ni ninguna lógica de lectura.
═══════════════════════════════════════════════════════════ */
var _pdfWorkerBlobUrl = null;
// FIX — Confirmado por Alex (bug real detectado en producción — la
// causa raíz de fondo): esta línea iba SUELTA, sin try/catch, a nivel
// superior del script — y esto se ejecuta muchísimo antes que el resto
// de la app (Compañeros, Admin, etc., definidos miles de líneas más
// abajo en este mismo <script>). Si pdfjsLib no había terminado de
// cargar desde el CDN todavía (red lenta o inestable, típico yendo en
// el tren), esta línea reventaba con "pdfjsLib is not defined" — y al
// ser un error sin capturar en código de nivel superior, esto CORTABA
// la ejecución del resto de ESTE MISMO <script> entero a partir de
// aquí. Es decir: ni BASES, ni activateBase(), ni
// mostrarSelectorCompaneros()/mostrarDetalleCompaneros() (los botones
// "Por nombre"/"Por número de tren" de Compañeros) llegaban siquiera a
// definirse — de ahí que los botones se vieran normales pero no
// hicieran nada al pulsarlos, sin ningún error visible en pantalla.
try{
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}catch(errPdfWorkerInitTemprano){
  console.log('pdfjsLib no estaba listo todavía aquí (CDN lento/bloqueado) — se continúa sin cortar el resto de la app. asegurarPdfWorkerSeguro() lo fija de forma segura más adelante, justo antes de leer un PDF de verdad.', errPdfWorkerInitTemprano);
}

// === ALMACENAMIENTO PERSISTENTE POR MES ===
// Capa propia de almacenamiento: usa localStorage del navegador (funciona en
// cualquier navegador normal, fuera del entorno de Claude). Si por algún
// motivo localStorage no está disponible, cae a un respaldo en memoria
// (no persiste al recargar, pero la app no se rompe).
let currentMonthKey = null; // ej. "MARZO 2026"
let horarioActualDias = null; // caché del array de días actualmente mostrado
let horarioActualMeta = null; // caché de los metadatos (empleado, mes, totales oficiales)

const memoryFallback = {};
const LS_OK = hasLocalStorage();

const localStore = {
  get(key){
    if(LS_OK) return window.localStorage.getItem(key);
    return (key in memoryFallback) ? memoryFallback[key] : null;
  },
  set(key, value){
    if(LS_OK) window.localStorage.setItem(key, value);
    else memoryFallback[key] = value;
  },
  remove(key){
    if(LS_OK) window.localStorage.removeItem(key);
    else delete memoryFallback[key];
  }
};

// ── Enganche a renderStats() — mismo patrón que ya usa Art.51/52:
// envuelve la versión ACTUAL de renderStats (que ya incluye la
// Auditoría de Horas, Art.51/52 y el Cómputo Excel) sin tocar nada
// de lo existente, solo añade esta llamada al final.
if(typeof renderStats === 'function'){
  var _renderStats_base_htdldias = renderStats;
  renderStats = function(){
    _renderStats_base_htdldias.apply(this, arguments);
    _renderHtdlDiasStats();
  };
}

/* ═══════════════════════════════════════════════════════════
   VALIDACIÓN ASISTIDA DH — extensión del motor de cálculo.
   Al marcar un tramo del horario individual como DH, la app
   pausa el registro automático y exige, mediante un pop-up,
   tres respuestas antes de aceptar el tramo como válido:
     1) ¿Mismo tren o tren diferente?
     2) Número de tren DH.
     3) Duración exacta del DH, en minutos.
   El sistema no calcula ningún total hasta que estas tres
   respuestas quedan confirmadas. Los minutos confirmados se
   etiquetan siempre como Horas de Presencia, nunca Efectivas.
     · Mismo tren → esos minutos se restan del tiempo del
       tramo en Horas Efectivas y pasan a Horas de Presencia.
     · Tren diferente → esos minutos se suman aparte a Horas
       de Presencia; el tramo de servicio cuenta íntegro en
       Horas Efectivas.
   No modifica el parseo del PDF ni los campos originales del
   tramo — todo vive en el campo adicional t.dh.
═══════════════════════════════════════════════════════════ */
var _dhValDia = null, _dhValTramo = null, _dhValMismoTren = null;

document.getElementById('monthSelect').addEventListener('change', async (e)=>{
  const mesKey = e.target.value;
  const data = await loadMonth(mesKey);
  if(data){
    currentMonthKey = mesKey;
    renderAll(data.dias, data.meta);
    document.getElementById('deleteMonthLabel').textContent = mesKey;
  }
});

document.getElementById('deleteBtn').addEventListener('click', async ()=>{
  if(!currentMonthKey){
    alert('No hay un mes cargado para eliminar.');
    return;
  }
  const ok = confirm('¿Eliminar el horario de ' + currentMonthKey + '? Esta acción no se puede deshacer.');
  if(!ok) return;

  const restantes = await deleteMonth(currentMonthKey);

  if(restantes.length > 0){
    const siguiente = restantes[restantes.length - 1];
    const data = await loadMonth(siguiente);
    currentMonthKey = siguiente;
    renderAll(data.dias, data.meta);
    document.getElementById('deleteMonthLabel').textContent = siguiente;
  } else {
    currentMonthKey = null;
    cont.innerHTML = '<div class="today-empty" style="margin:20px 4px;">No hay ningún horario guardado. Sube un PDF para empezar.</div>';
    document.querySelector('.board-sub').textContent = 'Sin horario cargado';
    document.querySelector('[data-stat="HE"]').textContent = '–';
    document.querySelector('[data-stat="HP"]').textContent = '–';
    document.querySelector('[data-stat="HDJ"]').textContent = '–';
    document.getElementById('cServicio').textContent = '–';
    document.getElementById('cLibre').textContent = '–';
    document.getElementById('cReserva').textContent = '–';
    todayWrap.style.display = 'none';
    document.getElementById('deleteMonthLabel').textContent = 'este mes';
  }
});

document.getElementById('fileInput').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const statusEl = document.getElementById('uploadStatus');
  const esImagen = file.type && file.type.indexOf('image/') === 0;
  try{
    var fullText = '';
    if(esImagen){
      // NUEVO — Lectura de imágenes/capturas (JPG, PNG, HEIC convertido,
      // etc.) vía OCR en el propio navegador (Tesseract.js). No se toca
      // el flujo de PDF: se llega al MISMO parseSchedulePdfText() de
      // siempre, con el texto que Tesseract logre reconocer.
      statusEl.textContent = 'Leyendo imagen (OCR)... esto puede tardar unos segundos';
      const resultadoOcr = await Tesseract.recognize(file, 'spa', {
        logger: function(m){
          if(m.status==='recognizing text'){
            statusEl.textContent = 'Leyendo imagen (OCR)... ' + Math.round((m.progress||0)*100) + '%';
          }
        }
      });
      fullText = resultadoOcr.data.text;
    } else {
      statusEl.textContent = 'Leyendo PDF...';
      await asegurarPdfWorkerSeguro();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data: buf}).promise;
      for(let p=1; p<=pdf.numPages; p++){
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const items = content.items.map(it=>({str:it.str, x:it.transform[4], y:it.transform[5]}));
        items.sort((a,b)=> b.y - a.y || a.x - b.x);
        let lastY = null;
        items.forEach(it=>{
          if(lastY !== null && Math.abs(it.y - lastY) > 2){ fullText += '\n'; }
          else if(lastY !== null){ fullText += ' '; }
          fullText += it.str;
          lastY = it.y;
        });
        fullText += '\n';
      }
    }
    // MISMO analizador de texto para PDF e imagen — ni una línea distinta
    // a partir de aquí entre ambos casos.
    const {dias: diasNuevo, meta} = parseSchedulePdfText(fullText);
    if(!diasNuevo.length){
      statusEl.textContent = esImagen
        ? 'No se pudo interpretar la imagen (formato no reconocido, o la foto no se ve con claridad).'
        : 'No se pudo interpretar el PDF (formato no reconocido).';
      return;
    }
    const mesKey = meta.mes || ('SIN-MES-' + Date.now());
    await saveMonth(mesKey, diasNuevo, meta);
    currentMonthKey = mesKey;
    renderAll(diasNuevo, meta);
    document.getElementById('deleteMonthLabel').textContent = mesKey;
    statusEl.textContent = '✓ Horario de ' + mesKey + ' guardado (no afecta a otros meses).';
  }catch(err){
    console.error(err);
    statusEl.textContent = 'Error al leer el archivo: ' + err.message;
  }
});

// === Arranque ===
// MODIFICADO: cada usuario empieza desde cero, sin datos de ejemplo
// precargados. Si no hay ningún mes guardado, se muestra el estado
// vacío invitando a subir el primer PDF — nada se auto-genera.
(async function initHorario(){
  const idx = await getMonthIndex();
  if(idx.length > 0){
    // Hay meses guardados de sesiones anteriores: cargar el último
    const ultimo = idx[idx.length - 1];
    const data = await loadMonth(ultimo);
    if(data){
      currentMonthKey = ultimo;
      await refreshMonthSelect(ultimo);
      if(typeof renderMonthListIndividual === 'function') await renderMonthListIndividual();
      renderAll(data.dias, data.meta);
      document.getElementById('deleteMonthLabel').textContent = ultimo;
      return;
    }
  }
  // Sin ningún mes guardado: estado vacío, esperando que el usuario suba su PDF
  currentMonthKey = null;
  cont.innerHTML = '<div class="today-empty" style="margin:20px 4px;">No hay ningún horario guardado. Sube un PDF para empezar.</div>';
  document.querySelector('.board-sub').textContent = 'Sin horario cargado';
  document.querySelector('[data-stat="HE"]').textContent = '–';
  document.querySelector('[data-stat="HP"]').textContent = '–';
  document.querySelector('[data-stat="HDJ"]').textContent = '–';
  document.getElementById('cServicio').textContent = '–';
  document.getElementById('cLibre').textContent = '–';
  document.getElementById('cReserva').textContent = '–';
  todayWrap.style.display = 'none';
  document.getElementById('deleteMonthLabel').textContent = 'este mes';
})();

/* ═══════════════════════════════════════════════════════════
   MÓDULO SOLICITAR HTDL — completamente aditivo
   No toca renderAll(), el calendario principal (TV/saveTV),
   ni ninguna función de visualización existente. Reutiliza
   loadMonth() (ya existente) para leer los días del horario
   parseado, y AJ.nombre/AJ.matricula (mismo origen que usa
   enviarCambio() para los cambios de turno).
═══════════════════════════════════════════════════════════ */
var _htdlDiasSeleccionados = [];

/* ═══════════════════════════════════════════════════════════
   MÓDULO TOUR GUIADO — completamente autocontenido.
   Usa localStorage('tourCompletado') — clave nueva, sin
   colisión con tv5/aj5/sf5/agenda5/comp5/tv2_extra/listaNegraApp.
   No depende de ningún dato del calendario ni de Ajustes para
   funcionar — solo lee/escribe su propia clave de control.
═══════════════════════════════════════════════════════════ */
var _tourPasoActual = 0;

var _dhTramo = null; // 'ida' | 'vuelta'
var _dhMismoTren = null;

// ── Switch Solo Ida ──
// No modifica ningún dato guardado — solo muestra/oculta
// el bloque de vuelta en el formulario activo.
var _soloIda = false;

// Resetear Solo Ida cada vez que se abre el formulario
// (se engancha en abrirForm() de forma no invasiva)
var _origAbrirForm = abrirForm;
abrirForm = function(edicion, verificando){
  _soloIda = false;
  _origAbrirForm(edicion, verificando);
};

// Objeto de acceso conveniente (se crea tarde, pero las funciones
// ya están disponibles por hoisting desde el primer momento)
var listaNegra = [];



/* ═══════════════════════════════════════════════════════════
   NUEVO — PANEL DE ADMINISTRADOR (horario y gráfico globales)
   Conectado a Supabase. La "Publishable key" es pública y segura
   para el navegador — toda la seguridad real vive en las políticas
   RLS del servidor (solo un perfil con rol='admin' puede escribir).
   100% aditivo: no toca TV/AJ ni ningún dato local existente.
═══════════════════════════════════════════════════════════ */
const SUPABASE_URL_ADMIN = 'https://xoftsdupynwhzxsiusox.supabase.co';
const SUPABASE_KEY_ADMIN = 'sb_publishable_jpuwxGvqz80zsRn2N_-qww_xqS1InnE';
// FIX — Confirmado por Alex: si el script de Supabase no llega a
// cargar (conexión mala, bloqueado, CDN caído...), esta línea
// rompía SIN capturar el error — y al ser código de nivel superior
// (no dentro de una función), eso podía cortar en seco todo lo que
// estuviera definido DESPUÉS en este mismo bloque de <script>, no
// solo el módulo de check-in. Ahora, si falla, sbAdmin se queda en
// null en vez de tirar abajo el resto del archivo — las funciones
// que ya comprobaban "sbAdmin sin definir" siguen funcionando igual
// (null también entra por ese chequeo), simplemente avisan de que no
// hay conexión en vez de romper la app entera.
var sbAdmin = null;
try{
  sbAdmin = supabase.createClient(SUPABASE_URL_ADMIN, SUPABASE_KEY_ADMIN);
}catch(errSbAdminInit){
  console.error('No se pudo inicializar Supabase (revisa la conexión/CDN):', errSbAdminInit);
}

/* ═══════════════════════════════════════════════════════════
   MÓDULO CHECK-IN DEL DÍA — v2, reconstruido desde cero.
   Mismo objetivo que antes (foto de la hoja de check-in de la
   oficina → OCR → datos compartidos por Supabase para todo el
   mundo), pero MÁS SIMPLE a propósito: se le pasa la foto EN CRUDO
   a Tesseract, sin ningún procesado propio de rotación/recorte/
   contraste — exactamente el mismo patrón que ya usa con éxito la
   función de "sube tu horario con una foto" (ver fileInput más
   arriba), en vez de una heurística propia que era mucho más difícil
   de depurar. Reutiliza sbAdmin/Tesseract.js ya cargados por el
   resto de la app — no crea ninguna dependencia nueva.

   Tabla checkin_diario (fecha,sede) como clave primaria: solo la
   primera persona que confirma una subida puede crear la fila
   (política RLS "insertar si no existe"); a partir de ahí cualquier
   intento de volver a subir usa upsert() → Postgres lo convierte en
   UPDATE, y la política RLS "solo admin edita" bloquea ese UPDATE
   para cualquiera que no sea Admin. El "primero gana, solo Admin
   corrige" vive en las políticas de la base de datos, no en este JS.

   TODA llamada a Supabase pasa por ciConTimeout() — así ninguna
   pantalla se puede quedar colgada en "Cargando…" para siempre si la
   conexión va mal o se corta en silencio (el fallo que tenía la
   versión anterior).
═══════════════════════════════════════════════════════════ */
var _ciFilasPendientes = null;
var _ciTextoOcrCrudo = null; // [{archivo, texto}] — texto crudo del OCR de cada foto, para diagnóstico
var _ciReservasPendientes = null;
var _ciFechaViendo = null;
// NUEVO — AQUÍ es donde se pega el script real de Google AdSense o
// de Adsterra en cuanto Alex tenga aprobada la cuenta. De momento no
// hace nada — solo se carga si la persona ya aceptó las cookies (o
// ya las había aceptado antes), cumpliendo la ley de cookies europea
// (nunca se cargan scripts de publicidad sin consentimiento previo).
// NUEVO — Confirmado por Alex: toda la publicidad se oculta por
// ahora, hasta nueva orden. Con este interruptor en "true" no se
// carga NINGÚN anuncio (Banner 468x60 ni Social Bar), aunque la
// persona haya aceptado las cookies — para volver a activarla, basta
// con cambiar esto a "false", sin tocar nada más del código.
var PUBLICIDAD_OCULTA_TEMPORALMENTE = true;

// NUEVO — Social Bar de Adsterra, SOLO en Ajustes. El script de
// Adsterra no distingue pantallas por sí solo (suele fijar su
// elemento directo en <body>, con position:fixed), así que aquí se
// guarda una "foto" de qué hijos tenía <body> ANTES de cargarlo, y al
// salir de Ajustes se borra cualquier hijo NUEVO que haya aparecido
// desde entonces — así se retira de verdad, no solo se deja de
// cargar el script.
var _socialBarHijosPrevios = null;
