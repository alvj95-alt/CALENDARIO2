/* TrenTurnos v5 — Validación asistida DH y gestión/eliminación de meses
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function abrirValidacionDH(diaN, ti){
  if(!horarioActualDias) return;
  var dia = horarioActualDias.find(function(d){ return d.n === diaN; });
  if(!dia || !dia.tramos || !dia.tramos[ti]) return;
  var t = dia.tramos[ti];
  _dhValDia = diaN;
  _dhValTramo = ti;
  _dhValMismoTren = (t.dh && typeof t.dh.mismoTren==='boolean') ? t.dh.mismoTren : null;

  var subtit = document.getElementById('dhval-subtit');
  if(subtit) subtit.textContent = 'Tramo · Tren '+(t.tren||'—')+' · '+(t.est||'');

  var trenEl = document.getElementById('dhval-tren');
  var minEl  = document.getElementById('dhval-min');
  if(trenEl) trenEl.value = (t.dh && t.dh.trenDH) ? t.dh.trenDH : '';
  if(minEl)  minEl.value  = (t.dh && t.dh.duracionMin!=null) ? t.dh.duracionMin : '';

  var quitarBtn = document.getElementById('dhval-quitar');
  if(quitarBtn) quitarBtn.style.display = (t.dh && t.dh.trenDH) ? 'block' : 'none';

  _pintarSeleccionMismoTrenDH();
  openOv('ov-dh-validacion');
  setTimeout(function(){ if(trenEl) trenEl.focus(); }, 350);
}

function seleccionarMismoTrenDH(esMismo){
  _dhValMismoTren = esMismo;
  _pintarSeleccionMismoTrenDH();
}

function _pintarSeleccionMismoTrenDH(){
  var btnMismo = document.getElementById('dhval-btn-mismo');
  var btnDif   = document.getElementById('dhval-btn-dif');
  if(!btnMismo || !btnDif) return;
  var estilizarActivo = function(el){
    el.style.background = 'rgba(245,158,11,.15)';
    el.style.borderColor = 'var(--amber2)';
    el.style.color = 'var(--amber2)';
  };
  var estilizarInactivo = function(el){
    el.style.background = 'var(--s2)';
    el.style.borderColor = 'var(--div)';
    el.style.color = 'var(--tx2)';
  };
  if(_dhValMismoTren===true){ estilizarActivo(btnMismo); estilizarInactivo(btnDif); }
  else if(_dhValMismoTren===false){ estilizarActivo(btnDif); estilizarInactivo(btnMismo); }
  else { estilizarInactivo(btnMismo); estilizarInactivo(btnDif); }
}

function _marcarCampoDHInvalido(el){
  if(el){
    el.style.borderColor = '#ef4444';
    setTimeout(function(){ el.style.borderColor = 'var(--div)'; }, 1500);
  }
}

function cancelarValidacionDH(){
  _dhValDia = null; _dhValTramo = null; _dhValMismoTren = null;
  closeOv('ov-dh-validacion');
}

async function quitarValidacionDH(){
  if(_dhValDia===null || _dhValTramo===null || !horarioActualDias) return;
  var dia = horarioActualDias.find(function(d){ return d.n === _dhValDia; });
  if(!dia || !dia.tramos || !dia.tramos[_dhValTramo]) return;
  delete dia.tramos[_dhValTramo].dh;
  if(typeof currentMonthKey !== 'undefined' && currentMonthKey){
    await saveMonth(currentMonthKey, horarioActualDias, horarioActualMeta);
  }
  renderAll(horarioActualDias, horarioActualMeta);
  await renderAuditoriaHoras();
  cancelarValidacionDH();
  toast('DH del tramo eliminado');
}

async function confirmarValidacionDH(){
  // El registro no se completa hasta que las tres preguntas quedan respondidas.
  if(_dhValMismoTren !== true && _dhValMismoTren !== false){
    var btnMismo = document.getElementById('dhval-btn-mismo');
    if(btnMismo) _marcarCampoDHInvalido(btnMismo);
    return;
  }
  var trenEl = document.getElementById('dhval-tren');
  var minEl  = document.getElementById('dhval-min');
  var trenDH = trenEl ? trenEl.value.trim() : '';
  var duracionMin = minEl ? parseInt(minEl.value) : NaN;
  if(!trenDH){ _marcarCampoDHInvalido(trenEl); return; }
  if(isNaN(duracionMin) || duracionMin<0){ _marcarCampoDHInvalido(minEl); return; }

  if(_dhValDia===null || _dhValTramo===null || !horarioActualDias) return;
  var dia = horarioActualDias.find(function(d){ return d.n === _dhValDia; });
  if(!dia || !dia.tramos || !dia.tramos[_dhValTramo]) return;

  dia.tramos[_dhValTramo].dh = {
    mismoTren: _dhValMismoTren,
    trenDH: trenDH,
    duracionMin: duracionMin
  };

  if(typeof currentMonthKey !== 'undefined' && currentMonthKey){
    await saveMonth(currentMonthKey, horarioActualDias, horarioActualMeta);
  }
  renderAll(horarioActualDias, horarioActualMeta);
  await renderAuditoriaHoras();
  cancelarValidacionDH();
  toast('✓ DH validado — '+duracionMin+' min a Horas de Presencia');
}


async function deleteMonth(mesKey){
  localStore.remove('horario:' + mesKey);
  const idx = await getMonthIndex();
  const nuevo = idx.filter(m => m !== mesKey);
  await saveMonthIndex(nuevo);
  return nuevo;
}

async function refreshMonthSelect(selectedKey){
  const idx = await getMonthIndex();
  const monthRow = document.getElementById('monthRow');
  const sel = document.getElementById('monthSelect');
  sel.innerHTML = '';
  if(idx.length === 0){
    monthRow.style.display = 'none';
    return;
  }
  monthRow.style.display = 'flex';
  idx.forEach(m=>{
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    if(m === selectedKey) opt.selected = true;
    sel.appendChild(opt);
  });
}


/* ═══════════════════════════════════════════════════════════
   ACORDEÓN — Cabecera del panel Horario
   Función nueva e independiente. No modifica ninguna función
   existente del módulo de horario ni de la app principal.
═══════════════════════════════════════════════════════════ */
function toggleBoardHorario(){
  var acc = document.getElementById('boardAccHorario');
  if(!acc) return;
  acc.classList.toggle('open');
}
// NUEVO — Confirmado por el usuario: abre/cierra el acordeón
// "Gestionar meses guardados" (solo visual, la lista de dentro
// —monthListIndividual— ya se rellena sola con renderMonthListIndividual(),
// eso no se toca aquí).
function toggleGestionarMeses(){
  var acc = document.getElementById('gestionarMesesAcc');
  if(!acc) return;
  acc.classList.toggle('open');
}

/* ═══════════════════════════════════════════════════════════
   ELIMINACIÓN SELECTIVA DE HORARIOS — lista individual
   Funciones nuevas e independientes. Reutilizan deleteMonth(),
   getMonthIndex() y loadMonth() ya existentes sin modificarlas.
   SEGURIDAD: estas funciones solo operan sobre las claves
   'horario:*' y 'horarios:index' de localStore (el módulo de
   horario individual). NUNCA acceden a TV, saveTV(), ni a la
   clave 'tv5' del calendario principal — no existe ninguna
   referencia a esas variables en este bloque.
═══════════════════════════════════════════════════════════ */
async function renderMonthListIndividual(){
  var wrap = document.getElementById('monthListIndividual');
  if(!wrap) return;
  var idx = await getMonthIndex();
  if(!idx.length){
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  wrap.style.display = 'block';
  wrap.innerHTML = idx.map(function(mesKey){
    var esActual = (typeof currentMonthKey !== 'undefined' && mesKey === currentMonthKey);
    return '<div class="month-item-row">'
      + '<span class="month-item-name'+(esActual?' current':'')+'">'+mesKey+(esActual?' (actual)':'')+'</span>'
      + '<button class="month-item-del" onclick="eliminarHorarioIndividual(\''+mesKey.replace(/'/g,"\\'")+'\')">🗑 Eliminar</button>'
      + '</div>';
  }).join('');
}

async function eliminarHorarioIndividual(mesKey){
  if(!mesKey) return;
  var ok = confirm('¿Eliminar el horario de "'+mesKey+'"?\n\nEsta acción solo borra este archivo/PDF — tu calendario de turnos no se ve afectado.');
  if(!ok) return;

  // Reutiliza deleteMonth() ya existente — opera solo en localStore('horario:*')
  var restantes = await deleteMonth(mesKey);

  // Si el mes eliminado era el que estaba cargado en pantalla, recargar otro o vaciar
  if(typeof currentMonthKey !== 'undefined' && currentMonthKey === mesKey){
    if(restantes.length > 0){
      var siguiente = restantes[restantes.length - 1];
      var data = await loadMonth(siguiente);
      currentMonthKey = siguiente;
      renderAll(data.dias, data.meta);
      document.getElementById('deleteMonthLabel').textContent = siguiente;
      await refreshMonthSelect(siguiente);
    } else {
      currentMonthKey = null;
      cont.innerHTML = '<div class="today-empty" style="margin:20px 4px;">No hay ningún horario guardado. Sube un PDF para empezar.</div>';
      document.querySelector('.board-sub').textContent = 'Sin horario cargado';
      document.querySelector('[data-stat="HE"]').textContent = '–';
      document.querySelector('[data-stat="HP"]').textContent = '–';
      document.querySelector('[data-stat="HDJ"]').textContent = '–';
      document.getElementById('cServicio').textContent = '–';
      document.getElementById('cLibre').textContent = '–';
      document.getElementById('cReserva').textContent = '–';
      todayWrap.style.display = 'none';
      document.getElementById('deleteMonthLabel').textContent = 'este mes';
      await refreshMonthSelect(null);
    }
  } else {
    await refreshMonthSelect(currentMonthKey);
  }

  await renderMonthListIndividual();
}
