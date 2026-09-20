/* TrenTurnos v5 — Borrado múltiple y módulo de Baja médica
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function _iniciarSeleccionBorrado(k, celdaEl){
  if(_modoSeleccionBorrado) return;
  _modoSeleccionBorrado = true;
  _diasSeleccionadosBorrar = {};
  document.getElementById('days').classList.add('modo-seleccion-borrado');
  _toggleSeleccionBorrado(k, celdaEl);
  if(navigator.vibrate) navigator.vibrate(30); // vibración corta de confirmación, si el dispositivo la soporta
}

function _toggleSeleccionBorrado(k, celdaEl){
  // FIX — Confirmado por Alex: el marcado no se veía al instante en
  // móvil (solo aparecía al recargar/mover el calendario). Dos causas
  // probables: 1) el elemento recibido podía estar obsoleto si el
  // calendario se había vuelto a pintar entre medias — se vuelve a
  // buscar la celda VIVA por su data-k, por si acaso; 2) el estilo
  // ":active" nativo del navegador durante la pulsación ganaba por
  // especificidad CSS — ahora también se aplica el estilo DIRECTO al
  // elemento (no solo la clase), que nada puede pisar por encima.
  var celdaViva = document.querySelector('[data-k="'+k+'"]') || celdaEl;
  if(_diasSeleccionadosBorrar[k]){
    delete _diasSeleccionadosBorrar[k];
    if(celdaViva){
      celdaViva.classList.remove('dc-marcado-borrar');
      celdaViva.style.outline=''; celdaViva.style.background='';
    }
  } else {
    _diasSeleccionadosBorrar[k] = true;
    if(celdaViva){
      celdaViva.classList.add('dc-marcado-borrar');
      celdaViva.style.outline='2.5px solid #F97316';
      celdaViva.style.background='rgba(249,115,22,.14)';
      celdaViva.offsetHeight; // fuerza a que el navegador pinte YA, sin esperar al siguiente frame
    }
  }
  var n = Object.keys(_diasSeleccionadosBorrar).length;
  document.getElementById('bbm-contador').textContent = n;
  document.getElementById('barra-borrado-masivo').classList.toggle('on', n>0);
}

function _cancelarSeleccionBorrado(){
  _modoSeleccionBorrado = false;
  _diasSeleccionadosBorrar = {};
  var grid = document.getElementById('days');
  if(grid){
    grid.classList.remove('modo-seleccion-borrado');
    Array.prototype.slice.call(grid.querySelectorAll('.dc-marcado-borrar')).forEach(function(el){
      el.classList.remove('dc-marcado-borrar');
      el.style.outline=''; el.style.background=''; // limpia también el estilo directo, ver _toggleSeleccionBorrado()
    });
  }
  document.getElementById('barra-borrado-masivo').classList.remove('on');
}

// Limpieza de UN día para el borrado masivo — mismos pasos que ya
// hace confirmarEliminar() para un solo día (contadores de Art.51/52,
// días de compensación propios y de Mix, pernocta de 2/3 días,
// turnos extra en TV2), pero SIN tocar selDay ni la UI (overlays,
// toasts, renderCal) — eso se hace UNA sola vez al final del lote,
// no en cada iteración.
function _eliminarDiaParaBorradoMasivo(k){
  var t = TV[k];
  if(!t) return;
  if(t.tipo==='art5152' && (t.compensacion==='dinero' || t.compensacion==='dias')){
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
  if(t.diasComp && t.diasComp.length){
    t.diasComp.forEach(function(iso){ if(TV[iso] && TV[iso].origen===k) delete TV[iso]; });
  }
  if(t.mixDias && t.mixDias.diasComp && t.mixDias.diasComp.length){
    t.mixDias.diasComp.forEach(function(iso){ if(TV[iso] && TV[iso].origen===k) delete TV[iso]; });
  }
  if(t.diaSiguiente && TV[t.diaSiguiente] && TV[t.diaSiguiente].origenPernocta===k){
    delete TV[t.diaSiguiente];
  }
  if(t.diaIntermedio && TV[t.diaIntermedio] && TV[t.diaIntermedio].origenPernocta===k){
    delete TV[t.diaIntermedio];
  }
  delete TV[k];
  if(TV2[k]) delete TV2[k];
}

function _confirmarEliminarSeleccionMasiva(){
  var dias = Object.keys(_diasSeleccionadosBorrar);
  if(!dias.length) return;
  var etiquetas = dias.slice().sort().map(function(k){ return parseInt(k.split('-')[2],10); }).join(', ');
  if(!confirm('¿Eliminar '+dias.length+' día(s) del calendario (día '+etiquetas+')?\n\nEsta acción no se puede deshacer.')) return;
  dias.forEach(function(k){ _eliminarDiaParaBorradoMasivo(k); });
  saveTV(); saveTV2();
  _cancelarSeleccionBorrado();
  if(selDay && dias.indexOf(selDay.k)!==-1){
    clearSelDay();
    document.getElementById('dia-area').innerHTML='';
  }
  renderCal(); renderStats();
  toast('🗑 '+dias.length+' día(s) eliminados');
}

function pedirBorrarTodo(){openOv('ov-borrar');}

/* ═══════════════════════════════════════════════════════════
   NUEVO — MÓDULO "BAJA MÉDICA" (100% aditivo)
   No toca TAS, ni cálculos de turnos ordinarios, ni alertas de
   Art.51/52. Cada día de baja se guarda con la MISMA estructura
   simple que ya usaba 'baja' antes: {tipo:'baja', simple:true} —
   solo que ahora se repite automáticamente para varios días
   consecutivos, en vez de uno solo.
═══════════════════════════════════════════════════════════ */

// NUEVO — Convertir un turno ya existente (visto desde el historial)
// en Baja Laboral. Reutiliza EXACTAMENTE la misma secuencia que la
// baja registrada desde cero (abrirModalDiasBaja → confirmarDiasBaja,
// que ya preserva el turno pisado en turnoPisado → pregunta primera
// baja del año → correo) — cero lógica nueva de guardado.
// NUEVO — Deshace convertirTurnoEnBaja(): recupera el turno guardado
// en turnoPisado y lo restaura como el turno activo de ese día,
// quitando el estado de 'baja'. Solo disponible si de verdad había un
// turno pisado (si la baja se puso sobre un día vacío, no hay nada que
// recuperar y el botón ni siquiera se muestra).
function quitarBajaLaboral(k){
  var t = TV[k];
  if(!t || t.tipo!=='baja' || !t.turnoPisado) return;
  if(!confirm('¿Quitar la baja laboral de este día y recuperar el turno que tenía antes?')) return;
  TV[k] = t.turnoPisado;
  saveTV();
  // FIX — selDay.t es una COPIA en memoria del turno que usa el popup
  // del día (renderDiaArea, editarTurno...) para pintar y editar. Se
  // actualizaba TV[k] pero no esta copia, así que tras quitar la baja
  // el popup seguía "viendo" la baja vieja y Editar no dejaba tocar
  // nada. Se refresca aquí, solo si el popup abierto es el de este
  // mismo día.
  if(selDay && selDay.k===k) selDay.t = TV[k];
  if(typeof verificarDescansosMes==='function') ALERTAS_DESCANSO = verificarDescansosMes();
  renderCal();
  renderStats();
  if(typeof renderDiaArea==='function') renderDiaArea();
  toast('✅ Turno restaurado, baja laboral quitada');
}

function convertirTurnoEnBaja(k){
  if(!selDay || selDay.k!==k) return;
  abrirModalDiasBaja();
}

function abrirModalDiasBaja(){
  if(!selDay) return;
  var txt = document.getElementById('dias-baja-txt');
  if(txt) txt.textContent = '¿Cuántos días dura la baja? Se marcarán a partir del '+_keyAFechaLbl(selDay.k)+'.';
  var input = document.getElementById('dias-baja-input');
  if(input) input.value = 1;
  openOv('ov-dias-baja');
}

function confirmarDiasBaja(){
  if(!selDay) { closeOv('ov-dias-baja'); return; }
  var kInicio = selDay.k;
  var dias = parseInt((document.getElementById('dias-baja-input')||{}).value) || 1;
  if(dias < 1) dias = 1;
  if(dias > 365) dias = 365;

  var fechas = [];
  var p = kInicio.split('-').map(Number);
  var dt = new Date(p[0], p[1]-1, p[2]);
  for(var i=0; i<dias; i++){
    var kDia = key(dt.getFullYear(), dt.getMonth()+1, dt.getDate());
    // NUEVO — Superposición inteligente: si el día ya tenía un turno
    // asignado (ordinario, trabajado, art5152, etc.), se GUARDA una
    // copia en turnoPisado antes de marcar el día como baja, en vez
    // de destruirlo. El día pasa a computar como 'baja' (igual que
    // antes: 'baja' no participa en calcularJornadaDiaria(), así que
    // sus horas dejan de contar automáticamente, sin tocar esa
    // función), pero el turno original queda recuperable para mostrar
    // "turno pisado por baja" y para el desglose del TAS.
    var turnoPrevio = TV[kDia] || null;
    TV[kDia] = {
      tipo:'baja',
      simple:true,
      turnoPisado: (turnoPrevio && turnoPrevio.tipo!=='baja') ? turnoPrevio : null,
      // NUEVO — posición (1-based) de este día dentro de la baja
      // consecutiva, necesaria para aplicar la regla: primeros 3 días
      // sin retribución si no es la primera baja del año, y 75% a
      // partir del 4º día.
      diaIndiceBaja: i+1
    };
    fechas.push(kDia);
    dt.setDate(dt.getDate()+1);
  }
  saveTV();
  if(typeof verificarDescansosMes==='function') ALERTAS_DESCANSO = verificarDescansosMes();

  closeOv('ov-dias-baja');
  clearSelDay();
  renderCal();
  renderStats();

  // NUEVO — antes de abrir el correo, se pregunta si es la primera
  // baja del año (impacto económico distinto según la respuesta).
  abrirModalPrimeraBajaAnio(fechas);
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — Pregunta "¿Es la primera baja del año?" y aplicación de
   la regla de descuento. 100% aditivo: solo añade el campo
   primeraBajaAnio a los días ya guardados como 'baja' — no toca
   calcularJornadaDiaria(), calculateEarnings() ni ningún cálculo.
═══════════════════════════════════════════════════════════ */
function abrirModalPrimeraBajaAnio(fechas){
  window._bajaFechasActuales = fechas;
  var overlay = document.createElement('div');
  overlay.id = 'primera-baja-overlay';
  overlay.className = 'correo-modal-overlay';
  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  overlay.innerHTML =
    '<div class="correo-modal-box" onclick="event.stopPropagation()">'
      +'<div class="correo-modal-hdr">'
        +'<span class="correo-modal-ico">🏥</span>'
        +'<div><div class="correo-modal-title">¿Es la primera baja del año?</div></div>'
      +'</div>'
      +'<div style="font-size:12px;color:var(--tx2);line-height:1.5">'
      +'Según normativa, los primeros días de baja suelen ir a cargo de la empresa. '
      +'Si NO es la primera baja del año, se aplicará el descuento de horas correspondiente '
      +'sobre los turnos que esta baja sustituye, y se reflejará en el Desglose Económico.</div>'
      +'<div class="correo-modal-btns">'
        +'<button class="correo-modal-btn correo-modal-btn-cancel" onclick="responderPrimeraBajaAnio(false)">No</button>'
        +'<button class="correo-modal-btn correo-modal-btn-send" onclick="responderPrimeraBajaAnio(true)">Sí</button>'
      +'</div>'
    +'</div>';
  document.body.appendChild(overlay);
}

function responderPrimeraBajaAnio(esPrimera){
  var overlay = document.getElementById('primera-baja-overlay');
  if(overlay) overlay.remove();

  var fechas = window._bajaFechasActuales || [];
  fechas.forEach(function(k){
    if(TV[k] && TV[k].tipo==='baja'){
      TV[k].primeraBajaAnio = esPrimera;
    }
  });
  saveTV();
  renderCal();
  renderStats();

  toast(esPrimera
    ? '🏥 Primera baja del año — a cargo de la empresa, sin descuento de horas'
    : '🏥 Se aplicará el descuento de horas correspondiente en el Desglose Económico');

  abrirModalCorreoBaja(fechas);
}

function abrirModalCorreoBaja(fechas){
  var body = document.getElementById('correo-baja-body');
  if(!body || !fechas || !fechas.length) return;

  // Nombre y matrícula EXTRAÍDOS OBLIGATORIAMENTE de Ajustes.
  var nombre = AJ.nombre || 'Nombre no configurado en Ajustes';
  var matricula = AJ.matricula || 'Matrícula no configurada en Ajustes';
  var dias = fechas.length;
  var fechaIni = _keyAFechaLbl(fechas[0]);
  var fechaFin = _keyAFechaLbl(fechas[fechas.length-1]);
  var rango = dias>1 ? (fechaIni+' a '+fechaFin) : fechaIni;
  var plural = dias>1 ? 's' : '';

  // NUEVO — saludo dinámico según la hora del momento de envío,
  // reutilizando _saludoPorHora() (la misma función ya usada en el
  // correo de Enlace de Jornada y en el de Mix Art.51/52).
  var saludo = (typeof _saludoPorHora==='function') ? _saludoPorHora().toLowerCase() : 'buenos días';

  var asunto = 'Parte de Baja Medica - '+nombre+' - Matricula: '+matricula+' - '+dias+' dia'+plural;
  var cuerpo = 'Hola, '+saludo+'.\n\n'
    +'Por motivos de salud, se me ha concedido una baja laboral por un periodo de '
    +dias+' dia'+plural+' ('+rango+').\n\n'
    +'Nombre: '+nombre+'\n'
    +'Matricula: '+matricula+'\n\n'
    +'Adjunto el parte medico justificativo.\n\n'
    +'Atentamente,\n'+nombre+'\n\n'
    +'Solicitud generada automaticamente por TrenTurno V5';

  // SIMPLIFICADO — se quita el selector de cámara/galería (no lograba
  // adjuntar la imagen de verdad y complicaba el flujo sin necesidad).
  // Ahora solo se informa con un aviso claro de que hay que subir la
  // foto del justificante manualmente en el propio correo.
  body.innerHTML =
    '<div class="aj-nombre-wrap" style="margin-bottom:10px"><span class="aj-nombre-ico">📧</span>'
      +'<input id="baja-correo-destinatario" class="aj-nombre-inp" placeholder="Destinatario" value="programacion.sab@serveo.com"></div>'
    +'<div style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--tx3);margin-bottom:6px">MENSAJE (editable)</div>'
    +'<textarea id="baja-correo-textarea" class="correo-modal-textarea" style="min-height:210px"></textarea>'
    +'<div style="font-size:10px;color:var(--amber2);background:rgba(245,158,11,.1);'
      +'border:1px solid rgba(245,158,11,.3);border-radius:9px;padding:9px 11px;margin-top:10px;line-height:1.5">'
      +'⚠️ Recuerda <strong>subir la foto del justificante médico directamente en tu correo</strong> '
      +'(como archivo adjunto) antes de darle a enviar. Esta app no puede adjuntarla automáticamente.</div>'
    +'<button onclick="enviarCorreoBaja()" style="width:100%;margin-top:14px;padding:13px;'
      +'background:linear-gradient(135deg,var(--acc),var(--acc2));border:none;border-radius:12px;'
      +'color:#fff;font-size:14px;font-weight:800;cursor:pointer">✉️ Abrir en Correo</button>';

  // Texto limpio: se pasa por sanitizarTexto() (la misma función ya
  // usada en el correo de Enlace de Jornada y Mix Art.51/52) antes de
  // mostrarse, para eliminar acentos y cualquier caracter que pueda
  // llegar roto al cliente de correo. Luego, al enviar, se codifica
  // con encodeURIComponent() — así espacios, comas, puntos y saltos
  // de línea se traducen limpio.
  document.getElementById('baja-correo-textarea').value =
    (typeof sanitizarTexto==='function') ? sanitizarTexto(cuerpo) : cuerpo;
  window._bajaAsuntoActual = (typeof sanitizarTexto==='function') ? sanitizarTexto(asunto) : asunto;

  openOv('ov-correo-baja');
}

function enviarCorreoBaja(){
  var dest = (document.getElementById('baja-correo-destinatario')||{}).value.trim() || 'programacion.sab@serveo.com';
  var cuerpoRaw = (document.getElementById('baja-correo-textarea')||{}).value || '';
  var cuerpo = (typeof sanitizarTexto==='function') ? sanitizarTexto(cuerpoRaw) : cuerpoRaw;
  var asunto = window._bajaAsuntoActual || 'Parte de Baja Medica';

  // SIMPLIFICADO — ya no hay selector de archivo en este modal; el
  // aviso de subir el justificante ya se muestra de forma fija en el
  // propio modal (ver abrirModalCorreoBaja). Aun así, se recuerda una
  // última vez justo antes de abrir el correo.
  toast('📎 Recuerda subir la foto del justificante en tu correo antes de enviar');

  // FIX — destinatario SIN codificar (igual que el resto de correos
  // de la app): codificar la dirección de email convierte la @ en
  // %40 y provoca símbolos extraños. Solo asunto y cuerpo (los
  // parámetros de la URL) se codifican con encodeURIComponent().
  var url = 'mailto:'+dest+'?subject='+encodeURIComponent(asunto)+'&body='+encodeURIComponent(cuerpo);
  window.location.href = url;
  closeOv('ov-correo-baja');
  }
function confirmarBorrarTodo(){
  TV={};localStorage.removeItem('tv5');selDay=null;
  // NUEVO — FIX: TV2 (turnos extra del mismo día) vive en su propia
  // clave de localStorage ('tv2_extra') y antes sobrevivía al borrado
  // general — dejando turnos "fantasma" (badge +N y contenido) en el
  // calendario aunque TV ya estuviera vacío.
  if(typeof TV2!=='undefined'){ TV2={}; }
  localStorage.removeItem('tv2_extra');
  // NUEVO — FIX: los contadores propios de Art.51/52 (bolsa de días
  // de compensación pendientes y uso mensual) también viven en claves
  // propias y quedaban desincronizados tras un borrado total.
  if(typeof ART5152_DIAS!=='undefined'){ ART5152_DIAS={}; }
  if(typeof ART5152_USO!=='undefined'){ ART5152_USO={}; }
  if(typeof ART5152_USO_ANUAL!=='undefined'){ ART5152_USO_ANUAL={}; }
  localStorage.removeItem('art5152_dias');
  localStorage.removeItem('art5152_uso');
  localStorage.removeItem('art5152_uso_anual');
  closeOv('ov-borrar');renderCal();renderStats();
  document.getElementById('dia-area').innerHTML='';
  toast('🗑 Todos los turnos eliminados');
}
