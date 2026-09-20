/* TrenTurnos v5 — Mi horario personal en la nube
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
// Ayudante — actualiza CUALQUIER cuadro de estado que exista en la
// pantalla actual (el del Panel Admin y/o el de Ajustes), ya que la
// misma acción (guardar/comprobar) puede lanzarse desde cualquiera
// de los dos sitios y ambos deben reflejar el resultado.
function _actualizarEstadosNube(texto, esOk){
  ['estadoHorarioNube','estadoHorarioNubeUsr'].forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.textContent = texto;
    if(esOk) el.classList.remove('sin-archivo'); else el.classList.add('sin-archivo');
  });
}

async function guardarHorarioEnNube(){
  if(!usuarioActual) return;
  _actualizarEstadosNube('Guardando...', false);

  var indice = await getMonthIndex();
  var meses = {};
  for(var i=0; i<indice.length; i++){
    meses[indice[i]] = await loadMonth(indice[i]);
  }

  // FIX — REDISEÑO: user_id ya no es un UUID de Supabase Auth (las
  // cuentas de matrícula+PIN ya no viven ahí). Se usa directamente la
  // matrícula como identificador — sigue siendo única por persona.
  // Requiere que la columna user_id de esta tabla acepte texto (no
  // solo UUID); ver nota al usuario sobre el cambio de esquema.
  // NUEVO — antes solo se guardaba el calendario (TV) y el horario
  // individual. Ahora también se guarda el PERFIL completo (AJ):
  // matrícula, nombre, si eres tripulante o auxiliar, tarifas,
  // pluses, alarmas... — todo lo de Ajustes. Así, al recuperar desde
  // otro dispositivo, no solo vuelve el calendario: vuelve también
  // quién eres y cómo tienes todo configurado.
  // NUEVO — antes solo se guardaban el calendario (TV), el horario
  // individual y el perfil (AJ). Ahora se guarda TAMBIÉN todo lo
  // demás que vive en este dispositivo y que no es solo "el
  // calendario": Servicios Frecuentes (las estaciones/trenes ya
  // guardados para autocompletar), Agenda de Compañeros, el Sistema
  // Horario Compañero, los turnos secundarios (TV2), los contadores
  // de uso de Art.51/52 (para que el límite mensual/anual también
  // viaje entre dispositivos) y el registro de correos de HTDL ya
  // enviados. Absolutamente todo lo que hay guardado en este
  // dispositivo relacionado con tu horario personal.
  var extras = {
    sf: SF,
    agenda: AGENDA,
    compData: COMP_DATA,
    tv2: TV2,
    art5152Dias: ART5152_DIAS,
    art5152Uso: ART5152_USO,
    art5152UsoAnual: ART5152_USO_ANUAL,
    htdlCorreos: _leerJSONseguro('htdl_correos', {}),
    // NUEVO — Cómputo Oficial (Excel): antes vivía SOLO en este
    // dispositivo (computoExcelPorMes en localStorage), así que al
    // cambiar de móvil se perdía la comparativa ya subida. Se guarda
    // el mismo objeto que ya usa _computoExcelPorMes (uno por mes).
    computoExcel: _computoExcelPorMes
  };
  var payload = {
    user_id: usuarioActual.matricula || usuarioActual.id,
    tv_json: TV,
    horarios_json: {index: indice, meses: meses},
    perfil_json: AJ,
    extras_json: extras,
    actualizado: new Date().toISOString()
  };
  var resp = await sbAdmin.from('datos_personales').upsert(payload);
  if(resp.error){
    _actualizarEstadosNube('Error al guardar: ' + resp.error.message, false);
    return;
  }
  _actualizarEstadosNube('✅ Guardado el ' + new Date().toLocaleString('es-ES'), true);
  toast('☁️ Horario personal guardado en la nube');
}

// Se llama SOLO tras un login explícito (dispositivo nuevo o sesión
// no persistida). Si hay datos guardados en la nube para este user_id,
// pregunta antes de tocar nada local — nunca carga en automático.
async function comprobarHorarioEnNube(silencioso){
  if(!usuarioActual) return;
  var resp = await sbAdmin.from('datos_personales').select('*').eq('user_id', usuarioActual.matricula || usuarioActual.id).single();
  if(resp.error || !resp.data){
    if(!silencioso) _actualizarEstadosNube('No hay ninguna copia guardada todavía para esta cuenta.', false);
    return;
  }
  _datosNubePendientes = resp.data;
  var lbl = document.getElementById('nubeFechaLbl');
  if(lbl) lbl.textContent = resp.data.actualizado ? new Date(resp.data.actualizado).toLocaleString('es-ES') : '—';
  openOv('ov-cargar-nube');
}

async function cargarHorarioDesdeNube(){
  if(!_datosNubePendientes) return;
  var d = _datosNubePendientes;

  if(d.tv_json){
    TV = d.tv_json;
    saveTV();
  }
  if(d.horarios_json && d.horarios_json.meses){
    var idx = d.horarios_json.index || Object.keys(d.horarios_json.meses);
    for(var i=0; i<idx.length; i++){
      var mk = idx[i], mdata = d.horarios_json.meses[mk];
      if(mdata) localStore.set('horario:' + mk, JSON.stringify(mdata));
    }
    await saveMonthIndex(idx);
  }

  // NUEVO — restaura también el perfil (matrícula, nombre, rol,
  // tarifas, pluses, alarmas...), no solo el calendario. Como AJ
  // afecta a muchísimas pantallas distintas (cabecera, Ajustes,
  // cálculos de nómina), se recarga la app entera después para que
  // todo quede consistente de una vez, en vez de intentar refrescar
  // cada pantalla suelta una por una.
  var huboPerfilRestaurado = false;
  if(d.perfil_json){
    Object.assign(AJ, d.perfil_json);
    localStorage.setItem('aj5', JSON.stringify(AJ));
    huboPerfilRestaurado = true;
  }

  // NUEVO — restaura también Servicios Frecuentes, Agenda de
  // Compañeros, Sistema Horario Compañero, turnos secundarios (TV2),
  // contadores de Art.51/52 y correos de HTDL ya enviados — todo lo
  // que se guardó de más arriba en guardarHorarioEnNube().
  if(d.extras_json){
    var ex = d.extras_json;
    if(ex.sf){ SF = ex.sf; localStorage.setItem('sf5', JSON.stringify(SF)); }
    if(ex.agenda){ AGENDA = ex.agenda; localStorage.setItem('agenda5', JSON.stringify(AGENDA)); }
    if(ex.compData){ COMP_DATA = ex.compData; localStorage.setItem('comp5', JSON.stringify(COMP_DATA)); }
    if(ex.tv2){ TV2 = ex.tv2; localStorage.setItem('tv2_extra', JSON.stringify(TV2)); }
    if(ex.art5152Dias){ ART5152_DIAS = ex.art5152Dias; localStorage.setItem('art5152_dias', JSON.stringify(ART5152_DIAS)); }
    if(ex.art5152Uso){ ART5152_USO = ex.art5152Uso; localStorage.setItem('art5152_uso', JSON.stringify(ART5152_USO)); }
    if(ex.art5152UsoAnual){ ART5152_USO_ANUAL = ex.art5152UsoAnual; localStorage.setItem('art5152_uso_anual', JSON.stringify(ART5152_USO_ANUAL)); }
    if(ex.htdlCorreos){ localStorage.setItem('htdl_correos', JSON.stringify(ex.htdlCorreos)); }
    // NUEVO — restaura el Cómputo Oficial (Excel) igual que el resto.
    if(ex.computoExcel){ _computoExcelPorMes = ex.computoExcel; _guardarComputoExcelPorMes(); }
  }

  closeOv('ov-cargar-nube');
  toast(huboPerfilRestaurado ? '☁️ Horario y perfil cargados desde la nube' : '☁️ Horario cargado desde la nube');
  _datosNubePendientes = null;

  if(huboPerfilRestaurado){
    // Recarga para que el perfil restaurado se refleje en TODA la
    // app (cabecera, Ajustes, cálculos de nómina) sin dejarse nada.
    setTimeout(function(){ location.reload(); }, 900);
    return;
  }

  // Refresca todas las vistas que dependen de TV / horario individual
  if(typeof renderCal==='function') renderCal();
  if(typeof renderStats==='function') renderStats();
  if(typeof renderMonthListIndividual==='function') renderMonthListIndividual();
}

function rechazarCargaNube(){
  closeOv('ov-cargar-nube');
  _datosNubePendientes = null;
}
