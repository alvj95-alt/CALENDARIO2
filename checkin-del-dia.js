/* TrenTurnos v5 — Check-in del día (foto, OCR, vista por hora/vía)
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
 // objeto Date del día que se está mirando en el overlay

function ciFechaHoyISO(){
  var d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function ciFechaISO(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function ciEsHoy(d){ return ciFechaISO(d) === ciFechaHoyISO(); }
function ciFechaBonita(d){
  var dias = ['dom','lun','mar','mié','jue','vie','sáb'];
  var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return dias[d.getDay()]+', '+d.getDate()+' de '+meses[d.getMonth()];
}
function ciCambiarDia(delta){
  _ciFechaViendo.setDate(_ciFechaViendo.getDate()+delta);
  ciCargarYRenderizarFecha();
}
function ciSedeActual(){ return AJ.sedeBase || AJ.base || ''; }
function ciTieneBaseConfigurada(){ return !!AJ.base; }
function ciIdentidadActual(){ return {matricula: AJ.matricula||'', nombre: AJ.nombre||''}; }
function ciEsAdminOInterventor(){
  return !!(typeof perfilAdminActual!=='undefined' && perfilAdminActual && perfilAdminActual.rol==='admin')
      || !!(typeof usuarioActual!=='undefined' && usuarioActual && usuarioActual.esInterventor);
}

// NUEVO — carrera contra un límite de tiempo: si la promesa no
// resuelve a tiempo, se considera fallida en vez de esperar para
// siempre. TODAS las llamadas a Supabase de este módulo pasan por
// aquí — es la corrección directa del fallo de "Cargando…" eterno.
function ciConTimeout(promesa, ms){
  return new Promise(function(resolve){
    var terminado = false;
    var t = setTimeout(function(){
      if(terminado) return;
      terminado = true;
      resolve({ok:false, timeout:true});
    }, ms||12000);
    promesa.then(function(data){
      if(terminado) return;
      terminado = true;
      clearTimeout(t);
      resolve({ok:true, data:data});
    }).catch(function(err){
      if(terminado) return;
      terminado = true;
      clearTimeout(t);
      resolve({ok:false, error:err});
    });
  });
}

async function abrirCheckin(){
  _ciFechaViendo = new Date();
  openOv('ov-checkin');
  await ciCargarYRenderizarFecha();
}

async function ciCargarYRenderizarFecha(){
  document.getElementById('ci-sub').textContent = (AJ.base||'Base') + ' · ' + _ciFechaViendo.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'});
  if(!ciTieneBaseConfigurada()){ renderCiSinBase(); return; }
  renderCiCargando();
  if(!sbAdmin){ renderCiErrorConexion(); return; }
  var res = await ciConTimeout(
    sbAdmin.from('checkin_diario').select('*').eq('fecha', ciFechaISO(_ciFechaViendo)).eq('sede', ciSedeActual()).maybeSingle(),
    12000
  );
  if(!res.ok){ renderCiErrorConexion(); return; }
  var fila = (res.data && res.data.data) ? res.data.data : null;
  if(ciEsHoy(_ciFechaViendo)){
    if(fila) renderCiBloqueado(fila); else renderCiVacio();
  } else {
    if(fila) renderCiHistorico(fila); else renderCiSinDatosHistoricos();
  }
}

function ciBarraDiaHtml(){
  var esHoy = ciEsHoy(_ciFechaViendo);
  return '<div class="ci-day-nav">'+
    '<button class="ci-day-btn" onclick="ciCambiarDia(-1)" title="Día anterior">‹</button>'+
    '<div class="ci-day-lbl">'+ciFechaBonita(_ciFechaViendo)+'</div>'+
    (esHoy ? '<span class="ci-day-hoy-badge">HOY</span>' : '')+
    '<button class="ci-day-btn" onclick="ciCambiarDia(1)" title="Día siguiente"'+(esHoy?' disabled':'')+'>›</button>'+
    '</div>';
}
function renderCiSinBase(){
  document.getElementById('ci-body').innerHTML =
    '<div class="ci-empty"><div class="ci-empty-ico">📍</div>'+
    '<div class="ci-empty-tit">Configura tu Estación Base primero</div>'+
    '<div class="ci-empty-sub">Ve a Ajustes → Estación Base para poder usar el check-in.</div></div>';
}
function renderCiCargando(){
  document.getElementById('ci-body').innerHTML = ciBarraDiaHtml()+
    '<div class="ci-progreso"><span class="ci-progreso-ico">🚆</span><div>Cargando…</div></div>';
}
function renderCiErrorConexion(){
  document.getElementById('ci-body').innerHTML = ciBarraDiaHtml()+
    '<div class="ci-empty"><div class="ci-empty-ico">📡</div>'+
    '<div class="ci-empty-tit">No se pudo conectar</div>'+
    '<div class="ci-empty-sub">Comprueba tu internet e inténtalo de nuevo.</div>'+
    '<button class="ci-btn-subir" onclick="ciCargarYRenderizarFecha()">🔄 Reintentar</button></div>';
}
function renderCiVacio(){
  document.getElementById('ci-body').innerHTML = ciBarraDiaHtml()+
    '<div class="ci-empty">'+
      '<div class="ci-empty-ico">📤</div>'+
      '<div class="ci-empty-tit">Aún no se ha subido el check-in de hoy</div>'+
      '<div class="ci-empty-sub">Sube el PDF del listado de asistencia de '+(AJ.base||'la base')+' — si son varias páginas o varios archivos, puedes elegirlos todos a la vez.</div>'+
      '<button class="ci-btn-subir" onclick="document.getElementById(\'ci-file-input\').click()">📤 Subir PDF del check-in</button>'+
      '<div class="ci-consejo">Al ser texto real dentro del PDF (no una foto escaneada), se lee prácticamente todo bien. Podrás corregir cualquier dato antes de confirmar.</div>'+
    '</div>';
}function renderCiProgreso(msg, pct){
  document.getElementById('ci-body').innerHTML =
    '<div class="ci-progreso"><span class="ci-progreso-ico">🚆</span><div>'+msg+'</div></div>'+
    '<div class="ci-progreso-bar"><div class="ci-progreso-fill" style="width:'+(pct||0)+'%"></div></div>';
}
function renderCiSinDatosHistoricos(){
  document.getElementById('ci-body').innerHTML = ciBarraDiaHtml()+
    '<div class="ci-empty">'+
      '<div class="ci-empty-ico">📤</div>'+
      '<div class="ci-empty-tit">Nadie subió el check-in de este día</div>'+
      '<div class="ci-empty-sub">Si tienes el PDF de ese día, puedes subirlo ahora — se guardará con la fecha de '+ciFechaBonita(_ciFechaViendo)+', no con la de hoy.</div>'+
      '<button class="ci-btn-subir" onclick="document.getElementById(\'ci-file-input\').click()">📤 Subir PDF de este día</button>'+
    '</div>';
}
function renderCiHistorico(fila){
  var filas = fila.datos || [];
  var grupos = ciAgruparPorHora(filas);
  var esAdmin = ciEsAdminOInterventor();
  var html = ciBarraDiaHtml();
  html += ciRenderViaHtml(grupos, true);
  html += ciRenderReservasHtml(fila.reservas||[], true);
  html += '<div class="ci-hist-note">🗂️ Histórico de solo lectura — subido por '+(fila.subido_por_nombre||fila.subido_por_matricula||'—')+'</div>';
  if(esAdmin){
    html += '<div style="padding:0 16px 10px"><button class="ci-btn-eliminar" onclick="ciEliminarCheckin(\''+ciFechaISO(_ciFechaViendo)+'\', true)">🗑️ Eliminar este check-in (solo Admin)</button></div>';
  }
  document.getElementById('ci-body').innerHTML = html;
}
function renderCiBloqueado(fila){
  var filas = fila.datos || [];
  var grupos = ciAgruparPorHora(filas);
  var esAdmin = ciEsAdminOInterventor();
  var horaSubida = '';
  try{ horaSubida = new Date(fila.subido_en).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}); }catch(e){}
  var html = ciBarraDiaHtml();
  html += ciRenderViaHtml(grupos, true);
  html += ciRenderReservasHtml(fila.reservas||[], true);
  html += '<div class="ci-locked-foot">🔒 Subido por <b>'+(fila.subido_por_nombre||fila.subido_por_matricula||'—')+'</b>'+(horaSubida?' a las '+horaSubida:'')+'</div>';
  if(esAdmin){
    html += '<div style="padding:4px 16px 10px"><button class="ci-btn-subir" style="width:100%" onclick="renderCiVacio()">✏️ Volver a subir PDF (solo Admin)</button></div>';
    html += '<div style="padding:0 16px 10px"><button class="ci-btn-eliminar" onclick="ciEliminarCheckin(\''+ciFechaISO(_ciFechaViendo)+'\', false)">🗑️ Eliminar check-in de hoy (solo Admin)</button></div>';
  }
  document.getElementById('ci-body').innerHTML = html;
}
async function ciEliminarCheckin(fechaISO, esHistorico){
  if(!ciEsAdminOInterventor()) return;
  if(!confirm('¿Eliminar el check-in de '+fechaISO+' ('+ciSedeActual()+')?\n\nEsta acción no se puede deshacer.')) return;
  if(!sbAdmin){ toast('⚠️ Sin conexión'); return; }
  var res = await ciConTimeout(sbAdmin.from('checkin_diario').delete().eq('fecha', fechaISO).eq('sede', ciSedeActual()), 12000);
  if(!res.ok){ toast('⚠️ No se pudo eliminar — comprueba tu conexión'); return; }
  toast('🗑️ Check-in eliminado');
  if(esHistorico) renderCiSinDatosHistoricos(); else renderCiVacio();
}

// ── Selección y lectura del PDF de check-in ──
async function ciArchivosSeleccionados(fileList){
  var archivos = Array.prototype.slice.call(fileList||[]);
  if(!archivos.length) return;
  var todasLasFilas = [], todasLasReservas = [], pdfsSinLeerNada = 0;
  // NUEVO — Confirmado por Alex: se cambia de foto+OCR a PDF — el
  // check-in se genera como PDF con texto real dentro (no una foto
  // escaneada), así que se puede extraer directo, sin adivinar nada
  // como hacía Tesseract. Reutiliza EXACTAMENTE el mismo lector que
  // ya usa la carga del horario (pdfjsLib + asegurarPdfWorkerSeguro,
  // ver el listener de #fileInput más arriba) — ni una línea nueva
  // de lógica de lectura, solo se reaprovecha lo que ya funciona.
  _ciTextoOcrCrudo = [];
  for(var idx=0; idx<archivos.length; idx++){
    var file = archivos[idx];
    var etiqueta = archivos.length>1 ? ('PDF '+(idx+1)+' de '+archivos.length) : 'el PDF';
    renderCiProgreso('Leyendo '+etiqueta+'…', Math.round((idx/archivos.length)*100));
    try{
      await asegurarPdfWorkerSeguro();
      var buf = await file.arrayBuffer();
      var pdf = await pdfjsLib.getDocument({data: buf}).promise;
      var fullText = '';
      for(var p=1; p<=pdf.numPages; p++){
        renderCiProgreso('Leyendo '+etiqueta+'… página '+p+' de '+pdf.numPages, Math.round(((idx+(p/pdf.numPages))/archivos.length)*100));
        var page = await pdf.getPage(p);
        var content = await page.getTextContent();
        var items = content.items.map(function(it){ return {str:it.str, x:it.transform[4], y:it.transform[5]}; });
        items.sort(function(a,b){ return b.y-a.y || a.x-b.x; });
        var lastY = null;
        items.forEach(function(it){
          if(lastY !== null && Math.abs(it.y - lastY) > 2){ fullText += '\n'; }
          else if(lastY !== null){ fullText += ' '; }
          fullText += it.str;
          lastY = it.y;
        });
        fullText += '\n';
      }
      _ciTextoOcrCrudo.push({archivo: file.name||('PDF '+(idx+1)), texto: fullText});
      var parseo = ciParsearTextoOcr(fullText);
      if(!parseo.filas.length && !parseo.reservas.length) pdfsSinLeerNada++;
      todasLasFilas = todasLasFilas.concat(parseo.filas);
      todasLasReservas = todasLasReservas.concat(parseo.reservas);
    }catch(err){
      console.error(err);
      _ciTextoOcrCrudo.push({archivo: file.name||('PDF '+(idx+1)), texto: '(ERROR: '+(err&&err.message||err)+')'});
      pdfsSinLeerNada++;
    }
  }
  if(!todasLasFilas.length && !todasLasReservas.length){
    renderCiVacio();
    toast('No se pudo leer ningún dato del PDF — comprueba que sea el archivo correcto');
    return;
  }
  if(pdfsSinLeerNada>0) toast('⚠️ '+pdfsSinLeerNada+' PDF(s) no se pudieron leer — revisa el vistazo antes de confirmar');
  renderCiVistazo(todasLasFilas, todasLasReservas);
}

// ── Parser del texto OCR (heurístico, "mejor esfuerzo") ──
function ciParsearTextoOcr(texto){
  var lineas = texto.split('\n').map(function(l){return l.trim();}).filter(Boolean);
  var filas = [], reservas = [];
  var seccion = 'checkin', nombrePendiente = '', lineasSinMatriculaSeguidas = 0;
  // NUEVO — fila con matrícula ya vista pero SIN turno/posición/hora
  // todavía (el nombre se cortó justo ahí y el resto de la fila viene
  // en la línea de abajo, ej. "4179742 ALVARADO RODRIGUEZ, JOSE" en
  // una línea y "ALEJANDRO 3930DH-... JT-JT-CP-JT 7:30" en la
  // siguiente, SIN su propia matrícula). Confirmado con fotos reales
  // — es el patrón de nombre partido MÁS FRECUENTE, así que sin esto
  // se perdía toda la fila (turno/posición/hora vacíos) por cada
  // nombre largo de dos líneas.
  var filaPendienteCheckin = null;  // {matricula, nombre}
  var filaPendienteReserva = null;  // {matricula, nombre}
  var reMat = /^[^\dA-Za-zÁÉÍÓÚÑáéíóúñ]{0,4}(\d{6,7})/;
  var reHora = /(\d{1,2}:\d{2})/;
  var reHoraTodas = /(\d{1,2}:\d{2})/g;
  var rePos = /\b((?:CP|TCF|JT|CC)(?:[-·](?:CP|TCF|JT|CC))*)\b/;
  var reTurno = /\b(\d{3,6}(?:UM|DH|F)?(?:[-·]\d{3,6}(?:UM|DH|F)?){0,7})\b/;
  var reCabeceraReservas = /RESERVAS?\b.{0,20}FECHA/i;
  var reCabeceraCheckin = /CHECK.?IN\b.{0,20}FECHA/i;
  var reTipoReserva = /RESERVA\s*(MA[ÑN]ANA|INTERMEDIA|TARDE)/i;
  function limpiar(s){ return s.replace(/[|\[\]!¡_]/g,' ').replace(/\s{2,}/g,' ').trim(); }
  function pareceContinuacionNombre(soloTexto){
    return soloTexto.length>1 && soloTexto.length<30
      && soloTexto === soloTexto.toUpperCase()
      && !/\b\w\b.*\b\w\b/.test(soloTexto); // como mucho 1 "palabra" de una sola letra
  }

  lineas.forEach(function(linea){
    if(reCabeceraReservas.test(linea)){ seccion='reservas'; nombrePendiente=''; filaPendienteCheckin=null; filaPendienteReserva=null; return; }
    if(reCabeceraCheckin.test(linea)){ seccion='checkin'; nombrePendiente=''; filaPendienteCheckin=null; filaPendienteReserva=null; return; }
    var mMat = linea.match(reMat);

    // ── Línea SIN matrícula propia ──
    if(!mMat){
      var soloTexto = linea.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ,\s]/g,'').trim();

      // 1) ¿Completa una fila pendiente (matrícula ya vista, faltaba
      //    turno/posición/hora)? Es el caso más común en tus fotos.
      var filaPend = seccion==='reservas' ? filaPendienteReserva : filaPendienteCheckin;
      if(filaPend){
        if(seccion==='reservas'){
          var mTipo2 = linea.match(reTipoReserva);
          var horas2 = linea.match(reHoraTodas) || [];
          if(mTipo2 || horas2.length){
            var idx2 = [];
            if(mTipo2) idx2.push(mTipo2.index);
            if(horas2.length){ var ih2=linea.search(reHora); if(ih2>=0) idx2.push(ih2); }
            var extra2 = idx2.length ? limpiar(linea.slice(0, Math.min.apply(null,idx2))) : '';
            reservas.push({
              matricula: filaPend.matricula,
              nombre: limpiar((filaPend.nombre+' '+extra2).trim()) || '(nombre no leído)',
              tipo: mTipo2 ? ('Reserva '+mTipo2[1].replace(/MANANA/i,'Mañana').toLowerCase().replace(/^\w/,function(c){return c.toUpperCase();})) : '',
              inicio: horas2[0]||'', fin: horas2[1]||''
            });
            filaPendienteReserva = null; lineasSinMatriculaSeguidas=0; return;
          }
        } else {
          var mT2=linea.match(reTurno), mP2=linea.match(rePos), mH2=linea.match(reHora);
          if(mT2||mP2||mH2){
            var idx3 = [];
            if(mT2) idx3.push(mT2.index);
            if(mP2) idx3.push(mP2.index);
            if(mH2) idx3.push(mH2.index);
            var extra3 = idx3.length ? limpiar(linea.slice(0, Math.min.apply(null,idx3))) : '';
            filas.push({
              matricula: filaPend.matricula,
              nombre: limpiar((filaPend.nombre+' '+extra3).trim()) || '(nombre no leído)',
              turno: mT2 ? mT2[1].replace(/·/g,'-') : '',
              posicion: mP2 ? mP2[1].replace(/·/g,'-') : '',
              hora: mH2 ? mH2[1] : '', obs: ''
            });
            filaPendienteCheckin = null; lineasSinMatriculaSeguidas=0; return;
          }
        }
        // no traía datos de turno/posición/hora → puede ser una
        // TERCERA línea del mismo nombre (nombres muy largos)
        if(pareceContinuacionNombre(soloTexto)){
          filaPend.nombre = (filaPend.nombre+' '+soloTexto).trim();
          lineasSinMatriculaSeguidas=0; return;
        }
      }

      // 2) Si no hay fila pendiente: puede ser el INICIO de un nombre
      //    que se lee ANTES que su matrícula (caso menos común, pero
      //    ya contemplado antes) — exige coma para no confundir ruido
      //    del fondo con un nombre de verdad.
      var pareceNombreNuevo = soloTexto.length>4 && soloTexto.length<40
        && soloTexto === soloTexto.toUpperCase()
        && soloTexto.indexOf(',')>=0
        && !/\b\w\b.*\b\w\b.*\b\w\b/.test(soloTexto);
      var pareceContinuacionSuelta = nombrePendiente && pareceContinuacionNombre(soloTexto);
      if(pareceNombreNuevo || pareceContinuacionSuelta){
        nombrePendiente = (nombrePendiente+' '+soloTexto).trim(); lineasSinMatriculaSeguidas=0;
      } else {
        lineasSinMatriculaSeguidas++;
        if(lineasSinMatriculaSeguidas>=2){ nombrePendiente=''; filaPendienteCheckin=null; filaPendienteReserva=null; }
      }
      return;
    }

    // ── Línea CON matrícula: cierra cualquier fila pendiente sin
    //    terminar (mejor guardar el dato parcial que perderlo) ──
    if(filaPendienteCheckin){ filas.push({matricula:filaPendienteCheckin.matricula, nombre:filaPendienteCheckin.nombre||'(nombre no leído)', turno:'', posicion:'', hora:'', obs:''}); filaPendienteCheckin=null; }
    if(filaPendienteReserva){ reservas.push({matricula:filaPendienteReserva.matricula, nombre:filaPendienteReserva.nombre||'(nombre no leído)', tipo:'', inicio:'', fin:''}); filaPendienteReserva=null; }
    lineasSinMatriculaSeguidas = 0;
    var resto = linea.slice(mMat[0].length);

    if(seccion==='reservas'){
      var mTipo = resto.match(reTipoReserva);
      var horasEncontradas = resto.match(reHoraTodas) || [];
      var indicesR = [];
      if(mTipo) indicesR.push(mTipo.index);
      if(horasEncontradas.length){ var iHoraR = resto.search(reHora); if(iHoraR>=0) indicesR.push(iHoraR); }
      var nombreR = indicesR.length ? limpiar(resto.slice(0, Math.min.apply(null, indicesR))) : limpiar(resto);
      nombreR = limpiar((nombrePendiente ? nombrePendiente+' ' : '') + nombreR);
      nombrePendiente = '';
      if(!mTipo && !horasEncontradas.length){
        // nombre cortado justo aquí, sin datos todavía → esperar la siguiente línea
        filaPendienteReserva = {matricula: mMat[1], nombre: nombreR};
        return;
      }
      reservas.push({
        matricula: mMat[1], nombre: nombreR || '(nombre no leído)',
        tipo: mTipo ? ('Reserva '+mTipo[1].replace(/MANANA/i,'Mañana').toLowerCase().replace(/^\w/,function(c){return c.toUpperCase();})) : '',
        inicio: horasEncontradas[0]||'', fin: horasEncontradas[1]||''
      });
      return;
    }

    var mTurno = resto.match(reTurno), mPos = resto.match(rePos), mHora = resto.match(reHora);
    var indices = [];
    if(mTurno) indices.push(mTurno.index);
    if(mPos) indices.push(mPos.index);
    if(mHora) indices.push(mHora.index);
    var nombre = indices.length ? limpiar(resto.slice(0, Math.min.apply(null, indices))) : limpiar(resto);
    nombre = limpiar((nombrePendiente ? nombrePendiente+' ' : '') + nombre);
    nombrePendiente = '';
    if(!mTurno && !mPos && !mHora){
      // nombre cortado justo aquí, sin datos todavía → esperar la siguiente línea
      filaPendienteCheckin = {matricula: mMat[1], nombre: nombre};
      return;
    }
    filas.push({
      matricula: mMat[1], nombre: nombre || '(nombre no leído)',
      turno: mTurno ? mTurno[1].replace(/·/g,'-') : '',
      posicion: mPos ? mPos[1].replace(/·/g,'-') : '',
      hora: mHora ? mHora[1] : '', obs: ''
    });
  });

  // Fin del texto con una fila a medias: mejor guardarla incompleta
  // que perderla del todo.
  if(filaPendienteCheckin) filas.push({matricula:filaPendienteCheckin.matricula, nombre:filaPendienteCheckin.nombre||'(nombre no leído)', turno:'', posicion:'', hora:'', obs:''});
  if(filaPendienteReserva) reservas.push({matricula:filaPendienteReserva.matricula, nombre:filaPendienteReserva.nombre||'(nombre no leído)', tipo:'', inicio:'', fin:''});
  return {filas:filas, reservas:reservas};
}

// NUEVO — agrupado en DOS niveles para la vista "Vía" (maqueta
// aprobada por Alex): primero por HORA de toma, y dentro de cada
// hora, por primer tramo de tren — así un mismo tren que entra dos
// veces a horas distintas (típico de una salida en DH) aparece en
// dos paradas separadas de la vía, cada una con su propia gente,
// nunca mezcladas entre sí.
function ciAgruparPorHora(filas){
  var porHora = {}, ordenHoras = [];
  filas.forEach(function(f){
    var h = f.hora || '¿hora?';
    if(!porHora[h]){ porHora[h] = {hora:f.hora, gruposTren:{}, ordenTrenes:[]}; ordenHoras.push(h); }
    var primero = (f.turno||'').split('-')[0] || '';
    var keyTren = primero || ('__sin_leer_'+f.matricula);
    if(!porHora[h].gruposTren[keyTren]){ porHora[h].gruposTren[keyTren] = {primero:primero, personas:[]}; porHora[h].ordenTrenes.push(keyTren); }
    porHora[h].gruposTren[keyTren].personas.push(f);
  });
  var lista = ordenHoras.map(function(h){
    var entrada = porHora[h];
    return {hora: entrada.hora, trenes: entrada.ordenTrenes.map(function(kt){ return entrada.gruposTren[kt]; })};
  });
  function min(h){ var m=h&&h.match(/^(\d{1,2}):(\d{2})/); return m?(parseInt(m[1],10)*60+parseInt(m[2],10)):null; }
  lista.sort(function(a,b){
    var ma=min(a.hora), mb=min(b.hora);
    if(ma===null && mb===null) return 0;
    if(ma===null) return 1;
    if(mb===null) return -1;
    return ma-mb;
  });
  return lista;
}

// Fila de una persona (matrícula/nombre/ruta/posición, todo
// editable si no es solo lectura) — pieza reutilizable tanto para
// la vía normal como para cualquier vista futura.
function ciRenderPersonaHtml(p, idx, soloLectura){
  var ed = soloLectura ? '' : ' ci-editable';
  var segmentos = (p.turno||'').split('-').filter(Boolean);
  var rutaHtml = '';
  segmentos.forEach(function(seg,i){
    var warn = /DH|UM/i.test(seg);
    var cls = i===0 ? 'tc-first-mini' : 'tc-rest';
    rutaHtml += '<span class="'+cls+(warn?' tc-warn':'')+'">'+(warn?'<span class="tc-warn-ico">⚠</span>':'')+seg+'</span>';
    if(i<segmentos.length-1) rutaHtml += '<span class="tc-arrow">→</span>';
  });
  if(!segmentos.length) rutaHtml = '<span class="est-falta">sin tren leído</span>';
  var posChips = (p.posicion||'').split('-').filter(Boolean).map(function(pc){ return '<span class="pos-chip pos-'+pc+'">'+pc+'</span>'; }).join('');
  if(!posChips) posChips = '<span class="est-falta">?</span>';
  return '<div class="ci-persona">'
    +'<div class="ci-mat'+ed+'"'+(soloLectura?'':' onclick="ciEditarCampoCheckin('+idx+',\'matricula\',\'Matrícula\')"')+'>'+p.matricula+'</div>'
    +'<div class="ci-nom">'
      +'<div class="ci-nom-tx'+ed+'"'+(soloLectura?'':' onclick="ciEditarCampoCheckin('+idx+',\'nombre\',\'Nombre\')"')+'>'+p.nombre+'</div>'
      +'<div class="ci-ruta'+ed+'"'+(soloLectura?'':' onclick="ciEditarCampoCheckin('+idx+',\'turno\',\'Turno (ej. 1101-1192)\')"')+'>'+rutaHtml+'</div>'
    +'</div>'
    +'<div class="ci-right"><span'+ed+(soloLectura?'':' onclick="ciEditarCampoCheckin('+idx+',\'posicion\',\'Posición (ej. CP-TCF)\')"')+'>'+posChips+'</span></div></div>';
}

// NUEVO — vista "Vía" (maqueta 3, aprobada por Alex): un carril
// vertical con una parada por cada HORA de toma; dentro de cada
// parada, un bloque por cada tren de esa hora, con su gente debajo.
// No importa el orden en que se suban las fotos — siempre sale
// ordenado por hora y agrupado por tren. Un mismo tren que entra dos
// veces a horas distintas (típico de una salida en DH) aparece en
// dos paradas separadas de la vía, con su gente sin mezclarse.
function ciRenderViaHtml(gruposPorHora, soloLectura){
  var html = '<div class="m3-track">';
  gruposPorHora.forEach(function(entrada){
    html += '<div class="m3-item"><div class="m3-rail"><div class="m3-dot"></div><div class="m3-line"></div></div>';
    html += '<div class="m3-content"><div class="m3-hora'+(entrada.hora?'':' est-falta')+'">'+(entrada.hora||'¿hora?')+'</div>';
    entrada.trenes.forEach(function(gt){
      var warn = /DH|UM/i.test(gt.primero||'');
      html += '<div class="m3-tren-block"><div class="m3-tren-hdr">'
        +'<span class="m3-tren'+(warn?' m3-warn':'')+'">'+(warn?'⚠ ':'')+(gt.primero||'¿tren?')+'</span>'
        +'<span class="m3-cnt">'+gt.personas.length+' pers.</span></div>';
      gt.personas.forEach(function(p){
        var idx = soloLectura ? -1 : _ciFilasPendientes.indexOf(p);
        html += ciRenderPersonaHtml(p, idx, soloLectura);
      });
      html += '</div>';
    });
    html += '</div></div>';
  });
  return html+'</div>';
}
function ciRenderReservasHtml(reservas, soloLectura){
  if(!reservas || !reservas.length) return '';
  var ordenadas = reservas.slice().sort(function(a,b){
    function min(h){ var m=h&&h.match(/^(\d{1,2}):(\d{2})/); return m?(parseInt(m[1],10)*60+parseInt(m[2],10)):null; }
    var ma=min(a.inicio), mb=min(b.inicio);
    if(ma===null && mb===null) return 0;
    if(ma===null) return 1;
    if(mb===null) return -1;
    return ma-mb;
  });
  var html = '<div class="ci-seccion-hdr"><span style="font-size:13px">🪑</span><div class="ci-seccion-hdr-tit">Reservas de hoy</div></div><div class="ci-grupo">';
  ordenadas.forEach(function(r){
    var idx = soloLectura ? -1 : _ciReservasPendientes.indexOf(r);
    var ed = soloLectura ? '' : ' ci-editable';
    var horas = (r.inicio||'¿inicio?')+'–'+(r.fin||'¿fin?');
    var horasCls = (!r.inicio||!r.fin) ? 'ci-res-horas est-falta' : 'ci-res-horas';
    html += '<div class="ci-persona">'
      +'<div class="ci-mat'+ed+'"'+(soloLectura?'':' onclick="ciEditarCampoReserva('+idx+',\'matricula\',\'Matrícula\')"')+'>'+r.matricula+'</div>'
      +'<div class="ci-nom">'
        +'<div class="ci-nom-tx'+ed+'"'+(soloLectura?'':' onclick="ciEditarCampoReserva('+idx+',\'nombre\',\'Nombre\')"')+'>'+r.nombre+'</div>'
        +'<div class="ci-res-tramo'+ed+'"'+(soloLectura?'':' onclick="ciEditarCampoReserva('+idx+',\'tipo\',\'Tipo de reserva\')"')+'>'+(r.tipo||'¿tipo?')+'</div>'
      +'</div>'
      +'<div class="'+horasCls+ed+'"'+(soloLectura?'':' onclick="ciEditarHorasReserva('+idx+')"')+'>'+horas+'</div></div>';
  });
  return html+'</div>';
}
function ciEditarCampoCheckin(idx, campo, etiqueta){
  if(idx<0 || !_ciFilasPendientes || !_ciFilasPendientes[idx]) return;
  var nuevo = prompt('Corregir '+etiqueta+':', _ciFilasPendientes[idx][campo]||'');
  if(nuevo===null) return;
  _ciFilasPendientes[idx][campo] = nuevo.trim();
  renderCiVistazo(_ciFilasPendientes, _ciReservasPendientes);
}
function ciEditarCampoReserva(idx, campo, etiqueta){
  if(idx<0 || !_ciReservasPendientes || !_ciReservasPendientes[idx]) return;
  var nuevo = prompt('Corregir '+etiqueta+':', _ciReservasPendientes[idx][campo]||'');
  if(nuevo===null) return;
  _ciReservasPendientes[idx][campo] = nuevo.trim();
  renderCiVistazo(_ciFilasPendientes, _ciReservasPendientes);
}
function ciEditarHorasReserva(idx){
  if(idx<0 || !_ciReservasPendientes || !_ciReservasPendientes[idx]) return;
  var r = _ciReservasPendientes[idx];
  var nuevoInicio = prompt('Corregir hora de inicio (HH:MM):', r.inicio||'');
  if(nuevoInicio===null) return;
  var nuevoFin = prompt('Corregir hora de fin (HH:MM):', r.fin||'');
  if(nuevoFin===null) return;
  r.inicio = nuevoInicio.trim(); r.fin = nuevoFin.trim();
  renderCiVistazo(_ciFilasPendientes, _ciReservasPendientes);
}
function renderCiVistazo(filas, reservas){
  _ciFilasPendientes = filas;
  _ciReservasPendientes = reservas||[];
  var grupos = ciAgruparPorHora(filas);
  var sinHora = filas.filter(function(f){return !f.hora;}).length;
  var html = '<div class="ci-vistazo-note">📋 Esto es lo que se ha leído del PDF ('+filas.length+' persona'+(filas.length===1?'':'s')+(_ciReservasPendientes.length?' + '+_ciReservasPendientes.length+' reserva'+(_ciReservasPendientes.length===1?'':'s'):'')+'). Toca cualquier dato para corregirlo si algo salió raro'+(sinHora?' — hay '+sinHora+' fila(s) sin hora detectada, en naranja':'')+'.'+
    (_ciTextoOcrCrudo&&_ciTextoOcrCrudo.length ? '<br><a href="#" onclick="ciVerTextoCrudo();return false;" style="color:var(--acc2);font-weight:700">🔍 Ver texto leído (diagnóstico)</a>' : '')+
    '</div>';
  html += ciRenderViaHtml(grupos, false);
  html += ciRenderReservasHtml(_ciReservasPendientes, false);
  // FIX — "Repetir" volvía siempre a la pantalla de HOY, aunque se
  // estuviera subiendo el check-in de un día anterior (ver
  // renderCiSinDatosHistoricos). Ahora vuelve a la pantalla correcta
  // según el día que se esté viendo de verdad.
  var volverA = ciEsHoy(_ciFechaViendo) ? 'renderCiVacio()' : 'renderCiSinDatosHistoricos()';
  document.getElementById('ci-body').innerHTML = html+
    '<div class="ci-vistazo-btns">'+
      '<button class="ci-btn-cancelar" onclick="'+volverA+'">✕ Repetir</button>'+
      '<button class="ci-btn-confirmar" onclick="ciConfirmarSubida()">✓ Confirmar y subir</button>'+
    '</div>';
}
// NUEVO — muestra el texto EXACTO que Tesseract sacó de cada foto,
// en un cuadro seleccionable para copiar y compartir tal cual. Sirve
// para diagnosticar por qué algo se lee mal sin tener que adivinar.
function ciVerTextoCrudo(){
  if(!_ciTextoOcrCrudo || !_ciTextoOcrCrudo.length) return;
  var html = _ciTextoOcrCrudo.map(function(t,i){
    return '<div style="margin:0 16px 14px">'
      + '<div style="font-size:10px;font-weight:800;color:var(--tx2);margin-bottom:5px">📷 '+(t.archivo||('Foto '+(i+1)))+'</div>'
      + '<textarea readonly onclick="this.select()" style="width:100%;min-height:160px;background:var(--s2);border:1px solid var(--div);border-radius:8px;color:var(--tx2);font-family:monospace;font-size:10px;padding:8px;white-space:pre;overflow:auto">'+t.texto.replace(/</g,'&lt;')+'</textarea>'
      + '</div>';
  }).join('');
  document.getElementById('ci-body').innerHTML =
    '<div style="padding:12px 16px 4px;font-size:11px;color:var(--tx2)">Toca un cuadro para seleccionar todo el texto y copiarlo. Este es el texto tal cual lo leyó el lector, antes de interpretarlo.</div>'
    + html
    + '<div style="padding:0 16px 14px"><button class="ci-btn-cancelar" style="width:100%" onclick="renderCiVistazo(_ciFilasPendientes,_ciReservasPendientes)">‹ Volver al vistazo</button></div>';
}
async function ciConfirmarSubida(){
  if(!_ciFilasPendientes || (!_ciFilasPendientes.length && !(_ciReservasPendientes&&_ciReservasPendientes.length))) return;
  renderCiProgreso('Subiendo…', 92);
  if(!sbAdmin){ toast('⚠️ Sin conexión — no se pudo subir'); renderCiVistazo(_ciFilasPendientes, _ciReservasPendientes); return; }
  var identidad = ciIdentidadActual();
  // FIX — Confirmado por Alex: antes esto SIEMPRE guardaba con la
  // fecha de HOY, sin importar qué día se estuviera viendo en el
  // check-in (las flechitas ‹ ›). Ahora guarda con la fecha del día
  // que se está viendo de verdad — necesario para poder subir el
  // check-in de un día anterior que se quedó sin subir.
  var fechaDestino = ciFechaISO(_ciFechaViendo);
  var esHoyDestino = ciEsHoy(_ciFechaViendo);
  var payload = {
    fecha: fechaDestino, sede: ciSedeActual(),
    subido_por_matricula: identidad.matricula, subido_por_nombre: identidad.nombre,
    subido_en: new Date().toISOString(),
    datos: _ciFilasPendientes, reservas: _ciReservasPendientes||[],
    editado_por_admin: ciEsAdminOInterventor()
  };
  var res = await ciConTimeout(sbAdmin.from('checkin_diario').upsert(payload, {onConflict:'fecha,sede'}).select().single(), 12000);
  if(!res.ok || (res.data && res.data.error)){
    toast('Ya hay un check-in guardado ese día, o falló la conexión — solo Admin puede modificarlo');
    var resVerif = await ciConTimeout(sbAdmin.from('checkin_diario').select('*').eq('fecha', fechaDestino).eq('sede', ciSedeActual()).maybeSingle(), 12000);
    var filaVerif = (resVerif.ok && resVerif.data && resVerif.data.data) ? resVerif.data.data : null;
    if(filaVerif){ esHoyDestino ? renderCiBloqueado(filaVerif) : renderCiHistorico(filaVerif); }
    else { esHoyDestino ? renderCiVacio() : renderCiSinDatosHistoricos(); }
    return;
  }
  toast('✅ Check-in subido'+(esHoyDestino?'':' para el '+ciFechaBonita(_ciFechaViendo)));
  var filaGuardada = (res.data && res.data.data) ? res.data.data : payload;
  _ciFilasPendientes = null; _ciReservasPendientes = null;
  esHoyDestino ? renderCiBloqueado(filaGuardada) : renderCiHistorico(filaGuardada);
}
