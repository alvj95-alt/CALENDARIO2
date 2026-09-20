/* TrenTurnos v5 — Lista negra de compañeros
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function cargarListaNegra(){
  try{
    var raw = localStorage.getItem('listaNegraApp');
    listaNegra = raw ? JSON.parse(raw) : [];
  }catch(e){ listaNegra = []; }
}
function guardarListaNegra(){
  localStorage.setItem('listaNegraApp', JSON.stringify(listaNegra));
  actualizarResumenListaNegra();
}
function actualizarResumenListaNegra(){
  var el = document.getElementById('ln-resumen');
  if(!el) return;
  el.textContent = listaNegra.length
    ? listaNegra.length+' compañero(s) en la lista negra'
    : 'Sin compañeros en la lista negra';
}

function abrirListaNegra(){
  cargarListaNegra();
  renderListaNegraUI();
  openOv('ov-listanegra');
}

function renderListaNegraUI(){
  var cont = document.getElementById('ln-lista');
  if(!cont) return;
  if(!listaNegra.length){
    cont.innerHTML = '<div class="today-empty" style="margin:10px 0">No hay compañeros en la lista negra</div>';
    return;
  }
  cont.innerHTML = listaNegra.map(function(p, i){
    return '<div style="display:flex;align-items:flex-start;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)">'
      +'<div style="flex:1">'
      +'<div style="font-size:13px;font-weight:700;color:var(--tx)">'+(p.nombre||'(sin nombre)')+'</div>'
      +'<div style="font-size:11px;color:var(--tx3)">Matrícula: '+(p.matricula||'—')+'</div>'
      +(p.observacion?'<div style="font-size:11px;color:#f87171;margin-top:3px">⚠️ '+p.observacion+'</div>':'')
      +'</div>'
      +'<button onclick="eliminarListaNegra('+i+')" style="background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.35);border-radius:6px;color:#f87171;font-size:11px;font-weight:700;padding:5px 10px;cursor:pointer">🗑</button>'
      +'</div>';
  }).join('');
}

function agregarListaNegra(){
  var nombre = document.getElementById('ln-nombre').value.trim();
  var matricula = document.getElementById('ln-mat').value.trim();
  var observacion = document.getElementById('ln-obs').value.trim();
  if(!nombre && !matricula){
    toast('Indica al menos el nombre o la matrícula');
    return;
  }
  listaNegra.push({nombre:nombre, matricula:matricula, observacion:observacion});
  guardarListaNegra();
  document.getElementById('ln-nombre').value='';
  document.getElementById('ln-mat').value='';
  document.getElementById('ln-obs').value='';
  renderListaNegraUI();
  toast('Añadido a la lista negra');
}

function eliminarListaNegra(idx){
  if(!confirm('¿Quitar a esta persona de la lista negra?')) return;
  listaNegra.splice(idx,1);
  guardarListaNegra();
  renderListaNegraUI();
}

// FUNCIÓN DE VALIDACIÓN INDEPENDIENTE — exactamente como se pidió.
// Busca por nombre (coincidencia parcial, sin distinguir mayúsculas)
// o por matrícula exacta. No modifica nada, solo consulta.
function esCompaneroBloqueado(identificador){
  if(!identificador) return null;
  cargarListaNegra();
  var idLower = identificador.trim().toLowerCase();
  for(var i=0;i<listaNegra.length;i++){
    var p = listaNegra[i];
    if(p.matricula && p.matricula.trim()===identificador.trim()) return p;
    if(p.nombre && p.nombre.trim().toLowerCase().indexOf(idLower)>=0 && idLower.length>0) return p;
    if(p.nombre && idLower.indexOf(p.nombre.trim().toLowerCase())>=0 && p.nombre.trim().length>0) return p;
  }
  return null;
}

// Pop-up de precaución — capa extra, NO bloqueante por sí sola.
// onContinuar() se ejecuta solo si el usuario decide seguir adelante.
function mostrarAvisoListaNegra(persona, onContinuar){
  var modal = document.createElement('div');
  modal.className = 'ov on';
  modal.style.zIndex = '400';
  modal.innerHTML =
    '<div class="confirm-sh" onclick="event.stopPropagation()">'
    +'<div class="sh-handle"></div>'
    +'<div class="conf-ico">⚠️</div>'
    +'<div class="conf-tit">PRECAUCIÓN</div>'
    +'<div class="conf-txt">Este compañero está en tu lista negra.'
    +(persona.observacion?'<br><br><strong>Observación:</strong> '+persona.observacion:'')+'</div>'
    +'<div class="conf-btns">'
    +'<button class="conf-cancel" id="ln-aviso-cancelar">Cancelar</button>'
    +'<button class="conf-del" id="ln-aviso-continuar">Continuar de todos modos</button>'
    +'</div>'
    +'</div>';
  modal.addEventListener('click', function(){ document.body.removeChild(modal); });
  document.body.appendChild(modal);
  document.getElementById('ln-aviso-cancelar').addEventListener('click', function(){
    document.body.removeChild(modal);
  });
  document.getElementById('ln-aviso-continuar').addEventListener('click', function(){
    document.body.removeChild(modal);
    onContinuar();
  });
}
