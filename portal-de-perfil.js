/* TrenTurnos v5 — Portal de perfil: Tripulante vs Interventor (bloque aislado)
   Separado del HTML único original SIN cambiar la lógica.
   El orden de carga está en index.html (importa: no lo alteres). */
(function(){
  function mostrarPortal(){
    var el = document.getElementById('portal-perfil');
    if(el) el.style.display = 'flex';
  }
  function ocultarPortal(){
    var el = document.getElementById('portal-perfil');
    if(el) el.style.display = 'none';
  }
  function mostrarPantallaInterventor(){
    var el = document.getElementById('portal-interventor-screen');
    if(el) el.style.display = 'flex';
    document.body.classList.add('modo-interventor');
    _marcarUsuarioComoInterventor();
    actualizarSaludoInterventor();
    // NUEVO — igual que en Calendario (tripulación): refresca las
    // Notificaciones del Admin al entrar a esta pantalla, por si hay
    // algo nuevo publicado desde la última vez.
    if(typeof refrescarNotificacionesActivas==='function') refrescarNotificacionesActivas();
    // NUEVO — mismo aviso sobre la publicidad que ve Tripulación,
    // por si alguien entra a Interventor directo sin haber pasado
    // antes por el arranque normal de la app.
    setTimeout(function(){
      if(typeof mostrarAvisoPublicidadSiHaceFalta==='function') mostrarAvisoPublicidadSiHaceFalta();
    }, 800);
    // FIX — antes se llamaba directamente a cargarHorarioGlobalDesdeAdmin()
    // y activateBase(), pero esas funciones viven DENTRO de un módulo
    // de código aislado (el mismo que usa el Buscador de Compañeros) y
    // no eran visibles desde aquí — la comprobación "typeof...==='function'"
    // fallaba en silencio y nunca llegaba a cargar nada, por eso el
    // buscador de Interventor no reconocía ni nombres ni trenes. Ahora
    // se llama a cargarDatosParaInterventor(), expuesta a propósito
    // para este caso (hace lo mismo, sin abrir ninguna ventana).
    if(typeof cargarDatosParaInterventor === 'function'){
      cargarDatosParaInterventor();
    }
  }
  function ocultarPantallaInterventor(){
    var el = document.getElementById('portal-interventor-screen');
    if(el) el.style.display = 'none';
    document.body.classList.remove('modo-interventor');
  }

  // ── NUEVO: Saludo personalizado ("Hola, <Nombre> — Buenos días/
  // tardes/noches") en la cabecera del Portal de Interventor, usando
  // el nombre que devolvió el Informe de Intervención al validar la
  // matrícula (ver validarMatriculaInterventor, más abajo). Si por lo
  // que sea no hay nombre guardado todavía (primera carga con esta
  // versión, matrícula validada antes de este cambio, etc.), se deja
  // el título de siempre ("Portal de Interventor") sin romper nada.
  function saludoSegunHora(){
    var h = new Date().getHours();
    if(h >= 6 && h < 13) return '☀️ Buenos días';
    if(h >= 13 && h < 20) return '🌇 Buenas tardes';
    return '🌙 Buenas noches';
  }
  // El Informe guarda "Apellidos, Nombre" en mayúsculas (mismo
  // formato que la columna "Agente" del PDF) — para el saludo se usa
  // solo el nombre de pila, con mayúscula inicial, en vez del texto
  // completo en mayúsculas.
  function nombrePilaDesdeAgente(nombreCompleto){
    if(!nombreCompleto) return '';
    var partes = String(nombreCompleto).split(',');
    var pila = (partes.length > 1 ? partes[1] : partes[0]).trim().toLowerCase();
    if(!pila) return '';
    return pila.replace(/(^|\s)([a-záéíóúñ])/g, function(_, sp, c){ return sp + c.toUpperCase(); });
  }
  function actualizarSaludoInterventor(){
    var tit = document.getElementById('interventorHdrTitulo');
    var sub = document.getElementById('interventorHdrSub');
    var nombreGuardado = localStorage.getItem('interventorNombreValidado');
    var pila = nombrePilaDesdeAgente(nombreGuardado);
    if(tit) tit.textContent = pila ? ('Hola, '+pila+' 👋') : 'Portal de Interventor';
    if(sub) sub.textContent = pila ? (saludoSegunHora()+' · TrenTurnos v5') : 'TrenTurnos v5';
  }

  // FIX — el Buscador de Compañeros normal exige tener una "Estación
  // Base" configurada (Ajustes → Perfil), algo que un interventor
  // nunca rellena porque no es de tripulación. Sin esta marca, el
  // botón parecía "no hacer nada" — en realidad SÍ se ejecutaba, pero
  // se topaba con un aviso pidiendo esa Estación Base y se quedaba
  // ahí. usuarioActual ya existe como variable global en el resto de
  // la app (ver _restaurarSesionMatricula) — aquí solo se ajusta el
  // flag esInterventor que ya sabían leer abrirAccesoBuscadorCompaneros()
  // y cargarHorarioGlobalDesdeAdmin() para eximir de la sede.
  function _marcarUsuarioComoInterventor(){
    if(typeof usuarioActual !== 'undefined'){
      usuarioActual = { id:null, email:null, matricula:null, esInterventor:true };
    }
  }

  // ── NUEVO: Acceso de Interventor (matrícula + descargo) ──
  function mostrarAccesoInterventor(msgError){
    var el = document.getElementById('portal-interventor-acceso');
    if(el) el.style.display = 'flex';
    var input = document.getElementById('accesoMatriculaInterventorInput');
    var msg = document.getElementById('accesoInterventorMsg');
    var check = document.getElementById('accesoAceptoDescargoInterventor');
    var lbl = document.getElementById('lblAceptoDescargoInterventor');
    var modal = document.getElementById('interventorDescargoModal');
    if(input) input.value = '';
    if(msg) msg.innerHTML = msgError ? '<span style="color:#FCA5A5">'+msgError+'</span>' : '';
    // Cada vez que se abre esta pantalla se vuelve a exigir abrir el
    // descargo: la casilla arranca deshabilitada y sin marcar.
    if(check){ check.checked = false; check.disabled = true; }
    if(lbl) lbl.style.opacity = '.5';
    if(modal) modal.style.display = 'none';
  }
  function ocultarAccesoInterventor(){
    var el = document.getElementById('portal-interventor-acceso');
    if(el) el.style.display = 'none';
  }

  // Con solo abrir el descargo (no hace falta leerlo entero) se
  // habilita la casilla de aceptación.
  function abrirDescargoInterventor(){
    var modal = document.getElementById('interventorDescargoModal');
    if(modal) modal.style.display = 'flex';
  }
  function cerrarDescargoInterventor(){
    var modal = document.getElementById('interventorDescargoModal');
    if(modal) modal.style.display = 'none';
    var check = document.getElementById('accesoAceptoDescargoInterventor');
    var lbl = document.getElementById('lblAceptoDescargoInterventor');
    if(check) check.disabled = false;
    if(lbl) lbl.style.opacity = '1';
  }

  // Comprueba la matrícula escrita contra el Informe de agentes de
  // Intervención ya publicado (validarMatriculaInterventorContraInforme,
  // expuesta más arriba en el archivo, dentro del módulo del
  // Buscador de Compañeros). Solo si aparece se guarda la elección de
  // perfil y se entra a la pantalla de Interventor.
  async function validarMatriculaInterventor(){
    var input = document.getElementById('accesoMatriculaInterventorInput');
    var msg = document.getElementById('accesoInterventorMsg');
    var btn = document.getElementById('btnContinuarAccesoInterventor');
    var checkDescargo = document.getElementById('accesoAceptoDescargoInterventor');
    var matricula = input ? input.value.trim() : '';

    if(!matricula){
      if(msg) msg.innerHTML = '<span style="color:#FCA5A5">Escribe tu número de matrícula.</span>';
      return;
    }
    if(!checkDescargo || !checkDescargo.checked){
      if(msg) msg.innerHTML = '<span style="color:#FCA5A5">Abre el descargo de responsabilidad y marca la casilla para continuar.</span>';
      return;
    }
    if(typeof validarMatriculaInterventorContraInforme !== 'function'){
      if(msg) msg.innerHTML = '<span style="color:#FCA5A5">No se pudo comprobar la matrícula ahora mismo. Inténtalo de nuevo.</span>';
      return;
    }

    var textoOriginal = btn ? btn.textContent : '';
    if(btn){ btn.disabled = true; btn.textContent = 'Comprobando...'; }
    var resultado = { valida:false, motivo:'No se pudo comprobar la matrícula ahora mismo. Inténtalo de nuevo.' };
    try{
      resultado = await validarMatriculaInterventorContraInforme(matricula);
    }catch(e){
      resultado = { valida:false, motivo:'No se pudo comprobar la matrícula ahora mismo. Inténtalo de nuevo.' };
    }
    if(btn){ btn.disabled = false; btn.textContent = textoOriginal; }

    if(!resultado || !resultado.valida){
      // NUEVO — si el admin ya aceptó manualmente una solicitud de
      // acceso para esta matrícula, se deja pasar aunque no esté en
      // el Informe de Intervención todavía (nombre queda vacío: se
      // puede rellenar a mano si hace falta).
      var solicitudAceptadaInterv = await _matriculaTieneSolicitudAceptada(matricula);
      if(solicitudAceptadaInterv){
        // FIX — Confirmado por el usuario: antes se dejaba siempre
        // nombre:null aquí, así que nunca salía el saludo "Hola, ..."
        // para quien entraba por solicitud (en vez de estar ya en el
        // Informe oficial). Ahora se recupera el nombre que la propia
        // persona escribió al pedir el acceso.
        var nombreDeSolicitud = await _obtenerNombreSolicitudAceptada(matricula);
        resultado = { valida:true, nombre: nombreDeSolicitud };
      } else {
        if(msg) msg.innerHTML = '<span style="color:#FCA5A5">'+(resultado && resultado.motivo ? resultado.motivo : 'Esa matrícula no aparece en el Informe de Intervención publicado.')+'</span>';
        mostrarBloqueSolicitudAccesoInterv();
        return;
      }
    }

    // NUEVO — Registro del acceso (matrícula + nombre + fecha/hora)
    // en la tabla dedicada accesos_interventor, para que el admin
    // pueda ver en su panel quién ha entrado como Interventor y
    // cuándo (ver cargarAccesosInterventorAdmin(), en el Panel de
    // Administrador). El interventor no ve nada de esto — solo queda
    // registrado para uso interno del admin.
    if(sbAdmin){
      sbAdmin.from('accesos_interventor').insert({
        matricula: matricula,
        nombre: resultado.nombre || null,
        fecha_hora: new Date().toISOString()
      }).then(function(){}).catch(function(){});
    }

    localStorage.setItem('interventorMatriculaValidada', matricula);
    localStorage.setItem('interventorNombreValidado', resultado.nombre || '');
    localStorage.setItem('perfilPortalTrenTurnos', 'interventor');
    ocultarAccesoInterventor();
    mostrarPantallaInterventor();
  }

  // NUEVO — Expuesta a window: cargarDatosParaInterventor() (módulo
  // del Buscador de Compañeros, fuera de este bloque) la llama si la
  // matrícula guardada deja de aparecer en el Informe de Intervención
  // más reciente — por ejemplo tras la actualización semanal del
  // admin.
  window.__cerrarSesionInterventorPorMatriculaInvalida = function(){
    localStorage.removeItem('interventorMatriculaValidada');
    localStorage.removeItem('interventorNombreValidado');
    localStorage.removeItem('perfilPortalTrenTurnos');
    if(typeof usuarioActual !== 'undefined') usuarioActual = null;
    ocultarPantallaInterventor();
    mostrarAccesoInterventor('Tu matrícula ya no aparece en el Informe de Intervención actualizado. Vuelve a comprobarla.');
  };

  function elegirTripulante(){
    // NUEVO — si ya hay sesión de admin activa en este dispositivo,
    // su identidad ya quedó demostrada con email+contraseña (más
    // fuerte que una matrícula) — entra directo, sin matrícula ni
    // descargo, igual que ya se hace en otras partes de la app para
    // el admin.
    if(typeof perfilAdminActual !== 'undefined' && perfilAdminActual && perfilAdminActual.rol === 'admin'){
      localStorage.setItem('perfilPortalTrenTurnos', 'tripulante');
      ocultarPortal();
      ocultarPantallaInterventor();
      return;
    }
    ocultarPortal();
    mostrarAccesoTripulante();
  }
  function mostrarAccesoTripulante(motivo){
    var el = document.getElementById('portal-tripulante-acceso');
    if(el) el.style.display = 'flex';
    var msg = document.getElementById('accesoTripulanteMsg');
    if(msg) msg.innerHTML = motivo ? '<span style="color:#FCA5A5">'+motivo+'</span>' : '';
  }
  function ocultarAccesoTripulante(){
    var el = document.getElementById('portal-tripulante-acceso');
    if(el) el.style.display = 'none';
  }
  // Entra como tripulante SIN rellenar nada — la persona podrá poner
  // su nombre/matrícula/sede a mano en Ajustes, como funcionaba antes
  // de este cambio. Es la vía de escape si no tiene la matrícula a
  // mano ahora mismo, o si prefiere no buscarla.
  function saltarAccesoTripulante(){
    localStorage.setItem('perfilPortalTrenTurnos', 'tripulante');
    ocultarAccesoTripulante();
    ocultarPantallaInterventor();
  }
  async function validarMatriculaTripulanteYEntrar(){
    var input = document.getElementById('accesoMatriculaTripulanteInput');
    var msg = document.getElementById('accesoTripulanteMsg');
    var btn = document.getElementById('btnContinuarAccesoTripulante');
    var checkDescargo = document.getElementById('accesoAceptoDescargoTripulante');
    var matricula = input ? input.value.trim() : '';
    if(!matricula){
      if(msg) msg.innerHTML = '<span style="color:#FCA5A5">Escribe tu número de matrícula.</span>';
      return;
    }
    if(!checkDescargo || !checkDescargo.checked){
      if(msg) msg.innerHTML = '<span style="color:#FCA5A5">Marca la casilla de las condiciones de uso para continuar.</span>';
      return;
    }
    if(typeof buscarTripulanteEnTodasLasSedes !== 'function'){
      if(msg) msg.innerHTML = '<span style="color:#FCA5A5">No se pudo comprobar la matrícula ahora mismo. Inténtalo de nuevo.</span>';
      return;
    }
    var textoOriginal = btn ? btn.textContent : '';
    if(btn){ btn.disabled = true; btn.textContent = 'Buscando en todas las sedes...'; }
    var resultado = { valida:false, motivo:'No se pudo comprobar la matrícula ahora mismo. Inténtalo de nuevo.' };
    try{
      resultado = await buscarTripulanteEnTodasLasSedes(matricula);
    }catch(e){
      resultado = { valida:false, motivo:'No se pudo comprobar la matrícula ahora mismo. Inténtalo de nuevo.' };
    }
    if(btn){ btn.disabled = false; btn.textContent = textoOriginal; }

    if(!resultado || !resultado.valida){
      // NUEVO — si el admin ya aceptó manualmente una solicitud de
      // acceso para esta matrícula, se deja pasar como si la
      // hubiera encontrado en un Horario General (nombre/sede se
      // dejan vacíos: la persona los puede rellenar en Ajustes).
      var solicitudAceptadaTrip = await _matriculaTieneSolicitudAceptada(matricula);
      if(solicitudAceptadaTrip){
        resultado = { valida:true, nombre:null, sede:null };
      } else {
        if(msg) msg.innerHTML = '<span style="color:#FCA5A5">'+(resultado && resultado.motivo ? resultado.motivo : 'Esa matrícula no aparece en ningún Horario General publicado.')+'</span>';
        mostrarBloqueSolicitudAccesoTrip();
        return;
      }
    }

    // Encontrada: se rellenan AJ.nombre/AJ.matricula/AJ.base solas —
    // a partir de aquí ya no hace falta entrar en Ajustes para nada
    // de esto (solo para cambiar el nombre a mano o los montos a
    // pagar, si algún día hace falta).
    if(typeof AJ !== 'undefined'){
      AJ.nombre = resultado.nombre || AJ.nombre;
      AJ.matricula = matricula;
      AJ.base = resultado.sede || AJ.base;
      try{ localStorage.setItem('aj5', JSON.stringify(AJ)); }catch(e){}
    }
    // NUEVO — deja la MISMA marca que ya usa el Buscador de
    // Compañeros para saber que esta matrícula ya aceptó el
    // descargo — así, al entrar luego al Buscador, no se le vuelve a
    // preguntar nada (ni matrícula ni condiciones), porque ya quedó
    // resuelto aquí, en el primer acceso a la app.
    try{ localStorage.setItem('descargoAceptado_matricula', matricula); }catch(e){}

    // NUEVO — Registro del acceso (matrícula + nombre + sede + fecha)
    // en la tabla dedicada accesos_tripulante, para que el admin
    // pueda ver en su panel quién usa la app como Tripulante — igual
    // que ya existe para Interventor. Solo la PRIMERA vez por
    // matrícula (matricula es la clave primaria de la tabla): si ya
    // existe, el error de clave duplicada se ignora a propósito, sin
    // molestar a la persona con ningún aviso.
    if(sbAdmin){
      sbAdmin.from('accesos_tripulante').insert({
        matricula: matricula,
        nombre: resultado.nombre || null,
        sede: resultado.sede || null,
        fecha_hora: new Date().toISOString()
      }).then(function(){}).catch(function(){});
    }

    localStorage.setItem('perfilPortalTrenTurnos', 'tripulante');
    ocultarAccesoTripulante();
    ocultarPantallaInterventor();
    if(typeof toast==='function') toast('✅ ¡Hola '+(resultado.nombre||'')+'! Sede: '+(resultado.sede||'—'));
    if(typeof actualizarSaludo==='function') actualizarSaludo();
  }
  // MODIFICADO — ya no se entra directo al elegir "Interventor": ahora
  // primero se pide su matrícula y se comprueba contra el Horario
  // General publicado (ver mostrarAccesoInterventor /
  // validarMatriculaInterventor, arriba). Solo si la comprobación pasa
  // se guarda 'perfilPortalTrenTurnos'='interventor' y se entra.
  function elegirInterventor(){
    // NUEVO — mismo bypass que en elegirTripulante(): el admin ya
    // demostró quién es con su email+contraseña, no necesita pasar
    // por la matrícula de interventor.
    if(typeof perfilAdminActual !== 'undefined' && perfilAdminActual && perfilAdminActual.rol === 'admin'){
      localStorage.setItem('perfilPortalTrenTurnos', 'interventor');
      ocultarPortal();
      mostrarPantallaInterventor();
      return;
    }
    ocultarPortal();
    mostrarAccesoInterventor();
  }
  function cambiarPerfil(){
    localStorage.removeItem('perfilPortalTrenTurnos');
    // NUEVO — al cambiar de perfil se olvida también la matrícula de
    // interventor ya validada, para que la próxima vez que se elija
    // "Interventor" se compruebe de nuevo contra el listado más
    // reciente (evita que una matrícula dada de baja siga entrando
    // solo porque quedó guardada en este dispositivo).
    localStorage.removeItem('interventorMatriculaValidada');
    localStorage.removeItem('interventorNombreValidado');
    if(typeof usuarioActual !== 'undefined') usuarioActual = null;
    ocultarPantallaInterventor();
    ocultarAccesoInterventor();
    mostrarPortal();
  }

  function iniciar(){
    var btnT = document.getElementById('btnPerfilTripulante');
    var btnI = document.getElementById('btnPerfilInterventor');
    var btnC1 = document.getElementById('btnCambiarPerfilInterventor');
    var btnC2 = document.getElementById('btnCambiarPerfilAjustes');
    if(btnT) btnT.addEventListener('click', elegirTripulante);
    if(btnI) btnI.addEventListener('click', elegirInterventor);
    if(btnC1) btnC1.addEventListener('click', cambiarPerfil);
    if(btnC2) btnC2.addEventListener('click', cambiarPerfil);

    // NUEVO — Acceso de Interventor (matrícula + descargo)
    var btnValidar = document.getElementById('btnContinuarAccesoInterventor');
    var btnVolver = document.getElementById('btnVolverAccesoInterventor');
    var inputMat = document.getElementById('accesoMatriculaInterventorInput');
    var btnVerDescargo = document.getElementById('btnVerDescargoInterventor');
    var btnCerrarDescargo = document.getElementById('btnCerrarDescargoInterventor');
    if(btnValidar) btnValidar.addEventListener('click', validarMatriculaInterventor);
    if(btnVolver) btnVolver.addEventListener('click', function(){
      ocultarAccesoInterventor();
      mostrarPortal();
    });
    if(inputMat) inputMat.addEventListener('keydown', function(e){
      if(e.key === 'Enter') validarMatriculaInterventor();
    });
    if(btnVerDescargo) btnVerDescargo.addEventListener('click', abrirDescargoInterventor);
    if(btnCerrarDescargo) btnCerrarDescargo.addEventListener('click', cerrarDescargoInterventor);

    // NUEVO — Acceso de Tripulante (matrícula, sin descargo)
    var btnValidarT = document.getElementById('btnContinuarAccesoTripulante');
    var btnSaltarT = document.getElementById('btnSaltarAccesoTripulante');
    var btnVolverT = document.getElementById('btnVolverAccesoTripulante');
    var inputMatT = document.getElementById('accesoMatriculaTripulanteInput');
    if(btnValidarT) btnValidarT.addEventListener('click', validarMatriculaTripulanteYEntrar);
    if(btnSaltarT) btnSaltarT.addEventListener('click', saltarAccesoTripulante);
    if(btnVolverT) btnVolverT.addEventListener('click', function(){
      ocultarAccesoTripulante();
      mostrarPortal();
    });
    if(inputMatT) inputMatT.addEventListener('keydown', function(e){
      if(e.key === 'Enter') validarMatriculaTripulanteYEntrar();
    });
    var btnVerDescargoT = document.getElementById('btnVerDescargoTripulante');
    var btnCerrarDescargoT = document.getElementById('btnCerrarDescargoTripulante');
    if(btnVerDescargoT) btnVerDescargoT.addEventListener('click', function(){
      var m = document.getElementById('tripulanteDescargoModal');
      if(m) m.style.display = 'flex';
    });
    if(btnCerrarDescargoT) btnCerrarDescargoT.addEventListener('click', function(){
      var m = document.getElementById('tripulanteDescargoModal');
      if(m) m.style.display = 'none';
    });
  }

  // FIX — antes el Portal de Perfil decidía cuándo aparecer con SU
  // PROPIO cronómetro (un setTimeout calculado a ojo, por separado
  // del que usa el splash) — dos relojes distintos que podían
  // desajustarse, dejando ver el calendario de tripulación un
  // instante antes de que el portal llegara a taparlo. Ahora la
  // decisión de "¿toca mostrar el portal?" se separa del enganchado
  // de los botones (que puede hacerse ya mismo, sin esperar nada), y
  // se expone en window para que el propio splash (ver su <script>
  // más arriba) avise en el momento EXACTO en que empieza a
  // desvanecerse — nunca dos cronómetros corriendo por su cuenta.
  var _yaSeReviso = false;
  function revisarPerfil(){
    if(_yaSeReviso) return; // por si el splash Y la red de seguridad disparan los dos
    _yaSeReviso = true;
    var elegido = localStorage.getItem('perfilPortalTrenTurnos');
    if(elegido === 'interventor'){
      // NUEVO — solo se entra directo si esta matrícula ya quedó
      // validada antes en este dispositivo (localStorage). Si no —
      // primera vez con esta versión, o la matrícula fue invalidada
      // por cargarDatosParaInterventor() al detectar que ya no
      // figura en el Horario General más reciente — se vuelve a
      // pedir en vez de entrar directo.
      var matriculaGuardada = localStorage.getItem('interventorMatriculaValidada');
      if(matriculaGuardada){
        mostrarPantallaInterventor();
      } else {
        mostrarAccesoInterventor();
      }
    } else if(elegido !== 'tripulante'){
      mostrarPortal();
    }
  }
  window.__revisarPerfilAlTerminarSplash = revisarPerfil;

  function iniciarConRetraso(){
    iniciar();
    // Red de seguridad: si por lo que sea el splash no llegara a
    // avisar (por ejemplo, si su elemento no existiera en el DOM),
    // esto asegura que el portal aparezca de todos modos, un poco
    // más tarde que de costumbre en vez de nunca.
    setTimeout(revisarPerfil, 3200);
    // NUEVO — primera comprobación de la píldora ✅ Check-in (el
    // Calendario ya está abierto por defecto al cargar, así que no
    // pasa por goP('cal')). Con un pequeño margen para que la
    // restauración de sesión/rol (cargarPerfilYVerificarAdmin) tenga
    // tiempo de completarse antes de decidir si se muestra o no.
    setTimeout(function(){
      if(typeof mostrarPillCheckinSiCorresponde==='function') mostrarPillCheckinSiCorresponde();
    }, 3500);
    // NUEVO — aviso de cookies (Google AdSense / Adsterra), un poco
    // más tarde que el resto para no competir visualmente con el
    // splash de bienvenida.
    setTimeout(function(){
      if(typeof mostrarAvisoCookiesSiHaceFalta==='function') mostrarAvisoCookiesSiHaceFalta();
    }, 4000);
    // NUEVO — aviso sobre la publicidad (disculpa + qué se quitó),
    // una sola vez. Se muestra un poco más tarde que las cookies para
    // que no compitan por la atención al mismo tiempo.
    setTimeout(function(){
      if(typeof mostrarAvisoPublicidadSiHaceFalta==='function') mostrarAvisoPublicidadSiHaceFalta();
    }, 4600);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', iniciarConRetraso);
  } else {
    iniciarConRetraso();
  }

  /* ═══════════════════════════════════════════════════════════
     NUEVO — Interceptar el botón "atrás" del móvil. Sin esto, cada
     pulsación de "atrás" saca directamente del navegador/app. Con
     esto: si hay algún popup abierto, lo cierra primero; si no hay
     ninguno pero no estás en Calendario, te lleva ahí; solo si ya
     estás en Calendario sin nada abierto, deja que "atrás" haga lo
     normal (salir). Usa el truco estándar de "pushState + popstate":
     cada vez que se abre algo, se añade un paso al historial del
     navegador, así "atrás" tiene algo que consumir antes de salir de
     verdad. 100% aditivo — no reemplaza closeOv()/goP(), los llama.
  ═══════════════════════════════════════════════════════════ */
  history.pushState({trenturnos:true}, '', location.href);
  window.addEventListener('popstate', function(){
    var overlaysAbiertos = document.querySelectorAll('.ov.on');
    if(overlaysAbiertos.length){
      // Cierra el último abierto (el más "de encima" en overlays
      // anidados, ej. ov-copiar-tipo sobre ov-copiar-cal).
      var ultimo = overlaysAbiertos[overlaysAbiertos.length-1];
      if(typeof closeOv==='function') closeOv(ultimo.id);
      history.pushState({trenturnos:true}, '', location.href);
      return;
    }
    var panelCal = document.getElementById('p-cal');
    var yaEnCalendario = panelCal && panelCal.classList.contains('on');
    if(!yaEnCalendario){
      if(typeof goP==='function') goP('cal');
      history.pushState({trenturnos:true}, '', location.href);
      return;
    }
    // Ya está en Calendario y no hay nada abierto: no se vuelve a
    // añadir historial, así el siguiente "atrás" sale de la app de
    // verdad — es el comportamiento esperado en la pantalla principal.
  });
})();
