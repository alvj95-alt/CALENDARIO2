/* TrenTurnos v5 — Servicios frecuentes, Estaciones y Horarios, autocompletado de tren
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════
   SERVICIOS FRECUENTES — Smart Fill
   ModeloServicio: {
     numTren, linea, sal, lle, hF, hL,
     sal2, lle2, hF2, hL2,
     usos, ultimoUso
   }
   Persistencia: localStorage 'sf5'
═══════════════════════════════════════ */
// SF, AGENDA, ALERTAS_DESCANSO → declarados en bloque ESTADO GLOBAL (ver arriba)
function saveSF(){ localStorage.setItem('sf5', JSON.stringify(SF)); }

/* ═══════════════════════════════════════════════════════════
   NUEVO — "Estaciones y Horarios" (Ajustes). Gestión de los trenes
   guardados en SF. 100% aditivo: reutiliza SF/saveSF() ya
   existentes (misma fuente que usa autocompletarTramo()), sin tocar
   su lógica de búsqueda ni de guardado automático.
═══════════════════════════════════════════════════════════ */
function renderTablaEstacionesHorarios(){
  var cont = document.getElementById('tabla-estaciones-horarios');
  if(!cont) return;
  if(!SF.length){
    cont.innerHTML = '<div style="font-size:11px;color:var(--tx3);text-align:center;padding:14px 0">Aún no hay trenes guardados</div>';
    return;
  }
  var html = '';
  SF.forEach(function(s, idx){
    html += '<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--div)">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-weight:800;color:var(--acc3);font-size:13px">Tren #'+(s.numTren||'—')+'</div>'
      +'<div style="font-size:10px;color:var(--tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
      +(s.sal||'—')+' → '+(s.lle||'—')+'</div>'
      +'<div style="font-size:9px;color:var(--tx3)">'+(s.hF||'--:--')+' – '+(s.hL||'--:--')+'</div>'
      +'</div>'
      +'<button onclick="abrirEditarTren('+idx+')" style="background:var(--s2);border:1px solid var(--div);'
      +'border-radius:8px;color:var(--acc2);font-size:10px;font-weight:700;padding:6px 11px;cursor:pointer;flex-shrink:0">✏️ Editar</button>'
      +'</div>';
  });
  cont.innerHTML = html;
}

function abrirEditarTren(idx){
  var s = SF[idx];
  if(!s) return;
  var sub = document.getElementById('editar-tren-sub');
  var body = document.getElementById('editar-tren-body');
  if(sub) sub.textContent = 'Tren #'+s.numTren;
  if(!body) return;
  var campo = function(lbl, id, val, tipo){
    return '<div class="fsec-lbl" style="margin-top:8px">'+lbl+'</div>'
      +'<input id="'+id+'" type="'+(tipo||'text')+'" value="'+(val||'')+'" '
      +'style="width:100%;background:var(--s2);border:1.5px solid var(--div);border-radius:9px;'
      +'color:var(--tx);font-size:13px;padding:8px 11px;outline:none">';
  };
  body.innerHTML =
    campo('Número de tren', 'et-numtren', s.numTren)
    + campo('Estación origen', 'et-sal', s.sal)
    + campo('Estación destino', 'et-lle', s.lle)
    + '<div style="display:flex;gap:8px">'
      + '<div style="flex:1">'+campo('Hora salida', 'et-hf', s.hF, 'time')+'</div>'
      + '<div style="flex:1">'+campo('Hora llegada', 'et-hl', s.hL, 'time')+'</div>'
    + '</div>'
    + '<button class="m-save" style="width:100%;margin-top:14px" onclick="guardarEdicionTren('+idx+')">Guardar cambios</button>';
  openOv('ov-editar-tren');
}

function guardarEdicionTren(idx){
  var s = SF[idx];
  if(!s) return;
  var nuevoNumTren = (document.getElementById('et-numtren')||{}).value.trim();
  s.numTren = nuevoNumTren || s.numTren;
  s.sal = (document.getElementById('et-sal')||{}).value.trim();
  s.lle = (document.getElementById('et-lle')||{}).value.trim();
  s.hF  = (document.getElementById('et-hf')||{}).value.trim();
  s.hL  = (document.getElementById('et-hl')||{}).value.trim();
  saveSF(); // misma función de persistencia que ya usa el resto de la app
  closeOv('ov-editar-tren');
  renderTablaEstacionesHorarios();
  // Refresca también las sugerencias del autocompletado, para que
  // reflejen el dato corregido de inmediato.
  if(typeof actualizarDatalistTrenes==='function') actualizarDatalistTrenes();
  toast('✅ Tren actualizado');
}

// NUEVO — autocompleta estación de inicio, estación final y horario
// de un tramo del "Registrar Intercambio" en cuanto se escribe un
// número de tren YA GUARDADO antes (mismo origen de datos — SF — que
// usa el autocompletado del turno normal, sin duplicarlo). Solo
// rellena campos que estén vacíos, nunca pisa lo que el usuario ya
// haya escrito a mano. Recordatorio: este intercambio es solo
// informativo — nunca entra en el cálculo de horas, se rellene como
// se rellene.
function autocompletarTramoIntercambio(idx){
  var trenEl = document.getElementById('reg-interc-tren-'+idx);
  if(!trenEl) return;
  var num = trenEl.value.trim();
  if(!num) return;
  var exacto = null;
  for(var si=0; si<SF.length; si++){
    if(SF[si].numTren === num){ exacto = SF[si]; break; }
  }
  if(!exacto) return; // solo coincidencia EXACTA — nada de resultados parciales aquí
  var estIniEl = document.getElementById('reg-interc-est-ini-'+idx);
  var estFinEl = document.getElementById('reg-interc-est-fin-'+idx);
  var hiniEl   = document.getElementById('reg-interc-hini-'+idx);
  var hfinEl   = document.getElementById('reg-interc-hfin-'+idx);
  if(estIniEl && !estIniEl.value.trim() && exacto.sal) estIniEl.value = exacto.sal;
  if(estFinEl && !estFinEl.value.trim() && exacto.lle) estFinEl.value = exacto.lle;
  if(hiniEl && !hiniEl.value && exacto.hF) hiniEl.value = exacto.hF;
  if(hfinEl && !hfinEl.value && exacto.hL) hfinEl.value = exacto.hL;
}

function guardarServicioFrecuente(datos){
  var numTren  = datos.numTren;
  var linea    = datos.linea;
  var sal      = datos.sal;
  var lle      = datos.lle;
  var hF       = datos.hF;
  var hL       = datos.hL;
  var sal2     = datos.sal2;
  var lle2     = datos.lle2;
  var hF2      = datos.hF2;
  var hL2      = datos.hL2;
  if(!numTren) return;
  var key    = String(numTren);
  var existe = null;
  for(var si=0; si<SF.length; si++){
    if(SF[si].numTren===key){ existe=SF[si]; break; }
  }
  if(existe){
    existe.linea=linea||existe.linea;
    existe.sal  =sal  ||existe.sal;
    existe.lle  =lle  ||existe.lle;
    existe.hF   =hF   ||existe.hF;
    existe.hL   =hL   ||existe.hL;
    existe.sal2 =sal2!==undefined?sal2:existe.sal2;
    existe.lle2 =lle2!==undefined?lle2:existe.lle2;
    existe.hF2  =hF2 !==undefined?hF2 :existe.hF2;
    existe.hL2  =hL2 !==undefined?hL2 :existe.hL2;
    existe.usos      = (existe.usos||0)+1;
    existe.ultimoUso = Date.now();
  } else {
    SF.unshift({
      numTren:key, linea:linea||'',
      sal:sal||'',   lle:lle||'',
      hF:hF||'',     hL:hL||'',
      sal2:sal2||'', lle2:lle2||'',
      hF2:hF2||'',   hL2:hL2||'',
      usos:1, ultimoUso:Date.now()
    });
    if(SF.length>50) SF.splice(50);
  }
  saveSF();
}

/* ═══════════════════════════════════════════════════════════
   AUTOCOMPLETADO DE TREN — función maestra única.
   Sustituye por completo el sistema anterior (TRAMO_CFG,
   obtenerDatosTren, mostrarSugerenciasTren, seleccionarSugerenciaTren,
   _resolverTramoContainer, updateFormFields y sus 3 listeners
   delegados) — todo eliminado. No queda ninguna variable global
   de autocompletado ni ningún ID fijo tipo "tramo1"/"tramo2".

   autocompletarTramo(inputElement):
     1) Lee el número de tren escrito en ESE input.
     2) Lo busca en la base de datos local de trenes (SF).
     3) Si no existe, no hace nada — sin errores, sin rastro.
     4) Si existe, localiza el contenedor del propio input
        (inputElement.closest('.tramo-container')) e inyecta
        estación de salida, estación de llegada y horarios SOLO
        en los campos de ESE contenedor — nunca en otro tramo.

   Se invoca con oninput="autocompletarTramo(this)" directamente
   desde cada input de tren (ida, vuelta, intermedio o cualquier
   tramo de continuidad) — la misma función, sin distinción.
═══════════════════════════════════════════════════════════ */
// NUEVO — Genera las opciones del <datalist> de sugerencias de tren
// (número + estación) a partir de SF, la MISMA fuente de datos que ya
// usa autocompletarTramo() para el autocompletado exacto. No crea
// ningún dato nuevo, solo lee SF (de solo lectura) y pinta opciones.
function actualizarDatalistTrenes(){
  var dl = document.getElementById('trenes-datalist');
  if(!dl || typeof SF==='undefined') return;
  var vistos = {};
  var html = '';
  SF.forEach(function(s){
    if(!s || !s.numTren || vistos[s.numTren]) return;
    vistos[s.numTren] = true;
    var ruta = (s.sal && s.lle) ? (' · '+s.sal+' → '+s.lle) : '';
    html += '<option value="'+s.numTren+'">'+s.numTren+ruta+'</option>';
  });
  dl.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — Desplegable de sugerencias PROPIO (sustituye visualmente
   al <datalist> nativo, que no admite estilos CSS). Lee la MISMA
   fuente de datos (SF) y, al elegir una sugerencia, llama a
   autocompletarTramo() sin modificarla ni un carácter — la lógica de
   búsqueda/relleno sigue siendo exactamente la misma de siempre.
═══════════════════════════════════════════════════════════ */
function mostrarSugerenciasTren(inputElement){
  cerrarSugerenciasTren();
  var valor = inputElement.value.trim();
  if(!valor || typeof SF==='undefined') return;

  var vistos = {};
  var matches = SF.filter(function(s){
    if(!s || !s.numTren || vistos[s.numTren]) return false;
    if(s.numTren.indexOf(valor)!==0) return false; // empieza por lo tecleado
    vistos[s.numTren] = true;
    return true;
  }).slice(0,6);
  if(!matches.length) return;

  var rect = inputElement.getBoundingClientRect();
  var lista = document.createElement('div');
  lista.className = 'tren-suggest-list';
  lista.id = 'tren-suggest-list-activa';
  lista.style.top = (rect.bottom+4)+'px';
  lista.style.left = rect.left+'px';
  lista.style.width = rect.width+'px';
  lista.innerHTML = matches.map(function(s){
    var ruta = (s.sal && s.lle) ? (s.sal+' → '+s.lle) : 'Sin ruta guardada';
    return '<div class="tren-suggest-item" onmousedown="event.preventDefault();seleccionarSugerenciaTren(\''+s.numTren+'\')">'
      +'<span class="tren-suggest-num">'+s.numTren+'</span>'
      +'<span class="tren-suggest-ruta">'+ruta+'</span></div>';
  }).join('');
  document.body.appendChild(lista);
  window._tren_suggest_input = inputElement;
}

function seleccionarSugerenciaTren(numTren){
  var input = window._tren_suggest_input;
  cerrarSugerenciasTren();
  if(!input) return;
  input.value = numTren;
  input.focus();
  // Reutiliza EXACTAMENTE la misma función/lógica de autocompletado
  // ya existente — no se duplica ni se altera.
  autocompletarTramo(input);
}

function cerrarSugerenciasTren(){
  var el = document.getElementById('tren-suggest-list-activa');
  if(el) el.remove();
}

function autocompletarTramo(inputElement){
  var valor = inputElement.value.trim();

  // Sincronizar el número de tren con el modelo de datos (F),
  // exista o no en la base de datos — esto no es autocompletado,
  // es simplemente registrar lo que el usuario ha escrito.
  var cont = inputElement.closest('.tramo-container');
  if(!cont) return;

  // NUEVO — FIX: si el número de tren cambia (o se borra) respecto al
  // que se usó la última vez para autocompletar este mismo tramo, se
  // liberan los campos que ESTE mecanismo rellenó automáticamente
  // (marcados con la clase .auto-filled), para que se puedan volver a
  // rellenar con el tren nuevo. Nunca toca campos que el usuario haya
  // escrito o seleccionado a mano (esos nunca llevan .auto-filled).
  if(inputElement.dataset.lastAutoTren && inputElement.dataset.lastAutoTren !== valor){
    var camposAuto = cont.querySelectorAll('.auto-filled');
    camposAuto.forEach(function(el){
      el.classList.remove('auto-filled');
      el.classList.add('ph');
      if(el.hasAttribute('data-f')){
        el.textContent = 'Seleccionar';
        F[el.dataset.f] = null;
      }
      if(el.hasAttribute('data-hora')){
        el.textContent = '--:--';
        el.classList.remove('hv');
        F[el.dataset.hora] = null;
      }
      var wrap = el.closest('.sf'); if(wrap) wrap.classList.remove('fil');
    });
    inputElement.dataset.lastAutoTren = '';
  }

  if(cont.dataset.tramo === 'continuidad'){
    actualizarTramoContinuidad(cont.dataset.subtramo, parseInt(cont.dataset.idx), 'tren', valor);
  } else if(inputElement.dataset.campoTren){
    F[inputElement.dataset.campoTren] = valor;
  }

  if(!valor) return;
  var registro = SF.filter(function(s){ return s.numTren === valor; })[0];
  if(!registro) return; // no existe: no se hace nada más

  // NUEVO: recuerda con qué tren se autocompletó este tramo por
  // última vez, para poder detectar el cambio la próxima vez.
  inputElement.dataset.lastAutoTren = valor;

  // Estaciones: primer [data-f] del contenedor = salida, segundo = llegada.
  var camposEstacion = cont.querySelectorAll('[data-f]');
  camposEstacion.forEach(function(el, i){
    if(!el.classList.contains('ph')) return; // ya tiene un dato: no se sobrescribe
    var valorCampo = i===0 ? registro.sal : registro.lle;
    if(!valorCampo) return;
    // NUEVO — si la clave es de un tramo de continuidad, se escribe en
    // su propio array; si no, en la propiedad plana de F de siempre.
    var contInfoF = _contKeyParse(el.dataset.f);
    if(contInfoF){
      _contArrFor(contInfoF)[contInfoF.idx][contInfoF.tipo==='Sal'?'salida':'llegada'] = valorCampo;
    } else {
      F[el.dataset.f] = valorCampo;
    }
    el.textContent = valorCampo;
    el.classList.remove('ph');
    el.classList.add('auto-filled'); // NUEVO: marca de campo autocompletado
    var wrap = el.closest('.sf'); if(wrap) wrap.classList.add('fil');
  });

  // Horarios: primer [data-hora] del contenedor = firma, segundo = llegada.
  var camposHora = cont.querySelectorAll('[data-hora]');
  camposHora.forEach(function(el, i){
    if(!el.classList.contains('ph')) return;
    var valorCampo = i===0 ? registro.hF : registro.hL;
    if(!valorCampo) return;
    var contInfoH = _contKeyParse(el.dataset.hora);
    if(contInfoH){
      _contArrFor(contInfoH)[contInfoH.idx][contInfoH.tipo==='HF'?'horaInicio':'horaFin'] = valorCampo;
    } else {
      F[el.dataset.hora] = valorCampo;
    }
    el.textContent = valorCampo;
    el.classList.remove('ph');
    el.classList.add('hv');
    el.classList.add('auto-filled'); // NUEVO: marca de campo autocompletado
    var wrap = el.closest('.sf'); if(wrap) wrap.classList.add('fil');
  });

  // NUEVO — tras autocompletar un tramo de continuidad, se recalcula
  // ya mismo la escala informativa (diferencia entre la llegada del
  // tramo anterior y la salida de este) y se refresca el formulario
  // para que se vea reflejada al instante.
  if(cont.dataset.tramo === 'continuidad'){
    var refTramo = cont.dataset.subtramo === 'vuelta' ? 'vuelta' : 'ida';
    var refArrKey = refTramo==='vuelta' ? 'continuidadVuelta' : 'continuidad';
    var refHoraBase = refTramo==='vuelta' ? (F.hL2||'') : (F.hL||'');
    recalcularContinuidad(refHoraBase, F[refArrKey]||[]);
    renderFormBody();
    return;
  }

  // La línea del servicio solo la define el tramo de ida.
  if(cont.dataset.tramo==='ida' && registro.linea && !F.linea){
    F.linea = registro.linea;
    F.plusIntlAuto = registro.linea.includes('Internacional');
  }
}
