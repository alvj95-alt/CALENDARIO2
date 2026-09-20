/* TrenTurnos v5 — Ajustes: perfil, rol, pluses, guardado
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
// FIX — esta función estaba declarada DENTRO de loadAjUI(), por lo que el onclick/onblur del
// HTML (ámbito global) no la encontraba (ReferenceError). Ahora vive a nivel global.
// NUEVO — al escribir la matrícula en Ajustes y salir del campo, si
// el nombre está vacío, se busca esa matrícula en el Horario General
// ya publicado (el mismo que usa el Buscador de Compañeros) y se
// rellena el nombre completo automáticamente — útil sobre todo para
// que los correos (HTDL, Art.51/52, etc.) salgan siempre con el
// nombre completo tal como consta oficialmente, sin tener que
// escribirlo dos veces. Si ya hay un nombre puesto, no se pisa: se
// asume que la persona lo quiso así a propósito.
async function autoRellenarNombrePorMatricula(){
  var matInput = document.getElementById('aj-mat');
  var nomInput = document.getElementById('aj-nom');
  if(!matInput || !nomInput) return;
  var matricula = matInput.value.trim();
  if(!matricula) return;
  if(nomInput.value.trim()){
    return; // ya hay un nombre puesto, no se pisa
  }
  try{
    // FIX — antes, si algo impedía encontrar el nombre (sin Estación
    // Base configurada, sin conexión, matrícula no encontrada...), la
    // función simplemente no hacía nada y no había forma de saber por
    // qué. Ahora cada caso avisa con un mensaje claro.
    if(!AJ.base){
      toast('⚠️ Configura primero tu Estación Base más abajo, para poder buscar tu nombre');
      return;
    }
    if(typeof BASES==='undefined' || !BASES.global || !BASES.global.data || !BASES.global.data.length){
      if(typeof cargarHorarioGlobalDesdeAdmin==='function'){
        toast('🔍 Buscando tu nombre en el Horario General...');
        var ok = await cargarHorarioGlobalDesdeAdmin();
        if(!ok){
          toast('⚠️ No se pudo cargar el Horario General de tu sede todavía (puede que el admin no lo haya publicado, o falte conexión).');
          return;
        }
      } else {
        return;
      }
    }
    if(typeof BASES==='undefined' || !BASES.global || !BASES.global.data || !BASES.global.data.length){
      toast('⚠️ No hay Horario General cargado para tu sede todavía.');
      return;
    }
    var encontrado = BASES.global.data.find(function(e){ return String(e[0]).trim()===matricula; });
    if(encontrado && encontrado[1]){
      nomInput.value = encontrado[1];
      toast('✍️ Nombre completado automáticamente: '+encontrado[1]);
    } else {
      toast('⚠️ Esa matrícula no aparece en el Horario General de tu sede. Escribe tu nombre a mano.');
    }
  }catch(e){
    console.log('No se pudo autocompletar el nombre por matrícula:', e);
    toast('⚠️ Error buscando tu nombre: ' + (e && e.message ? e.message : String(e)));
  }
}

/* ═══════════════════════════════════════
   AJUSTES
═══════════════════════════════════════ */
function loadAjUI(){
  // NUEVO — % de jornada contratada y fecha de antigüedad (para la Nómina Estimada)
  var ajJornadaInp = document.getElementById('aj-jornada-pct');
  if(ajJornadaInp) ajJornadaInp.value = AJ.jornadaPct || 100;
  var ajAntigInp = document.getElementById('aj-antiguedad');
  if(ajAntigInp) ajAntigInp.value = AJ.antiguedad || '';
  var ajLiqInp = document.getElementById('aj-liquidacion');
  if(ajLiqInp) ajLiqInp.value = AJ.liquidacion || '';
  // NUEVO — Complemento Ad Personam (CAPH): concepto opcional/personal,
  // se recupera el estado guardado cada vez que se entra en Ajustes.
  var ajCaphOn = document.getElementById('aj-caph-on');
  if(ajCaphOn){
    ajCaphOn.checked = !!AJ.tieneCAPH;
    var ajCaphRow = document.getElementById('aj-caph-importe-row');
    if(ajCaphRow) ajCaphRow.style.display = AJ.tieneCAPH ? 'flex' : 'none';
  }
  var ajCaphImp = document.getElementById('aj-caph-importe');
  if(ajCaphImp) ajCaphImp.value = AJ.caphImporte || '';
  // NUEVO — la Nómina Estimada solo se ve con sesión de Admin activa
  // (Confirmado por Alex: se mantiene oculta al resto hasta que el
  // cálculo esté bien afinado con datos reales).
  // FIX — "perfilAdminActual" se declara con "let" más abajo en el
  // script; si loadAjUI() se llega a ejecutar ANTES de que el script
  // llegue a esa línea (zona muerta temporal de "let"), ni siquiera
  // "typeof" es seguro — también lanza error. Se envuelve en
  // try/catch para que esto nunca pueda romper la carga de Ajustes.
  var btnNomina = document.getElementById('btnNominaEstimada');
  if(btnNomina){
    var esAdmin = false;
    try{ esAdmin = (typeof perfilAdminActual!=='undefined' && perfilAdminActual && perfilAdminActual.rol==='admin'); }catch(errTDZ){ esAdmin = false; }
    btnNomina.style.display = esAdmin ? 'inline-flex' : 'none';
  }
  // Inicializar UI de alarmas
  var aSw = document.getElementById('alarm-sw');
  var aFi = document.getElementById('alarm-fichar');
  var aSa = document.getElementById('alarm-salida');
  var aLbl= document.getElementById('alarm-lbl');
  if(AJ.alarmas){
    if(aSw)  aSw.checked  = !!AJ.alarmas.activas;
    if(aFi)  aFi.checked  = AJ.alarmas.fichar!==false;
    if(aSa)  aSa.checked  = AJ.alarmas.salida!==false;
    if(aLbl){ aLbl.textContent=AJ.alarmas.activas?'Activadas':'Desactivadas';
              aLbl.style.color=AJ.alarmas.activas?'var(--green2)':'var(--tx3)';}
  }
  document.getElementById('aj-nom').value=AJ.nombre||'';
  var elSaludoInp = document.getElementById('aj-nombre-saludo');
  if(elSaludoInp){
    elSaludoInp.value = AJ.nombrePila || '';
    // Si no hay nada guardado a mano, se sugiere el nombre de pila
    // calculado a partir del nombre completo, como placeholder —
    // se ve gris, no se guarda hasta que la persona lo confirme o
    // escriba el suyo propio.
    var sugerido = (typeof _primerNombreDesde==='function') ? _primerNombreDesde(AJ.nombre) : '';
    if(sugerido) elSaludoInp.placeholder = 'Cómo te saludamos (sugerido: '+sugerido+')';
  }
  document.getElementById('aj-mat').value=AJ.matricula||'';
  document.getElementById('aj-vh').value=AJ.vh||12.5;
  document.getElementById('aj-noc').value=AJ.nocturnidad||1.80;
  var bv=document.getElementById('aj-base-v');
  if(AJ.base){bv.textContent=AJ.base;bv.className='aj-base-val';}
  else{bv.textContent='Toca para seleccionar';bv.className='aj-base-val ph';}
  setRolUI(AJ.rol||'tripulante');
  renderPlusGrid();
  updHeader();
}
/* ═══════════════════════════════════════════════════════════
   setRol() — aplica el rol elegido y, con él, la tarifa asociada
   (TARIFAS_ROL, declarada al principio del script, antes de AJ).
   El usuario puede seguir modificando estos valores a mano después
   sin ninguna restricción.
═══════════════════════════════════════════════════════════ */
function setRol(r){
  AJ.rol=r;
  // NUEVO — autocompleta valor hora (HTDL), nocturnidad y monto de
  // Art.51/52 según el rol. Si los campos de Ajustes están visibles
  // en este momento, se actualizan al instante; si no, loadAjUI()
  // ya los rellenará correctamente la próxima vez que se abra
  // Ajustes, leyendo el AJ ya actualizado.
  var t = TARIFAS_ROL[r];
  if(t){
    AJ.vh = t.vh;
    AJ.nocturnidad = t.nocturnidad;
    AJ.art5152Monto = t.art5152Monto;
    var iVh  = document.getElementById('aj-vh');
    var iNoc = document.getElementById('aj-noc');
    var iArt = document.getElementById('aj-art5152-monto');
    if(iVh)  iVh.value  = t.vh;
    if(iNoc) iNoc.value = t.nocturnidad;
    if(iArt) iArt.value = t.art5152Monto;
  }
  setRolUI(r);
  renderPlusGrid();
  // NUEVO — FIX: se persiste el cambio de rol y su tarifa AL INSTANTE
  // en localStorage. Antes, si cambiabas de rol y no pulsabas también
  // "Guardar ajustes" por separado, el cambio se perdía al recargar
  // la app (seguía leyendo la tarifa anterior desde localStorage).
  // Ahora cada rol siempre trae su propia tarifa aplicada de verdad,
  // sin pasos intermedios.
  localStorage.setItem('aj5', JSON.stringify(AJ));
  if(typeof renderStats==='function') renderStats();
}
function setRolUI(r){
  document.getElementById('rs-t').className='aj-rol-btn'+(r==='tripulante'?' activo-t':'');
  document.getElementById('rs-a').className='aj-rol-btn'+(r==='auxiliar'?' activo-a':'');
  var rsJ=document.getElementById('rs-j'); if(rsJ) rsJ.className='aj-rol-btn'+(r==='jefe'?' activo-j':'');
}
function renderPlusGrid(){
  var r=AJ.rol||'tripulante',p=AJ.pluses[r]||PLUS_DEF[r];
  var labs={activacion:'Plus\nActivacion',internacional:'Plus\nIntl.',jt:'Plus\nJT'};
  document.getElementById('pgrid').innerHTML=Object.keys(PLUS_LABELS).map(function(k){
    return '<div class="pf"><div class="pf-l">'+labs[k]+'</div>'
      +'<div class="pf-r"><input class="pf-i" type="number" step="0.10" min="0" value="'+(p[k]||0)+'" oninput="setPlus(\''+k+'\',this.value)"></div>'
      +'<div class="pf-u">€/viaje</div></div>';
  }).join('');
}
function setPlus(k,v){var r=AJ.rol||'tripulante';if(!AJ.pluses[r])AJ.pluses[r]={};AJ.pluses[r][k]=parseFloat(v)||0;}

// NUEVO — la sede para el Buscador de Compañeros YA NO se pide aparte:
// se deriva automáticamente de "Estación Base" (AJ.base), que el
// usuario ya configura para otras cosas (límites de descanso, etc.).
// Las estaciones siguen el patrón "Ciudad + nombre" (p.ej. "Barcelona
// Sants", "Valencia Joaquín Sorolla", "Madrid Chamartín"), así que la
// primera palabra es la ciudad/sede — sin pedirle nada nuevo al
// usuario ni duplicar un dato que ya existe.
function _sedeUsuarioActual(){
  if(!AJ.base) return '';
  return AJ.base.trim().split(/\s+/)[0] || '';
}

function saveAj(){
  AJ.nombre=document.getElementById('aj-nom').value.trim()||'Mis Turnos';
  var elSaludoInpSave = document.getElementById('aj-nombre-saludo');
  AJ.nombrePila = elSaludoInpSave ? elSaludoInpSave.value.trim() : '';
  AJ.matricula=document.getElementById('aj-mat').value.trim()||'';
  AJ.vh=parseFloat(document.getElementById('aj-vh').value)||12.5;
  AJ.nocturnidad=parseFloat(document.getElementById('aj-noc').value)||1.80;
  localStorage.setItem('aj5',JSON.stringify(AJ));
  updHeader();toast('✅ Ajustes guardados');
  actualizarSaludo();
}
function updHeader(){
  document.getElementById('hdr-nom').textContent=AJ.nombre||'Mis Turnos';
  var rp=document.getElementById('hdr-rol'),mat=AJ.matricula?' · '+AJ.matricula:'';
  if(AJ.rol==='auxiliar'){rp.className='hdr-pill pill-a';rp.textContent='🎫 AUXILIAR'+mat;}
  else{rp.className='hdr-pill pill-t';rp.textContent='🚆 TRIPULANTE'+mat;}
}
