/* TrenTurnos v5 — Nómina Real (PDF/foto): lectura, comparación y diferencias
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function _guardarNominaRealPorMes(){
  try{ localStorage.setItem('nomina_real_por_mes', JSON.stringify(_nominaRealPorMes)); }catch(e){}
}

// Códigos de deducción conocidos (empiezan por "/", o conceptos fijos
// como cuota sindical / IRPF) — todo lo demás que tenga importe se
// interpreta como devengo. Heurística simple, pero cubre los 5 casos
// de deducción vistos en las nóminas reales de Alex.
function _esCodigoDeduccion(codigo, concepto){
  if(codigo && codigo.indexOf('/')===0) return true;
  var c = (concepto||'').toUpperCase();
  return c.indexOf('CUOTA SINDICAL')>=0 || c.indexOf('RETENCIÓN')>=0 || c.indexOf('RETENCION')>=0;
}

// NUEVO — mínimo, para diagnosticar el fallo del periodo con datos
// reales en vez de seguir adivinando (confirmado por Alex).
// FIX — Confirmado por el usuario: esta función seguía escribiendo
// siempre en 'nomina-body' (el contenedor de la Nómina Estimada de
// Admin), aunque la Nómina Real ya se movió a la pantalla pública —
// ahí ese elemento no existe, así que el botón "Ver texto leído" no
// hacía nada visible. Ahora usa _nominaRealStatusContainer(), la
// misma función que ya decide el sitio correcto según quién lo pidió
// (Admin o pantalla pública) — igual que hace el resto del flujo.
function _nominaVerTextoCrudo(){
  var texto = window._nominaRealTextoCrudo || '(sin texto)';
  var contenedor = _nominaRealStatusContainer();
  if(!contenedor) return;
  contenedor.innerHTML =
    '<div style="padding:10px 16px 4px;font-size:11px;color:var(--tx2)">Toca para seleccionar todo y copiarlo:</div>'
    + '<textarea readonly onclick="this.select()" style="width:calc(100% - 32px);margin:0 16px 14px;min-height:200px;background:var(--s2);border:1px solid var(--div);border-radius:8px;color:var(--tx2);font-family:monospace;font-size:10px;padding:8px;white-space:pre">'+texto.replace(/</g,'&lt;')+'</textarea>';
}

// NUEVO — Confirmado por Alex: alternativa a subir el PDF, por si da
// problemas (contraseña, formato raro). Reutiliza Tesseract (el
// mismo OCR que ya usa el Check-in) y el MISMO _parsearNominaRealTexto()
// del PDF — nada duplicado, solo cambia de dónde sale el texto.
async function procesarNominaRealImagen(file){
  if(!file) return;
  var statusDiv = _nominaRealStatusContainer();
  if(statusDiv) statusDiv.innerHTML = '<div style="padding:30px 20px;text-align:center;color:var(--tx3);font-size:12.5px" id="nomreal-ocr-status">📷 Leyendo la foto de tu nómina… 0%</div>';
  try{
    // FIX — Confirmado por el usuario: esta lectura no mostraba ningún
    // progreso mientras trabajaba (solo el mensaje fijo de arriba). Con
    // una foto de nómina, que tiene bastante texto, Tesseract puede
    // tardar 15-30 segundos — sin barra de progreso, parece que la app
    // se ha quedado colgada aunque siga trabajando por dentro. Se añade
    // el mismo "logger" con porcentaje que ya usa la lectura de fotos
    // del Horario Individual, para que se note que sigue viva.
    var resultadoOcr = await Tesseract.recognize(file, 'spa', {
      logger: function(m){
        var el = document.getElementById('nomreal-ocr-status');
        if(el && m.status==='recognizing text'){
          el.textContent = '📷 Leyendo la foto de tu nómina… '+Math.round((m.progress||0)*100)+'%';
        }
      }
    });
    var fullText = resultadoOcr.data.text;
    var parseo = _parsearNominaRealTexto(fullText);
    // FIX — Confirmado por el usuario: guardar el texto SIEMPRE, no
    // solo cuando falla la detección del periodo (ver mismo fix en
    // procesarNominaRealPdf, arriba).
    window._nominaRealTextoCrudo = fullText;
    if(!parseo.claveMes){
      toast('⚠️ No se pudo leer el periodo en la foto');
      if(statusDiv) statusDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx3);font-size:11.5px">'
        +'⚠️ No se encontró el periodo en la foto.<br><br>'
        +'<button onclick="_nominaVerTextoCrudo()" style="padding:9px 14px;background:var(--acc);border:none;border-radius:9px;color:#fff;font-weight:800;font-size:11.5px;cursor:pointer">🔍 Ver texto leído (para diagnóstico)</button></div>';
      return;
    }
    _nominaRealPorMes[parseo.claveMes] = parseo;
    _guardarNominaRealPorMes();
    toast('✅ Nómina real de '+parseo.periodoTexto+' guardada');
    renderNominaReal();
  }catch(err){
    console.error(err);
    alert('⚠️ Error al leer la foto de la nómina:\n'+(err&&err.message||err));
    renderNominaReal();
  }
}

async function procesarNominaRealPdf(file){
  if(!file) return;
  var statusDiv = _nominaRealStatusContainer();
  if(statusDiv) statusDiv.innerHTML = '<div style="padding:30px 20px;text-align:center;color:var(--tx3);font-size:12.5px">📄 Leyendo el PDF de tu nómina…</div>';
  try{
    await asegurarPdfWorkerSeguro();
    // NUEVO — Confirmado por Alex: las nóminas de Serveo suelen venir
    // protegidas con contraseña (normalmente el DNI/NIF). En vez de
    // fallar directamente con un error, si el PDF pide contraseña se
    // pregunta con un prompt() y se reintenta con ella — hasta 3
    // intentos, por si se escribe mal la primera vez.
    // FIX — "Cannot perform Construct on a detached ArrayBuffer":
    // pdf.js "consume" (transfiere al worker) el ArrayBuffer en el
    // primer intento, incluso si ese intento falla por pedir
    // contraseña — reutilizar el mismo buffer en el reintento
    // revienta. Se lee el archivo de nuevo, fresco, en cada intento.
    var pdf = null, intentos = 0;
    while(!pdf && intentos < 3){
      try{
        var buf = await file.arrayBuffer();
        var opciones = {data: buf};
        if(intentos > 0 || window._ultimaPasswordNomina){
          opciones.password = window._ultimaPasswordNomina || '';
        }
        pdf = await pdfjsLib.getDocument(opciones).promise;
      }catch(errPdf){
        var necesitaPassword = errPdf && (errPdf.name==='PasswordException' || /password/i.test(errPdf.message||''));
        if(!necesitaPassword) throw errPdf;
        var pedirDeNuevo = intentos > 0 ? ' (la anterior no era correcta, inténtalo otra vez)' : '';
        var pass = prompt('🔒 Este PDF está protegido con contraseña'+pedirDeNuevo+'.\nSuele ser tu DNI/NIF. Escríbela aquí:');
        if(pass === null){ toast('Carga cancelada — hacía falta la contraseña del PDF'); if(statusDiv) renderNominaReal(); return; }
        window._ultimaPasswordNomina = pass;
        intentos++;
      }
    }
    if(!pdf){ toast('⚠️ No se pudo abrir el PDF — contraseña incorrecta tras varios intentos'); renderNominaReal(); return; }
    var fullText = '';
    for(var p=1; p<=pdf.numPages; p++){
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
    var parseo = _parsearNominaRealTexto(fullText);
    // FIX — Confirmado por el usuario: antes el texto crudo solo se
    // guardaba cuando fallaba la detección del periodo. Pero puede
    // fallar algo MÁS ADENTRO (una línea concreta mal leída, aunque el
    // periodo sí se detecte) sin que hubiera forma de ver el texto
    // real para diagnosticarlo — como pasó con la línea negativa de la
    // regularización, que desapareció sin que el aviso lo detectara.
    // Ahora se guarda SIEMPRE, haya fallado o no.
    window._nominaRealTextoCrudo = fullText;
    if(!parseo.claveMes){
      // NUEVO — Confirmado por Alex: en vez de seguir adivinando por
      // qué falla, se guarda el texto crudo para poder verlo y
      // mandármelo tal cual — mínimo añadido, nada de relleno.
      toast('⚠️ No se pudo leer el periodo del PDF');
      if(statusDiv) statusDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx3);font-size:11.5px">'
        +'⚠️ No se encontró el periodo en el PDF.<br><br>'
        +'<button onclick="_nominaVerTextoCrudo()" style="padding:9px 14px;background:var(--acc);border:none;border-radius:9px;color:#fff;font-weight:800;font-size:11.5px;cursor:pointer">🔍 Ver texto leído (para diagnóstico)</button></div>';
      return;
    }
    _nominaRealPorMes[parseo.claveMes] = parseo;
    _guardarNominaRealPorMes();
    toast('✅ Nómina real de '+parseo.periodoTexto+' guardada');
    renderNominaReal();
  }catch(err){
    console.error(err);
    alert('⚠️ Error al leer el PDF de la nómina:\n'+(err&&err.message||err));
    renderNominaReal();
  }
}

// Parser de texto: busca líneas con un CÓDIGO (4 caracteres tipo
// "0001", "00TA", "1182", "/350", "9IDA") seguido de un CONCEPTO y,
// al final de la línea, uno o más números con coma decimal — el
// ÚLTIMO número de la línea es el importe (devengo o deducción según
// el código/concepto).
function _parsearNominaRealTexto(texto){
  // FIX — Confirmado por el usuario con una foto real: el OCR a veces
  // mete un guión largo "—" (u otro carácter suelto) entre "PERIODO:"
  // y la fecha, ej. "PERIODO: — 01.08.2026 a 31.08.2026" — la
  // expresión anterior solo aceptaba espacios ahí, así que fallaba
  // SIEMPRE con fotos, aunque la fecha en sí se leyera perfectamente.
  var mPeriodo = texto.match(/PERIODO:\s*[-—–:.]*\s*(\d{2}\.\d{2}\.\d{4})\s*a\s*(\d{2}\.\d{2}\.\d{4})/);
  var claveMes = null, periodoTexto = null;
  if(mPeriodo){
    var partes = mPeriodo[2].split('.'); // usa la fecha FIN del periodo para decidir el mes
    claveMes = partes[2]+'-'+partes[1];
    periodoTexto = mPeriodo[1]+' a '+mPeriodo[2];
  }
  var lineas = texto.split('\n');
  var devengos = [], deducciones = [];
  var lineasPerdidas = 0; // líneas que parecían de la tabla pero no se pudieron leer bien
  var reLinea = /^([\/A-Z0-9]{3,5})\s+([A-ZÁÉÍÓÚÑ0-9./ ,\-]+?)\s+((?:[\d.]+,\d{2}\s*%?\s*)+-?)$/;
  lineas.forEach(function(linea){
    linea = linea.trim();
    if(!linea) return;
    // FIX — Confirmado por el usuario: antes se quitaba el prefijo "R"
    // (Regularización — no "Reserva", como decía el comentario viejo)
    // y se fundía silenciosamente con las líneas normales del mes. Eso
    // producía conceptos duplicados sin explicación (dos "SALARIO
    // BASE", uno positivo y otro con signo raro) y hacía que comparar
    // esa nómina con el calendario o el Excel del mes NUNCA cuadrara,
    // sin que la persona supiera por qué. Ahora se marca cada línea
    // regularizada (esRegularizacion:true) en vez de esconderla.
    var esRegularizacion = /^R\s+/.test(linea);
    var lineaLimpia = linea.replace(/^R\s+/, '');
    var m = lineaLimpia.match(reLinea);
    if(!m){
      // NUEVO — Confirmado por el usuario, con una foto real donde el
      // OCR desfiguró 23 de 25 líneas de la tabla (comas perdidas,
      // "0001" leído como letras, etc.): si una línea CLARAMENTE
      // parecía una fila de la tabla (trae al menos un número con
      // decimales tipo "1234,56") pero no encajó en el patrón, se
      // cuenta como "línea perdida" — así se puede avisar de una
      // lectura incompleta en vez de mostrar un desglose a medias
      // como si estuviera completo.
      if(/\d[.,]\d{2}/.test(linea)) lineasPerdidas++;
      return;
    }
    var codigo = m[1], concepto = m[2].trim();
    // Todos los números de la cola de la línea, en orden
    var numeros = (m[3].match(/[\d.]+,\d{2}/g)||[]).map(function(n){
      return parseFloat(n.replace(/\./g,'').replace(',','.'));
    });
    if(!numeros.length) return;
    var importe = numeros[numeros.length-1]; // el importe siempre es el último número de la fila
    // Detecta el signo "-" final en los devengos (ej. "59,80-"), que en
    // esta nómina aparece para anular en un bloque lo que se sumó en
    // el otro — sin esto, ese importe se contaría siempre en positivo.
    if(/-\s*$/.test(m[3].trim())) importe = -importe;
    if(_esCodigoDeduccion(codigo, concepto)){
      // NUEVO — Confirmado por Alex: guardar también la base y el
      // porcentaje de cada deducción (cuando la fila los trae), no
      // solo el importe final — así se puede mostrar "4,85% sobre
      // 2.842,26 €" en vez de solo "-137,85 €".
      var deduccion = {codigo:codigo, concepto:concepto, importe:importe, esRegularizacion:esRegularizacion};
      if(numeros.length>=3){ deduccion.base = numeros[0]; deduccion.porcentaje = numeros[1]; }
      deducciones.push(deduccion);
    } else {
      // NUEVO — Confirmado por el usuario: distingue HTDL normal
      // (código 1182, voluntario) de HTDL Forzoso (código 118A —
      // último recurso del protocolo de llamamiento del Art. 51, se
      // paga a 1,5× la tarifa normal). El concepto ya viene tal cual
      // del PDF ("HTDL" vs "HTDL FORZOSO"), así que basta con
      // etiquetar cuál es cuál para poder tratarlas por separado en
      // vez de sumarlas juntas sin distinción.
      var esHTDLForzoso = codigo==='118A' || /FORZOSO/.test(concepto);
      var esHTDL = codigo==='1182' || (!esHTDLForzoso && /^HTDL\b/.test(concepto));
      devengos.push({codigo:codigo, concepto:concepto, importe:importe, esRegularizacion:esRegularizacion,
        esHTDL:esHTDL, esHTDLForzoso:esHTDLForzoso});
    }
  });
  // FIX — probado con texto real: la fila de totales (T.DEVENGO) va
  // en una línea separada de su propio título en el PDF, así que
  // buscar "T.DEVENGO 1234,56" en la misma línea no es fiable. En vez
  // de eso, se suman directamente los devengos ya extraídos —
  // matemáticamente es el mismo número, y no depende de cómo el PDF
  // reparta las líneas.
  var bruto = Math.round(devengos.reduce(function(s,d){ return s+d.importe; }, 0)*100)/100;
  // NUEVO — total y bandera de regularización: si hay alguna línea "R",
  // se avisa en la tarjeta de que parte del importe de esta nómina no
  // corresponde al mes en sí, sino a un ajuste de un mes anterior —
  // así no sorprende que no cuadre con el calendario o el Excel de
  // ESTE mes.
  var lineasRegularizacion = devengos.filter(function(d){return d.esRegularizacion;})
    .concat(deducciones.filter(function(d){return d.esRegularizacion;}));
  var tieneRegularizacion = lineasRegularizacion.length>0;
  var totalRegularizacion = Math.round(devengos.filter(function(d){return d.esRegularizacion;})
    .reduce(function(s,d){return s+d.importe;},0)*100)/100;
  var mLiquido = texto.match(/LÍQUIDO A PERCIBIR\s+([\d.]+,\d{2})/) || texto.match(/LIQUIDO A PERCIBIR\s+([\d.]+,\d{2})/);
  var toNum = function(s){ return s ? parseFloat(s.replace(/\./g,'').replace(',','.')) : null; };
  return {
    claveMes: claveMes, periodoTexto: periodoTexto,
    devengos: devengos, deducciones: deducciones,
    bruto: bruto,
    liquido: toNum(mLiquido && mLiquido[1]),
    tieneRegularizacion: tieneRegularizacion,
    totalRegularizacion: totalRegularizacion,
    lineasPerdidas: lineasPerdidas
  };
}

// Recalcula, para el MISMO mes que muestra la Nómina Real (anio, mes),
// exactamente lo mismo que ya calcula renderNominaPublica() — mismos
// fijos, mismas variables del mes trabajado — y lo compara concepto a
// concepto con lo que trae el PDF/foto real ya guardado.
function _nominaCompararConReal(anio, mes, datos){
  if(!datos) return null;
  var rol = AJ.rol || 'tripulante';
  var t = TARIFAS_ROL[rol] || TARIFAS_ROL.tripulante;
  var fijos = _nominaConceptosFijos(rol, anio, mes);
  if(AJ.tieneCAPH && parseFloat(AJ.caphImporte)>0){
    fijos.push({label:'Complemento Ad Personam (CAPH)', val: Math.round(parseFloat(AJ.caphImporte)*100)/100});
  }
  var mesTrabajado = _nominaMesAnterior(anio, mes);
  var ks = Object.keys(TV).filter(function(k){
    var d = new Date(k+'T00:00:00');
    return d.getFullYear()===mesTrabajado.anio && d.getMonth()===mesTrabajado.mes-1;
  });
  var earn = calculateEarnings(ks);
  var htdlPuro = _nominaHTDLPuro(ks, t.vh);
  var art5152Importe = _nominaArt5152Importe(ks);
  var totalFijos = fijos.reduce(function(s,f){ return s+f.val; }, 0);

  var conceptosApp = {};
  fijos.forEach(function(f){ conceptosApp[f.label] = (conceptosApp[f.label]||0) + f.val; });
  conceptosApp['HTDL'] = htdlPuro.importe;
  conceptosApp['Nocturnidad'] = earn.totalNoc;
  conceptosApp['Art. 51-52'] = art5152Importe;
  conceptosApp['Plus Activación'] = earn.totalAct;
  conceptosApp['Plus JT'] = earn.totalJT;
  conceptosApp['Plus Internacional'] = earn.totalIntl;
  conceptosApp['Hora Rebase'] = earn.totalRebase;
  conceptosApp['Plus Traslación'] = earn.totalPlusTrasl;

  var brutoApp = Math.round((totalFijos+htdlPuro.importe+art5152Importe+earn.totalNoc+earn.totalAct+earn.totalJT+earn.totalIntl+earn.totalRebase+earn.totalPlusTrasl)*100)/100;

  // Agrupa los devengos REALES (sin las líneas de regularización, que
  // se explican aparte) por concepto de la App que les corresponde.
  // FIX — Confirmado por el usuario: "HTDL FORZOSO" de la nómina real
  // NO es un concepto que la app no calcule — es el MISMO Art. 51-52
  // (retirada/modificación de descanso, protocolo de llamamiento) que
  // ya calcula _nominaArt5152Importe(). Antes se trataba como "no
  // calculado" por error; ahora se empareja con 'Art. 51-52' como
  // cualquier otro concepto, para comparar de verdad manzanas con
  // manzanas.
  var realPorApp = {}, realSinEmparejar = {};
  datos.devengos.forEach(function(d){
    if(d.esRegularizacion) return;
    if(d.esHTDLForzoso){ realPorApp['Art. 51-52'] = (realPorApp['Art. 51-52']||0)+d.importe; return; }
    if(d.esHTDL){ realPorApp['HTDL'] = (realPorApp['HTDL']||0)+d.importe; return; }
    var encontrado = null;
    for(var i=0;i<REAL_CONCEPTO_A_APP.length;i++){
      if(REAL_CONCEPTO_A_APP[i].re.test(d.concepto)){ encontrado = REAL_CONCEPTO_A_APP[i].appKey; break; }
    }
    if(encontrado) realPorApp[encontrado] = (realPorApp[encontrado]||0)+d.importe;
    else realSinEmparejar[d.concepto] = (realSinEmparejar[d.concepto]||0)+d.importe;
  });

  var diffs = [];
  Object.keys(conceptosApp).forEach(function(key){
    var appVal = Math.round((conceptosApp[key]||0)*100)/100;
    var realVal = Math.round((realPorApp[key]||0)*100)/100;
    var dif = Math.round((realVal-appVal)*100)/100;
    if(Math.abs(dif)>=1){
      var item = {concepto:key, appVal:appVal, realVal:realVal, dif:dif, tipo:'concepto'};
      // El Art. 51-52 es justo el que suele confundirse con HTDL normal
      // mal marcado — se adjunta la lista de días HTDL de este mes,
      // para señalar dónde mirar primero.
      if(key==='Art. 51-52') item.diasHTDL = htdlPuro.diasDetalle;
      diffs.push(item);
    }
  });
  Object.keys(realSinEmparejar).forEach(function(concepto){
    var val = Math.round(realSinEmparejar[concepto]*100)/100;
    if(Math.abs(val)>=1) diffs.push({concepto:concepto, appVal:0, realVal:val, dif:val, tipo:'no_calculado'});
  });
  if(datos.bruto!==null){
    var difBruto = Math.round((datos.bruto-brutoApp)*100)/100;
    if(Math.abs(difBruto)>=1) diffs.push({concepto:'Total Bruto', appVal:brutoApp, realVal:datos.bruto, dif:difBruto, tipo:'total'});
  }
  return {diffs:diffs, brutoApp:brutoApp};
}

// El "por qué" de cada diferencia — reglas fijas, no una IA en vivo.
// NUEVO — Confirmado por el usuario: cada fecha señalada en el
// diagnóstico se puede pulsar para ir directo a ese mes del
// calendario (reutiliza curM/renderCal ya existentes) — así no hace
// falta buscar el día a mano, solo tocarlo una vez ya en el mes
// correcto para revisarlo o editarlo.
function _nominaIrAFecha(fecha){
  var p = fecha.split('-');
  curM = new Date(parseInt(p[0],10), parseInt(p[1],10)-1, 1);
  goP('cal');
  if(typeof renderCal==='function') renderCal();
}

function _nominaMotivoDiferencia(item, datos){
  // FIX — Confirmado por el usuario: "HTDL FORZOSO" de la nómina real
  // es el MISMO concepto que Art. 51-52 (retirada/modificación de
  // descanso, Art. 51) — la app SÍ lo calcula, solo que ese mes no
  // encuentra ningún día marcado como tal en el calendario. No basta
  // con decirlo en general — hay que señalar EXACTAMENTE qué días del
  // calendario está contando la app como HTDL normal, para que la
  // persona revise cuál de ellos debería estar marcado como Art.51-52
  // en su lugar.
  if(item.concepto==='Art. 51-52'){
    var dias = item.diasHTDL || [];
    var base = 'El "HTDL FORZOSO" de tu nómina real es el mismo concepto que <b>Art. 51-52</b> (retirada/modificación de descanso, protocolo de llamamiento) — la app sí lo calcula, pero no encuentra ningún día marcado así en tu calendario de este mes trabajado. ';
    if(!dias.length){
      return base+'Tampoco encuentra días de HTDL normal donde pudiera estar el error — revisa que ese día esté cargado en el calendario.';
    }
    var listaDias = dias.map(function(d){
      var p = d.fecha.split('-'); // YYYY-MM-DD
      var etiqueta = (parseInt(p[2],10))+' '+MESES_C[parseInt(p[1],10)-1]+' ('+d.horas+'h)';
      return '<span onclick="_nominaIrAFecha(\''+d.fecha+'\')" style="text-decoration:underline;cursor:pointer;color:#fff">'+etiqueta+'</span>';
    }).join(', ');
    return base+'Revisa estos días, marcados hoy como HTDL normal — uno de ellos es probablemente el que en realidad fue Art. 51-52: <b>'+listaDias+'</b>.';
  }
  if(item.tipo==='no_calculado'){
    return 'Este concepto ("'+item.concepto+'") todavía no lo calcula la app por su cuenta — no está en el calendario ni en las fórmulas de Nómina.';
  }
  if(item.concepto==='Total Bruto' && datos.tieneRegularizacion){
    return 'Parte de esta diferencia es por una <b>regularización de otro mes</b> incluida en esta nómina ('+(datos.totalRegularizacion>=0?'+':'')+datos.totalRegularizacion.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €), que la app no puede prever porque pertenece a otro periodo. El resto de la diferencia lo explican los conceptos marcados arriba.';
  }
  if(item.concepto==='Total Bruto'){
    return 'La suma de los conceptos marcados arriba explica esta diferencia.';
  }
  return 'Revisa que ese concepto esté bien registrado en tu calendario para este mes — puede que falte un día, o que esté marcado con un tipo distinto al que corresponde.';
}

function _construirCardReal(anioParam, mesParam, origenParam){
  var anio = anioParam || statsM.getFullYear();
  var mes = mesParam || (statsM.getMonth()+1);
  var origen = origenParam || 'admin';
  var claveMes = anio+'-'+String(mes).padStart(2,'0');
  var datos = _nominaRealPorMes[claveMes];

  var cuerpo = '<div style="display:flex;gap:8px;margin:0 16px 12px">'
    + '<div style="flex:1;padding:14px 8px;border:1.5px dashed var(--div);border-radius:14px;text-align:center;cursor:pointer" onclick="_nominaRealAbrirSelector(\'pdf\',\''+origen+'\')">'
    + '<div style="font-size:20px;margin-bottom:4px">📄</div>'
    + '<div style="font-size:10.5px;color:var(--tx2);font-weight:700">PDF</div></div>'
    + '<div style="flex:1;padding:14px 8px;border:1.5px dashed var(--div);border-radius:14px;text-align:center;cursor:pointer" onclick="_nominaRealAbrirSelector(\'img\',\''+origen+'\')">'
    + '<div style="font-size:20px;margin-bottom:4px">📷</div>'
    + '<div style="font-size:10.5px;color:var(--tx2);font-weight:700">Foto/captura</div></div>'
    + '</div>'
    + '<div style="margin:-6px 16px 12px;text-align:center;font-size:9.5px;color:var(--tx3)">'+(datos?'Ya tienes una guardada — sube otra para actualizarla':'Sube el PDF de Serveo, o una foto/captura si el PDF da problemas')+'</div>';

  if(!datos){
    cuerpo += '<div style="padding:6px 20px 16px;text-align:center;color:var(--tx3);font-size:11.5px">Todavía no has subido la nómina real de este mes.</div>';
  } else {
    // NUEVO — Confirmado por el usuario: si muchas líneas de la tabla
    // no se pudieron leer bien (típico de fotos con mala calidad de
    // OCR — comas perdidas, códigos confundidos con letras), avisar
    // claramente en vez de enseñar un desglose incompleto como si
    // estuviera completo. Umbral de 3: por debajo, se asume que son
    // solo un par de líneas sueltas raras (normal, no pasa nada).
    if(datos.lineasPerdidas>=3){
      cuerpo += '<div style="margin:0 16px 12px;padding:12px 14px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.4);border-radius:12px">'
        + '<div style="font-size:12px;font-weight:800;color:#fca5a5;margin-bottom:4px">⚠️ Lectura incompleta ('+datos.lineasPerdidas+' líneas no se pudieron leer bien)</div>'
        + '<div style="font-size:11px;color:#fca5a5;line-height:1.5">La foto tiene demasiados errores de lectura (números y códigos poco claros) — el desglose de abajo puede faltarle conceptos o tener importes equivocados. '
        + 'Si puedes, sube el <b>PDF original</b> en vez de la foto (más abajo tienes el botón 📄 PDF) — ahí no hay que "adivinar" el texto, se lee exacto.</div>'
        + '</div>';
    }
    // NUEVO — Confirmado por el usuario: aviso claro cuando el PDF trae
    // líneas de Regularización (marcadas con "R" delante en el propio
    // documento) — importes que NO corresponden a este mes, sino a un
    // ajuste de un mes anterior. Sin este aviso, comparar esta nómina
    // con el calendario o el Excel del mes JAMÁS cuadra, y no queda
    // claro por qué.
    if(datos.tieneRegularizacion){
      cuerpo += '<div style="margin:0 16px 12px;padding:12px 14px;background:rgba(217,119,6,.12);border:1px solid rgba(217,119,6,.4);border-radius:12px">'
        + '<div style="font-size:12px;font-weight:800;color:var(--nar2);margin-bottom:4px">📌 Esta nómina incluye una regularización</div>'
        + '<div style="font-size:11px;color:var(--nar3);line-height:1.5">Las filas marcadas con <b>"R"</b> (regularización) no son de este mes — son un ajuste de un mes anterior, por '
        + (datos.totalRegularizacion>=0?'+':'')+datos.totalRegularizacion.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €. '
        + 'Por eso el total de este mes no va a coincidir exacto con tu calendario ni con el Excel — esa diferencia es justo la regularización.</div>'
        + '</div>';
    }
    cuerpo += '<div class="nom-sec-hdr">Devengos (tal cual el PDF) · '+datos.periodoTexto+'</div>';
    datos.devengos.forEach(function(d){
      // Distingue HTDL normal de HTDL Forzoso (Art. 51 — último recurso
      // del protocolo, se paga a 1,5× la tarifa) y marca las líneas de
      // regularización, en vez de mezclarlas sin explicación.
      var etiqueta = d.concepto;
      if(d.esHTDLForzoso) etiqueta = '⚡ '+etiqueta+' <span style="font-weight:600;color:var(--nar3)">(se paga más — 1,5×)</span>';
      var sub = d.esRegularizacion ? '📌 Regularización de un mes anterior' : null;
      cuerpo += _nominaFila(etiqueta, sub, d.importe);
    });
    if(datos.bruto!==null) cuerpo += '<div class="nom-total-bruto"><span class="nom-total-bruto-lbl">TOTAL BRUTO (T.DEVENGO)</span><span class="nom-total-bruto-val">'+datos.bruto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';
    // NUEVO — Confirmado por el usuario: enlace de diagnóstico SIEMPRE
    // visible (no solo cuando falla el periodo) — por si el Total
    // Bruto no coincide con el del documento real aunque la lectura
    // "haya funcionado", para poder ver el texto exacto que se leyó y
    // encontrar qué línea concreta se perdió o se leyó mal.
    cuerpo += '<div style="text-align:center;margin:2px 0 4px"><span onclick="_nominaVerTextoCrudo()" style="font-size:10px;color:var(--tx3);text-decoration:underline;cursor:pointer">🔍 ¿No coincide con tu nómina real? Ver texto leído</span></div>';
    cuerpo += '<div class="nom-sec-hdr">Deducciones</div>';
    // NUEVO — Confirmado por Alex: se muestra la base y el % de cada
    // deducción cuando el PDF lo trae (ej. "4,85% sobre 2.842,26 €"),
    // no solo el importe final. La Cuota Sindical es la ÚNICA que se
    // puede "aprender" y aplicar directo a Excel/Calendario, por ser
    // un importe fijo — el IRPF cambia cada mes y la Seg. Social se
    // deja siempre a mano en las otras pestañas, por seguridad, tal
    // como pidió Alex ("es mejor así por si algo cambia").
    var cuotaSindicalDetectada = null;
    datos.deducciones.forEach(function(d){
      var sub = (d.base!==undefined && d.porcentaje!==undefined) ? (d.porcentaje.toLocaleString('es-ES')+'% sobre '+d.base.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €') : (d.esRegularizacion?'📌 Regularización de un mes anterior':null);
      cuerpo += _nominaFila(d.concepto, sub, -d.importe);
      if(d.concepto.toUpperCase().indexOf('CUOTA SINDICAL')>=0) cuotaSindicalDetectada = d.importe;
    });
    if(datos.liquido!==null) cuerpo += '<div class="nom-total-neto"><span class="nom-total-neto-lbl">LÍQUIDO A PERCIBIR</span><span class="nom-total-neto-val">'+datos.liquido.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';
    if(cuotaSindicalDetectada!==null){
      var _destinoTxt = origen==='publica' ? 'tu Nómina' : 'las pestañas Excel y Calendario';
      cuerpo += '<div style="margin:12px 16px;padding:14px;background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(124,58,237,.04));border:1px solid rgba(124,58,237,.4);border-radius:14px">'
        + '<div style="font-size:11.5px;font-weight:800;color:#c4b5fd;margin-bottom:6px">🧠 Cuota Sindical detectada: '+cuotaSindicalDetectada.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</div>'
        + '<div style="font-size:10.5px;color:var(--tx2);line-height:1.5;margin-bottom:10px">Es un importe fijo — puedes aplicarlo directo a '+_destinoTxt+', sin escribirlo a mano. (El IRPF y la Seg. Social se quedan siempre manuales, ya que pueden cambiar cada mes.)</div>'
        + '<button onclick="_nominaAplicarCuotaSindical('+cuotaSindicalDetectada+',\''+origen+'\')" style="width:100%;padding:11px;background:#7c3aed;border:none;border-radius:10px;color:#fff;font-weight:800;font-size:12px;cursor:pointer">✅ Usar '+cuotaSindicalDetectada.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' € en '+_destinoTxt+'</button></div>';
    }
    // NUEVO — Confirmado por el usuario: diagnóstico automático de
    // diferencias. Compara concepto a concepto contra lo que ya
    // calcula la propia app para este mismo mes, y explica el motivo
    // más probable de cada diferencia (ver _nominaCompararConReal /
    // _nominaMotivoDiferencia arriba).
    var diag = _nominaCompararConReal(anio, mes, datos);
    if(diag && diag.diffs.length){
      cuerpo += '<div class="nom-sec-hdr">🔎 ¿Por qué no coincide?</div>';
      diag.diffs.forEach(function(item){
        var motivo = _nominaMotivoDiferencia(item, datos);
        cuerpo += '<div style="background:var(--s1);border:1px solid rgba(249,115,22,.35);border-left:3px solid var(--nar2);border-radius:10px;padding:10px 12px;margin:0 16px 8px">'
          + '<div style="font-size:12px;font-weight:800;color:var(--nar2);display:flex;justify-content:space-between;gap:8px"><span>'+item.concepto+'</span><span style="font-size:10.5px;color:var(--nar3);font-weight:700;white-space:nowrap">'+(item.dif>=0?'+':'')+item.dif.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
          + '<div style="font-size:11px;color:var(--tx2);line-height:1.5;margin-top:5px">'+motivo+'</div>'
          + '</div>';
      });
    } else if(diag){
      cuerpo += '<div style="margin:10px 16px 4px;padding:10px 12px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.35);border-radius:10px;text-align:center;font-size:11px;color:var(--green2);font-weight:700">✅ Todo coincide dentro de lo esperado</div>';
    }
  }
  return '<div class="n2-card real"><div class="n2-hdr">🧾 Nómina Real (PDF)<span class="n2-badge">REFERENCIA</span></div><div class="n2-body">'+cuerpo+'</div></div>';
}
// NUEVO — un único par de <input type="file"> ocultos se comparten
// entre el modal de Admin y la pantalla pública de Nómina. Antes de
// abrir el selector, se anota "quién" lo pidió (window._nominaRealOrigen)
// para que, al terminar de leer el archivo, se actualice el sitio
// correcto (y con el mes correcto: statsM en Admin, nomM en público).
function _nominaRealAbrirSelector(tipo, origen){
  window._nominaRealOrigen = origen || 'admin';
  var idInput = tipo==='pdf' ? 'fileNominaRealPdf' : 'fileNominaRealImg';
  var el = document.getElementById(idInput);
  if(el) el.click();
}
// Contenedor donde mostrar "Leyendo tu nómina…" mientras se procesa,
// y donde reconstruir el resultado — depende de quién lo pidió.
function _nominaRealStatusContainer(){
  var origen = window._nominaRealOrigen || 'admin';
  return document.getElementById(origen==='publica' ? 'nomina-real-pub-wrap' : 'nomina-body');
}
// Vuelve a construir solo esta tarjeta tras subir un PDF nuevo, sin
// tocar las otras dos (evita perder lo que se haya escrito a mano ahí).
function renderNominaReal(){
  var origen = window._nominaRealOrigen || 'admin';
  if(origen==='publica'){
    var wrap = document.getElementById('nomina-real-pub-wrap');
    if(!wrap) return;
    var anioPub = nomM ? nomM.getFullYear() : undefined;
    var mesPub = nomM ? (nomM.getMonth()+1) : undefined;
    wrap.innerHTML = _construirCardReal(anioPub, mesPub, 'publica');
    return;
  }
  var el = document.querySelector('#nomina-body .n2-card.real');
  if(el) el.outerHTML = _construirCardReal(undefined, undefined, 'admin');
  else renderNominaTodasLasCaras();
}

// NUEVO — Confirmado por Alex: solo la Cuota Sindical (importe fijo)
// se puede aplicar directo a Excel y Calendario desde la Nómina Real
// leída — IRPF y Seg. Social se quedan siempre manuales. Reconstruye
// las tarjetas que corresponda según quién lo pidió (Admin o Nómina
// pública) para que se vea el campo ya relleno.
function _nominaAplicarCuotaSindical(importe, origen){
  _nominaValoresManuales.cuotaSindical = importe;
  _guardarNominaValoresManuales();
  if(origen==='publica'){
    if(typeof renderNominaPublica==='function') renderNominaPublica();
    toast('✅ Cuota Sindical ('+importe.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €) aplicada a tu Nómina');
  } else {
    renderNominaTodasLasCaras();
    toast('✅ Cuota Sindical ('+importe.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €) aplicada a Excel y Calendario');
  }
}

function _nominaFila(label, sub, val){
  return '<div class="nom-row"><div><div class="nom-row-label">'+label+'</div>'
    +(sub?'<div class="nom-row-sub">'+sub+'</div>':'')+'</div>'
    +'<span class="nom-row-val">'+val.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';
}

// NUEVO — Confirmado por Alex: si trabajaste de más un mes y elegiste
// que se te compensara con un DÍA LIBRE (no con dinero), ese día se
// disfruta más adelante como "COMPE" (tipo:'comp' en el calendario).
// El mes en que lo disfrutas, la referencia de 163h efectivas baja
// 5,5h por cada día COMPE de ese mes — ese día ya no ibas a trabajar
// de todas formas, así que no debe contar en tu contra. El nuevo
// número (ej. 163 - 2×5,5 = 152h) pasa a ser el "100%" real de ese
// mes, tanto para calcular Hora Extraordinaria como Presencia.
function _nominaJornadaRefAjustada(anio, mes){
  var claveMes = anio+'-'+String(mes).padStart(2,'0');
  // FIX — Confirmado por el usuario: si ese mes tiene un valor MANUAL
  // guardado (porque ese mes no se cargó día a día en el calendario,
  // p.ej. se subió el Horario Individual), ese número manda por
  // encima del conteo automático de días 'comp' en TV.
  if(Object.prototype.hasOwnProperty.call(_diasCompeManual, claveMes)){
    var diasCompeMan = parseFloat(_diasCompeManual[claveMes]) || 0;
    return { ref: Math.max(0, 163 - diasCompeMan*5.5), diasCompe: diasCompeMan, manual: true };
  }
  var diasCompe = 0;
  Object.keys(TV).forEach(function(k){
    var d = new Date(k+'T00:00:00');
    if(d.getFullYear()===anio && d.getMonth()===mes-1 && TV[k] && TV[k].tipo==='comp') diasCompe++;
  });
  return { ref: Math.max(0, 163 - diasCompe*5.5), diasCompe: diasCompe, manual: false };
}

// NUEVO — Confirmado por Alex: los conceptos variables/pluses (Hora
// Extraordinaria, Nocturnidad, Rebase, Plus Traslación, HTDL,
// Art.51/52, Plus Activación, Plus JT, Plus Internacional) se pagan a
// MES VENCIDO — lo trabajado en julio se cobra en la nómina de
// agosto. El Cómputo Excel ya se guarda bajo la clave del mes que de
// verdad cubre (las fechas reales dentro del archivo, ver
// handleComputoExcelUpload), así que aquí solo hace falta mirar un
// mes atrás del que se está viendo en pantalla. Los conceptos FIJOS
// (Salario Base, Paga de Marzo...) siguen yendo con el mes que se ve,
// sin retraso — eso no cambia.
function _nominaMesAnterior(anio, mes){
  // mes en formato 1-12 (como el resto de _nominaConceptosFijos/claveMes)
  if(mes<=1) return { anio: anio-1, mes: 12 };
  return { anio: anio, mes: mes-1 };
}

function _construirCardExcel(){
  var anio=statsM.getFullYear(), mes=statsM.getMonth()+1;
  // FIX — Confirmado por Alex (mes vencido): los pluses/conceptos
  // variables que se COBRAN en el mes que se está viendo (ej. agosto)
  // son los que se TRABAJARON el mes anterior (julio) — por eso el
  // Cómputo Excel a consultar aquí es el del mes anterior, no el
  // mismo. Los conceptos fijos, un poco más abajo, siguen usando
  // (anio, mes) tal cual — esos no llevan retraso.
  var mesTrabajado = _nominaMesAnterior(anio, mes);
  var claveMes = mesTrabajado.anio+'-'+String(mesTrabajado.mes).padStart(2,'0');
  var datosExcel = _computoExcelPorMes[claveMes];
  var rol = AJ.rol||'tripulante';
  var t = TARIFAS_ROL[rol]||TARIFAS_ROL.tripulante;
  var envolver = function(cuerpo){ return '<div class="n2-card excel"><div class="n2-hdr">📄 Desde el Excel</div><div class="n2-body">'+cuerpo+'</div></div>'; };

  // FIX — Confirmado por Alex: los conceptos fijos (Salario Base,
  // Paga de Marzo, etc.) NO dependen del Cómputo Excel — solo
  // dependen de tu rol y tu antigüedad. Antes, si no habías subido el
  // Excel de ese mes, TODA la tarjeta se quedaba vacía, incluida la
  // Paga de Marzo, aunque no tuviera nada que ver con el Excel. Ahora
  // los fijos siempre se calculan y se muestran; solo la parte de
  // horas variables pide el Excel si falta.
  var fijos = _nominaConceptosFijos(rol, anio, mes);
  var totalFijos = fijos.reduce(function(s,f){ return s+f.val; }, 0);
  var htmlFijos = '<div class="nom-sec-hdr">Conceptos fijos</div>';
  fijos.forEach(function(f){ htmlFijos += _nominaFila(f.label, null, f.val); });

  if(!datosExcel || !datosExcel.porDia){
    window._nominaBaseCalculo = null;
    return envolver(htmlFijos
      + '<div class="nom-total-bruto"><span class="nom-total-bruto-lbl">FIJOS (parcial)</span><span class="nom-total-bruto-val">'+totalFijos.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>'
      + '<div style="padding:16px 18px;text-align:center;color:var(--tx3);font-size:11.5px">'
      +'📊 Los pluses de esta nómina salen de lo trabajado en '+MESES[mesTrabajado.mes-1]+' (se cobran a mes vencido). Sube ese Cómputo Excel con el botón "Comparar con Cómputo Oficial", en Ajustes, para ver también las horas variables y el Bruto/Neto completos.</div>');
  }

  // Sumar minutos de todo el mes desde el Cómputo Excel ya guardado
  var sumaMin = {HE:0, HP:0, Noct:0, Rebase:0, PlusTrasl:0};
  Object.keys(datosExcel.porDia).forEach(function(k){
    var d = datosExcel.porDia[k];
    sumaMin.HE += d.HE||0; sumaMin.HP += d.HP||0; sumaMin.Noct += d.Noct||0;
    sumaMin.Rebase += d.Rebase||0; sumaMin.PlusTrasl += d.PlusTrasl||0;
  });
  var horas = {}; Object.keys(sumaMin).forEach(function(k){ horas[k] = Math.round((sumaMin[k]/60)*100)/100; });

  // FIX — Confirmado por Alex (mes vencido): esta referencia se
  // compara contra horas.HE, que ahora viene del mes TRABAJADO (el
  // anterior) — así que la referencia (163h − días COMPE) también
  // tiene que calcularse sobre ese mismo mes anterior, no el que se
  // está viendo en pantalla.
  var refAjustada = _nominaJornadaRefAjustada(mesTrabajado.anio, mesTrabajado.mes);
  var JORNADA_REF = refAjustada.ref;
  var horasExtra = Math.max(0, horas.HE - JORNADA_REF);
  // QUITADO — Confirmado por Alex: las horas de Presencia (tanto la
  // de "completar la referencia" como la propia columna H.P. del
  // Excel) YA ESTÁN incluidas dentro del Salario Base — no son un
  // pago aparte. Sumarlas aquí habría sido pagar dos veces por lo
  // mismo. Solo se queda la Hora Extraordinaria (por encima de la
  // referencia), que sí es un concepto adicional real.

  var mv = _nominaValoresManuales;
  var refTexto = refAjustada.diasCompe>0 ? (JORNADA_REF+'h (163h − '+refAjustada.diasCompe+' día(s) COMPE × 5,5h)') : '163h';
  var variables = [
    {label:'Hora Extraordinaria', sub:horasExtra.toLocaleString('es-ES')+' h × '+t.horaExtra.toFixed(2)+' €'+(horas.HE<JORNADA_REF?' (no llegaste a '+refTexto+', ya incluido en el Salario Base)':''), val:Math.round(horasExtra*t.horaExtra*100)/100},
    {label:'Nocturnidad', sub:horas.Noct.toLocaleString('es-ES')+' h × '+t.nocturnidad.toFixed(2)+' €', val:Math.round(horas.Noct*t.nocturnidad*100)/100},
    {label:'Rebase', sub:horas.Rebase.toLocaleString('es-ES')+' h × '+t.rebase.toFixed(2)+' €', val:Math.round(horas.Rebase*t.rebase*100)/100},
    {label:'Plus Traslación', sub:horas.PlusTrasl.toLocaleString('es-ES')+' h × '+t.plusTrasl.toFixed(2)+' €', val:Math.round(horas.PlusTrasl*t.plusTrasl*100)/100},
  ];
  var totalVariables = variables.reduce(function(s,v){ return s+v.val; }, 0);
  var htdlImporte = Math.round(mv.htdlHoras*t.vh*100)/100;
  var art5152Importe = Math.round(mv.art5152Horas*t.art5152Monto*100)/100;

  var bruto = Math.round((totalFijos+totalVariables+htdlImporte+art5152Importe)*100)/100;
  var ssImporte = Math.round(bruto*mv.ssPct/100*100)/100;
  var irpfImporte = Math.round(bruto*mv.irpfPct/100*100)/100;
  var neto = Math.round((bruto-ssImporte-mv.cuotaSindical-irpfImporte)*100)/100;

  var html = '<div class="nom-disclaimer">🧪 Estimación calculada a partir de tu cómputo Excel y las tarifas oficiales — puede no coincidir al céntimo con tu nómina de verdad. Los pluses se pagan a mes vencido: los de abajo corresponden a lo trabajado en <b>'+MESES[mesTrabajado.mes-1]+'</b>, que es lo que se cobra en esta nómina de '+MESES[mes-1]+'.</div>';
  html += htmlFijos;
  html += '<div class="nom-sec-hdr">Conceptos variables (de '+MESES[mesTrabajado.mes-1]+', se cobran a mes vencido)</div>';
  variables.forEach(function(v){ html += _nominaFila(v.label, v.sub, v.val); });

  html += '<div class="nom-row nom-row-manual"><div><div class="nom-row-label">✍️ HTDL (ponlo tú)</div>'
    +'<div class="nom-row-sub">De '+MESES[mesTrabajado.mes-1]+' · <input class="nom-input-mini" id="nom-htdl-horas" value="'+mv.htdlHoras+'" oninput="_nominaActualizarManual()"> h × '+t.vh.toFixed(2)+' €</div></div>'
    +'<span class="nom-row-val" id="nom-htdl-val">'+htdlImporte.toFixed(2)+' €</span></div>';
  html += '<div class="nom-row nom-row-manual"><div><div class="nom-row-label">✍️ Art.51/52 (ponlo tú)</div>'
    +'<div class="nom-row-sub">De '+MESES[mesTrabajado.mes-1]+' · <input class="nom-input-mini" id="nom-art-horas" value="'+mv.art5152Horas+'" oninput="_nominaActualizarManual()"> h × '+t.art5152Monto.toFixed(2)+' €</div></div>'
    +'<span class="nom-row-val" id="nom-art-val">'+art5152Importe.toFixed(2)+' €</span></div>';

  html += '<div class="nom-total-bruto"><span class="nom-total-bruto-lbl">TOTAL BRUTO</span><span class="nom-total-bruto-val" id="nom-bruto-val">'+bruto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';

  html += '<div class="nom-row nom-row-manual"><div><div class="nom-row-label">✍️ Seg. Social (ponlo tú)</div><div class="nom-row-sub">% sobre el Bruto</div></div>'
    +'<div><input class="nom-input-mini" id="nom-ss-pct" value="'+mv.ssPct+'" oninput="_nominaActualizarManual()"> %</div></div>';
  html += '<div class="nom-row nom-row-manual"><div><div class="nom-row-label">✍️ Cuota Sindical (ponlo tú)</div><div class="nom-row-sub">importe fijo</div></div>'
    +'<div><input class="nom-input-mini" id="nom-cuota" value="'+mv.cuotaSindical+'" oninput="_nominaActualizarManual()"> €</div></div>';
  html += '<div class="nom-row nom-row-manual"><div><div class="nom-row-label">✍️ IRPF (ponlo tú)</div><div class="nom-row-sub">% sobre el Bruto</div></div>'
    +'<div><input class="nom-input-mini" id="nom-irpf-pct" value="'+mv.irpfPct+'" oninput="_nominaActualizarManual()"> %</div></div>';

  html += '<div class="nom-total-neto"><span class="nom-total-neto-lbl">TOTAL NETO ESTIMADO</span><span class="nom-total-neto-val" id="nom-neto-val">'+neto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';

  // Guarda lo necesario para recalcular en vivo sin reconstruir todo el HTML
  window._nominaBaseCalculo = {totalFijos:totalFijos, totalVariables:totalVariables, t:t};
  return envolver(html);
}

// NUEVO — Recalcula SOLO los totales (Bruto/Neto) cuando la persona
// edita un campo manual, sin reconstruir toda la pantalla (evita
// perder el foco del campo que se está editando).
function _nominaActualizarManual(){
  var base = window._nominaBaseCalculo; if(!base) return;
  var htdlHoras = parseFloat(document.getElementById('nom-htdl-horas').value)||0;
  var artHoras = parseFloat(document.getElementById('nom-art-horas').value)||0;
  var ssPct = parseFloat(document.getElementById('nom-ss-pct').value)||0;
  var cuota = parseFloat(document.getElementById('nom-cuota').value)||0;
  var irpfPct = parseFloat(document.getElementById('nom-irpf-pct').value)||0;
  _nominaValoresManuales = {htdlHoras:htdlHoras, art5152Horas:artHoras, ssPct:ssPct, cuotaSindical:cuota, irpfPct:irpfPct};
  _guardarNominaValoresManuales();

  var htdlImporte = Math.round(htdlHoras*base.t.vh*100)/100;
  var artImporte = Math.round(artHoras*base.t.art5152Monto*100)/100;
  var bruto = Math.round((base.totalFijos+base.totalVariables+htdlImporte+artImporte)*100)/100;
  var ssImporte = Math.round(bruto*ssPct/100*100)/100;
  var irpfImporte = Math.round(bruto*irpfPct/100*100)/100;
  var neto = Math.round((bruto-ssImporte-cuota-irpfImporte)*100)/100;

  document.getElementById('nom-htdl-val').textContent = htdlImporte.toFixed(2)+' €';
  document.getElementById('nom-art-val').textContent = artImporte.toFixed(2)+' €';
  document.getElementById('nom-bruto-val').textContent = bruto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  document.getElementById('nom-neto-val').textContent = neto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
}

// NUEVO — Confirmado por Alex: en la Nómina Estimada NO se calculan
// los enlaces de jornada entre HTDL y Art.51/52 (un caso especial
// que calculateEarnings() sí incluye, mezclando algo de Art.51/52
// dentro del total de HTDL — correcto para Stats, pero no para aquí).
// Esta función usa solo calcularJornadaDiaria() por día (las horas
// "base" de cada jornada, sin la parte añadida de enlace cruzado con
// Art.51/52), y las paga a la tarifa de HTDL — un número más simple
// y limpio, pensado solo para esta pantalla.
function _nominaHTDLPuro(ks, tarifaHTDL){
  var minTotal = 0;
  // NUEVO — Confirmado por el usuario: además del total, se guarda el
  // detalle día a día (fecha + horas) — así el diagnóstico de
  // diferencias puede señalar EXACTAMENTE qué días de tu calendario
  // son los que la app está contando como HTDL, para que puedas ir a
  // revisar cuál de ellos debería estar marcado como Forzoso.
  var diasDetalle = [];
  ks.forEach(function(k){
    var turnosDelDia = [TV[k]].concat(TV2[k]||[]);
    var jornada = calcularJornadaDiaria(turnosDelDia, k);
    var minDia = jornada.efectivasHTDLMin||0;
    minTotal += minDia;
    if(minDia>0){
      diasDetalle.push({fecha:k, horas: Math.round((minDia/60)*100)/100});
    }
  });
  diasDetalle.sort(function(a,b){ return a.fecha<b.fecha?-1:1; });
  var horas = Math.round((minTotal/60)*100)/100;
  return { horas: horas, importe: Math.round(horas*tarifaHTDL*100)/100, diasDetalle: diasDetalle };
}

function _construirCardCalendario(){
  var anio=statsM.getFullYear(), mes=statsM.getMonth();
  var rol = AJ.rol||'tripulante';
  var t = TARIFAS_ROL[rol]||TARIFAS_ROL.tripulante;
  // FIX — Confirmado por Alex (mes vencido): igual que en la tarjeta
  // del Excel, los pluses que se COBRAN el mes que se ve (ej. agosto)
  // son los que se TRABAJARON el mes anterior (julio) — así que los
  // días del Calendario a sumar son los del mes anterior, no el
  // mismo. Los conceptos fijos, justo abajo, siguen usando (anio, mes+1)
  // tal cual — esos no llevan retraso.
  var mesTrabajado = _nominaMesAnterior(anio, mes+1); // convierte a 1-12 antes de restar
  var ks = Object.keys(TV).filter(function(k){
    var d = new Date(k+'T00:00:00');
    return d.getFullYear()===mesTrabajado.anio && d.getMonth()===mesTrabajado.mes-1;
  });
  var earn = calculateEarnings(ks);
  var htdlPuro = _nominaHTDLPuro(ks, t.vh);

  var fijos = _nominaConceptosFijos(rol, anio, mes+1);
  var totalFijos = fijos.reduce(function(s,f){ return s+f.val; }, 0);
  // FIX — se usa htdlPuro.importe en vez de earn.totalHTDL (que
  // mezcla algo de Art.51/52 en casos de enlace de jornada cruzado).
  var totalVariablesResto = earn.totalNoc+earn.totalAct+earn.totalJT+earn.totalIntl;
  var bruto = Math.round((totalFijos + htdlPuro.importe + totalVariablesResto)*100)/100;

  // NUEVO — Confirmado por Alex: las mismas deducciones (Seg. Social,
  // Cuota Sindical, IRPF) también aquí, no solo en la pestaña del
  // Excel. Comparten el mismo _nominaValoresManuales — son datos de
  // TU situación personal, iguales sin importar qué pestaña mires.
  var mv = _nominaValoresManuales;
  var ssImporte = Math.round(bruto*mv.ssPct/100*100)/100;
  var irpfImporte = Math.round(bruto*mv.irpfPct/100*100)/100;
  var neto = Math.round((bruto-ssImporte-mv.cuotaSindical-irpfImporte)*100)/100;

  var html = '<div class="nom-disclaimer">🧪 Este HTDL NO incluye enlaces de jornada con Art.51/52 (confirmado por Alex) — puede diferir un poco del Total a Pagar de Stats por eso mismo. Los pluses se pagan a mes vencido: los de abajo corresponden a lo trabajado en <b>'+MESES[mesTrabajado.mes-1]+'</b>, que es lo que se cobra en esta nómina de '+MESES[mes]+'.</div>';
  html += '<div class="nom-sec-hdr">Conceptos fijos</div>';
  fijos.forEach(function(f){ html += _nominaFila(f.label, null, f.val); });
  html += '<div class="nom-sec-hdr">Conceptos variables (de '+MESES[mesTrabajado.mes-1]+', se cobran a mes vencido)</div>';
  html += _nominaFila('HTDL', htdlPuro.horas+' h × '+t.vh.toFixed(2)+' €', htdlPuro.importe);
  html += _nominaFila('Nocturnidad', null, earn.totalNoc);
  html += _nominaFila('Plus Activación', null, earn.totalAct);
  html += _nominaFila('Plus JT', null, earn.totalJT);
  html += _nominaFila('Plus Internacional', null, earn.totalIntl);

  html += '<div class="nom-total-bruto"><span class="nom-total-bruto-lbl">TOTAL BRUTO</span><span class="nom-total-bruto-val" id="nomcal-bruto-val">'+bruto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';

  html += '<div class="nom-row nom-row-manual"><div><div class="nom-row-label">✍️ Seg. Social (ponlo tú)</div><div class="nom-row-sub">% sobre el Bruto</div></div>'
    +'<div><input class="nom-input-mini" id="nomcal-ss-pct" value="'+mv.ssPct+'" oninput="_nominaActualizarManualCalendario()"> %</div></div>';
  html += '<div class="nom-row nom-row-manual"><div><div class="nom-row-label">✍️ Cuota Sindical (ponlo tú)</div><div class="nom-row-sub">importe fijo</div></div>'
    +'<div><input class="nom-input-mini" id="nomcal-cuota" value="'+mv.cuotaSindical+'" oninput="_nominaActualizarManualCalendario()"> €</div></div>';
  html += '<div class="nom-row nom-row-manual"><div><div class="nom-row-label">✍️ IRPF (ponlo tú)</div><div class="nom-row-sub">% sobre el Bruto</div></div>'
    +'<div><input class="nom-input-mini" id="nomcal-irpf-pct" value="'+mv.irpfPct+'" oninput="_nominaActualizarManualCalendario()"> %</div></div>';

  html += '<div class="nom-total-neto"><span class="nom-total-neto-lbl">TOTAL NETO ESTIMADO</span><span class="nom-total-neto-val" id="nomcal-neto-val">'+neto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</span></div>';

  window._nominaCalBruto = bruto; // guardado para recalcular en vivo sin reconstruir todo el HTML
  return '<div class="n2-card cal"><div class="n2-hdr">📅 Desde tu Calendario</div><div class="n2-body">'+html+'</div></div>';
}

// NUEVO — Recalcula solo Bruto/Neto de la pestaña "Desde tu
// Calendario" cuando se edita un campo manual, igual que ya hace
// _nominaActualizarManual() para la pestaña del Excel.
function _nominaActualizarManualCalendario(){
  var bruto = window._nominaCalBruto; if(bruto===undefined) return;
  var ssPct = parseFloat(document.getElementById('nomcal-ss-pct').value)||0;
  var cuota = parseFloat(document.getElementById('nomcal-cuota').value)||0;
  var irpfPct = parseFloat(document.getElementById('nomcal-irpf-pct').value)||0;
  _nominaValoresManuales.ssPct = ssPct;
  _nominaValoresManuales.cuotaSindical = cuota;
  _nominaValoresManuales.irpfPct = irpfPct;
  _guardarNominaValoresManuales();

  var ssImporte = Math.round(bruto*ssPct/100*100)/100;
  var irpfImporte = Math.round(bruto*irpfPct/100*100)/100;
  var neto = Math.round((bruto-ssImporte-cuota-irpfImporte)*100)/100;
  document.getElementById('nomcal-neto-val').textContent = neto.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
}
