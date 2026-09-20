/* TrenTurnos v5 — Acordeones de Ajustes y de Hoy
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   FIN MÓDULO ALARMA PERSISTENTE v2
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   MÓDULO ACORDEÓN AJUSTES — toggleAjAcc
   Envuelve visualmente las 6 tarjetas de Ajustes.
   No toca ningún ID, input ni lógica de guardado existente.
═══════════════════════════════════════════════════════════ */
function toggleAjAcc(id){
  var el = document.getElementById(id);
  if(!el) return;
  var yaAbierto = el.classList.contains('aj-acc-open');
  // Cerrar todos los demás bloques (comportamiento acordeón)
  var todos = document.querySelectorAll('.aj-acc-item');
  for(var ii=0; ii<todos.length; ii++){
    if(todos[ii].id !== id) todos[ii].classList.remove('aj-acc-open');
  }
  // Toggle del bloque pulsado
  if(yaAbierto) el.classList.remove('aj-acc-open');
  else el.classList.add('aj-acc-open');
}
/* ═══════════════════════════════════════════════════════════ */




/* ═══════════════════════════════════════════════════════════
   ACORDEÓN — Turno de Hoy
   Función nueva e independiente. No toca renderPanelHoy().
   Solo gestiona la clase visual de colapso/expansión.
═══════════════════════════════════════════════════════════ */
function toggleHoyAcc(){
  var acc = document.getElementById('hoyAcc');
  if(!acc) return;
  // No permitir expandir si no hay turno registrado hoy
  if(acc.classList.contains('hoy-acc-inactivo')) return;
  acc.classList.toggle('open');
}

/* ═══════════════════════════════════════════════════════════
   RESUMEN COMPACTO — Turno de Hoy (cabecera del acordeón)
   Función nueva e independiente. Lee TV[hoy] y AJ.base
   (mismos datos que ya usa renderPanelHoy) sin modificar
   esa función ni la estructura de datos original.
   Capa cerrada → Base · Destino · Horario
   Capa abierta → el detalle completo ya generado por
                  renderPanelHoy() permanece intacto.
═══════════════════════════════════════════════════════════ */
function renderHoyResumen(){
  var cont = document.getElementById('hoyAccResumen');
  var acc  = document.getElementById('hoyAcc');
  if(!cont || !acc) return;

  var hoy = new Date();
  var k = key(hoy.getFullYear(), hoy.getMonth()+1, hoy.getDate());
  var t = TV[k];

  // Sin turno registrado → mensaje simple, acordeón inactivo (no expandible)
  if(!t){
    cont.innerHTML = '<span class="hoy-acc-lbl">Sin turno registrado</span>';
    acc.classList.add('hoy-acc-inactivo');
    acc.classList.remove('open');
    return;
  }
  acc.classList.remove('hoy-acc-inactivo');

  var ti = TIPO_INFO[t.tipo] || {ico:'📋', lbl:t.tipo||'Turno'};

  // FIX: el origen del resumen no siempre es la base del usuario.
  // En un día de vuelta-pernocta, el origen real es la estación donde
  // se pernoctó (t.sal), no AJ.base — antes mostraba "Base → Base"
  // porque asumía siempre AJ.base como punto de partida.
  var origen, destino;
  if(t.tipo === 'vuelta-pernocta'){
    origen  = t.sal || AJ.base || '—';
    destino = t.lle || AJ.base || '—';
  } else {
    origen  = AJ.base || '—';
    // Destino: prioriza el de ida; si no hay, usa el de vuelta
    destino = t.lle || t.lle2 || t.sal2 || '—';
  }

  // Horario: rango completo del turno (ida → vuelta si existe, si no solo ida)
  var horaIni = t.hF || '';
  var horaFin = t.hL2 || t.hL || '';
  var horario = (horaIni || horaFin) ? (horaIni||'—')+' – '+(horaFin||'—') : '';

  // Indicador DH en resumen compacto
  var dhMini = '';
  if(t.estadoServicio==='dh' || t.estadoServicioVuelta==='dh'){
    var cuantos = (t.estadoServicio==='dh'?1:0) + (t.estadoServicioVuelta==='dh'?1:0);
    dhMini = ' · <span style="background:rgba(245,158,11,.2);border-radius:4px;padding:0 4px;color:var(--amber2);font-weight:800;font-size:9px">DH'+(cuantos>1?'×'+cuantos:'')+'</span>';
  }

  cont.innerHTML =
    '<span class="hoy-acc-ico">'+ti.ico+'</span>'
    +'<div class="hoy-acc-resumen-txt">'
    +'<span class="hoy-acc-lbl">'+ti.lbl+dhMini+'</span>'
    +'<span class="hoy-acc-mini">'
    +'<strong>'+origen+'</strong>'
    +(destino!=='—'?' → <strong>'+destino+'</strong>':'')
    +(horario?' · '+horario:'')
    +'</span>'
    +'</div>';
}
