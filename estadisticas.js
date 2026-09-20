/* TrenTurnos v5 — Estadísticas y Desglose Económico (TAS)
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function renderConceptosFijosStats(cajaFijos){
  if(!_rolVistaFijosStats) _rolVistaFijosStats = AJ.rol || 'tripulante';
  var rol = _rolVistaFijosStats;
  var y = statsM.getFullYear(), m = statsM.getMonth()+1;
  // Reutiliza _nominaConceptosFijos() tal cual, ya probada en Nómina
  // Estimada — no se reinventa el cálculo de Salario Base/Plus
  // Transporte/Plus Manutención/pagas extra.
  var fijos = _nominaConceptosFijos(rol, y, m);
  // NUEVO — Confirmado por Alex: por ahora, "Paga de Marzo" se deja en
  // 0€ en ESTA tarjeta concreta (no se toca _nominaConceptosFijos ni
  // Nómina Estimada, que siguen calculándola igual que siempre).
  fijos = fijos.map(function(f){
    if(f.label.indexOf('Paga de Marzo')===0) return {label:f.label, val:0};
    return f;
  });
  var totalFijos = fijos.reduce(function(s,f){return s+f.val;},0);

  var mv = _nominaValoresManuales;
  var ssPct = parseFloat(mv.ssPct)||0;
  var cuota = parseFloat(mv.cuotaSindical)||0;
  var irpfPct = parseFloat(mv.irpfPct)||0;
  var ss = Math.round(totalFijos*ssPct/100*100)/100;
  var irpf = Math.round(totalFijos*irpfPct/100*100)/100;
  var neto = Math.round((totalFijos-ss-cuota-irpf)*100)/100;

  var rolesBtn = [['auxiliar','Auxiliar'],['tripulante','Tripulante'],['jefe','Jefe Trip.']].map(function(r){
    return '<div class="rol-opt-stats'+(rol===r[0]?' on':'')+'" onclick="_rolVistaFijosStats=\''+r[0]+'\';renderConceptosFijosStats(document.getElementById(\'cs-fijos-box\'))">'+r[1]+'</div>';
  }).join('');

  var html = '<div class="acc-section" style="margin:0 0 10px;background:var(--s1);border:1px solid var(--div);border-radius:14px;overflow:hidden">'
    +'<div class="acc-head" style="cursor:pointer" onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
    +'<div class="acc-ico" style="background:rgba(37,99,235,.15);color:var(--acc3);font-size:15px">🧾</div>'
    +'<div style="flex:1;min-width:0"><div class="acc-title" style="font-size:12.5px">Conceptos Fijos</div>'
    +'<div style="font-size:9.5px;color:var(--tx3)">Salario Base, pluses...</div></div>'
    +'<div style="font-size:13px;font-weight:800;color:var(--green2);margin-right:6px">'+totalFijos.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</div>'
    +'<div class="acc-chev">›</div></div>'
    +'<div class="acc-body"><div class="acc-body-inner" style="padding:10px 15px 14px">'
    +'<div style="display:flex;gap:6px;padding:2px 0 10px">'+rolesBtn+'</div>';

  fijos.forEach(function(f){
    html += '<div class="cs-r"><span class="cl">'+f.label+'</span><span class="cv" style="font-weight:800">'+f.val.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';
  });

  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 4px;padding:10px 12px;background:var(--s2);border:1px solid var(--acc);border-radius:12px">'
    + '<span style="font-size:11px;font-weight:800;color:var(--acc2)">TOTAL BRUTO (fijo)</span>'
    + '<span style="font-size:15px;font-weight:900">'+totalFijos.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';

  html += '<div class="nom-row-manual"><div><div class="nom-row-label">✍️ Seg. Social (ponlo tú)</div><div class="nom-row-sub">% sobre el Bruto</div></div>'
    + '<div><input class="nom-input-mini" id="cs-fijos-ss" value="'+mv.ssPct+'" oninput="_actualizarConceptosFijosStats()"> %</div></div>';
  html += '<div class="nom-row-manual"><div><div class="nom-row-label">✍️ Cuota Sindical (ponlo tú)</div><div class="nom-row-sub">importe fijo</div></div>'
    + '<div><input class="nom-input-mini" id="cs-fijos-cuota" value="'+mv.cuotaSindical+'" oninput="_actualizarConceptosFijosStats()"> €</div></div>';
  html += '<div class="nom-row-manual"><div><div class="nom-row-label">✍️ IRPF (ponlo tú)</div><div class="nom-row-sub">% sobre el Bruto</div></div>'
    + '<div><input class="nom-input-mini" id="cs-fijos-irpf" value="'+mv.irpfPct+'" oninput="_actualizarConceptosFijosStats()"> %</div></div>';

  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 2px;padding:12px;background:linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.05));border:1px solid rgba(34,197,94,.4);border-radius:12px">'
    + '<span style="font-size:11.5px;font-weight:800;color:#4ade80">TOTAL NETO ESTIMADO (solo fijo)</span>'
    + '<span id="cs-fijos-neto" style="font-size:16px;font-weight:900">'+neto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';

  html += '<div class="cs-r cs-r-sub" style="color:var(--tx3);font-size:10px;margin-top:4px">Esto es solo la parte FIJA de la nómina (sin HTDL, Nocturnidad ni el resto de variables) — cambia el rol arriba para ver otra categoría, sin tocar tu propio perfil.</div>';

  html += '</div></div></div>';
  cajaFijos.innerHTML = html;
  cajaFijos.dataset.totalFijos = totalFijos;
}

// NUEVO — Confirmado por Alex: recalcular Neto en vivo al escribir en
// los 3 campos manuales, y guardar esos valores compartidos con
// Nómina Estimada (mismo localStorage, un solo sitio de verdad).
function _actualizarConceptosFijosStats(){
  var caja = document.getElementById('cs-fijos-box');
  if(!caja) return;
  var totalFijos = parseFloat(caja.dataset.totalFijos)||0;
  var ssPct = parseFloat((document.getElementById('cs-fijos-ss')||{}).value)||0;
  var cuota = parseFloat((document.getElementById('cs-fijos-cuota')||{}).value)||0;
  var irpfPct = parseFloat((document.getElementById('cs-fijos-irpf')||{}).value)||0;
  _nominaValoresManuales.ssPct = ssPct;
  _nominaValoresManuales.cuotaSindical = cuota;
  _nominaValoresManuales.irpfPct = irpfPct;
  _guardarNominaValoresManuales();
  var ss = Math.round(totalFijos*ssPct/100*100)/100;
  var irpf = Math.round(totalFijos*irpfPct/100*100)/100;
  var neto = Math.round((totalFijos-ss-cuota-irpf)*100)/100;
  var elNeto = document.getElementById('cs-fijos-neto');
  if(elNeto) elNeto.textContent = neto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
}

function renderStats(){
  var y=statsM.getFullYear(), m=statsM.getMonth()+1;
  document.getElementById('smlbl').textContent=MESES[m-1]+' '+y;
  var pref=y+'-'+pad(m);
  var ks=Object.keys(TV).filter(function(k){return k.startsWith(pref);});
  var ct={ordinario:0,reserva:0,descanso:0,baja:0,trabajado:0,comp:0,vacaciones:0};
  var ctParking=0; // NUEVO: contador de turnos "Parking" (CI<06:00 o CO>=23:30)
  // FIX: el día de "vuelta" de una pernocta (icono 🌙, tipo 'vuelta-pernocta')
  // y el día intermedio de una pernocta de 3 días ('pernocta3-intermedio')
  // antes no se contaban en ningún total porque no existían en este objeto.
  // Ahora se suman directamente al contador de 'ordinario' — son días de
  // trabajo real, igual que pedías, sin tocar cómo se guardan en TV[].
  ks.forEach(function(k){
    var t=TV[k];
    if(!t) return;
    if(t.tipo==='vuelta-pernocta' || t.tipo==='pernocta3-intermedio'){
      ct.ordinario++;
    } else if(ct[t.tipo]!==undefined){
      ct[t.tipo]++;
    }
    // Reutiliza esTurnoParking() ya existente — solo lectura, no altera el turno
    if(esTurnoParking(t)) ctParking++;
    // FIX — turnos adicionales (TV2) HTDL/Art.51-52 independientes del
    // principal (p.ej. "He trabajado este descanso" con el principal
    // en Ordinario): antes nunca se contaban aquí, así que un día así
    // no sumaba nada a "Trabajados" aunque sí fuera un HTDL real.
    if(TV2[k] && TV2[k].length){
      TV2[k].forEach(function(ex){
        if(ex && ex.independienteDeTipoPrincipal && (ex.tipo==='trabajado'||ex.tipo==='art5152')){
          ct.trabajado++;
        }
      });
    }
  });
  var e=calculateEarnings(ks);
  // APAGADO — Confirmado por Alex (Estilo A): el banner de "Tripulante/
  // Auxiliar" con las tarifas ya no se muestra — ocupaba espacio
  // arriba sin aportar mucho. Se deja el cálculo (rolCls/rolIco/etc.)
  // sin usar, por si algún día se quisiera recuperar; el contenedor
  // simplemente se deja vacío.
  var rolCls=AJ.rol==='tripulante'?'trip':'aux';
  var rolIco=AJ.rol==='tripulante'?'🚆':'🎫';
  var rolNom=AJ.rol==='tripulante'?'Tripulante':'Auxiliar';
  var rolCol=AJ.rol==='tripulante'?'var(--acc2)':'var(--amber2)';
  var _elRoleCard = document.getElementById('role-card');
  if(_elRoleCard) _elRoleCard.innerHTML = '';
  document.getElementById('sg').innerHTML=[
    {i:'🚂',v:ct.ordinario, l:'Ordinarios', c:'var(--c-ord)'},
    {i:'⏳',v:ct.reserva,   l:'Reservas',   c:'var(--c-res)'},
    {i:'🧘',v:ct.descanso,  l:'Descansos',  c:'var(--c-des)'},
    {i:'🏥',v:ct.baja,      l:'Bajas',      c:'var(--c-baj)'},
    {i:'💼',v:ct.trabajado, l:'Trabajados', c:'var(--c-tra)'},
    {i:'✈',v:ct.vacaciones, l:'Vacaciones', c:'var(--c-vac)'},
    {i:'🚗',v:ctParking,    l:'Parking',    c:'var(--amber2)'},
    {i:'⏱', v:e.totalHoras.toFixed(1)+'h', l:'Horas', c:'var(--acc2)'},
  ].map(function(x){
    return '<div class="sc" style="border-color:'+x.c+'33"><div class="sc-i">'+x.i+'</div>'
      +'<div class="sc-v" style="color:'+x.c+'">'+x.v+'</div>'
      +'<div class="sc-l">'+x.l+'</div></div>';
  }).join('');
  // ── BLOQUE DOP ANUAL — integrado en Stats ──
  var dopY = contarDOPAnio(y);
  var dopPct = Math.round((dopY.total / dopY.max) * 100);
  var dopCol = dopY.total >= dopY.max ? 'var(--red2)' : dopY.total >= 4 ? 'var(--amber2)' : 'var(--c-dop)';
  var dopMesesTxt = dopY.meses.length
    ? dopY.meses.map(function(mm){ return MESES_C[mm-1]; }).join(', ')
    : 'Ninguno';
  document.getElementById('sg').innerHTML += ''
    +'<div class="sc" style="grid-column:1/-1;border-color:'+dopCol+'33">'
    +'<div style="display:flex;align-items:center;gap:10px">'
    +'<div class="sc-i">⭐</div>'
    +'<div style="flex:1">'
    +'<div style="display:flex;justify-content:space-between;align-items:baseline">'
    +'<span style="font-size:11px;font-weight:800;color:var(--tx)">DOP '+y+'</span>'
    +'<span style="font-size:18px;font-weight:900;color:'+dopCol+';font-variant-numeric:tabular-nums">'
    +dopY.total+' <span style="font-size:12px;font-weight:600;color:var(--tx3)">/ '+dopY.max+'</span></span>'
    +'</div>'
    +'<div style="margin:6px 0 4px;height:6px;background:var(--div);border-radius:3px;overflow:hidden">'
    +'<div style="width:'+dopPct+'%;height:100%;background:'+dopCol+';border-radius:3px;transition:width .3s"></div>'
    +'</div>'
    +'<div style="font-size:9px;color:var(--tx3)">Meses usados: '+dopMesesTxt
    +' · <span style="color:'+dopCol+';font-weight:700">'+dopY.restantes+' disponible'+(dopY.restantes!==1?'s':'')+'</span></div>'
    +'</div></div></div>';

  var cs=document.getElementById('cs-box');
  var dT=function(d){return d.length?'<div class="cs-sub-detail">📅 '+d.join(', ')+'</div>':'';};
  // NUEVO — contador de zebra striping: alterna un fondo muy sutil en
  // las filas principales del desglose (no en las de detalle).
  var _rowIdx = 0;
  var row=function(lbl,val,colClass,dias){
    _rowIdx++;
    var alt = (_rowIdx%2===0) ? ' cs-r-alt' : '';
    return '<div class="cs-r'+alt+'" style="flex-direction:column;align-items:flex-start;gap:2px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;width:100%"><span class="cl">'+lbl+'</span>'
      +'<span class="cv '+(colClass||'')+'">'+val+'</span></div>'
      +dT(dias||[])+'</div>';
  };
  var des='', desNoc='', desRebase='', desTrasl='', desPlus='', desInfo='', desTotal='';
  if(e.totalHoras>0||e.totalBruto>0||ct.comp>0){
    des='';
    // NUEVO — HTDL como acordeón propio (antes vivía junto a
    // Nocturnidad bajo "Compensación económica"). Usa totalHTDLPuro
    // (sin Art.51/52 mezclado) y diasHTDLPuroDetail, expuestos por
    // el wrapper de Art.51/52 — así esta cifra es solo la de HTDL,
    // sin duplicar ni esconder el dinero de Art.51/52, que ahora
    // tiene su propio acordeón (#a5152-stats-box).
    var _totalHTDLSolo = e.totalHTDLPuro!=null ? e.totalHTDLPuro : e.totalHTDL;
    var _diasHTDLSolo = e.diasHTDLPuroDetail || e.diasHTDLdetail;
    des+='<div class="acc-section open" style="margin:0 0 10px;background:var(--s1);border:1px solid var(--div);border-radius:14px;overflow:hidden">'
      +'<div class="acc-head" style="cursor:pointer" onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
      +'<div class="acc-ico" style="background:rgba(217,119,6,.15);color:var(--amber2);font-size:15px">🏆</div>'
      +'<div style="flex:1;min-width:0"><div class="acc-title" style="font-size:12.5px">HTDL</div>'
      +(e.horasHTDL>0?'<div style="font-size:9.5px;color:var(--tx3)">'+e.horasHTDL.toFixed(2)+'h este mes</div>':'')+'</div>'
      +'<div style="font-size:13px;font-weight:800;color:var(--green2);margin-right:6px">'
      +(_totalHTDLSolo>0?_totalHTDLSolo.toFixed(2)+' €':(e.totalHoras>0?'En nómina':''))+'</div>'
      +'<div class="acc-chev">›</div></div>'
      +'<div class="acc-body"><div class="acc-body-inner" style="padding:8px 15px 12px">';
    if(_totalHTDLSolo>0){
      des+=row('⏱ HTDL ('+e.horasHTDL.toFixed(2)+'h × '+e.HTDL.toFixed(2)+'€)',
        _totalHTDLSolo.toFixed(2)+' €','cv-info',e.diasHTDL);
      // Desglose por día HTDL: mismo día → ida + escala + vuelta; pernocta → ida+vuelta
      if(_diasHTDLSolo&&_diasHTDLSolo.length){
        _diasHTDLSolo.forEach(function(d){
          // NUEVO — pernocta con fecha de vuelta conocida: ida y vuelta
          // van en líneas separadas, cada una con su fecha real, más
          // una línea de total combinando ambas fechas.
          if(d.esPernocta && d.lblVuelta){
            if(d.hIda>0 || d.hContinuidad>0){
              var partesIda=[];
              if(d.hIda>0) partesIda.push(d.hIda.toFixed(2)+'h ida');
              if(d.hContinuidad>0) partesIda.push(d.hContinuidad.toFixed(2)+'h continuidad');
              var hIdaTotal = Math.round(((d.hIda||0)+(d.hContinuidad||0))*100)/100;
              des+='<div class="cs-r cs-r-sub">'
                +'<span class="cl">🚂 IDA · '+d.lbl+(d.tren?' · Tren #'+d.tren:'')+'</span>'
                +'<span class="cv cv-info">'+partesIda.join(' + ')+(partesIda.length>1?' = '+hIdaTotal.toFixed(2)+'h':'')+'</span></div>';
            }
            var hVueltaTotal = Math.round(((d.hVuelta||0)+(d.hContinuidadVuelta||0)+(d.hRetT2||0))*100)/100;
            if(hVueltaTotal>0){
              var partesVuelta=[];
              if(d.hVuelta>0) partesVuelta.push(d.hVuelta.toFixed(2)+'h vuelta');
              if(d.hContinuidadVuelta>0) partesVuelta.push(d.hContinuidadVuelta.toFixed(2)+'h continuidad');
              if(d.hRetT2>0) partesVuelta.push('+'+d.hRetT2.toFixed(2)+'h retraso');
              des+='<div class="cs-r cs-r-sub">'
                +'<span class="cl">↩ VUELTA · '+d.lblVuelta+'</span>'
                +'<span class="cv cv-info">'+partesVuelta.join(' + ')+(partesVuelta.length>1?' = '+hVueltaTotal.toFixed(2)+'h':'')+'</span></div>';
            }
            des+='<div class="cs-r cs-r-sub" style="opacity:.85">'
              +'<span class="cl"><strong>Total '+d.lbl+' + '+d.lblVuelta+'</strong></span>'
              +'<span class="cv cv-info"><strong>'+d.hTotal.toFixed(2)+'h'+(d.importe>0?' · '+d.importe.toFixed(2)+' €':'')+'</strong></span></div>';
            return;
          }
          var partes=[];
          if(d.hIda>0) partes.push(d.hIda.toFixed(2)+'h ida');
          if(d.hEscala>0) partes.push(d.hEscala.toFixed(2)+'h escala');
          if(d.hContinuidad>0) partes.push(d.hContinuidad.toFixed(2)+'h continuidad');
          if(d.hVuelta>0) partes.push(d.hVuelta.toFixed(2)+'h vuelta');
          if(d.hContinuidadVuelta>0) partes.push(d.hContinuidadVuelta.toFixed(2)+'h continuidad vuelta');
          if(d.hRetT2>0) partes.push('+'+d.hRetT2.toFixed(2)+'h retraso');
          var detalleTxt = partes.length ? partes.join(' + ')+' = '+d.hTotal.toFixed(2)+'h' : d.hTotal.toFixed(2)+'h';
          if(d.importe>0) detalleTxt += ' · '+d.importe.toFixed(2)+' €';
          des+='<div class="cs-r cs-r-sub">'
            +'<span class="cl">'
            +d.lbl+(d.tren?' · Tren #'+d.tren:'')+'</span>'
            +'<span class="cv cv-info">'
            +detalleTxt+'</span></div>';
        });
      }
    }
    else if(e.totalHoras>0)
      des+='<div class="cs-r"><span class="cl cv-muted">⏱ Horas ordinarias ('+e.totalHoras.toFixed(1)+'h)</span><span class="cv cv-muted">En nómina</span></div>';
    // "Impacto Económico por Enlaces" se queda dentro de HTDL — es
    // parte del mismo cómputo de HTDL, no de Art.51/52 ni Nocturnidad.
    // e.totalHTDLPuro ya incluye este importe (no se duplica el
    // dinero); esto es solo para que se vea desglosado.
    if(e.impactoEnlacesImporte>0){
      des+=row('🔗 Impacto Económico por Enlaces ('+e.impactoEnlacesHoras.toFixed(2)+'h)',
        e.impactoEnlacesImporte.toFixed(2)+' €','cv-warn',[]);
      e.impactoEnlacesDetalle.forEach(function(d){
        des+='<div class="cs-r cs-r-sub">'
          +'<span class="cl">'+d.fecha+(d.tren?' · Tren #'+d.tren:'')+'</span>'
          +'<span class="cv cv-warn">'+d.horas.toFixed(2)+'h · '+d.importe.toFixed(2)+' €</span></div>';
      });
    }
    des+='</div></div></div>'; // cierre acc-body-inner + acc-body + acc-section (HTDL)

    // NUEVO — Nocturnidad, acordeón propio (#cs-noc-box), separado de
    // HTDL. Mismo cálculo/desglose de siempre, solo en su propio
    // contenedor.
    if(e.totalNoc>0){
      desNoc='<div class="acc-section" style="margin:0 0 10px;background:var(--s1);border:1px solid var(--div);border-radius:14px;overflow:hidden">'
        +'<div class="acc-head" style="cursor:pointer" onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
        +'<div class="acc-ico" style="background:rgba(139,92,246,.15);color:var(--violet2);font-size:15px">🌙</div>'
        +'<div style="flex:1;min-width:0"><div class="acc-title" style="font-size:12.5px">Nocturnidad</div>'
        +(e.NOC>0?'<div style="font-size:9.5px;color:var(--tx3)">'+(e.totalNoc/e.NOC).toFixed(2)+'h este mes</div>':'')+'</div>'
        +'<div style="font-size:13px;font-weight:800;color:var(--green2);margin-right:6px">'+e.totalNoc.toFixed(2)+' €</div>'
        +'<div class="acc-chev">›</div></div>'
        +'<div class="acc-body"><div class="acc-body-inner" style="padding:8px 15px 12px">';
      if(e.diasNocDetail&&e.diasNocDetail.length){
        e.diasNocDetail.forEach(function(d){
          if(typeof d!=='object') return;
          desNoc+='<div class="cs-r cs-r-sub" style="flex-direction:column;gap:1px">';
          desNoc+='<div style="display:flex;justify-content:space-between;align-items:center;width:100%">';
          desNoc+='<span class="cl">🌙 '+d.lbl+(d.tren?' · #'+d.tren:'')+'</span>';
          desNoc+='<span class="cv cv-muted">'+d.hNoc.toFixed(2)+'h · <span class="cv-warn" style="font-weight:800">'+d.importe.toFixed(2)+'€</span></span>';
          desNoc+='</div>';
          var tramosTxt=[];
          if(d.hF1&&d.hL1) tramosTxt.push(d.hF1+' → '+d.hL1);
          if(d.hF2&&d.hL2) tramosTxt.push(d.hF2+' → '+d.hL2);
          if(tramosTxt.length){
            desNoc+='<div class="cs-sub-detail">'+tramosTxt.join(' · ')+'</div>';
          }
          desNoc+='</div>';
        });
      }
      desNoc+='</div></div></div>';
    }

    // NUEVO — Confirmado por Alex (Art. 64 del Convenio): Rebase,
    // acordeón propio, mismo patrón que Nocturnidad.
    // NUEVO — Confirmado por Alex: Rebase y Plus Traslación se ocultan
    // para cualquier tripulante normal (todavía tienen un hueco de
    // horas sin explicar del todo frente a la nómina real) — solo el
    // administrador los sigue viendo aquí, con su propia etiqueta.
    var _esAdminVistaStats = !!(perfilAdminActual && perfilAdminActual.rol==='admin');
    if(_esAdminVistaStats && e.totalRebase>0){
      desRebase='<div class="acc-section" style="margin:0 0 10px;background:var(--s1);border:1px solid var(--div);border-radius:14px;overflow:hidden">'
        +'<div class="acc-head" style="cursor:pointer" onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
        +'<div class="acc-ico" style="background:transparent;font-size:18px">⏫</div>'
        +'<div class="acc-title">Rebase <span style="font-size:9px;font-weight:900;background:var(--amber);color:#1a1400;padding:2px 7px;border-radius:20px;margin-left:4px">SOLO ADMIN</span></div>'
        +'<div style="font-size:13px;font-weight:800;color:var(--green2);margin-right:6px">'+e.totalRebase.toFixed(2)+' €</div>'
        +'<div class="acc-chev">›</div></div>'
        +'<div class="acc-body"><div class="acc-body-inner" style="padding:8px 15px 12px">'
        +'<div class="cs-r cs-r-sub" style="color:var(--tx3);font-size:10.5px">Horas que exceden de la 9ª hora del día natural (Art. 64) — sin restar aún Presencia/Extraordinarias del mismo mes.</div>';
      if(e.diasRebaseDetail&&e.diasRebaseDetail.length){
        e.diasRebaseDetail.forEach(function(d){
          desRebase+='<div class="cs-r cs-r-sub"><span class="cl">⏫ '+d.lbl+(d.tren?' · #'+d.tren:'')+'</span>'
            +'<span class="cv cv-muted">'+d.horas.toFixed(2)+'h · <span class="cv-warn" style="font-weight:800">'+d.importe.toFixed(2)+'€</span></span></div>';
        });
      }
      desRebase+='</div></div></div>';
    }

    // NUEVO — Confirmado por Alex (Art. 58 del Convenio): Plus
    // Traslación, acordeón propio, mismo patrón que Nocturnidad.
    if(_esAdminVistaStats && e.totalPlusTrasl>0){
      desTrasl='<div class="acc-section" style="margin:0 0 10px;background:var(--s1);border:1px solid var(--div);border-radius:14px;overflow:hidden">'
        +'<div class="acc-head" style="cursor:pointer" onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
        +'<div class="acc-ico" style="background:transparent;font-size:18px">🧳</div>'
        +'<div class="acc-title">Plus Traslación <span style="font-size:9px;font-weight:900;background:var(--amber);color:#1a1400;padding:2px 7px;border-radius:20px;margin-left:4px">SOLO ADMIN</span></div>'
        +'<div style="font-size:13px;font-weight:800;color:var(--green2);margin-right:6px">'+e.totalPlusTrasl.toFixed(2)+' €</div>'
        +'<div class="acc-chev">›</div></div>'
        +'<div class="acc-body"><div class="acc-body-inner" style="padding:8px 15px 12px">'
        +'<div class="cs-r cs-r-sub" style="color:var(--tx3);font-size:10.5px">1€/hora que exceda de las 8 primeras horas de descanso fuera de base, en pernocta (Art. 58).</div>';
      if(e.diasPlusTraslDetail&&e.diasPlusTraslDetail.length){
        e.diasPlusTraslDetail.forEach(function(d){
          desTrasl+='<div class="cs-r cs-r-sub"><span class="cl">🧳 '+d.lbl+(d.tren?' · #'+d.tren:'')+'</span>'
            +'<span class="cv cv-muted">'+d.horas.toFixed(2)+'h · <span class="cv-warn" style="font-weight:800">'+d.importe.toFixed(2)+'€</span></span></div>';
        });
      }
      desTrasl+='</div></div></div>';
    }

    // Pluses — acordeón propio (#cs-pluses-box), renombrado (ya no
    // dice "y compensación en días": esa línea era confusa porque no
    // tenía nada que ver con dinero — se movió al acordeón "Días de
    // descanso (compensación)").
    var _subtotalPlus = Math.round(((e.totalAct||0)+(e.totalJT||0)+(e.totalIntl||0))*100)/100;
    if(_subtotalPlus>0){
      desPlus='<div class="acc-section" style="margin:0 0 10px;background:var(--s1);border:1px solid var(--div);border-radius:14px;overflow:hidden">'
        +'<div class="acc-head" style="cursor:pointer" onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
        +'<div class="acc-ico" style="background:transparent;font-size:18px">✅</div>'
        +'<div class="acc-title">Pluses</div>'
        +'<div style="font-size:13px;font-weight:800;color:var(--green2);margin-right:6px">'+_subtotalPlus.toFixed(2)+' €</div>'
        +'<div class="acc-chev">›</div></div>'
        +'<div class="acc-body"><div class="acc-body-inner" style="padding:8px 15px 12px">';
      if(e.totalAct>0)  desPlus+=row('✅ Plus Activación (×'+e.diasAct.length+')',e.totalAct.toFixed(2)+' €','cv-pos',e.diasAct);
      if(e.totalJT>0)   desPlus+=row('✅ Plus JT (×'+e.diasJT.length+')',e.totalJT.toFixed(2)+' €','cv-pos',e.diasJT);
      if(e.totalIntl>0) desPlus+=row('🌍 Plus Internacional (×'+e.diasIntl.length+')',e.totalIntl.toFixed(2)+' €','cv-cyan',e.diasIntl);
      desPlus+='</div></div></div>';
    }

    // NUEVO — se adelantan estos dos cálculos (antes vivían más abajo,
    // dentro del cuerpo) para poder mostrar el conteo total de avisos
    // en la cabecera del acordeón "Información adicional" antes de
    // imprimir su contenido. Es el mismo cálculo exacto, solo movido.
    var notasMes=[];
    ks.forEach(function(k){
      var t=TV[k];
      if(t&&t.notas&&t.notas.trim().length>0){
        var _kn=k.split('-');var dN2=parseInt(_kn[2])+' '+MESES_C[parseInt(_kn[1])-1];
        notasMes.push({lbl:dN2, tipo:(TIPO_INFO[t.tipo]?TIPO_INFO[t.tipo].ico:'📋'), nota:t.notas.trim()});
      }
    });
    var parkingMes=[];
    ks.forEach(function(k){
      var t=TV[k];
      if(t && esTurnoParking(t)){
        var _kp=k.split('-');var dP=parseInt(_kp[2])+' '+MESES_C[parseInt(_kp[1])-1];
        var ci=t.hF, co=t.hL2||t.hL;
        var motivo=[];
        if(ci && parseInt(ci.split(':')[0])<6) motivo.push('entra '+ci);
        if(co && (parseInt(co.split(':')[0])>23 || (parseInt(co.split(':')[0])===23 && parseInt(co.split(':')[1])>=30))) motivo.push('llega '+co);
        parkingMes.push({lbl:dP, tren:t.numTren||t.numTrenVuelta||'', motivo:motivo.join(' · ')});
      }
    });
    var _totalAvisos = (e.retrasos?e.retrasos.length:0) + notasMes.length + parkingMes.length;
    if(_totalAvisos>0){
      desInfo='<div class="acc-section" style="margin:0 0 10px;background:var(--s1);border:1px solid var(--div);border-radius:14px;overflow:hidden">'
        +'<div class="acc-head" style="cursor:pointer" onclick="this.closest(\'.acc-section\').classList.toggle(\'open\')">'
        +'<div class="acc-ico" style="background:rgba(244,63,94,.15);color:#fda4af;font-size:15px">📋</div>'
        +'<div style="flex:1;min-width:0"><div class="acc-title" style="font-size:12.5px">Información adicional</div>'
        +'<div style="font-size:9.5px;color:var(--tx3)">Avisos del mes</div></div>'
        +'<div style="font-size:12px;font-weight:700;color:var(--red2);margin-right:6px">'
        +_totalAvisos+' aviso'+(_totalAvisos>1?'s':'')+'</div>'
        +'<div class="acc-chev">›</div></div>'
        +'<div class="acc-body"><div class="acc-body-inner" style="padding:8px 15px 12px">';
      // Retrasos del mes
      if(e.retrasos&&e.retrasos.length){
        desInfo+='<div class="cr-div" style="margin:4px 0"></div>'
          +'<div class="cs-r"><span class="cl cv-warn" style="font-weight:800">⚠️ Retrasos del mes</span>'
          +'<span class="cv cv-warn">'+e.retrasos.length+' registrado'+(e.retrasos.length>1?'s':'')+'</span></div>';
        e.retrasos.forEach(function(r){
          // MÓDULO C: Impacto económico SI/NO según tramo y tipo compensación
          // FIX — en pernocta, el tramo 1 (ida) TAMBIÉN es económico si su
          // retraso forma parte de un enlace de jornada real (8h de
          // descanso incumplidas) — antes se etiquetaba siempre como
          // "informativo" aunque ya estuviera generando dinero por el
          // bloque de descanso interno de pernocta.
          var impacta=r.esHTDL&&(r.tramo===2||(r.tramo===1&&r.esEnlacePernocta));
          var impEco=impacta?Math.round((r.minutos/60)*e.HTDL*100)/100:0;
          desInfo+='<div class="cs-r cs-r-sub" style="flex-wrap:wrap">';
          desInfo+='<span class="cl">';
          desInfo+=r.fecha+(r.tren||r.numTren?' · #'+(r.tren||r.numTren):'')+(r.tramo>0?' · T'+r.tramo:'')+'</span>';
          desInfo+='<span class="cv cv-warn">+'+r.minutos+'min';
          if(impacta) desInfo+=' · <strong class="cv-pos">+'+impEco.toFixed(2)+'€ HTDL</strong>';
          else        desInfo+=' · <span class="cv-muted">informativo</span>';
          desInfo+='</span></div>';
        });
      }
      // NOTAS DEL MES — muestra turnos que tienen nota escrita
      // (notasMes ya se calculó arriba, antes de la cabecera del acordeón)
      if(notasMes.length){
        desInfo+='<div class="cr-div" style="margin:4px 0"></div>';
        desInfo+='<div class="cs-r"><span class="cl cv-accent" style="font-weight:800">📝 Notas del mes</span>'
          +'<span class="cv cv-accent">'+notasMes.length+' turno'+(notasMes.length>1?'s':'')+'</span></div>';
        notasMes.forEach(function(n){
          desInfo+='<div class="cs-r cs-r-sub" style="flex-direction:column;align-items:flex-start;gap:2px">'
            +'<span class="cl">'+n.tipo+' '+n.lbl+'</span>'
            +'<span class="cs-sub-detail" style="padding-left:0;color:var(--tx2)">'+n.nota+'</span>'
            +'</div>';
        });
      }
      // TURNOS PARKING DEL MES — (parkingMes ya se calculó arriba)
      if(parkingMes.length){
        desInfo+='<div class="cr-div" style="margin:4px 0"></div>';
        desInfo+='<div class="cs-r"><span class="cl cv-warn" style="font-weight:800">🚗 Turnos Parking del mes</span>'
          +'<span class="cv cv-warn">'+parkingMes.length+' turno'+(parkingMes.length>1?'s':'')+'</span></div>';
        parkingMes.forEach(function(p){
          desInfo+='<div class="cs-r cs-r-sub">'
            +'<span class="cl">🚗 '+p.lbl+(p.tren?' · Tren #'+p.tren:'')+'</span>'
            +'<span class="cv cv-warn">'+p.motivo+'</span>'
            +'</div>';
        });
      }
      desInfo+='</div></div></div>'; // cierre acc-body-inner + acc-body + acc-section (Información adicional)
    }

    // ACTUALIZADO — bloque final destacado "Total a Pagar (Mes
    // Vencido)", ahora en su propio contenedor fijo (#cs-total-pagar-box)
    // que va DESPUÉS de todo lo demás (HTDL, Art.51/52, Nocturnidad,
    // Pluses, Días de descanso, Información adicional), como se pidió.
    // Sigue usando exactamente el mismo e.totalBruto de siempre
    // (tH+tN+tA+tJ+tI, ya calculado por calculateEarnings sin tocar)
    // — solo cambia dónde y cuándo se pinta, no la suma.
    if(e.totalBruto>0){
      desTotal='<div class="acc-section" style="margin:0 0 10px;background:linear-gradient(135deg,rgba(34,197,94,.14),rgba(34,197,94,.05));border:1px solid rgba(74,222,128,.4);border-radius:14px;overflow:hidden">'
        +'<div class="acc-head" style="cursor:default">'
        +'<div class="acc-ico" style="background:rgba(34,197,94,.2);color:#4ade80;font-size:15px">💶</div>'
        +'<div style="flex:1;min-width:0"><div class="acc-title" style="font-size:12.5px;color:#bbf7d0">Total a pagar</div>'
        +'<div style="font-size:9.5px;color:var(--tx3)">Mes vencido · estimado</div></div>'
        +'<div style="font-size:15px;font-weight:900;color:#4ade80">'+e.totalBruto.toFixed(2)+' €</div>'
        +'</div></div>';
    }
  }
  cs.innerHTML=des;
  document.getElementById('cs-noc-box').innerHTML=desNoc;
  document.getElementById('cs-rebase-box').innerHTML=desRebase;
  document.getElementById('cs-plustrasl-box').innerHTML=desTrasl;
  // QUITADO — Confirmado por el usuario: "Conceptos Fijos de Nómina"
  // ya no se pinta aquí en Stats (`cs-fijos-box` no existe), porque
  // ahora vive en la pantalla de Nómina. La función renderConceptosFijosStats()
  // se deja sin usar, por si se necesita en el futuro.
  document.getElementById('cs-pluses-box').innerHTML=desPlus;
  document.getElementById('cs-info-adicional-box').innerHTML=desInfo;
  document.getElementById('cs-total-pagar-box').innerHTML=desTotal;

  // QUITADO — la Auditoría de Horas se movió a Nómina (renderNominaPublica);
  // ya no se llama aquí.

  // QUITADO — la Comparativa con Cómputo Excel también se movió a
  // Nómina (renderNominaPublica); ya no se llama aquí.
}

function chSM(d){statsM.setMonth(statsM.getMonth()+d);renderStats();}
