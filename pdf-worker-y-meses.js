/* TrenTurnos v5 — Worker de PDF.js y almacén de meses del Horario individual
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
async function asegurarPdfWorkerSeguro(){
  if(_pdfWorkerBlobUrl) return _pdfWorkerBlobUrl;
  var urlWorkerOriginal = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  try{
    var resp = await fetch(urlWorkerOriginal);
    var codigo = await resp.text();
    var blob = new Blob([codigo], {type:'application/javascript'});
    _pdfWorkerBlobUrl = URL.createObjectURL(blob);
  }catch(errWorker){
    console.log('No se pudo crear el worker de PDF.js como Blob (sin conexión o CDN bloqueado); se usa el enlace directo como último recurso:', errWorker);
    _pdfWorkerBlobUrl = urlWorkerOriginal;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = _pdfWorkerBlobUrl;
  return _pdfWorkerBlobUrl;
}
function hasLocalStorage(){
  try{
    const k = '__test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  }catch(e){ return false; }
}

async function getMonthIndex(){
  try{
    const raw = localStore.get('horarios:index');
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

/* ── buscarPdfDelMes(fechaRef) — indexación del PDF oficial por fecha ──
   Recorre TODOS los meses de horario guardados (horarios:index) y
   devuelve el único cuyo mes/año coincide con fechaRef (por defecto,
   statsM: el mes visible en Calendario/Estadísticas). Es la ÚNICA vía
   por la que la Auditoría de Horas debe leer el PDF oficial — nunca
   por currentMonthKey, que es el selector propio e independiente de
   la pestaña Horario individual y puede no coincidir con el mes que
   estás viendo en el calendario. Si ningún mes guardado coincide,
   devuelve null (la Auditoría debe mostrar 00:00 / No registrado). */
async function buscarPdfDelMes(fechaRef){
  fechaRef = fechaRef || statsM;
  var nombreMesRef = fechaRef.toLocaleString('es-ES',{month:'long'}).toUpperCase();
  var anioRef = String(fechaRef.getFullYear());
  var indice = await getMonthIndex();
  for(var i=0; i<indice.length; i++){
    var data = await loadMonth(indice[i]);
    if(!data || !data.meta || !data.meta.mes) continue;
    var mesTxt = data.meta.mes.toUpperCase();
    if(mesTxt.indexOf(nombreMesRef)!==-1 && mesTxt.indexOf(anioRef)!==-1){
      return data; // coincidencia exacta de mes y año — nunca se arrastra de otro mes
    }
  }
  return null;
}

async function saveMonthIndex(list){
  localStore.set('horarios:index', JSON.stringify(list));
}

async function saveMonth(mesKey, diasData, meta){
  localStore.set('horario:' + mesKey, JSON.stringify({dias: diasData, meta}));
  const idx = await getMonthIndex();
  if(!idx.includes(mesKey)){
    idx.push(mesKey);
    await saveMonthIndex(idx);
  }
  await refreshMonthSelect(mesKey);
  if(typeof renderMonthListIndividual === 'function') await renderMonthListIndividual();
}

async function loadMonth(mesKey){
  try{
    const raw = localStore.get('horario:' + mesKey);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
