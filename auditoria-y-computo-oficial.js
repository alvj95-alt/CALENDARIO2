/* TrenTurnos v5 — Auditoría de horas y comparativa con el Cómputo Oficial (Excel)
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   MÓDULO HORAS — comparativa PDF oficial vs cálculo de la app.
   Puramente aditivo y de solo lectura: no modifica TV, AJ, ni
   los datos del horario guardado. Lee siempre desde localStore
   (vía loadMonth), así que persiste igual al navegar entre
   pestañas — no depende de ninguna variable temporal en memoria.
   · Datos del PDF (oficial): meta.totalHE / meta.totalHP, tal
     como los reporta la empresa en el propio documento.
   · Datos calculados (app):
       Horas de Presencia = Σ escalas (huecos entre tramos de un
       mismo día de servicio) + Σ horas previstas de los días de
       reserva (HP propio de cada día RESERVA).
       Horas Efectivas = Σ tiempo "arriba del tren" (salida→llegada)
       de cada tramo de los días de servicio.
═══════════════════════════════════════════════════════════ */
function _horasToMin(hhmm){
  if(!hhmm || typeof hhmm !== 'string') return null;
  var p = hhmm.split(':').map(Number);
  if(p.length<2 || isNaN(p[0]) || isNaN(p[1])) return null;
  return p[0]*60+p[1];
}
function _minToHoras(mins){
  mins = Math.max(0, Math.round(mins||0));
  var h = Math.floor(mins/60), m = mins%60;
  return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
}

/* ═══════════════════════════════════════════════════════════
   AUDITORÍA DE HORAS — vista de solo lectura.
   Compara exclusivamente dos fuentes ya existentes, sin calcular
   nada nuevo ni tocar ningún dato:
     · PDF Oficial   → meta.totalHE / meta.totalHP (tal cual las
       reporta la empresa en el documento subido).
     · Registro App  → calculateEarnings(ksCal).efectivasCalMin /
       .presenciaCalMin (el mismo total que ya usa el motor del
       calendario principal para Estadísticas).
   No escribe en ningún sitio — es puramente informativa.
═══════════════════════════════════════════════════════════ */

// MOVIDO — Confirmado por el usuario: esta auditoría vivía en Stats
// (con su propio botón/panel colapsable) y ahora vive SIEMPRE VISIBLE
// dentro de la pantalla de Nómina, comparando el mes TRABAJADO (el
// mismo mes que ya usan HTDL/Nocturnidad/Art.51-52 ahí, por pagarse a
// mes vencido) — no el mes de cobro que se está viendo.
async function renderAuditoriaHoras(){
  var panel = document.getElementById('nomina-auditoria-box');
  if(!panel) return;

  if(!nomM) nomM = new Date();
  var mesTrab = _nominaMesAnterior(nomM.getFullYear(), nomM.getMonth()+1);
  var y = mesTrab.anio, m = mesTrab.mes;
  var mesVisibleLbl = MESES[m-1]+' '+y;
  var fechaRefMes = new Date(y, m-1, 1);

  // Columna A — PDF Oficial: indexado por el mes TRABAJADO.
  var data = await buscarPdfDelMes(fechaRefMes);
  var meta = (data && data.meta) ? data.meta : {};
  var pdfEfectivas = meta.totalHE || 'No registrado';
  var pdfPresencia = meta.totalHP || 'No registrado';
  var pdfMesLbl = meta.mes || 'sin PDF para este mes';

  // Columna B — Registro App (calendario): mismo mes trabajado.
  var pref=y+'-'+pad(m);
  var ksCal=Object.keys(TV).filter(function(k){return k.startsWith(pref);});
  var eCal = calculateEarnings(ksCal);
  var appEfectivas = _minToHoras(eCal.efectivasCalMin) || '00:00';
  var appPresencia = _minToHoras(eCal.presenciaCalMin) || '00:00';

  // HTDL — acumulado independiente, nunca sumado a Efectivas/Presencia
  // de la jornada ordinaria (ver calculateEarnings: rama t.tipo==='trabajado').
  var htdlTotalMin = eCal.efectivasHTDLMin + eCal.presenciaHTDLMin;
  var htdlTotal = _minToHoras(htdlTotalMin) || '00:00';
  var htdlEfectivas = _minToHoras(eCal.efectivasHTDLMin) || '00:00';
  var htdlPresencia = _minToHoras(eCal.presenciaHTDLMin) || '00:00';

  // Columna C — Referencia ajustada (163h − 5,5h × días COMPE de ESTE
  // mes trabajado). Puramente informativa — no calcula ningún pago.
  var refInfoAud = _nominaJornadaRefAjustada(y, m);
  var refAjustadaLbl = refInfoAud.ref.toFixed(1)+'h'+(refInfoAud.diasCompe>0 ? ' (163h − '+refInfoAud.diasCompe+'×5,5h)' : '');

  panel.innerHTML =
    '<div class="cs-box">'
    +'<div class="cs-t">Auditoría de Horas · '+mesVisibleLbl+'</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<tr>'
      +'<td style="padding:6px 4px;color:var(--tx3)"></td>'
      +'<td style="padding:6px 4px;color:var(--acc2);font-weight:800;text-align:center">PDF Oficial<br><span style="font-weight:600;font-size:9px;color:var(--tx3)">'+pdfMesLbl+'</span></td>'
      +'<td style="padding:6px 4px;color:var(--green2);font-weight:800;text-align:center">Registro App<br><span style="font-weight:600;font-size:9px;color:var(--tx3)">'+mesVisibleLbl+'</span></td>'
      +'<td style="padding:6px 4px;color:#c4b5fd;font-weight:800;text-align:center">Ref. Ajustada<br><span style="font-weight:600;font-size:9px;color:var(--tx3)">163h − COMPE</span></td>'
    +'</tr>'
    +'<tr style="border-top:1px solid var(--div)">'
      +'<td style="padding:8px 4px;color:var(--tx2)">Horas Efectivas</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:var(--acc2)">'+pdfEfectivas+'</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:var(--green2)">'+appEfectivas+'</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:#c4b5fd">'+refAjustadaLbl+'</td>'
    +'</tr>'
    +'<tr style="border-top:1px solid var(--div)">'
      +'<td style="padding:8px 4px;color:var(--tx2)">Horas Presencia</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:var(--acc2)">'+pdfPresencia+'</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:var(--green2)">'+appPresencia+'</td>'
      +'<td style="padding:8px 4px;text-align:center;color:var(--tx3);font-size:10px">—</td>'
    +'</tr>'
    +'</table>'
    +'<div style="margin-top:8px;font-size:9.5px;color:var(--tx3);line-height:1.5">📐 Si los tres números de Horas Efectivas coinciden (PDF, App y Referencia Ajustada), tu calendario está completo y vas a cobrar el Salario Base íntegro ese mes. Esto no calcula ningún pago — es solo para que compares tú mismo.</div>'
    +'<div style="height:1px;background:var(--div);margin:10px 0"></div>'
    +'<div style="font-size:10px;font-weight:800;letter-spacing:.3px;color:var(--amber2);margin-bottom:6px">HTDL (HORAS EN DÍAS DE DESCANSO) · INDEPENDIENTE DE LA JORNADA ORDINARIA</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<tr>'
      +'<td style="padding:6px 4px;color:var(--tx2);font-weight:800">Total HTDL</td>'
      +'<td style="padding:6px 4px;text-align:right;font-weight:800;color:var(--amber2)">'+htdlTotal+'</td>'
    +'</tr>'
    +'<tr style="border-top:1px solid var(--div)">'
      +'<td style="padding:6px 4px 6px 14px;color:var(--tx3);font-size:11px">↳ Efectivas (HTDL)</td>'
      +'<td style="padding:6px 4px;text-align:right;color:var(--tx3);font-size:11px">'+htdlEfectivas+'</td>'
    +'</tr>'
    +'<tr>'
      +'<td style="padding:2px 4px 6px 14px;color:var(--tx3);font-size:11px">↳ Presencia (HTDL)</td>'
      +'<td style="padding:2px 4px 6px;text-align:right;color:var(--tx3);font-size:11px">'+htdlPresencia+'</td>'
    +'</tr>'
    +'</table>'
    +'</div>';
}

/* ═══════════════════════════════════════════════════════════
   COMPARATIVA CON CÓMPUTO OFICIAL (EXCEL) — módulo aditivo e
   independiente de "Auditoría de Horas" de arriba (esa compara
   App vs. PDF de horario). Este compara, día a día, el Excel
   oficial "ComputoTurnos_XXXXX_AAAAMM.xlsx" que emite Serveo
   contra lo que calcula la app, para las 4 categorías que la
   app SÍ modela (H.E., H.P., Noct., HTDL). Reutiliza
   exclusivamente calcularJornadaDiaria() y calculateEarnings()
   ya existentes — cero matemática duplicada. Rebase, Trasl.,
   Plus Trasl., TpTrans y Plus Inter. NO existen como conceptos
   en la app: se muestran solo como referencia del Excel, nunca
   como discrepancia.
   Solo lectura: no escribe en TV, TV2 ni en ningún dato guardado.
═══════════════════════════════════════════════════════════ */
function _xlsxSerialAMin(v){
  // Celdas de duración (formato [h]:mm:ss) llegan como número =
  // fracción de día, y PUEDEN superar 1 (ej. "1 día, 7:51:00").
  // Con raw:true nunca se convierten a Date, así que basta multiplicar.
  if(v==null || v==='') return 0;
  if(typeof v==='number') return Math.round(v*24*60);
  return 0;
}
function _xlsxSerialAFechaKey(v){
  // Serial de fecha Excel (raw, sin cellDates) → 'YYYY-MM-DD'.
  if(typeof v!=='number') return null;
  var ms = Math.round((v - 25569) * 86400 * 1000);
  var d = new Date(ms);
  return key(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate());
}
function _minAHHMM(mins){
  mins = Math.round(mins||0);
  var neg = mins<0; mins=Math.abs(mins);
  var h=Math.floor(mins/60), m=mins%60;
  return (neg?'-':'')+h+'h '+(m<10?'0':'')+m+'m';
}

function handleComputoExcelUpload(file){
  if(!file) return;
  // Permite volver a subir el MISMO archivo más tarde (p.ej. si se quitó
  // la comparación y se recarga el mismo mes) — sin esto, el navegador
  // no dispara 'onchange' dos veces seguidas para idéntico archivo.
  var _inp=document.getElementById('fileComputoExcel'); if(_inp) _inp.value='';
  if(typeof XLSX === 'undefined'){ alert('No se pudo cargar el lector de Excel (librería no disponible). Comprueba tu conexión e inténtalo de nuevo.'); return; }
  var reader = new FileReader();
  reader.onerror = function(){
    console.log('Cómputo Excel: FileReader falló al leer el archivo.', reader.error);
    alert('No se ha podido abrir el archivo desde el dispositivo. Vuelve a intentarlo o comprueba que el archivo no esté dañado.');
  };
  reader.onload = function(e){
    try{
      var buf = e.target.result;
      var wb = XLSX.read(buf, {type:'array'}); // sin cellDates: raw numérico, control total de la conversión
      var hoja = wb.Sheets[wb.SheetNames[0]];
      var filas = XLSX.utils.sheet_to_json(hoja, {header:1, raw:true, defval:null});
      var parsed = _parseComputoExcelFilas(filas);
      if(parsed && parsed.error){
        // Diagnóstico específico según qué falló — mucho más útil que
        // un "no se ha reconocido" genérico cuando algo no encaja.
        if(parsed.error==='sin-cabecera'){
          alert('No se ha encontrado la columna "Fecha" en este archivo. ¿Es el "Cómputo de Turnos" oficial de Serveo, tal cual se descarga (sin editar)?');
        } else if(parsed.error==='faltan-columnas'){
          alert('Este Excel no tiene todas las columnas esperadas. Faltan: '+parsed.faltantes.join(', ')+'. Revisa la consola del navegador para ver qué columnas sí se detectaron.');
        } else if(parsed.error==='sin-filas-fecha'){
          alert('Se encontró la cabecera pero ninguna fila tiene una fecha válida debajo. ¿El archivo tiene datos de días entre la cabecera y la fila TOTALES?');
        } else {
          alert('No se ha reconocido el formato de este Excel.');
        }
        return;
      }
      if(!parsed || !Object.keys(parsed.porDia).length){
        alert('No se ha reconocido el formato de este Excel. ¿Es el "Cómputo de Turnos" oficial de Serveo?');
        return;
      }
      parsed.nombre = file.name;
      var claveMes = parsed.y+'-'+pad(parsed.m);
      _computoExcelPorMes[claveMes] = parsed;
      _guardarComputoExcelPorMes();
      renderComparativaComputoExcel(); // decide por sí sola si mostrar u ocultar, según el mes trabajado
      // MOVIDO — el aviso ahora compara contra el mes TRABAJADO que
      // muestra Nómina (nomM menos un mes), no contra Estadísticas.
      if(!nomM) nomM = new Date();
      var mesTrabAviso = _nominaMesAnterior(nomM.getFullYear(), nomM.getMonth()+1);
      if(parsed.y!==mesTrabAviso.anio || parsed.m!==mesTrabAviso.mes){
        alert('Excel de '+parsed.mesLbl+' guardado. Se mostrará automáticamente en Nómina cuando esa nómina corresponda a lo trabajado en '+parsed.mesLbl+'.');
      }
    }catch(err){
      console.log('Error leyendo Cómputo Excel:', err);
      alert('No se ha podido leer el archivo ('+(err&&err.message?err.message:'error desconocido')+'). Comprueba que sea el .xlsx original sin modificar.');
    }
  };
  reader.readAsArrayBuffer(file);
}

function _normHdr(s){
  // Normaliza texto de cabecera: espacios no separables (\u00A0, que
  // Excel a veces inserta) a espacio normal, colapsa espacios
  // repetidos y recorta extremos. Sin esto, una cabecera con un
  // espacio "raro" (visualmente idéntica a 'H. E.') no haría match
  // nunca y el Excel se descartaría entero sin avisar por qué.
  return String(s||'').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim();
}

function _parseComputoExcelFilas(filas){
  // Localiza la fila de cabecera buscando 'Fecha' en cualquier columna,
  // en vez de asumir una fila fija — más resistente a pequeños cambios
  // de formato entre exportaciones.
  var hdrRow=-1, cols={};
  for(var r=0;r<filas.length;r++){
    var f=filas[r]; if(!f) continue;
    var idxFecha=f.findIndex(function(v){return _normHdr(v)==='Fecha';});
    if(idxFecha>=0){
      hdrRow=r;
      f.forEach(function(v,i){ cols[_normHdr(v)] = i; });
      break;
    }
  }
  if(hdrRow<0){
    console.log('Cómputo Excel: no se encontró ninguna fila con la columna "Fecha". Primeras filas leídas:', filas.slice(0,10));
    return {error:'sin-cabecera'};
  }
  var need=['Fecha','H. E.','H. P.','Noct.','Rebase','HTDL','Trasl.','Plus Trasl.','TpTrans','Plus Inter.','JT'];
  var faltan = need.filter(function(n){ return cols[n]===undefined; });
  if(faltan.length){
    console.log('Cómputo Excel: faltan columnas', faltan, '· cabeceras detectadas:', Object.keys(cols));
    return {error:'faltan-columnas', faltantes:faltan, detectadas:Object.keys(cols)};
  }

  var porDia={}, y=null, m=null;
  for(var i=hdrRow+1;i<filas.length;i++){
    var fila=filas[i]; if(!fila) continue;
    var fechaV=fila[cols['Fecha']];
    if(typeof fechaV!=='number') continue; // fila TOTALES/A PAGAR o vacía: no tiene fecha numérica
    var k=_xlsxSerialAFechaKey(fechaV);
    if(!k) continue;
    if(y===null){ var kk=k.split('-'); y=parseInt(kk[0]); m=parseInt(kk[1]); }
    // Rotación 1/2 = número(s) de tren/servicio del día, tal como los
    // reporta Serveo. Se leen "a la ligera" (no van en `need`): si algún
    // mes no trae estas columnas, el resto del Cómputo sigue funcionando
    // igual, solo que sin número de tren que mostrar/comparar.
    var rot1 = (cols['Rotación 1']!==undefined) ? String(fila[cols['Rotación 1']]||'').trim() : '';
    var rot2 = (cols['Rotación 2']!==undefined) ? String(fila[cols['Rotación 2']]||'').trim() : '';
    porDia[k]={
      HE:_xlsxSerialAMin(fila[cols['H. E.']]),
      HP:_xlsxSerialAMin(fila[cols['H. P.']]),
      Noct:_xlsxSerialAMin(fila[cols['Noct.']]),
      Rebase:_xlsxSerialAMin(fila[cols['Rebase']]),
      HTDL:_xlsxSerialAMin(fila[cols['HTDL']]),
      Trasl:_xlsxSerialAMin(fila[cols['Trasl.']]),
      PlusTrasl:_xlsxSerialAMin(fila[cols['Plus Trasl.']]),
      TpTrans:parseFloat(fila[cols['TpTrans']])||0,
      PlusInter:parseFloat(fila[cols['Plus Inter.']])||0,
      JT:parseFloat(fila[cols['JT']])||0,
      TrenExcel: (rot1 + (rot2 ? ' / '+rot2 : '')).trim()
    };
  }
  if(y===null){
    console.log('Cómputo Excel: cabecera encontrada pero ninguna fila tenía una fecha numérica válida bajo ella.');
    return {error:'sin-filas-fecha'};
  }
  return {porDia:porDia, y:y, m:m, mesLbl:MESES[m-1]+' '+y};
}

// FIX — Confirmado por el usuario: este botón sigue usando statsM (el
// mes de Stats) para decidir qué comparación borrar, aunque la
// Comparativa con Cómputo Excel ya no vive en Stats — ahora vive en
// Nómina y se indexa por el mes TRABAJADO (nomM menos un mes, igual
// que renderComparativaComputoExcel(), justo arriba). Con el bug, si
// mirabas julio en Nómina pero statsM seguía en agosto (por ejemplo),
// el botón "✕ Quitar esta comparación" borraba el Excel de agosto en
// vez del de julio que estabas viendo — ahora usa el mismo criterio
// que la propia pantalla que muestra el botón.
// Quita SOLO la comparación del mes que estás viendo ahora mismo (no
// borra nada de TV/AJ, ni los demás meses guardados). Si subiste
// junio y julio, y quitas julio, junio sigue intacto.
function quitarComputoExcel(){
  if(!nomM) nomM = new Date();
  var mesTrab = _nominaMesAnterior(nomM.getFullYear(), nomM.getMonth()+1);
  var claveMes = mesTrab.anio+'-'+pad(mesTrab.mes);
  delete _computoExcelPorMes[claveMes];
  _guardarComputoExcelPorMes();
  var panel=document.getElementById('computo-excel-panel');
  if(panel){ panel.style.display='none'; panel.innerHTML=''; }
  var inp=document.getElementById('fileComputoExcel'); if(inp) inp.value='';
}

// NUEVO — junta TODOS los números de tren que la app tiene registrados
// para un día (ida, vuelta, intermedio de pernocta, y los de un DH),
// para poder comparar contra "Rotación 1/2" del Cómputo Excel oficial.
function _trenesAppDelDia(k){
  var t = TV[k];
  if(!t) return '';
  var trenes = [t.numTren, t.numTrenVuelta, t.numTrenIntermedio, t.dhTrenDH, t.dhTrenDHVuelta]
    .filter(function(x){ return x && String(x).trim().length; })
    .map(function(x){ return String(x).trim(); });
  // Sin duplicados, mismo orden en que aparecen
  var vistos={};
  trenes = trenes.filter(function(x){ if(vistos[x]) return false; vistos[x]=true; return true; });
  return trenes.join(' / ');
}

function renderComparativaComputoExcel(){
  var panel=document.getElementById('computo-excel-panel');
  if(!panel) return;

  // MOVIDO — Confirmado por el usuario: el Excel a mostrar es el que
  // corresponda al mes TRABAJADO de Nómina (nomM menos un mes, ya que
  // las variables se cobran a mes vencido) — igual criterio que ya
  // usa la Auditoría de Horas justo arriba en esta misma pantalla.
  // Buscado directamente en el almacén persistente por mes — así
  // sobrevive a recargar la página y aparece solo, sin volver a
  // subir nada, en cuanto navegas a ESE mes trabajado.
  if(!nomM) nomM = new Date();
  var mesTrabExcel = _nominaMesAnterior(nomM.getFullYear(), nomM.getMonth()+1);
  var yVisible=mesTrabExcel.anio, mVisible=mesTrabExcel.mes;
  var claveMes = yVisible+'-'+pad(mVisible);
  var datos = _computoExcelPorMes[claveMes];
  if(!datos){ panel.style.display='none'; return;
  }
  panel.style.display='block';

  var y=datos.y, m=datos.m;
  var pref=y+'-'+pad(m);
  var ksMes=Object.keys(TV).filter(function(k){return k.startsWith(pref);});
  var eMes=calculateEarnings(ksMes); // reutilizado tal cual, sin tocar

  // La app expone 4 magnitudes de horas comparables: Efectivas,
  // Presencia, Nocturnidad y HTDL. HTDL es la suma de su Efectiva+
  // Presencia propias (mismo criterio que usa "Auditoría de Horas" más
  // arriba: htdlTotalMin = efectivasHTDLMin + presenciaHTDLMin) — un
  // único total comparable contra la columna "HTDL" del Excel, que
  // también es una sola cifra. Nocturnidad reutiliza diasNocDetail
  // (ya calculado por calculateEarnings, mismo cn() de siempre).
  var totalNocAppMin = Math.round((eMes.diasNocDetail||[]).reduce(function(s,d){return s+(d.hNoc||0);},0)*60);
  var totalApp={HE:eMes.efectivasCalMin||0, HP:eMes.presenciaCalMin||0, Noct:totalNocAppMin, HTDL:(eMes.efectivasHTDLMin||0)+(eMes.presenciaHTDLMin||0)};
  var totalExcel={HE:0,HP:0,Noct:0,Rebase:0,HTDL:0,Trasl:0,PlusTrasl:0,TpTrans:0,PlusInter:0,JT:0};
  var discrepancias=[];
  var UMBRAL_MIN=1; // ignora diferencias de redondeo de menos de 1 minuto

  // Plus JT: la app ya lo calcula por turno (t.plusJT) y lo agrega en
  // calculateEarnings() como e.diasJT (mismo dato que se muestra en el
  // desglose "✅ Plus JT (×N)" de Estadísticas) — se reutiliza tal cual.
  totalApp.JT = (eMes.diasJT||[]).length;

  // Nocturnidad por etiqueta de día ("3 jun") — mismo array que ya usa
  // la app en otros sitios (diasNocDetail), solo se agrega por fecha
  // para poder comparar día a día más abajo.
  var nocPorLbl={};
  (eMes.diasNocDetail||[]).forEach(function(d){ nocPorLbl[d.lbl]=(nocPorLbl[d.lbl]||0)+Math.round((d.hNoc||0)*60); });
  // NUEVO — recoge la fila completa de CADA día (no solo los que
  // tienen diferencia), para la exportación de "Comparativa completa".
  var comparativaCompleta = [];

  Object.keys(datos.porDia).sort().forEach(function(k){
    var ex=datos.porDia[k];
    var kk=k.split('-'); var dd=parseInt(kk[2]);
    Object.keys(totalExcel).forEach(function(c){ if(c!=='JT') totalExcel[c]+=ex[c]||0; });
    totalExcel.JT += ex.JT||0;

    // Desglose día a día — mismo criterio de reparto que calculateEarnings:
    // un día HTDL suma su Efectiva+Presencia a un único total HTDL; un
    // día ordinario suma a Efectiva/Presencia normales. Es aproximado a
    // nivel de día (los ajustes de enlace entre días de calculateEarnings
    // solo se aplican al total del mes, no aquí), así que se usa solo
    // para señalar posibles diferencias a revisar, no como cifra oficial.
    //
    // FIX — el día de VUELTA de una pernocta (tipo 'vuelta-pernocta') o
    // el día intermedio de una pernocta de 3 días ('pernocta3-intermedio')
    // no los reconoce calcularJornadaDiaria() (solo conoce ordinario/
    // trabajado/art5152/reserva), así que sin este parche ese día
    // siempre salía con 0 horas en la comparativa — aunque el número de
    // tren sí saliera bien (viene de otro campo, _trenesAppDelDia). Las
    // horas reales de ESE día concreto están en su propio hF/hL: se
    // guardan ahí tal cual al crear la pernocta (ver TV[kSig]/TV[kFin]
    // más arriba en el archivo). El tipo de bucket (HTDL u ordinario) se
    // hereda del turno de origen (origenPernocta), que es el que dice si
    // toda la pernocta es un HTDL trabajado o un servicio ordinario.
    var turnoDelDia = TV[k];
    var esDiaDerivadoPernocta = turnoDelDia && (turnoDelDia.tipo==='vuelta-pernocta' || turnoDelDia.tipo==='pernocta3-intermedio');
    var jornada;
    if(esDiaDerivadoPernocta){
      var minVuelta = (turnoDelDia.hF && turnoDelDia.hL) ? calcMins(turnoDelDia.hF, turnoDelDia.hL) : 0;
      var origenPernoctaT = turnoDelDia.origenPernocta ? TV[turnoDelDia.origenPernocta] : null;
      var esHTDLDerivado = !!(origenPernoctaT && origenPernoctaT.tipo==='trabajado');
      // FIX — repartir directamente al bucket correcto (Cal u HTDL)
      // en vez de un esHTDL de solo lectura que ya no usan appHE/appHP/appHTDL.
      jornada = esHTDLDerivado
        ? {efectivasMin:0, presenciaMin:0, efectivasHTDLMin:minVuelta, presenciaHTDLMin:0}
        : {efectivasMin:minVuelta, presenciaMin:0, efectivasHTDLMin:0, presenciaHTDLMin:0};
    } else {
      jornada = calcularJornadaDiaria(getTurnosDia(k), k);
      // Si ESTE día es el ORIGEN de una pernocta, calcularJornadaDiaria()
      // suma también el tramo de vuelta (hF2/hL2) a este mismo día, aunque
      // esa vuelta ocurra físicamente al día siguiente. Como ese tramo ya
      // se cuenta en SU propio día (rama de arriba), aquí se resta para
      // que cada tramo compute una sola vez y en el día que le toca —
      // igual que hace el Cómputo Excel, que reparte por fecha real.
      if(turnoDelDia && (turnoDelDia.modo==='pernocta' || turnoDelDia.modo==='pernocta3') && turnoDelDia.hF2 && turnoDelDia.hL2){
        var minVueltaEnOrigen = calcMins(turnoDelDia.hF2, turnoDelDia.hL2);
        // FIX — restar del bucket correcto: si el turno de origen es
        // HTDL/Art.51-52, esos minutos viven en efectivasHTDLMin, no
        // en efectivasMin (antes siempre restaba de efectivasMin, lo
        // que en un origen HTDL dejaba el número mal repartido).
        var esOrigenHTDL = (turnoDelDia.tipo==='trabajado' || turnoDelDia.tipo==='art5152');
        if(esOrigenHTDL){
          jornada.efectivasHTDLMin = Math.max(0, jornada.efectivasHTDLMin - minVueltaEnOrigen);
        } else {
          jornada.efectivasMin = Math.max(0, jornada.efectivasMin - minVueltaEnOrigen);
        }
      }
    }
    var appHE = jornada.efectivasMin;
    var appHP = jornada.presenciaMin;
    var appHTDL = jornada.efectivasHTDLMin + jornada.presenciaHTDLMin;
    var dL = dd+' '+MESES_C[m-1];

    var appNoct = nocPorLbl[dL]||0;
    var appJT = (TV[k] && TV[k].plusJT) ? 1 : 0;

    var diffs=[];
    if(Math.abs(ex.HE-appHE)>UMBRAL_MIN) diffs.push({c:'H.E.',ex:ex.HE,app:appHE});
    if(Math.abs(ex.HP-appHP)>UMBRAL_MIN) diffs.push({c:'H.P.',ex:ex.HP,app:appHP});
    if(Math.abs(ex.Noct-appNoct)>UMBRAL_MIN) diffs.push({c:'Noct.',ex:ex.Noct,app:appNoct});
    if(Math.abs(ex.HTDL-appHTDL)>UMBRAL_MIN) diffs.push({c:'HTDL',ex:ex.HTDL,app:appHTDL});
    if(ex.JT!==appJT) diffs.push({c:'Plus JT',ex:ex.JT,app:appJT,esConteo:true});
    if(diffs.length) discrepancias.push({fecha:pad(dd)+'/'+pad(m), diffs:diffs, trenExcel:ex.TrenExcel||'', trenApp:_trenesAppDelDia(k)});

    // NUEVO — fila COMPLETA de este día (haya o no diferencia), para
    // poder exportar la comparativa entera además de solo las
    // diferencias. Reutiliza los mismos valores ya calculados arriba
    // (ex.*/app*), no se recalcula nada distinto.
    comparativaCompleta.push({
      fecha:pad(dd)+'/'+pad(m),
      HEExcel:ex.HE, HEApp:appHE,
      HPExcel:ex.HP, HPApp:appHP,
      NoctExcel:ex.Noct, NoctApp:appNoct,
      HTDLExcel:ex.HTDL, HTDLApp:appHTDL,
      JTExcel:ex.JT, JTApp:appJT,
      Rebase:ex.Rebase||0, Traslados:ex.Trasl||0, PlusTraslado:ex.PlusTrasl||0,
      TiempoTransporte:ex.TpTrans||0, PlusInterrupcion:ex.PlusInter||0,
      trenExcel:ex.TrenExcel||'', trenApp:_trenesAppDelDia(k)
    });
  });

  // Guardado para que el selector de categoría y los botones de
  // descarga puedan usarlo sin tener que recalcular nada.
  _computoExcelDatosActual = {discrepancias:discrepancias, porDia:datos.porDia, comparativaCompleta:comparativaCompleta, y:y, m:m, mesLbl:datos.mesLbl};

  var filaTotal=function(lbl,cKey){
    var ex=totalExcel[cKey], ap=totalApp[cKey];
    var ok=Math.abs(ex-ap)<=UMBRAL_MIN;
    return '<tr style="border-top:1px solid var(--div)">'
      +'<td style="padding:8px 4px;color:var(--tx2)">'+lbl+'</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:var(--amber2)">'+_minAHHMM(ex)+'</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:var(--green2)">'+_minAHHMM(ap)+'</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:'+(ok?'var(--green2)':'var(--red2)')+'">'+(ok?'✅':_minAHHMM(ex-ap))+'</td>'
      +'</tr>';
  };

  var filaExcelSolo=function(lbl,cKey,esNumero){
    var v=totalExcel[cKey];
    return '<tr style="border-top:1px solid var(--div)">'
      +'<td style="padding:6px 4px;color:var(--tx2);font-size:11px">'+lbl+'</td>'
      +'<td style="padding:6px 4px;text-align:center;color:var(--acc2);font-weight:700;font-size:12px" colspan="3">'+(esNumero?v:_minAHHMM(v))+'</td>'
      +'</tr>';
  };

  // Plus JT es un CONTADOR de días (0/1), no una duración — filaTotal
  // usaría _minAHHMM() y mostraría cosas sin sentido tipo "0h 01m".
  var filaTotalCount=function(lbl,cKey){
    var ex=totalExcel[cKey], ap=totalApp[cKey];
    var ok=ex===ap;
    return '<tr style="border-top:1px solid var(--div)">'
      +'<td style="padding:8px 4px;color:var(--tx2)">'+lbl+'</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:var(--amber2)">'+ex+' día(s)</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:var(--green2)">'+ap+' día(s)</td>'
      +'<td style="padding:8px 4px;text-align:center;font-weight:800;color:'+(ok?'var(--green2)':'var(--red2)')+'">'+(ok?'✅':(ex>ap?'+':'')+(ex-ap))+'</td>'
      +'</tr>';
  };

  panel.innerHTML =
    '<div class="cs-box">'
    +'<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<div class="cs-t">Cómputo Oficial vs. App · '+datos.mesLbl+'</div>'
      +'<button onclick="quitarComputoExcel()" title="Quitar esta comparación" style="background:none;border:none;color:var(--tx3);font-size:16px;cursor:pointer;padding:2px 6px">✕</button>'
    +'</div>'
    +'<div style="font-size:9px;color:var(--tx3);margin:-4px 0 8px">Archivo: '+datos.nombre+' · Para otro mes, quita esta comparación y sube el Cómputo Excel de ese mes</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<tr>'
      +'<td style="padding:6px 4px;color:var(--tx3)"></td>'
      +'<td style="padding:6px 4px;color:var(--amber2);font-weight:800;text-align:center">Cómputo Excel</td>'
      +'<td style="padding:6px 4px;color:var(--green2);font-weight:800;text-align:center">Registro App</td>'
      +'<td style="padding:6px 4px;color:var(--tx3);font-weight:800;text-align:center">Δ</td>'
    +'</tr>'
    +filaTotal('Horas Efectivas','HE')
    +filaTotal('Horas Presencia','HP')
    +filaTotal('Nocturnidad','Noct')
    +filaTotal('HTDL','HTDL')
    +filaTotalCount('Plus JT','JT')
    +'</table>'
    +'<div style="height:1px;background:var(--div);margin:10px 0"></div>'
    +'<div style="font-size:10px;font-weight:800;letter-spacing:.3px;color:var(--tx2);margin-bottom:6px">CATEGORÍAS SOLO EN EL EXCEL OFICIAL <span style="font-weight:600;opacity:.85">(la app no las calcula — ni aquí ni en Auditoría de Horas/PDF)</span></div>'
    +'<table style="width:100%;border-collapse:collapse">'
    +filaExcelSolo('Rebase','Rebase')
    +filaExcelSolo('Traslados','Trasl')
    +filaExcelSolo('Plus Traslado','PlusTrasl')
    +filaExcelSolo('Tiempo Transporte','TpTrans',true)
    +filaExcelSolo('Plus Interrupción','PlusInter',true)
    +'</table>'
    +'<div style="height:1px;background:var(--div);margin:10px 0"></div>'
    +'<label style="font-size:10px;font-weight:800;letter-spacing:.3px;color:var(--tx3);display:block;margin-bottom:4px">FILTRAR POR CATEGORÍA</label>'
    +'<select id="selComputoExcelFiltro" onchange="cambiarFiltroComputoExcel(this.value)" style="width:100%;padding:8px;border-radius:8px;background:var(--s2);color:var(--tx);border:1px solid var(--div);font-size:12px;margin-bottom:8px">'
    +COMPUTO_EXCEL_CATEGORIAS.map(function(c){ return '<option value="'+c.id+'">'+c.lbl+'</option>'; }).join('')
    +'</select>'
    +'<div id="computo-excel-dias-cont"></div>'
    +'<div style="display:flex;gap:6px;margin-top:10px">'
      +'<button class="upload-btn" style="flex:1;justify-content:center;font-size:11px;padding:8px" onclick="descargarComputoExcelFiltrado()">⬇️ Descargar esta vista</button>'
      +'<button class="upload-btn" style="flex:1;justify-content:center;font-size:11px;padding:8px" onclick="descargarComputoExcelPorCategorias()">⬇️ Descargar todo por categorías</button>'
    +'</div>'
    +'</div>';

  // El <select> se reconstruye en cada render (panel.innerHTML entero),
  // así que hay que reponer el valor elegido y rellenar el contenedor
  // de días DESPUÉS de que exista en el DOM.
  var selFiltro = document.getElementById('selComputoExcelFiltro');
  if(selFiltro) selFiltro.value = _computoExcelFiltro;
  _renderSeccionDiferenciasComputoExcel();
}

// NUEVO — construye, para una categoría dada, la lista de días a
// mostrar/exportar. comparable → días con diferencia real Excel-vs-App
// (reutiliza discrepancias, ya calculado). No comparable → todos los
// días en los que el Excel tiene algo en esa columna (no hay "app" con
// quien comparar, así que no es una diferencia, es solo informativo).
function _construirFilasCategoria(catId){
  var d = _computoExcelDatosActual;
  if(!d || catId==='todas') return null;
  var cat = COMPUTO_EXCEL_CATEGORIAS.find(function(c){return c.id===catId;});
  if(!cat) return null;

  if(cat.comparable){
    var labelDiff = {HE:'H.E.', HP:'H.P.', Noct:'Noct.', HTDL:'HTDL', JT:'Plus JT'}[catId];
    var filas = [];
    d.discrepancias.forEach(function(disc){
      var x = disc.diffs.filter(function(x){return x.c===labelDiff;})[0];
      if(x) filas.push({fecha:disc.fecha, excel:x.ex, app:x.app, esConteo:!!x.esConteo, trenExcel:disc.trenExcel||'', trenApp:disc.trenApp||''});
    });
    return {esComparable:true, cat:cat, filas:filas};
  }

  var filas = [];
  Object.keys(d.porDia).sort().forEach(function(k){
    var val = d.porDia[k][catId]||0;
    if(val>0){
      var kk=k.split('-');
      filas.push({fecha:pad(parseInt(kk[2]))+'/'+pad(d.m), valor:val, trenExcel:d.porDia[k].TrenExcel||'', trenApp:_trenesAppDelDia(k)});
    }
  });
  return {esComparable:false, cat:cat, filas:filas};
}

function cambiarFiltroComputoExcel(v){
  _computoExcelFiltro = v;
  _renderSeccionDiferenciasComputoExcel();
}

function _renderSeccionDiferenciasComputoExcel(){
  var cont = document.getElementById('computo-excel-dias-cont');
  if(!cont || !_computoExcelDatosActual) return;
  var d = _computoExcelDatosActual;
  var html = '';

  if(_computoExcelFiltro==='todas'){
    html = d.discrepancias.length
      ? ('<div style="font-size:10px;font-weight:800;letter-spacing:.3px;color:var(--red2);margin-bottom:6px">DÍAS CON DIFERENCIAS ('+d.discrepancias.length+')</div>'
        +d.discrepancias.map(function(disc){
          var trenTxt = (disc.trenExcel||disc.trenApp) ? ('<div style="opacity:.75;margin-top:2px">🚆 Excel: '+(disc.trenExcel||'—')+' · App: '+(disc.trenApp||'—')+'</div>') : '';
          return '<div style="font-size:11px;color:var(--tx2);margin-bottom:4px;padding:6px 8px;background:var(--s2);border-radius:8px">'
            +'<strong>'+disc.fecha+'</strong> — '
            +disc.diffs.map(function(x){
              if(x.esConteo) return x.c+': Excel '+x.ex+' vs App '+x.app;
              return x.c+': Excel '+_minAHHMM(x.ex)+' vs App '+_minAHHMM(x.app);
            }).join(' · ')
            +trenTxt
            +'</div>';
        }).join(''))
      : '<div style="font-size:12px;color:var(--green2);font-weight:700;text-align:center;padding:8px">✅ Sin diferencias por encima de 1 minuto en ningún día</div>';
  } else {
    var r = _construirFilasCategoria(_computoExcelFiltro);
    if(!r){ cont.innerHTML=''; return; }
    if(r.esComparable){
      html = r.filas.length
        ? ('<div style="font-size:10px;font-weight:800;letter-spacing:.3px;color:var(--red2);margin-bottom:6px">DÍAS CON DIFERENCIA EN '+r.cat.lbl.toUpperCase()+' ('+r.filas.length+')</div>'
          +r.filas.map(function(f){
            var txt = f.esConteo ? ('Excel '+f.excel+' vs App '+f.app) : ('Excel '+_minAHHMM(f.excel)+' vs App '+_minAHHMM(f.app));
            var trenTxt = (f.trenExcel||f.trenApp) ? ('<div style="opacity:.75;margin-top:2px">🚆 Excel: '+(f.trenExcel||'—')+' · App: '+(f.trenApp||'—')+'</div>') : '';
            return '<div style="font-size:11px;color:var(--tx2);margin-bottom:4px;padding:6px 8px;background:var(--s2);border-radius:8px"><strong>'+f.fecha+'</strong> — '+txt+trenTxt+'</div>';
          }).join(''))
        : '<div style="font-size:12px;color:var(--green2);font-weight:700;text-align:center;padding:8px">✅ Sin diferencias en '+r.cat.lbl+' este mes</div>';
    } else {
      html = r.filas.length
        ? ('<div style="font-size:10px;font-weight:800;letter-spacing:.3px;color:var(--acc2);margin-bottom:6px">DÍAS CON '+r.cat.lbl.toUpperCase()+' ('+r.filas.length+')</div>'
          +r.filas.map(function(f){
            var txt = r.cat.esNumero ? f.valor : _minAHHMM(f.valor);
            var trenTxt = (f.trenExcel||f.trenApp) ? ('<div style="opacity:.75;margin-top:2px">🚆 Excel: '+(f.trenExcel||'—')+' · App: '+(f.trenApp||'—')+'</div>') : '';
            return '<div style="font-size:11px;color:var(--tx2);margin-bottom:4px;padding:6px 8px;background:var(--s2);border-radius:8px"><strong>'+f.fecha+'</strong> — '+txt+trenTxt+'</div>';
          }).join(''))
        : '<div style="font-size:12px;color:var(--tx3);text-align:center;padding:8px">Sin días con esta categoría en el Excel este mes</div>';
    }
  }
  cont.innerHTML = html;
}

function _filasComparativaCompleta(){
  if(!_computoExcelDatosActual) return [];
  return _computoExcelDatosActual.comparativaCompleta.map(function(f){
    return {
      Fecha: f.fecha,
      'H.E. Excel': _minAHHMM(f.HEExcel), 'H.E. App': _minAHHMM(f.HEApp),
      'H.P. Excel': _minAHHMM(f.HPExcel), 'H.P. App': _minAHHMM(f.HPApp),
      'Noct. Excel': _minAHHMM(f.NoctExcel), 'Noct. App': _minAHHMM(f.NoctApp),
      'HTDL Excel': _minAHHMM(f.HTDLExcel), 'HTDL App': _minAHHMM(f.HTDLApp),
      'Plus JT Excel': f.JTExcel, 'Plus JT App': f.JTApp,
      'Rebase (Excel)': _minAHHMM(f.Rebase),
      'Traslados (Excel)': _minAHHMM(f.Traslados),
      'Plus Traslado (Excel)': _minAHHMM(f.PlusTraslado),
      'Tiempo Transporte (Excel)': f.TiempoTransporte,
      'Plus Interrupción (Excel)': f.PlusInterrupcion,
      'Tren Excel': f.trenExcel, 'Tren App': f.trenApp
    };
  });
}

// Filas listas para exportar (mismo formato para pantalla y Excel —
// una sola fuente de verdad, regla de oro).
function _filasParaExportComputoExcel(catId){
  if(!_computoExcelDatosActual) return [];
  if(catId==='todas'){
    var filas=[];
    _computoExcelDatosActual.discrepancias.forEach(function(disc){
      disc.diffs.forEach(function(x){
        filas.push({
          Fecha: disc.fecha,
          Categoria: x.c,
          Excel: x.esConteo ? x.ex : _minAHHMM(x.ex),
          App: x.esConteo ? x.app : _minAHHMM(x.app),
          'Tren Excel': disc.trenExcel||'',
          'Tren App': disc.trenApp||''
        });
      });
    });
    return filas;
  }
  var cat = COMPUTO_EXCEL_CATEGORIAS.filter(function(c){return c.id===catId;})[0];
  var r = _construirFilasCategoria(catId);
  if(!r) return [];
  if(r.esComparable){
    return r.filas.map(function(f){
      return {
        Fecha: f.fecha,
        Categoria: cat.lbl,
        Excel: f.esConteo ? f.excel : _minAHHMM(f.excel),
        App: f.esConteo ? f.app : _minAHHMM(f.app),
        'Tren Excel': f.trenExcel||'',
        'Tren App': f.trenApp||''
      };
    });
  }
  return r.filas.map(function(f){
    return {
      Fecha: f.fecha,
      Categoria: cat.lbl,
      Valor: cat.esNumero ? f.valor : _minAHHMM(f.valor),
      'Tren Excel': f.trenExcel||'',
      'Tren App': f.trenApp||''
    };
  });
}

// NUEVO — calcula un ancho de columna razonable según el contenido
// más largo de cada una (cabecera incluida), para que Excel no las
// abra con columnas estrechas que recortan visualmente el texto (el
// dato en sí siempre estaba completo, pero así ya se ve sin tener que
// ensanchar nada a mano).
function _anchoColumnasAuto(filas){
  if(!filas.length) return [];
  var claves = Object.keys(filas[0]);
  return claves.map(function(clave){
    var maxLen = String(clave).length;
    filas.forEach(function(fila){
      var val = fila[clave]==null ? '' : String(fila[clave]);
      if(val.length > maxLen) maxLen = val.length;
    });
    return {wch: Math.min(maxLen + 2, 60)}; // +2 de margen, tope de 60 para no desbordar
  });
}

function descargarComputoExcelFiltrado(){
  if(!_computoExcelDatosActual){ alert('No hay ninguna comparativa cargada este mes.'); return; }
  if(typeof XLSX==='undefined'){ alert('No se pudo cargar el lector/escritor de Excel. Comprueba tu conexión.'); return; }
  var filas = _filasParaExportComputoExcel(_computoExcelFiltro);
  if(!filas.length){ alert('No hay días que descargar con este filtro.'); return; }
  var cat = COMPUTO_EXCEL_CATEGORIAS.filter(function(c){return c.id===_computoExcelFiltro;})[0];
  var nombreHoja = (cat ? cat.lbl : 'Diferencias').replace(/[\\\/\?\*\[\]:]/g,'').substring(0,31);
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.json_to_sheet(filas);
  ws['!cols'] = _anchoColumnasAuto(filas);
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  var nombreArchivo = 'Diferencias_'+_computoExcelDatosActual.mesLbl.replace(' ','_')+'_'+(cat?cat.id:'Todas')+'.xlsx';
  XLSX.writeFile(wb, nombreArchivo);
}

function descargarComputoExcelPorCategorias(){
  if(!_computoExcelDatosActual){ alert('No hay ninguna comparativa cargada este mes.'); return; }
  if(typeof XLSX==='undefined'){ alert('No se pudo cargar el lector/escritor de Excel. Comprueba tu conexión.'); return; }
  var wb = XLSX.utils.book_new();
  var huboAlguna = false;

  // NUEVO — hoja 1: Comparativa completa (TODOS los días del mes,
  // tengan o no diferencia), Excel vs App lado a lado.
  var filasCompleta = _filasComparativaCompleta();
  if(filasCompleta.length){
    huboAlguna = true;
    var wsCompleta = XLSX.utils.json_to_sheet(filasCompleta);
    wsCompleta['!cols'] = _anchoColumnasAuto(filasCompleta);
    XLSX.utils.book_append_sheet(wb, wsCompleta, 'Comparativa completa');
  }

  // NUEVO — hoja 2: resumen de Días con diferencia (todas las
  // categorías juntas), igual que ya se veía en pantalla con el
  // filtro "Todas las diferencias".
  var filasDiff = _filasParaExportComputoExcel('todas');
  if(filasDiff.length){
    huboAlguna = true;
    var wsDiff = XLSX.utils.json_to_sheet(filasDiff);
    wsDiff['!cols'] = _anchoColumnasAuto(filasDiff);
    XLSX.utils.book_append_sheet(wb, wsDiff, 'Dias con diferencia');
  }

  // Hojas 3+: una por categoría (ya existía, sin cambios).
  COMPUTO_EXCEL_CATEGORIAS.forEach(function(cat){
    if(cat.id==='todas') return;
    var filas = _filasParaExportComputoExcel(cat.id);
    if(!filas.length) return;
    huboAlguna = true;
    var ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = _anchoColumnasAuto(filas);
    var nombreHoja = cat.lbl.replace(/[\\\/\?\*\[\]:]/g,'').substring(0,31);
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  });
  if(!huboAlguna){ alert('No hay ningún día con diferencias ni datos que descargar este mes.'); return; }
  XLSX.writeFile(wb, 'ComputoExcel_'+_computoExcelDatosActual.mesLbl.replace(' ','_')+'_PorCategorias.xlsx');
}

/* ═══════════════════════════════════════════════════════════
   HTDL — RESUMEN DE COMPENSACIÓN EN DÍAS (Estadísticas)
   Módulo aditivo. La app ya obliga a que un HTDL con comp==='dias'
   elija sus fechas dentro del MES SIGUIENTE (ver el filtro dy===yC
   && dm===mC en el guardado del formulario) y las guarda como
   TV[iso]={tipo:'comp', origen:k} — pero hasta ahora eso solo se
   veía entrando al detalle de cada turno, uno a uno. Este bloque
   lo resume en Estadísticas, igual que ya hace _renderArt5152Stats:
   1) Los HTDL de ESTE mes que pediste como días → a qué fechas del
      mes siguiente van.
   2) Los días libres que caen EN este mes por un HTDL del mes
      anterior → de qué HTDL vienen.
   Solo lectura: no crea ni modifica ningún TV[k].
═══════════════════════════════════════════════════════════ */
function _renderHtdlDiasStats(){
  var box = document.getElementById('htdl-dias-stats-box');
  if(!box) return;

  var y=statsM.getFullYear(), m=statsM.getMonth()+1;
  var pref = y+'-'+pad(m);

  // Días libres que llegan ESTE mes (compensación de un HTDL anterior)
  // FIX — antes se buscaba solo TV[iso].tipo==='comp': en cuanto ese
  // día se trabajaba (HTDL o Art.51/52 — ver compConvertir), dejaba
  // de aparecer aquí, aunque a propósito siguiera guardado en
  // ori.diasComp para conservar el historial. Ahora se recorren
  // directamente los arrays diasComp de todos los turnos y se listan
  // las fechas que caen en el mes actual — así el registro se
  // mantiene visible aunque el día ya se haya trabajado, marcándolo
  // como tal.
  var recibidos = [];
  Object.keys(TV).forEach(function(kOrigen){
    var tOrigen = TV[kOrigen];
    if(tOrigen && tOrigen.comp==='dias' && tOrigen.diasComp && tOrigen.diasComp.length){
      tOrigen.diasComp.forEach(function(iso){
        if(iso.indexOf(pref)===0) recibidos.push({iso:iso, origen:kOrigen});
      });
    }
  });
  recibidos.sort(function(a,b){ return a.iso.localeCompare(b.iso); });

  // HTDL trabajados ESTE mes cuya compensación es 'días'
  var solicitados = [];
  Object.keys(TV).filter(function(k){return k.startsWith(pref);}).forEach(function(k){
    var t=TV[k];
    if(t && t.comp==='dias' && t.diasComp && t.diasComp.length) solicitados.push({k:k, t:t});
  });

  // NUEVO — días marcados como 'comp' (día de descanso ya disfrutado
  // por una compensación) este mes. Antes vivía como línea suelta
  // dentro de "Pluses" con la etiqueta ambigua "Días compensación";
  // se fusiona aquí porque es el mismo concepto (días, no dinero).
  var diasCompDisfrutados = 0;
  Object.keys(TV).filter(function(k){return k.startsWith(pref);}).forEach(function(k){
    if(TV[k] && TV[k].tipo==='comp') diasCompDisfrutados++;
  });

  if(!recibidos.length && !solicitados.length && !diasCompDisfrutados){ box.innerHTML=''; return; }

  var _totalDias = recibidos.length+solicitados.length+diasCompDisfrutados;
  var _cabHD = _totalDias+' día'+(_totalDias!==1?'s':'');
  var html = '<div class="acc-section" style="margin:0 0 10px;background:var(--s1);border:1px solid var(--div);border-radius:14px;overflow:hidden">'
    +'<div class="acc-head" style="cursor:pointer" onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
    +'<div class="acc-ico" style="background:transparent;font-size:18px">📅</div>'
    +'<div class="acc-title">Días de descanso (compensación)</div>'
    +'<div style="font-size:12px;font-weight:700;color:var(--cyan2);margin-right:6px">'+_cabHD+'</div>'
    +'<div class="acc-chev">›</div></div>'
    +'<div class="acc-body"><div class="acc-body-inner" style="padding:8px 15px 12px">';

  if(diasCompDisfrutados>0){
    html += '<div class="cs-r"><span class="cl">📅 Días de descanso disfrutados este mes</span>'
      +'<span class="cv" style="color:var(--cyan2)">'+diasCompDisfrutados+' día'+(diasCompDisfrutados!==1?'s':'')+'</span></div>';
  }
  if(solicitados.length){
    html += '<div style="font-size:10px;font-weight:800;letter-spacing:.3px;color:var(--tx3);margin-bottom:4px">SOLICITADOS ESTE MES → CAEN EL MES SIGUIENTE</div>';
    solicitados.forEach(function(r){
      html += '<div class="cs-r" style="padding-left:12px">'
        +'<span class="cl" style="font-size:10px">HTDL '+_keyAFechaLbl(r.k)+'</span>'
        +'<span class="cv" style="font-size:10px;color:var(--cyan2);font-weight:700">'+r.t.diasComp.map(_keyAFechaLbl).join(' y ')+'</span></div>';
    });
  }

  if(recibidos.length){
    if(solicitados.length) html += '<div class="cr-div" style="margin:6px 0"></div>';
    html += '<div style="font-size:10px;font-weight:800;letter-spacing:.3px;color:var(--tx3);margin-bottom:4px">DÍAS LIBRES ESTE MES (compensación de HTDL)</div>';
    recibidos.forEach(function(r){
      var yaTrabajado = TV[r.iso] && TV[r.iso].tipo!=='comp'; // sigue en la lista, pero ya no está "pendiente"
      html += '<div class="cs-r" style="padding-left:12px">'
        +'<span class="cl" style="font-size:10px">'+_keyAFechaLbl(r.iso)+(yaTrabajado?' <span style="color:var(--tx3);font-weight:400">(trabajado)</span>':'')+'</span>'
        +'<span class="cv" style="font-size:10px;color:var(--cyan2);font-weight:700">'+(r.origen?'← HTDL '+_keyAFechaLbl(r.origen):'Día libre HTDL')+'</span></div>';
    });
  }

  html += '</div></div></div>';
  box.innerHTML = html;
}
