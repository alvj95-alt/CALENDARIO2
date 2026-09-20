/* TrenTurnos v5 — Correo de solicitud de compensación y modo de vista
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function clearSelDay(){
  selDay=null;
  closeOv('ov-dia-card');
  renderCal();
}


function confirmarEnvioEmail(){
  var dest=(document.getElementById('ec-dest')?document.getElementById('ec-dest').value.trim():'');
  var asunto=(document.getElementById('ec-asunto')?document.getElementById('ec-asunto').value.trim():'');
  var cuerpo=(document.getElementById('ec-cuerpo')?document.getElementById('ec-cuerpo').value:'');
  if(dest){AJ.emailDestino=dest;localStorage.setItem('aj5',JSON.stringify(AJ));}
  // Fix: dest NO se codifica — el @ debe ir literal en mailto: (RFC 6068)
  // Fix: cuerpo pasa por sanitizarTexto para eliminar acentos y caracteres
  //      especiales que bloquean la apertura en clientes móviles
  var cuerpoLimpio = sanitizarTexto(cuerpo);
  var ml='mailto:'+dest+'?subject='+encodeURIComponent(asunto)+'&body='+encodeURIComponent(cuerpoLimpio);
  if(typeof _emailCB==='function'){_emailCB();_emailCB=null;}
  closeOv('ov-email-confirm');
  setTimeout(function(){window.location.href=ml;closeOv('ov-cambio');},150);
}

function enviarSolicitudCompensacion(k){
  var t=TV[k];if(!t)return;
  var kp=k.split('-').map(Number);var y=kp[0],mo=kp[1],dd=kp[2];
  var fstr=dd+' de '+MESES[mo-1].toLowerCase()+' de '+y;
  var nDias=(t.diasComp||[]).length||(t.modo==='pernocta'?4:2);
  var mn=AJ.nombre||'',mm=AJ.matricula||'';
  var hora=new Date().getHours();
  var sal=hora<13?'Buenos dias':hora<20?'Buenas tardes':'Buenas noches';
  var diasCompTxt = (t.diasComp||[]).map(function(iso){
    var p=iso.split('-').map(Number);
    return p[2]+' de '+MESES[p[1]-1];
  }).join(', ');
  // Extrae TODOS los tramos del día (ida, vuelta y sus tramos de
  // continuidad) — antes solo se leía t.numTren y el resto se perdía.
  var tramosIda = [t.numTren].concat((t.continuidad||[]).map(function(c){return c.tren;})).filter(Boolean);
  var tramosVuelta = [t.numTrenVuelta].concat((t.continuidadVuelta||[]).map(function(c){return c.tren;})).filter(Boolean);
  var mensaje = 'Mediante el presente solicito la compensacion de '
    +nDias+' dia'+(nDias===1?'':'s')+' por el servicio realizado el dia '+fstr+'.'
    +(diasCompTxt?'\n\nDias solicitados: '+diasCompTxt+'.' : '')
    +'\n\nQuedo a la espera de su validacion.';
  var cuerpo = generarCuerpoCorreo({
    saludo: sal,
    mensaje: mensaje,
    mostrarTren: true,
    tramosIda: tramosIda,
    tramosVuelta: tramosVuelta,
    firma: mn,
    matricula: mm
  });
  var trenAsunto = tramosIda.concat(tramosVuelta).join('/');
  var asunto='Solicitud de Compensacion - '+fstr+(trenAsunto?' - Tren '+trenAsunto:'');
  handleEmailSubmission('Solicitud de Compensacion',nDias+' dia'+(nDias===1?'':'s')+' · '+fstr,asunto,cuerpo,
    function(){
      TV[k].pendienteEnvio=false;
      TV[k].compensacionSolicitada=true;
      if(selDay)selDay.t=TV[k];
      saveTV();
      renderCal();
      renderDiaArea();
      // Marcar correo como enviado — el recordatorio no volverá a aparecer
      marcarCorreoHTDLEnviado(k);
    },
    true
  );
}


function handleEmailSubmission(tit,sub,asunto,cuerpo,cb,mostrarPosponer){
  _emailCB=cb;
  document.getElementById('ec-tit').textContent=tit;
  document.getElementById('ec-sub').textContent=sub;
  document.getElementById('ec-asunto').value=asunto;
  document.getElementById('ec-cuerpo').value=cuerpo;
  var d=document.getElementById('ec-dest');
  if(d) d.value=''; // No pre-rellenar — el usuario escribe el correo de Programación
  // Mostrar u ocultar el botón Posponer según el contexto:
  // false = Escenario A (HTDL) — no aplica posponer aquí
  // true  = Escenario B (Compensación) — sí aplica
  var btnPos=document.getElementById('ec-btn-posponer');
  if(btnPos) btnPos.style.display = mostrarPosponer ? '' : 'none';
  var ca=(document.getElementById('ov-cambio') ? document.getElementById('ov-cambio').classList.contains('on') : false);
  if(ca) openOvTop('ov-email-confirm'); else openOv('ov-email-confirm');
  _emailTurnoKey = (selDay && selDay.k) ? selDay.k : null;
}

// Posponer recordatorio de correo de compensación al día del turno.
// Guarda en htdl_correos con la fecha del turno como clave.
function posponerCorreoCompensacion(){
  var k = _emailTurnoKey || (selDay && selDay.k);
  if(!k){ closeOv('ov-email-confirm'); toast('⏰ Recordatorio guardado'); return; }
  try{
    var correos = JSON.parse(localStorage.getItem('htdl_correos')||'{}');
    correos[k] = 'pospuesto';
    localStorage.setItem('htdl_correos', JSON.stringify(correos));
  }catch(e){}
  closeOv('ov-email-confirm');
  toast('⏰ Te recordamos el día '+k);
  _emailTurnoKey = null;
}

function openOvTop(id){var el=document.getElementById(id);el.classList.add('on');el.classList.add('ov-top');}

function renderVistaToggle() {
  var wrap = document.getElementById('vista-toggle');
  if (!wrap) return;
  var hasComp = Object.keys(COMP_DATA).length > 0;
  if (!hasComp) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
}

// ── Import modal — selector destino ─────────────────────────






function setVistaMode(mode) {
  vistaMode = mode;
  var btns = document.querySelectorAll('.vista-btn');
  btns.forEach(function(b) { b.classList.remove('act'); });
  var active = document.getElementById('vista-' + mode);
  if (active) active.classList.add('act');
  renderCal();
}
