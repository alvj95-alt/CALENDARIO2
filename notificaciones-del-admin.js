/* TrenTurnos v5 — Notificaciones del Admin a todos los trabajadores (bloque aislado)
   Separado del HTML único original SIN cambiar la lógica.
   El orden de carga está en index.html (importa: no lo alteres). */
(function(){

var NADM_TIPOS = {
  info:    { ic:'ℹ️', label:'Informativo',  c:'#93C5FD', bg:'rgba(37,99,235,.12)',  bc:'rgba(37,99,235,.35)',  boton:'#2563EB' },
  urgente: { ic:'🚨', label:'Urgente',       c:'#FCA5A5', bg:'rgba(220,38,38,.14)',  bc:'rgba(220,38,38,.45)',  boton:'#DC2626' },
  manten:  { ic:'🔧', label:'Mantenimiento', c:'#C4B5FD', bg:'rgba(124,58,237,.14)', bc:'rgba(124,58,237,.4)',  boton:'#7C3AED' }
};
var NADM_SEDES = ['Barcelona','Madrid','Valencia','Sevilla','Bilbao','Alicante'];

// ── Paso 1 del formulario: destinatarios ──
var nadmModoDest = 'todas';
var nadmSedeElegida = 'Barcelona';
// NUEVO — Confirmado por el usuario: texto legible para el campo
// "sede" guardado — antes de esto, elegir "Interventores" mostraría
// el valor interno tal cual ("INTERVENTORES") en vez de un texto
// natural a juego con el resto ("Todas las sedes", "Barcelona"...).
function _nadmEtiquetaDestino(sede){
  if(!sede) return 'todas las sedes';
  if(sede === 'INTERVENTORES') return 'Interventores';
  return sede;
}
function nadmSegSede(m){
  nadmModoDest = m;
  var elT = document.getElementById('nadmSegTodas'), elU = document.getElementById('nadmSegUna'), elI = document.getElementById('nadmSegInterv');
  if(elT) elT.classList.toggle('on', m==='todas');
  if(elU) elU.classList.toggle('on', m==='una');
  if(elI) elI.classList.toggle('on', m==='interventores');
  var chips = document.getElementById('nadmSedeChips');
  if(chips) chips.style.display = m==='una' ? 'flex' : 'none';
}
function nadmPintarSedeChips(){
  var chips = document.getElementById('nadmSedeChips');
  if(!chips) return;
  chips.innerHTML = NADM_SEDES.map(function(s){
    return '<div class="nadm-sede-chip '+(s===nadmSedeElegida?'on':'')+'" onclick="nadmElegirSede(\''+s+'\')">'+s+'</div>';
  }).join('');
}
function nadmElegirSede(s){ nadmSedeElegida = s; nadmPintarSedeChips(); }

// ── Paso 2 del formulario: tipo de aviso ──
var nadmTipoSel = 'info';
function nadmPintarTipoGrid(){
  var grid = document.getElementById('nadmTipoGrid');
  if(!grid) return;
  grid.innerHTML = Object.keys(NADM_TIPOS).map(function(k){
    var t = NADM_TIPOS[k];
    return '<div class="nadm-tipo-chip '+(k===nadmTipoSel?'on':'')+'" style="--chip-c:'+t.c+';--chip-bg:'+t.bg+'" onclick="nadmElegirTipo(\''+k+'\')">'
      + '<div class="ic">'+t.ic+'</div><div class="lb">'+t.label+'</div></div>';
  }).join('');
  var btn = document.getElementById('nadmBtnEnviar');
  if(btn) btn.style.background = NADM_TIPOS[nadmTipoSel].boton;
}
function nadmElegirTipo(k){ nadmTipoSel = k; nadmPintarTipoGrid(); }

// ── Enviar ──
async function enviarNotificacionAdmin(){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var tit = document.getElementById('nadmInpTitulo').value.trim();
  var msg = document.getElementById('nadmInpMsg').value.trim();
  var estado = document.getElementById('nadmEstadoEnvio');
  if(!tit || !msg){
    estado.innerHTML = '<span style="color:var(--red2)">Falta el título o el mensaje.</span>';
    return;
  }
  // NUEVO — Confirmado por el usuario: tercera opción "Interventores"
  // — se guarda con un valor especial ('INTERVENTORES') en la misma
  // columna "sede" que ya existía, para no tener que tocar la tabla en
  // Supabase — filtrado en refrescarNotificacionesActivas().
  var sede = nadmModoDest==='una' ? nadmSedeElegida : (nadmModoDest==='interventores' ? 'INTERVENTORES' : null);
  estado.textContent = 'Enviando...';
  try{
    var r = await sbAdmin.from('notificaciones_admin').insert({
      titulo: tit, mensaje: msg, tipo: nadmTipoSel, sede: sede, activa: true,
      creado_por: (usuarioActual && usuarioActual.email) || null
    });
    if(r.error){
      estado.innerHTML = '<span style="color:var(--red2)">No se pudo enviar: '+r.error.message+' (¿existe la tabla notificaciones_admin en Supabase?)</span>';
      return;
    }
    estado.innerHTML = '<b style="color:var(--green2)">✅ Enviada</b> como <b>'+NADM_TIPOS[nadmTipoSel].label+'</b> a <b>'+_nadmEtiquetaDestino(sede)+'</b>.';
    document.getElementById('nadmInpTitulo').value = '';
    document.getElementById('nadmInpMsg').value = '';
    cargarHistorialNotificacionesAdmin();
  }catch(e){
    estado.innerHTML = '<span style="color:var(--red2)">Error inesperado: '+(e && e.message ? e.message : e)+'</span>';
  }
}

// ── Historial (admin) ──
async function cargarHistorialNotificacionesAdmin(){
  var cont = document.getElementById('nadmListaHistorial');
  if(!cont || !sbAdmin) return;
  cont.innerHTML = '<div class="estado-archivo sin-archivo">Cargando...</div>';
  var r = await sbAdmin.from('notificaciones_admin').select('*').eq('activa', true).order('fecha_hora', { ascending:false }).limit(15);
  if(!r || !r.data || !r.data.length){
    cont.innerHTML = '<div class="estado-archivo sin-archivo">Aún no has enviado ninguna notificación.</div>';
    return;
  }
  cont.innerHTML = r.data.map(function(n){
    var t = NADM_TIPOS[n.tipo] || NADM_TIPOS.info;
    var fecha = new Date(n.fecha_hora).toLocaleString('es-ES', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
    return '<div class="nadm-hist-item">'
      + '<div style="flex:1;min-width:0">'
        + '<div class="nadm-hist-tit">'+t.ic+' '+n.titulo+'</div>'
        + '<div class="nadm-hist-msg">'+n.mensaje+'</div>'
        + '<div class="nadm-hist-meta">'+fecha+' · '+_nadmEtiquetaDestino(n.sede)+'</div>'
      + '</div>'
      + '<button class="nadm-hist-del" onclick="retirarNotificacionAdmin('+n.id+')">🗑 Retirar</button>'
    + '</div>';
  }).join('');
}
async function retirarNotificacionAdmin(id){
  if(!sbAdmin) return;
  await sbAdmin.from('notificaciones_admin').update({ activa:false }).eq('id', id);
  cargarHistorialNotificacionesAdmin();
}

// ── Entrega al trabajador: qué ha visto/descartado ya (por dispositivo) ──
function _nadmVistas(){ try{ return JSON.parse(localStorage.getItem('notif_admin_vistas') || '[]'); }catch(e){ return []; } }
function _nadmMarcarVista(id){
  var v = _nadmVistas();
  if(v.indexOf(id) === -1){ v.push(id); localStorage.setItem('notif_admin_vistas', JSON.stringify(v)); }
}
function _nadmDescartadas(){ try{ return JSON.parse(localStorage.getItem('notif_admin_descartadas') || '[]'); }catch(e){ return []; } }
function _nadmDescartar(id){
  var d = _nadmDescartadas();
  if(d.indexOf(id) === -1){ d.push(id); localStorage.setItem('notif_admin_descartadas', JSON.stringify(d)); }
  // FIX — Confirmado por Alex (bug real, detectado en producción): el
  // botón "X" es el mismo en las dos pantallas (nadmBannerHTML() se
  // reutiliza en ambas), pero solo se refrescaba el banner de
  // Calendario. En Interventor, el descarte SÍ se guardaba bien en
  // localStorage, pero como nunca se volvía a pintar
  // notifBannerZonaInterventor, el aviso se quedaba visible en
  // pantalla aunque ya estuviera descartado. Ahora se refrescan las
  // dos, y cada una comprueba si su propio contenedor existe en el
  // DOM antes de intentar nada (no rompe nada si una de las dos
  // pantallas no está montada en ese momento).
  nadmRenderBanners();
  nadmRenderBannersInterventor();
}

var _nadmActivasCache = [];   // filtrado por sede — usado en Calendario (tripulación)
var _nadmActivasTodas = [];   // sin filtrar — usado en Interventor (no tiene una sede fija)
async function refrescarNotificacionesActivas(){
  if(!sbAdmin) return;
  try{
    var r = await sbAdmin.from('notificaciones_admin').select('*').eq('activa', true).order('fecha_hora', { ascending:false }).limit(20);
    if(!r || !r.data) return;
    // NUEVO — Confirmado por Alex: caducidad de 24h. Como no hay
    // ningún proceso corriendo solo en el servidor (nada de "tareas
    // programadas" en segundo plano — todo lo hace la propia app), la
    // forma de que esto se cumpla es que la primera persona que
    // vuelva a abrir la app después de esas 24h sea quien, de paso,
    // desactive el aviso para todo el mundo. En la práctica, con
    // cualquier cantidad normal de gente usando la app a diario, esto
    // pasa casi al momento — pero no es "al segundo exacto".
    var ahora = Date.now();
    var VEINTICUATRO_HORAS_MS = 24*60*60*1000;
    var vigentes = [];
    var expiradas = [];
    r.data.forEach(function(n){
      var edadMs = ahora - new Date(n.fecha_hora).getTime();
      (edadMs > VEINTICUATRO_HORAS_MS ? expiradas : vigentes).push(n);
    });
    if(expiradas.length){
      // Se desactivan en segundo plano (no se espera a que termine
      // para seguir pintando la pantalla con lo vigente) — así ya no
      // aparecen para nadie más que las compruebe después.
      expiradas.forEach(function(n){
        sbAdmin.from('notificaciones_admin').update({activa:false}).eq('id', n.id).then(function(){});
      });
      console.log('Notificaciones caducadas (24h) desactivadas:', expiradas.map(function(n){return n.id;}).join(', '));
    }
    // NUEVO — Confirmado por el usuario: Interventor ya no ve TODO sin
    // filtrar — antes recibía también los avisos pensados solo para
    // una sede concreta de Tripulante (p. ej. "Barcelona"), que no le
    // pintaban nada a él. Ahora solo ve los de "todas las sedes"
    // (sede=null) y los que se manden específicamente a
    // Interventores (sede='INTERVENTORES', ver nadmSegSede()).
    _nadmActivasTodas = vigentes.filter(function(n){
      return !n.sede || n.sede === 'INTERVENTORES';
    });
    // NUEVO — Confirmado por Alex: Interventor no tiene una Estación
    // Base como el tripulante (se valida por matrícula contra el
    // Informe de Intervención, organizado por servicio, no por sede),
    // así que en su pantalla se muestran TODAS las notificaciones
    // activas, sin filtrar. En Calendario (tripulación) se sigue
    // filtrando por sede como hasta ahora.
    var miSede = (typeof _sedeUsuarioActual === 'function') ? _sedeUsuarioActual() : '';
    _nadmActivasCache = vigentes.filter(function(n){
      return !n.sede || (miSede && n.sede.trim().toLowerCase() === miSede.trim().toLowerCase());
    });
    nadmRenderBanners();
    nadmRenderBannersInterventor();
    // La más reciente que este dispositivo no haya visto nunca -> popup.
    // Se elige la lista según la pantalla activa en este momento.
    var enModoInterventor = document.body.classList.contains('modo-interventor');
    var listaContexto = enModoInterventor ? _nadmActivasTodas : _nadmActivasCache;
    var vistas = _nadmVistas();
    var nueva = null;
    for(var i=0;i<listaContexto.length;i++){
      if(vistas.indexOf(listaContexto[i].id) === -1){ nueva = listaContexto[i]; break; }
    }
    if(nueva) nadmAbrirModal(nueva.id);
  }catch(e){
    console.log('No se pudieron cargar las notificaciones activas:', e);
  }
}

function nadmRenderBanners(){
  var zona = document.getElementById('notifBannerZona');
  if(!zona) return;
  var descartadas = _nadmDescartadas();
  var visibles = _nadmActivasCache.filter(function(n){ return descartadas.indexOf(n.id) === -1; });
  zona.innerHTML = visibles.map(nadmBannerHTML).join('');
}

// NUEVO — misma pinta que nadmRenderBanners(), pero para la pantalla
// de Interventor (su propio contenedor, sin filtrar por sede).
function nadmRenderBannersInterventor(){
  var zona = document.getElementById('notifBannerZonaInterventor');
  if(!zona) return;
  var descartadas = _nadmDescartadas();
  var visibles = _nadmActivasTodas.filter(function(n){ return descartadas.indexOf(n.id) === -1; });
  zona.innerHTML = visibles.map(nadmBannerHTML).join('');
}

// NUEVO — el HTML de un banner es idéntico en las dos pantallas;
// factorizado aquí para no duplicar el mismo bloque dos veces.
function nadmBannerHTML(n){
  var t = NADM_TIPOS[n.tipo] || NADM_TIPOS.info;
  return '<div class="nadm-banner" style="--nadm-bc:'+t.bc+';--nadm-bg:'+t.bg+';--nadm-tc:'+t.c+'" onclick="nadmAbrirModal('+n.id+')">'
    + '<div class="nadm-banner-ico">'+t.ic+'</div>'
    + '<div style="flex:1">'
      + '<div class="nadm-banner-tit">'+n.titulo+'</div>'
      + '<div class="nadm-banner-msg">'+n.mensaje+'</div>'
      + '<div class="nadm-banner-meta">'+t.label.toUpperCase()+' · '+(n.sede || 'TODAS LAS SEDES')+'</div>'
    + '</div>'
    + '<div class="nadm-banner-x" onclick="event.stopPropagation();_nadmDescartar('+n.id+')">✕</div>'
  + '</div>';
}

function nadmAbrirModal(id){
  // Busca en la lista sin filtrar (superconjunto de la filtrada), así
  // funciona igual venga el clic de Calendario o de Interventor.
  var n = null;
  for(var i=0;i<_nadmActivasTodas.length;i++){ if(_nadmActivasTodas[i].id === id){ n = _nadmActivasTodas[i]; break; } }
  if(!n) return;
  var t = NADM_TIPOS[n.tipo] || NADM_TIPOS.info;
  document.getElementById('nadmModalIco').textContent = t.ic;
  document.getElementById('nadmModalIco').style.background = t.bg;
  document.getElementById('nadmModalMeta').textContent = t.label.toUpperCase() + ' · ' + (n.sede || 'TODAS LAS SEDES');
  document.getElementById('nadmModalTit').textContent = n.titulo;
  document.getElementById('nadmModalMsg').textContent = n.mensaje;
  document.getElementById('nadmModalBtn').style.background = t.boton;
  openOv('ov-notif-trabajador');
  _nadmMarcarVista(n.id);
}

// Exponer a window explícitamente: los onclick del HTML (estáticos y
// generados dinámicamente arriba) se ejecutan en ámbito global.
window.nadmSegSede = nadmSegSede;
window.nadmElegirSede = nadmElegirSede;
window.nadmElegirTipo = nadmElegirTipo;
window.enviarNotificacionAdmin = enviarNotificacionAdmin;
window.cargarHistorialNotificacionesAdmin = cargarHistorialNotificacionesAdmin;
window.retirarNotificacionAdmin = retirarNotificacionAdmin;
window._nadmDescartar = _nadmDescartar;
window.nadmAbrirModal = nadmAbrirModal;
window.refrescarNotificacionesActivas = refrescarNotificacionesActivas;

// Pinta el formulario del admin desde ya (aunque el panel esté oculto,
// no molesta) y arranca la primera comprobación de avisos activos.
nadmPintarSedeChips();
nadmPintarTipoGrid();
refrescarNotificacionesActivas();

})();
