/* TrenTurnos v5 — Panel de administrador (sesión, horario general, intervención, solicitudes)
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function abrirAccesoAdmin(){
  // FIX — si ya se detectó sesión de admin en segundo plano (por
  // ejemplo, tras recargar la app), pulsar el icono abre el Panel
  // directamente, sin pedir usuario/contraseña otra vez.
  if(perfilAdminActual && perfilAdminActual.rol === 'admin'){
    document.getElementById('adminSesionLbl').textContent = 'Administrador: '+perfilAdminActual.email;
    openOv('ov-panel-admin');
    refrescarEstadoArchivosAdmin();
    // NUEVO — Confirmado por Alex: la lista de Horarios Generales
    // guardados (con el botón "Eliminar" de cada mes) se carga sola
    // al abrir el panel, sin tener que pulsar "Actualizar lista" a
    // mano — así nunca da la sensación de que el botón "desapareció".
    if(typeof cargarHistorialHorarioGeneral==='function') cargarHistorialHorarioGeneral();
    // NUEVO — solo el badge de pendientes se carga sola al abrir el
    // panel (consulta ligera); la lista completa sigue pidiendo
    // "Actualizar lista", igual que las demás tarjetas del panel.
    if(typeof cargarSolicitudesAccesoAdmin==='function') cargarSolicitudesAccesoAdmin();
    return;
  }
  // SIMPLIFICADO — se quita del todo el paso de "Mi cuenta en la
  // nube" (crear cuenta / iniciar sesión con matrícula+PIN): ese
  // sistema quedó fuera. Este botón va directo al login de
  // administrador, que es la única vía de acceso que queda.
  openOv('ov-admin-login');
}

// NUEVO — Cierra la sesión de administrador en ESTE dispositivo. Tras
// esto, perfilAdminActual queda a null, así que TODAS las funciones
// admin (subirArchivoGlobalAdmin, guardarHorarioEnNube, eliminar*, etc.)
// vuelven a bloquearse solas, porque todas comprueban
// "perfilAdminActual && perfilAdminActual.rol==='admin'" antes de hacer
// nada. Así se evita guardar/publicar algo sin querer mientras la
// sesión sigue abierta.
async function cerrarSesionAdmin(){
  await sbAdmin.auth.signOut();
  perfilAdminActual = null;
  var btnAdmin = document.getElementById('hbtn-admin');
  if(btnAdmin) btnAdmin.classList.remove('es-admin');
  document.body.classList.remove('modo-admin');
  closeOv('ov-panel-admin');
  toast('🚪 Sesión de administrador cerrada');
}

async function iniciarSesionAdmin(){
  var email = document.getElementById('adminEmailInput').value.trim();
  var password = document.getElementById('adminPasswordInput').value;
  var msg = document.getElementById('adminLoginMsg');
  var btn = document.getElementById('btnLoginAdmin');
  if(!email || !password){ msg.innerHTML = '<div class="msg-error">Escribe el correo y la contraseña.</div>'; return; }
  btn.disabled = true; btn.textContent = 'Entrando...';
  var resp = await sbAdmin.auth.signInWithPassword({ email: email, password: password });
  btn.disabled = false; btn.textContent = 'Iniciar sesión';
  if(resp.error){
    msg.innerHTML = '<div class="msg-error">No se pudo iniciar sesión: '+resp.error.message+'</div>';
    return;
  }
  msg.innerHTML = '<div class="msg-ok">✅ Sesión iniciada.</div>';
  if(resp.data && resp.data.user){
    // true = esto SÍ es un login explícito (acabas de pulsar "Iniciar
    // sesión"), así que aquí sí corresponde abrir el panel.
    await cargarPerfilYVerificarAdmin(resp.data.user, true);
  }
}

// FIX — se añade el parámetro abrirPanel (por defecto false). Antes
// esta función SIEMPRE abría el Panel de Admin en cuanto detectaba
// una sesión válida — y como Supabase guarda la sesión en el
// navegador, esto hacía que el panel se abriera solo cada vez que
// recargabas la app, aunque no hubieras tocado el icono. Ahora solo
// se abre cuando se pide explícitamente (login recién hecho, o al
// pulsar el icono con sesión ya activa).
async function cargarPerfilYVerificarAdmin(user, abrirPanel){
  var resp = await sbAdmin.from('perfiles').select('*').eq('id', user.id).single();
  if(resp.error || !resp.data) return;
  perfilAdminActual = resp.data;
  var btnAdmin = document.getElementById('hbtn-admin');
  if(perfilAdminActual.rol === 'admin'){
    if(btnAdmin) btnAdmin.classList.add('es-admin');
    // NUEVO — recolorea toda la app mientras dure la sesión de admin,
    // tanto en un login explícito como en una recarga con sesión ya
    // persistida (así nunca se te olvida que sigues siendo admin,
    // aunque no hayas abierto el panel en esta carga de la página).
    document.body.classList.add('modo-admin');
    if(abrirPanel){
      closeOv('ov-admin-login');
      document.getElementById('adminSesionLbl').textContent = 'Administrador: '+perfilAdminActual.email;
      openOv('ov-panel-admin');
      refrescarEstadoArchivosAdmin();
      // NUEVO — Confirmado por Alex: mismo autocargado que en
      // abrirAccesoAdmin() — el historial con el botón "Eliminar" se
      // ve sin tener que pulsar nada, también tras un login nuevo.
      if(typeof cargarHistorialHorarioGeneral==='function') cargarHistorialHorarioGeneral();
      if(typeof cargarSolicitudesAccesoAdmin==='function') cargarSolicitudesAccesoAdmin();
      // NUEVO — solo se comprueba en un login EXPLÍCITO (abrirPanel=true,
      // que es justo lo que pasa al entrar desde un dispositivo nuevo sin
      // sesión guardada). En una recarga con sesión ya persistida en este
      // mismo dispositivo (abrirPanel=false) no se molesta con el pop-up.
      comprobarHorarioEnNube(true);
    }
  } else if(abrirPanel){
    var msg = document.getElementById('adminLoginMsg');
    if(msg) msg.innerHTML = '<div class="msg-error">Este correo no tiene permisos de administrador.</div>';
  }
}

// NUEVO — normaliza un nombre de sede a un identificador simple para
// usar como parte de `tipo` en config_global (sin tildes/espacios).
function _baseSlug(nombre){
  return String(nombre||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,''); // quita acentos
}

// NUEVO — nombre de archivo seguro para usar como parte de una clave
// de Supabase Storage. Storage exige claves sin tildes/espacios/
// caracteres especiales; el nombre original del PDF (el que ve la
// persona en su explorador de archivos) casi nunca cumple eso — de
// ahí el error "Invalid key" al subir un archivo como "Gráfico OCE
// Valencia 28 julio 2026 sellado.pdf". Se usa SOLO para construir la
// ruta de subida; el nombre visible en pantalla (nombre_archivo en la
// fila de config_global) sigue siendo el original, sin tocar.
function _nombreArchivoSeguro(nombre){
  var s = String(nombre||'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g,''); // quita acentos
  s = s.replace(/[^A-Za-z0-9._-]+/g, '_'); // todo lo demás (espacios, ñ, etc.) -> _
  return s.replace(/_+/g, '_'); // colapsa varios _ seguidos en uno
}

async function subirArchivoGlobalAdmin(tipo, file){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var elEstado = document.getElementById(tipo==='horario_general' ? 'estadoHorarioGeneral' : 'estadoGraficoIntervencion');
  if(!file){
    elEstado.classList.remove('sin-archivo');
    elEstado.textContent = 'Elige antes el archivo (paso 2).';
    return;
  }

  // NUEVO — el Horario General ahora es UN ARCHIVO POR SEDE (Barcelona,
  // Madrid, Valencia, Sevilla), cada uno en su propia fila de
  // config_global (tipo: 'horario_general_'+sede). Así, cuando un
  // compañero abre el Buscador, la app solo pide/descarga la fila de SU
  // propia sede — el archivo de las demás sedes no llega ni a
  // descargarse a su dispositivo, no es solo un filtro visual.
  var sedeSlug = '';
  if(tipo==='horario_general'){
    var sedeSel = document.getElementById('selSedeHorarioGeneral');
    var sedeNombre = sedeSel ? sedeSel.value : '';
    if(!sedeNombre){
      elEstado.classList.remove('sin-archivo');
      elEstado.textContent = 'Selecciona antes la sede de este archivo (Barcelona, Madrid...).';
      return;
    }
    sedeSlug = _baseSlug(sedeNombre);
    // NUEVO — Confirmado por Alex: el tipo completo (con el mes) se
    // arma más abajo, después de leer el archivo — así, si es un PDF
    // y se reconoce el mes en su cabecera, puede autorrellenar el
    // campo antes de construir la clave definitiva.
  }

  elEstado.textContent = 'Leyendo el archivo...';

  // NUEVO — Antes de publicar nada, se lee el CONTENIDO real del
  // archivo (nunca el nombre) y se comprueba que de verdad contiene
  // datos de turnos reconocibles. Así, si por lo que sea el archivo no
  // es el correcto (o el parser no lo reconoce), se avisa ANTES de
  // publicarlo para todos los compañeros de esa sede, en vez de
  // descubrirlo luego cuando alguien abra el Buscador y no vea a nadie.
  //
  // FIX — el buffer que se lee AQUÍ para validar se reutiliza luego
  // para la SUBIDA (más abajo), en vez de releer el archivo por
  // segunda vez. Antes se leía dos veces (una para validar, otra al
  // subir) — en algunos móviles, releer el mismo archivo elegido desde
  // el selector puede fallar silenciosamente, lo que probablemente
  // causaba el "Failed to fetch" al llegar a la subida real.
  var datosValidacion = null;
  var errorTecnicoValidacion = null;
  var bufferParaSubir = null; // se guarda aquí para no releer el archivo
  try{
    var esXlsxVal = /\.xlsx$/i.test(file.name);
    var esCsvVal = /\.csv$/i.test(file.name);
    if(esXlsxVal){
      bufferParaSubir = await file.arrayBuffer();
      // FIX — se pasa una COPIA (slice(0)) al lector, nunca el buffer
      // original. XLSX/pdf.js pueden vaciar ("transferir") el buffer
      // que reciben para procesarlo; si se les pasa el mismo objeto
      // que luego se usa para subir, ese buffer llega vacío (0 bytes)
      // a Supabase — es justo lo que causó "The PDF file is empty".
      datosValidacion = parseHorarioGeneralXLSX(bufferParaSubir.slice(0));
    } else if(esCsvVal){
      var textoVal = await file.text();
      bufferParaSubir = textoVal; // el texto plano sirve igual para subir un CSV
      datosValidacion = parseHorarioGeneralCSV(textoVal);
    } else {
      // Por defecto se trata como PDF (igual que hace el resto del
      // código más abajo), sea cual sea el nombre del archivo.
      bufferParaSubir = await file.arrayBuffer();
      datosValidacion = await parsearBufferPdfHorario(bufferParaSubir.slice(0));
    }
  }catch(errVal){
    console.log('Error validando el contenido del archivo:', errVal);
    errorTecnicoValidacion = errVal && errVal.message ? errVal.message : String(errVal);
    datosValidacion = null;
  }
  if(!datosValidacion || !datosValidacion.length){
    // FIX — distingue "hubo un fallo técnico leyendo el PDF" de "se leyó
    // bien pero no había ningún empleado dentro". Antes ambos casos
    // daban el mismo mensaje genérico, y no se podía saber si el
    // archivo era inválido de verdad o si algo se rompió al leerlo.
    var msgValidacion = errorTecnicoValidacion
      ? ('No se ha podido leer el archivo por completo (' + errorTecnicoValidacion + '). Puede que aun así contenga datos válidos. ¿Quieres publicarlo de todas formas?')
      : 'Este archivo no parece un Horario General válido: no se ha reconocido ningún empleado dentro (revisando el contenido, no el nombre). ¿Quieres publicarlo de todas formas?';
    var continuar = confirm(msgValidacion);
    if(!continuar){
      elEstado.classList.add('sin-archivo');
      elEstado.textContent = 'Subida cancelada — el archivo no se reconoció como Horario General.';
      return;
    }
  }

  // NUEVO — Confirmado por Alex: cada mes se guarda aparte (sede+mes),
  // sin sobrescribir los anteriores — así puede haber a la vez un
  // Horario General de Agosto Y de Septiembre para la misma sede, y
  // el Buscador de Compañeros deja elegir en cuál buscar. Para eso
  // hace falta saber de qué mes es este archivo:
  var mesAnioTexto = '';
  if(sedeSlug){
    var campoMes = document.getElementById('mesHorarioGeneral');
    mesAnioTexto = campoMes ? campoMes.value : ''; // formato nativo "AAAA-MM"
    // Si es un PDF y se reconoció el mes en su cabecera (extraerMesAnioPDF,
    // vía datosValidacion.mesAnio), y el campo se dejó vacío, se
    // autorrellena — el campo sigue siendo editable por si hay que
    // corregirlo antes de publicar.
    if(!mesAnioTexto && datosValidacion && datosValidacion.mesAnio){
      mesAnioTexto = datosValidacion.mesAnio.anio + '-' + String(datosValidacion.mesAnio.mes).padStart(2,'0');
      if(campoMes) campoMes.value = mesAnioTexto;
    }
    if(!mesAnioTexto){
      elEstado.classList.remove('sin-archivo');
      elEstado.textContent = 'Indica el mes de este horario (paso 2) — no se pudo detectar solo desde el archivo.';
      return;
    }
    tipo = 'horario_general_' + sedeSlug + '_' + mesAnioTexto;
  }

  elEstado.textContent = 'Subiendo...';
  var path = tipo + '/' + Date.now() + '_' + _nombreArchivoSeguro(file.name);

  // FIX — se sube el BUFFER ya leído (bufferParaSubir), nunca el
  // objeto `file` original una segunda vez. Si por lo que sea no se
  // llegó a capturar ningún buffer (caso raro), se cae al objeto
  // `file` como último recurso, igual que antes.
  var contenidoParaSubir = bufferParaSubir!=null ? bufferParaSubir : file;
  var subida = await sbAdmin.storage.from('admin-archivos').upload(path, contenidoParaSubir, { upsert: true, contentType: file.type || undefined });
  if(subida.error){
    elEstado.textContent = 'Error al subir: ' + subida.error.message;
    return;
  }
  var urlData = sbAdmin.storage.from('admin-archivos').getPublicUrl(path);

  var payload = {
    tipo: tipo,
    nombre_archivo: file.name,
    url_archivo: urlData.data.publicUrl,
    fecha_subida: new Date().toISOString(),
    subido_por: perfilAdminActual.id,
    // NUEVO — además del id (que ya se guardaba pero nunca se leía en
    // ningún sitio), se guarda el email del admin — así se puede
    // mostrar "quién lo subió" de forma legible en el panel.
    subido_por_email: perfilAdminActual.email || ''
  };
  if(sedeSlug){
    var sedeSel2 = document.getElementById('selSedeHorarioGeneral');
    payload.sede = sedeSel2 ? sedeSel2.value : '';
  }
  var tabla = await sbAdmin.from('config_global').upsert(payload);
  if(tabla.error){
    elEstado.textContent = 'Archivo subido, pero no se pudo registrar: ' + tabla.error.message;
    return;
  }
  refrescarEstadoArchivosAdmin();
  var sedePublicada = payload.sede || '';
  toast('✅ Archivo publicado' + (sedeSlug ? ' para '+sedePublicada : ' para todos'));

  // FIX — limpiar el formulario tras publicar con éxito: la sede y el
  // archivo elegido se quedaban puestos, lo que hacía parecer que ya
  // no se podía escribir una sede distinta para la siguiente subida.
  // Ahora queda listo de cero para subir la sede que toque después.
  if(tipo.indexOf('horario_general')===0){
    var campoSede = document.getElementById('selSedeHorarioGeneral');
    if(campoSede) campoSede.value = '';
    var campoArchivo = document.getElementById('fileHorarioGeneral');
    if(campoArchivo) campoArchivo.value = '';
    var txtArchivo = document.getElementById('txtHorarioGeneral');
    if(txtArchivo) txtArchivo.textContent = 'Toca para elegir el PDF (o CSV/XLSX si lo prefieres)';
  }
}

// NUEVO — Sube el Gráfico + el Informe de Intervención, junto con el
// nombre del servicio y la fecha de inicio. NO procesa los PDF aquí
// (el admin no necesita esperar el cruce) — cada compañero los
// descarga y los cruza en su propio móvil, reutilizando las mismas
// funciones (pdfToLines/parseGraficoTurnos/parseAgentsTable/
// construirDiasDesdeCruce) que ya usaba el formulario manual.
async function subirIntervencionGlobalAdmin(){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var elEstado = document.getElementById('estadoGraficoIntervencion');
  var nombre = document.getElementById('nombreServicioIntervencion').value.trim();
  var fecha = document.getElementById('fechaInicioIntervencion').value;
  var fGrafico = document.getElementById('fileIntervencionGrafico').files[0];
  var fInforme = document.getElementById('fileIntervencionInforme').files[0];

  if(!nombre || !fecha || !fGrafico || !fInforme){
    elEstado.classList.remove('sin-archivo');
    elEstado.textContent = 'Faltan datos: nombre del servicio, fecha, y los 2 PDF son obligatorios.';
    return;
  }

  elEstado.textContent = 'Subiendo Gráfico...';
  var pathGrafico = 'grafico_intervencion/' + Date.now() + '_grafico_' + _nombreArchivoSeguro(fGrafico.name);
  var subidaGrafico = await sbAdmin.storage.from('admin-archivos').upload(pathGrafico, fGrafico, { upsert: true });
  if(subidaGrafico.error){
    elEstado.textContent = 'Error al subir el Gráfico: ' + subidaGrafico.error.message;
    return;
  }

  elEstado.textContent = 'Subiendo Informe...';
  var pathInforme = 'grafico_intervencion/' + Date.now() + '_informe_' + _nombreArchivoSeguro(fInforme.name);
  var subidaInforme = await sbAdmin.storage.from('admin-archivos').upload(pathInforme, fInforme, { upsert: true });
  if(subidaInforme.error){
    elEstado.textContent = 'Error al subir el Informe: ' + subidaInforme.error.message;
    return;
  }

  var urlGrafico = sbAdmin.storage.from('admin-archivos').getPublicUrl(pathGrafico);
  var urlInforme = sbAdmin.storage.from('admin-archivos').getPublicUrl(pathInforme);

  // FIX — antes 'tipo' era SIEMPRE el literal 'grafico_intervencion',
  // así que cada publicación nueva SOBREESCRIBÍA la anterior (una sola
  // Intervención posible a la vez). Ahora, igual que ya hace el
  // Horario General por sede, el tipo incluye el nombre del servicio
  // (slugificado con _baseSlug(), ya existente) — así conviven varias
  // Intervenciones publicadas a la vez, una por nombre de servicio.
  // Publicar dos veces con el MISMO nombre sigue sustituyendo esa
  // Intervención en concreto (mismo comportamiento de siempre).
  var tipoIntervencion = 'grafico_intervencion_' + _baseSlug(nombre);

  var tabla = await sbAdmin.from('config_global').upsert({
    tipo: tipoIntervencion,
    nombre_archivo: fGrafico.name,
    url_archivo: urlGrafico.data.publicUrl,
    nombre_archivo_informe: fInforme.name,
    url_archivo_informe: urlInforme.data.publicUrl,
    nombre_servicio: nombre,
    fecha_inicio: fecha,
    fecha_subida: new Date().toISOString(),
    subido_por: perfilAdminActual.id,
    subido_por_email: perfilAdminActual.email || ''
  });
  if(tabla.error){
    elEstado.textContent = 'Archivos subidos, pero no se pudo registrar: ' + tabla.error.message;
    return;
  }
  elEstado.classList.remove('sin-archivo');
  elEstado.innerHTML = 'Intervención activa: <b>'+nombre+'</b><br>Desde: '+fecha;
  toast('✅ Intervención publicada para todos');

  // Deja el formulario listo para publicar OTRA Intervención distinta
  // a continuación, sin arrastrar los datos de la anterior.
  var campoNombreInt = document.getElementById('nombreServicioIntervencion');
  if(campoNombreInt) campoNombreInt.value = '';
  var campoFechaInt = document.getElementById('fechaInicioIntervencion');
  if(campoFechaInt) campoFechaInt.value = '';
  var campoGraficoInt = document.getElementById('fileIntervencionGrafico');
  if(campoGraficoInt) campoGraficoInt.value = '';
  var txtGraficoInt = document.getElementById('txtIntervencionGrafico');
  if(txtGraficoInt) txtGraficoInt.textContent = 'Toca para elegir el PDF del Gráfico de Intervención (GL)';
  var campoInformeInt = document.getElementById('fileIntervencionInforme');
  if(campoInformeInt) campoInformeInt.value = '';
  var txtInformeInt = document.getElementById('txtIntervencionInforme');
  if(txtInformeInt) txtInformeInt.textContent = 'Toca para elegir el PDF del Informe / Servicio Previsto';
  refrescarEstadoArchivosAdmin();
}

// NUEVO — Abre un pop-up listando SOLO las sedes que de verdad tienen
// un Horario General publicado ahora mismo (consulta en directo a
// config_global) — ya no depende de escribir el nombre a mano en el
// mismo campo que se usa para subir.
async function eliminarHorarioGeneralAdmin(){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var cont = document.getElementById('lista-sedes-eliminar');
  cont.innerHTML = '<div class="msg-info">Buscando sedes publicadas...</div>';
  openOv('ov-eliminar-sede');

  // FIX — antes solo buscaba 'horario_general_%' (con guion bajo +
  // sede detrás), así que el registro ANTIGUO de antes de tener sedes
  // (tipo EXACTO 'horario_general', sin nada más) no aparecía aquí,
  // aunque sí salía en el estado de arriba (ese filtro es más laxo).
  // Se piden todas las filas y se filtra en el cliente para coger
  // ambos casos: el antiguo y los nuevos por sede.
  var resp = await sbAdmin.from('config_global').select('*');
  var filas = (resp.data||[]).filter(function(f){ return f.tipo && f.tipo.indexOf('horario_general')===0; });
  if(resp.error || !filas.length){
    cont.innerHTML = '<div class="msg-info">No hay ninguna sede con Horario General publicado todavía.</div>';
    return;
  }

  cont.innerHTML = filas.map(function(fila){
    var esFormatoAntiguo = fila.tipo === 'horario_general';
    var sedeLbl = esFormatoAntiguo ? 'Formato antiguo (sin sede)' : (fila.sede || fila.tipo.replace('horario_general_',''));
    return '<button class="dct-btn-sec sec-red" style="width:100%;margin-bottom:8px;text-align:left" onclick="confirmarEliminarSede(\''+fila.tipo+'\',\''+sedeLbl.replace(/'/g,"\\'")+'\')">'
      +'🗑 '+sedeLbl+'<br><span style="font-size:10px;opacity:.75;font-weight:400">'+fila.nombre_archivo+' · '+new Date(fila.fecha_subida).toLocaleString('es-ES')+'</span>'
      +'</button>';
  }).join('');
}

// Borra la sede EXACTA elegida en el pop-up (tipoSede ya viene
// resuelto, sin volver a construirlo a partir de texto escrito).
async function confirmarEliminarSede(tipoSede, sedeNombre){
  if(!confirm('¿Seguro que quieres borrar el Horario General de '+sedeNombre+'? Los compañeros de esa sede dejarán de verlo hasta que subas uno nuevo.')) return;
  var cont = document.getElementById('lista-sedes-eliminar');
  cont.innerHTML = '<div class="msg-info">Borrando '+sedeNombre+'...</div>';

  var fila = await sbAdmin.from('config_global').select('url_archivo').eq('tipo',tipoSede).single();
  if(fila.data && fila.data.url_archivo){
    var partes = fila.data.url_archivo.split('/admin-archivos/');
    if(partes[1]) await sbAdmin.storage.from('admin-archivos').remove([decodeURIComponent(partes[1])]);
  }
  var borrado = await sbAdmin.from('config_global').delete().eq('tipo',tipoSede);
  if(borrado.error){
    cont.innerHTML = '<div class="msg-error">Error al borrar: '+borrado.error.message+'</div>';
    return;
  }
  closeOv('ov-eliminar-sede');
  toast('🗑 Horario General de '+sedeNombre+' eliminado');
  refrescarEstadoArchivosAdmin();
}

// NUEVO — Abre un pop-up listando SOLO las Intervenciones (Gráfico+
// Informe) que de verdad están publicadas ahora mismo (consulta en
// directo a config_global) — mismo patrón que ya usa
// eliminarHorarioGeneralAdmin() para las sedes. Permite tener varias
// Intervenciones publicadas a la vez y borrar solo una en concreto.
async function eliminarIntervencionAdmin(){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var cont = document.getElementById('lista-intervenciones-eliminar');
  cont.innerHTML = '<div class="msg-info">Buscando Intervenciones publicadas...</div>';
  openOv('ov-eliminar-intervencion');

  var resp = await sbAdmin.from('config_global').select('*');
  // FIX — se incluye también el formato antiguo (tipo EXACTO
  // 'grafico_intervencion', sin nombre detrás), por si quedara alguna
  // Intervención publicada con la versión anterior de esta función.
  var filas = (resp.data||[]).filter(function(f){ return f.tipo && f.tipo.indexOf('grafico_intervencion')===0; });
  if(resp.error || !filas.length){
    cont.innerHTML = '<div class="msg-info">No hay ninguna Intervención publicada todavía.</div>';
    return;
  }

  cont.innerHTML = filas.map(function(fila){
    var esFormatoAntiguo = fila.tipo === 'grafico_intervencion';
    var nombreLbl = esFormatoAntiguo ? (fila.nombre_servicio || 'Formato antiguo (sin nombre)') : (fila.nombre_servicio || fila.tipo.replace('grafico_intervencion_',''));
    return '<button class="dct-btn-sec sec-red" style="width:100%;margin-bottom:8px;text-align:left" onclick="confirmarEliminarIntervencion(\''+fila.tipo+'\',\''+nombreLbl.replace(/'/g,"\\'")+'\')">'
      +'🗑 '+nombreLbl+'<br><span style="font-size:10px;opacity:.75;font-weight:400">'+fila.nombre_archivo+' · '+new Date(fila.fecha_subida).toLocaleString('es-ES')+'</span>'
      +'</button>';
  }).join('');
}

// Borra la Intervención EXACTA elegida en el pop-up (tipo ya viene
// resuelto, sin volver a construirlo a partir de texto escrito):
// fila en config_global + los 2 archivos (Gráfico e Informe) en Storage.
async function confirmarEliminarIntervencion(tipoServicio, nombreLbl){
  if(!confirm('¿Seguro que quieres borrar la Intervención «'+nombreLbl+'»? Los compañeros dejarán de ver ese cruce hasta que subas uno nuevo con ese mismo nombre.')) return;
  var cont = document.getElementById('lista-intervenciones-eliminar');
  cont.innerHTML = '<div class="msg-info">Borrando '+nombreLbl+'...</div>';

  var fila = await sbAdmin.from('config_global').select('url_archivo, url_archivo_informe').eq('tipo',tipoServicio).single();
  var rutas = [];
  if(fila.data){
    [fila.data.url_archivo, fila.data.url_archivo_informe].forEach(function(url){
      if(!url) return;
      var partes = url.split('/admin-archivos/');
      if(partes[1]) rutas.push(decodeURIComponent(partes[1]));
    });
  }
  if(rutas.length) await sbAdmin.storage.from('admin-archivos').remove(rutas);

  var borrado = await sbAdmin.from('config_global').delete().eq('tipo',tipoServicio);
  if(borrado.error){
    cont.innerHTML = '<div class="msg-error">Error al borrar: '+borrado.error.message+'</div>';
    return;
  }
  closeOv('ov-eliminar-intervencion');
  toast('🗑 Intervención «'+nombreLbl+'» eliminada');
  refrescarEstadoArchivosAdmin();
}

// NUEVO — Accesos del Buscador de Compañeros (tripulación): igual que
// cargarAccesosInterventorAdmin(), pero leyendo aceptaciones_descargo
// (la tabla que ya rellenaba validarAccesoBuscador() al aceptar el
// descargo). Antes solo se podía consultar entrando directamente a
// Supabase — ahora se ve también desde el propio Panel de Admin.
async function cargarAceptacionesDescargoAdmin(){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var elLista = document.getElementById('listaAceptacionesDescargo');
  var elEstado = document.getElementById('estadoAceptacionesDescargo');
  if(elEstado) elEstado.textContent = 'Cargando...';
  var resp = await sbAdmin.from('aceptaciones_descargo').select('*').order('fecha_hora', { ascending:false }).limit(50);
  if(resp.error){
    if(elEstado) elEstado.textContent = 'Error al cargar: ' + resp.error.message;
    return;
  }
  var filas = resp.data || [];
  if(elEstado) elEstado.textContent = filas.length ? (filas.length+' acceso(s) más reciente(s)') : 'Todavía no ha entrado nadie al Buscador de Compañeros.';
  if(!elLista) return;
  elLista.innerHTML = '';
  filas.forEach(function(fila){
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:var(--s2);border:1px solid var(--div);border-radius:9px;padding:8px 11px;margin-bottom:6px;font-size:12px';
    var fecha = fila.fecha_hora ? new Date(fila.fecha_hora).toLocaleString('es-ES') : '';
    div.innerHTML = '<span><b>'+(fila.nombre || '(sin nombre)')+'</b> · '+fila.matricula+'</span>'
      + '<span style="color:var(--tx3)">'+fecha+'</span>';
    elLista.appendChild(div);
  });
}

// NUEVO — Solicitudes de acceso (panel de admin): lista las
// matrículas que han pedido entrar sin estar en ningún Horario
// General publicado (ver enviarSolicitudAcceso), con botones para
// aceptar/rechazar cada una. Al aceptar, esa matrícula queda válida
// para crear cuenta gracias a _matriculaTieneSolicitudAceptada().
async function cargarSolicitudesAccesoAdmin(){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var elLista = document.getElementById('listaSolicitudesAcceso');
  var elEstado = document.getElementById('estadoSolicitudesAcceso');
  if(elEstado) elEstado.textContent = 'Cargando...';
  var resp = await sbAdmin.from('solicitudes_acceso').select('*').order('fecha_hora', { ascending:false }).limit(50);
  if(resp.error){
    if(elEstado) elEstado.textContent = 'Error al cargar: ' + resp.error.message;
    return;
  }
  var filas = resp.data || [];
  var pendientes = filas.filter(function(f){ return f.estado==='pendiente'; });
  _actualizarBadgeSolicitudesAcceso(pendientes.length);
  if(elEstado) elEstado.textContent = filas.length ? (pendientes.length+' pendiente(s) de '+filas.length+' en total') : 'No hay ninguna solicitud todavía.';
  if(!elLista) return;
  elLista.innerHTML = '';
  filas.forEach(function(fila){
    var div = document.createElement('div');
    div.style.cssText = 'background:var(--s2);border:1px solid var(--div);border-radius:9px;padding:8px 11px;margin-bottom:6px;font-size:12px';
    var fecha = fila.fecha_hora ? new Date(fila.fecha_hora).toLocaleString('es-ES') : '';
    var etiquetaEstado = fila.estado==='aceptada' ? '✅ Aceptada' : (fila.estado==='rechazada' ? '🚫 Rechazada' : '⏳ Pendiente');
    var filaHtml = '<div style="display:flex;justify-content:space-between;align-items:center">'
      + '<span><b>'+(fila.nombre||'(sin nombre)')+'</b> · '+fila.matricula+'</span>'
      + '<span style="color:var(--tx3);font-size:10px">'+fecha+'</span></div>'
      + '<div style="margin-top:4px;font-size:11px;color:var(--tx3)">'+etiquetaEstado+'</div>';
    if(fila.estado==='pendiente'){
      filaHtml += '<div style="display:flex;gap:6px;margin-top:6px">'
        + '<button style="flex:1;padding:7px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);border-radius:8px;color:#6EE7B7;font-size:11px;font-weight:700;cursor:pointer" onclick="aceptarSolicitudAcceso('+fila.id+',\''+fila.matricula+'\')">✅ Aceptar</button>'
        + '<button style="flex:1;padding:7px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#FCA5A5;font-size:11px;font-weight:700;cursor:pointer" onclick="rechazarSolicitudAcceso('+fila.id+')">🚫 Rechazar</button>'
        + '</div>';
    }
    div.innerHTML = filaHtml;
    elLista.appendChild(div);
  });
}

function _actualizarBadgeSolicitudesAcceso(n){
  var badge = document.getElementById('badgeSolicitudesAcceso');
  if(!badge) return;
  if(n>0){ badge.textContent = n; badge.style.display = 'inline-block'; }
  else { badge.style.display = 'none'; }
}

async function aceptarSolicitudAcceso(id, matricula){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var r = await sbAdmin.from('solicitudes_acceso').update({estado:'aceptada'}).eq('id', id);
  if(r.error){ toast('Error al aceptar: '+r.error.message); return; }
  toast('✅ Matrícula '+matricula+' aceptada. Ya puede crear su cuenta.');
  cargarSolicitudesAccesoAdmin();
}

async function rechazarSolicitudAcceso(id){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var r = await sbAdmin.from('solicitudes_acceso').update({estado:'rechazada'}).eq('id', id);
  if(r.error){ toast('Error al rechazar: '+r.error.message); return; }
  toast('Solicitud rechazada.');
  cargarSolicitudesAccesoAdmin();
}

// NUEVO — Accesos de Interventor: lista, para el admin, de cada
// matrícula que ha entrado como Interventor (Portal de Perfil →
// Acceso de Interventor), con nombre y fecha/hora. Lee la tabla
// accesos_interventor (ver SQL de creación entregado aparte), que se
// rellena en validarMatriculaInterventor() cada vez que alguien pasa
// la comprobación de matrícula + descargo.
async function cargarAccesosInterventorAdmin(){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var elLista = document.getElementById('listaAccesosInterventor');
  var elEstado = document.getElementById('estadoAccesosInterventor');
  if(elEstado) elEstado.textContent = 'Cargando...';
  var resp = await sbAdmin.from('accesos_interventor').select('*').order('fecha_hora', { ascending:false }).limit(50);
  if(resp.error){
    if(elEstado) elEstado.textContent = 'Error al cargar: ' + resp.error.message;
    return;
  }
  var filas = resp.data || [];
  if(elEstado) elEstado.textContent = filas.length ? (filas.length+' acceso(s) más reciente(s)') : 'Todavía no ha entrado ningún interventor.';
  if(!elLista) return;
  elLista.innerHTML = '';
  filas.forEach(function(fila){
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:var(--s2);border:1px solid var(--div);border-radius:9px;padding:8px 11px;margin-bottom:6px;font-size:12px';
    var fecha = fila.fecha_hora ? new Date(fila.fecha_hora).toLocaleString('es-ES') : '';
    div.innerHTML = '<span><b>'+(fila.nombre || '(sin nombre)')+'</b> · '+fila.matricula+'</span>'
      + '<span style="color:var(--tx3)">'+fecha+'</span>';
    elLista.appendChild(div);
  });
}

// NUEVO — Accesos de Tripulante: mismo patrón que
// cargarAccesosInterventorAdmin(), leyendo accesos_tripulante (ver
// SQL de creación entregado aparte). Se rellena en
// validarMatriculaTripulanteYEntrar() (módulo del Portal de Perfil),
// una sola vez por matrícula (matricula es la clave primaria de la
// tabla). Se muestra también la sede, que aquí sí se conoce.
async function cargarAccesosTripulanteAdmin(){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  var elLista = document.getElementById('listaAccesosTripulante');
  var elEstado = document.getElementById('estadoAccesosTripulante');
  if(elEstado) elEstado.textContent = 'Cargando...';
  var resp = await sbAdmin.from('accesos_tripulante').select('*').order('fecha_hora', { ascending:false }).limit(100);
  if(resp.error){
    if(elEstado) elEstado.textContent = 'Error al cargar: ' + resp.error.message;
    return;
  }
  var filas = resp.data || [];
  if(elEstado) elEstado.textContent = filas.length ? (filas.length+' tripulante(s) registrado(s)') : 'Todavía no ha entrado ningún tripulante por este paso nuevo.';
  if(!elLista) return;
  elLista.innerHTML = '';
  filas.forEach(function(fila){
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:var(--s2);border:1px solid var(--div);border-radius:9px;padding:8px 11px;margin-bottom:6px;font-size:12px';
    var fecha = fila.fecha_hora ? new Date(fila.fecha_hora).toLocaleString('es-ES') : '';
    div.innerHTML = '<span><b>'+(fila.nombre || '(sin nombre)')+'</b> · '+fila.matricula+' · '+(fila.sede||'—')+'</span>'
      + '<span style="color:var(--tx3)">'+fecha+'</span>';
    elLista.appendChild(div);
  });
}
