/* TrenTurnos v5 — Solicitud de HTDL, recordatorios y correos
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
async function abrirSolicitudHTDL(){
  // Fix TDZ: acceder a currentMonthKey de forma segura
  var _cmk;
  try { _cmk = currentMonthKey; } catch(e){ _cmk = null; }
  if(!_cmk){
    toast('📋 Primero sube un horario para poder solicitar HTDL');
    return;
  }
  var data = await loadMonth(_cmk);
  if(!data || !data.dias || !data.dias.length){
    toast('No hay días cargados en este horario');
    return;
  }
  // Filtrar SOLO días tipo LIBRE (código 'DO') o RESERVA (disponible)
  var diasLibres = data.dias.filter(function(d){
    return d.tipo === 'LIBRE' || d.tipo === 'RESERVA';
  });
  _htdlDiasSeleccionados = [];

  var cont = document.getElementById('htdl-dias-list');
  if(!diasLibres.length){
    cont.innerHTML = '<div class="today-empty" style="margin:10px 0">No hay días libres o disponibles en '+_cmk+'</div>';
  } else {
    cont.innerHTML = diasLibres.map(function(d, i){
      var etiqueta = d.tipo === 'LIBRE' ? 'DO · Día libre' : 'Disponible';
      var colorTag = d.tipo === 'LIBRE' ? '#4ADE80' : '#67e8f9';
      return '<label style="display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--line);cursor:pointer">'
        + '<input type="checkbox" data-htdl-idx="'+i+'" data-htdl-dia="'+d.n+' '+d.d+'" onchange="toggleHtdlDia(this)" style="width:18px;height:18px;accent-color:#0891B2">'
        + '<span style="font-family:\'Space Mono\',monospace;font-size:13px;color:var(--tx)">'+d.n+' '+d.d+'</span>'
        + '<span style="font-size:11px;color:'+colorTag+';margin-left:auto">'+etiqueta+'</span>'
        + '</label>';
    }).join('');
  }
  openOv('ov-htdl-dias');
}

function toggleHtdlDia(checkbox){
  var dia = checkbox.getAttribute('data-htdl-dia');
  if(checkbox.checked){
    if(_htdlDiasSeleccionados.indexOf(dia) === -1) _htdlDiasSeleccionados.push(dia);
  } else {
    _htdlDiasSeleccionados = _htdlDiasSeleccionados.filter(function(x){ return x !== dia; });
  }
}

// confirmarHTDL — solo genera el correo de solicitud.
// NO guarda nada en el calendario ni en TV.
function confirmarHTDL(e){
  if(e && e.stopPropagation) e.stopPropagation();
  if(!_htdlDiasSeleccionados.length){
    toast('Selecciona al menos un día');
    return;
  }
  var diasTxt = _htdlDiasSeleccionados.join(', ');
  var mn = AJ.nombre||'', mm = AJ.matricula||'';
  var hora = new Date().getHours();
  var sal = hora<13?'Buenos dias':hora<20?'Buenas tardes':'Buenas noches';
  var cuerpo = generarCuerpoCorreo({
    saludo: sal,
    mensaje: 'Envio este correo para informar que los dias '+diasTxt+', estoy a disposicion para realizar HTDL.',
    mostrarTren: false,
    firma: mn,
    matricula: mm
  });
  var asunto = 'Disponibilidad HTDL - '+diasTxt;
  closeOv('ov-htdl-dias');
  // Esperar a que el modal cierre (140ms animación) antes de abrir el correo
  setTimeout(function(){
    handleEmailSubmission(
      'Solicitud de HTDL',
      diasTxt,
      asunto,
      cuerpo,
      function(){}, // sin callback de guardado — no toca el calendario
      false         // sin botón Posponer en Escenario A
    );
  }, 180);
}

/* ═══════════════════════════════════════════════════════════
   SANITIZADOR DE TEXTO — función nueva, completamente aditiva.
   No toca AJ.nombre, AJ.matricula, ni ninguna variable existente.
   Solo limpia una COPIA del texto justo antes de inyectarla en
   el body del mailto:, para máxima compatibilidad con clientes
   de correo que no manejan bien acentos/UTF-8.
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   MÓDULO HTDL CORREOS — completamente aditivo.
   Gestiona el estado de envío de correos HTDL por fecha.
   Clave localStorage: 'htdl_correos' — totalmente aislada
   de tv5/aj5/listaNegraApp/horario:*. Nunca toca TV ni AJ.
   Estados posibles por fecha (YYYY-MM-DD):
     'pendiente'  — días seleccionados, correo aún no enviado
     'pospuesto'  — usuario decidió enviar más tarde
     'enviado'    — correo enviado correctamente
═══════════════════════════════════════════════════════════ */
function _htdlCorreosGet(){
  try{ return JSON.parse(localStorage.getItem('htdl_correos')||'{}'); }
  catch(e){ return {}; }
}
function _htdlCorreosSet(obj){
  try{ localStorage.setItem('htdl_correos', JSON.stringify(obj)); }catch(e){}
}

// Se llama desde init() — verifica si hay un HTDL pospuesto para hoy
// verificarRecordatorios — se ejecuta UNA vez al cargar la app (desde init).
// Busca en htdl_correos entradas con estado 'pendiente' cuya fecha
// coincida con hoy. Al mostrar el aviso, lo marca 'notificado'
// para que no vuelva a aparecer aunque el usuario reabra la app.
// 'enviado' suprime el recordatorio de forma permanente.
function verificarRecordatorios(){
  try{
    var hoy = key(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());
    var correos = _htdlCorreosGet();
    var fechaPendiente = null;
    var keys = Object.keys(correos);
    for(var i=0; i<keys.length; i++){
      var fecha = keys[i];
      var estado = correos[fecha];
      // Solo mostrar si: la fecha es hoy, el estado es 'pendiente' o 'pospuesto',
      // y NO ha sido ya notificado ni enviado
      if(fecha === hoy && (estado === 'pendiente' || estado === 'pospuesto')){
        fechaPendiente = fecha;
        break;
      }
    }
    if(fechaPendiente){
      // Marcar como 'notificado' ANTES de mostrar para evitar loops
      correos[fechaPendiente] = 'notificado';
      _htdlCorreosSet(correos);
      setTimeout(function(){
        mostrarAvisoHTDLPospuesto(fechaPendiente);
      }, 1800);
    }
  }catch(e){}
}

// Alias para compatibilidad con la llamada existente en init()
function checkRecordatorioHTDL(){ verificarRecordatorios(); }

// marcarCorreoHTDLEnviado — llama esto cuando el correo se envía.
// Cambia el estado a 'enviado' — el recordatorio no volverá a aparecer.
function marcarCorreoHTDLEnviado(fecha){
  try{
    var correos = _htdlCorreosGet();
    var k = fecha || key(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());
    correos[k] = 'enviado';
    _htdlCorreosSet(correos);
  }catch(e){}
}

// generarCorreoDesdeDatos — lee TV[k] directamente y construye
// el texto del correo sin abrir ningún formulario.
// Retorna {asunto, cuerpo} listos para handleEmailSubmission.
function generarCorreoDesdeDatos(fechaKey){
  var t = TV[fechaKey] || {};
  var partes = fechaKey.split('-').map(Number);
  var y=partes[0], mo=partes[1], dd=partes[2];
  var fstr = dd+' de '+MESES[mo-1].toLowerCase()+' de '+y;
  var mn = AJ.nombre||'', mm = AJ.matricula||'';
  var hora = new Date().getHours();
  var sal = hora<13?'Buenos dias':hora<20?'Buenas tardes':'Buenas noches';

  // Días compensatorios ya guardados en TV[k].diasComp
  var diasComp = t.diasComp || [];
  var diasTxt = diasComp.map(function(iso){
    var p = iso.split('-').map(Number);
    return p[2]+' de '+MESES[p[1]-1].toLowerCase();
  }).join(' y ');

  // Recorre ida, vuelta y sus tramos de continuidad — nunca solo el
  // primero. El bloque de tren en sí (formato y "Sin tren asignado"
  // si no hubiera ninguno) lo resuelve generarCuerpoCorreo().
  var tramosIda = [t.numTren].concat((t.continuidad||[]).map(function(c){return c.tren;})).filter(Boolean);
  var tramosVuelta = [t.numTrenVuelta].concat((t.continuidadVuelta||[]).map(function(c){return c.tren;})).filter(Boolean);

  var mensaje = 'Por haber realizado el dia '+fstr+' como HTDL, me gustaria solicitar como dias compensatorios'
    +(diasTxt ? ' el '+diasTxt : ' los dias correspondientes')+'.';

  var cuerpo = generarCuerpoCorreo({
    saludo: sal,
    mensaje: mensaje,
    mostrarTren: true,
    tramosIda: tramosIda,
    tramosVuelta: tramosVuelta,
    firma: mn,
    matricula: mm
  });
  var asunto = 'Solicitud compensacion HTDL - '+fstr;
  return {asunto: asunto, cuerpo: cuerpo};
}

function mostrarAvisoHTDLPospuesto(fechaKey){
  var modal = document.createElement('div');
  modal.className = 'ov on';
  modal.style.zIndex = '450';
  // Previsualizar los días comp guardados en el aviso
  var t = TV[fechaKey] || {};
  var diasComp = t.diasComp || [];
  var diasPreview = diasComp.length
    ? diasComp.map(function(iso){ var p=iso.split('-').map(Number); return p[2]+'/'+p[1]; }).join(', ')
    : 'sin días comp. asignados aún';
  modal.innerHTML =
    '<div class="confirm-sh" onclick="event.stopPropagation()">'
    +'<div class="sh-handle"></div>'
    +'<div class="conf-ico">⏰</div>'
    +'<div class="conf-tit">Recordatorio HTDL</div>'
    +'<div class="conf-txt">Correo de compensacion pendiente para:<br>'
    +'<strong>'+fechaKey+'</strong><br>'
    +'<span style="font-size:11px;color:var(--tx3)">Días comp: '+diasPreview+'</span></div>'
    +'<div class="conf-btns">'
    +'<button class="conf-cancel" id="htdl-rec-mas-tarde">Más tarde</button>'
    +'<button class="conf-del" id="htdl-rec-enviar" style="background:linear-gradient(135deg,#0891B2,#0e7490)">✉️ Enviar correo</button>'
    +'</div>'
    +'</div>';
  modal.addEventListener('click', function(){ document.body.removeChild(modal); });
  document.body.appendChild(modal);
  document.getElementById('htdl-rec-mas-tarde').addEventListener('click', function(){
    document.body.removeChild(modal);
  });
  document.getElementById('htdl-rec-enviar').addEventListener('click', function(){
    document.body.removeChild(modal);
    // Leer datos directamente de TV — sin abrir ningún formulario
    var datos = generarCorreoDesdeDatos(fechaKey);
    marcarCorreoHTDLEnviado(fechaKey);
    // Abrir popup de correo con el texto ya redactado
    setTimeout(function(){
      handleEmailSubmission(
        'Compensacion HTDL',
        fechaKey,
        datos.asunto,
        datos.cuerpo,
        function(){},
        false
      );
    }, 150);
  });
}

function sanitizarTexto(texto){
  if(!texto) return '';
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quita acentos (á→a, é→e, í→i, ó→o, ú→u, ñ→n)
    .replace(/[^A-Za-z0-9 \n]/g, '');                   // deja solo letras, números, espacios y saltos de línea
}
