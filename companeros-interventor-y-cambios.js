/* TrenTurnos v5 — Horario General, Buscador de Compañeros, Interventor, Cambios de turno, Notificaciones push y Tablón
   Separado del HTML único original SIN cambiar la lógica.
   Un único IIFE con estado compartido (BASES, activeBase...): por eso no se divide. Exporta a window lo que usan los onclick del HTML.
   El orden de carga está en index.html (importa: no lo alteres). */
(function(){
// FIX — Confirmado por Alex (bug real detectado en producción): esta
// línea usaba pdfjsLib sin protección, nada más entrar a este bloque.
// Si la librería pdf.js (cargada desde un CDN externo) no había
// terminado de llegar todavía — red lenta o inestable, típico yendo
// en el tren — esta única línea reventaba con "pdfjsLib is not
// defined" y tiraba abajo TODO este bloque entero, incluyendo BASES,
// activateBase(), mostrarSelectorCompaneros() y mostrarDetalleCompaneros()
// (las funciones que usan los botones "Por nombre"/"Por número de
// tren" en Compañeros). El resultado era justo lo que se veía: los
// botones se quedaban ahí, se podían pulsar, pero no pasaba nada — sin
// ningún error visible, porque la excepción ya había pasado en
// silencio mucho antes, al cargar la página. Con el try/catch, si
// pdfjsLib todavía no está listo aquí, se avisa por consola y se
// sigue sin romper nada más — asegurarPdfWorkerSeguro() ya deja fijado
// el worker de forma segura más adelante, justo antes de leer un PDF
// de verdad (que es cuando realmente hace falta).
try{
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}catch(errPdfWorkerInit){
  console.log('pdfjsLib no estaba listo todavía al entrar en este bloque (CDN lento/bloqueado) — se continúa sin bloquear Compañeros/Admin.', errPdfWorkerInit);
}


// ── REGISTRO DE BASES (independientes entre sí) ──
const BASES = {
  barcelona: { label: 'Barcelona', month: '—', data: null },
  madrid:    { label: 'Madrid',    month: '—', data: null },
  // NUEVO — Horario General publicado por el Panel de Administrador
  // (Supabase). Sustituye a la subida manual de Barcelona/Madrid
  // para el usuario normal — sigue existiendo por si algún día se
  // quiere volver al modo manual, pero ya no se muestra en pantalla.
  global: { label: 'Horario General', month: '—', data: null }
};
let activeBaseKey = null;
let activeBase = null;

// ── Persistencia local (localStorage) — 100% en el dispositivo, nunca sale de aquí ──
const AT_STORAGE_KEY = 'appTurnoBasesGuardadas';
function atGuardarBases(){
  try{
    const payload = {
      barcelona: { month: BASES.barcelona.month, data: BASES.barcelona.data },
      madrid:    { month: BASES.madrid.month,    data: BASES.madrid.data }
    };
    localStorage.setItem(AT_STORAGE_KEY, JSON.stringify(payload));
  }catch(e){
    console.warn('No se pudieron guardar los datos de turnos localmente.', e);
  }
}
function atCargarBases(){
  try{
    const raw = localStorage.getItem(AT_STORAGE_KEY);
    if(!raw) return;
    const saved = JSON.parse(raw);
    if(saved && saved.barcelona && Array.isArray(saved.barcelona.data)){
      BASES.barcelona.data = saved.barcelona.data;
      BASES.barcelona.month = saved.barcelona.month || '—';
    }
    if(saved && saved.madrid && Array.isArray(saved.madrid.data)){
      BASES.madrid.data = saved.madrid.data;
      BASES.madrid.month = saved.madrid.month || '—';
    }
  }catch(e){
    console.warn('No se pudieron leer los datos guardados; se ignoran.', e);
  }
}
atCargarBases();

/* ═══════════════════════════════════════════════════════════
   NUEVO — Horario General (publicado por el Panel de Admin).
   Formato esperado del CSV/XLSX:
     id,nombre,1,2,3,...,31
     1234,Juan Perez,632,DO,9732 632,...
   Produce exactamente el mismo formato [id, nombre, {dia:texto}]
   que ya usa parsePageWords() para el PDF — así todo el buscador,
   perfil y comparador de compañeros funciona igual, sin tocarlos.
═══════════════════════════════════════════════════════════ */
function parseHorarioGeneralCSV(texto){
  var lineas = texto.split(/\r?\n/).filter(function(l){ return l.trim(); });
  if(lineas.length<2) return [];
  var cabecera = lineas[0].split(',').map(function(h){ return h.trim(); });
  var idxId = cabecera.findIndex(function(h){ return h.toLowerCase()==='id'; });
  var idxNombre = cabecera.findIndex(function(h){ return h.toLowerCase()==='nombre'; });
  var idxDias = [];
  cabecera.forEach(function(h,i){ if(/^\d+$/.test(h)) idxDias.push({col:i, dia:h}); });
  var out = [];
  for(var li=1; li<lineas.length; li++){
    var cols = lineas[li].split(',');
    var id = idxId>=0 ? (cols[idxId]||'').trim() : '';
    var nombre = idxNombre>=0 ? (cols[idxNombre]||'').trim() : '';
    if(!nombre) continue;
    var days = {};
    idxDias.forEach(function(d){
      var val = (cols[d.col]||'').trim();
      if(val) days[d.dia] = val;
    });
    out.push([id, nombre, days]);
  }
  return out;
}

function parseHorarioGeneralXLSX(buf){
  if(typeof XLSX === 'undefined') return [];
  var wb = XLSX.read(buf, {type:'array'});
  var hoja = wb.Sheets[wb.SheetNames[0]];
  var filas = XLSX.utils.sheet_to_json(hoja, {header:1});
  if(filas.length<2) return [];
  var cabecera = filas[0].map(function(h){ return String(h||'').trim(); });
  var idxId = cabecera.findIndex(function(h){ return h.toLowerCase()==='id'; });
  var idxNombre = cabecera.findIndex(function(h){ return h.toLowerCase()==='nombre'; });
  var idxDias = [];
  cabecera.forEach(function(h,i){ if(/^\d+$/.test(h)) idxDias.push({col:i, dia:h}); });
  var out = [];
  for(var fi=1; fi<filas.length; fi++){
    var cols = filas[fi];
    var id = idxId>=0 ? String(cols[idxId]||'').trim() : '';
    var nombre = idxNombre>=0 ? String(cols[idxNombre]||'').trim() : '';
    if(!nombre) continue;
    var days = {};
    idxDias.forEach(function(d){
      var val = String(cols[d.col]||'').trim();
      if(val) days[d.dia] = val;
    });
    out.push([id, nombre, days]);
  }
  return out;
}
// FIX — expuestas a window: subirArchivoGlobalAdmin() vive FUERA de este
// IIFE (más arriba en el archivo) y necesita llamarlas para la
// validación de contenido antes de publicar. Sin esto, daba
// "parseHorarioGeneralCSV/XLSX is not defined".
window.parseHorarioGeneralCSV = parseHorarioGeneralCSV;
window.parseHorarioGeneralXLSX = parseHorarioGeneralXLSX;

// Carga el horario publicado por el admin (Supabase) y, si existe,
// lo activa automáticamente — el usuario ya no elige base a mano.
// Reutiliza sbAdmin (ya conectado, declarado antes en este script).
//
// NUEVO — dos rutas distintas según quién pregunta:
//  · Usuario normal: SOLO se pide/descarga la fila de SU sede, que se
//    obtiene automáticamente de su Estación Base ya configurada
//    (_sedeUsuarioActual(), sin campo nuevo que rellenar). Protección
//    de datos real, no solo un filtro visual — el archivo de otra
//    sede nunca llega a tocar su dispositivo.
//  · Administrador (perfilAdminActual.rol==='admin'): puede ver a
//    TODOS los compañeros de TODAS las sedes en el Buscador, aunque
//    su propia Estación Base sea una sola. Se piden todas las filas
//    'horario_general_%' y se fusionan en un único listado, cada
//    empleado etiquetado con su sede real (para poder distinguirlos
//    si hiciera falta más adelante).
var _diagHorarioGeneral = null; // último motivo de fallo, para poder verlo en pantalla
async function cargarHorarioGlobalDesdeAdmin(mesElegido){
  _diagHorarioGeneral = null;
  try{
    if(!sbAdmin){ _diagHorarioGeneral = 'sbAdmin no está disponible'; return false; }
    var esAdmin = !!(perfilAdminActual && perfilAdminActual.rol==='admin')
      // NUEVO — el interventor ve todas las sedes fusionadas, igual
      // que el admin: no tiene una Estación Base propia de la que
      // partir, así que restringirlo a una sola no tendría sentido.
      || !!(usuarioActual && usuarioActual.esInterventor);

    if(esAdmin){
      var respTodas = await sbAdmin.from('config_global').select('*').like('tipo','horario_general_%');
      if(respTodas.error){ _diagHorarioGeneral = 'Error en consulta (admin, todas las sedes): '+respTodas.error.message; return false; }
      if(!respTodas.data || !respTodas.data.length){ _diagHorarioGeneral = 'Consulta (admin) sin filas: no hay ninguna fila con tipo LIKE horario_general_%'; return false; }

      // NUEVO — Confirmado por Alex: cada Horario General ahora se
      // guarda por sede Y por mes (tipo: horario_general_<sede>_<AAAA-MM>),
      // sin sobrescribir los anteriores. Aquí se sacan todos los
      // meses disponibles (para pintar los chips del selector) y se
      // filtra solo a las filas del mes objetivo — el elegido, o si
      // no se indica ninguno, el más reciente en conjunto.
      var filasConMes = respTodas.data.map(_hgParsearTipo).filter(function(x){ return x.anio && x.mes; });
      if(!filasConMes.length){ _diagHorarioGeneral = 'Hay filas horario_general_%, pero ninguna con el formato de mes esperado'; return false; }
      window._hgMesesDisponibles = _hgListarMesesUnicos(filasConMes);
      var objetivo = mesElegido || window._hgMesesDisponibles[0];
      var filasDelMes = filasConMes.filter(function(x){ return x.anio===objetivo.anio && x.mes===objetivo.mes; });
      if(!filasDelMes.length){ _diagHorarioGeneral = 'No hay ninguna sede con Horario General para '+objetivo.mes+'/'+objetivo.anio; return false; }

      var datosFusionados = [];
      var fechaMasReciente = null;
      // NUEVO — antes, si el PDF de una sede fallaba al leerse (0
      // empleados, por el motivo que fuera), esa sede simplemente se
      // saltaba EN SILENCIO — el resultado seguía llamándose "Todas
      // las sedes (admin)" aunque, en la práctica, esa sede no
      // hubiera entrado. Ahora se lleva la cuenta de cuántos
      // empleados se leyeron de CADA sede, y si alguna se queda en 0,
      // se avisa explícitamente en el propio label — para que un
      // fallo de lectura ya no se confunda con "esa sede de verdad no
      // tiene a nadie en ese tren ese día".
      var resumenPorSede = [];
      // NUEVO — caché por sede: si el admin ya tenía esta sede cargada
      // con la MISMA fecha_subida que ahora devuelve Supabase, no hace
      // falta volver a descargar ni volver a parsear ese PDF — se
      // reutilizan los empleados que ya se leyeron la vez anterior.
      // Solo se descarga/parsea de verdad la(s) sede(s) que de verdad
      // tengan un archivo NUEVO (fecha_subida distinta). Esto es lo
      // que hace que entrar en Compañeros repetidas veces sea rápido:
      // la única forma de que se vuelva a tardar es que de verdad haya
      // algo nuevo que leer.
      if(!window._cacheHorarioPorSede) window._cacheHorarioPorSede = {};
      for(var i=0; i<filasDelMes.length; i++){
        var filaSede = filasDelMes[i].fila;
        var sedeLbl = filasDelMes[i].sede;
        if(!filaSede.url_archivo){ resumenPorSede.push(sedeLbl+':sin archivo'); continue; }
        var cacheSede = window._cacheHorarioPorSede[filaSede.tipo];
        var datosSede;
        if(cacheSede && cacheSede.fecha_subida === filaSede.fecha_subida){
          datosSede = cacheSede.empleados;
        } else {
          datosSede = await _descargarYParsearHorario(filaSede);
          if(datosSede && datosSede.length){
            window._cacheHorarioPorSede[filaSede.tipo] = { fecha_subida: filaSede.fecha_subida, empleados: datosSede, mesAnio: datosSede.mesAnio };
          }
        }
        if(datosSede && datosSede.length){
          // Se etiqueta cada empleado con su sede real, añadiéndola
          // como 4º elemento de la tupla [id, nombre, dias, sede] —
          // no rompe nada existente, que solo usa los 3 primeros.
          datosSede.forEach(function(emp){ emp[3] = sedeLbl; });
          datosFusionados = datosFusionados.concat(datosSede);
          resumenPorSede.push(sedeLbl+':'+datosSede.length);
        } else {
          resumenPorSede.push(sedeLbl+':⚠️0 empleados');
        }
        var fechaFila = new Date(filaSede.fecha_subida);
        if(!fechaMasReciente || fechaFila>fechaMasReciente) fechaMasReciente = fechaFila;
      }
      if(!datosFusionados.length){ _diagHorarioGeneral = 'Filas encontradas para '+objetivo.mes+'/'+objetivo.anio+' ('+filasDelMes.length+'), pero 0 empleados tras parsear todas'; return false; }
      BASES.global.data = datosFusionados;
      BASES.global.month = fechaMasReciente ? fechaMasReciente.toLocaleDateString('es-ES') : '—';
      BASES.global.mesAnio = objetivo;
      var huboFallo = resumenPorSede.some(function(r){ return r.indexOf('⚠️')!==-1 || r.indexOf('sin archivo')!==-1; });
      BASES.global.label = 'Todas las sedes' + (huboFallo ? ' — ⚠️ revisar: '+resumenPorSede.join(', ') : '');
      console.log('Horario General (admin, todas las sedes) — empleados por sede:', resumenPorSede.join(' | '), '| mes elegido:', objetivo);
      return true;
    }

    // Usuario normal — protección de datos por sede: se pide SOLO la(s)
    // fila(s) de la sede que le corresponde según su Estación Base. Si
    // no tiene Estación Base configurada, o el admin no ha subido nada
    // para esa sede todavía, no se descarga NADA — nunca se llega a
    // tocar el archivo de otra sede, ni siquiera de forma temporal.
    var miSede = _sedeUsuarioActual();
    if(!miSede){
      _diagHorarioGeneral = 'No hay Estación Base configurada (AJ.base='+JSON.stringify(AJ.base)+'), no se puede derivar la sede.';
      return false;
    }
    // NUEVO — Confirmado por Alex: ahora puede haber varios meses
    // guardados para la misma sede (horario_general_<sede>_<AAAA-MM>),
    // así que se piden TODAS las filas de esa sede y se elige la del
    // mes objetivo (el pedido, o el más reciente si no se indica).
    //
    // FIX — Confirmado por Alex (bug real, detectado en producción):
    // antes se pedía con like('tipo','horario_general_'+sede+'_%'),
    // que EXIGE un guión bajo justo después de la sede — eso excluía,
    // ya a nivel de la propia consulta, las filas del formato ANTIGUO
    // (horario_general_barcelona, SIN ese guión bajo final), que ni
    // siquiera llegaban a JS para poder aceptarlas. Ahora se pide todo
    // lo de horario_general_% y se filtra aquí a la sede, aceptando
    // los dos formatos (nuevo con mes, y el antiguo exacto).
    var sedeSlugUsuario = _baseSlug(miSede);
    var respTodasUsuario = await sbAdmin.from('config_global').select('*').like('tipo','horario_general_%');
    if(respTodasUsuario.error){ _diagHorarioGeneral = 'esAdmin=false · miSede="'+miSede+'" · Error en consulta: '+respTodasUsuario.error.message; return false; }
    if(!respTodasUsuario.data || !respTodasUsuario.data.length){ _diagHorarioGeneral = 'esAdmin=false · miSede="'+miSede+'" · Sin filas horario_general_% en absoluto'; return false; }
    var respSede = { data: respTodasUsuario.data.filter(function(f){
      return f.tipo === 'horario_general_'+sedeSlugUsuario || f.tipo.indexOf('horario_general_'+sedeSlugUsuario+'_')===0;
    }) };
    if(!respSede.data.length){ _diagHorarioGeneral = 'esAdmin=false · miSede="'+miSede+'" · Sin filas para esta sede'; return false; }
    var filasConMesUsuario = respSede.data.map(_hgParsearTipo).filter(function(x){ return x.anio && x.mes; });
    if(!filasConMesUsuario.length){ _diagHorarioGeneral = 'esAdmin=false · miSede="'+miSede+'" · Ninguna fila con el formato de mes esperado'; return false; }
    window._hgMesesDisponibles = _hgListarMesesUnicos(filasConMesUsuario);
    var objetivoUsuario = mesElegido || window._hgMesesDisponibles[0];
    var itemElegido = filasConMesUsuario.find(function(x){ return x.anio===objetivoUsuario.anio && x.mes===objetivoUsuario.mes; });
    if(!itemElegido){ _diagHorarioGeneral = 'esAdmin=false · miSede="'+miSede+'" · No hay Horario General para '+objetivoUsuario.mes+'/'+objetivoUsuario.anio; return false; }
    var resp = { data: itemElegido.fila };
    if(!resp.data.url_archivo){ _diagHorarioGeneral = 'esAdmin=false · tipoSede="'+itemElegido.tipo+'" · Fila encontrada pero sin url_archivo'; return false; }
    // NUEVO — misma caché de arriba, aplicada aquí a la sede única del
    // usuario normal: si ya la teníamos cargada con esta misma
    // fecha_subida, no se vuelve a descargar/parsear el archivo.
    if(!window._cacheHorarioPorSede) window._cacheHorarioPorSede = {};
    var cacheUnica = window._cacheHorarioPorSede[itemElegido.tipo];
    var datos;
    if(cacheUnica && cacheUnica.fecha_subida === resp.data.fecha_subida){
      datos = cacheUnica.empleados;
    } else {
      datos = await _descargarYParsearHorario(resp.data);
      if(datos && datos.length){
        window._cacheHorarioPorSede[itemElegido.tipo] = { fecha_subida: resp.data.fecha_subida, empleados: datos, mesAnio: datos.mesAnio };
      }
    }
    if(!datos || !datos.length){ _diagHorarioGeneral = 'esAdmin=false · tipoSede="'+itemElegido.tipo+'" · Fila y URL encontradas, pero 0 empleados tras descargar/parsear el archivo'; return false; }
    // NUEVO — se etiqueta también aquí la sede de cada empleado
    // (4º elemento de la tupla), igual que ya hace la fusión admin —
    // así se puede mostrar "de qué base es" en los resultados aunque
    // el usuario no sea admin (aunque él solo vea su propia sede).
    var sedeUnica = resp.data.sede || miSede;
    datos.forEach(function(emp){ emp[3] = sedeUnica; });
    BASES.global.data = datos;
    BASES.global.month = new Date(resp.data.fecha_subida).toLocaleDateString('es-ES');
    BASES.global.mesAnio = objetivoUsuario;
    BASES.global.label = 'Horario General · '+(resp.data.sede||miSede);
    return true;
  }catch(e){
    _diagHorarioGeneral = 'Excepción: '+(e && e.message ? e.message : String(e));
    console.log('No se pudo cargar el horario general publicado:', e);
    return false;
  }
}

// NUEVO — helper compartido: dada una lista de filas ya parseadas
// (con .anio/.mes, ver _hgParsearTipo más arriba), devuelve los meses
// únicos disponibles, ordenados del más reciente al más antiguo. Se
// usa tanto aquí como al pintar los chips del selector en el Buscador.
function _hgListarMesesUnicos(filasConMes){
  var vistos = {};
  var out = [];
  filasConMes.forEach(function(x){
    var k = x.anio+'-'+x.mes;
    if(!vistos[k]){ vistos[k] = true; out.push({anio:x.anio, mes:x.mes}); }
  });
  out.sort(function(a,b){ return (b.anio*12+b.mes) - (a.anio*12+a.mes); });
  return out;
}

// NUEVO — Confirmado por Alex: selector de mes en el Buscador de
// Compañeros. Se pinta desde activateBase('global') (ver más abajo),
// usando los meses que _hgMesesDisponibles ya dejó guardados en la
// última llamada a cargarHorarioGlobalDesdeAdmin(). Si solo hay un
// mes guardado, no tiene sentido elegir — se deja vacío.
// APAGADO — Confirmado por Alex: el selector de mes con chips
// ("Ago/Sep") queda desactivado — ahora Compañeros e Interventor usan
// automáticamente el mes puesto en el Calendario (ver
// _mesCalendarioActual(), usada en abrirBuscadorConHorarioGlobal() y
// cargarDatosParaInterventor()), sin ningún botón que elegir. No se
// borra el código de los chips (mismo criterio que con Novedades): si
// algún día se quiere volver a este modelo, basta con quitar el
// "return" de aquí abajo.
var _hgCargandoMes = null; // {anio,mes} mientras esa carga está en curso, o null si no hay ninguna
function hgPintarSelectorMes(){
  var zona = document.getElementById('hgMesSelectorZona');
  if(zona) zona.innerHTML = '';
  return;
  var meses = window._hgMesesDisponibles || [];
  if(meses.length<2){ zona.innerHTML = ''; return; }
  var actual = (typeof BASES!=='undefined' && BASES.global && BASES.global.mesAnio) ? BASES.global.mesAnio : meses[0];
  zona.innerHTML = '<div class="hg-mes-sel-lbl">📅 Buscar en el mes</div>'
    + '<div class="hg-mes-sel-row">'
    + meses.map(function(m, i){
        var on = (m.anio===actual.anio && m.mes===actual.mes);
        var cargando = _hgCargandoMes && _hgCargandoMes.anio===m.anio && _hgCargandoMes.mes===m.mes;
        return '<div class="hg-mes-chip '+(on?'on':'')+(cargando?' cargando':'')+'" onclick="hgElegirMes('+m.anio+','+m.mes+')">'
          + '<div class="hg-mes-chip-mes">'+(cargando?'⏳ ':'')+MESES_CORTO_HG[m.mes-1]+(i===0 && !cargando?'<span class="hg-mes-chip-dot"></span>':'')+'</div>'
          + '<div class="hg-mes-chip-anio">'+m.anio+'</div>'
        + '</div>';
      }).join('')
    + '</div>'
    + '<div class="hg-mes-buscando">Buscando en <b>'+MESES[actual.mes-1]+' '+actual.anio+'</b></div>';
}
var MESES_CORTO_HG = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// NUEVO — al elegir un mes distinto en el selector: recarga el
// Horario General de ESE mes (reutilizando la caché si ya se había
// descargado antes) y refresca la pantalla activa sin perder el
// contexto (si había un detalle abierto, sigue abierto).
//
// FIX — Confirmado por Alex (bug real, detectado en producción): al
// ser una operación asíncrona (puede tardar varios segundos en red
// móvil), no había ningún aviso de que el toque ya se había
// registrado — daba la sensación de que "no funcionaba" y llevaba a
// tocar varias veces seguidas, disparando cargas en paralelo que se
// pisaban entre sí (la última en terminar ganaba, sin relación con
// cuál se tocó al final). Ahora: (1) se ignora un toque nuevo
// mientras ya hay uno en curso, (2) tocar el mes que YA está
// seleccionado no hace nada (no hay nada que recargar), y (3) se
// marca de inmediato el chip como "cargando" (⏳), antes de esperar
// a la red — para que quede claro que el toque sí se registró.
async function hgElegirMes(anio, mes){
  if(_hgCargandoMes) return;
  var yaSeleccionado = (typeof BASES!=='undefined' && BASES.global && BASES.global.mesAnio
    && BASES.global.mesAnio.anio===anio && BASES.global.mesAnio.mes===mes);
  if(yaSeleccionado) return;
  _hgCargandoMes = {anio:anio, mes:mes};
  hgPintarSelectorMes();
  if(typeof toast==='function') toast('📅 Cargando '+MESES[mes-1]+' '+anio+'...');
  var ok;
  try{
    ok = await cargarHorarioGlobalDesdeAdmin({anio:anio, mes:mes});
  } finally {
    _hgCargandoMes = null;
  }
  if(!ok){
    hgPintarSelectorMes();
    if(typeof toast==='function') toast('No se pudo cargar ese mes: '+(_diagHorarioGeneral||'motivo desconocido'));
    return;
  }
  hgPintarSelectorMes();
  document.getElementById('hdrTitulo').textContent = BASES.global.label;
  document.getElementById('hdrPill').textContent = '📍 ' + (BASES.global.month || 'BASE ACTIVA');
  if(typeof toast==='function') toast('📅 Buscando en '+MESES[mes-1]+' '+anio);
}
window.hgElegirMes = hgElegirMes;
window.cargarHorarioGlobalDesdeAdmin = cargarHorarioGlobalDesdeAdmin;
window.BASES = BASES;
window.hgDiag = function(){ return _diagHorarioGeneral; };
window.hgPintarSelectorMes = hgPintarSelectorMes;


// Descarga y parsea UNA fila de config_global (PDF/XLSX/CSV) — factor
// común extraído para poder reutilizarlo tanto en la ruta admin (varias
// filas) como en la de usuario normal (una sola), sin duplicar código.
async function _descargarYParsearHorario(fila){
  var archivoResp = await fetch(fila.url_archivo);
  if(!archivoResp.ok) return null;
  var nombreArchivo = fila.nombre_archivo || '';
  var esXlsx = /\.xlsx$/i.test(nombreArchivo);
  var esPdf = /\.pdf$/i.test(nombreArchivo);
  if(esPdf){
    var bufPdf = await archivoResp.arrayBuffer();
    return await parsearBufferPdfHorario(bufPdf);
  } else if(esXlsx){
    var buf = await archivoResp.arrayBuffer();
    return parseHorarioGeneralXLSX(buf);
  }
  var texto = await archivoResp.text();
  return parseHorarioGeneralCSV(texto);
}

// Se expone a window porque el botón que abre el buscador vive
// fuera de este módulo aislado (en el HTML principal de la app).
// NUEVO — Acceso seguro al Buscador de Compañeros: matrícula
// validada contra el Horario General + aceptación del descargo de
// responsabilidades. Solo si ambas cosas se cumplen se llama a
// abrirBuscadorConHorarioGlobal() (ya existente, sin tocarla).
window.abrirAccesoBuscadorCompaneros = function(){
  // NUEVO — la sede se deriva de tu Estación Base (Ajustes → Perfil →
  // Estación Base). Sin eso configurado no hay forma de saber qué
  // Horario General pedir (ni de proteger la privacidad de otras
  // sedes), así que se avisa aquí mismo, antes de nada. El admin queda
  // exento: él ve todas las sedes fusionadas, no necesita configurar
  // ninguna en concreto.
  var esAdminActivo = !!(perfilAdminActual && perfilAdminActual.rol==='admin');
  // NUEVO — el interventor tampoco necesita Estación Base: no está
  // ligado a ninguna sede de tripulación, así que queda exento igual
  // que el admin (ver validarAccesoInterventor()).
  var esInterventorActivo = !!(usuarioActual && usuarioActual.esInterventor);
  if(!esAdminActivo && !esInterventorActivo && !_sedeUsuarioActual()){
    // FIX — antes esto usaba alert(), que en algunos contextos (vistas
    // previas integradas, ciertos navegadores/webviews) puede quedar
    // bloqueado sin mostrarse — dando la sensación de que el botón
    // "no hace nada" cuando en realidad sí se estaba ejecutando, solo
    // que el aviso nunca llegaba a verse. Ahora se muestra el aviso
    // directamente en la propia pestaña (a la que goP() ya nos trajo
    // antes de llamar a esta función — NO hay que volver a llamar a
    // goP() aquí, o se entra en un bucle infinito entre las dos).
    var statusElSinBase = document.getElementById('estadoHorarioGlobalBuscador');
    if(statusElSinBase){
      statusElSinBase.innerHTML = '⚠️ Antes de usar el Buscador de Compañeros, configura tu Estación Base.'
        + '<br><button onclick="goP(\'ajustes\')" style="margin-top:8px;padding:8px 14px;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.4);border-radius:8px;color:#93c5fd;font-size:12px;font-weight:700;cursor:pointer">⚙️ Ir a Ajustes</button>';
    }
    return;
  }
  // NUEVO — admin e interventor ya demostraron quién son por otra vía
  // (email+contraseña, o su propia validación de matrícula) — no
  // hace falta pedirles otra vez matrícula ni descargo aquí.
  if(esAdminActivo || esInterventorActivo){
    abrirBuscadorConHorarioGlobal();
    return;
  }
  // NUEVO — si ya hay sesión iniciada con matrícula+PIN, esa matrícula
  // ya quedó demostrada al crear la cuenta / iniciar sesión — no hace
  // falta volver a escribirla aquí. Solo aplica a cuentas de matrícula
  // (usuarioActual.matricula), no al admin (que entra por otra vía).
  if(usuarioActual && usuarioActual.matricula){
    abrirBuscadorConHorarioGlobal();
    return;
  }
  // NUEVO — si esta matrícula ya aceptó el descargo antes en este
  // dispositivo, no se le vuelve a preguntar: se entra directo.
  var matriculaGuardada = localStorage.getItem('descargoAceptado_matricula');
  if(matriculaGuardada){
    abrirBuscadorConHorarioGlobal();
    return;
  }
  document.getElementById('accesoMatriculaInput').value = '';
  document.getElementById('accesoAceptoCheck').checked = false;
  document.getElementById('btnContinuarAccesoBuscador').disabled = true;
  document.getElementById('accesoBuscadorMsg').innerHTML = '';
  openOv('ov-acceso-buscador');
  // Se adelanta la carga del Horario General en segundo plano (sin
  // abrir el buscador todavía) para que, cuando el usuario pulse
  // "Continuar", la matrícula ya se pueda validar sin esperas.
  cargarHorarioGlobalDesdeAdmin();
};

window.validarAccesoBuscador = async function(){
  var matricula = document.getElementById('accesoMatriculaInput').value.trim();
  var acepto = document.getElementById('accesoAceptoCheck').checked;
  var msg = document.getElementById('accesoBuscadorMsg');
  var btn = document.getElementById('btnContinuarAccesoBuscador');

  if(!matricula){
    msg.innerHTML = '<div class="msg-error">Escribe tu número de matrícula.</div>';
    return;
  }
  if(!acepto){
    msg.innerHTML = '<div class="msg-error">Marca la casilla de aceptación para continuar.</div>';
    return;
  }

  btn.disabled = true; btn.textContent = 'Comprobando...';
  // FIX — antes solo se recargaba el Horario General si BASES.global.data
  // todavía estaba vacío ("if(!BASES.global.data)"). Si el admin subía un
  // PDF nuevo con matrículas nuevas MIENTRAS alguien ya tenía la app
  // abierta (y esa sesión ya había cargado el PDF viejo antes), esa
  // persona nueva no se encontraba hasta recargar la página entera —
  // la comprobación seguía mirando la copia vieja en memoria. Ahora se
  // vuelve a pedir siempre lo último publicado, para que una matrícula
  // recién añadida se reconozca sin tener que cerrar y reabrir la app.
  await cargarHorarioGlobalDesdeAdmin();
  btn.disabled = false; btn.textContent = 'Continuar';

  if(!BASES.global.data){
    msg.innerHTML = '<div class="msg-error">No se pudo comprobar tu matrícula (el Horario General aún no está disponible). Inténtalo de nuevo en unos segundos.</div>';
    return;
  }

  var existe = BASES.global.data.some(function(empleado){ return String(empleado[0]).trim() === matricula; });
  if(!existe){
    // NUEVO — si el admin ya aceptó manualmente una solicitud de
    // acceso para esta matrícula, se deja pasar aunque no esté en el
    // Horario General todavía (ver tabla solicitudes_acceso).
    var solicitudAceptadaBusc = await _matriculaTieneSolicitudAceptada(matricula);
    if(!solicitudAceptadaBusc){
      msg.innerHTML = '<div class="msg-error">Esa matrícula no aparece en el Horario General. Revisa que la hayas escrito bien, o solicita acceso abajo.</div>';
      mostrarBloqueSolicitudAccesoBusc();
      return;
    }
  }

  // NUEVO — Registro silencioso de la aceptación (matrícula + nombre
  // si se conoce + fecha/hora automática). El usuario no ve nada de
  // esto — es solo la prueba de que aceptó, para uso interno.
  var empleadoMatch = BASES.global.data.find(function(e){ return String(e[0]).trim() === matricula; });
  var nombreEmpleado = empleadoMatch ? empleadoMatch[1] : null;
  if(sbAdmin){
    sbAdmin.from('aceptaciones_descargo').insert({
      matricula: matricula,
      nombre: nombreEmpleado,
      fecha_hora: new Date().toISOString()
    }).then(function(){}).catch(function(){});
  }
  localStorage.setItem('descargoAceptado_matricula', matricula);

  msg.innerHTML = '<div class="msg-ok">✅ Matrícula verificada.</div>';
  closeOv('ov-acceso-buscador');
  goP('companeros');
  abrirBuscadorConHorarioGlobal();
};

// NUEVO — Confirmado por Alex: en vez de un selector de mes aparte
// (los chips "Ago/Sep" que había antes), el Buscador de Compañeros y
// la pantalla de Interventor reutilizan el mes que YA está puesto en
// la pantalla de Calendario — la misma variable (curM) que mueven las
// flechas ‹ › de ahí. Así, mover el Calendario a otro mes y luego ir a
// buscar ya usa ese mes automáticamente, sin ningún botón nuevo.
function _mesCalendarioActual(){
  return { anio: curM.getFullYear(), mes: curM.getMonth()+1 };
}

window.abrirBuscadorConHorarioGlobal = async function(){
  // NUEVO — FIX de lentitud: la primera vez en la sesión se hace la
  // carga completa de siempre (con su comprobación de red). A partir
  // de la segunda vez que se entra en la pestaña Compañeros, si ya
  // tenemos datos en memoria, se entra AL INSTANTE con esos datos —
  // la comprobación de "¿hay algo nuevo publicado?" se sigue haciendo,
  // pero en segundo plano, sin bloquear la pantalla. Antes se repetía
  // la consulta a Supabase (y se esperaba a que respondiera) cada vez
  // que se tocaba la pestaña, aunque no hubiera nada nuevo que leer.
  var mesObjetivo = _mesCalendarioActual();
  // NUEVO — Confirmado por Alex: el atajo rápido (entrar al instante
  // con lo que ya había en memoria) solo vale si ese dato en memoria
  // es del MISMO mes que ahora mismo tienes puesto en el Calendario.
  // Si moviste el Calendario a otro mes desde la última vez que
  // entraste aquí, se fuerza una recarga completa para el mes nuevo —
  // si no, te seguiría saliendo el mes viejo aunque hubieras movido
  // el Calendario.
  var mesYaCargadoCoincide = BASES.global && BASES.global.mesAnio
    && BASES.global.mesAnio.anio===mesObjetivo.anio && BASES.global.mesAnio.mes===mesObjetivo.mes;
  if(window._companerosCargadoEnEstaSesion && mesYaCargadoCoincide && BASES.global.data && BASES.global.data.length){
    activateBase('global');
    cargarHorarioGlobalDesdeAdmin(mesObjetivo).then(function(ok){ if(ok) activateBase('global'); }).catch(function(){});
    return;
  }
  // NUEVO — antes esto abría un overlay aparte (openOv('ov-buscador')).
  // Ahora "Compañeros" es una pestaña normal, ya visible en cuanto se
  // entra por goP('companeros') — no hace falta abrir nada más aquí.
  var statusEl = document.getElementById('estadoHorarioGlobalBuscador');
  if(statusEl) statusEl.textContent = 'Buscando el horario publicado...';

  // FIX — antes, si algo fallaba de forma inesperada aquí (una
  // excepción que ni el propio try/catch interno de
  // cargarHorarioGlobalDesdeAdmin() capturase, o la llamada se
  // quedaba pendiente sin resolver nunca), la pantalla se quedaba
  // congelada para siempre en "Sincronizando...", sin ningún aviso ni
  // forma de reintentar — la persona no podía hacer nada salvo cerrar
  // la app. Ahora todo el bloque está blindado con try/catch, y si
  // falla, aparece un botón para reintentar sin salir de la pestaña.
  try{
    var ok = await cargarHorarioGlobalDesdeAdmin(mesObjetivo);
    if(ok){
      activateBase('global');
      window._companerosCargadoEnEstaSesion = true;
    } else if(statusEl){
      statusEl.innerHTML = 'Todavía no hay ningún horario publicado por el administrador, o hubo un problema al cargarlo.'
        + (_diagHorarioGeneral ? (' [Diagnóstico: '+_diagHorarioGeneral+']') : '')
        + '<br><button onclick="abrirBuscadorConHorarioGlobal()" style="margin-top:8px;padding:8px 14px;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.4);border-radius:8px;color:#93c5fd;font-size:12px;font-weight:700;cursor:pointer">🔄 Reintentar</button>';
    }
  }catch(errHorarioFatal){
    console.log('Fallo crítico cargando el Horario General:', errHorarioFatal);
    if(statusEl){
      statusEl.innerHTML = 'Ocurrió un error inesperado cargando el horario: '+(errHorarioFatal&&errHorarioFatal.message?errHorarioFatal.message:String(errHorarioFatal))
        + '<br><button onclick="abrirBuscadorConHorarioGlobal()" style="margin-top:8px;padding:8px 14px;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.4);border-radius:8px;color:#93c5fd;font-size:12px;font-weight:700;cursor:pointer">🔄 Reintentar</button>';
    }
  }

  // NUEVO — Intervención: se descarga y se cruza en segundo plano,
  // igual que el formulario manual, pero sin que el usuario tenga
  // que hacer nada. Si ya existe un servicio con el mismo nombre
  // (por ejemplo, tras una recarga), no se duplica.
  // FIX — red de seguridad adicional: si la propia LLAMADA a
  // cargarIntervencionGlobalDesdeAdmin() fallara por algún motivo
  // que ni su propio try/catch interno capturase (por ejemplo, un
  // error de referencia), este bloque lo atrapa y lo muestra de
  // todas formas — nunca debe fallar en silencio.
  try{
    await cargarIntervencionGlobalDesdeAdmin();
  }catch(errIntervencionFatal){
    try{
      toast('🛑 Fallo crítico Intervención: '+(errIntervencionFatal&&errIntervencionFatal.message?errIntervencionFatal.message:errIntervencionFatal));
    }catch(errToastRoto){
      alert('Fallo crítico Intervención: '+errIntervencionFatal);
    }
  }
};

// NUEVO — MISMA carga de datos que abrirBuscadorConHorarioGlobal()
// de arriba (Horario General + Intervención), pero SIN abrir ninguna
// ventana — la usa la pantalla de Interventor, que ya tiene su propia
// pantalla y no necesita el overlay "ov-buscador" de tripulación.
// Se expone a window por el mismo motivo que la de arriba: el Portal
// de Perfil vive fuera de este módulo aislado.
window.cargarDatosParaInterventor = async function(){
  // NUEVO — Confirmado por Alex: mismo mecanismo que Compañeros — el
  // mes a buscar es el que YA está puesto en la pantalla de
  // Calendario (curM), no "el más reciente subido". Así, mover el
  // Calendario a otro mes y entrar a Interventor ya busca en ese mes.
  var ok = await cargarHorarioGlobalDesdeAdmin(_mesCalendarioActual());
  if(ok) activateBase('global');
  try{
    await cargarIntervencionGlobalDesdeAdmin();
  }catch(errIntervencionFatal){
    console.warn('Fallo al cargar Intervención para el Portal de Interventor:', errIntervencionFatal);
  }
  // NUEVO — revalidación silenciosa de la matrícula de interventor
  // contra el Informe de agentes (sección Intervención del admin —
  // el PDF "Gráfico + Informe", NO el Horario General de
  // tripulación) que se acaba de sincronizar arriba en
  // INTERVENTOR_SERVICES. Ese Informe se renueva cada pocos días,
  // así que si la matrícula ya validada en este dispositivo ha
  // dejado de aparecer en el más reciente, se cierra el acceso y se
  // vuelve a pedir — en vez de dejar entrar con una matrícula
  // desactualizada.
  var matriculaGuardada = localStorage.getItem('interventorMatriculaValidada');
  if(matriculaGuardada && INTERVENTOR_SERVICES.length){
    var sigueValida = INTERVENTOR_SERVICES.some(function(servicio){
      return (servicio.data||[]).some(function(agente){ return String(agente[0]).trim() === matriculaGuardada; });
    });
    // FIX — esta revalidación solo miraba el Informe de Intervención
    // oficial, sin tener en cuenta las solicitudes de acceso que TÚ
    // aceptaste a mano (tabla solicitudes_acceso). Por eso un
    // interventor aceptado por solicitud entraba bien la primera vez
    // (esa comprobación sí lo tenía en cuenta) pero lo expulsaba
    // enseguida aquí, en la siguiente comprobación silenciosa.
    if(!sigueValida && typeof _matriculaTieneSolicitudAceptada==='function'){
      try{ sigueValida = await _matriculaTieneSolicitudAceptada(matriculaGuardada); }catch(errRevalSolicitud){ /* si falla la comprobación, no se expulsa por eso */ }
    }
    if(!sigueValida && typeof window.__cerrarSesionInterventorPorMatriculaInvalida === 'function'){
      window.__cerrarSesionInterventorPorMatriculaInvalida();
    }
  }
  return ok;
};

// NUEVO — Acceso de Interventor (Portal de Perfil): comprueba una
// matrícula contra el Informe de agentes ya publicado en el segmento
// de Intervención del admin ("Interventor (Gráfico + Informe)" —
// mismo PDF con columnas Matrícula/Agente/turnos que sube el admin,
// NO el Horario General de tripulación). Se expone a window por el
// mismo motivo que cargarDatosParaInterventor: el Portal de Perfil
// vive en su propio bloque aislado, al final del documento, y no ve
// INTERVENTOR_SERVICES/cargarIntervencionGlobalDesdeAdmin
// directamente.
window.validarMatriculaInterventorContraInforme = async function(matricula){
  var ok = await cargarIntervencionGlobalDesdeAdmin();
  if(!ok){
    return { valida:false, motivo: (typeof _diagIntervencion !== 'undefined' && _diagIntervencion) || 'No se pudo cargar el Informe de Intervención.' };
  }
  if(!INTERVENTOR_SERVICES.length){
    return { valida:false, motivo: 'El Informe de Intervención está publicado pero no contiene ningún agente.' };
  }
  // FIX — normaliza quitando espacios en ambos lados antes de
  // comparar. En Valencia el identificador es el número de móvil (6
  // dígitos, p.ej. "926 120") y la persona puede escribirlo con o sin
  // el espacio central — ambos deben coincidir con el mismo dato
  // guardado ("926120", sin espacio). No afecta a las matrículas de
  // otras sedes (Barcelona/Madrid/Bilbao), que ya no llevan espacios.
  var limpiar = function(s){ return String(s||'').replace(/\s+/g,'').trim(); };
  var matriculaLimpia = limpiar(matricula);
  var agenteEncontrado = null;
  INTERVENTOR_SERVICES.some(function(servicio){
    return (servicio.data||[]).some(function(agente){
      if(limpiar(agente[0]) === matriculaLimpia){
        agenteEncontrado = agente;
        return true;
      }
      return false;
    });
  });
  if(!agenteEncontrado){
    return { valida:false, motivo: 'Esa matrícula o número de móvil no aparece en el Informe de Intervención publicado.' };
  }
  return { valida:true, motivo:null, nombre: agenteEncontrado[1] };
};

// NUEVO — Acceso de Tripulante (Portal de Perfil): busca una
// matrícula en TODOS los Horarios Generales publicados A LA VEZ (cada
// sede es un PDF distinto — Barcelona, Madrid, Valencia...), parando
// en cuanto la encuentra en cualquiera de ellas. Devuelve tanto el
// nombre completo como la sede a la que pertenece esa matrícula, para
// poder rellenar Ajustes (nombre + Estación Base) sin que la persona
// tenga que elegir nada a mano. Reutiliza el mismo parser en
// producción (parsePageWords) y el mismo patrón rápido en paralelo ya
// probado para crear cuentas (Promise.any + salida temprana por
// página) — no toca ninguna de esas funciones, solo las reutiliza.
async function _buscarFilaMatriculaEnPdf(buf, matricula){
  await asegurarPdfWorkerSeguro();
  var pdf = await pdfjsLib.getDocument({data: buf}).promise;
  var numPages = pdf.numPages;
  var leftover = [];
  for(var pi=1; pi<=numPages; pi++){
    try{
      var page = await pdf.getPage(pi);
      var viewport = page.getViewport({scale:1});
      var pageHeight = viewport.height;
      var content = await page.getTextContent();
      var words = [];
      for(var wi=0; wi<content.items.length; wi++){
        var item = content.items[wi];
        var str = (item.str||'').trim();
        if(!str) continue;
        var x0 = item.transform[4];
        var top = pageHeight - item.transform[5];
        var parts = str.split(/\s+/).filter(Boolean);
        if(parts.length<=1){
          words.push({text: str, x0: x0, top: top, pagina: pi});
        } else {
          var w = item.width || 0;
          (function(parts, x0, w, top, pi){
            parts.forEach(function(p, idx){
              words.push({text: p, x0: x0 + (w*idx/parts.length), top: top, pagina: pi});
            });
          })(parts, x0, w, top, pi);
        }
      }
      var parsed = parsePageWords(words, leftover, pi);
      leftover = parsed.leftover || [];
      var match = parsed.find(function(e){ return String(e[0]).trim()===matricula; });
      if(match) return match; // [id, nombre, dias]
    }catch(errPag){
      console.log('Búsqueda de tripulante: no se pudo leer la página '+pi+' de '+numPages+', se continúa.', errPag);
      leftover = [];
    }
  }
  return null;
}

async function _buscarFilaMatriculaEnArchivo(fila, matricula){
  var archivoResp = await fetch(fila.url_archivo);
  if(!archivoResp.ok) return null;
  var nombreArchivo = fila.nombre_archivo || '';
  if(/\.xlsx$/i.test(nombreArchivo)){
    var buf = await archivoResp.arrayBuffer();
    var datos = parseHorarioGeneralXLSX(buf);
    return datos.find(function(e){ return String(e[0]).trim()===matricula; }) || null;
  }
  if(/\.csv$/i.test(nombreArchivo)){
    var texto = await archivoResp.text();
    var datosCsv = parseHorarioGeneralCSV(texto);
    return datosCsv.find(function(e){ return String(e[0]).trim()===matricula; }) || null;
  }
  var bufPdf = await archivoResp.arrayBuffer();
  return await _buscarFilaMatriculaEnPdf(bufPdf, matricula);
}

window.buscarTripulanteEnTodasLasSedes = async function(matricula){
  if(!sbAdmin) return { valida:false, motivo:'No se pudo conectar para comprobar la matrícula.' };
  var resp = await sbAdmin.from('config_global').select('*').like('tipo','horario_general_%');
  if(resp.error || !resp.data || !resp.data.length){
    return { valida:false, motivo:'No hay ningún Horario General publicado todavía.' };
  }
  var filasConArchivo = resp.data.filter(function(f){ return f.url_archivo; });
  if(!filasConArchivo.length) return { valida:false, motivo:'No hay ningún Horario General publicado todavía.' };

  var promesas = filasConArchivo.map(function(fila){
    return _buscarFilaMatriculaEnArchivo(fila, matricula).then(function(match){
      if(match) return { nombre: match[1], sede: fila.sede || fila.tipo.replace('horario_general_','') };
      return Promise.reject(new Error('no está en esta sede'));
    });
  });
  try{
    var resultado = await Promise.any(promesas);
    return { valida:true, nombre: resultado.nombre, sede: resultado.sede };
  }catch(e){
    return { valida:false, motivo:'Esa matrícula no aparece en ningún Horario General publicado todavía.' };
  }
};

// NUEVO — recuerda con qué "modo" se cargaron los datos la última vez
// (todas las sedes, si eres admin/interventor; o una sola sede, si
// eres tripulante normal) — para saber cuándo hay que recargar.
var _ultimoModoCargaHorarioGeneral = null;

// NUEVO — para el "con quién viajas" automático en Turnos del mes
// (Horario individual). Reutiliza activeBase/cellContainsTrain ya
// existentes, sin duplicar esa lógica. Se expone a window por el
// mismo motivo de siempre: ese panel vive fuera de este módulo.
window.asegurarHorarioGeneralCargado = async function(mesObjetivo){
  // FIX — antes, en cuanto activeBase.data se cargaba UNA vez (por
  // ejemplo, como tripulante normal de una sola sede, ANTES de
  // iniciar sesión de admin o entrar como interventor), esos datos se
  // quedaban en caché para siempre — aunque luego la persona pasara a
  // ser admin/interventor, "con quién viajas" seguía buscando solo en
  // esa única sede de antes. Ahora se comprueba si el modo (todas las
  // sedes vs. una sola) cambió desde la última carga, y si cambió, se
  // vuelve a pedir todo de cero.
  var esAdminOInterventorAhora = !!(perfilAdminActual && perfilAdminActual.rol==='admin') || !!(usuarioActual && usuarioActual.esInterventor);
  var modoEsperado = esAdminOInterventorAhora ? 'todas-las-sedes' : ('sede:'+_sedeUsuarioActual());
  // FIX — Confirmado por Alex (bug real, detectado en producción): la
  // comprobación de aquí abajo nunca miraba de qué MES eran los datos
  // ya cargados — solo si existían y si el modo (sede/todas) coincidía.
  // Si antes se había consultado Interventor o Compañeros en
  // septiembre, y luego se abría un día de AGOSTO en el propio
  // Calendario, "Viajas con" seguía buscando en los datos de
  // septiembre — dando compañeros de otro mes con el mismo número de
  // día (el "14" de septiembre, no el "14" de agosto). Ahora, si se
  // indica un mes objetivo, también se comprueba que coincida con lo
  // ya cargado — y si no, se recarga el mes correcto antes de seguir.
  var mesYaCargadoCoincide = !mesObjetivo || (activeBase && activeBase.mesAnio
    && activeBase.mesAnio.anio===mesObjetivo.anio && activeBase.mesAnio.mes===mesObjetivo.mes);
  if(activeBase && activeBase.data && _ultimoModoCargaHorarioGeneral === modoEsperado && mesYaCargadoCoincide) return true;
  var ok = await cargarHorarioGlobalDesdeAdmin(mesObjetivo);
  if(ok){
    activateBase('global');
    _ultimoModoCargaHorarioGeneral = modoEsperado;
  }
  return !!(activeBase && activeBase.data);
};
// FIX — esta función vive dentro de un módulo aislado (function(){...})()
// que usa la app para el buscador/PDF, pero se llama desde FUERA de
// ese módulo (detalle del día y acordeones del calendario, ambos
// definidos antes de este bloque). Por eso tiene que colgarse de
// window explícitamente — como función local sin más, quedaba fuera
// de alcance y lanzaba "_chipUmDhTexto is not defined".
// NUEVO — el tramo (ida/vuelta) se deduce de EN QUÉ POSICIÓN de la
// celda aparece el número de tren marcado: si es de los primeros
// números que aparecen, es la ida; si aparece más adelante, es la
// vuelta. Esto es justo lo que confirmó el usuario: la posición
// dentro de la celda es lo que indica el tramo, igual que ya hace
// determinarTramoDH() con las estaciones para el propio turno.
function _tramoTrenEnCelda(cell, digitsBuscado){
  const tokens = (cell||'').split(/[^0-9A-Za-z]+/).filter(Boolean);
  const digitsVistos = [];
  for(const tok of tokens){
    const m = tok.match(/(\d{2,6})/);
    if(!m) continue;
    const d = m[1].replace(/^0+(?=\d)/, '');
    if(digitsVistos.indexOf(d)===-1) digitsVistos.push(d);
  }
  const idx = digitsVistos.indexOf(digitsBuscado);
  if(idx<=0) return 'ida';
  if(idx===digitsVistos.length-1) return 'vuelta';
  return null; // posición intermedia — no se afirma tramo con seguridad
}
window._chipUmDhTexto = function(tren, cell){
  if(!tren) return '';
  var out = '';
  var digits = (String(tren).match(/(\d{2,6})/)||[])[1];
  var tramo = (cell && digits) ? _tramoTrenEnCelda(cell, digits) : null;
  var sufijo = tramo ? (' <span style="color:var(--tx3, #94A3B8);font-weight:600">('+(tramo==='ida'?'ida':'vuelta')+')</span>') : '';
  if(/UM/.test(tren)) out += ' <span style="color:var(--violet2, #C4B5FD);font-weight:800">🔀UM</span>'+sufijo;
  if(/DH/.test(tren)) out += ' <span style="color:var(--amber2, #FCD34D);font-weight:800">☕DH</span>'+sufijo;
  return out;
};

// NUEVO — Opción D confirmada: barra de progreso en vivo para el
// horario del compañero (hora de toma/CI → hora de deje/CO), que solo
// se mueve si HOY es el día del turno y la hora actual del móvil está
// dentro de ese rango. Fuera de eso queda fija al principio (0%) o al
// final (100%), sin animar — nunca se inventa progreso para otro día.
window._pghSeq = 0;
window._progresoHorarioHTML = function(horaCI, horaCO, diaNum){
  if(!horaCI || !horaCO || !diaNum) return '';
  var pid = 'pgh'+(window._pghSeq++);
  return '<div class="pgh-wrap" id="'+pid+'" data-ci="'+horaCI+'" data-co="'+horaCO+'" data-dia="'+diaNum+'" style="margin-top:9px">'
    + '<div style="display:flex;align-items:center;gap:8px">'
    + '<span style="font-family:monospace;font-size:11px;font-weight:800;color:var(--tx,#F8FAFC)">'+horaCI+'</span>'
    + '<div class="pgh-bar" style="flex:1;height:5px;background:var(--div,#1E3350);border-radius:3px;position:relative">'
    + '<div class="pgh-fill" style="position:absolute;left:0;top:0;height:100%;width:0%;background:var(--acc,#2563EB);border-radius:3px;transition:width 1s linear"></div>'
    + '<span class="pgh-tren" style="position:absolute;top:50%;left:0%;font-size:12px;transform:translate(-50%,-50%);display:none;transition:left 1s linear">🚆</span>'
    + '</div>'
    + '<span style="font-family:monospace;font-size:11px;font-weight:800;color:var(--tx,#F8FAFC)">'+horaCO+'</span>'
    + '</div>'
    + '<div class="pgh-live" style="display:none;align-items:center;gap:4px;font-size:10px;color:#4ADE80;font-weight:800;margin-top:4px">'
    + '<span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span> En curso ahora mismo</div>'
    + '</div>';
};
// NUEVO — un único temporizador global actualiza TODAS las barras de
// progreso visibles a la vez, comparando contra la hora real del
// móvil. Se relanza cada 30s — suficiente para que se vea "moverse"
// sin recalcular cada segundo. Solo se activa si hay barras en pantalla.
window._actualizarProgresosHorario = function(){
  var barras = document.querySelectorAll('.pgh-wrap[data-ci]');
  if(!barras.length) return;
  var mesAnio = (typeof activeBase!=='undefined' && activeBase && (activeBase.mesAnio || (activeBase.data && activeBase.data.mesAnio)))
    || (typeof BASES!=='undefined' && BASES.global && BASES.global.mesAnio) || null;
  var ahora = new Date();
  function aMin(hhmm){ var p=String(hhmm).split(':'); return parseInt(p[0],10)*60+parseInt(p[1],10); }
  barras.forEach(function(el){
    var horaCI = el.dataset.ci, horaCO = el.dataset.co, dia = parseInt(el.dataset.dia,10);
    var esHoy = !!(mesAnio && ahora.getFullYear()===mesAnio.anio && (ahora.getMonth()+1)===mesAnio.mes && ahora.getDate()===dia);
    var minIni = aMin(horaCI), minFin = aMin(horaCO);
    if(minFin < minIni) minFin += 24*60;
    var minAhora = ahora.getHours()*60 + ahora.getMinutes();
    var pct = 0, enCurso = false;
    if(esHoy){
      if(minAhora < minIni) pct = 0;
      else if(minAhora > minFin) pct = 100;
      else { pct = Math.round(((minAhora-minIni)/(minFin-minIni))*100); enCurso = true; }
    }
    var fill = el.querySelector('.pgh-fill');
    var tren = el.querySelector('.pgh-tren');
    var live = el.querySelector('.pgh-live');
    if(fill) fill.style.width = pct+'%';
    if(tren){ tren.style.left = pct+'%'; tren.style.display = enCurso ? 'block' : 'none'; }
    if(live) live.style.display = enCurso ? 'flex' : 'none';
  });
};
if(!window._pghIntervalStarted){
  window._pghIntervalStarted = true;
  window._actualizarProgresosHorario();
  setInterval(window._actualizarProgresosHorario, 30000);
}
window.buscarCompanerosParaTrenDia = function(trainNum, dayNum){
  if(!activeBase || !activeBase.data) return null;
  var matches = [];
  for(var i=0; i<activeBase.data.length; i++){
    var row = activeBase.data[i];
    var name = row[1], days = row[2];
    var cell = days ? days[String(dayNum)] : null;
    // FIX — antes solo se devolvía el nombre (string), perdiendo el
    // texto real del tren de ESE compañero ("3112UM", "3122DH"...),
    // que es justo lo que hace falta para poder mostrar los chips UM/
    // DH en "🧑‍🤝‍🧑 Viajas con:" (detalle del día). Se sigue devolviendo
    // algo "stringificable" (name sigue siendo lo primero, ver toString
    // más abajo) por si algún sitio viejo lo trata como texto plano.
    if(cell && cellContainsTrain(cell, trainNum)){
      var detalleComp = trainTokensDetalle(cell);
      var textoTren = detalleComp.get(String(trainNum).replace(/^0+(?=\d)/,'')) || String(trainNum);
      matches.push({ name: name, cell: cell, tren: textoTren, toString: function(){ return this.name; } });
    }
  }
  return matches;
};

// NUEVO — Descarga el Gráfico + el Informe publicados por el admin
// y reutiliza EXACTAMENTE el mismo pipeline que ya usaba el
// formulario manual (pdfToLines → parseGraficoTurnos/parseAgentsTable
// → construirDiasDesdeCruce), sin tocar ninguna de esas funciones.
// NUEVO — _diagIntervencion guarda el último motivo de fallo en
// texto plano, para poder mostrarlo en el Acceso de Interventor
// (Portal de Perfil) sin depender de toast(), que puede quedar
// tapado detrás de esa pantalla.
var _diagIntervencion = null;
async function cargarIntervencionGlobalDesdeAdmin(){
  _diagIntervencion = null;
  if(!sbAdmin){
    _diagIntervencion = 'Supabase no está disponible en este navegador.';
    toast('⚠️ Intervención: Supabase no está disponible en este navegador');
    return false;
  }

  // FIX — antes se pedía SOLO la fila con tipo EXACTO
  // 'grafico_intervencion' (.single()), así que solo podía existir
  // UNA Intervención publicada a la vez — publicar una nueva
  // sobreescribía la anterior. Ahora se piden TODAS las filas cuyo
  // tipo empiece por 'grafico_intervencion' (una por cada nombre de
  // servicio publicado — ver subirIntervencionGlobalAdmin) y se
  // procesan una a una, igual que ya hace el Horario General con
  // varias sedes a la vez.
  var resp = await sbAdmin.from('config_global').select('*');
  if(resp.error){
    _diagIntervencion = 'Error al consultar config_global: '+resp.error.message;
    toast('⚠️ Intervención: '+resp.error.message);
    return false;
  }
  var filas = (resp.data||[]).filter(function(f){ return f.tipo && f.tipo.indexOf('grafico_intervencion')===0 && f.url_archivo && f.url_archivo_informe; });
  if(!filas.length){
    _diagIntervencion = 'El admin aún no ha publicado ninguna Intervención (Gráfico+Informe).';
    toast('⚠️ Intervención: el admin aún no ha publicado ninguna Intervención');
    return false;
  }

  var elEstado = document.getElementById('estadoIntervencionBuscador');
  var huboExito = false;
  var ultimoError = null;

  for(var i=0; i<filas.length; i++){
    var d = filas[i];
    try{
      // FIX — antes se evitaba reprocesar comparando SOLO
      // d.nombre_servicio: si el admin resubía un Informe nuevo
      // reutilizando el mismo nombre de servicio (lo habitual en una
      // publicación semanal), la app se quedaba para siempre con la
      // copia vieja en caché y nunca veía las matrículas nuevas — el
      // Acceso de Interventor podía rechazar a alguien que SÍ estaba
      // en el Informe recién publicado. Ahora se compara también
      // fecha_subida: incluso con el mismo nombre, una subida más
      // reciente sí se vuelve a descargar y parsear.
      var idxServicioExistente = INTERVENTOR_SERVICES.findIndex(function(s){ return s.name === d.nombre_servicio; });
      var yaActualizado = idxServicioExistente !== -1 && INTERVENTOR_SERVICES[idxServicioExistente].fechaSubida === d.fecha_subida;
      if(yaActualizado){
        huboExito = true;
        continue;
      }

      toast('🔀 Sincronizando intervención («'+d.nombre_servicio+'»)...');
      if(elEstado) elEstado.textContent = 'Sincronizando intervención («'+d.nombre_servicio+'»)...';

      // FIX — antes no se aseguraba el worker de PDF.js aquí (sí se
      // hacía para el Horario General). Si el Horario General se
      // publicó en CSV/XLSX, el worker nunca llegaba a configurarse
      // por el método seguro, y la lectura de estos 2 PDF podía fallar
      // en silencio.
      await asegurarPdfWorkerSeguro();

      var respGrafico = await fetch(d.url_archivo);
      var respInforme = await fetch(d.url_archivo_informe);
      if(!respGrafico.ok || !respInforme.ok){
        ultimoError = 'No se pudo descargar el Gráfico ('+respGrafico.status+') o el Informe ('+respInforme.status+') de «'+d.nombre_servicio+'».';
        toast('⚠️ Intervención «'+d.nombre_servicio+'»: no se pudo descargar el Gráfico o el Informe');
        continue;
      }

      var graficoBuf = await respGrafico.arrayBuffer();
      var graficoLines = await pdfToLines(pdfjsLib, new Uint8Array(graficoBuf));
      var turnosData = parseGraficoTurnos(graficoLines);

      var informeBuf = await respInforme.arrayBuffer();
      var informeLines = await pdfToLines(pdfjsLib, new Uint8Array(informeBuf));
      var agentsData = parseAgentsTable(informeLines, d.fecha_inicio);

      if(!agentsData){
        ultimoError = 'No se reconoció la tabla de fechas del Informe de «'+d.nombre_servicio+'».';
        toast('⚠️ Intervención «'+d.nombre_servicio+'»: no se reconoció la tabla de fechas del Informe');
        continue;
      }
      if(Object.keys(turnosData).length === 0){
        // FIX — antes esto CANCELABA el servicio entero (ni siquiera
        // se cargaban los agentes del Informe), así que si el Gráfico
        // no se reconocía, NADIE podía entrar con su matrícula/móvil,
        // aunque el Informe sí se hubiera leído bien. Ahora se avisa
        // pero se sigue adelante: el acceso y la lista de agentes
        // siguen funcionando (construirDiasDesdeCruce() ya tolera un
        // turnosData vacío sin romperse), solo que ese día no se podrá
        // cruzar con el número de tren hasta que el Gráfico de esa
        // sede se reconozca.
        toast('⚠️ Intervención «'+d.nombre_servicio+'»: no se reconoció el Gráfico (el acceso funciona igual, pero sin cruce de tren todavía)');
      }

      var diasPorAgente = construirDiasDesdeCruce(agentsData, turnosData);
      var nuevoServicio = { name: d.nombre_servicio, isoDates: agentsData.isoDates, data: diasPorAgente, turnos: turnosData, fechaSubida: d.fecha_subida };
      // FIX — si ya existía un servicio con este nombre (versión vieja),
      // se REEMPLAZA en el mismo sitio en vez de añadir uno duplicado;
      // así INTERVENTOR_SERVICES nunca arrastra una copia desactualizada
      // que pudiera seguir "validando" una matrícula ya retirada.
      if(idxServicioExistente !== -1){
        INTERVENTOR_SERVICES[idxServicioExistente] = nuevoServicio;
      } else {
        INTERVENTOR_SERVICES.push(nuevoServicio);
      }
      atGuardarInterventor();
      if(elEstado) elEstado.textContent = 'Intervención sincronizada: «'+d.nombre_servicio+'»';
      toast('✅ Intervención «'+d.nombre_servicio+'» sincronizada: '+diasPorAgente.length+' agentes cruzados');
      huboExito = true;
    }catch(eFila){
      ultimoError = 'Excepción en «'+(d.nombre_servicio||d.tipo)+'»: '+(eFila && eFila.message ? eFila.message : String(eFila));
      toast('⚠️ Error Intervención «'+(d.nombre_servicio||d.tipo)+'»: '+(eFila&&eFila.message?eFila.message:eFila));
    }
  }

  if(!huboExito && ultimoError) _diagIntervencion = ultimoError;
  return huboExito;
}

// NUEVO — Diagnóstico de Intervención (panel de admin): fuerza una
// re-sincronización COMPLETA (vacía la caché en memoria antes, así
// que siempre vuelve a descargar y volver a parsear los dos PDF,
// nunca se queda con un resultado antiguo) y muestra, servicio a
// servicio, cuántos agentes se detectaron y su identificador+nombre
// — para poder ver de un vistazo si el parser leyó bien la tabla de
// una sede nueva (p.ej. Valencia) sin tener que adivinar a ciegas.
async function diagnosticarIntervencionAdmin(){
  var el = document.getElementById('estadoDiagIntervencion');
  if(!el) return;
  el.style.display = 'block';
  el.textContent = 'Sincronizando de nuevo (ignorando caché)...';
  INTERVENTOR_SERVICES = []; // fuerza a re-descargar y re-parsear todo
  var ok = await cargarIntervencionGlobalDesdeAdmin();
  if(!ok){
    el.textContent = '❌ ' + (_diagIntervencion || 'No se pudo sincronizar ninguna Intervención.');
    return;
  }
  if(!INTERVENTOR_SERVICES.length){
    el.textContent = '⚠️ Se sincronizó pero no hay ningún servicio de Intervención cargado.';
    return;
  }
  var txt = '';
  INTERVENTOR_SERVICES.forEach(function(s){
    var nTrenes = s.turnos ? Object.keys(s.turnos).length : 0;
    txt += '📋 «'+s.name+'» — '+s.data.length+' agente(s) detectado(s) · Gráfico: '+(nTrenes>0?nTrenes+' turno(s) con tren':'⚠️ sin reconocer (acceso OK, cruce de tren no disponible)')+'\n';
    if(!s.data.length){
      txt += '   (0 agentes: la tabla no se reconoció — revisa el formato del Informe)\n';
    } else {
      s.data.slice(0, 8).forEach(function(a){
        txt += '   · '+a[0]+' — '+a[1]+'\n';
      });
      if(s.data.length > 8) txt += '   ... y '+(s.data.length-8)+' más\n';
    }
    txt += '\n';
  });
  el.textContent = txt.trim();
}
window.diagnosticarIntervencionAdmin = diagnosticarIntervencionAdmin; // FIX — el botón del panel Admin la llama desde onclick (ámbito global)

function refreshBaseCards(){
  const b = BASES.barcelona, m = BASES.madrid;
  document.getElementById('meta-barcelona').textContent = b.data ? `${b.data.length} empleados · ${b.month}` : 'Aún sin plantilla cargada';
  document.getElementById('badge-barcelona').textContent = b.data ? 'LISTA' : 'SUBIR PDF';
  document.getElementById('badge-barcelona').className = 'base-badge ' + (b.data ? 'badge-ok' : 'badge-pend');
  document.getElementById('del-barcelona').style.display = b.data ? 'flex' : 'none';
  document.getElementById('meta-madrid').textContent = m.data ? `${m.data.length} empleados · ${m.month}` : 'Aún sin plantilla cargada';
  document.getElementById('badge-madrid').textContent = m.data ? 'LISTA' : 'SUBIR PDF';
  document.getElementById('badge-madrid').className = 'base-badge ' + (m.data ? 'badge-ok' : 'badge-pend');
  document.getElementById('del-madrid').style.display = m.data ? 'flex' : 'none';
}
refreshBaseCards();

function atEliminarBase(key, label){
  const ok = confirm('¿Eliminar el PDF de ' + label + '? Se borrarán los datos guardados en este dispositivo y tendrás que subir uno nuevo para volver a buscar.');
  if(!ok) return;
  BASES[key].data = null;
  BASES[key].month = '—';
  atGuardarBases();
  refreshBaseCards();
  if(activeBaseKey === key){
    activeBaseKey = null;
    activeBase = null;
    showPanel('panel-select');
  }
}
document.getElementById('del-barcelona').addEventListener('click', (e)=>{
  e.stopPropagation();
  atEliminarBase('barcelona', 'Barcelona');
});
document.getElementById('del-madrid').addEventListener('click', (e)=>{
  e.stopPropagation();
  atEliminarBase('madrid', 'Madrid');
});

/* ══════════ MÓDULO AÑADIDO: Interventor (Gráfico + Informe) ══════════
   100% aditivo y aislado: no modifica BASES/activeBase/renderTrain
   existentes, solo añade una fuente de datos EXTRA que se suma a los
   resultados de "Buscar por tren" cuando hay coincidencia. Reutiliza
   showPanel/toggleForm/generarCalendarioUI/pdfjsLib ya definidos arriba. ══════════ */

async function pdfToLines(pdfjsLib, data){
  const doc = await pdfjsLib.getDocument({data}).promise;
  const allLines = [];
  for(let p=1; p<=doc.numPages; p++){
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.map(it => ({
      str: it.str, x: it.transform[4], y: it.transform[5], w: it.width
    })).filter(it => it.str !== '');
    const rows = new Map();
    for(const it of items){
      const yKey = Math.round(it.y);
      let foundKey = null;
      for(const k of rows.keys()){ if(Math.abs(k - yKey) <= 2){ foundKey = k; break; } }
      if(foundKey === null) foundKey = yKey;
      if(!rows.has(foundKey)) rows.set(foundKey, []);
      rows.get(foundKey).push(it);
    }
    const sortedYs = [...rows.keys()].sort((a,b)=>b-a);
    for(const y of sortedYs){
      const rowItems = rows.get(y).sort((a,b)=>a.x-b.x);
      let line = '';
      const CHAR_W = 4.3;
      for(const it of rowItems){
        const startCol = Math.round(it.x / CHAR_W);
        const curCol = line.length;
        if(startCol > curCol) line += ' '.repeat(startCol - curCol);
        line += it.str;
      }
      allLines.push(line);
    }
    allLines.push('');
  }
  return allLines;
}

function parseAgentsTable(lines, startDateISO){
  let headerIdx = -1, dates = [], dow = [], colStarts = [];

  // NUEVO — formato Valencia: número de día y letra del día en DOS
  // líneas separadas ("1 2 3 4 ... 31" y, justo debajo, "S D L M X J
  // V ...") en vez de combinados en una sola línea ("01 S"). Se
  // prueba PRIMERO y solo se acepta si encuentra un mes entero (15+
  // días seguidos con su letra correspondiente): esto evita que una
  // fila de turnos cualquiera (que también son solo números y letras
  // sueltas) se confunda con la cabecera real.
  const numLineRe = /^\s*(?:\d{1,2}\s+){14,}\d{1,2}\s*$/;
  for(let i=0; i<lines.length-1 && headerIdx===-1; i++){
    if(!numLineRe.test(lines[i])) continue;
    const numToks = [...lines[i].matchAll(/\d{1,2}/g)];
    if(numToks.length < 15) continue; // un mes tiene entre 28 y 31 días
    // La línea de letras suele ser la siguiente no vacía.
    for(let j=i+1; j<Math.min(i+3, lines.length); j++){
      if(!lines[j].trim()) continue;
      const letToks = [...lines[j].matchAll(/[LMXJVSD]/g)];
      if(letToks.length >= numToks.length - 2){
        const nPares = Math.min(numToks.length, letToks.length);
        headerIdx = j; // los datos empiezan DESPUÉS de la línea de letras
        dates = numToks.slice(0, nPares).map(m => m[0].padStart(2,'0'));
        dow = letToks.slice(0, nPares).map(m => m[0]);
        // Las columnas de DATOS se alinean con la línea de LETRAS (la
        // más próxima a las filas de turnos), no con la de números.
        colStarts = letToks.slice(0, nPares).map(m => m.index);
      }
      break; // si la siguiente línea no vacía no es de letras, no insistir
    }
  }

  // FIX — el Informe de Bilbao usa fechas completas en la cabecera
  // ("04/08/2026 M") en vez del formato simple de Barcelona ("01 S"),
  // y a veces sin espacio antes de la letra del día ("2026M"). La
  // expresión anterior (\d{2}\s+[LMXJVSD]) solo reconocía "01 S" y
  // además, sobre "04/08/2026 M", encontraba por error el "26" final
  // de "2026" como si fuera el día. Ahora admite ambos formatos y
  // cero o más espacios antes de la letra. Solo se prueba si el
  // formato de dos líneas de arriba no encontró nada.
  if(headerIdx === -1){
    const dateTokenRe = /(\d{2}(?:\/\d{2}\/\d{4})?)\s*([LMXJVSD])\b/g;
    for(let i=0;i<lines.length;i++){
      const l = lines[i];
      const matches = [...l.matchAll(dateTokenRe)];
      if(matches.length >= 3){
        headerIdx = i;
        dow = matches.map(m => m[2]);
        dates = matches.map(m => m[1]);
        // NUEVO — posición (índice de carácter) donde empieza cada
        // columna de fecha en la línea de cabecera. pdfToLines() ya
        // reconstruye cada línea respetando la posición X real de
        // cada palabra en el PDF, así que esa misma posición de
        // carácter coincide, fila tras fila, con la misma columna de
        // la tabla.
        colStarts = matches.map(m => m.index);
        break;
      }
    }
  }
  if(headerIdx === -1) return null;
  const nCols = dates.length;

  let isoDates = null, dowMismatch = false;
  if(startDateISO){
    const DOW_LETTER_A = ['D','L','M','X','J','V','S'];
    const start = new Date(startDateISO + 'T00:00:00');
    isoDates = [];
    for(let i=0;i<nCols;i++){
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      isoDates.push(iso);
      if(DOW_LETTER_A[d.getDay()] !== dow[i]) dowMismatch = true;
    }
  }

  const agents = [];
  const rowRe = /^\s*(\d{6,8})\s+/;
  // NUEVO — formato Valencia: nombre primero, MÓVIL después partido
  // en dos bloques de 3 dígitos con un espacio ("926 120"). Se busca
  // como par de tokens adyacentes, no anclado al inicio de la fila.
  const movilParRe = /^\d{3}$/;
  for(let i=headerIdx+1;i<lines.length;i++){
    const l = lines[i];
    if(!l.trim()) continue;

    // FIX — antes se partía la fila por espacios y se asumía que los
    // ÚLTIMOS nCols tokens eran siempre los valores de cada columna.
    // Eso se rompía en cuanto un agente tenía algún día en blanco
    // (sin turno asignado, muy habitual en Bilbao): con menos tokens
    // de valor que columnas, el recorte agarraba trozos del NOMBRE
    // como si fueran valores de fecha, y agentes con MUCHOS días en
    // blanco se descartaban directamente (menos tokens que columnas).
    // Ahora cada token se ubica por su propia posición de carácter en
    // la línea (igual que colStarts) y se asigna a la columna de
    // fecha cuyo rango lo contiene — una celda en blanco simplemente
    // no aporta ningún token a esa columna, en vez de desalinear las
    // siguientes.
    const tokenRe = /\S+/g;
    let tm;
    const allToks = [];
    while((tm = tokenRe.exec(l)) !== null) allToks.push({text: tm[0], index: tm.index});
    if(!allToks.length) continue;

    function valoresDesdeTokens(desdeIndex){
      const values = new Array(nCols).fill('');
      allToks.forEach(function(t){
        if(t.index < desdeIndex) return;
        if(t.index < colStarts[0]) return; // aún dentro de la zona de etiqueta
        let col = -1;
        for(let c=0;c<nCols;c++){
          const left = colStarts[c];
          const right = (c+1<nCols) ? colStarts[c+1] : Infinity;
          if(t.index >= left && t.index < right){ col = c; break; }
        }
        if(col>=0 && !values[col]) values[col] = t.text;
      });
      return values;
    }

    const m = rowRe.exec(l);
    if(m){
      // Caso A (Barcelona/Madrid/Bilbao) — matrícula primero.
      const matricula = m[1];
      const restStart = m[0].length;
      const nombreParts = allToks.filter(t => t.index >= restStart && t.index < colStarts[0]).map(t => t.text);
      if(!nombreParts.length) continue; // fila sin nombre reconocible: no es un agente
      const nombre = nombreParts.join(' ').trim();
      agents.push({matricula, nombre, valores: valoresDesdeTokens(restStart)});
      continue;
    }

    // Caso B (NUEVO — Valencia) — nombre primero, MÓVIL (dos tokens
    // de 3 dígitos consecutivos) en algún punto antes de la primera
    // columna de fecha.
    const labelToks = allToks.filter(t => t.index < colStarts[0]);
    let idxMovil = -1;
    for(let ti=0; ti<labelToks.length-1; ti++){
      if(movilParRe.test(labelToks[ti].text) && movilParRe.test(labelToks[ti+1].text)){
        idxMovil = ti;
        break;
      }
    }
    if(idxMovil === -1) continue; // fila sin matrícula NI móvil reconocible: no es un agente
    const movil = labelToks[idxMovil].text + labelToks[idxMovil+1].text; // "926"+"120" -> "926120", sin espacio
    const nombreParts = labelToks.filter((_, idx) => idx !== idxMovil && idx !== idxMovil+1).map(t => t.text);
    if(!nombreParts.length) continue;
    const nombre = nombreParts.join(' ').trim();
    agents.push({matricula: movil, nombre, valores: valoresDesdeTokens(colStarts[0])});
  }
  return {dates, dow, agents, isoDates, dowMismatch};
}

function parseGraficoTurnos(lines){
  const n = lines.length;
  const FULL = new Set('LMXJVSD');
  function norm(l){
    return l.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,'');
  }
  const blockStarts = [];
  for(let i=0;i<n;i++){
    const s = lines[i].replace(/\s+$/,'');
    if(s.length < 40) continue;
    if(s.includes('Jornada ciclo') || s.includes('Legal')) continue;
    if(/\d{2}:\d{2}\s*$/.test(s)) blockStarts.push(i);
  }
  // FIX — algunos Gráficos (Bilbao) traen el número de turno, las
  // letras del día, la hora o el número de tren PEGADOS sin ningún
  // espacio entre sí (p.ej. "402LMXJVSD", "40117:58", "AUX10174"),
  // según cómo de apretado esté el texto en el PDF original. Los
  // patrones de aquí abajo se relajan para tolerar cero espacios sin
  // dejar de reconocer el formato normal (con espacio), como Barcelona.
  const specialRe = /^\s*(\d{3,4})\s*([LMXJVSD]{1,8})\b(.*)$/;
  function isSpecial(l){
    const nl = norm(l);
    if(!specialRe.test(l)) return false;
    return nl.includes('DESCANSO') || nl.includes('INCIDENCIA') || nl.includes('TRANSICION');
  }
  function isBareIncidencia(l){
    const m = /^\s*([LMXJVSD]{1,8})\b/.exec(l);
    if(!m) return false;
    if(/^\s*\d/.test(l)) return false;
    const nl = norm(l);
    return nl.includes('INCIDENCIA') || nl.includes('DESCANSO') || nl.includes('TRANSICION');
  }
  const spans = [];
  for(let bi=0; bi<blockStarts.length; bi++){
    const start = blockStarts[bi];
    const end = (bi+1 < blockStarts.length) ? blockStarts[bi+1] : n;
    let cut = end;
    for(let j=start+1;j<end;j++){
      if(isSpecial(lines[j]) || isBareIncidencia(lines[j])){ cut = j; break; }
    }
    if(cut > start) spans.push([start, cut]);
  }
  // FIX — antes exigía un límite de palabra (\b) justo después de los
  // dígitos, que NUNCA se cumple si vienen pegados a más dígitos (la
  // hora, "40117:58") o a letras (el día, "402LMXJVSD") — ambas son
  // \w, así que no hay frontera entre ellas. Ahora: si justo después
  // viene una hora HH:MM completa, el turno se corta ahí (esos
  // dígitos son la hora, no el turno); si no, basta con que NO sigan
  // más dígitos (si siguen letras, no hay problema).
  const anchorRe = /^\s*(\d{3,4})(?:(?=\d{2}:\d{2})|(?!\d))(?!\/)/;
  function findTurnoInSpan(lo, hi){
    for(let i=lo;i<hi;i++){
      const m = anchorRe.exec(lines[i]);
      if(m) return m[1];
    }
    return null;
  }
  function findDaycodeInSpan(lo, hi){
    for(let i=lo;i<hi;i++){
      const l = lines[i];
      const stripped = l.trim();
      if(!stripped) continue;
      if(/^[LMXJVSD]{1,8}$/.test(stripped)) return stripped;
      let m = /^\s*\d{3,4}\s*([LMXJVSD]{1,8})\b/.exec(l);
      if(m) return m[1];
      m = /^\s*([LMXJVSD]{1,8})\b/.exec(l);
      if(m) return m[1];
    }
    return null;
  }
  function extractTrainsInRange(lo, hi){
    const out = [];
    for(let i=lo;i<hi;i++){
      let l = lines[i];
      // FIX — mismo criterio que anchorRe, para borrar bien el
      // número de turno del principio de la línea incluso cuando
      // viene pegado a la hora que sigue.
      l = l.replace(/^(\s*)(\d{3,4})(?:(?=\d{2}:\d{2})|(?!\d))/, (m0,g1,g2)=> g1 + ' '.repeat(g2.length));
      const used = [];
      const overlaps = (s,e) => used.some(([us,ue]) => !(e<=us || s>=ue));
      const times = [...l.matchAll(/\d{2}:\d{2}/g)].map(m=>m[0]);
      const hora = times.length ? times[0] : null;
      // FIX — una hora puede quedar pegada SIN espacio al número de
      // tren que la sigue ("22:3510174" = hora 22:35 + tren 10174),
      // formando un único bloque de dígitos donde ya no se distingue
      // dónde acaba una cosa y empieza la otra. Se "tapan" con
      // espacios todas las horas reconocidas ANTES de buscar números
      // de tren, para que el tren quede aislado y sí se reconozca.
      let lSinHoras = l.replace(/\d{2}:\d{2}/g, (m0)=> ' '.repeat(m0.length));
      for(const [re, kind] of [
        // FIX — se quita el límite de palabra ANTES de la etiqueta
        // (AUX/UND MULT/V): también puede venir pegada a la hora
        // anterior ("22:35AUX10174"), y detrás basta con 0+ espacios.
        [/AUX\s*(\d{3,6})\b/g, 'AUX'],
        [/UND\s*M[UÚ]LT\s*(\d{3,6})\b/g, 'UNDMULT'],
        [/(?<![A-Za-z])V(\d{5,6})\b/g, 'V'],
      ]){
        for(const m of l.matchAll(re)){
          out.push({line:i, train_raw: m[1], kind, hora});
          used.push([m.index, m.index+m[0].length]);
        }
      }
      // FIX — antes exigía que ni antes ni después del número hubiera
      // NINGUNA letra (además de ningún dígito), pero un número de
      // tren puede venir pegado a un código de dos letras sin espacio
      // ("ME10177"). Ahora solo se evita partir un número más largo
      // (no pegarse a otro dígito) — pegarse a una letra ya no lo
      // descarta.
      for(const m of lSinHoras.matchAll(/(?<!\d)(\d{4,6})(?!\d)/g)){
        if(overlaps(m.index, m.index+m[0].length)) continue;
        if(['2024','2025','2026'].includes(m[1])) continue;
        out.push({line:i, train_raw: m[1], kind:'NORMAL', hora});
      }
    }
    return out;
  }
  // NUEVO — Concreción horaria / Jornada reducida: algunos turnos
  // llevan, pegada al final de su bloque, una línea con el nombre de
  // la persona concreta que lo hace ("*TURNO NATALIA Y NAIMA -
  // CONCRECIÓN HORARIA*", "*TURNO RICARDO - JORNADA REDUCIDA*"). Esa
  // persona muchas veces NO tiene ese número de turno en el Informe
  // (es un arreglo puntual), así que el cruce normal por número de
  // turno no la encuentra. Aquí solo se EXTRAE el texto — no se toca
  // en nada la lógica de trenes/daycode de arriba. Se descartan avisos
  // que no son de este tipo (p.ej. "*MATERIAL VACÍO...*", "*VALENCIA*",
  // "*INCIDENCIA DE MAÑANA*") porque no llevan "TURNO ... - CONCRECIÓN
  // HORARIA/JORNADA REDUCIDA".
  const concrecionAnnotationRe = /\*\s*TURNO\s+([^*]+?)\s*-\s*(CONCRECI[ÓO]N\s+HORARIA|JORNADA\s+REDUCIDA)\s*\*/i;
  function extractConcrecionInRange(lo, hi){
    const out = [];
    for(let i=lo;i<hi;i++){
      const m = concrecionAnnotationRe.exec(lines[i]);
      if(!m) continue;
      const nombresRaw = m[1].trim();
      const tipo = /CONCRECI/i.test(m[2]) ? 'CONCRECION_HORARIA' : 'JORNADA_REDUCIDA';
      const nombres = nombresRaw.split(/\s+Y\s+|\s*\/\s*|,\s*/i).map(s=>s.trim()).filter(Boolean);
      if(nombres.length) out.push({nombres, tipo, texto: m[0]});
    }
    return out;
  }
  const concrecionMap = {};

  const groups = [];
  let pending = [];
  let pendingAnchor = null;
  let covered = new Set();
  function isFullNow(){
    return covered.size === FULL.size && [...FULL].every(ch => covered.has(ch));
  }
  function flush(){
    if(pending.length){
      const recs = [];
      for(const [slo,shi] of pending){
        recs.push(...extractTrainsInRange(slo, shi));
      }
      groups.push({turno: pendingAnchor, records: recs});
      if(pendingAnchor){
        const anns = [];
        for(const [slo,shi] of pending) anns.push(...extractConcrecionInRange(slo, shi));
        if(anns.length){
          if(!concrecionMap[pendingAnchor]) concrecionMap[pendingAnchor] = [];
          concrecionMap[pendingAnchor].push(...anns);
        }
      }
    }
    pending = [];
    pendingAnchor = null;
    covered = new Set();
  }
  for(const [slo, shi] of spans){
    const spanAnchor = findTurnoInSpan(slo, shi);
    const spanDaycode = findDaycodeInSpan(slo, shi);
    if(pendingAnchor !== null && isFullNow()) flush();
    if(pendingAnchor !== null && spanAnchor !== null && spanAnchor !== pendingAnchor) flush();
    pending.push([slo, shi]);
    if(spanDaycode) for(const ch of spanDaycode) covered.add(ch);
    if(pendingAnchor === null && spanAnchor !== null) pendingAnchor = spanAnchor;
  }
  if(pending.length) flush();

  const allRecords = [];
  for(const g of groups){
    for(const r of g.records) allRecords.push({...r, turno: g.turno, daycode: null});
  }
  const dayMarkerLines = [];
  for(let i=0;i<n;i++){
    const stripped = lines[i].trim();
    if(!stripped) continue;
    if(/^[LMXJVSD]{1,8}$/.test(stripped)){ dayMarkerLines.push([i, stripped]); continue; }
    let m = /^\s*\d{3,4}\s*([LMXJVSD]{1,8})\b/.exec(lines[i]);
    if(m){ dayMarkerLines.push([i, m[1]]); continue; }
    m = /^\s*([LMXJVSD]{1,8})\b/.exec(lines[i]);
    if(m) dayMarkerLines.push([i, m[1]]);
  }
  function nearestDaycode(lineIdx){
    let best = null, bestDist = Infinity;
    for(const [li, dc] of dayMarkerLines){
      const d = Math.abs(li - lineIdx);
      if(d < bestDist){ bestDist = d; best = dc; }
    }
    return best;
  }
  for(const r of allRecords) r.daycode = nearestDaycode(r.line);
  allRecords.sort((a,b)=>a.line-b.line);
  const anchorLines = [];
  for(let i=0;i<n;i++){ if(anchorRe.test(lines[i])) anchorLines.push(i); }
  const origTurno = allRecords.map(r=>r.turno);
  const origDay = allRecords.map(r=>r.daycode);
  for(let i=1;i<allRecords.length;i++){
    const prev = allRecords[i-1], cur = allRecords[i];
    const gap = cur.line - prev.line;
    if(gap <= 2){
      const anchorsBetween = anchorLines.filter(a => a > prev.line && a <= cur.line);
      if(anchorsBetween.length === 0){
        if(cur.turno !== origTurno[i-1]) cur.turno = origTurno[i-1];
        if(cur.daycode !== origDay[i-1]) cur.daycode = origDay[i-1];
      }
    }
  }
  const byTurno = {};
  for(const r of allRecords){
    if(!r.turno) continue;
    const trainNorm = r.train_raw.replace(/^0+(?=\d)/,'');
    if(!byTurno[r.turno]) byTurno[r.turno] = [];
    const item = {train: trainNorm, train_raw: r.train_raw, kind: r.kind, daycode: r.daycode, hora: r.hora};
    const dupKey = JSON.stringify(item);
    if(!byTurno[r.turno].some(x=>JSON.stringify(x)===dupKey)) byTurno[r.turno].push(item);
  }
  // NUEVO — concrecionMap se cuelga como propiedad NO enumerable, para
  // que Object.keys(byTurno)/for-in (usados en varios sitios para
  // contar "turnos con tren") sigan viendo exactamente los mismos
  // turnos de siempre, sin este dato extra mezclado entre ellos.
  try{
    Object.defineProperty(byTurno, '__concrecionHoraria', { value: concrecionMap, enumerable: false, configurable: true });
  }catch(e){ /* si por lo que sea falla, simplemente no habrá avisos de concreción — el resto sigue igual */ }
  return byTurno;
}

// ── datos + persistencia de los servicios de Interventor (independiente de BASES) ──
let INTERVENTOR_SERVICES = [];
const INTERVENTOR_STORAGE_KEY = 'appTurnoInterventorServicios';
function atGuardarInterventor(){
  try{ localStorage.setItem(INTERVENTOR_STORAGE_KEY, JSON.stringify(INTERVENTOR_SERVICES)); }
  catch(e){ console.warn('No se pudieron guardar los servicios de interventor.', e); }
}
function atCargarInterventor(){
  try{
    const raw = localStorage.getItem(INTERVENTOR_STORAGE_KEY);
    if(!raw) return;
    const saved = JSON.parse(raw);
    if(Array.isArray(saved)) INTERVENTOR_SERVICES = saved;
  }catch(e){ console.warn('No se pudieron leer los servicios de interventor guardados.', e); }
}
atCargarInterventor();

function refreshInterventorCard(){
  const n = INTERVENTOR_SERVICES.length;
  document.getElementById('meta-interventor').textContent = n
    ? `${n} servicio(s) cargado(s)`
    : 'Aún sin PDFs cargados';
  document.getElementById('badge-interventor').textContent = n ? 'LISTO' : 'SUBIR PDFs';
  document.getElementById('badge-interventor').className = 'base-badge ' + (n ? 'badge-ok' : 'badge-pend');
  document.getElementById('del-interventor').style.display = n ? 'flex' : 'none';
  renderInterventorServiceList();
}
function renderInterventorServiceList(){
  const el = document.getElementById('interventorServiceList');
  if(!el) return;
  el.innerHTML = '';
  INTERVENTOR_SERVICES.forEach((s, idx) => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:var(--s2);border:1px solid var(--div);border-radius:9px;padding:8px 11px;margin-bottom:6px;font-size:12px';
    div.innerHTML = `<span>${s.name} <span style="color:var(--tx3)">(${Object.keys(s.turnos||{}).length} turnos)</span></span>
      <button class="ubtn ubtn-cancel" style="padding:4px 10px;font-size:11px" data-idx="${idx}">Quitar</button>`;
    div.querySelector('button').addEventListener('click', () => {
      INTERVENTOR_SERVICES.splice(idx, 1);
      atGuardarInterventor();
      refreshInterventorCard();
    });
    el.appendChild(div);
  });
}
refreshInterventorCard();

document.getElementById('del-interventor').addEventListener('click', (e)=>{
  e.stopPropagation();
  const ok = confirm('¿Eliminar TODOS los servicios de Interventor cargados? Tendrás que volver a subir los PDFs.');
  if(!ok) return;
  INTERVENTOR_SERVICES = [];
  atGuardarInterventor();
  refreshInterventorCard();
});
document.getElementById('card-interventor').addEventListener('click', ()=>{
  toggleForm('form-interventor');
});
document.getElementById('cancel-interventor').addEventListener('click', ()=>{
  document.getElementById('form-interventor').classList.remove('on');
});
document.getElementById('filepick-interventor-grafico').addEventListener('click', ()=> document.getElementById('file-interventor-grafico').click());
document.getElementById('filepick-interventor-informe').addEventListener('click', ()=> document.getElementById('file-interventor-informe').click());

let interventorStartDateISO = '';
function iniciarCalendarioInterventor(){
  generarCalendarioUI('calInterventorInicio', (fecha)=>{
    interventorStartDateISO = fecha.getFullYear() + '-' + String(fecha.getMonth()+1).padStart(2,'0') + '-' + String(fecha.getDate()).padStart(2,'0');
    checkInterventorFormReady();
  });
}

function checkInterventorFormReady(){
  const reusar = document.getElementById('reuseGraficoCheck').checked && ultimoGraficoTurnos;
  const f1 = reusar ? true : document.getElementById('file-interventor-grafico').files[0];
  const f2 = document.getElementById('file-interventor-informe').files[0];
  document.getElementById('go-interventor').disabled = !(interventorStartDateISO && f1 && f2);
}
document.getElementById('file-interventor-grafico').addEventListener('change', (e)=>{
  const f = e.target.files[0];
  document.getElementById('fpname-interventor-grafico').textContent = f ? f.name : '';
  checkInterventorFormReady();
});
document.getElementById('file-interventor-informe').addEventListener('change', (e)=>{
  const f = e.target.files[0];
  document.getElementById('fpname-interventor-informe').textContent = f ? f.name : '';
  checkInterventorFormReady();
});
document.getElementById('reuseGraficoCheck').addEventListener('change', (e)=>{
  const on = e.target.checked;
  document.getElementById('filepick-interventor-grafico').style.display = on ? 'none' : 'flex';
  checkInterventorFormReady();
});

function construirDiasDesdeCruce(agentsData, turnosData){
  const DOW_LETTER_B = ['D','L','M','X','J','V','S'];
  const out = [];
  for(const agent of agentsData.agents){
    const dias = {};
    agent.valores.forEach((turno, i) => {
      const iso = (agentsData.isoDates||[])[i];
      if(!iso) return;
      const dt = new Date(iso+'T00:00:00');
      const dow = DOW_LETTER_B[dt.getDay()];
      const legs = (turnosData[turno]||[]).filter(l => {
        const dc = l.daycode||'';
        return dc === '' || dc.includes(dow);
      });
      if(legs.length){
        dias[iso] = legs.map(l=>l.train_raw).join(' ');
      }
    });
    out.push([agent.matricula, agent.nombre, dias]);
  }
  return out;
}

// ── Caché del último Gráfico de Intervención procesado — el gráfico apenas
//    cambia (dura semanas), pero el Informe/Servicio Previsto se renueva
//    cada 10 días más o menos. Así no hay que volver a subir el gráfico
//    cada vez, solo el informe nuevo. ──
let ultimoGraficoTurnos = null;
let ultimoGraficoNombrePdf = '';
function actualizarAvisoReusarGrafico(){
  const label = document.getElementById('reuseGraficoLabel');
  if(ultimoGraficoTurnos){
    label.style.display = 'flex';
    document.getElementById('reuseGraficoNombre').textContent = ultimoGraficoNombrePdf;
  } else {
    label.style.display = 'none';
  }
}

document.getElementById('go-interventor').addEventListener('click', async ()=>{
  const name = document.getElementById('name-interventor').value.trim() || 'Interventor';
  const reusar = document.getElementById('reuseGraficoCheck').checked && ultimoGraficoTurnos;
  const graficoFile = document.getElementById('file-interventor-grafico').files[0];
  const informeFile = document.getElementById('file-interventor-informe').files[0];
  if(!(reusar || graficoFile) || !informeFile || !interventorStartDateISO) return;

  showPanel('panel-progress');
  const progressTxt = document.getElementById('progressTxt');
  const progressBar = document.getElementById('progressBar');
  const progressErr = document.getElementById('progressErr');
  progressErr.style.display = 'none';
  progressBar.style.width = '4%';
  try{
    let turnosData;
    if(reusar){
      progressTxt.textContent = 'Reutilizando el gráfico de la última vez…';
      turnosData = ultimoGraficoTurnos;
      progressBar.style.width = '35%';
    } else {
      progressTxt.textContent = 'Leyendo gráfico de intervención…';
      const graficoBuf = await graficoFile.arrayBuffer();
      const graficoLines = await pdfToLines(pdfjsLib, new Uint8Array(graficoBuf));
      progressBar.style.width = '35%';
      turnosData = parseGraficoTurnos(graficoLines);
      ultimoGraficoTurnos = turnosData;
      ultimoGraficoNombrePdf = graficoFile.name;
    }

    progressTxt.textContent = 'Leyendo informe de agentes…';
    const informeBuf = await informeFile.arrayBuffer();
    const informeLines = await pdfToLines(pdfjsLib, new Uint8Array(informeBuf));
    progressBar.style.width = '70%';
    const agentsData = parseAgentsTable(informeLines, interventorStartDateISO);

    if(!agentsData) throw new Error('No pude encontrar la tabla de fechas en el informe. ¿Es el PDF correcto?');
    if(Object.keys(turnosData).length === 0) throw new Error('No encontré turnos con tren en el gráfico. ¿Es el PDF correcto?');

    const diasPorAgente = construirDiasDesdeCruce(agentsData, turnosData);

    INTERVENTOR_SERVICES.push({ name, isoDates: agentsData.isoDates, data: diasPorAgente, turnos: turnosData });
    atGuardarInterventor();
    actualizarAvisoReusarGrafico();

    progressTxt.textContent = `¡Listo! ${diasPorAgente.length} agentes cruzados en «${name}».`;
    progressBar.style.width = '100%';
    setTimeout(()=>{
      document.getElementById('form-interventor').classList.remove('on');
      document.getElementById('reuseGraficoCheck').checked = false;
      document.getElementById('filepick-interventor-grafico').style.display = 'flex';
      refreshInterventorCard();
      showPanel('panel-select');
    }, 550);
  }catch(err){
    console.error(err);
    progressTxt.textContent = 'No se pudo procesar los PDF.';
    progressErr.style.display = 'block';
    progressErr.textContent = (err && err.message) ? err.message : String(err);
    setTimeout(()=> showPanel('panel-select'), 2600);
  }
});

function showPanel(id){

  document.querySelectorAll('.at-panel').forEach(p=>p.classList.remove('on'));
  document.getElementById(id).classList.add('on');
}

// ═══ NAVEGACIÓN: SELECTOR ═══
document.getElementById('card-barcelona').addEventListener('click', ()=>{
  if(BASES.barcelona.data){ activateBase('barcelona'); return; }
  toggleForm('form-barcelona');
});
document.getElementById('card-madrid').addEventListener('click', ()=>{
  if(BASES.madrid.data){ activateBase('madrid'); return; }
  toggleForm('form-madrid');
});
document.getElementById('card-new').addEventListener('click', ()=>{
  toggleForm('form-new');
});
function toggleForm(id){
  document.querySelectorAll('.upload-form').forEach(f=>{ if(f.id!==id) f.classList.remove('on'); });
  document.getElementById(id).classList.toggle('on');
}
document.getElementById('cancel-madrid').addEventListener('click', ()=> document.getElementById('form-madrid').classList.remove('on'));
document.getElementById('cancel-barcelona').addEventListener('click', ()=> document.getElementById('form-barcelona').classList.remove('on'));
document.getElementById('cancel-new').addEventListener('click', ()=> document.getElementById('form-new').classList.remove('on'));

// ── Selector de archivo: Barcelona ──
document.getElementById('filepick-barcelona').addEventListener('click', ()=> document.getElementById('file-barcelona').click());
document.getElementById('file-barcelona').addEventListener('change', (e)=>{
  const f = e.target.files[0];
  document.getElementById('fpname-barcelona').textContent = f ? f.name : '';
  document.getElementById('go-barcelona').disabled = !f;
});
document.getElementById('go-barcelona').addEventListener('click', async ()=>{
  const f = document.getElementById('file-barcelona').files[0];
  if(!f) return;
  await procesarPdfParaBase('barcelona', 'Barcelona', f);
});

// ── Selector de archivo: Madrid ──
document.getElementById('filepick-madrid').addEventListener('click', ()=> document.getElementById('file-madrid').click());
document.getElementById('file-madrid').addEventListener('change', (e)=>{
  const f = e.target.files[0];
  document.getElementById('fpname-madrid').textContent = f ? f.name : '';
  document.getElementById('go-madrid').disabled = !f;
});
document.getElementById('go-madrid').addEventListener('click', async ()=>{
  const f = document.getElementById('file-madrid').files[0];
  if(!f) return;
  await procesarPdfParaBase('madrid', 'Madrid', f);
});

// ── Selector de archivo: base nueva ──
document.getElementById('filepick-new').addEventListener('click', ()=> document.getElementById('file-new').click());
document.getElementById('file-new').addEventListener('change', (e)=>{
  const f = e.target.files[0];
  document.getElementById('fpname-new').textContent = f ? f.name : '';
  checkNewFormReady();
});
document.getElementById('name-new').addEventListener('input', checkNewFormReady);
function checkNewFormReady(){
  const name = document.getElementById('name-new').value.trim();
  const f = document.getElementById('file-new').files[0];
  document.getElementById('go-new').disabled = !(name && f);
}
document.getElementById('go-new').addEventListener('click', async ()=>{
  const name = document.getElementById('name-new').value.trim();
  const f = document.getElementById('file-new').files[0];
  if(!name || !f) return;
  const key = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]+/g,'_');
  BASES[key] = { label: name, month: '—', data: null };
  await procesarPdfParaBase(key, name, f);
});

function activateBase(key){
  activeBaseKey = key;
  activeBase = BASES[key];
  document.getElementById('hdrTitulo').textContent = activeBase.label;
  document.getElementById('hdrPill').textContent = '📍 ' + (activeBase.month || 'BASE ACTIVA');
  document.getElementById('hdrBtns').innerHTML = '<button class="at-hbtn" id="switchBaseBtn" title="Cambiar de base">⇄</button>';
  document.getElementById('switchBaseBtn').addEventListener('click', ()=>{
    activeBaseKey = null; activeBase = null;
    qInput.value=''; clearBtn.style.display='none';
    document.getElementById('hdrTitulo').textContent = 'App Turno';
    document.getElementById('hdrPill').textContent = '🔍 SELECCIONA UNA BASE';
    document.getElementById('hdrBtns').innerHTML = '';
    refreshBaseCards();
    showPanel('panel-select');
  });
  qInput.value = '';
  renderEmptyHint();
  // FIX — Confirmado por Alex: activateBase() se llama también en
  // segundo plano (tras comprobar si hay algo nuevo publicado), no
  // solo al entrar en la pestaña. Antes, esto forzaba SIEMPRE la
  // vuelta al selector de tarjetas, deshaciendo la navegación si la
  // persona ya había tocado "Por nombre" o "Por tren" justo antes de
  // que la comprobación en segundo plano terminase — daba la
  // sensación de que el botón "no hacía nada". Ahora solo vuelve al
  // selector si esta es la PRIMERA vez que se activa la base en esta
  // pestaña (no hay ninguna pantalla de detalle abierta todavía).
  var yaHayDetalleAbierto = (function(){
    var dn = document.getElementById('comp-detalle-nombre');
    var dt = document.getElementById('comp-detalle-tren');
    return (dn && dn.style.display !== 'none') || (dt && dt.style.display !== 'none');
  })();
  if(!yaHayDetalleAbierto && typeof mostrarSelectorCompaneros==='function') mostrarSelectorCompaneros();
  // NUEVO — Confirmado por Alex: refresca el selector de mes cada vez
  // que se (re)activa la base, esté o no abierto el selector de
  // tarjetas — así el chip marcado como "elegido" siempre refleja el
  // mes que de verdad está cargado en BASES.global.mesAnio.
  if(typeof hgPintarSelectorMes==='function') hgPintarSelectorMes();
  document.getElementById('trainView').innerHTML = '';
  document.getElementById('trTrainInput').value = '';
  fecha_seleccionada_busqueda = null;
  selectedTrainDay = null;
  showPanel('panel-app');
}

// ═══ PROCESADO DE PDF (cliente, pdf.js) ═══
// NUEVO — Núcleo de parseo de PDF, extraído de procesarPdfParaBase()
// para poder reutilizarlo también con el Horario General descargado
// desde el Panel de Admin. Mismo código exacto, solo separado del
// manejo de la barra de progreso para que sea reutilizable.
// NUEVO — lee el mes/año real desde la cabecera de la página 1 del
// PDF (ej. "AGOSTO 2026", siempre arriba del todo, antes de la fila
// de días). Con esto ya no hace falta ni fijar el mes a mano ni
// renunciar a comprobarlo — se lee del propio documento.
const MESES_PDF_NUM = {ENERO:0,FEBRERO:1,MARZO:2,ABRIL:3,MAYO:4,JUNIO:5,JULIO:6,AGOSTO:7,SEPTIEMBRE:8,OCTUBRE:9,NOVIEMBRE:10,DICIEMBRE:11};
function extraerMesAnioPDF(rawWordsPagina1){
  const cabecera = rawWordsPagina1.filter(w => w.top < 45);
  const mesWord = cabecera.find(w => MESES_PDF_NUM.hasOwnProperty(w.text.toUpperCase()));
  const anioWord = cabecera.find(w => /^20[0-9]{2}$/.test(w.text));
  if(mesWord && anioWord) return { mes: MESES_PDF_NUM[mesWord.text.toUpperCase()], anio: parseInt(anioWord.text,10) };
  return null;
}

async function parsearBufferPdfHorario(buf, onProgress){
  await asegurarPdfWorkerSeguro();
  const pdf = await pdfjsLib.getDocument({data: buf}).promise;
  const numPages = pdf.numPages;
  const empleados = [];
  var paginasConError = [];
  var mesAnioDetectado = null;
  // FIX — el bloque de un empleado puede quedar cortado justo entre
  // dos páginas (turno/ID/nombre en una, "Horas.../Jor." con los
  // números en la siguiente). 'leftover' guarda ese trozo suelto de
  // la página anterior para fusionarlo con la siguiente en vez de
  // perderlo — antes ese compañero desaparecía sin más del Buscador.
  let leftover = [];
  for(let pi=1; pi<=numPages; pi++){
    if(onProgress) onProgress(pi, numPages);
    // FIX — antes, si UNA sola página (de las 59 que puede tener este
    // PDF) fallaba al leerla (página dañada, contenido inesperado,
    // etc.), la excepción tiraba TODO el bucle abajo y se perdían los
    // empleados ya reconocidos en las páginas anteriores — el archivo
    // entero se daba por "no reconocido" aunque la inmensa mayoría
    // estuviera perfectamente bien. Ahora cada página es independiente:
    // si una falla, se anota y se sigue con la siguiente.
    try{
      const page = await pdf.getPage(pi);
      const viewport = page.getViewport({scale:1});
      const pageHeight = viewport.height;
      const content = await page.getTextContent();
      const words = [];
      for(const item of content.items){
        const str = (item.str||'').trim();
        if(!str) continue;
        const x0 = item.transform[4];
        const top = pageHeight - item.transform[5];
        const parts = str.split(/\s+/).filter(Boolean);
        if(parts.length<=1){
          words.push({text: str, x0, top, pagina: pi});
        } else {
          const w = item.width || 0;
          parts.forEach((p, idx)=>{
            words.push({text: p, x0: x0 + (w*idx/parts.length), top, pagina: pi});
          });
        }
      }
      if(pi===1) mesAnioDetectado = extraerMesAnioPDF(words);
      const parsed = parsePageWords(words, leftover, pi);
      leftover = parsed.leftover || [];
      empleados.push(...parsed);
    }catch(errPagina){
      paginasConError.push(pi);
      console.log('Cómputo/Horario: no se pudo leer la página '+pi+' de '+numPages+', se continúa con el resto.', errPagina);
      leftover = []; // la página falló entera: no hay nada fiable que arrastrar
    }
    await new Promise(r=>setTimeout(r, 0)); // deja respirar a la UI
  }
  if(paginasConError.length){
    console.log('Horario General: '+paginasConError.length+' página(s) no se pudieron leer: '+paginasConError.join(', ')+'. El resto del documento se procesó con normalidad.');
  }
  empleados.mesAnio = mesAnioDetectado;
  return empleados;
}
// FIX — mismo motivo que parseHorarioGeneralCSV/XLSX: subirArchivoGlobalAdmin()
// vive fuera de este IIFE y necesita poder llamarla para la validación
// de contenido antes de publicar.
window.parsearBufferPdfHorario = parsearBufferPdfHorario;

async function procesarPdfParaBase(key, label, file){
  showPanel('panel-progress');
  const progressTxt = document.getElementById('progressTxt');
  const progressBar = document.getElementById('progressBar');
  const progressErr = document.getElementById('progressErr');
  progressErr.style.display = 'none';
  progressTxt.textContent = 'Abriendo PDF de ' + label + '…';
  progressBar.style.width = '4%';
  try{
    const buf = await file.arrayBuffer();
    const empleados = await parsearBufferPdfHorario(buf, function(pi, numPages){
      progressTxt.textContent = `Procesando página ${pi} de ${numPages}…`;
      progressBar.style.width = Math.round((pi/numPages)*100) + '%';
    });
    if(empleados.length === 0){
      throw new Error('No se detectó ninguna plantilla de turnos reconocible en este PDF.');
    }
    BASES[key].data = empleados;
    atGuardarBases();
    progressTxt.textContent = `¡Listo! ${empleados.length} empleados cargados en ${label}.`;
    progressBar.style.width = '100%';
    refreshBaseCards();
    setTimeout(()=>{
      document.getElementById('form-barcelona').classList.remove('on');
      document.getElementById('form-madrid').classList.remove('on');
      document.getElementById('form-new').classList.remove('on');
      activateBase(key);
    }, 550);
  } catch(err){
    progressTxt.textContent = 'No se pudo procesar el PDF.';
    progressErr.style.display = 'block';
    progressErr.textContent = (err && err.message) ? err.message : String(err);
    setTimeout(()=> showPanel('panel-select'), 2600);
  }
}

// FIX — nombres "sucios" en el Buscador de Compañeros: dos causas
// distintas, cada una con su filtro:
//  1) El pie de página del PDF ("ATENCIÓN: la suma de horas de
//     presencia incluye...") caía dentro de la franja x0<101 y, al
//     ser lo último de la página, se arrastraba como "leftover" al
//     siguiente empleado — colándose delante de su nombre real.
//  2) Algún fragmento de ruta (estación-BSN, ej. "COR-BSN") a veces
//     cae justo en esa misma franja de nombre por cómo el PDF parte
//     las líneas. Los códigos de estación son siempre 2-4 letras a
//     cada lado del guion (BSN, COR, ATO, ZAZ…) — una lista blanca
//     los reconoce y descarta sin arriesgarse a comerse un apellido
//     compuesto real (esos son casi siempre más largos, ej.
//     "PEREZ-HINOJOSA").
const STATION_CODES = new Set(['BSN','ATO','ZAZ','GRA','HSK','FVL','VIG','PAL','CHA','SLM',
  'VLJ','GIJ','MUR','COR','BIL','AGP','SVQ','ALC','CAR','LYO','SSB','VLN','OUR','PAM','VDA',
  'MRS','HUE','LOG','ZAM','UM','DH','TDH']);
function looksLikeStationCode(tok){
  const parts = tok.toUpperCase().split('-').filter(Boolean);
  if(parts.length < 2) return false;
  return parts.every(p => STATION_CODES.has(p));
}
function esTextoDePiePagina(tok){
  // el pie legal siempre va en minúscula/mixta — ninguna sigla real
  // de turno o apellido va nunca así (todo el PDF va en mayúsculas).
  // Se mantiene como red de seguridad extra, pero el filtro principal
  // contra el pie de página es removeFooterLine() (ver más abajo),
  // que quita la línea entera anclada en "ATENCIÓN:" en vez de
  // adivinar palabra por palabra (esa propia palabra ya va en
  // mayúsculas y se escapaba de este filtro).
  return tok !== tok.toUpperCase() && /^[a-zA-ZÁÉÍÓÚÑñ.,:]+$/.test(tok);
}
// FIX — el pie de página legal ("ATENCIÓN: la suma de horas de
// presencia incluye...") se cuela como texto porque, al ser lo
// último de la página, terminaba arrastrándose como "leftover" y
// apareciendo delante del nombre del primer compañero de la página
// siguiente (ej. "la suma de horas ALVARADO ... COR-BSN RODRIGUEZ").
// En vez de adivinar palabra por palabra (la propia palabra
// "ATENCIÓN:" ya va en mayúsculas, así que un filtro por minúsculas
// no la pilla), se busca esa palabra ancla exacta y se elimina TODA
// la línea que comparte su misma altura (top) — así se quita de
// una vez, esté donde esté, antes de que contamine nada más.
function removeFooterLine(words){
  const anchors = words.filter(w => w.text === 'ATENCIÓN:');
  if(anchors.length === 0) return words;
  const footerTops = anchors.map(a => a.top);
  return words.filter(w => !footerTops.some(t => Math.abs(w.top - t) <= 2.5));
}

const SHIFT_WHITELIST = new Set(['DO','F','R','LD','CP','DOP','B','EX','PP','FE','Pr']);
function isShiftCode(text){
  if(text.includes(':') || text.includes(',')) return false;
  if(/^[0-9]/.test(text)) return true;
  if(SHIFT_WHITELIST.has(text)) return true;
  // FIX — un código de turno partido en 2 líneas a veces continúa en
  // la segunda con una letra (ej. "4121T1D" arriba, "H-622" debajo,
  // en el PDF real de Madrid) — antes se rechazaba por no empezar con
  // un número, y esa segunda línea se perdía sin más, dejando el
  // código incompleto ("4121T1D" en vez de "4121T1DH-622"). Ahora se
  // acepta si contiene algún dígito Y no es un fragmento de ruta/
  // estación puro (looksLikeStationCode ya distingue eso, ej.
  // "BSN-ATO" sigue rechazándose correctamente).
  if(/[0-9]/.test(text) && !looksLikeStationCode(text)) return true;
  return false;
}
function getDayColumns(words){
  const cands = words.filter(w => /^[0-9]{1,2}$/.test(w.text) && w.top>=50 && w.top<=65);
  cands.sort((a,b)=>a.x0-b.x0);
  // FIX — Confirmado por Alex (bug real detectado en producción): esto
  // exigía SIEMPRE 31 columnas (día 1 a 31), así que cualquier mes de
  // 28, 29 o 30 días (febrero, abril, junio, septiembre, noviembre)
  // nunca llegaba al umbral y la página se descartaba ENTERA como "no
  // reconocida" — 0 empleados cargados, aunque el PDF fuera
  // perfectamente válido y viniera con su mes completo. Ahora se acepta
  // cualquier cantidad de columnas entre 28 (el mes más corto, febrero)
  // y 31 (el más largo) — las que de verdad tenga ese mes concreto. Se
  // mantiene el tope de 31 al final (por si se colara algún número
  // suelto de más en esa franja) igual que antes.
  if(cands.length>=28) return cands.slice(0, Math.min(cands.length,31)).map(w=>w.x0);
  return null;
}
// FIX — cuando dos o más días SEGUIDOS tienen exactamente el mismo
// código de turno, el PDF los pega sin espacio (pdf.js los da como
// una única palabra, ej. "3162DH-3162DH-3162DH-" para 3 días con el
// mismo turno). Sin esto, ese código entero se le asignaba solo al
// primero de esos días y los siguientes se quedaban vacíos. Si
// 'text' es una unidad que se repite N veces de forma exacta,
// devuelve {unit, n}; si no se repite, {unit:text, n:1}.
function splitRepeatedTurnoCode(text){
  const L = text.length;
  for(let unitLen=3; unitLen<=Math.floor(L/2); unitLen++){
    if(L % unitLen !== 0) continue;
    const unit = text.slice(0, unitLen);
    const n = L / unitLen;
    if(unit.repeat(n) === text && n>=2) return {unit:unit, n:n};
  }
  return {unit:text, n:1};
}
// Busca en 'bwords' la fila de un subtotal ("Totales"/"EF"/"PR"/
// "Prorr.") por su segunda palabra de etiqueta (x0<25, única por
// fila) y devuelve el primer valor numérico (hh:mm o NN,NN) que
// aparece en esa misma línea, antes de la zona de días.
// NUEVO — divide un "blob" de ruta fusionado (varios días pegados sin
// espacio, ej. "BSN-CARCAR-BSNBSN-SVQ") en sus tramos "origen-destino"
// individuales, usando los códigos de estación conocidos. Igual que
// splitRepeatedTurnoCode pero para la fila de ruta — probado contra
// el PDF real (funciona bien, con el mismo margen de imprecisión ya
// conocido en los empalmes entre días, siempre en modo orientativo).
function splitRouteBlob(text){
  var out = [];
  var rest = text;
  var guard = 0;
  while(rest.length > 0 && guard < 20){
    guard++;
    var matched = false;
    for(var nCodes = 5; nCodes >= 2 && !matched; nCodes--){
      var re = new RegExp('^((?:[A-Z]{2,4}-){' + (nCodes-1) + '}[A-Z]{2,4})');
      var m = rest.match(re);
      if(m){
        var partes = m[1].split('-');
        if(partes.every(function(p){ return STATION_CODES.has(p); })){
          out.push(m[1]);
          rest = rest.slice(m[1].length);
          matched = true;
        }
      }
    }
    if(!matched) break;
  }
  if(rest.length>0) out.push(rest);
  return out;
}

function extractSummaryValue(bwords, subLabel){
  const anchor = bwords.find(w => w.x0<25 && w.text===subLabel);
  if(!anchor) return '';
  const rowWords = bwords.filter(w => Math.abs(w.top-anchor.top)<=2.5 && w.x0<100);
  const val = rowWords.find(w => /^[0-9]+[:,][0-9]+$/.test(w.text));
  return val ? val.text : '';
}
// FIX — un bloque de empleado puede quedar cortado justo en el
// límite entre dos páginas (turno/ID/nombre en la página N, y las
// líneas "Horas.../Jor." con los números en la N+1). Antes, ese
// trozo suelto se descartaba entero y ese compañero desaparecía del
// Buscador. Ahora parsePageWords() acepta el sobrante de la página
// anterior (leftoverIn, ya con el 'top' desplazado muy al negativo
// para que siempre quede ANTES que el contenido de la página
// actual al ordenar) y devuelve también su propio sobrante final
// (array.leftover) para que la llamada siguiente lo encadene.
// 'pageNum' solo se usa para anotar en qué página del PDF apareció
// cada empleado (útil para localizarlo en el documento original).
function parsePageWords(rawWords, leftoverIn, pageNum){
  const daycols = getDayColumns(rawWords);
  const pageWords = rawWords.filter(w=>w.top>60);
  const words = removeFooterLine((leftoverIn||[]).concat(pageWords));
  if(!daycols){
    const out = [];
    out.leftover = words;
    return out;
  }
  const jorTops = words.filter(w=>w.text==='Jor.' && w.x0<25).map(w=>w.top).sort((a,b)=>a-b);
  if(jorTops.length===0){
    const out = [];
    out.leftover = words;
    return out;
  }
  const blockRanges = [];
  let start = -1e9;
  for(const t of jorTops){ blockRanges.push([start, t+1]); start = t+1; }
  const out = [];
  // ancho medio de columna, usado para repartir un código repetido
  // entre varios días consecutivos manteniendo el orden de lectura.
  let colWidth = 23;
  if(daycols.length>1){
    let sum=0; for(let i=1;i<daycols.length;i++) sum += (daycols[i]-daycols[i-1]);
    colWidth = sum/(daycols.length-1);
  }
  for(const [btop, etop] of blockRanges){
    const bwords = words.filter(w => w.top>=btop && w.top<=etop);
    if(bwords.length===0) continue;
    const idWords = bwords.filter(w => w.x0<25 && /^[0-9]{3,8}$/.test(w.text));
    const empId = idWords.length ? idWords[0].text : '';
    const horasWords = bwords.filter(w => w.x0<25 && w.text==='Horas');
    const nameLimitTop = horasWords.length ? Math.min(...horasWords.map(w=>w.top)) : etop;
    // FIX — Confirmado por Alex (bug real, detectado en producción):
    // en algún empleado (ej. un nombre largo que ocupa varias líneas),
    // la palabra "Horas" no se localizaba bien y nameLimitTop se caía
    // hasta el final de todo el bloque — eso dejaba que valores de
    // horas ("177:28") y etiquetas del resumen (F, EF, PR, CI, CO...)
    // se colaran como si fueran parte del nombre ("VILLARROEL ORTA
    // ,CARLOS ENRIQUE 177:28 F EF 158:46 CI"). Ninguno de estos
    // patrones es nunca un nombre real, así que se excluyen siempre,
    // pase lo que pase con nameLimitTop — no depende de que la
    // detección de "Horas" salga bien.
    const ETIQUETAS_RESUMEN_NO_NOMBRE = new Set(['F','EF','PR','CI','CO','Totales','Prorr.','Jor.','Horas']);
    // FIX — Confirmado por Alex (mismo bug, caso adicional): el
    // primer arreglo solo excluía valores con dos puntos ("177:28"),
    // pero el mismo tipo de dato (un total de horas) también aparece
    // con coma ("81,50") — es el mismo patrón que ya usa
    // extractSummaryValue() más abajo para reconocer estos valores,
    // así que se reutiliza aquí para cubrir los dos formatos.
    const esValorDeHoras = (tok) => /^[0-9]+[:,][0-9]+$/.test(tok);
    const nameWords = bwords.filter(w =>
      w.x0>=20 && w.x0<101 && w.top<nameLimitTop && w.text!==empId
      && !looksLikeStationCode(w.text) && !esTextoDePiePagina(w.text)
      && !esValorDeHoras(w.text) && !ETIQUETAS_RESUMEN_NO_NOMBRE.has(w.text)
    );
    nameWords.sort((a,b)=> a.top-b.top || a.x0-b.x0);
    const name = nameWords.map(w=>w.text).join(' ').trim();
    if(!name) continue;
    const codeWords = bwords.filter(w => w.x0>=100 && isShiftCode(w.text));
    const dayData = {};
    for(const w of codeWords){
      let bestIdx = 0, bestDiff = Infinity;
      daycols.forEach((cx, idx)=>{ const d = Math.abs(w.x0-cx); if(d<bestDiff){bestDiff=d; bestIdx=idx;} });
      const {unit, n} = splitRepeatedTurnoCode(w.text);
      if(n===1){
        const day = bestIdx+1;
        (dayData[day] = dayData[day] || []).push([w.top, w.x0, w.text]);
      } else {
        // el mismo código se repite en 'n' días seguidos a partir de
        // bestIdx — se reparte una copia por cada columna de día.
        for(let k=0; k<n; k++){
          const idx = bestIdx + k;
          if(idx >= daycols.length) break;
          const day = idx+1;
          (dayData[day] = dayData[day] || []).push([w.top, w.x0 + k*colWidth, unit]);
        }
      }
    }
    const daysFinal = {};
    for(const day in dayData){
      // orden de lectura real: primero de arriba a abajo (top, para
      // reconstruir códigos partidos en 2-3 líneas), y solo dentro
      // de la misma línea, de izquierda a derecha (x0).
      const items = dayData[day].sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
      daysFinal[day] = items.map(x=>x[2]).join('');
    }

    // NUEVO — hora de toma (CI) y hora de deje (CO) por día, y ruta
    // (estación origen-destino) por día — para el Sistema Horario
    // Compañero, en modo orientativo. Reutiliza el mismo reparto por
    // columna de día que ya usan los códigos de turno de arriba.
    const nearestDay = (x0) => {
      let bestIdx = 0, bestDiff = Infinity;
      daycols.forEach((cx, idx)=>{ const d = Math.abs(x0-cx); if(d<bestDiff){bestDiff=d; bestIdx=idx;} });
      return bestIdx+1;
    };
    const ciAnchor = bwords.find(w => w.x0<100 && w.text==='CI');
    const coAnchor = bwords.find(w => w.x0<100 && w.text==='CO');
    const horasCI = {}, horasCO = {};
    if(ciAnchor){
      bwords.filter(w => Math.abs(w.top-ciAnchor.top)<=2.5 && w.x0>=100 && /^[0-9]{1,2}:[0-9]{2}$/.test(w.text))
        .forEach(w => { horasCI[nearestDay(w.x0)] = w.text; });
    }
    if(coAnchor){
      bwords.filter(w => Math.abs(w.top-coAnchor.top)<=2.5 && w.x0>=100 && /^[0-9]{1,2}:[0-9]{2}$/.test(w.text))
        .forEach(w => { horasCO[nearestDay(w.x0)] = w.text; });
    }
    const rutaWords = bwords.filter(w => w.x0>=100 && w.top<nameLimitTop && looksLikeStationCode(w.text));
    const rutaTmp = {};
    rutaWords.forEach(w=>{
      const partes = splitRouteBlob(w.text.toUpperCase());
      const dayInicio = nearestDay(w.x0);
      partes.forEach((p, k)=>{
        const day = dayInicio + k;
        if(day > daycols.length) return;
        (rutaTmp[day] = rutaTmp[day] || []).push([w.top, w.x0 + k*colWidth, p]);
      });
    });
    const rutaPorDia = {};
    for(const day in rutaTmp){
      const items = rutaTmp[day].sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
      rutaPorDia[day] = items.map(x=>x[2]).join(' ');
    }

    // NUEVO — resumen de horas del mes + página del PDF donde
    // aparece, para mostrarlos junto al nombre en el Buscador (igual
    // que ya aparecía en la maqueta de verificación).
    const horasTotales = extractSummaryValue(bwords, 'Totales');
    const horasEF = extractSummaryValue(bwords, 'EF');
    const horasPR = extractSummaryValue(bwords, 'PR');
    const jorProrr = extractSummaryValue(bwords, 'Prorr.');
    const pagina = (idWords.length && idWords[0].pagina) ? idWords[0].pagina
                 : ((bwords.length && bwords[0].pagina) ? bwords[0].pagina : pageNum);
    // índice 3 se deja libre a propósito: cargarHorarioGlobalDesdeAdmin()
    // lo usa para anotar la sede cuando el admin fusiona varias sedes
    // (emp[3] = sedeLbl) — no lo tocamos para no romper esa función.
    // Índices 9/10/11 (horasCI/horasCO/rutaPorDia) son NUEVOS — se
    // añaden al final para no romper ningún código existente que ya
    // lea esta tupla por posición (0-8).
    out.push([empId, name, daysFinal, undefined, horasTotales, horasEF, horasPR, jorProrr, pagina, horasCI, horasCO, rutaPorDia]);
  }
  // sobrante: todo lo que quedó después del último "Jor." de este
  // bloque combinado — se traslada, desplazado bien al negativo, a
  // la página siguiente por si el último empleado quedó a medias.
  // Se excluye expresamente cualquier resto del pie de página legal
  // ("ATENCIÓN: la suma de horas..."), que si no también viajaría
  // arrastrado y se colaría delante del siguiente nombre.
  const lastEtop = jorTops[jorTops.length-1] + 1;
  out.leftover = words.filter(w => w.top > lastEtop && !esTextoDePiePagina(w.text))
                       .map(w => ({text:w.text, x0:w.x0, top:w.top - 100000, pagina:w.pagina}));
  return out;
}
window.parsePageWords = parsePageWords; // FIX — la usa _buscarMatriculaEnPdf() (fuera de este bloque); sin esto daba ReferenceError

// ═══ BUSCADOR + PERFIL (opera sobre activeBase.data) ═══
const OFF_CODES = {"DO":"des","F":"res","R":"res","LD":"oth","CP":"oth","DOP":"dop","B":"oth","EX":"oth","PP":"oth","FE":"oth","Pr":"oth"};
const WEEKDAYS = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
function weekdayForDay(d){
  // FIX — estaba fijado a julio (mes índice 6); el Horario General
  // que se está usando ahora es de AGOSTO 2026 (índice 7), así que
  // los días de la semana salían todos desplazados uno respecto al
  // PDF real. Si el mes cambia otra vez, hay que volver a tocar esto.
  const dt = new Date(2026,7,d);
  return WEEKDAYS[dt.getDay()];
}
function classifyCell(cell){
  const trimmed = (cell||'').trim();
  if(!trimmed) return {type:'oth', dotClass:'dot-oth', off:true};
  if(OFF_CODES[trimmed]) {
    const t = OFF_CODES[trimmed];
    return {type:t, dotClass:'dot-'+t, off:true};
  }
  return {type:'ord', dotClass:'dot-ord', off:false};
}
function trainTokens(cell){
  const tokens = (cell||'').split(/[^0-9A-Za-z]+/).filter(Boolean);
  const nums = new Set();
  for(const tok of tokens){
    // FIX — un número de tren a veces lleva letras pegadas, delante o
    // detrás (ej. "V08125" = material vacío, "3062UM" = unidad
    // múltiple, "3062F"...). Antes solo se reconocía si el token
    // EMPEZABA por dígito, así que estos se perdían y dos compañeros
    // que compartían uno de estos trenes no salían emparejados. Ahora
    // se busca el tramo de dígitos esté donde esté dentro del token.
    const m = tok.match(/(\d{2,6})/);
    if(m) nums.add(m[1].replace(/^0+(?=\d)/, ''));
  }
  return nums;
}
// NUEVO — misma detección que trainTokens(), pero además guarda el
// texto EXACTO tal y como aparece en la celda (con sus letras), para
// poder mostrarlo tal cual en pantalla. No sustituye a trainTokens()
// (que se sigue usando para el cruce de compañeros); es solo para
// pintar el número bonito en el badge.
function trainTokensDetalle(cell){
  const tokens = (cell||'').split(/[^0-9A-Za-z]+/).filter(Boolean);
  const detalle = new Map(); // dígitos normalizados -> texto original visto
  let ultimoDigits = null;
  // NUEVO — fusiona letras MARCADOR A MARCADOR (no el sufijo entero
  // en bloque), para no duplicar uno que ya estuviera presente. Ej.:
  // actual="3113UM" + nuevo sufijo "UMDH" (que ya trae "UM" incluido)
  // → antes daba "3113UMUMDH"; ahora reconoce que "UM" ya estaba y
  // solo añade lo nuevo ("DH"), dando "3113UMDH".
  const MARCADORES = ['UM','DH'];
  function fusionarLetras(base, letrasNuevas){
    if(!letrasNuevas) return base;
    let out = base;
    MARCADORES.forEach(function(marca){
      if(letrasNuevas.indexOf(marca)!==-1 && out.indexOf(marca)===-1) out += marca;
    });
    const sobrante = letrasNuevas.replace(new RegExp(MARCADORES.join('|'),'g'), '');
    if(sobrante && out.indexOf(sobrante)===-1) out += sobrante;
    return out;
  }
  for(const tok of tokens){
    const m = tok.match(/(\d{2,6})/);
    if(m){
      const digits = m[1].replace(/^0+(?=\d)/, '');
      if(!detalle.has(digits)){
        detalle.set(digits, tok);
      } else {
        // FIX — el mismo número de tren puede repetirse en la misma
        // celda (p.ej. "3304-3304DH-4565", donde 3304 aparece dos
        // veces y solo la segunda lleva "DH" pegado). Antes se
        // quedaba con la PRIMERA aparición tal cual, y si esa
        // primera no llevaba letras, la marca (UM/DH/...) de la
        // repetición posterior se perdía sin más. Ahora se fusionan
        // las letras de todas las repeticiones del mismo número.
        const actual = detalle.get(digits);
        const letrasTok = tok.replace(m[1], '');
        detalle.set(digits, fusionarLetras(actual, letrasTok));
      }
      ultimoDigits = digits;
    } else if(/^[A-Za-z]+$/.test(tok) && ultimoDigits && detalle.has(ultimoDigits)){
      // FIX — a veces el propio PDF parte "DH" del número al que
      // pertenece por el ajuste de línea de la celda (queda como
      // token suelto, sin dígitos, ej. "...3113UM" seguido de "DH" en
      // su propia línea). Se pega al último número de tren visto,
      // que es al que realmente corresponde.
      detalle.set(ultimoDigits, fusionarLetras(detalle.get(ultimoDigits), tok));
    }
  }
  return detalle;
}
// NUEVO — badge "🚆 Tren ..." para las tarjetas de compañero, con el
// texto tal cual apareció en la celda (letras incluidas: V08125,
// 3062UM, etc.). Si comparten más de un tren ese día, se listan todos
// separados por " · ". Función única usada en las 3 vistas de
// compañeros para no repetir el mismo HTML tres veces.
function trenBadgeHTML(trenesCompartidos){
  if(!trenesCompartidos || !trenesCompartidos.length) return '';
  const etiqueta = trenesCompartidos.length>1 ? 'Trenes' : 'Tren';
  return `<div class="tren-badge">🚆 ${etiqueta} <span class="tren-badge-num">${trenesCompartidos.join(' · ')}</span></div>`;
}
// NUEVO — chips "🔀 UM" y "☕ DH" aparte del número de tren, para que
// se vean de un vistazo en la tarjeta de compañero. Se leen del texto
// tal cual como aparece en el PDF (p.ej. "3152UM", "3122DH"), que ya
// se guarda en trenesCompartidos vía trainTokensDetalle() — no hace
// falta ningún dato ni parser nuevo. Si el compañero no va como UM ni
// tiene DH ese tren, no se muestra nada (no se rellena con "No").
function umDhBadgesHTML(trenesCompartidos){
  if(!trenesCompartidos || !trenesCompartidos.length) return '';
  var esUM = trenesCompartidos.some(function(t){ return /UM/.test(t); });
  var esDH = trenesCompartidos.some(function(t){ return /DH/.test(t); });
  if(!esUM && !esDH) return '';
  var chips = '';
  if(esUM) chips += '<span style="font-size:10.5px;font-weight:800;padding:4px 9px;border-radius:8px;display:inline-flex;align-items:center;gap:4px;background:rgba(124,58,237,.15);color:var(--violet2);border:1px solid rgba(124,58,237,.35)">🔀 UM</span>';
  if(esDH) chips += '<span style="font-size:10.5px;font-weight:800;padding:4px 9px;border-radius:8px;display:inline-flex;align-items:center;gap:4px;background:rgba(217,119,6,.15);color:var(--amber2);border:1px solid rgba(217,119,6,.35);margin-left:6px">☕ DH</span>';
  return '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">'+chips+'</div>';
}
function findCompanions(day, selfId, selfName, selfCell){
  const selfTokens = trainTokens(selfCell);
  if(selfTokens.size===0) return [];
  const out = [];
  for(const row of activeBase.data){
    const id = row[0], name = row[1], days = row[2], sede = row[3];
    if(id===selfId && name===selfName) continue;
    const cell = days[String(day)];
    if(!cell) continue;
    const tokens = trainTokens(cell);
    // NUEVO — además de saber SI comparten tren, guardamos CUÁLES,
    // con su texto tal cual (letras incluidas), para el badge.
    const trenesCompartidos = [];
    for(const t of selfTokens){ if(tokens.has(t)) trenesCompartidos.push(t); }
    const shared = trenesCompartidos.length>0;
    if(shared){
      const detalle = trainTokensDetalle(cell);
      const trenesTexto = trenesCompartidos.map(t => detalle.get(t) || t);
      // NUEVO — hora de toma (CI) y hora de deje (CO) de ese día, ya
      // extraídas del PDF (row[9]/row[10]), para la barra de progreso
      // en vivo del Buscador de Compañeros.
      const horaCI = row[9] ? row[9][String(day)] : null;
      const horaCO = row[10] ? row[10][String(day)] : null;
      out.push({id, name, cell, sede, trenesCompartidos: trenesTexto, horaCI, horaCO});
    }
  }
  return out;
}

// NUEVO — GENERAL (para cualquier persona, no solo el admin): muestra
// mi horario y el de la persona buscada, lado a lado, día a día,
// directamente dentro del propio Buscador — sin tocar el Calendario
// ni COMP_DATA ni TV. Se busca "mi" fila dentro del mismo Horario
// General ya cargado (activeBase.data), comparando por matrícula
// (AJ.matricula, configurada en Ajustes → Perfil).
function compararAquiEnBuscador(id, name, days){
  const zone = document.getElementById('compararAquiZone');
  if(!zone) return;
  const miMatricula = (typeof AJ!=='undefined' && AJ.matricula) ? String(AJ.matricula).trim() : '';
  if(!miMatricula){
    zone.innerHTML = `<div class="hint-empty">Configura tu matrícula en Ajustes → Perfil para poder comparar.</div>`;
    return;
  }
  const miEntry = activeBase.data.find(e => String(e[0]).trim()===miMatricula);
  if(!miEntry){
    zone.innerHTML = `<div class="hint-empty">No te encuentro en el Horario General de ${activeBase.label} con la matrícula ${miMatricula} — puede que no estés en esta sede, o que tu matrícula en Ajustes no coincida con la del PDF.</div>`;
    return;
  }
  const misDias = miEntry[2];
  let filas = '';
  for(let d=1; d<=31; d++){
    const miCelda = misDias[String(d)] || '—';
    const suCelda = days[String(d)] || '—';
    filas += `<div class="comp-cmp-row">
      <div class="comp-cmp-day">${d}</div>
      <div class="comp-cmp-mio">${miCelda}</div>
      <div class="comp-cmp-suyo">${suCelda}</div>
    </div>`;
  }
  const primerNombre = name.split(',')[0];
  zone.innerHTML = `<div class="comp-wrap" style="margin-top:6px">
    <div class="comp-hdr"><span class="ct">Tú vs ${name}</span></div>
    <div class="comp-cmp-head">
      <div></div><div>Tú</div><div>${primerNombre}</div>
    </div>
    ${filas}
  </div>`;
  zone.scrollIntoView({behavior:'smooth', block:'nearest'});
}
// ═══ NUEVO — Compañeros: navegación tarjetas ↔ detalle Hero ═══
// (sustituye al acordeón apilado de antes; confirmado por Alex)
function mostrarSelectorCompaneros(){
  document.getElementById('comp-selector').style.display = '';
  document.getElementById('comp-detalle-nombre').style.display = 'none';
  document.getElementById('comp-detalle-tren').style.display = 'none';
}
function mostrarDetalleCompaneros(tipo){
  document.getElementById('comp-selector').style.display = 'none';
  document.getElementById('comp-detalle-nombre').style.display = tipo==='nombre' ? '' : 'none';
  document.getElementById('comp-detalle-tren').style.display = tipo==='tren' ? '' : 'none';
  document.getElementById('comp-detalle-hora').style.display = tipo==='hora' ? '' : 'none';
  // Rellena la sede en la cabecera Hero, si ya se conoce (misma
  // variable 'activeBase' que ya usa el resto del buscador).
  var sedeTxt = (typeof activeBase!=='undefined' && activeBase && activeBase.label) ? activeBase.label : '—';
  var idsSede = {nombre:'hdrSedeNombre', tren:'hdrSedeTren', hora:'hdrSedeHora'};
  var elS = document.getElementById(idsSede[tipo]);
  if(elS) elS.textContent = sedeTxt;
  if(tipo==='nombre'){ var inp=document.getElementById('q'); if(inp) setTimeout(function(){inp.focus();}, 150); }
}
// FIX — Confirmado por Alex (bug real detectado en producción — la
// causa DE FONDO, 100% reproducible siempre, no solo con red mala):
// mostrarSelectorCompaneros() y mostrarDetalleCompaneros() están
// declaradas aquí dentro, dentro de un IIFE — así que solo existen en
// el ámbito local de ese bloque, nunca en el ámbito global. Pero las
// tarjetas "Por nombre" y "Por número de tren" las llaman con un
// onclick="..." escrito directamente en el HTML, y esos onclick del
// HTML se ejecutan SIEMPRE en el ámbito global del navegador — nunca
// llegaban a encontrar la función, así que no pasaba nada al pulsar,
// sin ningún error visible en pantalla. Mismo problema exacto que ya
// se dio antes con _chipUmDhTexto, con el mismo arreglo: exponerlas a
// window justo después de declararlas.
window.mostrarSelectorCompaneros = mostrarSelectorCompaneros;
window.mostrarDetalleCompaneros = mostrarDetalleCompaneros;

// ═══ BUSCADOR POR TREN (vista animada de vagones) ═══
let selectedTrainDay = null;
// Variable global explícita solicitada: guarda el objeto Date completo
// elegido en el calendario ferroviario. selectedTrainDay (arriba) es la
// que ya consume la búsqueda (solo necesita el día); esta otra existe
// para que cualquier futura integración tenga la fecha completa a mano.
let fecha_seleccionada_busqueda = null;
const MESES_CAL_TREN = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ═══════════════════════════════════════════════════════════
   generarCalendarioUI(contenedorId, callback) — calendario
   ferroviario 100% propio, sin librerías ni input nativo.
   Pinta un mes navegable dentro de "contenedorId". Al pulsar un
   día, invoca callback(fechaJS) con un objeto Date nativo — el
   mismo tipo de dato que devolvería cualquier selector estándar,
   así que se integra con el sistema de búsqueda sin cambiar su
   forma de trabajar.
   Cada llamada guarda su propio estado (mes/año en pantalla,
   día seleccionado) en un closure — se puede invocar varias
   veces en la misma pantalla (por tren, por nombre, etc.) sin
   que una instancia interfiera con otra.
═══════════════════════════════════════════════════════════ */
function generarCalendarioUI(contenedorId, callback){
  const contenedor = document.getElementById(contenedorId);
  if(!contenedor) return;
  const hoy = new Date();
  const vista = { mes: hoy.getMonth(), anio: hoy.getFullYear() };
  let seleccionada = null;
  const NOMBRES_DIA = ['L','M','X','J','V','S','D'];

  function pintar(){
    const primerDia = new Date(vista.anio, vista.mes, 1);
    const diasEnMes = new Date(vista.anio, vista.mes+1, 0).getDate();
    const offset = (primerDia.getDay()+6)%7; // semana empieza en lunes

    let celdas = '';
    for(let i=0;i<offset;i++) celdas += '<div class="cal-tren-day cal-tren-vacio"></div>';
    for(let d=1; d<=diasEnMes; d++){
      const esHoy = (d===hoy.getDate() && vista.mes===hoy.getMonth() && vista.anio===hoy.getFullYear());
      const esSel = (seleccionada && d===seleccionada.getDate() && vista.mes===seleccionada.getMonth() && vista.anio===seleccionada.getFullYear());
      celdas += `<div class="cal-tren-day${esHoy?' cal-tren-hoy':''}${esSel?' cal-tren-sel':''}" data-d="${d}">${d}</div>`;
    }

    contenedor.innerHTML = `
      <div class="cal-tren-box">
        <div class="cal-tren-rail"></div>
        <div class="cal-tren-hdr">
          <button class="cal-tren-nav" data-nav="-1" type="button">‹</button>
          <div class="cal-tren-mes">${MESES_CAL_TREN[vista.mes]} ${vista.anio}</div>
          <button class="cal-tren-nav" data-nav="1" type="button">›</button>
        </div>
        <div class="cal-tren-semana">${NOMBRES_DIA.map(n=>`<div class="cal-tren-dsem">${n}</div>`).join('')}</div>
        <div class="cal-tren-grid">${celdas}</div>
      </div>`;

    contenedor.querySelectorAll('[data-nav]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        vista.mes += parseInt(btn.dataset.nav, 10);
        if(vista.mes<0){ vista.mes=11; vista.anio--; }
        if(vista.mes>11){ vista.mes=0; vista.anio++; }
        pintar();
      });
    });

    contenedor.querySelectorAll('.cal-tren-day:not(.cal-tren-vacio)').forEach(cell=>{
      cell.addEventListener('click', (e)=>{
        e.stopPropagation();
        const d = parseInt(cell.dataset.d, 10);
        seleccionada = new Date(vista.anio, vista.mes, d);
        contenedor.querySelectorAll('.cal-tren-day').forEach(c=>c.classList.remove('cal-tren-sel'));
        cell.classList.add('cal-tren-sel');
        // Animación de pulso/luz al pulsar la fecha
        cell.classList.remove('cal-tren-pulso');
        void cell.offsetWidth; // reinicia la animación si se pulsa varias veces seguidas
        cell.classList.add('cal-tren-pulso');
        if(typeof callback === 'function') callback(seleccionada);
      });
    });
  }

  pintar();
}

// ── Conexión del calendario ferroviario con la búsqueda por tren ──
// El calendario del Comparador de Compañero ya no se despliega con un
// disparador — es parte fija de esta vista, visible desde el primer
// momento. Se renderiza una única vez con generarCalendarioUI()
// (la misma función reutilizable de siempre, sin tocar su lógica).
// NUEVO — Confirmado por Alex (bug real, detectado en producción):
// este mini-calendario es independiente del Calendario principal —
// cambiar de mes AQUÍ no disparaba ninguna recarga del Horario
// General, así que "Buscar" seguía mirando los datos del mes anterior
// aunque se eligiera un día de otro mes. Por eso, buscando el mismo
// tren en un día de agosto y en el "mismo" día de septiembre, salían
// las mismas personas — en realidad ambas búsquedas miraban agosto.
// Ahora, si el día elegido es de un mes distinto al que ya está
// cargado, se recarga el Horario General de ESE mes antes de buscar.
// _cargaMesTrenPromise se comparte con el listener de "Buscar" de más
// abajo, para que este espere a que la recarga termine si hiciera falta.
var _cargaMesTrenPromise = null;
generarCalendarioUI('calTrenPanel', (fecha)=>{
  selectedTrainDay = fecha.getDate();
  fecha_seleccionada_busqueda = fecha;
  var mesFecha = { anio: fecha.getFullYear(), mes: fecha.getMonth()+1 };
  var yaCargado = BASES.global && BASES.global.mesAnio
    && BASES.global.mesAnio.anio===mesFecha.anio && BASES.global.mesAnio.mes===mesFecha.mes;
  if(!yaCargado){
    _cargaMesTrenPromise = cargarHorarioGlobalDesdeAdmin(mesFecha).then(function(ok){
      // FIX — Confirmado por Alex (bug propio, detectado antes de
      // entregar): NO se llama a activateBase('global') aquí —
      // esa función reinicia SIEMPRE selectedTrainDay/trTrainInput/
      // trainView (pensada para cuando se entra de cero a la
      // pestaña), así que borraría el día que el usuario acaba de
      // elegir en este mismo mini-calendario, justo antes de poder
      // pulsar "Buscar". Solo se actualiza la cabecera — activeBase
      // ya apunta al mismo objeto BASES.global, así que su .data ya
      // queda al día automáticamente en cuanto cargarHorarioGlobalDesdeAdmin
      // lo actualiza, sin necesitar reactivar nada más.
      if(ok){
        document.getElementById('hdrTitulo').textContent = BASES.global.label;
        document.getElementById('hdrPill').textContent = '📍 ' + (BASES.global.month || 'BASE ACTIVA');
      }
      _cargaMesTrenPromise = null;
    }).catch(function(){ _cargaMesTrenPromise = null; });
  }
});
iniciarCalendarioInterventor();

function cellContainsTrain(cell, trainNum){
  const tokens = (cell||'').split(/[^0-9A-Za-z]+/).filter(Boolean);
  // Normaliza el número buscado: a string, sin espacios y sin ceros a
  // la izquierda (String()+trim() por sí solos NO bastan: "00123".trim()
  // sigue siendo "00123", nunca igual a "123" — por eso el .replace()).
  const norm = String(trainNum==null ? '' : trainNum).trim().replace(/^0+(?=\d)/, '');
  for(const tok of tokens){
    // FIX — igual que trainTokens()/trainTokensDetalle(): un número de
    // tren puede llevar letras pegadas (V08125, 3062UM...). Antes solo
    // se reconocía si el token EMPEZABA por dígito, así que "Buscar
    // por tren" no encontraba a nadie cuyo código llevara letras.
    const m = tok.match(/(\d{2,6})/);
    if(m){
      const tokNorm = m[1].replace(/^0+(?=\d)/, '');
      if(tokNorm === norm) return true;
    }
  }
  return false;
}

// ── Búsqueda en los servicios de Interventor (Gráfico+Informe) — se suma
//    a los resultados de "Buscar por tren" sin tocar la lógica de BASES ──
function normTrainInterventor(s){
  s = (s||'').replace(/\D/g,'');
  return s.replace(/^0+(?=\d)/,'');
}
function trainMatchesInterventor(inputNorm, storedRaw){
  const storedNorm = normTrainInterventor(storedRaw);
  if(storedNorm === inputNorm) return true;
  if(storedRaw.length > 4 && normTrainInterventor(storedRaw.slice(-4)) === inputNorm) return true;
  // NUEVO — los trenes del Informe de Bilbao tienen 5 dígitos, pero
  // basta con escribir los últimos 3 para reconocerlos (confirmado
  // por el usuario). Antes solo se comprobaban los últimos 4 —
  // funcionaba con estos trenes de casualidad porque su 4º dígito
  // desde el final siempre era "0" (10174 → últimos 4 "0174" → sin
  // el cero, "174"), pero no de forma fiable con cualquier número.
  // Ahora se comprueban también los últimos 3 de forma explícita.
  if(storedRaw.length > 3 && normTrainInterventor(storedRaw.slice(-3)) === inputNorm) return true;
  return false;
}
function buscarInterventor(rawTrain, fechaDate){
  const out = [];
  if(!fechaDate || INTERVENTOR_SERVICES.length===0) return out;
  const inputNorm = normTrainInterventor(rawTrain);
  const iso = fechaDate.getFullYear() + '-' + String(fechaDate.getMonth()+1).padStart(2,'0') + '-' + String(fechaDate.getDate()).padStart(2,'0');
  for(const servicio of INTERVENTOR_SERVICES){
    for(const [id, name, dias] of servicio.data){
      const cell = dias[iso];
      if(!cell) continue;
      const tokens = cell.split(/\s+/).filter(Boolean);
      const encontrado = tokens.find(t => trainMatchesInterventor(inputNorm, t));
      if(encontrado) out.push({id, name, cell, servicio: servicio.name});
    }
  }
  return out;
}

// NUEVO — Avisos de Concreción horaria / Jornada reducida (ver
// parseGraficoTurnos → concrecionMap). Estos turnos suelen NO
// aparecer con ese número en el Informe de la persona que realmente
// lo hace (es un arreglo puntual), así que buscarInterventor() de
// arriba no la encuentra por esa vía. Esta función es 100% aparte:
// no toca buscarInterventor ni construirDiasDesdeCruce, solo añade
// una segunda lista de "avisos" que se muestra por separado.
function normNombreConcrecion(s){
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
}
// Busca, dentro de los agentes YA cruzados de un servicio (servicio.data,
// pares [matricula, nombre, dias]), alguno cuyo nombre completo contenga
// TODAS las palabras del nombre anotado en el gráfico (en cualquier
// orden — el Informe suele listar "APELLIDOS, NOMBRE"). Si ninguna
// palabra coincide con nadie (p.ej. "RICARDO" no está en el Informe),
// se devuelve null y ese aviso simplemente no se muestra — tal y como
// se pidió.
function _buscarAgenteInterventorPorNombreParcial(servicio, nombreTok){
  const tokWords = normNombreConcrecion(nombreTok).split(/\s+/).filter(Boolean);
  if(!tokWords.length) return null;
  for(const [matricula, nombre] of servicio.data){
    const nombreWords = normNombreConcrecion(nombre).replace(/,/g,' ').split(/\s+/).filter(Boolean);
    if(tokWords.every(w => nombreWords.includes(w))) return {matricula, nombre};
  }
  return null;
}
const DOW_LETTER_CONCRECION = ['D','L','M','X','J','V','S'];
function buscarInterventorConcrecion(rawTrain, fechaDate){
  const out = [];
  if(!fechaDate || INTERVENTOR_SERVICES.length===0) return out;
  const inputNorm = normTrainInterventor(rawTrain);
  const dow = DOW_LETTER_CONCRECION[fechaDate.getDay()];
  for(const servicio of INTERVENTOR_SERVICES){
    const turnosData = servicio.turnos;
    if(!turnosData || !turnosData.__concrecionHoraria) continue;
    for(const turno of Object.keys(turnosData.__concrecionHoraria)){
      const legs = (turnosData[turno]||[]).filter(l=>{
        const dc = l.daycode||'';
        return dc === '' || dc.includes(dow);
      });
      const trainHit = legs.some(l => trainMatchesInterventor(inputNorm, l.train_raw));
      if(!trainHit) continue;
      for(const ann of turnosData.__concrecionHoraria[turno]){
        for(const nombreTok of ann.nombres){
          const agente = _buscarAgenteInterventorPorNombreParcial(servicio, nombreTok);
          if(!agente) continue; // sin coincidencia en el Informe → no se muestra (pedido así)
          out.push({id: agente.matricula, name: agente.nombre, tipo: ann.tipo, servicio: servicio.name, turno});
        }
      }
    }
  }
  return out;
}

const trainView = document.getElementById('trainView');
document.getElementById('trGoBtn').addEventListener('click', async ()=>{
  if(!activeBase){ return; }
  const raw = document.getElementById('trTrainInput').value.trim().replace(/^0+/, '');
  if(!selectedTrainDay){
    trainView.innerHTML = `<div class="train-scene"><div class="train-empty">Selecciona primero un <b>día</b> de julio.</div></div>`;
    return;
  }
  if(!raw){
    trainView.innerHTML = `<div class="train-scene"><div class="train-empty">Escribe un <b>número de tren</b>.</div></div>`;
    return;
  }
  const btn = document.getElementById('trGoBtn');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  // NUEVO — Confirmado por Alex: si elegir el día disparó una recarga
  // del mes (ver generarCalendarioUI('calTrenPanel', ...) más arriba),
  // se espera a que termine antes de mirar activeBase.data — así nunca
  // se busca a mitad de una recarga, con datos todavía del mes viejo.
  if(_cargaMesTrenPromise){
    btn.textContent = 'Cargando el mes...';
    await _cargaMesTrenPromise;
  }
  btn.textContent = 'Buscando...';
  try{
    const matches = [];
    for(const entryTren of activeBase.data){
      const [id, name, days] = entryTren;
      const cell = days[String(selectedTrainDay)];
      if(cell && cellContainsTrain(cell, raw)) matches.push({id, name, cell, entry: entryTren});
    }
    const interventorMatches = buscarInterventor(raw, fecha_seleccionada_busqueda);
    const concrecionMatches = buscarInterventorConcrecion(raw, fecha_seleccionada_busqueda);
    renderTrain(raw, selectedTrainDay, matches, interventorMatches, concrecionMatches);
    // Misma duración que la animación de carga del resultado
    // (mostrarConAnimacionTren, ~380ms), para que "Buscando..." no
    // desaparezca antes de que el resultado esté realmente pintado.
    await new Promise(resolve => setTimeout(resolve, 380));
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
});

// Avatar placeholder (SVG inline, sin dependencias externas) para las
// tarjetas de resultado — sustituye al círculo de iniciales por un img real.
const AVATAR_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23163158'/%3E%3Ccircle cx='20' cy='16' r='7' fill='%233b7fff'/%3E%3Cpath d='M6 37c0-8.5 7-14 14-14s14 5.5 14 14' fill='%233b7fff'/%3E%3C/svg%3E";

/* ── mostrarConAnimacionTren(contenedor, renderFn) ──
   Muestra brevemente .animacion-tren-loader dentro de "contenedor" y
   después ejecuta renderFn() para pintar los resultados reales. Es
   puramente cosmético: si algo falla en cualquier punto, se cae
   directamente a renderFn() sin animación — nunca bloquea los datos.
   Confinado exclusivamente a los contenedores de resultados que se
   le pasen (view / trainView) — no se usa en ningún otro sitio. */
function mostrarConAnimacionTren(contenedor, renderFn){
  try{
    contenedor.innerHTML = '<div class="animacion-tren-loader"><div class="atl-track">'
      +'<div class="atl-car"></div><div class="atl-car"></div><div class="atl-car"></div>'
      +'</div></div>';
    setTimeout(function(){
      // FIX — Confirmado por el usuario: antes, si renderFn() fallaba,
      // se reintentaba una vez EN SILENCIO — si volvía a fallar (lo
      // normal, ya que el mismo error se repite), quedaba como una
      // excepción sin capturar, invisible salvo abriendo la consola
      // del navegador. Ahora, si el segundo intento también falla, se
      // escribe el error directamente en el propio contenedor.
      try{ renderFn(); }
      catch(e){
        try{ renderFn(); }
        catch(e2){
          console.error('mostrarConAnimacionTren:', e2);
          contenedor.innerHTML = '<div style="padding:14px;color:var(--nar3);font-size:12px">⚠️ Error al construir el resultado: '+(e2 && e2.message ? e2.message : e2)+'</div>';
        }
      }
    }, 380);
  }catch(e){
    try{ renderFn(); }
    catch(e2){
      console.error('mostrarConAnimacionTren (fuera):', e2);
      contenedor.innerHTML = '<div style="padding:14px;color:var(--nar3);font-size:12px">⚠️ Error: '+(e2 && e2.message ? e2.message : e2)+'</div>';
    }
  }
}

// NUEVO — Por seguridad, el nombre del interventor se muestra
// ofuscado: las letras A/E se sustituyen por 4/3. Solo afecta a la
// tarjeta de Interventor — la tripulación/compañeros se sigue
// mostrando con su nombre normal, sin tocar.

function ofuscarNombreInterventor(nombre){
  if(!nombre) return nombre;
  return nombre.replace(/[AaEe]/g, function(letra){
    return (letra==='A'||letra==='a') ? '4' : '3';
  });
}

// NUEVO — Maqueta 2A: badges Ida/Vuelta para "Buscar por tren". Si en
// la celda de ese compañero ese día aparece, ADEMÁS del tren buscado
// (ida, ya confirmado por cellContainsTrain), algún OTRO número de
// tren distinto, se muestra como Vuelta. Si no aparece ningún otro
// número, no se afirma nada sobre su vuelta (no hay dato real para
// asegurarlo) — solo se muestra el tren de ida.
function trenIdaVueltaBadgeHTML(cell, trainBuscadoRaw){
  const detalle = trainTokensDetalle(cell);
  const idaDigits = String(trainBuscadoRaw==null?'':trainBuscadoRaw).trim().replace(/^0+(?=\d)/, '');
  const idaTexto = detalle.get(idaDigits) || trainBuscadoRaw;
  const vueltaEntradas = [...detalle.entries()].filter(([digits]) => digits !== idaDigits);
  let html = `<div class="tren-row" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">`;
  html += `<div class="tren-badge ida" style="display:inline-flex;align-items:center;gap:5px;border-radius:8px;padding:3px 9px;font-size:11px;font-weight:800;letter-spacing:.2px;background:rgba(249,115,22,.14);border:1px solid rgba(249,115,22,.4);color:var(--nar3)">🚆 ${vueltaEntradas.length ? 'Ida' : 'Tren'} <span style="font-variant-numeric:tabular-nums;font-size:12px;color:var(--nar2)">${idaTexto}</span></div>`;
  if(vueltaEntradas.length){
    const etiqueta = vueltaEntradas.length>1 ? 'Vuelta' : 'Vuelta';
    const texto = vueltaEntradas.map(([,tok])=>tok).join(' · ');
    html += `<div class="tren-badge vuelta" style="display:inline-flex;align-items:center;gap:5px;border-radius:8px;padding:3px 9px;font-size:11px;font-weight:800;letter-spacing:.2px;background:rgba(8,145,178,.16);border:1px solid rgba(8,145,178,.45);color:#67E8F9">🔁 ${etiqueta} <span style="font-variant-numeric:tabular-nums;font-size:12px;color:#22D3EE">${texto}</span></div>`;
  }
  html += `</div>`;
  return html;
}
// NUEVO — Confirmado por el usuario: lista de trenes de un día,
// ordenados por hora, usando la hora de toma (CI) del PRIMER tren de
// quien lo tenga como su primer tren ese día — es lo único fiable que
// trae el Horario General (que solo da UNA hora de inicio/fin por
// persona y día, no una por cada tren si hizo varios). Al tocar un
// tren de la lista, se reutiliza EXACTAMENTE la misma búsqueda de
// siempre (mismo botón "Buscar", mismos avisos de Interventor) — ahí
// cada compañero ya muestra su CI/CO y el resto de trenes de su día
// (badge "🔁 Vuelta"), sin tocar nada de eso.
function _horaToMinTren(h){
  if(!h) return null;
  var p = h.split(':').map(Number);
  if(p.length<2 || isNaN(p[0]) || isNaN(p[1])) return null;
  return p[0]*60+p[1];
}
async function renderListaTrenesPorHora(day){
  var panel = document.getElementById('trListaHoraPanel');
  if(!panel) return;
  if(!activeBase){ panel.innerHTML=''; return; }
  panel.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Buscando trenes...</div>';
  if(_cargaMesTrenPromise) await _cargaMesTrenPromise;
  var trenHora = {}; // dígitos normalizados -> {min, hora, texto}
  activeBase.data.forEach(function(entry){
    var cell = entry[2] && entry[2][String(day)];
    if(!cell) return;
    var cls = classifyCell(cell);
    if(cls.off) return; // día libre/descanso/etc. — sin tren
    var detalle = (typeof trainTokensDetalle==='function') ? trainTokensDetalle(cell) : null;
    if(!detalle || !detalle.size) return;
    var primero = detalle.entries().next().value; // [digits, texto] del PRIMER tren de esa persona ese día
    if(!primero) return;
    var digits = primero[0], texto = primero[1];
    var horasCI = entry[9] || {};
    var hora = horasCI[String(day)];
    var min = _horaToMinTren(hora);
    if(min===null) return;
    if(!trenHora[digits] || min < trenHora[digits].min){
      trenHora[digits] = {min:min, hora:hora, digits:digits};
    }
  });
  var lista = Object.keys(trenHora).map(function(d){ return trenHora[d]; });
  lista.sort(function(a,b){ return a.min-b.min; });
  if(!lista.length){
    panel.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">No se encontró ninguna hora de toma para ese día — puede que el PDF no traiga CI/CO ahí.</div>';
    return;
  }
  var html = '<div class="cs-box"><div class="cs-t">Trenes del día '+day+', por hora aproximada de toma</div>';
  lista.forEach(function(item){
    // FIX — Confirmado por el usuario: "texto" guarda a propósito
    // marcas como "DH"/"UM" pegadas al número (útiles en la tarjeta
    // de un compañero, para saber que ESA vez concreta llevaba esa
    // marca) — pero en esta lista general de trenes del día, ese
    // sufijo solo confundía ("Tren 3152DH" en vez de "Tren 3152").
    // Aquí se usa siempre el número limpio (item.digits).
    // NUEVO — Confirmado por el usuario: la tripulación ya no se pinta
    // en un hueco compartido arriba de la lista — cada tren tiene AHORA
    // su propio hueco de resultado, justo debajo de su tarjeta
    // (id="trRes_<número>"), que se abre/cierra al tocar. Al ser un
    // sitio propio por tren (no uno solo compartido por todos), de
    // paso queda resuelto el fallo de que el segundo tren tocado no
    // refrescaba: cada uno tiene su propio hueco, nunca se pisan.
    html += '<div>'
      + '<div class="pcard" id="trCard_'+item.digits+'" style="cursor:pointer" onclick="_trGoDesdeListaHora(\''+item.digits+'\')">'
      + '<div class="pcard-av" style="background:rgba(124,58,237,.18);color:#c4b5fd">🕐</div>'
      + '<div class="pcard-info"><div class="pcard-name">Tren '+item.digits+'</div><div class="pcard-id">Toma sobre las '+item.hora+'</div></div>'
      + '<div class="pcard-arr" id="trArr_'+item.digits+'">›</div></div>'
      + '<div id="trRes_'+item.digits+'" style="display:none;margin:-6px 0 12px"></div>'
      + '</div>';
  });
  html += '</div>';
  panel.innerHTML = html;
}
function _trGoDesdeListaHora(trenTexto){
  var digits = String(trenTexto).replace(/\D/g,'').replace(/^0+(?=\d)/,'');
  // NUEVO — Confirmado por el usuario: cada tren tiene ahora su PROPIO
  // hueco de resultado, justo debajo de su propia tarjeta
  // (id="trRes_<número>") — no uno solo compartido arriba de la
  // lista. Al tocar: si ya estaba abierto, se cierra (acordeón); si
  // estaba cerrado y ya se había buscado antes, se vuelve a abrir sin
  // rebuscar; si es la primera vez, se busca y se pinta.
  var targetEl = document.getElementById('trRes_'+digits);
  var flecha = document.getElementById('trArr_'+digits);
  if(!targetEl) return;
  var abierto = targetEl.style.display !== 'none';
  if(abierto){
    targetEl.style.display = 'none';
    if(flecha) flecha.textContent = '›';
    return;
  }
  targetEl.style.display = 'block';
  if(flecha) flecha.textContent = '⌄';
  if(targetEl.dataset.cargado === '1') return; // ya se buscó antes — solo se reabre
  targetEl.dataset.cargado = '1';
  try{
    if(!activeBase){
      targetEl.innerHTML = '<div style="padding:14px;color:var(--nar3);font-size:12px">⚠️ activeBase no está cargado todavía.</div>';
      return;
    }
    if(!selectedTrainDay){
      targetEl.innerHTML = '<div style="padding:14px;color:var(--nar3);font-size:12px">⚠️ No hay ningún día seleccionado (selectedTrainDay vacío).</div>';
      return;
    }
    var matches = [];
    for(var i=0;i<activeBase.data.length;i++){
      var entryTren = activeBase.data[i];
      var id = entryTren[0], name = entryTren[1], days = entryTren[2];
      var cell = days[String(selectedTrainDay)];
      if(cell && cellContainsTrain(cell, digits)) matches.push({id:id, name:name, cell:cell, entry:entryTren});
    }
    var interventorMatches = (typeof buscarInterventor==='function') ? buscarInterventor(digits, fecha_seleccionada_busqueda) : [];
    var concrecionMatches = (typeof buscarInterventorConcrecion==='function') ? buscarInterventorConcrecion(digits, fecha_seleccionada_busqueda) : [];
    renderTrain(digits, selectedTrainDay, matches, interventorMatches, concrecionMatches, targetEl);
  }catch(err){
    console.error('_trGoDesdeListaHora:', err);
    targetEl.innerHTML = '<div style="padding:14px;color:var(--nar3);font-size:12px">⚠️ Error: '+(err && err.message ? err.message : err)+'</div>';
  }
}
// FIX — Confirmado por el usuario (causa real encontrada): esta
// función vive dentro del mismo bloque (function(){...})() que ya
// envuelve todo el buscador de Compañeros — y, como el resto de
// funciones de ese bloque que se llaman desde un onclick del HTML
// (mostrarSelectorCompaneros, mostrarDetalleCompaneros...), necesita
// exponerse a "window" explícitamente para poder llamarse desde
// fuera. Sin esta línea, el onclick="_trGoDesdeListaHora(...)" de
// cada tren de la lista fallaba en silencio (función no encontrada
// en el ámbito global) — por eso nunca aparecía la tripulación al
// tocar un tren, aunque toda la lógica interna estuviera bien.
window._trGoDesdeListaHora = _trGoDesdeListaHora;
// NUEVO — Confirmado por el usuario: en cuanto se elige un día, el
// calendario se repliega del todo (deja solo un resumen "Día X ·
// Cambiar ✎") para que la lista de trenes tenga sitio de sobra y no
// haya que bajar tanto para verla. _cambiarDiaHora() vuelve a mostrar
// el calendario si hace falta elegir otro día.
function _mostrarListaHoraTrasDia(fecha){
  var wrap = document.getElementById('calTrenPanelHoraWrap');
  var resumen = document.getElementById('diaElegidoHoraResumen');
  var texto = document.getElementById('diaElegidoHoraTexto');
  if(wrap) wrap.style.display = 'none';
  if(resumen) resumen.style.display = 'flex';
  if(texto) texto.textContent = weekdayForDay(fecha.getDate())+' '+fecha.getDate()+' de '+MESES_CAL_TREN[fecha.getMonth()].toLowerCase();
  renderListaTrenesPorHora(fecha.getDate());
}
function _cambiarDiaHora(){
  var wrap = document.getElementById('calTrenPanelHoraWrap');
  var resumen = document.getElementById('diaElegidoHoraResumen');
  if(wrap) wrap.style.display = '';
  if(resumen) resumen.style.display = 'none';
  var panel = document.getElementById('trListaHoraPanel');
  if(panel) panel.innerHTML = ''; // al cambiar de día se limpia la lista entera (con ella, todos los acordeones de tripulación abiertos de ese día)
}
window._cambiarDiaHora = _cambiarDiaHora;
// NUEVO — Calendario propio de "Por hora de salida": al elegir un día,
// se repliega el calendario y se muestra la lista directamente (sin
// botón intermedio) — un paso menos que la pantalla de "Por número de
// tren".
// FIX — Confirmado por el usuario: le faltaba la misma comprobación
// de mes que ya tiene el calendario de "Por número de tren" — sin
// ella, si el mes cargado en memoria no coincidía exactamente con el
// mes del día elegido, la lista salía vacía (o con datos de otro mes)
// sin ningún aviso claro. Ahora, igual que el otro calendario, si el
// mes elegido no es el que ya está cargado, se recarga el Horario
// General de ESE mes antes de construir la lista.
generarCalendarioUI('calTrenPanelHora', function(fecha){
  selectedTrainDay = fecha.getDate();
  fecha_seleccionada_busqueda = fecha;
  var mesFechaHora = { anio: fecha.getFullYear(), mes: fecha.getMonth()+1 };
  var yaCargadoHora = BASES.global && BASES.global.mesAnio
    && BASES.global.mesAnio.anio===mesFechaHora.anio && BASES.global.mesAnio.mes===mesFechaHora.mes;
  if(yaCargadoHora){
    _mostrarListaHoraTrasDia(fecha);
    return;
  }
  var panelCarga = document.getElementById('trListaHoraPanel');
  if(panelCarga) panelCarga.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Cargando el mes...</div>';
  _cargaMesTrenPromise = cargarHorarioGlobalDesdeAdmin(mesFechaHora).then(function(ok){
    _cargaMesTrenPromise = null;
    // FIX — Confirmado por el usuario: si no hay Horario General
    // publicado para ese mes (ok=false), antes se seguía adelante e
    // intentaba construir la lista igualmente, con datos de OTRO mes
    // que seguían en memoria — resultado: pantalla en blanco, sin
    // ningún aviso, muy confuso. Ahora, si falla, se dice claramente
    // por qué, en vez de intentarlo con datos que no son de ese mes.
    if(!ok){
      if(panelCarga) panelCarga.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">⚠️ No hay Horario General publicado para '+MESES_CAL_TREN[mesFechaHora.mes-1]+' '+mesFechaHora.anio+' todavía.'+(_diagHorarioGeneral?'<br><span style="font-size:10px">['+_diagHorarioGeneral+']</span>':'')+'</div>';
      return;
    }
    document.getElementById('hdrTitulo').textContent = BASES.global.label;
    document.getElementById('hdrPill').textContent = '📍 ' + (BASES.global.month || 'BASE ACTIVA');
    var elS = document.getElementById('hdrSedeHora');
    if(elS && activeBase) elS.textContent = activeBase.label;
    _mostrarListaHoraTrasDia(fecha);
  }).catch(function(){
    _cargaMesTrenPromise = null;
    if(panelCarga) panelCarga.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">No se pudo cargar ese mes.</div>';
  });
});

function renderTrain(trainNum, day, matches, interventorMatches, concrecionMatches, targetEl){
  interventorMatches = interventorMatches || [];
  concrecionMatches = concrecionMatches || [];
  // NUEVO — Confirmado por el usuario: se puede pintar en OTRO
  // contenedor (por ejemplo, el de "Por hora de salida"), sin tocar
  // nada del comportamiento de siempre — si no se indica ninguno,
  // sigue pintando en 'trainView' igual que hasta ahora.
  targetEl = targetEl || trainView;
  const _render = ()=>{
  const wd = weekdayForDay(day);
  const total = matches.length + interventorMatches.length + concrecionMatches.length;
  if(total===0){
    targetEl.innerHTML = `<div class="train-scene">
      <div class="train-meta">Tren <b>${trainNum}</b> · ${wd} ${day} · base <b>${activeBase.label}</b></div>
      <div class="train-empty">Nadie de <b>${activeBase.label}</b> ni ningún interventor cargado hace el tren <b>${trainNum}</b> ese día.</div>
    </div>`;
    return;
  }
  let filas = '';
  interventorMatches.forEach((m)=>{
    filas += `<div class="pcard" style="border-color:var(--nar);background:rgba(249,115,22,.08)">
      <div class="pcard-av" style="background:rgba(249,115,22,.18);color:var(--nar2)">🎫</div>
      <div class="pcard-info">
        <div class="pcard-name">${ofuscarNombreInterventor(m.name)}</div>
        <div class="pcard-id" style="color:var(--nar2);font-weight:700">INTERVENTOR · ${m.servicio}</div>
      </div>
    </div>`;
  });
  // NUEVO — avisos de Concreción horaria / Jornada reducida, en un
  // bloque APARTE (distinto color) del cruce normal de arriba — puede
  // repetir a la misma persona si además coincidió por la vía normal,
  // a propósito: es un aviso, no una deduplicación.
  concrecionMatches.forEach((m)=>{
    const etiqueta = m.tipo === 'JORNADA_REDUCIDA' ? 'JORNADA REDUCIDA' : 'CONCRECIÓN HORARIA';
    filas += `<div class="pcard" style="border-color:#a855f7;background:rgba(168,85,247,.08)">
      <div class="pcard-av" style="background:rgba(168,85,247,.18);color:#c084fc">⚠️</div>
      <div class="pcard-info">
        <div class="pcard-name">${ofuscarNombreInterventor(m.name)}</div>
        <div class="pcard-id" style="color:#c084fc;font-weight:700">AVISO · ${etiqueta} · ${m.servicio}</div>
      </div>
    </div>`;
  });
  matches.forEach((m, mIdx)=>{
    var esAdminTren = (typeof perfilAdminActual!=='undefined' && perfilAdminActual && perfilAdminActual.rol==='admin');
    var sedeReal = (m.entry && m.entry[3]) ? m.entry[3] : '';
    // NUEVO — chip UM/DH (se me había pasado en esta vista) + barra de
    // horario en vivo, usando horaCI/horaCO del PDF (entry[9]/[10]).
    var digitsBuscado = String(trainNum).replace(/^0+(?=\d)/,'');
    var textoTrenM = (typeof trainTokensDetalle==='function') ? (trainTokensDetalle(m.cell).get(digitsBuscado) || trainNum) : trainNum;
    var horaCIm = (m.entry && m.entry[9]) ? m.entry[9][String(day)] : null;
    var horaCOm = (m.entry && m.entry[10]) ? m.entry[10][String(day)] : null;
    filas += `<div class="pcard" style="flex-direction:column;align-items:stretch">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="pcard-av">${initials(m.name)}</div>
        <div class="pcard-info">
          <div class="pcard-name">${m.name}</div>
          <div class="pcard-id">TRIPULACIÓN${sedeReal ? ' · '+sedeReal : ''}${m.id ? ' · ID '+m.id : ''}${_chipUmDhTexto(textoTrenM, m.cell)}</div>
        </div>
      </div>
      ${trenIdaVueltaBadgeHTML(m.cell, trainNum)}
      ${_progresoHorarioHTML(horaCIm, horaCOm, day)}
      ${esAdminTren ? `<button class="btn-import-comp-tren" data-midx="${mIdx}" style="margin-top:8px;padding:8px;background:rgba(37,99,235,.12);border:1px solid rgba(37,99,235,.35);border-radius:8px;color:#93c5fd;font-size:11px;font-weight:700;cursor:pointer">👤 (Admin) Ver su horario junto al mío</button>` : ''}
    </div>`;
  });
  const partes = [];
  if(interventorMatches.length) partes.push(`${interventorMatches.length} interventor(es)`);
  if(concrecionMatches.length) partes.push(`${concrecionMatches.length} aviso(s)`);
  if(matches.length) partes.push(`${matches.length} de <b>${activeBase.label}</b>`);
  targetEl.innerHTML = `<div class="train-scene">
    <div class="train-meta">Tren <b>${trainNum}</b> · ${wd} ${day} · ${partes.join(' + ')}</div>
    <div class="comp-list">${filas}</div>
  </div>`;
  targetEl.querySelectorAll('.btn-import-comp-tren').forEach(function(btn){
    btn.addEventListener('click', function(){
      var mIdx = parseInt(btn.dataset.midx, 10);
      var m = matches[mIdx];
      if(!m || !m.entry) return;
      var entry = m.entry;
      // entry = [id, name, days, sede, horasTotales, horasEF, horasPR, jorProrr, pagina, horasCI, horasCO, rutaPorDia]
      importarComoCompanero(entry[0], entry[1], entry[2], entry[9], entry[10], entry[11]);
    });
  });
  };
  mostrarConAnimacionTren(targetEl, _render);
}

function initials(name){
  const parts = name.replace(/,/g,' ').trim().split(/\s+/).filter(Boolean);
  if(parts.length===0) return '?';
  if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0]+parts[1][0]).toUpperCase();
}

const qInput = document.getElementById('q');
const clearBtn = document.getElementById('clearBtn');
const viewEl = document.getElementById('view');

function renderEmptyHint(){
  viewEl.innerHTML = `<div class="hint-empty">Escribe al menos <b>2 letras</b> del nombre de un compañero de <b>${activeBase ? activeBase.label : ''}</b> para ver su turno.</div>`;
}

function renderList(matches, query){
  if(matches.length===0){
    viewEl.innerHTML = `<div class="hint-empty">Sin resultados para "<b>${query}</b>" en ${activeBase.label}.</div>`;
    return;
  }
  const _render = ()=>{
  let html = '';
  if(matches.length){
    html += '<div class="list">';
    for(const [id, name, , sede] of matches){
      html += `<div class="pcard perfil-companero" data-id="${id}" data-name="${encodeURIComponent(name)}">
        <img class="pcard-avatar-img" src="${AVATAR_PLACEHOLDER}" alt="">
        <div class="pcard-info">
          <span class="pcard-name-full">${name}</span>
          ${id ? `<div class="pcard-id">ID ${id}${sede ? ' · '+sede : ''}</div>` : ''}
        </div>
        <div class="pcard-arr">›</div>
      </div>`;
    }
    html += '</div>';
  }
  viewEl.innerHTML = html;
  viewEl.querySelectorAll('.pcard[data-id]').forEach(card=>{
    card.addEventListener('click', ()=>{
      const id = card.dataset.id;
      const name = decodeURIComponent(card.dataset.name);
      const entry = activeBase.data.find(e => e[0]===id && e[1]===name);
      if(entry) renderProfile(entry);
    });
  });
  };
  mostrarConAnimacionTren(viewEl, _render);
}

const TAG_LABEL = {ord:'TURNO', des:'DESCANSO', res:'FRANCO/RES.', dop:'DOP', oth:'OTROS'};
// NUEVO — mes/año a usar para pintar la cuadrícula del calendario del
// perfil de un compañero. Usa el mes/año real detectado en la cabecera
// del PDF (BASES.global.mesAnio) si está disponible; si no, cae en el
// mismo mes fijo que ya usa weekdayForDay() más abajo, para que ambas
// vistas (lista y calendario) muestren siempre el mismo día de la
// semana para cada número de día.
function _mesAnioParaPerfil(){
  var m = (typeof BASES!=='undefined' && BASES.global && BASES.global.mesAnio) ? BASES.global.mesAnio : null;
  if(m && m.anio && m.mes) return {anio:m.anio, mes:m.mes}; // mes: 1-12
  return {anio:2026, mes:8}; // fallback — agosto 2026, igual que weekdayForDay()
}
// NUEVO — cuadrícula de calendario (Maqueta 1B: código del turno visible
// directo en cada celda, sin tener que tocarla). Reutiliza las mismas
// clases .dc/.dc-ord/.dc-des/.dc-res/.dc-dop ya definidas para el
// Calendario principal, para que los colores sean coherentes en toda
// la app.
function _renderProfileCalendarioHTML(days){
  var ma = _mesAnioParaPerfil();
  var y = ma.anio, m = ma.mes-1; // Date() usa mes 0-indexado
  var last = new Date(y, m+1, 0).getDate();
  var sd = new Date(y, m, 1).getDay(); sd = sd===0 ? 6 : sd-1; // lunes=0
  var hoy = new Date();
  var esMesHoy = hoy.getFullYear()===y && hoy.getMonth()===m;
  var celdas = '';
  for(var i=0;i<sd;i++) celdas += '<div class="dc dc-0"></div>';
  for(var d=1; d<=last; d++){
    var cell = days[String(d)] || '';
    var info = classifyCell(cell);
    var esHoy = esMesHoy && hoy.getDate()===d;
    var cls = 'dc' + (info.type && info.type!=='oth' ? ' dc-'+info.type : '') + (esHoy ? ' dc-hoy' : '');
    celdas += '<div class="'+cls+'" data-day="'+d+'">'+d
      + (cell ? '<div class="dc-code">'+cell+'</div>' : '')
      + '</div>';
  }
  var nombreMes = (typeof MESES!=='undefined' && MESES[m]) ? MESES[m] : (m+1);
  return '<div class="p-cal-nav"><div></div><div class="p-cal-nav-lbl">'+nombreMes+' '+y+'</div><div></div></div>'
    + '<div class="p-cal-wd"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>'
    + '<div class="p-cal-days">'+celdas+'</div>'
    + '<div class="p-cal-legend">'
      + '<span><span class="dot" style="background:#93C5FD"></span>Turno</span>'
      + '<span><span class="dot" style="background:#86EFAC"></span>Descanso</span>'
      + '<span><span class="dot" style="background:#FCD34D"></span>Franco/Res.</span>'
      + '<span><span class="dot" style="background:#F9A8D4"></span>DOP</span>'
    + '</div>'
    + '<div class="p-day-detail" id="pCalDayDetail" style="display:none"></div>';
}
function renderProfile([id, name, days, sede, horasTotales, horasEF, horasPR, jorProrr, pagina, horasCI, horasCO, rutaPorDia]){
  let items = '';
  for(let d=1; d<=31; d++){
    const cell = days[String(d)] || '';
    const info = classifyCell(cell);
    const tag = TAG_LABEL[info.type] || 'OTROS';
    items += `<div class="tl-item ${info.off?'off':''}" data-day="${d}">
      <div class="tl-rail">
        <div class="tl-node"><span class="tnum">${d}</span><span class="twd">${weekdayForDay(d)}</span></div>
        <div class="tl-line"></div>
      </div>
      <div class="tl-card">
        <div class="tl-card-top">
          <span class="tl-tag tag-${info.type}">${tag}</span>
          <span class="tl-arr">›</span>
        </div>
        <div class="tl-val">${cell || '—'}</div>
      </div>
    </div>`;
  }
  // NUEVO — resumen de horas del mes, igual que en la maqueta de
  // verificación: Horas Totales / EF (efectivas) / PR (presencia) /
  // Jor. Prorr. (jornada prorrateada). Si algún dato no se pudo leer
  // del PDF para este compañero, se omite esa tarjeta en vez de
  // mostrar un hueco vacío.
  const stats = [
    ['Horas Totales', horasTotales],
    ['Horas EF', horasEF],
    ['Horas PR', horasPR],
    ['Jor. Prorr.', jorProrr],
  ].filter(([,v]) => v);
  const statsHtml = stats.length ? `
      <div class="p-stats">
        ${stats.map(([lbl,val])=>`<div class="p-stat"><div class="p-stat-val">${val}</div><div class="p-stat-lbl">${lbl}</div></div>`).join('')}
      </div>` : '';
  viewEl.innerHTML = `
    <div class="profile">
      <button class="p-back" id="backBtn">‹ Volver a la búsqueda</button>
      <div class="p-head">
        <div class="p-av">${initials(name)}</div>
        <div>
          <div class="p-name">${name}</div>
          ${id ? `<div class="p-id">ID ${id}</div>` : ''}
        </div>
      </div>
      ${statsHtml}
      ${pagina ? `<div class="p-meta">Página ${pagina} del PDF del Horario General</div>` : ''}
      <div class="p-legend">
        <span class="p-leg"><span class="dot dot-ord"></span>Turno</span>
        <span class="p-leg"><span class="dot dot-des"></span>Descanso</span>
        <span class="p-leg"><span class="dot dot-res"></span>Franco / Reserva</span>
        <span class="p-leg"><span class="dot dot-dop"></span>DOP</span>
        <span class="p-leg"><span class="dot dot-oth"></span>Otros</span>
      </div>
      <button id="btnCompararAqui" style="width:100%;margin:4px 0 8px;padding:10px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:10px;color:#6ee7b7;font-size:12px;font-weight:700;cursor:pointer">📊 Comparar mi horario con el suyo aquí</button>
      <div id="compararAquiZone"></div>
      ${(typeof perfilAdminActual!=='undefined' && perfilAdminActual && perfilAdminActual.rol==='admin')
        ? `<button id="btnImportarComp" style="width:100%;margin:4px 0 10px;padding:10px;background:rgba(37,99,235,.12);border:1px solid rgba(37,99,235,.35);border-radius:10px;color:#93c5fd;font-size:12px;font-weight:700;cursor:pointer">👤 (Admin) Ver su horario junto al mío en el Calendario</button>`
        : ''}
      <div class="toggle-view">
        <button id="btnVistaLista" class="on">📋 Lista</button>
        <button id="btnVistaCalendario">🗓️ Calendario</button>
      </div>
      <div class="hint-empty" id="hintVistaLista" style="padding:0 4px 12px;text-align:left;font-size:11px;">Toca un día en la línea de tiempo para ver con quién compartes ese turno.</div>
      <div class="timeline" id="vistaListaZone">${items}</div>
      <div id="vistaCalendarioZone" style="display:none">${_renderProfileCalendarioHTML(days)}</div>
      <div id="compZone"></div>
    </div>
  `;
  document.getElementById('backBtn').addEventListener('click', ()=>{ doSearch(); });
  var btnImpComp = document.getElementById('btnImportarComp');
  if(btnImpComp) btnImpComp.addEventListener('click', ()=>{ importarComoCompanero(id, name, days, horasCI, horasCO, rutaPorDia); });
  var btnCompararAqui = document.getElementById('btnCompararAqui');
  if(btnCompararAqui) btnCompararAqui.addEventListener('click', ()=>{ compararAquiEnBuscador(id, name, days); });
  viewEl.querySelectorAll('.tl-item').forEach(item=>{
    item.addEventListener('click', ()=>{
      const d = parseInt(item.dataset.day, 10);
      const cell = days[String(d)] || '';
      renderCompanions(d, id, name, cell);
      viewEl.querySelectorAll('.tl-item').forEach(r=>{
        r.classList.remove('sel');
        r.querySelector('.tl-arr').textContent = '›';
      });
      item.classList.add('sel');
      item.querySelector('.tl-arr').textContent = '▾';
      document.getElementById('compZone').scrollIntoView({behavior:'smooth', block:'nearest'});
    });
  });
  // NUEVO — toggle Lista/Calendario: solo alterna qué zona se ve, no
  // vuelve a pedir ni a construir nada — ambas vistas ya están
  // pintadas de una vez arriba.
  var btnVistaLista = document.getElementById('btnVistaLista');
  var btnVistaCalendario = document.getElementById('btnVistaCalendario');
  var zonaLista = document.getElementById('vistaListaZone');
  var zonaCalendario = document.getElementById('vistaCalendarioZone');
  var hintLista = document.getElementById('hintVistaLista');
  if(btnVistaLista && btnVistaCalendario){
    btnVistaLista.addEventListener('click', function(){
      btnVistaLista.classList.add('on'); btnVistaCalendario.classList.remove('on');
      zonaLista.style.display=''; zonaCalendario.style.display='none';
      if(hintLista) hintLista.style.display='';
    });
    btnVistaCalendario.addEventListener('click', function(){
      btnVistaCalendario.classList.add('on'); btnVistaLista.classList.remove('on');
      zonaCalendario.style.display=''; zonaLista.style.display='none';
      if(hintLista) hintLista.style.display='none';
    });
  }
  // NUEVO — tocar un día en la cuadrícula hace exactamente lo mismo
  // que tocarlo en la lista: muestra el detalle del día y quién más
  // comparte ese tren (mismo renderCompanions() de siempre).
  viewEl.querySelectorAll('.p-cal-days .dc[data-day]').forEach(function(cellEl){
    cellEl.addEventListener('click', function(){
      var d = parseInt(cellEl.dataset.day, 10);
      var cell = days[String(d)] || '';
      var detalle = document.getElementById('pCalDayDetail');
      if(detalle){
        detalle.style.display = '';
        detalle.innerHTML = '<div class="p-day-detail-hdr">'+weekdayForDay(d)+' '+d+'</div>'
          + '<div class="p-day-detail-val">'+(cell || 'Sin turno registrado')+'</div>';
      }
      viewEl.querySelectorAll('.p-cal-days .dc[data-day]').forEach(function(r){ r.style.outline=''; });
      cellEl.style.outline = '2px solid var(--acc2)';
      renderCompanions(d, id, name, cell);
      document.getElementById('compZone').scrollIntoView({behavior:'smooth', block:'nearest'});
    });
  });
}

function renderCompanions(day, id, name, cell){
  const zone = document.getElementById('compZone');
  const info = classifyCell(cell);
  const wd = weekdayForDay(day);
  if(info.off || !cell){
    zone.innerHTML = `<div class="comp-wrap">
      <div class="comp-hdr"><span class="ct">${wd} ${day}</span><span class="cs">· sin tren asignado ese día</span></div>
      <div class="comp-none">Ese día tienes <b>${cell || 'sin turno registrado'}</b>, así que no hay tren que compartir con nadie.</div>
    </div>`;
    return;
  }
  const companions = findCompanions(day, id, name, cell);

  // ── NUEVO: buscar también el/los interventor(es) de ese mismo tren ese día ──
  // Esta vista de "Buscar por nombre" asume siempre julio de 2026 (igual que
  // weekdayForDay), así que se construye la fecha real con ese mismo supuesto
  // para poder cruzar contra los servicios de Interventor cargados.
  const fechaParaInterventor = new Date(2026, 7, day); // FIX: agosto, no julio
  const trenesDelDia = [...trainTokens(cell)];
  let interventorMatches = [];
  for(const t of trenesDelDia){
    interventorMatches.push(...buscarInterventor(t, fechaParaInterventor));
  }
  // dedupe (un mismo interventor puede salir por más de un token de tren)
  const vistos = new Set();
  interventorMatches = interventorMatches.filter(m=>{
    const k = m.id+'|'+m.name+'|'+m.servicio;
    if(vistos.has(k)) return false;
    vistos.add(k); return true;
  });

  if(companions.length===0 && interventorMatches.length===0){
    zone.innerHTML = `<div class="comp-wrap">
      <div class="comp-hdr"><span class="ct">${wd} ${day}</span><span class="cs">· ${cell}</span></div>
      <div class="comp-none">Nadie más coincide contigo en ese tren <b>${wd} ${day}</b> según la plantilla, ni hay ningún interventor cargado para ese tren.</div>
    </div>`;
    return;
  }
  const partes = [];
  if(interventorMatches.length) partes.push(`${interventorMatches.length} interventor(es)`);
  if(companions.length) partes.push(`${companions.length} compañero(s)`);
  let html = `<div class="comp-wrap">
    <div class="comp-hdr"><span class="ct">${wd} ${day}</span><span class="cs">· ${partes.join(' · ')} · ${cell}</span></div>
    <div class="comp-list">`;
  for(const m of interventorMatches){
    html += `<div class="pcard" style="cursor:default;border-color:var(--nar);background:rgba(249,115,22,.08)">
      <div class="pcard-av" style="background:rgba(249,115,22,.18);color:var(--nar2)">🎫</div>
      <div class="pcard-info">
        <div class="pcard-name">${ofuscarNombreInterventor(m.name)}</div>
        <div class="pcard-id" style="color:var(--nar2);font-weight:700">INTERVENTOR · ${m.servicio}</div>
        <div class="comp-cell">${m.cell}</div>
      </div>
    </div>`;
  }
  for(const c of companions){
    html += `<div class="pcard" style="cursor:default">
      <div class="pcard-av">${initials(c.name)}</div>
      <div class="pcard-info">
        <div class="pcard-name">${c.name}</div>
        ${c.id ? `<div class="pcard-id">ID ${c.id}${c.sede ? ' · '+c.sede : ''}</div>` : ''}
        ${trenBadgeHTML(c.trenesCompartidos)}
        ${umDhBadgesHTML(c.trenesCompartidos)}
        ${trenIdaVueltaBadgeHTML(c.cell, ((c.trenesCompartidos[0]||'').match(/\d{2,6}/)||[''])[0])}
        ${_progresoHorarioHTML(c.horaCI, c.horaCO, day)}
        <div class="comp-cell">${c.cell}</div>
      </div>
    </div>`;
  }
  html += '</div></div>';
  zone.innerHTML = html;
}

function doSearch(){
  if(!activeBase) return;
  const q = qInput.value.trim().toUpperCase();
  clearBtn.style.display = q ? 'block' : 'none';
  if(q.length < 2){ renderEmptyHint(); return; }
  const matches = activeBase.data.filter(([id,name]) => name.toUpperCase().includes(q)).slice(0, 40);
  renderList(matches, qInput.value.trim());
}

qInput.addEventListener('input', doSearch);
clearBtn.addEventListener('click', ()=>{
  qInput.value = '';
  clearBtn.style.display = 'none';
  renderEmptyHint();
  qInput.focus();
});



/* ═══════════════════════════════════════════════════════════
   COPIA — Buscador de Compañeros para INTERVENTOR (q2/clearBtn2/
   view2). Es una copia deliberada de la pantalla de tripulante,
   para poder modificarla sin riesgo de romper la de tripulación.
   Envuelta en su propia función para que sus nombres internos
   (renderList, doSearch, etc.) no choquen con los de arriba.
   Comparte los MISMOS datos (activeBase, classifyCell,
   weekdayForDay, findCompanions...) — esa parte NO se duplica.
═══════════════════════════════════════════════════════════ */
(function(){
const qInput = document.getElementById('q2');
const clearBtn = document.getElementById('clearBtn2');
const viewEl = document.getElementById('view2');

function renderEmptyHint(){
  viewEl.innerHTML = `<div class="hint-empty">Escribe al menos <b>2 letras</b> del nombre de un compañero de <b>${activeBase ? activeBase.label : ''}</b> para ver su turno.</div>`;
}

function renderList(matches, query){
  if(matches.length===0){
    viewEl.innerHTML = `<div class="hint-empty">Sin resultados para "<b>${query}</b>" en ${activeBase.label}.</div>`;
    return;
  }
  const _render = ()=>{
  let html = '<div class="list">';
  for(const [id, name] of matches){
    html += `<div class="pcard perfil-companero" data-id="${id}" data-name="${encodeURIComponent(name)}">
      <img class="pcard-avatar-img" src="${AVATAR_PLACEHOLDER}" alt="">
      <div class="pcard-info">
        <span class="pcard-name-full">${name}</span>
        ${id ? `<div class="pcard-id">ID ${id}</div>` : ''}
      </div>
      <div class="pcard-arr">›</div>
    </div>`;
  }
  html += '</div>';
  viewEl.innerHTML = html;
  viewEl.querySelectorAll('.pcard[data-id]').forEach(card=>{
    card.addEventListener('click', ()=>{
      const id = card.dataset.id;
      const name = decodeURIComponent(card.dataset.name);
      const entry = activeBase.data.find(e => e[0]===id && e[1]===name);
      if(entry) renderProfile(entry);
    });
  });
  };
  mostrarConAnimacionTren(viewEl, _render);
}

const TAG_LABEL = {ord:'TURNO', des:'DESCANSO', res:'FRANCO/RES.', dop:'DOP', oth:'OTROS'};
function renderProfile([id, name, days, sede, horasTotales, horasEF, horasPR, jorProrr, pagina]){
  let items = '';
  for(let d=1; d<=31; d++){
    const cell = days[String(d)] || '';
    const info = classifyCell(cell);
    const tag = TAG_LABEL[info.type] || 'OTROS';
    items += `<div class="tl-item ${info.off?'off':''}" data-day="${d}">
      <div class="tl-rail">
        <div class="tl-node"><span class="tnum">${d}</span><span class="twd">${weekdayForDay(d)}</span></div>
        <div class="tl-line"></div>
      </div>
      <div class="tl-card">
        <div class="tl-card-top">
          <span class="tl-tag tag-${info.type}">${tag}</span>
          <span class="tl-arr">›</span>
        </div>
        <div class="tl-val">${cell || '—'}</div>
      </div>
    </div>`;
  }
  // NUEVO — resumen de horas del mes, igual que en la maqueta de
  // verificación: Horas Totales / EF (efectivas) / PR (presencia) /
  // Jor. Prorr. (jornada prorrateada). Si algún dato no se pudo leer
  // del PDF para este compañero, se omite esa tarjeta en vez de
  // mostrar un hueco vacío.
  const stats = [
    ['Horas Totales', horasTotales],
    ['Horas EF', horasEF],
    ['Horas PR', horasPR],
    ['Jor. Prorr.', jorProrr],
  ].filter(([,v]) => v);
  const statsHtml = stats.length ? `
      <div class="p-stats">
        ${stats.map(([lbl,val])=>`<div class="p-stat"><div class="p-stat-val">${val}</div><div class="p-stat-lbl">${lbl}</div></div>`).join('')}
      </div>` : '';
  viewEl.innerHTML = `
    <div class="profile">
      <button class="p-back" id="backBtn">‹ Volver a la búsqueda</button>
      <div class="p-head">
        <div class="p-av">${initials(name)}</div>
        <div>
          <div class="p-name">${name}</div>
          ${id ? `<div class="p-id">ID ${id}</div>` : ''}
        </div>
      </div>
      ${statsHtml}
      ${pagina ? `<div class="p-meta">Página ${pagina} del PDF del Horario General</div>` : ''}
      <div class="p-legend">
        <span class="p-leg"><span class="dot dot-ord"></span>Turno</span>
        <span class="p-leg"><span class="dot dot-des"></span>Descanso</span>
        <span class="p-leg"><span class="dot dot-res"></span>Franco / Reserva</span>
        <span class="p-leg"><span class="dot dot-dop"></span>DOP</span>
        <span class="p-leg"><span class="dot dot-oth"></span>Otros</span>
      </div>
      <div class="hint-empty" style="padding:0 4px 12px;text-align:left;font-size:11px;">Toca un día en la línea de tiempo para ver con quién compartes ese turno.</div>
      <div class="timeline">${items}</div>
      <div id="compZone"></div>
    </div>
  `;
  document.getElementById('backBtn').addEventListener('click', ()=>{ doSearch(); });
  viewEl.querySelectorAll('.tl-item').forEach(item=>{
    item.addEventListener('click', ()=>{
      const d = parseInt(item.dataset.day, 10);
      const cell = days[String(d)] || '';
      renderCompanions(d, id, name, cell);
      viewEl.querySelectorAll('.tl-item').forEach(r=>{
        r.classList.remove('sel');
        r.querySelector('.tl-arr').textContent = '›';
      });
      item.classList.add('sel');
      item.querySelector('.tl-arr').textContent = '▾';
      document.getElementById('compZone').scrollIntoView({behavior:'smooth', block:'nearest'});
    });
  });
}

function doSearch(){
  if(!activeBase) return;
  const q = qInput.value.trim().toUpperCase();
  clearBtn.style.display = q ? 'block' : 'none';
  if(q.length < 2){ renderEmptyHint(); return; }
  const matches = activeBase.data.filter(([id,name]) => name.toUpperCase().includes(q)).slice(0, 40);
  renderList(matches, qInput.value.trim());
}

qInput.addEventListener('input', doSearch);
clearBtn.addEventListener('click', ()=>{
  qInput.value = '';
  clearBtn.style.display = 'none';
  renderEmptyHint();
  qInput.focus();
});

/* ═══════════════════════════════════════════════════════════
   NUEVO — Confirmado por el usuario: "Solicitar cambio de turno".
   REGLA DE ORO de esta función: NUNCA escribe en TV/TV2 (lo que
   cuenta de verdad para Nómina/HP/HE/HTDL) — solo lee de ahí para
   mostrar el detalle, y guarda avisos visuales APARTE
   (localStorage 'cambiosTurnoVisual'), sin tocar ni recalcular
   nada de lo que ya existe.
═══════════════════════════════════════════════════════════ */

// ── 1) Construir el detalle completo de UN día propio, leyendo
//    TV/TV2 tal cual ya existen (misma lógica de pernocta que ya
//    comprobamos con datos de prueba: modo + diaSiguiente). ──
// FIX — Confirmado por el usuario: bug real de raíz. TV NO se indexa
// por el día suelto ("15") como yo asumía — se indexa con la clave
// real de la app, key(anio,mes,dia) → "2026-09-15" (ver key() en el
// propio código). Buscar solo por "15" nunca encontraba nada, en
// NINGÚN día — por eso la sincronización siempre estaba vacía. Ahora
// recibe año y mes explícitos y usa la misma key() que usa el resto
// de la app. De paso, se añade el caso que faltaba: "ida y vuelta el
// mismo día" (sin pernocta) guarda el segundo tramo en el MISMO día
// con numTrenVuelta/hF2/hL2, en vez de en un día aparte.
function construirDetalleDiaPropio(anio, mes, dia){
  var k = (typeof key==='function') ? key(anio, mes, dia) : (anio+'-'+String(mes).padStart(2,'0')+'-'+String(dia).padStart(2,'0'));
  var t = (typeof TV !== 'undefined') ? TV[k] : null;
  if(!t) return null;
  var esPernocta = (t.modo === 'pernocta' || t.modo === 'pernocta3');
  var turnos = [];
  if(t.numTren) turnos.push({ numTren: t.numTren, horaCI: t.hF || null, horaCO: (esPernocta ? null : (t.hL||null)) });
  // NUEVO — "ida y vuelta el mismo día" (sin pernocta): el segundo
  // tramo vive en el MISMO día, como numTrenVuelta/hF2/hL2.
  if(!esPernocta && t.numTrenVuelta) turnos.push({ numTren: t.numTrenVuelta, horaCI: t.hF2||null, horaCO: t.hL2||null });
  // Turnos adicionales del mismo día (TV2) — varios servicios sueltos.
  if(typeof TV2 !== 'undefined' && TV2[k] && TV2[k].length){
    TV2[k].forEach(function(t2){
      if(t2 && t2.numTren) turnos.push({ numTren: t2.numTren, horaCI: t2.hF||null, horaCO: t2.hL||null });
    });
  }
  var diaVuelta = null, turnosVuelta = [];
  if(esPernocta && t.diaSiguiente){
    // t.diaSiguiente YA es una key completa ("2026-09-16"), no un
    // número de día suelto — se usa tal cual para buscar en TV/TV2.
    var tv = TV[t.diaSiguiente];
    if(tv && tv.numTren) turnosVuelta.push({ numTren: tv.numTren, horaCI: tv.hF||null, horaCO: tv.hL||null });
    if(typeof TV2 !== 'undefined' && TV2[t.diaSiguiente] && TV2[t.diaSiguiente].length){
      TV2[t.diaSiguiente].forEach(function(t2){
        if(t2 && t2.numTren) turnosVuelta.push({ numTren: t2.numTren, horaCI: t2.hF||null, horaCO: t2.hL||null });
      });
    }
    // Solo para MOSTRAR ("incluye la vuelta del día 27") se extrae el
    // número de día suelto de la key completa — el resto de la app
    // sigue usando SIEMPRE la key completa para buscar en TV.
    var partesFecha = t.diaSiguiente.split('-');
    diaVuelta = parseInt(partesFecha[2], 10);
  }
  // NUEVO — Confirmado por el usuario: los días SIN tren (descanso,
  // vacaciones, comp, baja...) también tienen que poder elegirse para
  // un cambio ("cambio un libre por un turno, o al revés") — antes
  // esta función devolvía null y esos días quedaban invisibles del
  // todo para "Solicitar cambio de turno".
  var esLibre = false, tipoLibreLbl = null;
  if(!turnos.length && !turnosVuelta.length){
    if(t.tipo && typeof TIPO_INFO!=='undefined' && TIPO_INFO[t.tipo]){
      esLibre = true;
      tipoLibreLbl = TIPO_INFO[t.tipo].ico + ' ' + TIPO_INFO[t.tipo].lbl;
    } else {
      return null; // día realmente vacío, sin nada guardado
    }
  }
  return { dia: dia, esPernocta: esPernocta, diaVuelta: diaVuelta, turnos: turnos, turnosVuelta: turnosVuelta, esLibre: esLibre, tipoLibreLbl: tipoLibreLbl };
}

// ── 2) Subir en silencio el detalle del mes actual a la nube, para
//    que los compañeros puedan verlo con detalle al pedir un cambio.
//    Se llama al entrar a Calendario — nunca bloquea la pantalla, y
//    si falla (sin conexión, tabla no creada aún...) no avisa con
//    ningún error visible, solo queda registrado en consola. ──
var _sincronizandoTurnos = false;
async function sincronizarTurnosDetalle(){
  if(_sincronizandoTurnos) return;
  if(!sbAdmin || !AJ || !AJ.matricula) return;
  _sincronizandoTurnos = true;
  try{
    var anioActual = (typeof curM!=='undefined' && curM) ? curM.getFullYear() : new Date().getFullYear();
    var mesActual = (typeof curM!=='undefined' && curM) ? (curM.getMonth()+1) : (new Date().getMonth()+1);
    var filas = [];
    for(var d=1; d<=31; d++){
      var det = construirDetalleDiaPropio(anioActual, mesActual, d);
      if(!det) continue;
      filas.push({
        matricula: AJ.matricula,
        anio: anioActual,
        mes: mesActual,
        dia: d,
        detalle: det,
        actualizado_en: new Date().toISOString()
      });
    }
    // FIX — Confirmado por el usuario: antes, si no había NADA que
    // subir, se salía en silencio sin dejar ningún rastro — ahora
    // queda constancia en consola para poder diagnosticarlo (¿TV
    // vacío ese mes? ¿mes equivocado?).
    if(!filas.length){ console.warn('sincronizarTurnosDetalle: no hay ningún turno en TV para', mesActual+'/'+anioActual, '— nada que subir.'); return; }
    var rSync = await sbAdmin.from('turnos_sincronizados').upsert(filas, { onConflict: 'matricula,anio,mes,dia' });
    if(rSync && rSync.error){ console.error('sincronizarTurnosDetalle: Supabase rechazó la subida:', rSync.error.message); }
    else { console.log('sincronizarTurnosDetalle: subidos', filas.length, 'días para', mesActual+'/'+anioActual); }
  }catch(e){ console.warn('sincronizarTurnosDetalle:', e); }
  finally{ _sincronizandoTurnos = false; }
}
window.sincronizarTurnosDetalle = sincronizarTurnosDetalle;

// ── 3) Traer el detalle de un día del COMPAÑERO desde la nube.
//    Si todavía no lo ha sincronizado, se avisa claramente en vez
//    de fingir que hay más información de la que hay. ──
async function obtenerDetalleDiaCompanero(matricula, anio, mes, dia){
  if(!sbAdmin) return { encontrado:false, motivo:'sin_conexion' };
  try{
    var r = await sbAdmin.from('turnos_sincronizados').select('detalle').eq('matricula', matricula).eq('anio', anio).eq('mes', mes).eq('dia', dia).maybeSingle();
    if(r.error || !r.data) return { encontrado:false, motivo:'no_sincronizado' };
    return { encontrado:true, detalle: r.data.detalle };
  }catch(e){ return { encontrado:false, motivo:'error' }; }
}

// ── 4) Formulario "Nueva solicitud" — estado propio, aparte del
//    resto del buscador de Compañeros (mismo espíritu que
//    calTrenPanelHora2 con Interventor: no reutiliza directamente
//    las variables de otras pantallas para no interferir con ellas). ──
var _nscCompElegido = null; // {matricula, nombre}
var _nscModoSelector = null; // 'mio' | 'suyo'
var _nscMiDia = null;
var _nscSuDia = null;
var _nscMiDetalle = null;
var _nscSuDetalle = null;

function abrirNuevaSolicitudCambio(){
  // FIX — Confirmado por el usuario: antes esto mandaba a la persona
  // a la pestaña Compañeros (podía confundir, "¿por qué me cambió de
  // pantalla?"). Ahora se queda en Calendario en todo momento: la
  // carga de datos (abrirAccesoBuscadorCompaneros) no necesita estar
  // en esa pestaña para funcionar — solo trae datos por detrás, o
  // como mucho abre su propio aviso de matrícula ENCIMA (los avisos
  // .ov ya funcionan así, cubren toda la pantalla sea cual sea la
  // pestaña activa debajo). En cuanto activeBase esté listo, este
  // formulario se abre solo, automáticamente.
  if(!activeBase){
    if(typeof toast==='function') toast('Cargando compañeros...');
    if(typeof abrirAccesoBuscadorCompaneros==='function') abrirAccesoBuscadorCompaneros();
    _nscEsperarActiveBaseYAbrir();
    return;
  }
  _nscCompElegido = null; _nscMiDia = null; _nscSuDia = null; _nscMiDetalle = null; _nscSuDetalle = null;
  document.getElementById('nscBuscarInput').value = '';
  document.getElementById('nscResultadosBusqueda').innerHTML = '';
  document.getElementById('nscCompSeleccionado').style.display = 'none';
  document.getElementById('nscMiDiaSelector').innerHTML = '<span style="font-size:12px;color:var(--tx3)">Toca para elegir el día...</span>';
  document.getElementById('nscMiDiaDetalle').innerHTML = '';
  document.getElementById('nscSuDiaSelector').innerHTML = '<span style="font-size:12px;color:var(--tx3)">Primero elige con quién...</span>';
  document.getElementById('nscSuDiaSelector').style.opacity = '.5';
  document.getElementById('nscSuDiaDetalle').innerHTML = '';
  document.getElementById('nscMensajeInput').value = '';
  document.getElementById('nscEstado').innerHTML = '';
  var sedeTxt = (activeBase && activeBase.label) ? activeBase.label : '—';
  document.getElementById('nscHdrSede').textContent = sedeTxt;
  openOv('ov-nueva-solicitud-cambio');
}
window.abrirNuevaSolicitudCambio = abrirNuevaSolicitudCambio;

// NUEVO — Confirmado por el usuario: espera en segundo plano (sin
// mover a la persona de pantalla) a que activeBase quede cargado —
// venga porque ya estaba validado de antes (carga silenciosa) o
// porque acaba de rellenar el aviso de matrícula que apareció
// encima — y entonces abre el formulario solo, automáticamente.
var _nscEsperandoActiveBase = false;
function _nscEsperarActiveBaseYAbrir(){
  if(_nscEsperandoActiveBase) return;
  _nscEsperandoActiveBase = true;
  var intentos = 0;
  var intervalo = setInterval(function(){
    intentos++;
    if(activeBase){
      clearInterval(intervalo);
      _nscEsperandoActiveBase = false;
      abrirNuevaSolicitudCambio();
      return;
    }
    // ~2 minutos de margen (da tiempo de sobra a escribir la
    // matrícula la primera vez) — pasado eso, se deja de intentar
    // en silencio, sin ningún aviso molesto de "tiempo agotado".
    if(intentos > 240){
      clearInterval(intervalo);
      _nscEsperandoActiveBase = false;
    }
  }, 500);
}

document.getElementById('nscBuscarInput').addEventListener('input', function(){
  var q = this.value.trim().toUpperCase();
  var cont = document.getElementById('nscResultadosBusqueda');
  if(q.length<2 || !activeBase){ cont.innerHTML=''; return; }
  var matches = activeBase.data.filter(function(e){ return e[1].toUpperCase().includes(q); }).slice(0,8);
  cont.innerHTML = matches.map(function(m){
    return '<div class="ct-pcard-mini" style="cursor:pointer" onclick="_nscElegirCompanero(\''+m[0]+'\',\''+m[1].replace(/'/g,"\\'")+'\')">'
      + '<div class="ct-pcard-av">'+initials(m[1])+'</div>'
      + '<div class="ct-pcard-name">'+m[1]+'</div></div>';
  }).join('');
});

function _nscElegirCompanero(matricula, nombre){
  _nscCompElegido = { matricula: matricula, nombre: nombre };
  _nscSuDia = null; _nscSuDetalle = null;
  document.getElementById('nscResultadosBusqueda').innerHTML = '';
  document.getElementById('nscBuscarInput').value = '';
  var el = document.getElementById('nscCompSeleccionado');
  el.style.display = '';
  // FIX — Confirmado por el usuario: ahora se puede quitar el
  // compañero elegido por error (✕), sin perder el resto del
  // formulario ni tener que cerrarlo y empezar de cero.
  el.innerHTML = '<div class="ct-pcard-mini" style="justify-content:space-between">'
    + '<div style="display:flex;align-items:center;gap:10px"><div class="ct-pcard-av">'+initials(nombre)+'</div><div class="ct-pcard-name">'+nombre+'</div></div>'
    + '<div onclick="_nscQuitarCompanero()" style="color:var(--tx3);font-size:16px;cursor:pointer;padding:0 4px">✕</div></div>';
  var suSel = document.getElementById('nscSuDiaSelector');
  suSel.style.opacity = '1';
  suSel.innerHTML = '<span style="font-size:12px;color:var(--tx3)">Toca para ver su horario...</span>';
  document.getElementById('nscSuDiaDetalle').innerHTML = '';
}
window._nscElegirCompanero = _nscElegirCompanero;

// FIX — Confirmado por el usuario: deshacer la elección del
// compañero (por si se equivocó), volviendo a mostrar el buscador.
function _nscQuitarCompanero(){
  _nscCompElegido = null; _nscSuDia = null; _nscSuDetalle = null;
  document.getElementById('nscCompSeleccionado').style.display = 'none';
  document.getElementById('nscCompSeleccionado').innerHTML = '';
  var suSel = document.getElementById('nscSuDiaSelector');
  suSel.style.opacity = '.5';
  suSel.innerHTML = '<span style="font-size:12px;color:var(--tx3)">Primero elige con quién...</span>';
  document.getElementById('nscSuDiaDetalle').innerHTML = '';
  document.getElementById('nscBuscarInput').focus();
}
window._nscQuitarCompanero = _nscQuitarCompanero;

function _nscElegirMiDia(){
  _nscModoSelector = 'mio';
  document.getElementById('nscCalTit').textContent = 'Elige tu día';
  openOv('ov-nsc-calendario');
  _nscPintarCalendario();
}
window._nscElegirMiDia = _nscElegirMiDia;
function _nscElegirSuDia(){
  if(!_nscCompElegido){ return; }
  // FIX — Confirmado por el usuario: antes había que ir probando
  // día a día a ciegas. Ahora se trae de golpe TODO lo que el
  // compañero ya sincronizó ese mes, y se elige directamente de
  // una lista con el resumen de cada día.
  document.getElementById('nscCalTit').textContent = 'Horario de '+_nscCompElegido.nombre;
  var panel = document.getElementById('nscCalPanel');
  panel.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Cargando su horario...</div>';
  openOv('ov-nsc-calendario');
  var anioActual = (typeof curM!=='undefined' && curM) ? curM.getFullYear() : new Date().getFullYear();
  var mesActual = (typeof curM!=='undefined' && curM) ? (curM.getMonth()+1) : (new Date().getMonth()+1);
  sbAdmin.from('turnos_sincronizados').select('dia,detalle').eq('matricula', _nscCompElegido.matricula).eq('anio', anioActual).eq('mes', mesActual).order('dia',{ascending:true}).then(function(r){
    // FIX — Confirmado por el usuario: antes, un error real de
    // Supabase (tabla mal creada, política RLS, sin conexión...) se
    // trataba igual que "simplemente no ha sincronizado" — ahora se
    // distingue y se muestra el motivo real.
    if(r && r.error){
      panel.innerHTML = '<div style="padding:14px;text-align:center;color:var(--nar3);font-size:12px">⚠️ Error consultando Supabase: '+r.error.message+'</div>';
      console.error('_nscElegirSuDia:', r.error);
      return;
    }
    var filas = (r && r.data) || [];
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    filas = filas.filter(function(f){
      var fechaFila = new Date(anioActual, mesActual-1, f.dia);
      return fechaFila >= hoy;
    });
    if(!filas.length){
      panel.innerHTML = '<div style="padding:14px;text-align:center;color:var(--nar3);font-size:12px">⚠️ '+_nscCompElegido.nombre+' todavía no ha sincronizado ningún día futuro de este mes ('+mesActual+'/'+anioActual+') — pídele que abra su Calendario primero.</div>';
      return;
    }
    panel.innerHTML = filas.map(function(f){
      var det = f.detalle;
      var resumen = _resumenTurno(det);
      return '<div class="ct-pcard-mini" style="cursor:pointer;justify-content:space-between" onclick="_nscElegirDiaDeCompanero('+f.dia+')">'
        + '<div><div class="ct-pcard-name">Día '+f.dia+'</div><div style="font-size:10.5px;color:var(--tx3);margin-top:2px">'+resumen+'</div></div>'
        + '<div style="color:var(--tx3);font-size:15px">›</div></div>';
    }).join('');
    // Se guarda para poder recuperar el detalle exacto al elegir un día.
    window._nscDiasSuyosCache = {};
    filas.forEach(function(f){ window._nscDiasSuyosCache[f.dia] = f.detalle; });
  });
}
window._nscElegirSuDia = _nscElegirSuDia;

function _nscElegirDiaDeCompanero(dia){
  closeOv('ov-nsc-calendario');
  var anioActual = (typeof curM!=='undefined' && curM) ? curM.getFullYear() : new Date().getFullYear();
  var mesActual = (typeof curM!=='undefined' && curM) ? (curM.getMonth()+1) : (new Date().getMonth()+1);
  var det = (window._nscDiasSuyosCache||{})[dia];
  if(!det) return;
  _nscSuDia = { dia:dia, mes:mesActual, anio:anioActual };
  _nscSuDetalle = det;
  var fechaFalsa = new Date(anioActual, mesActual-1, dia);
  _nscPintarDetalleDia('nscSuDiaSelector', 'nscSuDiaDetalle', fechaFalsa, det, false);
}
window._nscElegirDiaDeCompanero = _nscElegirDiaDeCompanero;

// NUEVO — Confirmado por el usuario: si ese día ya tiene un cambio
// de turno CONFIRMADO antes (aviso visual morado), "tu turno que
// ofreces" debe reflejar lo que tienes AHORA por ese cambio, no el
// turno original de TV — así se puede volver a cambiar ese mismo
// día con otro compañero, sin confundir cuál es el tren real actual.
function _nscDetalleConCambioVisualAplicado(anio, mes, dia, detOriginal){
  var visual = _leerCambiosVisual();
  var claveMes = anio + '-' + mes;
  var mesData = visual[claveMes];
  if(!mesData || !mesData[dia]) return { det: detOriginal, avisoCambioPrevio: null };
  var info = mesData[dia];
  if(info.tipo === 'recibido' && info.turnos){
    // Lo que tienes ahora ese día es lo que recibiste en el cambio.
    return { det: info.turnos, avisoCambioPrevio: 'Este día ya lo cambiaste con '+(info.con||'')+' — se usa lo que tienes ahora.' };
  }
  if(info.tipo === 'dado'){
    // Ya no tienes nada ese día — se lo diste a alguien.
    return { det: null, avisoCambioPrevio: 'Ya le diste este día a '+(info.con||'')+' en un cambio anterior — no tienes nada que ofrecer aquí.' };
  }
  return { det: detOriginal, avisoCambioPrevio: null };
}

function _nscPintarCalendario(){
  // Simplificado — Confirmado por el usuario: ahora esta función solo
  // se usa para "mi día" (propio); "su día" (el del compañero) usa la
  // vista previa de lista en _nscElegirSuDia()/_nscElegirDiaDeCompanero().
  var panel = document.getElementById('nscCalPanel');
  panel.innerHTML = '';
  generarCalendarioUI('nscCalPanel', function(fecha){
    closeOv('ov-nsc-calendario');
    var dia = fecha.getDate(), mes = fecha.getMonth()+1, anio = fecha.getFullYear();
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    if(fecha < hoy){
      var estadoEl = document.getElementById('nscEstado');
      estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Ese día ya pasó — elige un día futuro.</span>';
      return;
    }
    _nscMiDia = { dia:dia, mes:mes, anio:anio };
    var detOriginal = construirDetalleDiaPropio(anio, mes, dia);
    var resultado = _nscDetalleConCambioVisualAplicado(anio, mes, dia, detOriginal);
    _nscMiDetalle = resultado.det;
    _nscPintarDetalleDia('nscMiDiaSelector', 'nscMiDiaDetalle', fecha, resultado.det, true);
    if(resultado.avisoCambioPrevio){
      var elDet = document.getElementById('nscMiDiaDetalle');
      elDet.innerHTML += '<div style="font-size:10.5px;color:#c084fc;margin-top:6px;padding:8px 10px;background:rgba(124,58,237,.1);border-radius:8px">🔄 '+resultado.avisoCambioPrevio+'</div>';
    }
  });
}

function _nscPintarDetalleDia(idSelector, idDetalle, fecha, det, esMio){
  var dia = fecha.getDate(), mes = fecha.getMonth()+1;
  var titulo = weekdayForDay(dia)+' '+dia+' de '+MESES_CAL_TREN[mes-1].toLowerCase();
  document.getElementById(idSelector).innerHTML = '<div style="font-size:12px;font-weight:700">'+titulo+'</div>';
  var elDet = document.getElementById(idDetalle);
  if(!det){
    elDet.innerHTML = '<div style="padding:10px;font-size:11px;color:var(--tx3)">Sin nada registrado ese día. Elige otro día.</div>';
    return;
  }
  // NUEVO — Confirmado por el usuario: los días libres (descanso,
  // vacaciones, comp...) también se pueden elegir para el cambio.
  if(det.esLibre){
    document.getElementById(idDetalle).innerHTML = '<div class="ct-day-pick"><div class="ct-day-pick-turno" style="color:var(--tx2)">'+det.tipoLibreLbl+'</div></div>';
    return;
  }
  if(!det.turnos.length && !det.turnosVuelta.length){
    elDet.innerHTML = '<div style="padding:10px;font-size:11px;color:var(--tx3)">Sin turno registrado ese día. Elige otro día.</div>';
    return;
  }
  var html = '<div class="ct-day-pick">';
  det.turnos.forEach(function(t){
    html += '<div class="ct-day-pick-turno">🚆 Tren '+t.numTren+(t.horaCI?' · '+t.horaCI:'')+(t.horaCO?' → '+t.horaCO:'')+'</div>';
  });
  if(det.esPernocta && det.diaVuelta){
    html += '<div class="ct-pernocta-tag">🌙 Pernocta — incluye la vuelta del día '+det.diaVuelta+'</div>';
    det.turnosVuelta.forEach(function(t){
      html += '<div class="ct-day-pick-turno" style="margin-top:4px">🚆 Vuelta: Tren '+t.numTren+(t.horaCI?' · '+t.horaCI:'')+(t.horaCO?' → '+t.horaCO:'')+'</div>';
    });
  }
  html += '</div>';
  elDet.innerHTML = html;
}

async function enviarSolicitudCambioTurno(){
  var estadoEl = document.getElementById('nscEstado');
  if(!_nscCompElegido){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Elige un compañero primero.</span>'; return; }
  if(!_nscMiDia || !_nscMiDetalle){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Elige tu día.</span>'; return; }
  if(!_nscSuDia || !_nscSuDetalle){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Elige el día del compañero.</span>'; return; }
  if(!AJ || !AJ.matricula || !AJ.nombre){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Configura tu nombre y matrícula en Ajustes primero.</span>'; return; }
  estadoEl.innerHTML = '<span style="color:var(--tx3)">Enviando...</span>';
  try{
    var payload = {
      matricula_solicitante: AJ.matricula,
      nombre_solicitante: AJ.nombre,
      matricula_destino: _nscCompElegido.matricula,
      nombre_destino: _nscCompElegido.nombre,
      anio: _nscMiDia.anio,
      dia_ofrece: _nscMiDia.dia,
      dia_pide: _nscSuDia.dia,
      detalle_ofrece: _nscMiDetalle,
      detalle_pide: _nscSuDetalle,
      mensaje: document.getElementById('nscMensajeInput').value.trim() || null,
      estado: 'pendiente'
    };
    var r = await sbAdmin.from('cambios_turno').insert(payload);
    if(r.error){
      estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ No se pudo enviar (¿existe la tabla cambios_turno en Supabase?): '+r.error.message+'</span>';
      return;
    }
    estadoEl.innerHTML = '<span style="color:var(--green2)">✅ Solicitud enviada.</span>';
    // NUEVO — Confirmado por el usuario: aviso push a quien recibe la solicitud.
    _crearEventoPush(_nscCompElegido.matricula, 'Nueva solicitud de cambio', AJ.nombre+' te ha pedido un cambio de turno.');
    setTimeout(function(){ closeOv('ov-nueva-solicitud-cambio'); cargarCambiosTurno(); }, 900);
  }catch(e){
    estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Error: '+e.message+'</span>';
  }
}
window.enviarSolicitudCambioTurno = enviarSolicitudCambioTurno;

// ── 5) Bandeja: cargar recibidas + enviadas, y pintarlas ──
async function cargarCambiosTurno(){
  if(!sbAdmin || !AJ || !AJ.matricula) return;
  try{
    var recibidas = await sbAdmin.from('cambios_turno').select('*').eq('matricula_destino', AJ.matricula).eq('estado','pendiente').order('fecha_hora',{ascending:false});
    var enviadas = await sbAdmin.from('cambios_turno').select('*').eq('matricula_solicitante', AJ.matricula).order('fecha_hora',{ascending:false}).limit(20);
    // NUEVO — Confirmado por el usuario: antes, cuando TÚ aceptabas
    // el cambio de alguien, no había forma de volver a encontrar el
    // paso de "correo + confirmar" si cerrabas esa pantalla sin
    // terminarlo — esta consulta trae justo esos casos.
    var aceptadasPorMi = await sbAdmin.from('cambios_turno').select('*').eq('matricula_destino', AJ.matricula).eq('estado','aceptada').eq('confirmado_destino', false).order('fecha_hora',{ascending:false});
    var recibidasData = (recibidas && recibidas.data) || [];
    var enviadasData = (enviadas && enviadas.data) || [];
    var aceptadasPorMiData = (aceptadasPorMi && aceptadasPorMi.data) || [];

    var badge = document.getElementById('cambiosTurnoBadgeCount');
    var totalPendiente = recibidasData.length + aceptadasPorMiData.length;
    if(totalPendiente){ badge.style.display=''; badge.textContent = totalPendiente; }
    else { badge.style.display = 'none'; }

    var lblR = document.getElementById('cambiosTurnoRecibidasLbl');
    var contR = document.getElementById('cambiosTurnoRecibidas');
    lblR.style.display = (recibidasData.length || aceptadasPorMiData.length) ? '' : 'none';
    contR.innerHTML = recibidasData.map(function(s){ return _renderTarjetaCambioRecibido(s); }).join('')
      + aceptadasPorMiData.map(function(s){ return _renderTarjetaAceptadaPorMi(s); }).join('');

    var lblE = document.getElementById('cambiosTurnoEnviadasLbl');
    var contE = document.getElementById('cambiosTurnoEnviadas');
    lblE.style.display = enviadasData.length ? '' : 'none';
    contE.innerHTML = enviadasData.map(function(s){ return _renderTarjetaCambioEnviado(s); }).join('');

    // NUEVO — Confirmado por el usuario: banner arriba del todo, mismo
    // estilo que las notificaciones del Admin, para que se note de
    // verdad al entrar en Calendario (no solo el numerito).
    _renderBannerCambioTurno(recibidasData, enviadasData, aceptadasPorMiData);
  }catch(e){ console.warn('cargarCambiosTurno:', e); }
}
window.cargarCambiosTurno = cargarCambiosTurno;

// NUEVO — tarjeta para "ya acepté esto, pero me falta mandar el
// correo/confirmar en mi calendario" — mismo estilo que las demás.
function _renderTarjetaAceptadaPorMi(s){
  return '<div class="ct-req-card" style="padding:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center">'
    + '<div><div class="ct-req-name" style="font-size:12px">'+s.nombre_solicitante+'</div><div class="ct-req-sub">Día '+s.dia_ofrece+' ⇄ Día '+s.dia_pide+'</div></div>'
    + '<span class="ct-status-chip ct-status-ok">✅ Aceptado por ti</span>'
    + '</div>'
    + '<div class="ct-next-step-btn" onclick="mostrarPasosPostAceptacion('+s.id+')">Ver siguiente paso (confirmar en tu calendario)</div>'
    + '</div>';
}

function _renderBannerCambioTurno(recibidasData, enviadasData, aceptadasPorMiData){
  var zona = document.getElementById('notifBannerZonaCambioTurno');
  if(!zona) return;
  aceptadasPorMiData = aceptadasPorMiData || [];
  var aceptadasSinConfirmar = enviadasData.filter(function(s){ return s.estado==='aceptada' && !s.confirmado_solicitante; });
  var banners = '';
  if(recibidasData.length){
    banners += '<div class="nadm-banner" style="--nadm-bc:#7C3AED;--nadm-bg:rgba(124,58,237,.12);--nadm-tc:#c084fc" onclick="_abrirCambiosTurnoDesdeBanner()">'
      + '<div class="nadm-banner-ico">🔄</div>'
      + '<div style="flex:1">'
        + '<div class="nadm-banner-tit">'+recibidasData.length+' solicitud'+(recibidasData.length>1?'es':'')+' de cambio de turno</div>'
        + '<div class="nadm-banner-msg">Toca para ver quién te lo pide.</div>'
      + '</div>'
    + '</div>';
  }
  aceptadasSinConfirmar.forEach(function(s){
    banners += '<div class="nadm-banner" style="--nadm-bc:#16A34A;--nadm-bg:rgba(22,163,74,.12);--nadm-tc:#4ADE80" onclick="mostrarPasosPostAceptacion('+s.id+')">'
      + '<div class="nadm-banner-ico">✅</div>'
      + '<div style="flex:1">'
        + '<div class="nadm-banner-tit">'+s.nombre_destino+' aceptó tu cambio</div>'
        + '<div class="nadm-banner-msg">Toca para mandar el correo y confirmar en tu calendario.</div>'
      + '</div>'
    + '</div>';
  });
  // NUEVO — Confirmado por el usuario: el mismo aviso, pero para
  // cuando fuiste TÚ quien aceptó el cambio de otro y te falta
  // terminar el paso de correo + confirmar.
  aceptadasPorMiData.forEach(function(s){
    banners += '<div class="nadm-banner" style="--nadm-bc:#16A34A;--nadm-bg:rgba(22,163,74,.12);--nadm-tc:#4ADE80" onclick="mostrarPasosPostAceptacion('+s.id+')">'
      + '<div class="nadm-banner-ico">✅</div>'
      + '<div style="flex:1">'
        + '<div class="nadm-banner-tit">Aceptaste el cambio de '+s.nombre_solicitante+'</div>'
        + '<div class="nadm-banner-msg">Toca para confirmar en tu calendario.</div>'
      + '</div>'
    + '</div>';
  });
  // FIX — Confirmado por el usuario: se guarda en una variable
  // aparte en vez de pintar directo — así, si la carga de
  // publicaciones/ofertas termina antes o después que esta, ninguna
  // de las dos se pisa a la otra (ver _renderBannerCombinado()).
  _bannerCambiosTurnoHTML = banners;
  _renderBannerCombinado();
}
var _bannerCambiosTurnoHTML = '';
var _bannerPublicacionesHTML = '';
function _renderBannerCombinado(){
  var zona = document.getElementById('notifBannerZonaCambioTurno');
  if(!zona) return;
  zona.innerHTML = _bannerCambiosTurnoHTML + _bannerPublicacionesHTML;
}
function _abrirCambiosTurnoDesdeBanner(){
  var acc = document.getElementById('cambiosTurnoAcordeon');
  if(acc && acc.style.display === 'none') toggleCambiosTurnoAcordeon();
  var hdr = acc ? acc.previousElementSibling : null;
  if(hdr && hdr.scrollIntoView) hdr.scrollIntoView({behavior:'smooth', block:'start'});
}
window._abrirCambiosTurnoDesdeBanner = _abrirCambiosTurnoDesdeBanner;

// NUEVO — Confirmado por el usuario: mismo estilo de banner que ya
// usa "Nueva solicitud de cambio", para "Publicar un cambio" —
// ofertas nuevas en mis publicaciones, y ofertas mías ya aceptadas
// pendientes de correo/confirmar.
async function cargarNotificacionesPublicaciones(){
  if(!sbAdmin || !AJ || !AJ.matricula) return;
  try{
    var rp = await sbAdmin.from('publicaciones_cambio_turno').select('id').eq('matricula_publicador', AJ.matricula).eq('estado','activa');
    var idsPropias = ((rp && rp.data) || []).map(function(p){ return p.id; });
    var ofertasNuevas = [];
    if(idsPropias.length){
      var ro = await sbAdmin.from('ofertas_publicacion_turno').select('*').in('publicacion_id', idsPropias).eq('estado','pendiente');
      ofertasNuevas = (ro && ro.data) || [];
    }
    var rmo = await sbAdmin.from('ofertas_publicacion_turno').select('*').eq('matricula_ofertante', AJ.matricula).eq('estado','aceptada').eq('confirmado_ofertante', false);
    var misOfertasAceptadas = (rmo && rmo.data) || [];

    var badge = document.getElementById('cambiosPublicadosBadge');
    var totalPub = ofertasNuevas.length + misOfertasAceptadas.length;
    if(totalPub){ badge.style.display=''; badge.textContent = totalPub; } else { badge.style.display='none'; }

    var banners = '';
    if(ofertasNuevas.length){
      banners += '<div class="nadm-banner" style="--nadm-bc:#7C3AED;--nadm-bg:rgba(124,58,237,.12);--nadm-tc:#c084fc" onclick="_abrirCambiosPublicadosDesdeBanner(\'mias\')">'
        + '<div class="nadm-banner-ico">📢</div>'
        + '<div style="flex:1">'
          + '<div class="nadm-banner-tit">'+ofertasNuevas.length+' oferta'+(ofertasNuevas.length>1?'s':'')+' en tu'+(idsPropias.length>1?'s':'')+' publicaci'+(idsPropias.length>1?'ones':'ón')+'</div>'
          + '<div class="nadm-banner-msg">Toca para ver quién te la ha hecho.</div>'
        + '</div>'
      + '</div>';
    }
    misOfertasAceptadas.forEach(function(o){
      banners += '<div class="nadm-banner" style="--nadm-bc:#16A34A;--nadm-bg:rgba(22,163,74,.12);--nadm-tc:#4ADE80" onclick="mostrarPasosPostAceptacionPublicacion('+o.id+')">'
        + '<div class="nadm-banner-ico">✅</div>'
        + '<div style="flex:1">'
          + '<div class="nadm-banner-tit">Te aceptaron tu oferta</div>'
          + '<div class="nadm-banner-msg">Toca para mandar el correo y confirmar en tu calendario.</div>'
        + '</div>'
      + '</div>';
    });
    _bannerPublicacionesHTML = banners;
    _renderBannerCombinado();
  }catch(e){ console.warn('cargarNotificacionesPublicaciones:', e); }
}
window.cargarNotificacionesPublicaciones = cargarNotificacionesPublicaciones;
function _abrirCambiosPublicadosDesdeBanner(tab){
  abrirCambiosPublicados();
  setTimeout(function(){ _cpubCambiarTab(tab); }, 50);
}
window._abrirCambiosPublicadosDesdeBanner = _abrirCambiosPublicadosDesdeBanner;

/* ═══════════════════════════════════════════════════════════
   NUEVO — Confirmado por el usuario: notificaciones PUSH de
   verdad (avisan aunque la app esté cerrada del todo). Fase 1:
   pedir permiso, suscribirse, y guardar el "buzón" (subscription)
   en Supabase — la fase 2 (la función que de verdad manda el
   aviso) vive en Supabase, no aquí.
═══════════════════════════════════════════════════════════ */
var VAPID_PUBLIC_KEY = 'BHju3WprbMpSbXbzTHPSylCwRYOD04uxruHfhXDPm4KwowG9EMHICb-18L5vTll5Ei7oFiga1as3IKLqfKK3lUQ';

// Convierte la clave pública (texto) al formato de bytes que exige
// la Push API del navegador — conversión estándar, siempre igual.
function _urlBase64ToUint8Array(base64String){
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for(var i = 0; i < rawData.length; ++i){ outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

async function activarNotificacionesPush(){
  var estadoEl = document.getElementById('notifPushEstado');
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Tu navegador no admite notificaciones push.</span>';
    return;
  }
  if(!AJ || !AJ.matricula){
    estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Configura tu matrícula en Ajustes → Perfil primero.</span>';
    return;
  }
  estadoEl.innerHTML = '<span style="color:var(--tx3)">Pidiendo permiso...</span>';
  try{
    var permiso = await Notification.requestPermission();
    if(permiso !== 'granted'){
      estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ No diste permiso — no se pueden activar.</span>';
      return;
    }
    estadoEl.innerHTML = '<span style="color:var(--tx3)">Activando...</span>';
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    var subJson = sub.toJSON();
    var r = await sbAdmin.from('push_subscriptions').upsert({
      matricula: AJ.matricula,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth
    }, { onConflict: 'endpoint' });
    if(r.error){
      estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ No se pudo guardar (¿existe la tabla push_subscriptions en Supabase?): '+r.error.message+'</span>';
      return;
    }
    estadoEl.innerHTML = '<span style="color:var(--green2)">✅ Notificaciones activadas en este móvil.</span>';
  }catch(e){
    estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Error: '+e.message+'</span>';
  }
}
window.activarNotificacionesPush = activarNotificacionesPush;

// NUEVO — Confirmado por el usuario: función reutilizable para
// apuntar en la "bandeja de salida" (eventos_push) — la función de
// Supabase ya montada se encarga sola de mandar el aviso de
// verdad. Si falla (sin conexión, matrícula sin notificaciones
// activadas, etc.) no rompe nada más — el resto de la app sigue
// funcionando exactamente igual, con o sin esto.
async function _crearEventoPush(matriculaDestino, titulo, cuerpo){
  if(!sbAdmin || !matriculaDestino) return;
  try{
    await sbAdmin.from('eventos_push').insert({
      matricula_destino: matriculaDestino,
      titulo: titulo,
      cuerpo: cuerpo
    });
  }catch(e){ console.warn('_crearEventoPush:', e); }
}

function _resumenTurno(det){
  if(!det) return 'sin datos';
  if(det.esLibre) return det.tipoLibreLbl || 'Día libre';
  if(!det.turnos || !det.turnos.length) return 'sin datos';
  var txt = det.turnos.map(function(t){ return 'Tren '+t.numTren; }).join(' + ');
  if(det.esPernocta) txt += ' 🌙';
  return txt;
}

function _renderTarjetaCambioRecibido(s){
  return '<div class="ct-req-card">'
    + '<div class="ct-req-hdr"><div class="ct-pcard-av">'+initials(s.nombre_solicitante)+'</div><div><div class="ct-req-name">'+s.nombre_solicitante+'</div><div class="ct-req-sub">Día '+s.dia_ofrece+' ⇄ Día '+s.dia_pide+'</div></div></div>'
    + '<div class="ct-req-swap">'
    + '<div class="ct-req-swap-col"><div class="ct-req-swap-lbl">Te da</div><div class="ct-req-swap-day">Día '+s.dia_ofrece+'</div><div class="ct-req-swap-turno">'+_resumenTurno(s.detalle_ofrece)+'</div></div>'
    + '<div class="ct-req-swap-arr">⇄</div>'
    + '<div class="ct-req-swap-col"><div class="ct-req-swap-lbl">Te pide</div><div class="ct-req-swap-day">Día '+s.dia_pide+'</div><div class="ct-req-swap-turno">'+_resumenTurno(s.detalle_pide)+'</div></div>'
    + '</div>'
    + (s.mensaje ? '<div class="ct-req-msg">"'+s.mensaje+'"</div>' : '')
    + '<div class="ct-req-actions">'
    + '<div class="ct-btn-reject" onclick="responderCambioTurno('+s.id+',\'rechazada\')">Rechazar</div>'
    + '<div class="ct-btn-accept" onclick="responderCambioTurno('+s.id+',\'aceptada\')">Aceptar</div>'
    + '</div></div>';
}
function _renderTarjetaCambioEnviado(s){
  var chip = s.estado==='pendiente' ? '<span class="ct-status-chip ct-status-pend">⏳ Pendiente</span>'
    : s.estado==='aceptada' ? '<span class="ct-status-chip ct-status-ok">✅ Aceptada</span>'
    : s.estado==='rechazada' ? '<span class="ct-status-chip ct-status-no">✕ Rechazada</span>'
    : '<span class="ct-status-chip" style="background:var(--s2);color:var(--tx3)">Cancelada</span>';
  var accionesExtra = '';
  if(s.estado==='aceptada' && !s.confirmado_solicitante){
    accionesExtra = '<div class="ct-next-step-btn" onclick="mostrarPasosPostAceptacion('+s.id+')">Ver siguiente paso (correo + confirmar)</div>';
  } else if(s.estado==='pendiente'){
    accionesExtra = '<div class="ct-cancel-btn" onclick="cancelarSolicitudCambio('+s.id+')">Cancelar solicitud</div>';
  } else {
    // NUEVO — Confirmado por el usuario: eliminar del todo una
    // solicitud ya resuelta (aceptada y confirmada, rechazada, o
    // cancelada) — solo la borra de tu lista/historial, no toca
    // ningún aviso visual que ya tengas puesto en el calendario.
    accionesExtra = '<div class="ct-cancel-btn" onclick="eliminarSolicitudCambio('+s.id+')">🗑 Eliminar</div>';
  }
  return '<div class="ct-req-card" style="padding:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center">'
    + '<div><div class="ct-req-name" style="font-size:12px">'+s.nombre_destino+'</div><div class="ct-req-sub">Día '+s.dia_ofrece+' ⇄ Día '+s.dia_pide+'</div></div>'
    + chip + '</div>' + accionesExtra + '</div>';
}
window.responderCambioTurno = null; // se define abajo, tras declarar la función real

// NUEVO — Confirmado por el usuario: borrar del todo una solicitud
// ya resuelta desde "Tus solicitudes enviadas". Pide confirmación
// antes (acción irreversible) y no toca ningún aviso visual que ya
// tengas puesto en el calendario (eso vive aparte, en localStorage).
function eliminarSolicitudCambio(id){
  if(!sbAdmin) return;
  if(!confirm('¿Eliminar esta solicitud de tu lista? No se puede deshacer.')) return;
  sbAdmin.from('cambios_turno').delete().eq('id', id).then(function(){
    cargarCambiosTurno();
  }).catch(function(e){ console.warn('eliminarSolicitudCambio:', e); });
}
window.eliminarSolicitudCambio = eliminarSolicitudCambio;

async function responderCambioTurno(id, nuevoEstado){
  if(!sbAdmin) return;
  try{
    var r = await sbAdmin.from('cambios_turno').update({ estado: nuevoEstado }).eq('id', id).select().maybeSingle();
    cargarCambiosTurno();
    // NUEVO — Confirmado por el usuario: aviso push a quien pidió el
    // cambio, tanto si se lo aceptan como si se lo rechazan.
    if(r && r.data){
      var mensajePush = nuevoEstado==='aceptada' ? (r.data.nombre_destino+' aceptó tu cambio de turno.') : (r.data.nombre_destino+' rechazó tu cambio de turno.');
      _crearEventoPush(r.data.matricula_solicitante, nuevoEstado==='aceptada' ? 'Cambio aceptado' : 'Cambio rechazado', mensajePush);
    }
    // FIX — Confirmado por el usuario: antes, al aceptar, a esa
    // persona no le salía nada — se quedaba sin saber que tenía que
    // mandar el correo y confirmar en su propio calendario. Ahora se
    // le muestra la misma pantalla de "correo + confirmar" al
    // instante, igual que ya le pasaba a quien pidió el cambio.
    if(nuevoEstado === 'aceptada' && typeof mostrarPasosPostAceptacion==='function'){
      mostrarPasosPostAceptacion(id);
    }
  }catch(e){ console.warn('responderCambioTurno:', e); }
}
window.responderCambioTurno = responderCambioTurno;

async function cancelarSolicitudCambio(id){
  if(!sbAdmin) return;
  try{
    await sbAdmin.from('cambios_turno').update({ estado: 'cancelada' }).eq('id', id);
    cargarCambiosTurno();
  }catch(e){ console.warn('cancelarSolicitudCambio:', e); }
}
window.cancelarSolicitudCambio = cancelarSolicitudCambio;

// ── 6) Tras aceptar: correo a Programación + confirmar en MI
//    calendario (aviso visual aparte, nunca escribe en TV/TV2). ──
// NUEVO — Confirmado por el usuario: versión en texto plano (sin
// emojis) del resumen de un turno, solo para meter dentro del
// correo — _resumenTurno() (con emojis) se sigue usando tal cual
// para pintar en la propia app, esta es aparte y no la sustituye.
function _resumenTurnoTextoPlano(det){
  if(!det) return 'sin datos';
  if(det.esLibre) return (det.tipoLibreLbl||'Dia libre').replace(/[^\x00-\x7F]/g, '').trim() || 'Dia libre';
  if(!det.turnos || !det.turnos.length) return 'sin datos';
  // FIX — Confirmado por el usuario: no hacen falta las horas en el
  // correo, solo el día y el número de tren.
  var txt = det.turnos.map(function(t){
    return 'Tren '+t.numTren;
  }).join(' y ');
  if(det.esPernocta && det.diaVuelta){
    txt += ' (pernocta, incluye la vuelta el dia '+det.diaVuelta;
    if(det.turnosVuelta && det.turnosVuelta.length){
      txt += ' con el tren '+det.turnosVuelta.map(function(t){ return t.numTren; }).join(' y ');
    }
    txt += ')';
  }
  return txt;
}

async function mostrarPasosPostAceptacion(id){
  if(!sbAdmin) return;
  var r = await sbAdmin.from('cambios_turno').select('*').eq('id', id).maybeSingle();
  if(!r.data) return;
  var s = r.data;
  // FIX — Confirmado por el usuario: esta pantalla la puede ver
  // CUALQUIERA de los dos (quien pidió el cambio, o quien lo
  // aceptó) — antes daba igual quién la abriera, siempre trataba a
  // quien la veía como si fuera el solicitante. Ahora mira tu propia
  // matrícula para saber cuál de los dos eres de verdad.
  var soySolicitante = !!(AJ && AJ.matricula && s.matricula_solicitante === AJ.matricula);
  var otroNombre = soySolicitante ? s.nombre_destino : s.nombre_solicitante;
  var yaConfirmado = soySolicitante ? s.confirmado_solicitante : s.confirmado_destino;
  var miNombre = (AJ && AJ.nombre) || '';
  var miMatricula = (AJ && AJ.matricula) || '';
  var asunto = 'Solicitud de cambio de turno - '+s.nombre_solicitante+' / '+s.nombre_destino;
  var cuerpoBruto =
    'Buenos dias.\n\n'
    + 'Solicitud de cambio de turno aceptada por ambas partes:\n\n'
    + 'Solicitante: '+s.nombre_solicitante+' (matricula '+s.matricula_solicitante+')\n'
    + 'Companero: '+s.nombre_destino+' (matricula '+s.matricula_destino+')\n\n'
    + s.nombre_solicitante+' cambia su turno del dia '+s.dia_ofrece+' ('+_resumenTurnoTextoPlano(s.detalle_ofrece)+')\n'
    + 'por el turno de '+s.nombre_destino+' del dia '+s.dia_pide+' ('+_resumenTurnoTextoPlano(s.detalle_pide)+')\n\n'
    + 'Espero su pronta respuesta.\nSaludos cordiales.\n\n'
    + 'Atentamente,\n'+miNombre+'\nMatricula: '+miMatricula
    + '\n\nSolicitud generada automaticamente por TrenTurno V5';
  var cuerpoLimpio = (typeof sanitizarTexto==='function') ? sanitizarTexto(cuerpoBruto) : cuerpoBruto;
  // FIX — Confirmado por el usuario: algunos clientes de correo no
  // respetan bien un salto de línea suelto ("\n") dentro de un
  // enlace mailto: — hace falta "\r\n" (CRLF) para que los párrafos
  // se vean separados de verdad. Se hace DESPUÉS de sanitizarTexto()
  // a propósito: esa función no reconoce "\r" en su lista de
  // caracteres permitidos y lo habría vuelto a quitar.
  cuerpoLimpio = cuerpoLimpio.replace(/\n/g, '\r\n');
  var mailto = 'mailto:?subject='+encodeURIComponent(asunto)+'&body='+encodeURIComponent(cuerpoLimpio);
  // FIX — Confirmado por el usuario: el correo a Programación lo
  // manda SOLO quien pidió el cambio (el solicitante) — nunca quien
  // lo recibe. A quien lo recibe ya no se le muestra el bloque de
  // correo, solo un aviso de que el solicitante se encarga, y su
  // propio botón para actualizar su calendario.
  var bloqueCorreo = soySolicitante
    ? ('<div class="ct-mail-prompt">'
        + '<div class="ct-mail-prompt-ico">✉️</div>'
        + '<div class="ct-mail-prompt-tit">Envía el correo a Programación</div>'
        + '<div class="ct-mail-prompt-sub">Se abrirá tu app de correo, ya escrito. Solo dale a "Enviar".</div>'
        + '<a href="'+mailto+'" class="ct-mail-btn">Abrir correo</a>'
        + '</div>')
    : ('<div class="ct-mail-prompt">'
        + '<div class="ct-mail-prompt-ico">✅</div>'
        + '<div class="ct-mail-prompt-tit">Ya no tienes que hacer nada con el correo</div>'
        + '<div class="ct-mail-prompt-sub">'+s.nombre_solicitante+' se encarga de avisar a Programación.</div>'
        + '</div>');
  var textoBtnConfirmar = soySolicitante ? 'Ya envié el correo — actualizar mi calendario' : 'Actualizar mi calendario';
  var html = '<div class="ov on" id="ov-post-aceptacion-temp" onclick="if(event.target===this) document.getElementById(\'ov-post-aceptacion-temp\').remove()">'
    + '<div class="sh" onclick="event.stopPropagation()">'
    + '<div class="sh-hdr"><div class="sh-ico">✅</div><div><div class="sh-tit">Cambio aceptado</div><div class="sh-sub">Con '+otroNombre+'</div></div>'
    + '<button class="sh-close" onclick="document.getElementById(\'ov-post-aceptacion-temp\').remove()">✕</button></div>'
    + '<div style="padding:16px">'
    + bloqueCorreo
    + (yaConfirmado
      ? '<div style="text-align:center;color:var(--green2);font-size:12px;font-weight:700">✅ Ya confirmaste este cambio en tu calendario.</div>'
      : '<div class="ct-confirm-box">'
        + '<div class="ct-confirm-box-tit">📅 Actualizar tu calendario</div>'
        + '<div class="ct-confirm-box-sub">Solo un aviso visual — tu turno real para Nómina no cambia hasta que la empresa lo actualice.</div>'
        + '<div class="ct-confirm-btn" onclick="confirmarCambioEnMiCalendario('+s.id+','+soySolicitante+')">'+textoBtnConfirmar+'</div>'
        + '</div>')
    + '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}
window.mostrarPasosPostAceptacion = mostrarPasosPostAceptacion;

// Aviso visual local — NUNCA toca TV/TV2. Se guarda por mes, con la
// matrícula propia como parte de la clave para no mezclarse si el
// móvil se comparte entre perfiles.
function _claveCambiosVisual(){
  return 'cambiosTurnoVisual_' + ((AJ&&AJ.matricula)||'sinmatricula');
}
function _leerCambiosVisual(){
  try{ return JSON.parse(localStorage.getItem(_claveCambiosVisual())||'{}'); }catch(e){ return {}; }
}
function _guardarCambiosVisual(obj){
  try{ localStorage.setItem(_claveCambiosVisual(), JSON.stringify(obj)); }catch(e){}
}

async function confirmarCambioEnMiCalendario(id, soySolicitante){
  if(!sbAdmin) return;
  var r = await sbAdmin.from('cambios_turno').select('*').eq('id', id).maybeSingle();
  if(!r.data) return;
  var s = r.data;
  var diaQueDoy = soySolicitante ? s.dia_ofrece : s.dia_pide;
  var diaQueRecibo = soySolicitante ? s.dia_pide : s.dia_ofrece;
  var detalleQueDoy = soySolicitante ? s.detalle_ofrece : s.detalle_pide;
  var detalleQueRecibo = soySolicitante ? s.detalle_pide : s.detalle_ofrece;
  var nombreOtro = soySolicitante ? s.nombre_destino : s.nombre_solicitante;

  var visual = _leerCambiosVisual();
  var mesReal = (typeof curM!=='undefined' && curM) ? (curM.getMonth()+1) : (new Date().getMonth()+1);
  var claveMes = s.anio + '-' + mesReal;
  if(!visual[claveMes]) visual[claveMes] = {};
  // FIX — Confirmado por el usuario: antes solo se guardaba lo mínimo
  // (con quién, id) — no era suficiente para mostrar el detalle
  // completo al abrir ese día. Ahora se guarda TODO lo necesario
  // (incluida la pernocta si la había) para los dos días implicados.
  visual[claveMes][diaQueDoy] = { tipo:'dado', con:nombreOtro, id:id, miDetalleOriginal: detalleQueDoy };
  visual[claveMes][diaQueRecibo] = { tipo:'recibido', con:nombreOtro, id:id, turnos: detalleQueRecibo };
  _guardarCambiosVisual(visual);

  var campo = soySolicitante ? 'confirmado_solicitante' : 'confirmado_destino';
  var payload = {}; payload[campo] = true;
  await sbAdmin.from('cambios_turno').update(payload).eq('id', id);

  var ovTemp = document.getElementById('ov-post-aceptacion-temp');
  if(ovTemp) ovTemp.remove();
  if(typeof renderCal === 'function') renderCal();
  // NUEVO — refresca también el detalle del día abierto (si hay uno),
  // para que el aviso completo salga al instante sin tener que salir
  // y volver a entrar.
  if(typeof renderDiaArea === 'function') renderDiaArea();
  cargarCambiosTurno();
}
window.confirmarCambioEnMiCalendario = confirmarCambioEnMiCalendario;

// ── 7) Aviso visual en cada celda del calendario — leído en
//    renderCal() mediante esta función; NUNCA modifica TV/TV2. ──
function _badgeCambioTurnoParaDia(dia){
  var visual = _leerCambiosVisual();
  var mesReal = (typeof curM!=='undefined' && curM) ? (curM.getMonth()+1) : (new Date().getMonth()+1);
  var anioReal = (typeof curM!=='undefined' && curM) ? curM.getFullYear() : new Date().getFullYear();
  var claveMes = anioReal + '-' + mesReal;
  var mesData = visual[claveMes];
  if(!mesData || !mesData[dia]) return '';
  var info = mesData[dia];
  var texto = info.tipo==='dado' ? '🔄 Cambiado' : ('🔄 '+(info.turnos && info.turnos.turnos && info.turnos.turnos[0] ? 'Tren '+info.turnos.turnos[0].numTren : 'Cambio'));
  return '<span style="position:absolute;top:1px;left:50%;transform:translateX(-50%);'
    + 'font-size:6px;line-height:1;white-space:nowrap;background:rgba(168,85,247,.9);color:#fff;'
    + 'border-radius:3px;padding:1px 3px;font-weight:900;letter-spacing:.2px;z-index:2">'+texto+'</span>';
}
window._badgeCambioTurnoParaDia = _badgeCambioTurnoParaDia;

// ── 8) Acordeón de la sección + carga inicial al entrar a Calendario ──
// NUEVO — Confirmado por el usuario: contenido completo de la
// guia_cambio_de_turno.html incrustado como texto, para poder
// mostrarla dentro de la propia app (ver abrirGuiaCambioTurno()
// más abajo) sin depender de ningún archivo externo.
var GUIA_CAMBIO_TURNO_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cómo usar: Solicitar cambio de turno</title>
<style>
:root{
  --bg:#070D16; --panel:#0D1B2E; --panel2:#132236; --line:#1E3350;
  --blue:#2563EB; --blue-soft:#93C5FD; --amber:#F59E0B; --amber-soft:#FCD34D;
  --purple:#7C3AED; --purple-soft:#C084FC; --green:#16A34A;
  --ink:#F8FAFC; --ink-dim:#B8C2D0; --ink-faint:#6B7A90;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  line-height:1.5;
}
.wrap{max-width:760px;margin:0 auto;padding:0 20px 80px}

/* ── Portada ── */
.cover{padding:56px 0 40px;border-bottom:1px solid var(--line);margin-bottom:8px}
.cover-eyebrow{font-size:13px;color:var(--blue-soft);font-weight:600;margin-bottom:14px}
.cover h1{font-size:34px;line-height:1.15;margin:0 0 16px;font-weight:800;letter-spacing:-.01em}
.cover p{font-size:16px;color:var(--ink-dim);max-width:520px;margin:0}
.cover-rail{width:56px;height:3px;background:var(--amber);border-radius:2px;margin-bottom:20px}

/* ── Reparto (las dos personas de ejemplo) ── */
.cast{display:flex;gap:14px;margin:28px 0 0;flex-wrap:wrap}
.cast-card{flex:1;min-width:220px;background:var(--panel);border:1px solid var(--line);
  border-radius:14px;padding:16px 18px;display:flex;align-items:center;gap:12px}
.cast-av{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;
  justify-content:center;font-size:14px;font-weight:800;flex-shrink:0}
.cast-name{font-size:13.5px;font-weight:700}
.cast-sub{font-size:11.5px;color:var(--ink-faint);margin-top:2px}

/* ── Pasos ── */
.step{display:flex;gap:24px;padding:40px 0;border-bottom:1px solid var(--line);align-items:flex-start}
.step:last-of-type{border-bottom:none}
.step-num{width:34px;height:34px;border-radius:50%;background:var(--panel2);border:1px solid var(--line);
  display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;
  color:var(--blue-soft);flex-shrink:0;margin-top:2px}
.step-body{flex:1;min-width:0}
.step-who{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:10px}
.step-who.sara{background:rgba(37,99,235,.15);color:var(--blue-soft)}
.step-who.marcos{background:rgba(124,58,237,.15);color:var(--purple-soft)}
.step-title{font-size:19px;font-weight:700;margin:0 0 10px}
.step-text{font-size:14.5px;color:var(--ink-dim);margin:0 0 16px;max-width:480px}
.step-text b{color:var(--ink);font-weight:600}

/* ── Mini pantalla de teléfono, incrustada en cada paso ── */
.phone-shot{
  background:var(--panel); border:1px solid var(--line); border-radius:16px;
  padding:14px 16px; max-width:420px; font-size:12.5px;
}
.ps-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.ps-av{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:800;flex-shrink:0}
.ps-name{font-weight:700;font-size:12.5px}
.ps-sub{font-size:10px;color:var(--ink-faint)}
.ps-swap{display:flex;align-items:center;gap:8px;background:var(--panel2);border-radius:10px;padding:10px;margin:10px 0}
.ps-swap-col{flex:1;text-align:center}
.ps-swap-lbl{font-size:8.5px;color:var(--ink-faint);text-transform:uppercase;font-weight:800;letter-spacing:.3px}
.ps-swap-day{font-size:12px;font-weight:800;margin-top:3px}
.ps-swap-turno{font-size:9.5px;color:var(--ink-dim);margin-top:2px}
.ps-swap-arr{color:var(--blue-soft);font-size:15px}
.ps-msg{font-size:10.5px;font-style:italic;color:var(--ink-dim);background:var(--panel2);
  border-radius:7px;padding:6px 9px;margin-bottom:10px}
.ps-btns{display:flex;gap:7px}
.ps-btn{flex:1;padding:8px;border-radius:8px;font-size:10.5px;font-weight:700;text-align:center}
.ps-btn.reject{background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.4);color:#F87171}
.ps-btn.accept{background:var(--green);color:#fff}
.ps-btn.solo{background:var(--blue);color:#fff}
.ps-field-lbl{font-size:9px;font-weight:800;color:var(--ink-faint);text-transform:uppercase;
  letter-spacing:.3px;margin:10px 0 5px}
.ps-box{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 11px;font-size:11.5px}
.ps-pill{display:inline-block;font-size:8.5px;font-weight:800;background:rgba(124,58,237,.18);
  color:var(--purple-soft);padding:2px 7px;border-radius:6px;margin-top:5px}
.ps-mail{background:rgba(37,99,235,.1);border:1.5px solid var(--blue);border-radius:12px;
  padding:14px;text-align:center}
.ps-mail-tit{font-size:12px;font-weight:800;margin-bottom:8px}
.ps-cal-day{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;
  width:44px;height:44px;border-radius:9px;font-size:14px;font-weight:800;position:relative}
.ps-cal-badge{position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:6.5px;
  font-weight:900;background:var(--purple);color:#fff;padding:1px 4px;border-radius:4px;white-space:nowrap}

/* ── Vista realista del correo (Gmail) para el paso del correo ── */
.gm-shell{background:#fff;border-radius:14px;overflow:hidden;max-width:420px;
  font-family:'Google Sans',Roboto,-apple-system,sans-serif;box-shadow:0 4px 24px rgba(0,0,0,.35)}
.gm-top{display:flex;align-items:center;gap:16px;padding:12px 14px;border-bottom:1px solid #e8eaed}
.gm-close{font-size:17px;color:#5f6368}
.gm-actions{margin-left:auto;display:flex;gap:16px;color:#5f6368;font-size:15px}
.gm-send{color:#1a73e8;font-weight:700;font-size:12.5px;margin-left:auto}
.gm-from{display:flex;align-items:center;gap:9px;padding:10px 14px;border-bottom:1px solid #f1f3f4}
.gm-av{width:26px;height:26px;border-radius:50%;background:#1a73e8;color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
.gm-from-name{font-size:12px;color:#202124;font-weight:500}
.gm-from-email{font-size:10.5px;color:#5f6368}
.gm-field{display:flex;align-items:center;padding:9px 14px;border-bottom:1px solid #f1f3f4;font-size:12px}
.gm-field-lbl{color:#5f6368;width:48px;flex-shrink:0}
.gm-field-val{color:#202124;flex:1}
.gm-field-val.ph{color:#80868b;font-style:italic}
.gm-subject{padding:11px 14px;border-bottom:1px solid #f1f3f4;font-size:12.5px;font-weight:500;color:#202124}
.gm-body{padding:14px;font-size:11.5px;color:#202124;line-height:1.6;white-space:pre-wrap}

/* ── Nota lateral ── */
.note{background:var(--panel);border-left:3px solid var(--amber);border-radius:0 10px 10px 0;
  padding:12px 16px;font-size:13px;color:var(--ink-dim);margin-top:16px;max-width:480px}
.note b{color:var(--amber-soft)}

/* ── Cierre ── */
.closing{padding:44px 0 0}
.closing h2{font-size:20px;margin:0 0 12px}
.closing p{font-size:14.5px;color:var(--ink-dim);max-width:520px}
.closing-list{margin:18px 0 0;padding:0;list-style:none}
.closing-list li{font-size:13.5px;color:var(--ink-dim);padding:8px 0 8px 22px;position:relative;
  border-top:1px solid var(--line)}
.closing-list li:before{content:"—";position:absolute;left:0;color:var(--ink-faint)}

@media (max-width:600px){
  .step{flex-direction:column;gap:12px}
  .cover h1{font-size:27px}
}
</style>
</head>
<body>
<div class="wrap">

  <div class="cover">
    <div class="cover-rail"></div>
    <div class="cover-eyebrow">TrenTurnos · Guía rápida</div>
    <h1>Cómo pedir un cambio de turno con un compañero</h1>
    <p>Ejemplo completo, paso a paso, con dos compañeros y turnos inventados para que se entienda de un vistazo. Los nombres, matrículas y trenes de esta guía no son reales.</p>

    <div class="cast">
      <div class="cast-card">
        <div class="cast-av" style="background:rgba(37,99,235,.18);color:#93C5FD">SD</div>
        <div>
          <div class="cast-name">Sara Domínguez Ruiz</div>
          <div class="cast-sub">Matrícula 5512340 · pide el cambio</div>
        </div>
      </div>
      <div class="cast-card">
        <div class="cast-av" style="background:rgba(124,58,237,.18);color:#C084FC">MI</div>
        <div>
          <div class="cast-name">Marcos Iglesias Peña</div>
          <div class="cast-sub">Matrícula 5598761 · recibe la solicitud</div>
        </div>
      </div>
    </div>
  </div>

  <!-- PASO 1 -->
  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <span class="step-who sara">Sara</span>
      <h3 class="step-title">Sara abre "Cambios de turno" en su Calendario</h3>
      <p class="step-text">Está debajo del calendario de siempre. Toca <b>"Nueva solicitud de cambio"</b> y busca a Marcos por su nombre.</p>
      <div class="phone-shot">
        <div class="ps-field-lbl">Con quién</div>
        <div class="ps-row" style="background:var(--panel2);border-radius:9px;padding:9px 10px;border:1px solid var(--blue)">
          <div class="ps-av" style="background:rgba(124,58,237,.2);color:#C084FC">MI</div>
          <div class="ps-name">Marcos Iglesias Peña</div>
        </div>
      </div>
    </div>
  </div>

  <!-- PASO 2 -->
  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <span class="step-who sara">Sara</span>
      <h3 class="step-title">Elige su día y el de Marcos</h3>
      <p class="step-text">Sara ofrece su <b>miércoles 23</b> (hace el Tren 4021) y pide el <b>viernes 25</b> de Marcos (hace el Tren 6187). Puede añadir un mensaje si quiere.</p>
      <div class="phone-shot">
        <div class="ps-field-lbl">Tu turno que ofreces</div>
        <div class="ps-box">Miércoles 23 — Tren 4021</div>
        <div class="ps-field-lbl">Su turno que quieres</div>
        <div class="ps-box">Viernes 25 — Tren 6187</div>
        <div class="ps-field-lbl">Mensaje (opcional)</div>
        <div class="ps-box" style="color:var(--ink-faint);font-style:italic">"Tengo una cita ese día, ¿me lo cambias?"</div>
      </div>
    </div>
  </div>

  <!-- AVISO: compañero sin sincronizar -->
  <div class="step">
    <div class="step-num">⚠️</div>
    <div class="step-body">
      <h3 class="step-title">¿Y si Marcos nunca ha usado esto?</h3>
      <p class="step-text">Para que Sara pueda ver el turno de Marcos con detalle, hacen falta <b>dos cosas de parte de Marcos</b>, antes de que Sara intente pedirle el cambio:</p>
      <ul style="font-size:13.5px;color:var(--ink-dim);margin:0 0 16px;padding-left:20px;max-width:460px">
        <li style="margin-bottom:6px">Tener su <b>Horario Individual</b> (el PDF) ya subido en su Horario.</li>
        <li>Haber <b>abierto su Calendario</b> al menos una vez — así sube en silencio el detalle a la nube.</li>
      </ul>
      <p class="step-text">Si a Marcos le falta cualquiera de las dos, Sara ve este aviso al intentar elegir su día:</p>
      <div class="phone-shot">
        <div class="ps-box" style="color:#F59E0B;border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.08)">⚠️ Marcos Iglesias Peña todavía no ha sincronizado ningún día futuro de este mes — pídele que abra su Calendario primero.</div>
      </div>
      <div class="note">No es un fallo — es a propósito. Sara solo puede ver el turno de Marcos si Marcos ya lo tiene cargado y ha abierto la app. La solución es simple: <b>pedirle a Marcos que entre a su Calendario</b> un momento, y ya está listo.</div>
    </div>
  </div>

  <!-- PASO 3 -->
  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <span class="step-who marcos">Marcos</span>
      <h3 class="step-title">Marcos ve la solicitud y decide</h3>
      <p class="step-text">Al entrar en su Calendario, a Marcos le aparece un <b>banner morado</b> avisándole. Dentro ve los dos turnos uno al lado del otro, y puede <b>Aceptar</b> o <b>Rechazar</b>.</p>
      <div class="phone-shot">
        <div class="ps-row">
          <div class="ps-av" style="background:rgba(37,99,235,.2);color:#93C5FD">SD</div>
          <div><div class="ps-name">Sara Domínguez Ruiz</div><div class="ps-sub">Hoy</div></div>
        </div>
        <div class="ps-swap">
          <div class="ps-swap-col"><div class="ps-swap-lbl">Te da</div><div class="ps-swap-day">Miér 23</div><div class="ps-swap-turno">Tren 4021</div></div>
          <div class="ps-swap-arr">⇄</div>
          <div class="ps-swap-col"><div class="ps-swap-lbl">Te pide</div><div class="ps-swap-day">Vie 25</div><div class="ps-swap-turno">Tren 6187</div></div>
        </div>
        <div class="ps-msg">"Tengo una cita ese día, ¿me lo cambias?"</div>
        <div class="ps-btns">
          <div class="ps-btn reject">Rechazar</div>
          <div class="ps-btn accept">Aceptar</div>
        </div>
      </div>
    </div>
  </div>

  <!-- PASO 4 -->
  <div class="step">
    <div class="step-num">4</div>
    <div class="step-body">
      <span class="step-who sara">Sara</span>
      <h3 class="step-title">Sara manda el correo a Programación</h3>
      <p class="step-text">Solo lo manda <b>quien pidió el cambio</b> — en este caso, Sara. En cuanto Marcos acepta, a Sara le sale ya escrito el correo con los datos de los dos (nombre y matrícula) — solo tiene que darle a <b>Enviar</b>. Marcos no tiene que hacer nada con el correo.</p>

      <div class="gm-shell">
        <div class="gm-top">
          <span class="gm-close">✕</span>
          <span class="gm-actions">📎 🖼️</span>
          <span class="gm-send">ENVIAR ➤</span>
        </div>
        <div class="gm-from">
          <div class="gm-av">S</div>
          <div>
            <div class="gm-from-name">Sara Domínguez Ruiz</div>
            <div class="gm-from-email">sara.dominguez.ruiz@gmail.com</div>
          </div>
        </div>
        <div class="gm-field">
          <span class="gm-field-lbl">Para</span>
          <span class="gm-field-val ph">programacion@empresa.com</span>
        </div>
        <div class="gm-subject">Solicitud de cambio de turno - Domínguez Ruiz Sara / Iglesias Peña Marcos</div>
        <div class="gm-body">Buenos dias

Solicitud de cambio de turno aceptada por ambas partes

Solicitante Domínguez Ruiz Sara matricula 5512340
Companero Iglesias Peña Marcos matricula 5598761

Domínguez Ruiz Sara cambia su turno del dia 23 Tren 4021
por el turno de Iglesias Peña Marcos del dia 25 Tren 6187

Espero su pronta respuesta
Saludos cordiales

Atentamente
Domínguez Ruiz Sara
Matricula 5512340

Solicitud generada automaticamente por TrenTurno V5</div>
      </div>

      <div class="note"><b>"Para" sale siempre vacío a propósito:</b> cada tripulante escribe ahí la dirección real de Programación de su empresa. Y el texto sale sin tildes ni símbolos raros — a propósito, para que el correo no se rompa al abrirse en algunos móviles.</div>
    </div>
  </div>

  <!-- PASO 5 -->
  <div class="step">
    <div class="step-num">5</div>
    <div class="step-body">
      <span class="step-who marcos">Marcos</span> <span class="step-who sara">Sara</span>
      <h3 class="step-title">Cada uno confirma en su propio calendario</h3>
      <p class="step-text">Después de mandar el correo, cada uno pulsa su propio botón para que le salga el aviso en su Calendario. <b>No hace falta que lo hagan a la vez</b> — cada uno a su ritmo.</p>
      <div class="phone-shot">
        <div style="text-align:center;padding:6px 0">
          <div class="ps-cal-day" style="background:var(--panel2);color:var(--ink)">
            23<span class="ps-cal-badge">🔄 CAMBIO</span>
          </div>
          <span style="display:inline-block;width:14px"></span>
          <div class="ps-cal-day" style="background:var(--panel2);color:var(--ink)">
            25<span class="ps-cal-badge">🔄 CAMBIO</span>
          </div>
        </div>
      </div>
      <div class="note">Esto es <b>solo un aviso visual</b>, en color distinto para reconocerlo de un vistazo. Lo que de verdad cuenta para la nómina y las horas sigue siendo el turno original, hasta que la empresa lo actualice de verdad tras recibir el correo.</div>
    </div>
  </div>

  <div class="closing">
    <h2>En resumen</h2>
    <p>Todo el proceso pasa por Calendario → Cambios de turno. Nada de esto lo hace la app en automático por su cuenta — cada paso lo confirma una persona, a propósito.</p>
    <ul class="closing-list">
      <li>Buscar al compañero y elegir los dos días es cosa de quien pide el cambio.</li>
      <li>Aceptar o rechazar es cosa de quien lo recibe.</li>
      <li>El correo a Programación lo manda solo quien pidió el cambio, una vez el otro lo acepta.</li>
      <li>El aviso en el calendario lo confirma cada uno por separado, cuando quiera.</li>
      <li>Se puede deshacer el aviso, cancelar una solicitud pendiente, o eliminarla del historial en cualquier momento.</li>
    </ul>
  </div>

</div>
</body>
</html>
`;

function abrirGuiaCambioTurno(){
  var frame = document.getElementById('iframeGuiaCambioTurno');
  if(frame && !frame.dataset.cargado){
    frame.srcdoc = GUIA_CAMBIO_TURNO_HTML;
    frame.dataset.cargado = '1';
  }
  openOv('ov-guia-cambio-turno');
}
window.abrirGuiaCambioTurno = abrirGuiaCambioTurno;

// NUEVO — Confirmado por el usuario: contenido completo de
// guia_publicar_cambio.html incrustado como texto, mismo patrón
// que GUIA_CAMBIO_TURNO_HTML de arriba.
var GUIA_PUBLICAR_CAMBIO_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cómo usar: Publicar un cambio</title>
<style>
:root{
  --bg:#070D16; --panel:#0D1B2E; --panel2:#132236; --line:#1E3350;
  --nar:#F97316; --nar-soft:#FDBA74; --blue:#2563EB; --blue-soft:#93C5FD;
  --purple:#7C3AED; --purple-soft:#C084FC; --green:#16A34A; --green-soft:#4ADE80;
  --ink:#F8FAFC; --ink-dim:#B8C2D0; --ink-faint:#6B7A90;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5}
.wrap{max-width:760px;margin:0 auto;padding:0 20px 80px}

.cover{padding:56px 0 40px;border-bottom:1px solid var(--line);margin-bottom:8px}
.cover-eyebrow{font-size:13px;color:var(--nar-soft);font-weight:600;margin-bottom:14px}
.cover h1{font-size:32px;line-height:1.15;margin:0 0 16px;font-weight:800;letter-spacing:-.01em}
.cover p{font-size:16px;color:var(--ink-dim);max-width:540px;margin:0}
.cover-rail{width:56px;height:3px;background:var(--nar);border-radius:2px;margin-bottom:20px}

.cast{display:flex;gap:12px;margin:28px 0 0;flex-wrap:wrap}
.cast-card{flex:1;min-width:200px;background:var(--panel);border:1px solid var(--line);
  border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:11px}
.cast-av{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;
  justify-content:center;font-size:13px;font-weight:800;flex-shrink:0}
.cast-name{font-size:12.5px;font-weight:700}
.cast-sub{font-size:11px;color:var(--ink-faint);margin-top:2px}

.step{display:flex;gap:24px;padding:38px 0;border-bottom:1px solid var(--line);align-items:flex-start}
.step:last-of-type{border-bottom:none}
.step-num{width:34px;height:34px;border-radius:50%;background:var(--panel2);border:1px solid var(--line);
  display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;
  color:var(--nar-soft);flex-shrink:0;margin-top:2px}
.step-body{flex:1;min-width:0}
.step-who{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:10px;margin-right:5px}
.step-who.sara{background:rgba(249,115,22,.15);color:var(--nar-soft)}
.step-who.marcos{background:rgba(37,99,235,.15);color:var(--blue-soft)}
.step-who.laura{background:rgba(124,58,237,.15);color:var(--purple-soft)}
.step-who.todos{background:rgba(255,255,255,.08);color:var(--ink-dim)}
.step-title{font-size:18px;font-weight:700;margin:0 0 10px}
.step-text{font-size:14.5px;color:var(--ink-dim);margin:0 0 16px;max-width:480px}
.step-text b{color:var(--ink);font-weight:600}

.phone-shot{background:var(--panel);border:1px solid var(--line);border-radius:16px;
  padding:14px 16px;max-width:420px;font-size:12.5px}
.ps-row{display:flex;align-items:center;gap:9px;margin-bottom:9px}
.ps-av{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:800;flex-shrink:0}
.ps-name{font-weight:700;font-size:11.5px}
.ps-sub{font-size:9.5px;color:var(--ink-faint)}
.ps-check-item{display:flex;align-items:center;gap:9px;background:var(--panel2);border-radius:9px;
  padding:8px 10px;margin-bottom:6px}
.ps-check-item.on{border:1px solid var(--nar);background:rgba(249,115,22,.08)}
.ps-check{width:15px;height:15px;border-radius:4px;background:var(--panel);border:1.3px solid var(--line);
  flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px}
.ps-check.on{background:var(--nar);border-color:var(--nar);color:#1a1306;font-weight:900}
.ps-day-txt{font-size:10.5px;font-weight:700}
.ps-day-sub{font-size:9px;color:var(--ink-faint);margin-top:1px}
.ps-seq{background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.4);border-radius:9px;
  padding:8px 10px;font-size:10px;color:var(--nar-soft);margin:8px 0}
.ps-btn{padding:8px;border-radius:8px;font-size:10.5px;font-weight:700;text-align:center}
.ps-btn.nar{background:var(--nar);color:#1a1306}
.ps-btn.blue{background:var(--blue);color:#fff}
.ps-btn.green{background:var(--green);color:#fff}
.ps-feed-item{background:var(--panel2);border-radius:10px;padding:10px;margin-bottom:8px}
.ps-feed-hdr{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.ps-expiry{font-size:8.5px;color:var(--ink-faint);margin-left:auto}
.ps-offer{display:flex;align-items:center;gap:8px;background:var(--panel);border-radius:8px;
  padding:7px 9px;margin-bottom:6px}
.ps-offer-info{flex:1}
.ps-offer-name{font-size:10px;font-weight:700}
.ps-offer-detail{font-size:9px;color:var(--ink-faint)}
.ps-offer-btn{background:var(--green);color:#fff;font-size:8.5px;font-weight:800;padding:5px 9px;border-radius:7px}

.note{background:var(--panel);border-left:3px solid var(--nar);border-radius:0 10px 10px 0;
  padding:12px 16px;font-size:13px;color:var(--ink-dim);margin-top:16px;max-width:480px}
.note b{color:var(--nar-soft)}

.closing{padding:44px 0 0}
.closing h2{font-size:20px;margin:0 0 12px}
.closing p{font-size:14.5px;color:var(--ink-dim);max-width:520px}
.closing-list{margin:18px 0 0;padding:0;list-style:none}
.closing-list li{font-size:13.5px;color:var(--ink-dim);padding:8px 0 8px 22px;position:relative;border-top:1px solid var(--line)}
.closing-list li:before{content:"—";position:absolute;left:0;color:var(--ink-faint)}

@media (max-width:600px){ .step{flex-direction:column;gap:12px} .cover h1{font-size:25px} }
</style>
</head>
<body>
<div class="wrap">

  <div class="cover">
    <div class="cover-rail"></div>
    <div class="cover-eyebrow">TrenTurnos · Guía rápida</div>
    <h1>Cómo publicar un cambio para toda la base</h1>
    <p>A diferencia de "Nueva solicitud de cambio" (que va dirigida a una persona en concreto), esto es un tablón público: publicas un turno tuyo y <b>cualquier compañero</b> de tu base puede ofrecerte un cambio. Nombres y matrículas de esta guía son inventados.</p>

    <div class="cast">
      <div class="cast-card"><div class="cast-av" style="background:rgba(249,115,22,.18);color:#FDBA74">SD</div><div><div class="cast-name">Sara Domínguez Ruiz</div><div class="cast-sub">Publica el cambio</div></div></div>
      <div class="cast-card"><div class="cast-av" style="background:rgba(37,99,235,.18);color:#93C5FD">MI</div><div><div class="cast-name">Marcos Iglesias Peña</div><div class="cast-sub">Hace una oferta</div></div></div>
      <div class="cast-card"><div class="cast-av" style="background:rgba(124,58,237,.18);color:#C084FC">LF</div><div><div class="cast-name">Laura Fernández Castro</div><div class="cast-sub">Hace otra oferta</div></div></div>
    </div>
  </div>

  <!-- PASO 1 -->
  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <span class="step-who sara">Sara</span>
      <h3 class="step-title">Sara marca uno o varios días seguidos suyos</h3>
      <p class="step-text">En "Cambios de turno" → <b>Publicar un cambio</b>. Puede marcar un solo día, o varios <b>seguidos</b> (una secuencia completa, como un bloque de varios días de servicio) — no días sueltos random.</p>
      <div class="phone-shot">
        <div class="ps-check-item"><div class="ps-check"></div><div><div class="ps-day-txt">Miércoles 23</div><div class="ps-day-sub">Tren 4021 · 5:40 → 13:15</div></div></div>
        <div class="ps-check-item on"><div class="ps-check on">✓</div><div><div class="ps-day-txt">Jueves 24</div><div class="ps-day-sub">Tren 7734 · 14:00 → 22:10</div></div></div>
        <div class="ps-check-item on"><div class="ps-check on">✓</div><div><div class="ps-day-txt">Viernes 25</div><div class="ps-day-sub">Tren 7735 · 14:00 → 22:10</div></div></div>
        <div class="ps-seq">📦 Secuencia de 2 días: jueves 24 a viernes 25 — se ofrecen juntos.</div>
      </div>
    </div>
  </div>

  <!-- PASO 2 -->
  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <span class="step-who sara">Sara</span>
      <h3 class="step-title">Añade una nota y publica</h3>
      <p class="step-text">La nota es opcional, pero ayuda a que los compañeros sepan qué busca. Se publica en el tablón de <b>toda su base</b>, y se retira sola a los <b>7 días</b> si nadie hace una oferta.</p>
      <div class="phone-shot">
        <div class="ps-day-sub" style="margin-bottom:8px;font-style:italic">"Busco cambiar por algo de mañana, tengo un compromiso esa tarde"</div>
        <div class="ps-btn nar">📢 Publicar</div>
      </div>
    </div>
  </div>

  <!-- PASO 3 -->
  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <span class="step-who todos">Todos los compañeros</span>
      <h3 class="step-title">Aparece en "Cambios publicados"</h3>
      <p class="step-text">Cualquiera de la base puede verlo, con el detalle completo (tren, hora de toma, hora de deje de cada día) — esto sale del <b>Horario Individual</b> que cada uno ya tiene subido.</p>
      <div class="phone-shot">
        <div class="ps-feed-item">
          <div class="ps-feed-hdr">
            <div class="ps-av" style="background:rgba(249,115,22,.2);color:#FDBA74">SD</div>
            <div><div class="ps-name">Sara Domínguez Ruiz</div><div class="ps-sub">Publicado hace 1 hora</div></div>
            <div class="ps-expiry">Caduca en 6 días</div>
          </div>
          <div class="ps-day-txt">📦 Jueves 24 → Viernes 25</div>
          <div class="ps-day-sub">Jue: Tren 7734 · 14:00→22:10 · Vie: Tren 7735 · 14:00→22:10</div>
        </div>
        <div class="ps-btn blue">Ofrecer un cambio</div>
      </div>
    </div>
  </div>

  <!-- PASO 4 -->
  <div class="step">
    <div class="step-num">4</div>
    <div class="step-body">
      <span class="step-who marcos">Marcos</span> <span class="step-who laura">Laura</span>
      <h3 class="step-title">Dos compañeros distintos hacen su oferta</h3>
      <p class="step-text">Cada uno elige sus propios días (uno o varios seguidos) para ofrecer a cambio. <b>No hay límite de cuántas ofertas puede recibir una publicación</b> — pueden ser varias personas a la vez, cada una proponiendo algo distinto.</p>
      <div class="phone-shot">
        <div class="ps-offer">
          <div class="ps-av" style="background:rgba(37,99,235,.2);color:#93C5FD">MI</div>
          <div class="ps-offer-info"><div class="ps-offer-name">Marcos Iglesias Peña</div><div class="ps-offer-detail">Ofrece: Sáb 26 → Dom 27 (2 días)</div></div>
        </div>
        <div class="ps-offer">
          <div class="ps-av" style="background:rgba(124,58,237,.2);color:#C084FC">LF</div>
          <div class="ps-offer-info"><div class="ps-offer-name">Laura Fernández Castro</div><div class="ps-offer-detail">Ofrece: Martes 29 (1 día)</div></div>
        </div>
      </div>
    </div>
  </div>

  <!-- PASO 5 -->
  <div class="step">
    <div class="step-num">5</div>
    <div class="step-body">
      <span class="step-who sara">Sara</span>
      <h3 class="step-title">Sara elige la oferta que más le convenga</h3>
      <p class="step-text">En "Mis publicaciones" ve todas las ofertas recibidas, una por una, con el detalle completo. Al aceptar una, <b>las demás se cierran automáticamente</b> — solo se puede aceptar una.</p>
      <div class="phone-shot">
        <div class="ps-offer">
          <div class="ps-av" style="background:rgba(37,99,235,.2);color:#93C5FD">MI</div>
          <div class="ps-offer-info"><div class="ps-offer-name">Marcos Iglesias Peña</div><div class="ps-offer-detail">Sáb 26: Tren 6187 · Dom 27: Tren 6188</div></div>
          <div class="ps-offer-btn">Aceptar</div>
        </div>
        <div class="ps-offer">
          <div class="ps-av" style="background:rgba(124,58,237,.2);color:#C084FC">LF</div>
          <div class="ps-offer-info"><div class="ps-offer-name">Laura Fernández Castro</div><div class="ps-offer-detail">Martes 29: Descanso</div></div>
          <div class="ps-offer-btn">Aceptar</div>
        </div>
      </div>
      <div class="note">La publicación <b>desaparece del tablón</b> en cuanto se acepta una oferta — pero se queda guardada en el historial de Sara ("Mis publicaciones"), para poder llevar un control de qué se cambió y con quién.</div>
    </div>
  </div>

  <!-- PASO 6 -->
  <div class="step">
    <div class="step-num">6</div>
    <div class="step-body">
      <span class="step-who marcos">Marcos</span> <span class="step-who sara">Sara</span>
      <h3 class="step-title">El correo lo manda quien ofreció, luego cada uno confirma</h3>
      <p class="step-text">Igual que en "Nueva solicitud de cambio": <b>solo Marcos</b> (quien hizo la oferta aceptada) manda el correo a Programación. Sara no tiene que hacer nada con eso. Después, <b>cada uno confirma en su propio calendario</b>, a su ritmo — solo un aviso visual, la nómina no cambia hasta que la empresa lo actualice.</p>
    </div>
  </div>

  <div class="closing">
    <h2>En resumen</h2>
    <p>Es un tablón, no una petición directa — publicas y esperas a que alguien se anime, en vez de pedírselo tú a una persona concreta.</p>
    <ul class="closing-list">
      <li>Se pueden marcar varios días seguidos (una secuencia completa), no solo uno suelto.</li>
      <li>Se pueden tener varias publicaciones activas a la vez.</li>
      <li>Cualquier compañero de la base puede ofrecer un cambio, y pueden ser varios a la vez.</li>
      <li>Solo se puede aceptar una oferta — las demás se cierran solas.</li>
      <li>Se retira sola a los 7 días si nadie hace ninguna oferta.</li>
      <li>El correo lo manda quien ofreció el cambio, nunca quien publicó.</li>
    </ul>
  </div>

</div>
</body>
</html>
`;
function abrirGuiaPublicarCambio(){
  var frame = document.getElementById('iframeGuiaPublicarCambio');
  if(frame && !frame.dataset.cargado){
    frame.srcdoc = GUIA_PUBLICAR_CAMBIO_HTML;
    frame.dataset.cargado = '1';
  }
  openOv('ov-guia-publicar-cambio');
}
window.abrirGuiaPublicarCambio = abrirGuiaPublicarCambio;

// NUEVO — Confirmado por el usuario: contenido completo de
// guia_cambios_publicados.html incrustado como texto, mismo
// patrón que las otras dos guías.
var GUIA_CAMBIOS_PUBLICADOS_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cómo usar: Cambios publicados</title>
<style>
:root{
  --bg:#070D16; --panel:#0D1B2E; --panel2:#132236; --line:#1E3350;
  --purple:#7C3AED; --purple-soft:#C084FC; --nar:#F97316; --nar-soft:#FDBA74;
  --blue:#2563EB; --blue-soft:#93C5FD; --green:#16A34A; --green-soft:#4ADE80;
  --ink:#F8FAFC; --ink-dim:#B8C2D0; --ink-faint:#6B7A90;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5}
.wrap{max-width:760px;margin:0 auto;padding:0 20px 80px}

.cover{padding:56px 0 40px;border-bottom:1px solid var(--line);margin-bottom:8px}
.cover-eyebrow{font-size:13px;color:var(--purple-soft);font-weight:600;margin-bottom:14px}
.cover h1{font-size:32px;line-height:1.15;margin:0 0 16px;font-weight:800;letter-spacing:-.01em}
.cover p{font-size:16px;color:var(--ink-dim);max-width:540px;margin:0}
.cover-rail{width:56px;height:3px;background:var(--purple);border-radius:2px;margin-bottom:20px}

.tabs-demo{display:flex;gap:6px;background:var(--panel);border:1px solid var(--line);border-radius:11px;
  padding:4px;max-width:320px;margin-top:24px}
.tab-demo{flex:1;text-align:center;padding:8px 4px;border-radius:8px;font-size:11.5px;font-weight:700}
.tab-demo.on{background:var(--nar);color:#1a1306}
.tab-demo.off{color:var(--ink-faint)}

.step{display:flex;gap:24px;padding:38px 0;border-bottom:1px solid var(--line);align-items:flex-start}
.step:last-of-type{border-bottom:none}
.step-num{width:34px;height:34px;border-radius:50%;background:var(--panel2);border:1px solid var(--line);
  display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;
  color:var(--purple-soft);flex-shrink:0;margin-top:2px}
.step-body{flex:1;min-width:0}
.step-tab-tag{display:inline-block;font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;margin-bottom:10px}
.step-tab-tag.tablon{background:rgba(249,115,22,.15);color:var(--nar-soft)}
.step-tab-tag.mias{background:rgba(124,58,237,.15);color:var(--purple-soft)}
.step-title{font-size:18px;font-weight:700;margin:0 0 10px}
.step-text{font-size:14.5px;color:var(--ink-dim);margin:0 0 16px;max-width:480px}
.step-text b{color:var(--ink);font-weight:600}

.phone-shot{background:var(--panel);border:1px solid var(--line);border-radius:16px;
  padding:14px 16px;max-width:420px;font-size:12.5px}
.ps-feed-item{background:var(--panel2);border-radius:10px;padding:10px;margin-bottom:8px}
.ps-feed-hdr{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.ps-av{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:800;flex-shrink:0}
.ps-name{font-weight:700;font-size:11px}
.ps-sub{font-size:9px;color:var(--ink-faint)}
.ps-expiry{font-size:8.5px;color:var(--ink-faint);margin-left:auto}
.ps-day-txt{font-size:11px;font-weight:700}
.ps-day-sub{font-size:9.5px;color:var(--blue-soft);margin-top:2px}
.ps-note{font-size:9.5px;font-style:italic;color:var(--ink-dim);margin:6px 0}
.ps-btn{padding:8px;border-radius:8px;font-size:10.5px;font-weight:700;text-align:center;margin-top:6px}
.ps-btn.blue{background:var(--blue);color:#fff}
.ps-btn.red{background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.4);color:#F87171}
.ps-check-item{display:flex;align-items:center;gap:9px;background:var(--panel2);border-radius:9px;
  padding:8px 10px;margin-bottom:6px}
.ps-check{width:15px;height:15px;border-radius:4px;background:var(--panel);border:1.3px solid var(--line);
  flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:transparent}
.ps-check.on{background:var(--blue);border-color:var(--blue);color:#fff;font-weight:900}
.ps-offer{display:flex;align-items:center;gap:8px;background:var(--panel);border-radius:8px;
  padding:7px 9px;margin-bottom:6px}
.ps-offer-info{flex:1}
.ps-offer-name{font-size:10px;font-weight:700}
.ps-offer-detail{font-size:9px;color:var(--ink-faint)}
.ps-offer-btn{background:var(--green);color:#fff;font-size:8.5px;font-weight:800;padding:5px 9px;border-radius:7px}

.note{background:var(--panel);border-left:3px solid var(--purple);border-radius:0 10px 10px 0;
  padding:12px 16px;font-size:13px;color:var(--ink-dim);margin-top:16px;max-width:480px}
.note b{color:var(--purple-soft)}

.closing{padding:44px 0 0}
.closing h2{font-size:20px;margin:0 0 12px}
.closing p{font-size:14.5px;color:var(--ink-dim);max-width:520px}
.closing-list{margin:18px 0 0;padding:0;list-style:none}
.closing-list li{font-size:13.5px;color:var(--ink-dim);padding:8px 0 8px 22px;position:relative;border-top:1px solid var(--line)}
.closing-list li:before{content:"—";position:absolute;left:0;color:var(--ink-faint)}

@media (max-width:600px){ .step{flex-direction:column;gap:12px} .cover h1{font-size:25px} }
</style>
</head>
<body>
<div class="wrap">

  <div class="cover">
    <div class="cover-rail"></div>
    <div class="cover-eyebrow">TrenTurnos · Guía rápida</div>
    <h1>Cómo usar "Cambios publicados"</h1>
    <p>Esta es la pantalla del <b>tablón</b> — para ver lo que otros compañeros han publicado, ofrecerles un cambio, y gestionar tus propias publicaciones. Si lo que quieres es aprender a publicar algo tuyo primero, mira la guía de "Publicar un cambio".</p>
    <div class="tabs-demo">
      <div class="tab-demo on">Tablón</div>
      <div class="tab-demo off">Mis publicaciones</div>
    </div>
  </div>

  <!-- PASO 1 -->
  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <span class="step-tab-tag tablon">Pestaña: Tablón</span>
      <h3 class="step-title">Mira todo lo que hay publicado ahora</h3>
      <p class="step-text">Aquí ves <b>todas las publicaciones activas de tu base</b> (menos las tuyas propias) — con el tren, hora de toma y deje de cada día, y cuántos días le quedan antes de caducar.</p>
      <div class="phone-shot">
        <div class="ps-feed-item">
          <div class="ps-feed-hdr">
            <div class="ps-av" style="background:rgba(249,115,22,.2);color:#FDBA74">SD</div>
            <div><div class="ps-name">Sara Domínguez Ruiz</div><div class="ps-sub">Publicado hace 1 hora</div></div>
            <div class="ps-expiry">Caduca en 6 días</div>
          </div>
          <div class="ps-day-txt">📦 Jueves 24 → Viernes 25</div>
          <div class="ps-day-sub">Jue: Tren 7734 · 14:00→22:10</div>
          <div class="ps-day-sub">Vie: Tren 7735 · 14:00→22:10</div>
          <div class="ps-note">"Busco cambiar por algo de mañana"</div>
          <div class="ps-btn blue">Ofrecer un cambio</div>
        </div>
      </div>
    </div>
  </div>

  <!-- PASO 2 -->
  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <span class="step-tab-tag tablon">Pestaña: Tablón</span>
      <h3 class="step-title">Si te interesa, toca "Ofrecer un cambio"</h3>
      <p class="step-text">Marca uno o varios días <b>tuyos</b> seguidos, para proponer a cambio del turno publicado. Puedes añadir un mensaje corto si quieres.</p>
      <div class="phone-shot">
        <div class="ps-check-item"><div class="ps-check"></div><div><div class="ps-day-txt">Miércoles 23</div><div class="ps-day-sub">Tren 4021</div></div></div>
        <div class="ps-check-item" style="border:1px solid var(--blue)"><div class="ps-check on">✓</div><div><div class="ps-day-txt">Sábado 26</div><div class="ps-day-sub">Tren 6187</div></div></div>
        <div class="ps-btn blue">Enviar oferta</div>
      </div>
      <div class="note">Esto es una <b>propuesta</b>, no algo definitivo todavía — quien publicó decide si la acepta, la deja pasar, o acepta la de otro compañero.</div>
    </div>
  </div>

  <!-- PASO 3 -->
  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <span class="step-tab-tag mias">Pestaña: Mis publicaciones</span>
      <h3 class="step-title">Aquí gestionas lo que TÚ has publicado</h3>
      <p class="step-text">Cambia a esta pestaña para ver tus propias publicaciones activas, con las ofertas que te han hecho otros compañeros — cada una con su detalle completo.</p>
      <div class="phone-shot">
        <div class="ps-feed-item">
          <div class="ps-day-txt">📦 Jueves 24 → Viernes 25</div>
          <div class="ps-expiry" style="margin:2px 0 8px">Caduca en 6 días</div>
          <div class="ps-offer">
            <div class="ps-av" style="background:rgba(37,99,235,.2);color:#93C5FD">MI</div>
            <div class="ps-offer-info"><div class="ps-offer-name">Marcos Iglesias Peña</div><div class="ps-offer-detail">Sáb 26: Tren 6187 · Dom 27: Tren 6188</div></div>
            <div class="ps-offer-btn">Aceptar</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- PASO 4 -->
  <div class="step">
    <div class="step-num">4</div>
    <div class="step-body">
      <span class="step-tab-tag mias">Pestaña: Mis publicaciones</span>
      <h3 class="step-title">Aceptar una oferta, o retirar la publicación</h3>
      <p class="step-text">Si te convence una oferta, la aceptas — las demás se cierran solas. Si ya no te hace falta el cambio (aunque tengas ofertas o no), puedes <b>retirar la publicación</b> en cualquier momento.</p>
      <div class="phone-shot">
        <div class="ps-btn red">✕ Retirar publicación</div>
      </div>
      <div class="note">Al aceptar una oferta, esa publicación <b>desaparece del tablón</b> — ya no la ven los demás — pero se queda guardada en tu historial aquí mismo, para tener constancia de qué se cambió.</div>
    </div>
  </div>

  <!-- PASO 5 -->
  <div class="step">
    <div class="step-num">5</div>
    <div class="step-body">
      <span class="step-tab-tag mias">Después de aceptar</span>
      <h3 class="step-title">El correo lo manda quien hizo la oferta</h3>
      <p class="step-text">En cuanto aceptas, a <b>Marcos</b> (quien te ofertó) le sale la pantalla para mandar el correo a Programación — tú no tienes que hacer nada con eso. Después, cada uno confirma en su propio calendario, cuando quiera.</p>
    </div>
  </div>

  <div class="closing">
    <h2>En resumen</h2>
    <p>Dos pestañas, dos propósitos distintos: una para mirar y ofertar sobre lo de otros, otra para gestionar lo tuyo.</p>
    <ul class="closing-list">
      <li><b>Tablón:</b> ves las publicaciones de los demás y puedes ofrecer un cambio.</li>
      <li><b>Mis publicaciones:</b> ves las tuyas, con las ofertas recibidas, y decides.</li>
      <li>Ofertar no es definitivo — solo quien publicó decide si acepta, y solo puede aceptar una.</li>
      <li>Puedes retirar tu publicación en cualquier momento, tengas o no ofertas.</li>
      <li>Una publicación aceptada se queda como historial, aunque ya no se vea en el tablón.</li>
    </ul>
  </div>

</div>
</body>
</html>
`;
function abrirGuiaCambiosPublicados(){
  var frame = document.getElementById('iframeGuiaCambiosPublicados');
  if(frame && !frame.dataset.cargado){
    frame.srcdoc = GUIA_CAMBIOS_PUBLICADOS_HTML;
    frame.dataset.cargado = '1';
  }
  openOv('ov-guia-cambios-publicados');
}
window.abrirGuiaCambiosPublicados = abrirGuiaCambiosPublicados;



/* ═══════════════════════════════════════════════════════════
   NUEVO — Confirmado por el usuario: "Publicar un cambio" (tablón
   público) + "Cambios publicados". Mismas reglas de oro que el
   resto de "Cambios de turno": NUNCA se escribe en TV/TV2 — todo
   esto es gestión de publicaciones/ofertas + el mismo aviso visual
   aparte (_leerCambiosVisual/_guardarCambiosVisual, reutilizados
   tal cual) para cada día implicado, sin tocar Nómina/HP/HE/HTDL.
═══════════════════════════════════════════════════════════ */

// ── Estado propio del formulario de publicar ──
var _pubDias = []; // números de día marcados, del mes que se esté viendo
var _pubMesActual = null; // {anio, mes}
var _pubDetallePorDia = {}; // dia -> detalle (de construirDetalleDiaPropio)

function abrirPublicarCambio(){
  if(!activeBase){
    if(typeof toast==='function') toast('Cargando compañeros...');
    if(typeof abrirAccesoBuscadorCompaneros==='function') abrirAccesoBuscadorCompaneros();
    _pubEsperarActiveBaseYAbrir();
    return;
  }
  _pubDias = []; _pubDetallePorDia = {};
  document.getElementById('pubMensajeInput').value = '';
  document.getElementById('pubEstado').innerHTML = '';
  document.getElementById('pubSeqResumen').innerHTML = '';
  var sedeTxt = (activeBase && activeBase.label) ? activeBase.label : '—';
  document.getElementById('pubHdrSede').textContent = sedeTxt;
  var hoy = new Date();
  _pubPintarDiasDelMes(hoy.getFullYear(), hoy.getMonth()+1);
  openOv('ov-publicar-cambio');
}
window.abrirPublicarCambio = abrirPublicarCambio;

var _pubEsperandoActiveBase = false;
function _pubEsperarActiveBaseYAbrir(){
  if(_pubEsperandoActiveBase) return;
  _pubEsperandoActiveBase = true;
  var intentos = 0;
  var intervalo = setInterval(function(){
    intentos++;
    if(activeBase){
      clearInterval(intervalo); _pubEsperandoActiveBase = false;
      abrirPublicarCambio();
      return;
    }
    if(intentos > 240){ clearInterval(intervalo); _pubEsperandoActiveBase = false; }
  }, 500);
}

function _pubElegirMes(){
  openOv('ov-pub-mes');
  var panel = document.getElementById('pubMesCalPanel');
  panel.innerHTML = '';
  generarCalendarioUI('pubMesCalPanel', function(fecha){
    closeOv('ov-pub-mes');
    _pubDias = []; _pubDetallePorDia = {};
    document.getElementById('pubSeqResumen').innerHTML = '';
    _pubPintarDiasDelMes(fecha.getFullYear(), fecha.getMonth()+1);
  });
}
window._pubElegirMes = _pubElegirMes;

// Días con turno/estado propio de un mes, en días FUTUROS —
// reutiliza construirDetalleDiaPropio() tal cual (misma fuente que
// ya usa "Nueva solicitud de cambio" y la sincronización).
function _pubPintarDiasDelMes(anio, mes){
  _pubMesActual = { anio: anio, mes: mes };
  var cont = document.getElementById('pubDiasLista');
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var diasEnMes = new Date(anio, mes, 0).getDate();
  var html = '';
  var huboAlguno = false;
  for(var d=1; d<=diasEnMes; d++){
    var fechaDia = new Date(anio, mes-1, d);
    if(fechaDia < hoy) continue;
    var det = construirDetalleDiaPropio(anio, mes, d);
    if(!det) continue;
    huboAlguno = true;
    _pubDetallePorDia[d] = det;
    var resumen = _resumenTurno(det);
    html += '<div class="ct-day-check" id="pubDia_'+d+'" onclick="_pubToggleDia('+d+')">'
      + '<div class="ct-check-box" id="pubCheck_'+d+'">✓</div>'
      + '<div><div class="ct-req-name" style="font-size:11.5px">'+weekdayForDay(d)+' '+d+'</div><div class="ct-req-sub">'+resumen+'</div></div>'
      + '</div>';
  }
  cont.innerHTML = huboAlguno ? html : '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">No tienes ningún día futuro con algo registrado en '+MESES_CAL_TREN[mes-1].toLowerCase()+' — prueba con otro mes.</div>';
}

function _pubToggleDia(dia){
  var idx = _pubDias.indexOf(dia);
  if(idx>=0) _pubDias.splice(idx,1); else _pubDias.push(dia);
  _pubDias.sort(function(a,b){return a-b;});
  var check = document.getElementById('pubCheck_'+dia);
  var card = document.getElementById('pubDia_'+dia);
  var marcado = _pubDias.indexOf(dia)>=0;
  if(check) check.classList.toggle('on', marcado);
  if(card) card.classList.toggle('sel', marcado);
  _pubActualizarResumenSecuencia();
}
window._pubToggleDia = _pubToggleDia;

// Comprueba que los días marcados sean CONSECUTIVOS (una secuencia
// de verdad, no días sueltos random) y pinta el aviso.
function _diasSonConsecutivos(dias){
  if(dias.length<=1) return true;
  for(var i=1;i<dias.length;i++){ if(dias[i] !== dias[i-1]+1) return false; }
  return true;
}
function _pubActualizarResumenSecuencia(){
  var el = document.getElementById('pubSeqResumen');
  if(!_pubDias.length){ el.innerHTML=''; return; }
  if(!_diasSonConsecutivos(_pubDias)){
    el.innerHTML = '<div class="ct-seq-note" style="border-color:rgba(220,38,38,.4);background:rgba(220,38,38,.08);color:#F87171">⚠️ Los días marcados tienen que ser seguidos (una secuencia), no sueltos.</div>';
    return;
  }
  if(_pubDias.length===1){
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '<div class="ct-seq-note">📦 Vas a publicar una <b>secuencia de '+_pubDias.length+' días</b>: '+weekdayForDay(_pubDias[0])+' '+_pubDias[0]+' a '+weekdayForDay(_pubDias[_pubDias.length-1])+' '+_pubDias[_pubDias.length-1]+' — se ofrecen juntos, no por separado.</div>';
}

async function publicarCambioTurno(){
  var estadoEl = document.getElementById('pubEstado');
  if(!_pubDias.length){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Marca al menos un día.</span>'; return; }
  if(!_diasSonConsecutivos(_pubDias)){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Los días tienen que ser seguidos.</span>'; return; }
  if(!AJ || !AJ.matricula || !AJ.nombre){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Configura tu nombre y matrícula en Ajustes primero.</span>'; return; }
  estadoEl.innerHTML = '<span style="color:var(--tx3)">Publicando...</span>';
  try{
    var detalleCompleto = {};
    _pubDias.forEach(function(d){ detalleCompleto[d] = _pubDetallePorDia[d]; });
    var fechaCad = new Date(); fechaCad.setDate(fechaCad.getDate()+7);
    var payload = {
      matricula_publicador: AJ.matricula,
      nombre_publicador: AJ.nombre,
      anio: _pubMesActual.anio,
      dias: _pubDias,
      detalle: detalleCompleto,
      nota: document.getElementById('pubMensajeInput').value.trim() || null,
      estado: 'activa',
      fecha_caducidad: fechaCad.toISOString()
    };
    var r = await sbAdmin.from('publicaciones_cambio_turno').insert(payload);
    if(r.error){
      estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ No se pudo publicar (¿existe la tabla publicaciones_cambio_turno en Supabase?): '+r.error.message+'</span>';
      return;
    }
    estadoEl.innerHTML = '<span style="color:var(--green2)">✅ Publicado.</span>';
    setTimeout(function(){ closeOv('ov-publicar-cambio'); }, 900);
  }catch(e){
    estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Error: '+e.message+'</span>';
  }
}
window.publicarCambioTurno = publicarCambioTurno;

// ── Tablón: "Cambios publicados" ──
function abrirCambiosPublicados(){
  if(!activeBase){
    if(typeof toast==='function') toast('Cargando compañeros...');
    if(typeof abrirAccesoBuscadorCompaneros==='function') abrirAccesoBuscadorCompaneros();
    return;
  }
  var sedeTxt = (activeBase && activeBase.label) ? activeBase.label : '—';
  document.getElementById('cpubHdrSede').textContent = sedeTxt;
  openOv('ov-cambios-publicados');
  _cpubCambiarTab('todas');
}
window.abrirCambiosPublicados = abrirCambiosPublicados;

function _cpubCambiarTab(tab){
  document.getElementById('cpubTabTodas').classList.toggle('on', tab==='todas');
  document.getElementById('cpubTabMias').classList.toggle('on', tab==='mias');
  document.getElementById('cpubTabOfertas').classList.toggle('on', tab==='ofertas');
  document.getElementById('cpubListaTodas').style.display = tab==='todas' ? '' : 'none';
  document.getElementById('cpubListaMias').style.display = tab==='mias' ? '' : 'none';
  document.getElementById('cpubListaOfertas').style.display = tab==='ofertas' ? '' : 'none';
  if(tab==='todas') cargarCambiosPublicados();
  else if(tab==='mias') cargarMisPublicaciones();
  else cargarMisOfertas();
}
window._cpubCambiarTab = _cpubCambiarTab;

// NUEVO — Confirmado por el usuario: "Mis ofertas" — todas las
// ofertas que TÚ has hecho sobre publicaciones de otros, con su
// estado, y el mismo botón "Ver siguiente paso" que ya usa "Tus
// solicitudes enviadas" cuando te aceptan una.
async function cargarMisOfertas(){
  if(!sbAdmin || !AJ || !AJ.matricula) return;
  var cont = document.getElementById('cpubListaOfertas');
  cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Cargando...</div>';
  try{
    var r = await sbAdmin.from('ofertas_publicacion_turno').select('*').eq('matricula_ofertante', AJ.matricula).order('fecha_hora',{ascending:false}).limit(20);
    var filas = (r && r.data) || [];
    if(!filas.length){ cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Todavía no has hecho ninguna oferta.</div>'; return; }
    var html = '';
    for(var i=0;i<filas.length;i++){
      var o = filas[i];
      var rp = await sbAdmin.from('publicaciones_cambio_turno').select('nombre_publicador,dias').eq('id', o.publicacion_id).maybeSingle();
      var nombrePub = (rp && rp.data) ? rp.data.nombre_publicador : '—';
      var chip = o.estado==='pendiente' ? '<span class="ct-status-chip ct-status-pend">⏳ Pendiente</span>'
        : o.estado==='aceptada' ? '<span class="ct-status-chip ct-status-ok">✅ Aceptada</span>'
        : '<span class="ct-status-chip ct-status-no">✕ Rechazada</span>';
      var accionesExtra = (o.estado==='aceptada' && !o.confirmado_ofertante)
        ? '<div class="ct-next-step-btn" onclick="mostrarPasosPostAceptacionPublicacion('+o.id+')">Ver siguiente paso (correo + confirmar)</div>'
        // NUEVO — Confirmado por el usuario: antes no había NINGÚN
        // botón aquí salvo en el caso de aceptada-sin-confirmar —
        // ahora se puede cancelar mientras esté pendiente, o
        // eliminar del historial una vez resuelta.
        : (o.estado==='pendiente' ? '<div class="ct-cancel-btn" onclick="cancelarOfertaPublicacion('+o.id+')">Cancelar oferta</div>'
          : '<div class="ct-cancel-btn" onclick="eliminarOfertaPublicacion('+o.id+')">🗑 Eliminar</div>');
      html += '<div class="ct-feed-item">'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
        + '<div><div class="ct-req-name" style="font-size:12px">'+nombrePub+'</div><div class="ct-req-sub">'+(o.dias.length>1?'📦 ':'')+_diasTexto(o.dias)+'</div></div>'
        + chip + '</div>' + accionesExtra + '</div>';
    }
    cont.innerHTML = html;
  }catch(e){ console.warn('cargarMisOfertas:', e); }
}
window.cargarMisOfertas = cargarMisOfertas;

// NUEVO — Confirmado por el usuario: cancelar una oferta propia
// mientras siga pendiente (aún no la han aceptado ni rechazado).
async function cancelarOfertaPublicacion(id){
  if(!sbAdmin) return;
  await sbAdmin.from('ofertas_publicacion_turno').update({estado:'rechazada'}).eq('id', id);
  cargarMisOfertas();
  if(typeof cargarNotificacionesPublicaciones === 'function') cargarNotificacionesPublicaciones();
}
window.cancelarOfertaPublicacion = cancelarOfertaPublicacion;

// NUEVO — Confirmado por el usuario: eliminar del historial una
// oferta ya resuelta (aceptada y confirmada, o rechazada/cancelada).
async function eliminarOfertaPublicacion(id){
  if(!sbAdmin) return;
  if(!confirm('¿Eliminar esta oferta de tu historial? No se puede deshacer.')) return;
  await sbAdmin.from('ofertas_publicacion_turno').delete().eq('id', id);
  cargarMisOfertas();
}
window.eliminarOfertaPublicacion = eliminarOfertaPublicacion;

function _diasTexto(dias){
  if(dias.length===1) return weekdayForDay(dias[0])+' '+dias[0];
  return weekdayForDay(dias[0])+' '+dias[0]+' → '+weekdayForDay(dias[dias.length-1])+' '+dias[dias.length-1];
}
function _detalleSecuenciaHTML(dias, detalle, prefijoDia){
  var html = '';
  dias.forEach(function(d){
    var det = detalle[d];
    if(!det) return;
    var abbr = prefijoDia ? (['','Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][new Date().getDay()]) : '';
    var etiqueta = dias.length>1 ? (weekdayForDay(d).slice(0,3)+' '+d+': ') : '';
    if(det.esLibre){
      html += '<div class="ct-feed-turno-tren">'+etiqueta+det.tipoLibreLbl+'</div>';
    } else if(det.turnos && det.turnos.length){
      det.turnos.forEach(function(t){
        html += '<div class="ct-feed-turno-tren">'+etiqueta+'Tren '+t.numTren+(t.horaCI?' · '+t.horaCI:'')+(t.horaCO?' → '+t.horaCO:'')+'</div>';
      });
      if(det.esPernocta && det.diaVuelta){
        html += '<div class="ct-pernocta-tag">🌙 Pernocta — incluye la vuelta el día '+det.diaVuelta+'</div>';
        (det.turnosVuelta||[]).forEach(function(t){
          html += '<div class="ct-feed-turno-tren">Vuelta: Tren '+t.numTren+(t.horaCI?' · '+t.horaCI:'')+(t.horaCO?' → '+t.horaCO:'')+'</div>';
        });
      }
    }
  });
  return html;
}
function _expiraEnTexto(fechaCaducidad){
  var ms = new Date(fechaCaducidad) - new Date();
  var dias = Math.ceil(ms/86400000);
  if(dias<=0) return 'Caduca hoy';
  if(dias===1) return 'Caduca mañana';
  return 'Caduca en '+dias+' días';
}

async function cargarCambiosPublicados(){
  if(!sbAdmin || !AJ || !AJ.matricula) return;
  var cont = document.getElementById('cpubListaTodas');
  cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Cargando...</div>';
  try{
    var r = await sbAdmin.from('publicaciones_cambio_turno').select('*').eq('estado','activa').neq('matricula_publicador', AJ.matricula).gt('fecha_caducidad', new Date().toISOString()).order('fecha_publicacion',{ascending:false});
    var filas = (r && r.data) || [];
    var badge = document.getElementById('cambiosPublicadosBadge');
    if(filas.length){ badge.style.display=''; badge.textContent = filas.length; } else { badge.style.display='none'; }
    if(!filas.length){ cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Nadie de tu base tiene publicado ningún cambio ahora mismo.</div>'; return; }
    cont.innerHTML = filas.map(function(p){
      return '<div class="ct-feed-item">'
        + '<div class="ct-feed-hdr"><div class="ct-pcard-av">'+initials(p.nombre_publicador)+'</div>'
        + '<div><div class="ct-feed-name">'+p.nombre_publicador+'</div><div class="ct-feed-sub">Publicado '+_fechaRelativa(p.fecha_publicacion)+'</div></div>'
        + '<div class="ct-feed-expiry">'+_expiraEnTexto(p.fecha_caducidad)+'</div></div>'
        + '<div class="ct-feed-turno"><div class="ct-feed-turno-day">'+(p.dias.length>1?'📦 Secuencia: ':'')+_diasTexto(p.dias)+'</div>'+_detalleSecuenciaHTML(p.dias, p.detalle)+'</div>'
        + (p.nota ? '<div class="ct-feed-note">"'+p.nota+'"</div>' : '')
        + '<div class="feed-btn ct-send-btn" onclick="abrirOfrecerCambio('+p.id+')">Ofrecer un cambio</div>'
        + '</div>';
    }).join('');
  }catch(e){ console.warn('cargarCambiosPublicados:', e); }
}
window.cargarCambiosPublicados = cargarCambiosPublicados;

function _fechaRelativa(fecha){
  var ms = new Date() - new Date(fecha);
  var horas = Math.floor(ms/3600000);
  if(horas < 1) return 'hace un momento';
  if(horas < 24) return 'hace '+horas+'h';
  var dias = Math.floor(horas/24);
  if(dias===1) return 'ayer';
  return 'hace '+dias+' días';
}

async function cargarMisPublicaciones(){
  if(!sbAdmin || !AJ || !AJ.matricula) return;
  var cont = document.getElementById('cpubListaMias');
  cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Cargando...</div>';
  try{
    var r = await sbAdmin.from('publicaciones_cambio_turno').select('*').eq('matricula_publicador', AJ.matricula).order('fecha_publicacion',{ascending:false}).limit(15);
    var filas = (r && r.data) || [];
    if(!filas.length){ cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Todavía no has publicado ningún cambio.</div>'; return; }
    var html = '';
    for(var i=0;i<filas.length;i++){
      var p = filas[i];
      var chip = p.estado==='activa' ? '<span class="ct-status-chip ct-status-pend">⏳ Activa</span>'
        : p.estado==='aceptada' ? '<span class="ct-status-chip ct-status-ok">✅ Aceptada</span>'
        : p.estado==='retirada' ? '<span class="ct-status-chip" style="background:var(--s2);color:var(--tx3)">Retirada</span>'
        : '<span class="ct-status-chip" style="background:var(--s2);color:var(--tx3)">Caducada</span>';
      var ofertasHtml = '';
      if(p.estado==='activa'){
        var ro = await sbAdmin.from('ofertas_publicacion_turno').select('*').eq('publicacion_id', p.id).eq('estado','pendiente').order('fecha_hora',{ascending:false});
        var ofertas = (ro && ro.data) || [];
        if(ofertas.length){
          ofertasHtml = '<div class="ct-field-lbl" style="margin:8px 0 6px">'+ofertas.length+' oferta'+(ofertas.length>1?'s':'')+' recibida'+(ofertas.length>1?'s':'')+'</div>'
            + ofertas.map(function(o){
              return '<div class="ct-req-swap" style="flex-direction:column;align-items:stretch;gap:4px">'
                + '<div style="display:flex;align-items:center;gap:8px"><div class="ct-pcard-av" style="width:24px;height:24px;font-size:10px">'+initials(o.nombre_ofertante)+'</div><div class="ct-req-name" style="font-size:11px">'+o.nombre_ofertante+'</div></div>'
                + '<div style="font-size:10px;color:var(--tx2)">'+(o.dias.length>1?'📦 ':'')+_diasTexto(o.dias)+'</div>'
                + _detalleSecuenciaHTML(o.dias, o.detalle)
                + (o.mensaje ? '<div class="ct-req-msg" style="margin:4px 0">"'+o.mensaje+'"</div>' : '')
                + '<div class="ct-btn-accept" style="margin-top:4px" onclick="aceptarOfertaPublicacion('+o.id+','+p.id+')">Aceptar esta oferta</div>'
                + '</div>';
            }).join('')
          ;
        } else {
          ofertasHtml = '<div class="ct-field-lbl" style="margin:8px 0 4px">Sin ofertas todavía</div>';
        }
      }
      html += '<div class="ct-feed-item">'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
        + '<div class="ct-feed-turno-day">'+(p.dias.length>1?'📦 ':'')+_diasTexto(p.dias)+'</div>'
        + chip + '</div>'
        // FIX — "Mis publicaciones" no mostraba los detalles (trenes y horas) que SÍ ve el resto en el
        // Tablón. Se reutiliza _detalleSecuenciaHTML() tal cual; p.detalle||{} evita romper con filas antiguas sin detalle.
        + (function(){ var det = _detalleSecuenciaHTML(p.dias, p.detalle||{}); return det ? '<div class="ct-feed-turno" style="margin-top:8px">'+det+'</div>' : ''; })()
        + '<div class="ct-feed-expiry" style="margin-top:2px">'+(p.estado==='activa'?_expiraEnTexto(p.fecha_caducidad):'')+'</div>'
        + ofertasHtml
        + (p.estado==='activa' ? '<div class="ct-cancel-btn" onclick="retirarPublicacion('+p.id+')">Retirar publicación</div>' : '')
        // NUEVO — Confirmado por el usuario: para las ya resueltas
        // (aceptada/retirada/caducada) antes no había ningún botón
        // — ahora se puede eliminar del historial, igual que ya
        // existe para "Tus solicitudes enviadas".
        + (p.estado!=='activa' ? '<div class="ct-cancel-btn" onclick="eliminarPublicacion('+p.id+')">🗑 Eliminar</div>' : '')
        + '</div>';
    }
    cont.innerHTML = html;
  }catch(e){ console.warn('cargarMisPublicaciones:', e); }
}
window.cargarMisPublicaciones = cargarMisPublicaciones;

async function retirarPublicacion(id){
  if(!sbAdmin) return;
  if(!confirm('¿Retirar esta publicación? Dejará de verse en el tablón.')) return;
  await sbAdmin.from('publicaciones_cambio_turno').update({estado:'retirada'}).eq('id', id);
  cargarMisPublicaciones();
}
window.retirarPublicacion = retirarPublicacion;

// NUEVO — Confirmado por el usuario: eliminar del todo una
// publicación ya resuelta (aceptada/retirada/caducada). Antes borra
// sus ofertas asociadas — la tabla de ofertas apunta a la
// publicación (REFERENCES), así que si no se borran primero, la
// base de datos rechazaría borrar la publicación.
async function eliminarPublicacion(id){
  if(!sbAdmin) return;
  if(!confirm('¿Eliminar esta publicación de tu historial? No se puede deshacer.')) return;
  try{
    await sbAdmin.from('ofertas_publicacion_turno').delete().eq('publicacion_id', id);
    await sbAdmin.from('publicaciones_cambio_turno').delete().eq('id', id);
    cargarMisPublicaciones();
  }catch(e){ console.warn('eliminarPublicacion:', e); }
}
window.eliminarPublicacion = eliminarPublicacion;

// ── Ofrecer un cambio sobre una publicación ──
var _ofrDias = [];
var _ofrMesActual = null;
var _ofrDetallePorDia = {};
var _ofrPublicacionActual = null;

async function abrirOfrecerCambio(publicacionId){
  var r = await sbAdmin.from('publicaciones_cambio_turno').select('*').eq('id', publicacionId).maybeSingle();
  if(!r.data) return;
  _ofrPublicacionActual = r.data;
  _ofrDias = []; _ofrDetallePorDia = {};
  document.getElementById('ofrMensajeInput').value = '';
  document.getElementById('ofrEstado').innerHTML = '';
  document.getElementById('ofrSeqResumen').innerHTML = '';
  document.getElementById('ofrHdrA').textContent = 'A '+r.data.nombre_publicador;
  document.getElementById('ofrSuTurno').innerHTML = '<div class="ct-feed-turno"><div class="ct-feed-turno-day">Su '+(r.data.dias.length>1?'secuencia: ':'turno: ')+_diasTexto(r.data.dias)+'</div>'+_detalleSecuenciaHTML(r.data.dias, r.data.detalle)+'</div>';
  var hoy = new Date();
  _ofrPintarDiasDelMes(hoy.getFullYear(), hoy.getMonth()+1);
  openOv('ov-ofrecer-publicacion');
}
window.abrirOfrecerCambio = abrirOfrecerCambio;

function _ofrElegirMes(){
  openOv('ov-ofr-mes');
  var panel = document.getElementById('ofrMesCalPanel');
  panel.innerHTML = '';
  generarCalendarioUI('ofrMesCalPanel', function(fecha){
    closeOv('ov-ofr-mes');
    _ofrDias = []; _ofrDetallePorDia = {};
    document.getElementById('ofrSeqResumen').innerHTML = '';
    _ofrPintarDiasDelMes(fecha.getFullYear(), fecha.getMonth()+1);
  });
}
window._ofrElegirMes = _ofrElegirMes;

function _ofrPintarDiasDelMes(anio, mes){
  _ofrMesActual = { anio: anio, mes: mes };
  var cont = document.getElementById('ofrDiasLista');
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var diasEnMes = new Date(anio, mes, 0).getDate();
  var html = ''; var huboAlguno = false;
  for(var d=1; d<=diasEnMes; d++){
    var fechaDia = new Date(anio, mes-1, d);
    if(fechaDia < hoy) continue;
    var det = construirDetalleDiaPropio(anio, mes, d);
    if(!det) continue;
    huboAlguno = true;
    _ofrDetallePorDia[d] = det;
    html += '<div class="ct-day-check" id="ofrDia_'+d+'" onclick="_ofrToggleDia('+d+')">'
      + '<div class="ct-check-box" id="ofrCheck_'+d+'">✓</div>'
      + '<div><div class="ct-req-name" style="font-size:11.5px">'+weekdayForDay(d)+' '+d+'</div><div class="ct-req-sub">'+_resumenTurno(det)+'</div></div>'
      + '</div>';
  }
  cont.innerHTML = huboAlguno ? html : '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">No tienes ningún día futuro con algo registrado en '+MESES_CAL_TREN[mes-1].toLowerCase()+'.</div>';
}

function _ofrToggleDia(dia){
  var idx = _ofrDias.indexOf(dia);
  if(idx>=0) _ofrDias.splice(idx,1); else _ofrDias.push(dia);
  _ofrDias.sort(function(a,b){return a-b;});
  var check = document.getElementById('ofrCheck_'+dia);
  var card = document.getElementById('ofrDia_'+dia);
  var marcado = _ofrDias.indexOf(dia)>=0;
  if(check) check.classList.toggle('on', marcado);
  if(card) card.classList.toggle('sel', marcado);
  var el = document.getElementById('ofrSeqResumen');
  if(!_ofrDias.length){ el.innerHTML=''; return; }
  if(!_diasSonConsecutivos(_ofrDias)){
    el.innerHTML = '<div class="ct-seq-note" style="border-color:rgba(220,38,38,.4);background:rgba(220,38,38,.08);color:#F87171">⚠️ Los días marcados tienen que ser seguidos.</div>';
    return;
  }
  if(_ofrDias.length===1){ el.innerHTML=''; return; }
  el.innerHTML = '<div class="ct-seq-note" style="border-color:rgba(37,99,235,.4);background:rgba(37,99,235,.08);color:#93C5FD">📦 Ofreces tu secuencia de '+_ofrDias.length+' días: '+_diasTexto(_ofrDias)+'</div>';
}
window._ofrToggleDia = _ofrToggleDia;

async function enviarOfertaPublicacion(){
  var estadoEl = document.getElementById('ofrEstado');
  if(!_ofrDias.length){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Marca al menos un día.</span>'; return; }
  if(!_diasSonConsecutivos(_ofrDias)){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Los días tienen que ser seguidos.</span>'; return; }
  if(!AJ || !AJ.matricula || !AJ.nombre){ estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Configura tu nombre y matrícula en Ajustes primero.</span>'; return; }
  estadoEl.innerHTML = '<span style="color:var(--tx3)">Enviando...</span>';
  try{
    var detalleCompleto = {};
    _ofrDias.forEach(function(d){ detalleCompleto[d] = _ofrDetallePorDia[d]; });
    var payload = {
      publicacion_id: _ofrPublicacionActual.id,
      matricula_ofertante: AJ.matricula,
      nombre_ofertante: AJ.nombre,
      dias: _ofrDias,
      detalle: detalleCompleto,
      mensaje: document.getElementById('ofrMensajeInput').value.trim() || null,
      estado: 'pendiente'
    };
    var r = await sbAdmin.from('ofertas_publicacion_turno').insert(payload);
    if(r.error){
      estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ No se pudo enviar: '+r.error.message+'</span>';
      return;
    }
    estadoEl.innerHTML = '<span style="color:var(--green2)">✅ Oferta enviada.</span>';
    // NUEVO — Confirmado por el usuario: aviso push a quien publicó.
    _crearEventoPush(_ofrPublicacionActual.matricula_publicador, 'Nueva oferta en tu publicación', AJ.nombre+' te ha ofrecido un cambio de turno.');
    setTimeout(function(){ closeOv('ov-ofrecer-publicacion'); }, 900);
  }catch(e){
    estadoEl.innerHTML = '<span style="color:var(--nar3)">⚠️ Error: '+e.message+'</span>';
  }
}
window.enviarOfertaPublicacion = enviarOfertaPublicacion;

// ── Aceptar una oferta: la publicación pasa a 'aceptada' (se
//    retira del tablón pero se queda guardada como historial), las
//    demás ofertas de esa publicación se marcan 'rechazada', y se
//    muestra el mismo tipo de pantalla de correo + confirmar que ya
//    usa "Nueva solicitud de cambio" — el ofertante manda el correo
//    (propuso el cambio), el publicador solo confirma su calendario. ──
async function aceptarOfertaPublicacion(ofertaId, publicacionId){
  if(!sbAdmin) return;
  try{
    var r = await sbAdmin.from('ofertas_publicacion_turno').update({estado:'aceptada'}).eq('id', ofertaId).select().maybeSingle();
    await sbAdmin.from('ofertas_publicacion_turno').update({estado:'rechazada'}).eq('publicacion_id', publicacionId).neq('id', ofertaId);
    await sbAdmin.from('publicaciones_cambio_turno').update({estado:'aceptada', oferta_aceptada_id: ofertaId}).eq('id', publicacionId);
    cargarMisPublicaciones();
    if(typeof cargarNotificacionesPublicaciones === 'function') cargarNotificacionesPublicaciones();
    // NUEVO — Confirmado por el usuario: aviso push a quien ofertó.
    if(r && r.data){
      _crearEventoPush(r.data.matricula_ofertante, 'Oferta aceptada', (AJ&&AJ.nombre?AJ.nombre:'Tu compañero')+' aceptó tu oferta de cambio de turno.');
    }
    mostrarPasosPostAceptacionPublicacion(ofertaId);
  }catch(e){ console.warn('aceptarOfertaPublicacion:', e); }
}
window.aceptarOfertaPublicacion = aceptarOfertaPublicacion;

function _resumenSecuenciaTextoPlano(dias, detalle){
  return dias.map(function(d){
    var det = detalle[d];
    if(!det) return 'dia '+d+': sin datos';
    if(det.esLibre) return 'dia '+d+': '+((det.tipoLibreLbl||'').replace(/[^\x00-\x7F]/g,'').trim()||'libre');
    var trenes = (det.turnos||[]).map(function(t){ return 'Tren '+t.numTren; }).join(' y ');
    return 'dia '+d+': '+trenes;
  }).join(', ');
}

async function mostrarPasosPostAceptacionPublicacion(ofertaId){
  if(!sbAdmin) return;
  var ro = await sbAdmin.from('ofertas_publicacion_turno').select('*').eq('id', ofertaId).maybeSingle();
  if(!ro.data) return;
  var o = ro.data;
  var rp = await sbAdmin.from('publicaciones_cambio_turno').select('*').eq('id', o.publicacion_id).maybeSingle();
  if(!rp.data) return;
  var p = rp.data;
  var soyOfertante = !!(AJ && AJ.matricula && o.matricula_ofertante === AJ.matricula);
  var otroNombre = soyOfertante ? p.nombre_publicador : o.nombre_ofertante;
  var yaConfirmado = soyOfertante ? o.confirmado_ofertante : o.confirmado_publicador;
  var miNombre = (AJ && AJ.nombre) || '';
  var miMatricula = (AJ && AJ.matricula) || '';
  var asunto = 'Solicitud de cambio de turno - '+o.nombre_ofertante+' / '+p.nombre_publicador;
  // FIX — Confirmado por el usuario: quitar "(publicado en el
  // tablon)" y las etiquetas "Ofertante"/"Publicador" — ahora usa
  // las MISMAS etiquetas que ya usa el correo de "Nueva solicitud de
  // cambio" ("Solicitante"/"Companero"), para que sea consistente
  // entre las dos funciones.
  var cuerpoBruto =
    'Buenos dias.\n\n'
    + 'Cambio de turno entre companeros, aceptado por ambas partes:\n\n'
    + 'Solicitante: '+o.nombre_ofertante+' (matricula '+o.matricula_ofertante+')\n'
    + 'Companero: '+p.nombre_publicador+' (matricula '+p.matricula_publicador+')\n\n'
    + o.nombre_ofertante+' cambia: '+_resumenSecuenciaTextoPlano(o.dias, o.detalle)+'\n'
    + 'por el turno de '+p.nombre_publicador+': '+_resumenSecuenciaTextoPlano(p.dias, p.detalle)+'\n\n'
    + 'Espero su pronta respuesta.\nSaludos cordiales.\n\n'
    + 'Atentamente,\n'+miNombre+'\nMatricula: '+miMatricula
    + '\n\nSolicitud generada automaticamente por TrenTurno V5';
  var cuerpoLimpio = (typeof sanitizarTexto==='function') ? sanitizarTexto(cuerpoBruto) : cuerpoBruto;
  cuerpoLimpio = cuerpoLimpio.replace(/\n/g, '\r\n');
  var mailto = 'mailto:?subject='+encodeURIComponent(asunto)+'&body='+encodeURIComponent(cuerpoLimpio);
  var bloqueCorreo = soyOfertante
    ? ('<div class="ct-mail-prompt"><div class="ct-mail-prompt-ico">✉️</div><div class="ct-mail-prompt-tit">Envía el correo a Programación</div><div class="ct-mail-prompt-sub">Se abrirá tu app de correo, ya escrito. Solo dale a "Enviar".</div><a href="'+mailto+'" class="ct-mail-btn">Abrir correo</a></div>')
    : ('<div class="ct-mail-prompt"><div class="ct-mail-prompt-ico">✅</div><div class="ct-mail-prompt-tit">Ya no tienes que hacer nada con el correo</div><div class="ct-mail-prompt-sub">'+o.nombre_ofertante+' se encarga de avisar a Programación.</div></div>');
  var textoBtn = soyOfertante ? 'Ya envié el correo — actualizar mi calendario' : 'Actualizar mi calendario';
  var html = '<div class="ov on" id="ov-post-aceptacion-pub-temp" onclick="if(event.target===this) document.getElementById(\'ov-post-aceptacion-pub-temp\').remove()">'
    + '<div class="sh" onclick="event.stopPropagation()">'
    + '<div class="sh-hdr"><div class="sh-ico">✅</div><div><div class="sh-tit">Cambio aceptado</div><div class="sh-sub">Con '+otroNombre+'</div></div>'
    + '<button class="sh-close" onclick="document.getElementById(\'ov-post-aceptacion-pub-temp\').remove()">✕</button></div>'
    + '<div style="padding:16px">' + bloqueCorreo
    + (yaConfirmado
      ? '<div style="text-align:center;color:var(--green2);font-size:12px;font-weight:700">✅ Ya confirmaste este cambio en tu calendario.</div>'
      : '<div class="ct-confirm-box"><div class="ct-confirm-box-tit">📅 Actualizar tu calendario</div><div class="ct-confirm-box-sub">Solo un aviso visual — tu turno real para Nómina no cambia hasta que la empresa lo actualice.</div>'
        + '<div class="ct-confirm-btn" onclick="confirmarPublicacionEnMiCalendario('+o.id+','+soyOfertante+')">'+textoBtn+'</div></div>')
    + '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}
window.mostrarPasosPostAceptacionPublicacion = mostrarPasosPostAceptacionPublicacion;

// ── Confirmar en calendario (multi-día) — reutiliza EXACTAMENTE el
//    mismo almacén visual local que ya usa la solicitud directa
//    (_leerCambiosVisual/_guardarCambiosVisual), solo que ahora
//    puede marcar VARIOS días seguidos a la vez en cada lado. ──
async function confirmarPublicacionEnMiCalendario(ofertaId, soyOfertante){
  if(!sbAdmin) return;
  var ro = await sbAdmin.from('ofertas_publicacion_turno').select('*').eq('id', ofertaId).maybeSingle();
  if(!ro.data) return;
  var o = ro.data;
  var rp = await sbAdmin.from('publicaciones_cambio_turno').select('*').eq('id', o.publicacion_id).maybeSingle();
  if(!rp.data) return;
  var p = rp.data;
  var diasQueDoy = soyOfertante ? o.dias : p.dias;
  var diasQueRecibo = soyOfertante ? p.dias : o.dias;
  var detalleQueRecibo = soyOfertante ? p.detalle : o.detalle;
  var nombreOtro = soyOfertante ? p.nombre_publicador : o.nombre_ofertante;

  var visual = _leerCambiosVisual();
  var mesReal = (typeof curM!=='undefined' && curM) ? (curM.getMonth()+1) : (new Date().getMonth()+1);
  var claveMes = p.anio + '-' + mesReal;
  if(!visual[claveMes]) visual[claveMes] = {};
  diasQueDoy.forEach(function(d){
    visual[claveMes][d] = { tipo:'dado', con:nombreOtro, id:'pub_'+o.id };
  });
  diasQueRecibo.forEach(function(d){
    visual[claveMes][d] = { tipo:'recibido', con:nombreOtro, id:'pub_'+o.id, turnos: detalleQueRecibo[d] };
  });
  _guardarCambiosVisual(visual);

  var campo = soyOfertante ? 'confirmado_ofertante' : 'confirmado_publicador';
  var payload = {}; payload[campo] = true;
  await sbAdmin.from('ofertas_publicacion_turno').update(payload).eq('id', ofertaId);

  var ovTemp = document.getElementById('ov-post-aceptacion-pub-temp');
  if(ovTemp) ovTemp.remove();
  if(typeof renderCal === 'function') renderCal();
  if(typeof renderDiaArea === 'function') renderDiaArea();
  // NUEVO — Confirmado por el usuario: refresca el banner/badge al
  // terminar, igual que ya hace confirmarCambioEnMiCalendario().
  if(typeof cargarNotificacionesPublicaciones === 'function') cargarNotificacionesPublicaciones();
}
window.confirmarPublicacionEnMiCalendario = confirmarPublicacionEnMiCalendario;

function toggleCambiosTurnoAcordeon(){
  var acc = document.getElementById('cambiosTurnoAcordeon');
  var arr = document.getElementById('cambiosTurnoAcordeonArr');
  if(!acc) return;
  var abierto = acc.style.display !== 'none';
  acc.style.display = abierto ? 'none' : '';
  if(arr) arr.textContent = abierto ? '›' : '⌄';
  if(!abierto){
    cargarCambiosTurno();
    // NUEVO — Confirmado por el usuario: al abrir, baja la pantalla
    // sola para que se vea de una vez la tarjeta de "Nueva solicitud
    // de cambio", sin tener que desplazarse a mano para encontrarla.
    // El pequeño margen (setTimeout) es porque el acordeón tarda un
    // instante en tener su altura real tras quitarle el display:none
    // — si se hiciera scroll en el mismo momento, el navegador aún
    // no sabría hasta dónde puede bajar.
    setTimeout(function(){
      acc.scrollIntoView({behavior:'smooth', block:'start'});
    }, 60);
  }
}
window.toggleCambiosTurnoAcordeon = toggleCambiosTurnoAcordeon;

// ── 9) Confirmado por el usuario: al abrir el detalle de un día en
//    el calendario, si ese día tiene un cambio de turno confirmado,
//    mostrar toda la info completa (no solo el avisito de la
//    cuadrícula) — tren(es), horas, y si era pernocta, los dos días.
//    NUNCA toca lo que renderDiaArea() ya pintó — solo AÑADE un
//    bloque más al final, así que no hay riesgo de romper nada de
//    lo que ya funcionaba ahí. ──
function _inyectarInfoCambioTurnoEnDia(){
  if(typeof selDay === 'undefined' || !selDay || !selDay.k || selDay.d==null) return;
  var visual = _leerCambiosVisual();
  var partesK = selDay.k.split('-');
  var claveMes = parseInt(partesK[0],10) + '-' + parseInt(partesK[1],10);
  var mesData = visual[claveMes];
  if(!mesData || !mesData[selDay.d]) return;
  var info = mesData[selDay.d];
  var ovCard = document.getElementById('ov-dia-card');
  var useModal = ovCard && ovCard.classList.contains('on');
  var area = useModal ? document.getElementById('dia-card-body') : document.getElementById('dia-area');
  if(!area) return;
  var html = '';
  if(info.tipo === 'recibido'){
    html = '<div class="ct-day-pick" style="border-color:#7C3AED;margin-top:10px">'
      + '<div style="font-size:11px;font-weight:800;color:#c084fc;margin-bottom:6px">🔄 CAMBIO CON '+((info.con||'').toUpperCase())+'</div>';
    var td = info.turnos;
    if(td && td.esLibre){
      html += '<div class="ct-day-pick-turno">'+td.tipoLibreLbl+'</div>';
    } else if(td){
      (td.turnos||[]).forEach(function(t){
        html += '<div class="ct-day-pick-turno">🚆 Tren '+t.numTren+(t.horaCI?' · '+t.horaCI:'')+(t.horaCO?' → '+t.horaCO:'')+'</div>';
      });
      if(td.esPernocta && td.diaVuelta){
        html += '<div class="ct-pernocta-tag">🌙 Pernocta — incluye la vuelta del día '+td.diaVuelta+'</div>';
        (td.turnosVuelta||[]).forEach(function(t){
          html += '<div class="ct-day-pick-turno" style="margin-top:4px">🚆 Vuelta: Tren '+t.numTren+(t.horaCI?' · '+t.horaCI:'')+(t.horaCO?' → '+t.horaCO:'')+'</div>';
        });
      }
    }
    html += '<div style="font-size:10px;color:var(--tx3);margin-top:8px">Aviso informativo — tu turno real para Nómina no cambia hasta que la empresa lo actualice.</div>';
    html += '<div style="margin-top:8px;padding:7px;background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.3);border-radius:8px;color:#f87171;font-size:10.5px;font-weight:700;text-align:center;cursor:pointer" onclick="deshacerAvisoCambioTurno(\''+info.id+'\')">Deshacer este aviso</div>';
    html += '</div>';
  } else if(info.tipo === 'dado'){
    html = '<div class="ct-day-pick" style="border-color:#7C3AED;margin-top:10px">'
      + '<div style="font-size:11px;font-weight:800;color:#c084fc;margin-bottom:6px">🔄 CAMBIADO CON '+((info.con||'').toUpperCase())+'</div>'
      + '<div style="font-size:11.5px;color:var(--tx2)">Este día ahora lo hace '+(info.con||'')+'.</div>';
    if(info.miDetalleOriginal){
      html += '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Antes tenías: '+_resumenTurno(info.miDetalleOriginal)+'</div>';
    }
    html += '<div style="margin-top:8px;padding:7px;background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.3);border-radius:8px;color:#f87171;font-size:10.5px;font-weight:700;text-align:center;cursor:pointer" onclick="deshacerAvisoCambioTurno(\''+info.id+'\')">Deshacer este aviso</div>';
    html += '</div>';
  }
  if(html) area.insertAdjacentHTML('beforeend', html);
}
// NUEVO — Confirmado por el usuario: deshacer un aviso de cambio ya
// confirmado — SOLO borra la marca visual de este móvil (los dos
// días implicados que se guardaron con este mismo id, en cualquier
// mes). No toca TV/TV2, no manda ningún correo, no cambia el estado
// de la solicitud en Supabase (sigue constando como "aceptada" en
// el historial) — es puramente un borrado local.
function deshacerAvisoCambioTurno(id){
  var visual = _leerCambiosVisual();
  var cambiado = false;
  Object.keys(visual).forEach(function(claveMes){
    var mesData = visual[claveMes];
    Object.keys(mesData).forEach(function(dia){
      // FIX — Confirmado por el usuario: el botón ahora siempre
      // manda el id como texto (String), pero lo guardado puede ser
      // número (cambios directos) o texto con prefijo "pub_"
      // (publicaciones) — se compara como texto en los dos casos
      // para que "Deshacer" funcione siempre, venga de donde venga.
      if(mesData[dia] && String(mesData[dia].id) === String(id)){
        delete mesData[dia];
        cambiado = true;
      }
    });
  });
  if(cambiado){
    _guardarCambiosVisual(visual);
    if(typeof renderCal === 'function') renderCal();
    if(typeof renderDiaArea === 'function') renderDiaArea();
    if(typeof toast === 'function') toast('Aviso deshecho');
  }
}
window.deshacerAvisoCambioTurno = deshacerAvisoCambioTurno;
// Envuelve renderDiaArea() desde fuera, sin tocar su código interno
// (que es grande y con muchas ramas) — así, venga por el camino que
// venga, siempre se añade el aviso al final si corresponde.
if(typeof window.renderDiaArea === 'function' && !window._renderDiaArea_ctWrapped){
  var _renderDiaArea_original_ct = window.renderDiaArea;
  window.renderDiaArea = function(){
    _renderDiaArea_original_ct();
    _inyectarInfoCambioTurnoEnDia();
  };
  window._renderDiaArea_ctWrapped = true;
}

})();
/* ═══════════════════════════════════════════════════════════
   COPIA — Buscar por tren para INTERVENTOR (trTrainInput2/
   trGoBtn2/calTrenPanel2/trainView2). Reutiliza las funciones
   compartidas (activeBase, cellContainsTrain, buscarInterventor,
   generarCalendarioUI, mostrarConAnimacionTren, weekdayForDay,
   initials, ofuscarNombreInterventor) — solo se duplica el
   estado propio de ESTE widget (selectedTrainDay2, fecha propia,
   y el trainView2 donde pinta sus resultados).
═══════════════════════════════════════════════════════════ */
(function(){
  let selectedTrainDay2 = null;
  let fecha_seleccionada_busqueda2 = null;
  // NUEVO — Confirmado por Alex: mismo arreglo que en la copia de
  // Compañeros — este mini-calendario (calTrenPanel2) es propio de
  // Interventor y también es independiente del Calendario principal.
  let _cargaMesTrenPromise2 = null;

  generarCalendarioUI('calTrenPanel2', (fecha)=>{
    selectedTrainDay2 = fecha.getDate();
    fecha_seleccionada_busqueda2 = fecha;
    var mesFecha2 = { anio: fecha.getFullYear(), mes: fecha.getMonth()+1 };
    var yaCargado2 = BASES.global && BASES.global.mesAnio
      && BASES.global.mesAnio.anio===mesFecha2.anio && BASES.global.mesAnio.mes===mesFecha2.mes;
    if(!yaCargado2){
      _cargaMesTrenPromise2 = cargarHorarioGlobalDesdeAdmin(mesFecha2).then(function(ok){
        // FIX — Confirmado por Alex (mismo bug, misma causa que en
        // Compañeros): no se llama a activateBase('global') aquí —
        // además de reiniciar la búsqueda en curso, esa función toca
        // variables y HTML de la pantalla de Compañeros (trTrainInput,
        // trainView, comp-selector...), que no tienen nada que ver con
        // Interventor. Solo se actualiza la cabecera de Interventor.
        if(ok){
          var hdrT = document.getElementById('interventorHdrTitulo');
          if(hdrT) hdrT.textContent = BASES.global.label || 'Portal de Interventor';
        }
        _cargaMesTrenPromise2 = null;
      }).catch(function(){ _cargaMesTrenPromise2 = null; });
    }
  });

  const trainView2 = document.getElementById('trainView2');

  // NUEVO — Confirmado por el usuario: se puede pintar en OTRO
  // contenedor (para "Por hora de salida"), igual que ya hace
  // renderTrain() en la pantalla de Tripulante — si no se indica
  // ninguno, sigue pintando en 'trainView2' igual que hasta ahora.
  function renderTrain2(trainNum, day, matches, interventorMatches, concrecionMatches, targetEl2){
    interventorMatches = interventorMatches || [];
    concrecionMatches = concrecionMatches || [];
    targetEl2 = targetEl2 || trainView2;
    const _render = ()=>{
      const wd = weekdayForDay(day);
      const total = matches.length + interventorMatches.length + concrecionMatches.length;
      if(total===0){
        targetEl2.innerHTML = `<div class="train-scene">
          <div class="train-meta">Tren <b>${trainNum}</b> · ${wd} ${day} · base <b>${activeBase.label}</b></div>
          <div class="train-empty">Nadie de <b>${activeBase.label}</b> ni ningún interventor cargado hace el tren <b>${trainNum}</b> ese día.</div>
        </div>`;
        return;
      }
      let filas = '';
      interventorMatches.forEach((m)=>{
        filas += `<div class="pcard" style="border-color:var(--nar);background:rgba(249,115,22,.08)">
          <div class="pcard-av" style="background:rgba(249,115,22,.18);color:var(--nar2)">🎫</div>
          <div class="pcard-info">
            <div class="pcard-name">${ofuscarNombreInterventor(m.name)}</div>
            <div class="pcard-id" style="color:var(--nar2);font-weight:700">INTERVENTOR · ${m.servicio}</div>
          </div>
        </div>`;
      });
      concrecionMatches.forEach((m)=>{
        const etiqueta = m.tipo === 'JORNADA_REDUCIDA' ? 'JORNADA REDUCIDA' : 'CONCRECIÓN HORARIA';
        filas += `<div class="pcard" style="border-color:#a855f7;background:rgba(168,85,247,.08)">
          <div class="pcard-av" style="background:rgba(168,85,247,.18);color:#c084fc">⚠️</div>
          <div class="pcard-info">
            <div class="pcard-name">${ofuscarNombreInterventor(m.name)}</div>
            <div class="pcard-id" style="color:#c084fc;font-weight:700">AVISO · ${etiqueta} · ${m.servicio}</div>
          </div>
        </div>`;
      });
      matches.forEach((m)=>{
        // FIX — antes mostraba activeBase.label entero (que para
        // interventor/admin es "Todas las sedes", perdiendo qué sede
        // es CADA persona). Ahora usa la sede real de esa persona
        // (guardada en m.entry[3] al fusionar las sedes); si por lo
        // que sea no está disponible, no se muestra nada de sede en
        // vez de filtrar la etiqueta de toda la base.
        var sedeRealM = (m.entry && m.entry[3]) ? m.entry[3] : '';
        var digitsBuscadoM = String(trainNum).replace(/^0+(?=\d)/,'');
        var textoTrenM2 = (typeof trainTokensDetalle==='function') ? (trainTokensDetalle(m.cell).get(digitsBuscadoM) || trainNum) : trainNum;
        var horaCIm2 = (m.entry && m.entry[9]) ? m.entry[9][String(day)] : null;
        var horaCOm2 = (m.entry && m.entry[10]) ? m.entry[10][String(day)] : null;
        filas += `<div class="pcard" style="flex-direction:column;align-items:stretch">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="pcard-av">${initials(m.name)}</div>
            <div class="pcard-info">
              <div class="pcard-name">${m.name}</div>
              <div class="pcard-id">TRIPULACIÓN${sedeRealM ? ' · '+sedeRealM : ''}${_chipUmDhTexto(textoTrenM2, m.cell)}</div>
            </div>
          </div>
          ${trenIdaVueltaBadgeHTML(m.cell, trainNum)}
          ${_progresoHorarioHTML(horaCIm2, horaCOm2, day)}
        </div>`;
      });
      const partes = [];
      if(interventorMatches.length) partes.push(`${interventorMatches.length} interventor(es)`);
      if(concrecionMatches.length) partes.push(`${concrecionMatches.length} aviso(s)`);
      if(matches.length) partes.push(`${matches.length} de <b>${activeBase.label}</b>`);
      targetEl2.innerHTML = `<div class="train-scene">
        <div class="train-meta">Tren <b>${trainNum}</b> · ${wd} ${day} · ${partes.join(' + ')}</div>
        <div class="comp-list">${filas}</div>
      </div>`;
    };
    mostrarConAnimacionTren(targetEl2, _render);
  }

  // NUEVO — Confirmado por el usuario: "Por hora de salida" también
  // para Interventor — misma forma visual y mismo comportamiento que
  // la versión de Tripulante (calendario → lista ordenada → acordeón
  // por tren), reutilizando renderTrain2 ya parametrizado arriba.
  // Como activeBase para Interventor ya trae TODAS las bases
  // fusionadas (nada que cambiar ahí), la única diferencia real es
  // que cada tarjeta de tren muestra un aviso "TODAS LAS BASES" y
  // cada compañero encontrado ya indica su sede (eso ya lo hacía
  // renderTrain2 de antes, sin tocarlo).
  async function renderListaTrenesPorHora2(day){
    var panel = document.getElementById('trListaHoraPanel2');
    if(!panel) return;
    if(!activeBase){ panel.innerHTML=''; return; }
    panel.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Buscando trenes...</div>';
    var trenHora = {};
    activeBase.data.forEach(function(entry){
      var cell = entry[2] && entry[2][String(day)];
      if(!cell) return;
      var cls = classifyCell(cell);
      if(cls.off) return;
      var detalle = (typeof trainTokensDetalle==='function') ? trainTokensDetalle(cell) : null;
      if(!detalle || !detalle.size) return;
      var primero = detalle.entries().next().value;
      if(!primero) return;
      var digits = primero[0];
      var horasCI = entry[9] || {};
      var hora = horasCI[String(day)];
      var min = _horaToMinTren(hora);
      if(min===null) return;
      if(!trenHora[digits] || min < trenHora[digits].min){
        trenHora[digits] = {min:min, hora:hora, digits:digits};
      }
    });
    var lista = Object.keys(trenHora).map(function(d){ return trenHora[d]; });
    lista.sort(function(a,b){ return a.min-b.min; });
    if(!lista.length){
      panel.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">No se encontró ninguna hora de toma para ese día — puede que el PDF no traiga CI/CO ahí.</div>';
      return;
    }
    var html = '<div class="cs-box"><div class="cs-t">Trenes del día '+day+', por hora aproximada de toma <span style="display:inline-block;font-size:8.5px;font-weight:800;background:rgba(167,139,250,.18);color:#C4B5FD;padding:2px 6px;border-radius:5px;margin-left:5px;vertical-align:middle">TODAS LAS BASES</span></div>';
    lista.forEach(function(item){
      // NUEVO — mismo patrón que en Tripulante: cada tren tiene su
      // propio hueco de resultado (id con sufijo "I" para no chocar
      // con los ids de la lista de Tripulante, que usan los mismos
      // números de tren).
      html += '<div>'
        + '<div class="pcard" id="trCardI_'+item.digits+'" style="cursor:pointer" onclick="_trGoDesdeListaHora2(\''+item.digits+'\')">'
        + '<div class="pcard-av" style="background:rgba(167,139,250,.18);color:#C4B5FD">🕐</div>'
        + '<div class="pcard-info"><div class="pcard-name">Tren '+item.digits+'</div><div class="pcard-id">Toma sobre las '+item.hora+'</div></div>'
        + '<div class="pcard-arr" id="trArrI_'+item.digits+'">›</div></div>'
        + '<div id="trResI_'+item.digits+'" style="display:none;margin:-6px 0 12px"></div>'
        + '</div>';
    });
    html += '</div>';
    panel.innerHTML = html;
  }
  function _trGoDesdeListaHora2(trenTexto){
    var digits = String(trenTexto).replace(/\D/g,'').replace(/^0+(?=\d)/,'');
    var targetEl = document.getElementById('trResI_'+digits);
    var flecha = document.getElementById('trArrI_'+digits);
    if(!targetEl) return;
    var abierto = targetEl.style.display !== 'none';
    if(abierto){
      targetEl.style.display = 'none';
      if(flecha) flecha.textContent = '›';
      return;
    }
    targetEl.style.display = 'block';
    if(flecha) flecha.textContent = '⌄';
    if(targetEl.dataset.cargado === '1') return;
    targetEl.dataset.cargado = '1';
    try{
      if(!activeBase){
        targetEl.innerHTML = '<div style="padding:14px;color:var(--nar3);font-size:12px">⚠️ activeBase no está cargado todavía.</div>';
        return;
      }
      if(!selectedTrainDay2){
        targetEl.innerHTML = '<div style="padding:14px;color:var(--nar3);font-size:12px">⚠️ No hay ningún día seleccionado.</div>';
        return;
      }
      var matches = [];
      for(var i=0;i<activeBase.data.length;i++){
        var entryTren = activeBase.data[i];
        var id = entryTren[0], name = entryTren[1], days = entryTren[2];
        var cell = days[String(selectedTrainDay2)];
        if(cell && cellContainsTrain(cell, digits)) matches.push({id:id, name:name, cell:cell, entry:entryTren});
      }
      var interventorMatches = (typeof buscarInterventor==='function') ? buscarInterventor(digits, fecha_seleccionada_busqueda2) : [];
      var concrecionMatches = (typeof buscarInterventorConcrecion==='function') ? buscarInterventorConcrecion(digits, fecha_seleccionada_busqueda2) : [];
      renderTrain2(digits, selectedTrainDay2, matches, interventorMatches, concrecionMatches, targetEl);
    }catch(err){
      console.error('_trGoDesdeListaHora2:', err);
      targetEl.innerHTML = '<div style="padding:14px;color:var(--nar3);font-size:12px">⚠️ Error: '+(err && err.message ? err.message : err)+'</div>';
    }
  }
  window._trGoDesdeListaHora2 = _trGoDesdeListaHora2;
  function _mostrarListaHoraTrasDia2(fecha){
    var wrap = document.getElementById('calTrenPanelHora2Wrap');
    var resumen = document.getElementById('diaElegidoHora2Resumen');
    var texto = document.getElementById('diaElegidoHora2Texto');
    if(wrap) wrap.style.display = 'none';
    if(resumen) resumen.style.display = 'flex';
    if(texto) texto.textContent = weekdayForDay(fecha.getDate())+' '+fecha.getDate()+' de '+MESES_CAL_TREN[fecha.getMonth()].toLowerCase();
    renderListaTrenesPorHora2(fecha.getDate());
  }
  function _cambiarDiaHora2(){
    var wrap = document.getElementById('calTrenPanelHora2Wrap');
    var resumen = document.getElementById('diaElegidoHora2Resumen');
    if(wrap) wrap.style.display = '';
    if(resumen) resumen.style.display = 'none';
    var panel = document.getElementById('trListaHoraPanel2');
    if(panel) panel.innerHTML = '';
  }
  window._cambiarDiaHora2 = _cambiarDiaHora2;
  generarCalendarioUI('calTrenPanelHora2', function(fecha){
    selectedTrainDay2 = fecha.getDate();
    fecha_seleccionada_busqueda2 = fecha;
    var mesFechaHora2 = { anio: fecha.getFullYear(), mes: fecha.getMonth()+1 };
    var yaCargadoHora2 = BASES.global && BASES.global.mesAnio
      && BASES.global.mesAnio.anio===mesFechaHora2.anio && BASES.global.mesAnio.mes===mesFechaHora2.mes;
    if(yaCargadoHora2){
      _mostrarListaHoraTrasDia2(fecha);
      return;
    }
    var panelCarga2 = document.getElementById('trListaHoraPanel2');
    if(panelCarga2) panelCarga2.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">Cargando el mes...</div>';
    cargarHorarioGlobalDesdeAdmin(mesFechaHora2).then(function(ok){
      if(!ok){
        if(panelCarga2) panelCarga2.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">⚠️ No hay Horario General publicado para '+MESES_CAL_TREN[mesFechaHora2.mes-1]+' '+mesFechaHora2.anio+' todavía.</div>';
        return;
      }
      _mostrarListaHoraTrasDia2(fecha);
    }).catch(function(){
      if(panelCarga2) panelCarga2.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3);font-size:12px">No se pudo cargar ese mes.</div>';
    });
  });
  // NUEVO — Confirmado por el usuario: menú con las dos formas de
  // buscar (mismo estilo de tarjeta que ya usa Tripulante, en los
  // colores morados propios de esta pantalla) — antes iba directo al
  // buscador por número, sin dar a elegir.
  function mostrarInterventorMenu(){
    var m = document.getElementById('interventorMenu');
    var tren = document.getElementById('interventorDetalleTren');
    var hora = document.getElementById('interventorDetalleHora');
    if(m) m.style.display = '';
    if(tren) tren.style.display = 'none';
    if(hora) hora.style.display = 'none';
  }
  function mostrarInterventorDetalle(tipo){
    var m = document.getElementById('interventorMenu');
    var tren = document.getElementById('interventorDetalleTren');
    var hora = document.getElementById('interventorDetalleHora');
    if(m) m.style.display = 'none';
    if(tren) tren.style.display = tipo==='tren' ? '' : 'none';
    if(hora) hora.style.display = tipo==='hora' ? '' : 'none';
  }
  window.mostrarInterventorMenu = mostrarInterventorMenu;
  window.mostrarInterventorDetalle = mostrarInterventorDetalle;

  document.getElementById('trGoBtn2').addEventListener('click', async ()=>{
    if(!activeBase){ return; }
    const raw = document.getElementById('trTrainInput2').value.trim().replace(/^0+/, '');
    if(!selectedTrainDay2){
      trainView2.innerHTML = `<div class="train-scene"><div class="train-empty">Selecciona primero un <b>día</b>.</div></div>`;
      return;
    }
    if(!raw){
      trainView2.innerHTML = `<div class="train-scene"><div class="train-empty">Escribe un <b>número de tren</b>.</div></div>`;
      return;
    }
    const btn = document.getElementById('trGoBtn2');
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    // NUEVO — Confirmado por Alex: mismo arreglo que en Compañeros —
    // esperar a la recarga del mes (si la hay) antes de buscar.
    if(_cargaMesTrenPromise2){
      btn.textContent = 'Cargando el mes...';
      await _cargaMesTrenPromise2;
    }
    btn.textContent = 'Buscando...';
    try{
      const matches = [];
      for(const entryTren2 of activeBase.data){
        const [id, name, days] = entryTren2;
        const cell = days[String(selectedTrainDay2)];
        if(cell && cellContainsTrain(cell, raw)) matches.push({id, name, cell, entry: entryTren2});
      }
      const interventorMatches = buscarInterventor(raw, fecha_seleccionada_busqueda2);
      const concrecionMatches = buscarInterventorConcrecion(raw, fecha_seleccionada_busqueda2);
      renderTrain2(raw, selectedTrainDay2, matches, interventorMatches, concrecionMatches);
      await new Promise(resolve => setTimeout(resolve, 380));
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
})();


})();
