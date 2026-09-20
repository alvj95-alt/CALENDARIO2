/* TrenTurnos v5 — Lectura/escritura segura de localStorage y guardados de estado
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* FIX — lectura segura de localStorage. Antes, si el JSON guardado estaba corrupto, JSON.parse
   lanzaba una excepción a nivel global y toda la app quedaba sin cargar (sin ningún aviso).
   Ahora se devuelve el valor por defecto y, por si se quiere recuperar algo, el texto ilegible
   se copia a "<clave>__corrupto". También se descarta un JSON válido pero de otro tipo. */
function _leerJSONseguro(clave, defecto){
  var crudo = null;
  try{
    crudo = localStorage.getItem(clave);
    if(crudo===null || crudo==='') return defecto;
    var v = JSON.parse(crudo);
    var ok = Array.isArray(defecto) ? Array.isArray(v) : (v!==null && typeof v==='object' && !Array.isArray(v));
    return ok ? v : defecto;
  }catch(e){
    console.warn('localStorage["'+clave+'"] ilegible; se usa el valor por defecto.', e);
    try{ if(crudo!==null) localStorage.setItem(clave+'__corrupto', crudo); }catch(_){}
    return defecto;
  }
}
function _guardarComputoExcelPorMes(){
  try{ localStorage.setItem(COMPUTO_EXCEL_KEY, JSON.stringify(_computoExcelPorMes)); }
  catch(e){ console.log('No se pudo guardar Cómputo Excel en localStorage:', e); }
} // 'mio' | 'comp' | 'ambos'

function saveComp(){ localStorage.setItem('comp5', JSON.stringify(COMP_DATA)); }
function _saveArt5152Dias(){ localStorage.setItem('art5152_dias', JSON.stringify(ART5152_DIAS)); }
function _saveArt5152Uso(){ localStorage.setItem('art5152_uso', JSON.stringify(ART5152_USO)); }
function _saveArt5152UsoAnual(){ localStorage.setItem('art5152_uso_anual', JSON.stringify(ART5152_USO_ANUAL)); }
