/* TrenTurnos v5 — Pantalla pública de Nómina, aviso legal y cálculo en vivo
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
 // mes que se está VIENDO (el mes en que se cobra la nómina)

function chNomM(delta){
  if(!nomM) nomM = new Date();
  nomM = new Date(nomM.getFullYear(), nomM.getMonth()+delta, 1);
  renderNominaPublica();
}

// NUEVO — Confirmado por el usuario: los tres apartados "para
// comprobarlo mejor" (Auditoría de Horas, Excel oficial, Nómina Real)
// empiezan cerrados, para que la pantalla principal quede simple.
// Cada botón abre/cierra SOLO el suyo (no acordeón — pueden estar
// varios abiertos a la vez sin problema).
function _nominaToggleExtra(id){
  var el = document.getElementById(id);
  if(!el) return;
  var abierto = el.style.display !== 'none';
  el.style.display = abierto ? 'none' : 'block';
  var arr = document.getElementById('arr-'+id);
  if(arr) arr.textContent = abierto ? '›' : '⌄';
}

// Suma el importe en dinero de los registros de Art.51/52 (Dinero puro
// y la parte Dinero de un Mix) dentro de un conjunto de claves de día
// — mismo criterio que ya usa _renderArt5152Stats() en Stats.
function _nominaArt5152Importe(ks){
  var total = 0;
  ks.forEach(function(k){
    var t = TV[k];
    if(t && t.tipo==='art5152'){
      if(t.compensacion==='dinero') total += calcImporteArt5152Vivo(t, false);
      else if(t.compensacion==='mix') total += calcImporteArt5152Vivo(t, true);
    }
  });
  return Math.round(total*100)/100;
}

function renderNominaPublica(){
  var body = document.getElementById('nomina-pub-body');
  if(!body) return;
  if(!nomM) nomM = new Date();
  var anio = nomM.getFullYear(), mes = nomM.getMonth()+1; // 1-12, mes que se cobra
  document.getElementById('nom-pub-mlbl').textContent = MESES[mes-1]+' '+anio;

  var rol = AJ.rol || 'tripulante';
  var t = TARIFAS_ROL[rol] || TARIFAS_ROL.tripulante;

  // Conceptos fijos del mes que se está viendo — SIN retraso.
  var fijos = _nominaConceptosFijos(rol, anio, mes);
  var tieneCAPH = !!AJ.tieneCAPH && parseFloat(AJ.caphImporte)>0;
  if(tieneCAPH){
    fijos.push({label:'Complemento Ad Personam (CAPH)', val: Math.round(parseFloat(AJ.caphImporte)*100)/100});
  }
  var totalFijos = fijos.reduce(function(s,f){ return s+f.val; }, 0);

  // Variables: se pagan a mes vencido — lo trabajado el mes ANTERIOR
  // es lo que se cobra en la nómina de este mes.
  var mesTrabajado = _nominaMesAnterior(anio, mes);
  var ks = Object.keys(TV).filter(function(k){
    var d = new Date(k+'T00:00:00');
    return d.getFullYear()===mesTrabajado.anio && d.getMonth()===mesTrabajado.mes-1;
  });
  var earn = calculateEarnings(ks);
  var htdlPuro = _nominaHTDLPuro(ks, t.vh);
  var art5152Importe = _nominaArt5152Importe(ks);
  // FIX — Confirmado por el usuario: Rebase (Art. 64) y Plus Traslación
  // (Art. 58) ya se calculaban desde hace tiempo (calculateEarnings ya
  // los daba), pero se quedaban ocultos "solo Admin" en Stats porque
  // no se habían verificado contra una nómina real todavía. Ya se
  // comprobó con el PDF real de agosto — Plus Traslación coincidió
  // exacto (20,93 € en los dos sitios) — así que ahora se muestran
  // para todo el mundo en Nómina, y SÍ entran en el Total Bruto.
  var totalVariablesResto = earn.totalNoc + earn.totalAct + earn.totalJT + earn.totalIntl + earn.totalRebase + earn.totalPlusTrasl;

  // QUITADO — Confirmado por el usuario: Hora Extraordinaria y el campo
  // manual de días COMPE ya no van aquí. La referencia ajustada por
  // días COMPE sigue existiendo, pero ahora solo se usa de forma
  // informativa en la Auditoría de Horas (más abajo en esta misma
  // pantalla), no para calcular ningún pago.
  var bruto = Math.round((totalFijos + htdlPuro.importe + art5152Importe + totalVariablesResto)*100)/100;

  var mv = _nominaValoresManuales;
  var ssImporte = Math.round(bruto*mv.ssPct/100*100)/100;
  var irpfImporte = Math.round(bruto*mv.irpfPct/100*100)/100;
  var neto = Math.round((bruto - ssImporte - mv.cuotaSindical - irpfImporte)*100)/100;

  var html = '<div class="nom-disclaimer">🧪 Estimación orientativa a partir de tu calendario — no sustituye tu nómina real.</div>';

  // NUEVO — Confirmado por el usuario: formato "paso a paso", pensado
  // para que también lo entienda gente mayor — un paso a la vez, con
  // palabras normales en el título y los nombres reales del convenio
  // dentro de cada tarjeta (sin perder precisión, solo ordenado mejor).

  // Paso 1 — Conceptos fijos
  html += '<div class="ns-step"><div class="ns-line"><div class="ns-num n1">1</div><div class="ns-connector"></div></div>'
    + '<div class="ns-body">'
    + '<div class="ns-tit">Tu sueldo fijo</div>'
    + '<div class="ns-sub">Esto lo cobras todos los meses, siempre igual</div>'
    + '<div class="ns-card">';
  fijos.forEach(function(f){
    html += '<div class="ns-row"><span class="ns-row-lbl">'+f.label+'</span><span class="ns-row-val">'+f.val.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';
  });
  html += '</div>';
  if(!tieneCAPH){
    html += '<div class="nom-caph-hint" onclick="goP(\'ajustes\');abrirAjEconomia()">'
      + '¿Tienes <b>Complemento Ad Personam (CAPH)</b>? Actívalo y ponlo desde <u>Ajustes → Economía</u> y aparecerá aquí.'
      + '</div>';
  }
  html += '</div></div>';

  // Paso 2 — Variables (mes vencido)
  html += '<div class="ns-step"><div class="ns-line"><div class="ns-num n2">2</div><div class="ns-connector"></div></div>'
    + '<div class="ns-body">'
    + '<div class="ns-tit">+ Lo que trabajaste de más</div>'
    + '<div class="ns-sub">De '+MESES[mesTrabajado.mes-1]+' — se cobra un mes después</div>'
    + '<div class="ns-card">'
    + '<div class="ns-row"><span class="ns-row-lbl">🏆 HTDL <small>(días libres trabajados)</small></span><span class="ns-row-val">'+htdlPuro.importe.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
    + '<div class="ns-row"><span class="ns-row-lbl">🌙 Nocturnidad <small>(horas de noche)</small></span><span class="ns-row-val">'+earn.totalNoc.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
    + '<div class="ns-row"><span class="ns-row-lbl">📄 Art. 51-52 <small>(cambios de descanso)</small></span><span class="ns-row-val">'+art5152Importe.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
    + '<div class="ns-row"><span class="ns-row-lbl">🔘 Plus Activación</span><span class="ns-row-val">'+earn.totalAct.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
    + '<div class="ns-row"><span class="ns-row-lbl">👔 Plus JT</span><span class="ns-row-val">'+earn.totalJT.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
    + '<div class="ns-row"><span class="ns-row-lbl">🌍 Plus Internacional</span><span class="ns-row-val">'+earn.totalIntl.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
    + '<div class="ns-row"><span class="ns-row-lbl">⏫ Hora Rebase <small>(pasada la 9ª hora del día)</small></span><span class="ns-row-val">'+earn.totalRebase.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
    + '<div class="ns-row"><span class="ns-row-lbl">🧳 Plus Traslación <small>(descanso fuera de base)</small></span><span class="ns-row-val">'+earn.totalPlusTrasl.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
    + '</div></div></div>';

  // Paso 3 — Deducciones (editables)
  html += '<div class="ns-step"><div class="ns-line"><div class="ns-num n3">3</div><div class="ns-connector"></div></div>'
    + '<div class="ns-body">'
    + '<div class="ns-tit">− Lo que te descuentan</div>'
    + '<div class="ns-sub">Esto puede variar cada mes — pon tú los números si los conoces</div>'
    + '<div class="ns-card">'
    + '<div class="ns-row"><span class="ns-row-lbl">Seg. Social</span><span class="ns-row-val"><input class="ns-mini-inp" id="nompub-ss-pct" value="'+mv.ssPct+'" oninput="_nominaPubActualizarManual()">%</span></div>'
    + '<div class="ns-row"><span class="ns-row-lbl">IRPF</span><span class="ns-row-val"><input class="ns-mini-inp" id="nompub-irpf-pct" value="'+mv.irpfPct+'" oninput="_nominaPubActualizarManual()">%</span></div>'
    + '<div class="ns-row"><span class="ns-row-lbl">Cuota Sindical</span><span class="ns-row-val"><input class="ns-mini-inp" id="nompub-cuota" value="'+mv.cuotaSindical+'" oninput="_nominaPubActualizarManual()">€</span></div>'
    + '</div></div></div>';

  // Paso 4 — Total final
  html += '<div class="ns-step"><div class="ns-line"><div class="ns-num n4">4</div></div>'
    + '<div class="ns-body" style="padding-bottom:0">'
    + '<div class="ns-tit">= Lo que te queda</div>'
    + '<div class="ns-final">'
    + '<div class="ns-final-lbl">Vas a cobrar aproximadamente</div>'
    + '<div class="ns-final-val" id="nompub-neto-val">'+neto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</div>'
    + '</div></div></div>';

  // NUEVO — Confirmado por Alex: nota aparte (no el disclaimer legal
  // de arriba, que habla de responsabilidad) explicando POR QUÉ el
  // estimado puede no cuadrar — todavía faltan variables por agregar
  // al cálculo que la Nómina Real (de abajo) ya trae calculadas.
  html += '<div class="nom-nota-precision">📐 Este cálculo todavía no es 100% exacto: faltan por incorporar algunas variables que tu nómina real ya trae calculadas (por ejemplo Rebase, Plus Traslación u otros pluses puntuales). Usa "Comparar con tu nómina real", más abajo, para comprobarlo.</div>';

  window._nominaPubBruto = bruto;
  body.innerHTML = html;

  // MOVIDO — Confirmado por el usuario: Auditoría de Horas, antes en
  // Stats, ahora vive aquí. Puramente informativa — no toca el Bruto/
  // Neto de arriba. renderAuditoriaHoras() ya calcula el mes trabajado
  // por su cuenta a partir de nomM, así que no hace falta pasarle nada.
  renderAuditoriaHoras();

  // MOVIDO — Confirmado por el usuario: Comparativa con Cómputo Excel,
  // justo debajo de la Auditoría de Horas. También decide por sí sola
  // si mostrarse u ocultarse, según el mes trabajado de nomM.
  renderComparativaComputoExcel();

  // NUEVO — Nómina Real (PDF/foto), movida aquí abajo desde Stats →
  // Admin. Se indexa por el MISMO mes que se está viendo (el mes de
  // cobro), igual que hacía la versión de Admin con statsM — solo que
  // aquí usa nomM. No se compara nada automáticamente: se enseña tal
  // cual el PDF, debajo de la estimación, para que la persona compare
  // a simple vista.
  var wrapReal = document.getElementById('nomina-real-pub-wrap');
  if(wrapReal) wrapReal.innerHTML = _construirCardReal(anio, mes, 'publica');
}

// Recalcula Neto en vivo al tocar los campos de Seg. Social / IRPF /
// Cuota Sindical — comparte _nominaValoresManuales con la Nómina
// Estimada de Admin, así que cambiar un valor aquí también lo
// actualiza allí (es el mismo dato: TU situación personal).
function _nominaPubActualizarManual(){
  var bruto = window._nominaPubBruto; if(bruto===undefined) return;
  var ssPct = parseFloat(document.getElementById('nompub-ss-pct').value)||0;
  var irpfPct = parseFloat(document.getElementById('nompub-irpf-pct').value)||0;
  var cuota = parseFloat(document.getElementById('nompub-cuota').value)||0;
  _nominaValoresManuales.ssPct = ssPct;
  _nominaValoresManuales.irpfPct = irpfPct;
  _nominaValoresManuales.cuotaSindical = cuota;
  _guardarNominaValoresManuales();

  var ssImporte = Math.round(bruto*ssPct/100*100)/100;
  var irpfImporte = Math.round(bruto*irpfPct/100*100)/100;
  var neto = Math.round((bruto-ssImporte-cuota-irpfImporte)*100)/100;
  document.getElementById('nompub-neto-val').textContent = neto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
}

// Abre el acordeón "Economía" de Ajustes (usado por el enlace del
// aviso de CAPH dentro de Nómina, para llevar directo hasta el campo).
function abrirAjEconomia(){
  var acc = document.getElementById('aj-acc-economia');
  if(acc && !acc.classList.contains('aj-acc-open')) toggleAjAcc('aj-acc-economia');
}

// NUEVO — Aviso legal de Nómina: "esto no es una nómina real". Debe
// verse SIEMPRE la primera vez que se entra en Nómina cada día — se
// guarda solo la FECHA (no un "ya no mostrar nunca"), para que el
// recordatorio vuelva a aparecer al día siguiente.
function mostrarAvisoNominaSiCorresponde(){
  var hoy = new Date().toISOString().slice(0,10);
  var vistoHoy = false;
  try{ vistoHoy = localStorage.getItem('nomina_aviso_visto_fecha')===hoy; }catch(e){}
  if(vistoHoy) return;
  openOv('ov-aviso-nomina');
}
function cerrarAvisoNomina(){
  var hoy = new Date().toISOString().slice(0,10);
  try{ localStorage.setItem('nomina_aviso_visto_fecha', hoy); }catch(e){}
  closeOv('ov-aviso-nomina');
}
