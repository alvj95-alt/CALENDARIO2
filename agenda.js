/* TrenTurnos v5 — Agenda de compañeros
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════
   AGENDA DE COMPAÑEROS
   ModeloContacto: {id, nombre, matricula, tren, ultimoUso}
   Persistencia: localStorage key 'agenda5'
═══════════════════════════════════════ */

// ── Base de datos de contactos (independiente de TV) ──
// AGENDA declarada en bloque ESTADO GLOBAL

function saveAgenda(){ localStorage.setItem('agenda5', JSON.stringify(AGENDA)); }

// ── CRUD Contactos ────────────────────────────────────────────
function agregarContacto(nombre,matricula,tren){
  if(tren===undefined)tren='';
  var ex=null;for(var i=0;i<AGENDA.length;i++){if(AGENDA[i].matricula===matricula&&matricula){ex=AGENDA[i];break;}}
  if(ex){ex.nombre=nombre;ex.tren=tren||ex.tren;ex.ultimoUso=Date.now();saveAgenda();return ex;}
  var c={id:Date.now().toString(),nombre:nombre.trim(),matricula:matricula.trim(),tren:tren.trim(),ultimoUso:Date.now()};
  AGENDA.unshift(c);saveAgenda();return c;
}

function eliminarContacto(id){AGENDA=AGENDA.filter(function(c){return c.id!==id;});saveAgenda();}

function buscarContactos(q){
  if(!q)return AGENDA.slice().sort(function(a,b){return b.ultimoUso-a.ultimoUso;});
  var lq=q.toLowerCase();
  return AGENDA.filter(function(c){return c.nombre.toLowerCase().indexOf(lq)>=0||c.matricula.toLowerCase().indexOf(lq)>=0||c.tren.indexOf(q)>=0;});
}

// ── Abrir agenda desde formulario de cambio ───────────────────
function abrirAgenda(){
  document.getElementById('agenda-srch-inp').value = '';
  renderAgenda('');
  openOv('ov-agenda');
}

function renderAgenda(q){
  var lista=document.getElementById('agenda-list');
  var cs=buscarContactos(q);
  if(!cs.length){lista.innerHTML='<div style="padding:24px;text-align:center;color:var(--tx3);font-size:12px">'+(q?'Sin resultados para "'+q+'"':'Agenda vacia. Añade compañeros.')+'</div>';return;}
  lista.innerHTML=cs.map(function(c){
    var ini=c.nombre?c.nombre[0].toUpperCase():'?';
    return '<div class="contacto-card" onclick="seleccionarContacto(\''+c.id+'\')">'
      +'<div class="contacto-av">'+ini+'</div>'
      +'<div class="contacto-info"><div class="contacto-nombre">'+c.nombre+'</div><div class="contacto-mat">🪪 '+(c.matricula||'—')+'</div>'+(c.tren?'<div class="contacto-tren">🚆 #'+c.tren+'</div>':'')+'</div>'
      +'<button class="contacto-del" onclick="event.stopPropagation();borrarContactoAgenda(\''+c.id+'\')" title="Eliminar">🗑</button></div>';
  }).join('');
}

// Rellenar formulario de cambio con el contacto seleccionado
function seleccionarContacto(id){
  var c=null;for(var i=0;i<AGENDA.length;i++){if(AGENDA[i].id===id){c=AGENDA[i];break;}}
  if(!c)return;c.ultimoUso=Date.now();saveAgenda();
  var n=document.getElementById('cbio-nombre'),m=document.getElementById('cbio-mat'),tr=document.getElementById('cbio-tren');
  if(n)n.value=c.nombre;if(m)m.value=c.matricula;if(tr&&c.tren)tr.value=c.tren;
  closeOv('ov-agenda');actualizarPrevCambio();ocultarSugerencias();toast('👤 '+c.nombre+' seleccionado');
}

function borrarContactoAgenda(id){
  var c=null;for(var i=0;i<AGENDA.length;i++){if(AGENDA[i].id===id){c=AGENDA[i];break;}}
  if(!c)return;if(!confirm('¿Eliminar a '+c.nombre+' de la agenda?'))return;
  eliminarContacto(id);renderAgenda(document.getElementById('agenda-srch-inp').value||'');toast('🗑 Contacto eliminado');
}

// ── Añadir contacto manualmente ───────────────────────────────
function abrirNuevoContacto(){
  document.getElementById('nc-nombre').value = '';
  document.getElementById('nc-mat').value    = '';
  document.getElementById('nc-tren').value   = '';
  closeOv('ov-agenda');
  openOv('ov-nuevo-contacto');
}

function guardarNuevoContacto(){
  var nombre = document.getElementById('nc-nombre').value.trim();
  var mat    = document.getElementById('nc-mat').value.trim();
  var tren   = document.getElementById('nc-tren').value.trim();
  if(!nombre){ toast('⚠️ Escribe un nombre'); return; }
  agregarContacto(nombre, mat, tren);
  closeOv('ov-nuevo-contacto');
  toast('✅ '+nombre+' guardado en agenda');
}

// ── Autocompletado en formulario de cambio ─────────────────────
function sugerirContacto(campo,q){
  var bN=document.getElementById('sug-nombre'),bM=document.getElementById('sug-mat');
  var bx=campo==='nombre'?bN:bM,ot=campo==='nombre'?bM:bN;
  if(ot)ot.style.display='none';
  if(!q||q.length<1){if(bx)bx.style.display='none';return;}
  var sugs=buscarContactos(q).slice(0,5);
  if(!sugs.length){if(bx)bx.style.display='none';return;}
  if(bx){bx.innerHTML=sugs.map(function(c){return '<div class="sug-item" onclick="seleccionarContacto(\''+c.id+'\')">'+'<span style="font-size:14px">👤</span><span class="sug-nombre">'+c.nombre+'</span><span class="sug-mat">'+(c.matricula||'')+'</span></div>';}).join('');bx.style.display='block';}
}

function ocultarSugerencias(){
  var b1 = document.getElementById('sug-nombre');
  var b2 = document.getElementById('sug-mat');
  if(b1) b1.style.display = 'none';
  if(b2) b2.style.display = 'none';
}

// ── Guardado automático tras enviar cambio ─────────────────────
// Se llama desde enviarCambio() después de abrir el mailto:
function preguntarGuardarContacto(nombre,matricula,tren){
  if(!nombre)return;
  var ex=null;for(var i=0;i<AGENDA.length;i++){if(AGENDA[i].matricula===matricula||AGENDA[i].nombre.toLowerCase()===nombre.toLowerCase()){ex=AGENDA[i];break;}}
  if(ex){ex.ultimoUso=Date.now();saveAgenda();return;}
  if(confirm('¿Guardar a "'+nombre+'" en tu agenda?\n\nLa proxima vez se autocompletara automaticamente.'))agregarContacto(nombre,matricula,tren);
}
