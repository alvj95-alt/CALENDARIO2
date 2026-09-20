/* TrenTurnos v5 — renderAll / renderToday (panel Horario y Hoy)
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function tramoHtml(t, diaN, ti){
  return `
  <div class="tramo">
    <div class="tren-chip">${t.tren}</div>
    <div class="estacion">${t.est}</div>
    <div class="timeline">
      <div class="tpoint start"><div class="lbl">Fichaje</div><div class="val">${t.CI}</div></div>
      <div class="arrow">›</div>
      <div class="tpoint"><div class="lbl">Salida</div><div class="val">${t.dep}</div></div>
      <div class="arrow">›</div>
      <div class="tpoint"><div class="lbl">Llegada</div><div class="val">${t.arr}</div></div>
      <div class="arrow">›</div>
      <div class="tpoint end"><div class="lbl">Fin turno</div><div class="val">${t.CO}</div></div>
    </div>
    <div class="tramo-companeros" data-tren="${t.tren}" data-dia="${diaN}" data-buscado="0"></div>
  </div>`;
}

function renderAll(diasData, meta){
  horarioActualDias = diasData;
  horarioActualMeta = meta;
  cont.innerHTML = '';
  let nServicio=0, nLibre=0, nReserva=0;

  diasData.forEach(d=>{
    if(d.tipo==='SERVICIO') nServicio++;
    if(d.tipo==='LIBRE') nLibre++;
    if(d.tipo==='RESERVA') nReserva++;

    const wrap = document.createElement('div');
    wrap.className = 'day';

    let badgeHtml = '', summaryHtml = '', bodyHtml = '';

    if(d.tipo === 'LIBRE'){
      badgeHtml = `<span class="badge libre">Libre</span>`;
      summaryHtml = `<span class="summary-text">Día de descanso</span>`;
    } else if(d.tipo === 'RESERVA'){
      badgeHtml = `<span class="badge reserva">Reserva</span>`;
      summaryHtml = `<span class="summary-text">Disponible · ${d.HP||'00:00'} previstas</span>`;
      bodyHtml = `
        <div class="day-body reserva">
          <div class="day-head">
            <span class="badge reserva">Reserva</span>
            <span class="codigo">Disponible · ${d.HP||'00:00'} previstas</span>
          </div>
        </div>`;
    } else {
      const tramos = d.tramos || [];
      const primero = tramos[0] || {CI:'--:--'};
      const ultimo = tramos[tramos.length-1] || {CO:'--:--'};
      badgeHtml = `<span class="badge servicio">Servicio</span>`;
      summaryHtml = `<span class="summary-text">${primero.CI} – ${ultimo.CO} · ${tramos.length} tramo${tramos.length!==1?'s':''}</span>`;
      bodyHtml = `
        <div class="day-body">
          <div class="day-head">
            <span class="badge servicio">Servicio</span>
            <span class="codigo">${d.codigo||''}</span>
          </div>
          ${tramos.map((t,ti)=>tramoHtml(t, d.n, ti)).join('')}
          <div class="day-foot">
            <div>Horas efectivas: <b>${d.HE||'00:00'}</b></div>
            <div>Horas presencia: <b>${d.HP||'00:00'}</b></div>
            <div>HDJ: <b>${d.HDJ||'00:00'}</b></div>
          </div>
        </div>`;
    }

    const hasBody = d.tipo !== 'LIBRE';

    wrap.innerHTML = `
      <div class="day-head-row">
        <div class="day-marker">
          <div class="day-num">${d.n}</div>
          <div class="day-week">${d.d}</div>
        </div>
        <div class="day-summary">${badgeHtml}${summaryHtml}</div>
        ${hasBody ? chevronSvg : ''}
      </div>
      ${bodyHtml}
    `;

    if(hasBody){
      wrap.querySelector('.day-head-row').addEventListener('click', ()=>{
        wrap.classList.toggle('open');
        // NUEVO — "con quién viajas": al desplegar el día (y solo
        // entonces, bajo demanda — no para todo el mes de golpe), se
        // busca automáticamente en el Horario General quién más hace
        // cada tren de ese día. Se marca data-buscado="1" para no
        // repetir la búsqueda si se pliega y despliega otra vez.
        if(wrap.classList.contains('open')){
          wrap.querySelectorAll('.tramo-companeros[data-buscado="0"]').forEach(async function(cont){
            cont.dataset.buscado = '1';
            cont.innerHTML = '<div class="tc-cargando">🔍 Buscando compañeros...</div>';
            try{
              if(typeof window.asegurarHorarioGeneralCargado !== 'function' || typeof window.buscarCompanerosParaTrenDia !== 'function'){
                cont.innerHTML = '';
                return;
              }
              // FIX — Confirmado por Alex (mismo bug que en el
              // Calendario, misma causa): esta copia del acordeón
              // (Historial de Horario Individual) tampoco pasaba
              // ningún mes a asegurarHorarioGeneralCargado() — aquí
              // el mes real vive en currentMonthKey (ej. "MARZO
              // 2026"), no en un {anio,mes} ya hecho, así que se
              // convierte antes de pasarlo.
              var mesObjetivoHist = null;
              if(typeof currentMonthKey!=='undefined' && currentMonthKey){
                var partesMesHist = currentMonthKey.split(' ');
                var idxMesHist = MESES.findIndex(function(m){ return m.toUpperCase()===partesMesHist[0]; });
                if(idxMesHist>=0 && partesMesHist[1]){
                  mesObjetivoHist = {anio: parseInt(partesMesHist[1],10), mes: idxMesHist+1};
                }
              }
              var listo = await window.asegurarHorarioGeneralCargado(mesObjetivoHist);
              if(!listo){
                cont.innerHTML = '<div class="tc-vacio">Sin Horario General publicado todavía para buscar compañeros.</div>';
                return;
              }
              var tren = cont.dataset.tren, dia = cont.dataset.dia;
              var nombres = window.buscarCompanerosParaTrenDia(tren, dia) || [];
              if(!nombres.length){
                cont.innerHTML = '<div class="tc-vacio">Nadie más de tu base hace el tren '+tren+' ese día.</div>';
              } else {
                cont.innerHTML = '<div class="tc-tit">🧑‍🤝‍🧑 Viajas con:</div>'
                  + nombres.map(function(n){ return '<div class="tc-nombre">'+(n&&n.name?n.name:n)+_chipUmDhTexto(n&&n.tren, n&&n.cell)+'</div>'; }).join('');
              }
            }catch(errBuscarComp){
              cont.innerHTML = '<div class="tc-vacio">No se pudo buscar: '+(errBuscarComp&&errBuscarComp.message?errBuscarComp.message:String(errBuscarComp))+'</div>';
              console.warn('Error buscando compañeros automáticos:', errBuscarComp);
            }
          });
        }
      });
    }

    wrap.dataset.dayNum = d.n;
    cont.appendChild(wrap);
  });

  document.getElementById('cServicio').textContent = nServicio;
  document.getElementById('cLibre').textContent = nLibre;
  document.getElementById('cReserva').textContent = nReserva;

  if(meta){
    document.querySelector('.board-sub').textContent =
      (meta.empleado||'Empleado') + (meta.mes ? ('  —  ' + meta.mes) : '');
    document.querySelector('[data-stat="HE"]').textContent = meta.totalHE || '–';
    document.querySelector('[data-stat="HP"]').textContent = meta.totalHP || '–';
    // NUEVO — Confirmado por Alex: solo reflejado, sin cálculo propio.
    document.querySelector('[data-stat="HDJ"]').textContent = meta.totalHDJ || '–';
  }

  renderToday(diasData, meta);
}

function renderToday(diasData, meta){
  const now = new Date();
  let coincideMes = true;
  if(meta && meta.mes){
    const nombreMesActual = now.toLocaleString('es-ES',{month:'long'}).toUpperCase();
    coincideMes = meta.mes.toUpperCase().indexOf(nombreMesActual) !== -1 &&
                  meta.mes.indexOf(String(now.getFullYear())) !== -1;
  }
  const todayNum = coincideMes ? now.getDate() : null;
  const hoy = todayNum ? diasData.find(d=>d.n === todayNum) : null;

  todayWrap.style.display = 'block';

  if(!hoy){
    todayContent.innerHTML = `<div class="today-empty">No hay datos de hoy en el horario cargado (${meta && meta.mes ? meta.mes : 'sin mes detectado'}).</div>`;
    return;
  }

  if(hoy.tipo === 'LIBRE'){
    todayContent.innerHTML = `
      <div class="today-card">
        <div class="day-head">
          <span class="badge libre">Libre</span>
          <span class="codigo">Día ${hoy.n} · ${hoy.d} — día de descanso</span>
        </div>
      </div>`;
  } else if(hoy.tipo === 'RESERVA'){
    todayContent.innerHTML = `
      <div class="today-card">
        <div class="day-head">
          <span class="badge reserva">Reserva</span>
          <span class="codigo">Día ${hoy.n} · ${hoy.d} — disponible, ${hoy.HP||'00:00'} previstas</span>
        </div>
      </div>`;
  } else {
    todayContent.innerHTML = `
      <div class="today-card">
        <div class="day-head">
          <span class="badge servicio">Servicio</span>
          <span class="codigo">Día ${hoy.n} · ${hoy.d} — ${hoy.codigo}</span>
        </div>
        ${(hoy.tramos||[]).map(tramoHtml).join('')}
        <div class="day-foot">
          <div>Horas efectivas: <b>${hoy.HE||'00:00'}</b></div>
          <div>Horas presencia: <b>${hoy.HP||'00:00'}</b></div>
          <div>HDJ: <b>${hoy.HDJ||'00:00'}</b></div>
        </div>
      </div>`;
  }

  const rowAbajo = cont.querySelector(`.day[data-day-num="${todayNum}"]`);
  if(rowAbajo) rowAbajo.classList.add('is-today');
}
