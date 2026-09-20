/* TrenTurnos v5 — Cuenta con matrícula + PIN, solicitudes de acceso y sesión
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   CUENTA CON MATRÍCULA + PIN — para cualquier compañero (no solo
   admin). Traduce matrícula+PIN a un email ficticio interno
   (matricula@interno.trenturnov5) que Supabase entiende como
   email+contraseña normal, pero que la persona nunca ve. Al crear la
   cuenta, se verifica la matrícula contra TODOS los Horarios Generales
   publicados (todas las sedes), reutilizando _descargarYParsearHorario()
   ya existente — el mismo mecanismo que usa el admin para ver "todas
   las sedes fusionadas" en el Buscador.
   IMPORTANTE (recordatorio — no aplicable desde el código): en
   Supabase hay que tener desactivado "Confirm email" (Authentication →
   Providers → Email), porque este email ficticio nunca podrá recibir
   un correo de confirmación real.
═══════════════════════════════════════════════════════════ */

// NUEVO — cifra el PIN antes de guardarlo, para no tener nunca el PIN
// en texto plano en la base de datos. Usa SHA-256 (disponible en
// cualquier navegador moderno, sin librerías externas). No es
// reversible: para comprobar un PIN, se cifra el que escribe la
// persona y se compara el resultado, nunca se descifra el guardado.
async function _hashPin(pin){
  var datos = new TextEncoder().encode(pin);
  var buffer = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(buffer)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

// Descarga y parsea TODAS las sedes publicadas y comprueba si la
// matrícula aparece en cualquiera de ellas — no importa la sede.
// FIX — antes esta verificación era muy lenta: comprobaba las sedes
// UNA A UNA (en serie) y, dentro de cada PDF, leía las 59 páginas
// enteras antes de mirar si la matrícula estaba — aunque apareciera
// en la página 2. Ahora: (1) todas las sedes se comprueban EN
// PARALELO, ganando la que responda antes (Promise.any); (2) dentro
// de cada PDF, se para de leer en cuanto aparece la matrícula, sin
// esperar a las páginas restantes.
async function _verificarMatriculaEnTodasLasSedes(matricula){
  var resp = await sbAdmin.from('config_global').select('*').like('tipo','horario_general_%');
  if(resp.error || !resp.data || !resp.data.length) return false;

  var filasConArchivo = resp.data.filter(function(f){ return f.url_archivo; });
  if(!filasConArchivo.length) return false;

  var promesas = filasConArchivo.map(function(fila){
    return _buscarMatriculaEnArchivo(fila, matricula).then(function(encontrado){
      if(encontrado) return true;
      return Promise.reject(new Error('no está en esta sede'));
    });
  });

  try{
    await Promise.any(promesas); // se resuelve en cuanto la PRIMERA sede confirma que sí está
    return true;
  }catch(e){
    return false; // ninguna sede la tenía (todas las promesas rechazadas)
  }
}

// Busca la matrícula en UN archivo (XLSX/CSV/PDF). Para PDF, lee
// página a página y para en cuanto la encuentra — no necesita parsear
// el documento entero para responder que SÍ está.
async function _buscarMatriculaEnArchivo(fila, matricula){
  var archivoResp = await fetch(fila.url_archivo);
  if(!archivoResp.ok) return false;
  var nombreArchivo = fila.nombre_archivo || '';
  if(/\.xlsx$/i.test(nombreArchivo)){
    var buf = await archivoResp.arrayBuffer();
    var datos = parseHorarioGeneralXLSX(buf);
    return datos.some(function(e){ return String(e[0]).trim()===matricula; });
  }
  if(/\.csv$/i.test(nombreArchivo)){
    var texto = await archivoResp.text();
    var datosCsv = parseHorarioGeneralCSV(texto);
    return datosCsv.some(function(e){ return String(e[0]).trim()===matricula; });
  }
  var bufPdf = await archivoResp.arrayBuffer();
  return await _buscarMatriculaEnPdf(bufPdf, matricula);
}

// Igual que parsearBufferPdfHorario(), pero se detiene en la primera
// página donde aparece la matrícula buscada, en vez de leer siempre
// el documento entero.
async function _buscarMatriculaEnPdf(buf, matricula){
  await asegurarPdfWorkerSeguro();
  var pdf = await pdfjsLib.getDocument({data: buf}).promise;
  var numPages = pdf.numPages;
  // FIX — esta función tenía su PROPIA copia de la lectura de PDF,
  // separada de parsearBufferPdfHorario(), y se había quedado sin el
  // arreglo del "sobrante entre páginas": si el bloque de un empleado
  // quedaba cortado justo en el límite de dos páginas (ID/turno en
  // una, "Jor." con las horas en la siguiente — igual que pasaba
  // antes con los nombres del Buscador), esa matrícula nunca se
  // encontraba aquí aunque SÍ apareciera ya en el Buscador de
  // Compañeros. 'leftover' se encadena exactamente igual que en
  // parsearBufferPdfHorario() para que ambas rutas vean lo mismo.
  var leftover = [];
  for(var pi=1; pi<=numPages; pi++){
    try{
      var page = await pdf.getPage(pi);
      var viewport = page.getViewport({scale:1});
      var pageHeight = viewport.height;
      var content = await page.getTextContent();
      var words = [];
      for(var wi=0; wi<content.items.length; wi++){
        var item = content.items[wi];
        var str = (item.str||'').trim();
        if(!str) continue;
        var x0 = item.transform[4];
        var top = pageHeight - item.transform[5];
        var parts = str.split(/\s+/).filter(Boolean);
        if(parts.length<=1){
          words.push({text: str, x0: x0, top: top, pagina: pi});
        } else {
          var w = item.width || 0;
          (function(parts, x0, w, top){
            parts.forEach(function(p, idx){
              words.push({text: p, x0: x0 + (w*idx/parts.length), top: top, pagina: pi});
            });
          })(parts, x0, w, top);
        }
      }
      var parsed = parsePageWords(words, leftover, pi);
      leftover = parsed.leftover || [];
      if(parsed.some(function(e){ return String(e[0]).trim()===matricula; })) return true; // ENCONTRADA — para aquí, no sigue leyendo páginas
    }catch(errPag){
      console.log('Búsqueda de matrícula: no se pudo leer la página '+pi+' de '+numPages+', se continúa.', errPag);
      leftover = []; // la página falló entera: no hay nada fiable que arrastrar
    }
  }
  return false;
}

// NUEVO — Solicitudes de acceso para matrículas que todavía no están
// en ningún Horario General publicado. Tabla Supabase:
// solicitudes_acceso (id, matricula, nombre, estado, fecha_hora).
// 'estado' empieza en 'pendiente' y el admin la pasa a 'aceptada' o
// 'rechazada' desde el Panel de Control (ver cargarSolicitudesAccesoAdmin).
async function _matriculaTieneSolicitudAceptada(matricula){
  if(!sbAdmin) return false;
  try{
    var r = await sbAdmin.from('solicitudes_acceso').select('estado').eq('matricula', matricula).eq('estado','aceptada').maybeSingle();
    return !!(r && r.data);
  }catch(e){ return false; }
}
// NUEVO — Confirmado por el usuario: cuando el acceso de un Interventor
// viene de una solicitud aceptada (su matrícula todavía no está en el
// Informe de Intervención oficial), antes el nombre se dejaba
// SIEMPRE vacío a propósito — por eso no salía el saludo "Hola, ...".
// Esta función trae el nombre que la propia persona escribió al
// mandar la solicitud (guardado en solicitudes_acceso.nombre), sin
// tocar _matriculaTieneSolicitudAceptada() de arriba (la usan otros 5
// sitios distintos del código, y cambiar lo que devuelve podría
// romper algo ahí).
async function _obtenerNombreSolicitudAceptada(matricula){
  if(!sbAdmin) return null;
  try{
    var r = await sbAdmin.from('solicitudes_acceso').select('nombre').eq('matricula', matricula).eq('estado','aceptada').maybeSingle();
    return (r && r.data && r.data.nombre) ? r.data.nombre : null;
  }catch(e){ return null; }
}

function mostrarBloqueSolicitudAcceso(){
  var bloque = document.getElementById('bloqueSolicitudAcceso');
  if(!bloque) return;
  bloque.style.display = 'block';
  var nombreInp = document.getElementById('solicitudNombreInput');
  if(nombreInp) nombreInp.focus();
}

// NUEVO — misma solicitud de acceso, pero para el modal REAL que usa
// la gente (Acceso al Buscador de Compañeros, ov-acceso-buscador). El
// bloque de "Mi cuenta en la nube" (arriba) se dejó tal cual por si
// se reactiva más adelante, pero hoy no es accesible desde ningún
// botón de la app — este es el punto de entrada que de verdad se ve.
function mostrarBloqueSolicitudAccesoBusc(){
  var bloque = document.getElementById('bloqueSolicitudAccesoBusc');
  if(!bloque) return;
  bloque.style.display = 'block';
  var nombreInp = document.getElementById('solicitudNombreInputBusc');
  if(nombreInp) nombreInp.focus();
}

async function enviarSolicitudAccesoBusc(){
  var matricula = document.getElementById('accesoMatriculaInput').value.trim();
  var nombre = document.getElementById('solicitudNombreInputBusc').value.trim();
  var estadoEl = document.getElementById('estadoSolicitudAccesoBusc');
  var mostrar = function(txt){ if(estadoEl){ estadoEl.style.display='block'; estadoEl.textContent = txt; } };

  if(!matricula){ mostrar('Falta la matrícula — escríbela arriba primero.'); return; }
  if(!nombre){ mostrar('Escribe tu nombre completo.'); return; }
  if(!sbAdmin){ mostrar('No se pudo conectar. Inténtalo de nuevo en unos segundos.'); return; }

  var btn = document.getElementById('btnEnviarSolicitudAccesoBusc');
  if(btn){ btn.disabled = true; btn.textContent = 'Enviando...'; }

  var yaPendiente = await sbAdmin.from('solicitudes_acceso').select('id').eq('matricula', matricula).eq('estado','pendiente').maybeSingle();
  if(yaPendiente.error){
    mostrar('No se pudo guardar la solicitud (¿existe la tabla solicitudes_acceso en Supabase?): ' + yaPendiente.error.message);
    if(btn){ btn.disabled = false; btn.textContent = '📨 Enviar solicitud de acceso'; }
    return;
  }
  if(!yaPendiente.data){
    var alta = await sbAdmin.from('solicitudes_acceso').insert({ matricula: matricula, nombre: nombre, estado: 'pendiente' });
    if(alta.error){
      mostrar('No se pudo enviar la solicitud: ' + alta.error.message);
      if(btn){ btn.disabled = false; btn.textContent = '📨 Enviar solicitud de acceso'; }
      return;
    }
  }

  if(btn){ btn.disabled = false; btn.textContent = '✅ Solicitud enviada'; }
  mostrar('Solicitud guardada. Avisa también por WhatsApp o correo para que se revise antes:');

  var textoAviso = 'Hola, soy '+nombre+' (matrícula '+matricula+'). He solicitado acceso a TrenTurnos, ¿puedes revisarlo?';
  var linkWa = document.getElementById('linkWhatsappSolicitudBusc');
  var linkCorreo = document.getElementById('linkCorreoSolicitudBusc');
  if(linkWa) linkWa.href = 'https://wa.me/66660753771?text=' + encodeURIComponent(textoAviso);
  if(linkCorreo) linkCorreo.href = 'mailto:alvj321th@trenturnov5.es?subject=' + encodeURIComponent('Solicitud de acceso — TrenTurnos') + '&body=' + encodeURIComponent(textoAviso);
  var bloqueAvisos = document.getElementById('bloqueAvisosSolicitudBusc');
  if(bloqueAvisos){ bloqueAvisos.style.display = 'flex'; }
}

// NUEVO — misma solicitud de acceso, para la pantalla REAL de primer
// acceso de Tripulante (Portal de Perfil, #portal-tripulante-acceso).
// Esta es la que ve cualquiera que entra por primera vez sin tener
// su matrícula todavía en ningún Horario General.
function mostrarBloqueSolicitudAccesoTrip(){
  var bloque = document.getElementById('bloqueSolicitudAccesoTrip');
  if(!bloque) return;
  bloque.style.display = 'block';
  var nombreInp = document.getElementById('solicitudNombreInputTrip');
  if(nombreInp) nombreInp.focus();
}

async function enviarSolicitudAccesoTrip(){
  var matricula = document.getElementById('accesoMatriculaTripulanteInput').value.trim();
  var nombre = document.getElementById('solicitudNombreInputTrip').value.trim();
  var estadoEl = document.getElementById('estadoSolicitudAccesoTrip');
  var mostrar = function(txt){ if(estadoEl){ estadoEl.style.display='block'; estadoEl.textContent = txt; } };

  if(!matricula){ mostrar('Falta la matrícula — escríbela arriba primero.'); return; }
  if(!nombre){ mostrar('Escribe tu nombre completo.'); return; }
  if(!sbAdmin){ mostrar('No se pudo conectar. Inténtalo de nuevo en unos segundos.'); return; }

  var btn = document.getElementById('btnEnviarSolicitudAccesoTrip');
  if(btn){ btn.disabled = true; btn.textContent = 'Enviando...'; }

  var yaPendiente = await sbAdmin.from('solicitudes_acceso').select('id').eq('matricula', matricula).eq('estado','pendiente').maybeSingle();
  if(yaPendiente.error){
    mostrar('No se pudo guardar la solicitud (¿existe la tabla solicitudes_acceso en Supabase?): ' + yaPendiente.error.message);
    if(btn){ btn.disabled = false; btn.textContent = '📨 Enviar solicitud de acceso'; }
    return;
  }
  if(!yaPendiente.data){
    var alta = await sbAdmin.from('solicitudes_acceso').insert({ matricula: matricula, nombre: nombre, estado: 'pendiente' });
    if(alta.error){
      mostrar('No se pudo enviar la solicitud: ' + alta.error.message);
      if(btn){ btn.disabled = false; btn.textContent = '📨 Enviar solicitud de acceso'; }
      return;
    }
  }

  if(btn){ btn.disabled = false; btn.textContent = '✅ Solicitud enviada'; }
  mostrar('Solicitud guardada. Avisa también por WhatsApp o correo para que se revise antes:');

  var textoAviso = 'Hola, soy '+nombre+' (matrícula '+matricula+'). He solicitado acceso a TrenTurnos, ¿puedes revisarlo?';
  var linkWa = document.getElementById('linkWhatsappSolicitudTrip');
  var linkCorreo = document.getElementById('linkCorreoSolicitudTrip');
  if(linkWa) linkWa.href = 'https://wa.me/66660753771?text=' + encodeURIComponent(textoAviso);
  if(linkCorreo) linkCorreo.href = 'mailto:alvj321th@trenturnov5.es?subject=' + encodeURIComponent('Solicitud de acceso — TrenTurnos') + '&body=' + encodeURIComponent(textoAviso);
  var bloqueAvisos = document.getElementById('bloqueAvisosSolicitudTrip');
  if(bloqueAvisos){ bloqueAvisos.style.display = 'flex'; }
}

// NUEVO — misma solicitud de acceso, para la pantalla de primer
// acceso de Interventor (#portal-interventor-acceso), cuando la
// matrícula/móvil no aparece en el Informe de Intervención publicado.
function mostrarBloqueSolicitudAccesoInterv(){
  var bloque = document.getElementById('bloqueSolicitudAccesoInterv');
  if(!bloque) return;
  bloque.style.display = 'block';
  var nombreInp = document.getElementById('solicitudNombreInputInterv');
  if(nombreInp) nombreInp.focus();
}

async function enviarSolicitudAccesoInterv(){
  var matricula = document.getElementById('accesoMatriculaInterventorInput').value.trim();
  var nombre = document.getElementById('solicitudNombreInputInterv').value.trim();
  var estadoEl = document.getElementById('estadoSolicitudAccesoInterv');
  var mostrar = function(txt){ if(estadoEl){ estadoEl.style.display='block'; estadoEl.textContent = txt; } };

  if(!matricula){ mostrar('Falta la matrícula — escríbela arriba primero.'); return; }
  if(!nombre){ mostrar('Escribe tu nombre completo.'); return; }
  if(!sbAdmin){ mostrar('No se pudo conectar. Inténtalo de nuevo en unos segundos.'); return; }

  var btn = document.getElementById('btnEnviarSolicitudAccesoInterv');
  if(btn){ btn.disabled = true; btn.textContent = 'Enviando...'; }

  var yaPendiente = await sbAdmin.from('solicitudes_acceso').select('id').eq('matricula', matricula).eq('estado','pendiente').maybeSingle();
  if(yaPendiente.error){
    mostrar('No se pudo guardar la solicitud (¿existe la tabla solicitudes_acceso en Supabase?): ' + yaPendiente.error.message);
    if(btn){ btn.disabled = false; btn.textContent = '📨 Enviar solicitud de acceso'; }
    return;
  }
  if(!yaPendiente.data){
    var alta = await sbAdmin.from('solicitudes_acceso').insert({ matricula: matricula, nombre: nombre, estado: 'pendiente' });
    if(alta.error){
      mostrar('No se pudo enviar la solicitud: ' + alta.error.message);
      if(btn){ btn.disabled = false; btn.textContent = '📨 Enviar solicitud de acceso'; }
      return;
    }
  }

  if(btn){ btn.disabled = false; btn.textContent = '✅ Solicitud enviada'; }
  mostrar('Solicitud guardada. Avisa también por WhatsApp o correo para que se revise antes:');

  var textoAviso = 'Hola, soy '+nombre+' (matrícula '+matricula+'). He solicitado acceso como Interventor a TrenTurnos, ¿puedes revisarlo?';
  var linkWa = document.getElementById('linkWhatsappSolicitudInterv');
  var linkCorreo = document.getElementById('linkCorreoSolicitudInterv');
  if(linkWa) linkWa.href = 'https://wa.me/66660753771?text=' + encodeURIComponent(textoAviso);
  if(linkCorreo) linkCorreo.href = 'mailto:alvj321th@trenturnov5.es?subject=' + encodeURIComponent('Solicitud de acceso — TrenTurnos') + '&body=' + encodeURIComponent(textoAviso);
  var bloqueAvisos = document.getElementById('bloqueAvisosSolicitudInterv');
  if(bloqueAvisos){ bloqueAvisos.style.display = 'flex'; }
}

async function enviarSolicitudAcceso(){
  var matricula = document.getElementById('cuentaMatInput').value.trim();
  var nombre = document.getElementById('solicitudNombreInput').value.trim();
  var estadoEl = document.getElementById('estadoSolicitudAcceso');
  var mostrar = function(txt){ if(estadoEl){ estadoEl.style.display='block'; estadoEl.textContent = txt; } };

  if(!matricula){ mostrar('Falta la matrícula — escríbela arriba primero.'); return; }
  if(!nombre){ mostrar('Escribe tu nombre completo.'); return; }
  if(!sbAdmin){ mostrar('No se pudo conectar. Inténtalo de nuevo en unos segundos.'); return; }

  var btn = document.getElementById('btnEnviarSolicitudAcceso');
  if(btn){ btn.disabled = true; btn.textContent = 'Enviando...'; }

  // Evita duplicar solicitudes pendientes para la misma matrícula.
  var yaPendiente = await sbAdmin.from('solicitudes_acceso').select('id').eq('matricula', matricula).eq('estado','pendiente').maybeSingle();
  if(yaPendiente.error){
    mostrar('No se pudo guardar la solicitud (¿existe la tabla solicitudes_acceso en Supabase?): ' + yaPendiente.error.message);
    if(btn){ btn.disabled = false; btn.textContent = '📨 Enviar solicitud de acceso'; }
    return;
  }
  if(!yaPendiente.data){
    var alta = await sbAdmin.from('solicitudes_acceso').insert({ matricula: matricula, nombre: nombre, estado: 'pendiente' });
    if(alta.error){
      mostrar('No se pudo enviar la solicitud: ' + alta.error.message);
      if(btn){ btn.disabled = false; btn.textContent = '📨 Enviar solicitud de acceso'; }
      return;
    }
  }

  if(btn){ btn.disabled = false; btn.textContent = '✅ Solicitud enviada'; }
  mostrar('Solicitud guardada. Avisa también por WhatsApp o correo para que se revise antes:');

  var textoAviso = 'Hola, soy '+nombre+' (matrícula '+matricula+'). He solicitado acceso a TrenTurnos, ¿puedes revisarlo?';
  var linkWa = document.getElementById('linkWhatsappSolicitud');
  var linkCorreo = document.getElementById('linkCorreoSolicitud');
  if(linkWa) linkWa.href = 'https://wa.me/66660753771?text=' + encodeURIComponent(textoAviso);
  if(linkCorreo) linkCorreo.href = 'mailto:alvj321th@trenturnov5.es?subject=' + encodeURIComponent('Solicitud de acceso — TrenTurnos') + '&body=' + encodeURIComponent(textoAviso);
  var bloqueAvisos = document.getElementById('bloqueAvisosSolicitud');
  if(bloqueAvisos){ bloqueAvisos.style.display = 'flex'; }
}

async function crearCuentaConMatricula(){
  var matricula = document.getElementById('cuentaMatInput').value.trim();
  var pin = document.getElementById('cuentaPinInput').value.trim();
  var pinConfirm = document.getElementById('cuentaPinConfirmInput').value.trim();
  var estado = document.getElementById('estadoCuentaNube');
  var mostrarEstado = function(txt){ if(estado){ estado.style.display='block'; estado.textContent = txt; } };

  if(!/^[0-9]+$/.test(matricula)){ mostrarEstado('Escribe tu número de matrícula (solo números).'); return; }
  if(!/^[0-9]{4,6}$/.test(pin)){ mostrarEstado('El PIN debe tener entre 4 y 6 dígitos, solo números.'); return; }
  if(pin !== pinConfirm){ mostrarEstado('Los dos PIN no coinciden.'); return; }

  // NUEVO — el admin no necesita que su matrícula aparezca en ningún
  // Horario General para crear su cuenta con matrícula+PIN: su
  // identidad ya quedó demostrada al iniciar sesión con su email y
  // contraseña de administrador, que es una verificación más fuerte
  // que buscar un número en un PDF. Esta verificación, para cualquier
  // otra persona, sigue siendo obligatoria y se hace UNA sola vez —
  // una vez creada la cuenta, queda válida para siempre, aunque el
  // admin suba/cambie el PDF general más adelante.
  var esAdminCreandoSuCuenta = !!(perfilAdminActual && perfilAdminActual.rol === 'admin');

  if(esAdminCreandoSuCuenta){
    mostrarEstado('Creando tu cuenta de administrador...');
  } else {
    mostrarEstado('Comprobando tu matrícula en los horarios publicados...');
    var existe = await _verificarMatriculaEnTodasLasSedes(matricula);
    if(!existe){
      // NUEVO — si el admin ya aceptó manualmente una solicitud de
      // acceso para esta matrícula (tabla solicitudes_acceso), se
      // deja pasar aunque no esté en ningún Horario General todavía.
      var solicitudAceptada = await _matriculaTieneSolicitudAceptada(matricula);
      if(!solicitudAceptada){
        mostrarEstado('Esa matrícula no aparece en ningún Horario General publicado todavía.');
        mostrarBloqueSolicitudAcceso();
        return;
      }
    }
    mostrarEstado('Creando tu cuenta...');
  }

  // FIX — REDISEÑO: esta cuenta ya NO usa Supabase Auth (signUp con un
  // email inventado tipo "matricula@interno.trenturnov5"). Ese diseño
  // dependía de que "Confirm email" estuviera desactivado en el panel
  // de Supabase — si alguien lo encendía (o venía activado por
  // defecto), la cuenta se quedaba a medias sin que nadie lo notara,
  // porque ese email inventado nunca puede recibir ni confirmar nada.
  // Ahora es una tabla propia y sencilla: matricula + PIN cifrado
  // (nunca en texto plano). Sin email de ningún tipo de por medio, no
  // hay ningún ajuste de Supabase Auth que pueda romper esto.
  var yaExiste = await sbAdmin.from('cuentas_matricula').select('matricula').eq('matricula', matricula).maybeSingle();
  if(yaExiste.data){
    mostrarEstado('Ya existe una cuenta con esa matrícula. Usa "Ya tengo cuenta — iniciar sesión".');
    return;
  }

  var pinHash = await _hashPin(pin);
  var alta = await sbAdmin.from('cuentas_matricula').insert({ matricula: matricula, pin_hash: pinHash });
  if(alta.error){
    mostrarEstado('No se pudo crear la cuenta: ' + alta.error.message);
    return;
  }

  _establecerSesionMatricula(matricula);
  toast('✅ Cuenta creada. Ya tienes sesión iniciada.');
  document.getElementById('cuentaMatInput').value = '';
  document.getElementById('cuentaPinInput').value = '';
  document.getElementById('cuentaPinConfirmInput').value = '';
  actualizarUICuentaNube();
  closeOv('ov-cuenta-nube');
}

// NUEVO — deja registrado en ESTE dispositivo que la matrícula dada
// tiene sesión iniciada (sustituye a la sesión de Supabase Auth que
// antes se guardaba sola). Se usa tanto al crear cuenta como al
// iniciar sesión, y también al recargar la app para restaurarla.
function _establecerSesionMatricula(matricula){
  usuarioActual = { id: null, email: null, matricula: matricula };
  localStorage.setItem('sesionMatriculaActiva', matricula);
}
function mostrarLoginCuentaNube(){
  _modoCuentaNube = (_modoCuentaNube === 'crear') ? 'login' : 'crear';
  var bloqueConfirm = document.getElementById('bloqueConfirmarPin');
  var btnPrincipal = document.getElementById('btnCrearCuentaNube');
  var btnAlternar = document.getElementById('btnMostrarLogin');
  if(_modoCuentaNube === 'login'){
    if(bloqueConfirm) bloqueConfirm.style.display = 'none';
    if(btnPrincipal){ btnPrincipal.textContent = 'Iniciar sesión'; btnPrincipal.setAttribute('onclick','iniciarSesionConMatricula()'); }
    if(btnAlternar) btnAlternar.textContent = 'No tengo cuenta — crear una';
  } else {
    if(bloqueConfirm) bloqueConfirm.style.display = 'block';
    if(btnPrincipal){ btnPrincipal.textContent = 'Crear mi cuenta'; btnPrincipal.setAttribute('onclick','crearCuentaConMatricula()'); }
    if(btnAlternar) btnAlternar.textContent = 'Ya tengo cuenta — iniciar sesión';
  }
}

async function iniciarSesionConMatricula(){
  var matricula = document.getElementById('cuentaMatInput').value.trim();
  var pin = document.getElementById('cuentaPinInput').value.trim();
  var estado = document.getElementById('estadoCuentaNube');
  var mostrarEstado = function(txt){ if(estado){ estado.style.display='block'; estado.textContent = txt; } };
  if(!matricula || !pin){ mostrarEstado('Escribe tu matrícula y tu PIN.'); return; }

  mostrarEstado('Entrando...');
  var fila = await sbAdmin.from('cuentas_matricula').select('pin_hash').eq('matricula', matricula).maybeSingle();
  if(fila.error || !fila.data){
    mostrarEstado('Matrícula o PIN incorrectos.');
    return;
  }
  var pinHash = await _hashPin(pin);
  if(pinHash !== fila.data.pin_hash){
    mostrarEstado('Matrícula o PIN incorrectos.');
    return;
  }
  _establecerSesionMatricula(matricula);
  toast('✅ Sesión iniciada');
  document.getElementById('cuentaMatInput').value = '';
  document.getElementById('cuentaPinInput').value = '';
  actualizarUICuentaNube();
  closeOv('ov-cuenta-nube');
}

function cerrarSesionUsuarioNube(){
  usuarioActual = null;
  localStorage.removeItem('sesionMatriculaActiva');
  actualizarUICuentaNube();
  toast('🚪 Sesión cerrada');
}

// Alterna la UI de Ajustes entre "sin cuenta" (formulario) y "con
// cuenta" (guardar/cargar/cerrar sesión), según usuarioActual.
function actualizarUICuentaNube(){
  var fuera = document.getElementById('bloqueCuentaFuera');
  var dentro = document.getElementById('bloqueCuentaDentro');
  if(!fuera || !dentro) return;
  if(usuarioActual){
    fuera.style.display = 'none';
    dentro.style.display = 'block';
    var lbl = document.getElementById('cuentaMatActivaLbl');
    if(lbl) lbl.textContent = usuarioActual.matricula || usuarioActual.email || '—';
  } else {
    fuera.style.display = 'block';
    dentro.style.display = 'none';
  }
}

async function refrescarEstadoArchivosAdmin(){
  var resp = await sbAdmin.from('config_global').select('*');
  if(!resp.data) return;

  // NUEVO — el Horario General ahora son varias filas (una por sede,
  // tipo:'horario_general_'+sede), así que se listan todas juntas en
  // el mismo recuadro de estado en vez de una sola línea.
  var filasHorario = resp.data.filter(function(f){ return f.tipo && f.tipo.indexOf('horario_general')===0; });
  var elHorario = document.getElementById('estadoHorarioGeneral');
  if(elHorario){
    if(filasHorario.length){
      elHorario.classList.remove('sin-archivo');
      elHorario.innerHTML = filasHorario.map(function(f){
        return '<div style="margin-bottom:4px"><b>'+(f.sede||f.tipo.replace('horario_general_',''))+'</b>: '+f.nombre_archivo+' · '+new Date(f.fecha_subida).toLocaleString('es-ES')+
          (f.subido_por_email ? ' · <span style="color:var(--tx3)">subido por '+f.subido_por_email+'</span>' : '')+'</div>';
      }).join('');
    } else {
      elHorario.classList.add('sin-archivo');
      elHorario.textContent = 'Aún no hay ningún archivo activo en ninguna sede.';
    }
  }

  // FIX — la Intervención ahora son varias filas posibles (una por
  // nombre de servicio, tipo:'grafico_intervencion_'+nombre), así que
  // se listan todas juntas en el mismo recuadro de estado, igual que
  // ya hace el Horario General por sede — en vez de solo la última.
  var filasIntervencion = resp.data.filter(function(f){ return f.tipo && f.tipo.indexOf('grafico_intervencion')===0; });
  var elIntervencion = document.getElementById('estadoGraficoIntervencion');
  if(elIntervencion){
    if(filasIntervencion.length){
      elIntervencion.classList.remove('sin-archivo');
      elIntervencion.innerHTML = filasIntervencion.map(function(f){
        return '<div style="margin-bottom:4px"><b>'+(f.nombre_servicio||f.tipo.replace('grafico_intervencion_',''))+'</b>: '+f.nombre_archivo+' · '+new Date(f.fecha_subida).toLocaleString('es-ES')+
          (f.subido_por_email ? ' · <span style="color:var(--tx3)">subido por '+f.subido_por_email+'</span>' : '')+'</div>';
      }).join('');
    } else {
      elIntervencion.classList.add('sin-archivo');
      elIntervencion.textContent = 'Aún no hay ninguna Intervención activa.';
    }
  }
}

// NUEVO — Confirmado por Alex tras revisar la maqueta: historial de
// Horarios Generales guardados, agrupado por sede, con un mes por
// fila y botón para eliminar uno en concreto. Se apoya en el propio
// formato de "tipo" (horario_general_<slug>_<AAAA>-<MM>) para sacar
// sede/año/mes sin necesitar columnas nuevas en la tabla.
function _hgParsearTipo(fila){
  var m = fila.tipo.match(/^horario_general_(.+)_(\d{4})-(\d{2})$/);
  var anio = null, mes = null, sedeDeTipo = null;
  if(m){
    sedeDeTipo = m[1];
    anio = parseInt(m[2],10);
    mes = parseInt(m[3],10);
  } else {
    // FIX — Confirmado por Alex (bug real, detectado en producción):
    // las filas subidas ANTES de este cambio usan el formato antiguo
    // horario_general_<sede>, sin mes en la clave. Si se descartaban
    // sin más (por no traer año/mes), TODO lo ya publicado
    // desaparecía de golpe del Buscador ("Ninguna fila con el formato
    // de mes esperado"), aunque siguiera siendo válido. Se sigue
    // aceptando ese formato antiguo: como no hay mes real que leer de
    // la clave, se usa fecha_subida como mejor aproximación
    // disponible — no es perfecto, pero mantiene visible lo que ya
    // estaba publicado sin obligar a nadie a volver a subir nada.
    sedeDeTipo = fila.tipo.replace('horario_general_', '');
    if(fila.fecha_subida){
      var dSubida = new Date(fila.fecha_subida);
      anio = dSubida.getFullYear();
      mes = dSubida.getMonth()+1;
    }
  }
  return {
    tipo: fila.tipo,
    sede: fila.sede || sedeDeTipo,
    anio: anio,
    mes: mes,
    fecha_subida: fila.fecha_subida,
    nombre_archivo: fila.nombre_archivo,
    fila: fila // referencia a la fila original completa (url_archivo, etc.)
  };
}
async function cargarHistorialHorarioGeneral(){
  var cont = document.getElementById('hgHistorialLista');
  if(!cont || !sbAdmin) return;
  cont.innerHTML = '<div class="estado-archivo sin-archivo">Cargando...</div>';
  var r = await sbAdmin.from('config_global').select('*').like('tipo','horario_general_%');
  if(!r || !r.data || !r.data.length){
    cont.innerHTML = '<div class="estado-archivo sin-archivo">Aún no se ha subido ningún Horario General.</div>';
    return;
  }
  var filas = r.data.map(_hgParsearTipo).filter(function(f){ return f.anio && f.mes; });
  if(!filas.length){
    cont.innerHTML = '<div class="estado-archivo sin-archivo">No se encontró ningún Horario General con el formato de mes esperado.</div>';
    return;
  }
  var porSede = {};
  filas.forEach(function(f){ (porSede[f.sede] = porSede[f.sede] || []).push(f); });
  Object.keys(porSede).forEach(function(s){
    porSede[s].sort(function(a,b){ return (b.anio*12+b.mes) - (a.anio*12+a.mes); }); // más reciente primero
  });
  cont.innerHTML = Object.keys(porSede).sort().map(function(sede){
    var items = porSede[sede];
    return '<div class="hg-grupo"><div class="hg-grupo-tit">📍 '+sede+'</div>'
      + items.map(function(it, i){
          var fecha = new Date(it.fecha_subida).toLocaleDateString('es-ES');
          return '<div class="hg-hist-item">'
            + '<div class="hg-hist-mes">'+MESES[it.mes-1]+' '+it.anio+(i===0?'<span class="hg-actual">ACTUAL</span>':'')+'</div>'
            + '<div class="hg-hist-meta">Subido '+fecha+'</div>'
            + '<button class="nadm-hist-del" onclick="eliminarHorarioGeneralMes(\''+it.tipo+'\')">🗑 Eliminar</button>'
          + '</div>';
        }).join('')
      + '</div>';
  }).join('');
}
async function eliminarHorarioGeneralMes(tipo){
  if(!perfilAdminActual || perfilAdminActual.rol !== 'admin') return;
  if(!confirm('¿Eliminar este Horario General? No se puede deshacer, y quien lo esté buscando ahora mismo en ese mes dejará de encontrarlo.')) return;
  var r = await sbAdmin.from('config_global').delete().eq('tipo', tipo);
  if(r.error){ alert('No se pudo eliminar: '+r.error.message); return; }
  cargarHistorialHorarioGeneral();
}
