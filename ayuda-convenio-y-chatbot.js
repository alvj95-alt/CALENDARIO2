/* TrenTurnos v5 — Tutorial, aviso de publicidad, lector del Convenio y chatbot de ayuda
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function abrirTutorial(){
  renderTutorial();
  var entrada = document.getElementById('convenio-entrada-tutorial');
  if(entrada){
    entrada.innerHTML = '<div class="conv-entrada" onclick="abrirConvenio()">'
      + '<div class="conv-entrada-tit">📜 Convenio Colectivo</div>'
      + '<div class="conv-entrada-sub">El convenio de Serveo, digitalizado y organizado como el resto de la app — busca por artículo o por tema.</div>'
      + '<div class="conv-entrada-btn">Abrir el Convenio →</div></div>';
  }
  // FIX — Confirmado por Alex (Estilo A de Stats): "¿Qué significa
  // cada cuenta?" se movió aquí desde Stats — mismo overlay
  // ov-guia-cuentas de siempre, solo cambia desde dónde se abre.
  var entradaGuia = document.getElementById('guia-cuentas-entrada-tutorial');
  if(entradaGuia){
    entradaGuia.innerHTML = '<div class="conv-entrada" style="background:linear-gradient(135deg, rgba(124,58,237,.14), rgba(37,99,235,.08));border-color:rgba(124,58,237,.35)" onclick="openOv(\'ov-guia-cuentas\')">'
      + '<div class="conv-entrada-tit">ℹ️ ¿Qué significa cada cuenta?</div>'
      + '<div class="conv-entrada-sub">HTDL, Nocturnidad, Rebase, Plus Traslación... una guía rápida de cada concepto que ves en Stats.</div>'
      + '<div class="conv-entrada-btn">Ver la guía →</div></div>';
  }
  openOv('ov-tutorial');
}
function renderTutorial(){
  var esAdmin = (typeof perfilAdminActual!=='undefined' && perfilAdminActual && perfilAdminActual.rol==='admin');
  var temas = TUTORIAL_TEMAS.filter(function(t){ return !t.admin || esAdmin; });
  document.getElementById('tutorial-body').innerHTML = temas.map(function(t, i){
    return '<div class="tut-item" id="tut-item-'+i+'">'
      + '<div class="tut-item-hdr" onclick="toggleTutorialItem('+i+')">'
      + '<span class="tut-item-ico">'+t.ico+'</span>'
      + '<span class="tut-item-tit">'+t.titulo+'</span>'
      + (t.admin ? '<span class="tut-admin-badge">ADMIN</span>' : '')
      + '<span class="tut-item-arr">›</span></div>'
      + '<div class="tut-item-body">'
      + t.pasos.map(function(p, pi){
          return '<div class="tut-step"><span class="tut-step-n">'+(pi+1)+'</span><span>'+p+'</span></div>';
        }).join('')
      + '</div></div>';
  }).join('');
}
function toggleTutorialItem(i){
  var el = document.getElementById('tut-item-'+i);
  if(el) el.classList.toggle('open');
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — AVISO SOBRE LA PUBLICIDAD. Aparece una sola vez para
   cualquiera (Tripulación o Interventor); ver openOv/closeOv propios
   más abajo — usa "display:flex" directo en vez de openOv() genérico
   porque este aviso no debe cerrarse tocando fuera (solo con el
   botón "Entendido"), a diferencia del resto de overlays.
═══════════════════════════════════════════════════════════ */
function mostrarAvisoPublicidadSiHaceFalta(){
  if(localStorage.getItem('aviso_publicidad_visto')==='1') return;
  var el = document.getElementById('ov-aviso-publicidad');
  if(el) el.classList.add('on');
}
function cerrarAvisoPublicidad(){
  localStorage.setItem('aviso_publicidad_visto', '1');
  var el = document.getElementById('ov-aviso-publicidad');
  if(el) el.classList.remove('on');
}

function abrirChatbot(){
  var conv = document.getElementById('chatbot-conversacion');
  if(conv && !conv.dataset.iniciado){
    conv.innerHTML = '<div class="chat-bienvenida">👋 Hola, escribe qué necesitas (por ejemplo "check-in", "pernocta", "retraso"...) y te muestro los pasos. Si no encuentro nada, te dejo hablar directamente conmigo.</div>';
    conv.dataset.iniciado = '1';
  }
  openOv('ov-chatbot');
  setTimeout(function(){ var inp=document.getElementById('chatbot-input'); if(inp) inp.focus(); }, 300);
}

/* ═══════════════════════════════════════════════════════════
   NUEVO — Confirmado por Alex: LECTOR DEL CONVENIO COLECTIVO.
   Usa CONVENIO_CAPITULOS/CONVENIO_DATA (ver bloque de datos, cerca de
   TUTORIAL_TEMAS). Búsqueda por palabras clave sobre título+texto,
   sin IA, sin coste — mismo criterio que el chatbot de ayuda.
═══════════════════════════════════════════════════════════ */
function abrirConvenio(){
  openOv('ov-convenio');
  var inp = document.getElementById('convenioBuscador');
  if(inp) inp.value = '';
  renderConvenioLista('');
  setTimeout(function(){ if(inp) inp.focus(); }, 300);
}

// Quita acentos para que buscar "vacacion" encuentre "vacación", etc.
function _convenioNormaliza(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function renderConvenioLista(filtro){
  var cont = document.getElementById('convenioLista');
  if(!cont || typeof CONVENIO_DATA==='undefined') return;
  var f = _convenioNormaliza(filtro).trim();
  var porCapitulo = {};
  CONVENIO_DATA.forEach(function(fila, idx){
    var capIdx = fila[0], numero = fila[1], titulo = fila[2], texto = fila[3];
    if(f){
      var hay = _convenioNormaliza(titulo+' '+texto).indexOf(f) !== -1;
      if(!hay) return;
    }
    var cap = CONVENIO_CAPITULOS[capIdx];
    if(!porCapitulo[cap]) porCapitulo[cap] = [];
    porCapitulo[cap].push({idx:idx, numero:numero, titulo:titulo});
  });
  if(!Object.keys(porCapitulo).length){
    cont.innerHTML = '<div class="conv-empty">No encontré ningún artículo con eso. Prueba con otra palabra.</div>';
    return;
  }
  var htmlOut = '';
  CONVENIO_CAPITULOS.forEach(function(cap){
    if(!porCapitulo[cap]) return;
    htmlOut += '<div class="conv-cap-tit">'+cap+'</div>';
    porCapitulo[cap].forEach(function(a){
      htmlOut += '<div class="conv-art-row" id="conv-art-'+a.idx+'">'
        + '<div class="conv-art-row-hdr" onclick="toggleConvenioArt('+a.idx+')">'
        + '<span class="conv-art-row-n">'+(a.numero?('Art. '+a.numero):'')+'</span>'
        + '<span class="conv-art-row-tit">'+a.titulo+'</span>'
        + '<span class="conv-art-row-arr">›</span></div>'
        + '<div class="conv-art-row-body"></div></div>';
    });
  });
  cont.innerHTML = htmlOut;
}

function toggleConvenioArt(idx){
  var el = document.getElementById('conv-art-'+idx);
  if(!el) return;
  var abierto = el.classList.toggle('open');
  if(abierto){
    var body = el.querySelector('.conv-art-row-body');
    // Se rellena el texto SOLO al abrir (no al pintar la lista entera)
    // — con 131 artículos, meter todo el texto de golpe en el DOM
    // sería mucho más lento sin ninguna ventaja, ya que casi siempre
    // solo se abren uno o dos.
    if(body && !body.dataset.cargado){
      body.textContent = CONVENIO_DATA[idx][3];
      body.dataset.cargado = '1';
    }
  }
}

// NUEVO — abre el lector directamente en un artículo concreto (lo usa
// el chatbot, tras responder con un extracto, para "ver completo").
function abrirConvenioEnArticulo(idx){
  abrirConvenio();
  setTimeout(function(){
    var inp = document.getElementById('convenioBuscador');
    if(inp) inp.value = '';
    renderConvenioLista('');
    var el = document.getElementById('conv-art-'+idx);
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      if(!el.classList.contains('open')) toggleConvenioArt(idx);
    }
  }, 350);
}
function _convenioObtenerNormCache(){
  if(_convenioNormCache) return _convenioNormCache;
  _convenioNormCache = (typeof CONVENIO_DATA!=='undefined' ? CONVENIO_DATA : []).map(function(fila){
    return { titulo: _convenioNormaliza(fila[2]), texto: _convenioNormaliza(fila[3]) };
  });
  return _convenioNormCache;
}

function _chatbotBuscarConvenio(pregunta){
  if(typeof CONVENIO_DATA==='undefined') return null;
  var palabrasC = pregunta.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúñ\s]/g, ' ')
    .split(/\s+/)
    .filter(function(p){ return p.length>2 && CHATBOT_PALABRAS_VACIAS.indexOf(p)===-1; });
  if(!palabrasC.length) return null;

  var norm = _convenioObtenerNormCache();
  // FIX — Confirmado por Alex (bug real, detectado en pruebas): antes
  // cada palabra encontrada en el título valía siempre lo mismo (x3).
  // Con un convenio de 131 artículos, palabras genéricas como "paga"
  // aparecen en decenas de ellos, y podían ganarle a una palabra
  // rarísima y mucho más relevante como "htdl" (que solo aparece en 2
  // o 3). Ahora cada palabra pesa según su especificidad: cuantos
  // menos artículos la contienen, más vale — así una coincidencia con
  // "htdl" pesa mucho más que una con "paga".
  var pesoPalabra = {};
  palabrasC.forEach(function(p){
    var df = 0;
    norm.forEach(function(n){ if(n.titulo.indexOf(p)>=0 || n.texto.indexOf(p)>=0) df++; });
    pesoPalabra[p] = df>0 ? Math.max(1, Math.round(norm.length/df)) : 1;
  });

  var mejorIdx = -1, mejorPuntosC = 0, mejorTuvoTitulo = false;
  norm.forEach(function(n, idx){
    var puntosC = 0, tuvoTitulo = false;
    palabrasC.forEach(function(p){
      var w = pesoPalabra[p];
      if(n.titulo.indexOf(p)>=0){ puntosC += w*3; tuvoTitulo = true; }
      else if(n.texto.indexOf(p)>=0) puntosC += w;
    });
    if(puntosC>mejorPuntosC){ mejorPuntosC=puntosC; mejorIdx=idx; mejorTuvoTitulo=tuvoTitulo; }
  });
  // FIX — Confirmado por Alex (bug real, detectado en pruebas): al
  // pesar más las palabras raras, una coincidencia SUELTA en el
  // CUERPO de algún artículo (sin relación real con la pregunta)
  // podía superar el puntaje del Tutorial y robarle el turno — por
  // ejemplo, "cómo registro una pernocta" terminaba enganchando un
  // artículo sobre faltas laborales, solo porque contenía alguna
  // palabra rara suelta. Se añade tituloCoincidio: el Convenio solo
  // puede ganarle al Tutorial si al menos una palabra apareció en el
  // TÍTULO del artículo — una coincidencia de cuerpo aislada nunca es
  // suficiente por sí sola para preferirlo sobre el Tutorial.
  return mejorIdx>=0 ? {idx:mejorIdx, numero:CONVENIO_DATA[mejorIdx][1], titulo:CONVENIO_DATA[mejorIdx][2], texto:CONVENIO_DATA[mejorIdx][3], puntos:mejorPuntosC, tituloCoincidio:mejorTuvoTitulo} : null;
}

function _chatbotBuscarTema(pregunta){
  var palabras = pregunta.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos, para que "vacacion"="vacación"
    .replace(/[^a-z0-9áéíóúñ\s]/g, ' ')
    .split(/\s+/)
    .filter(function(p){ return p.length>2 && CHATBOT_PALABRAS_VACIAS.indexOf(p)===-1; });
  if(!palabras.length) return null;

  var esAdmin = (typeof perfilAdminActual!=='undefined' && perfilAdminActual && perfilAdminActual.rol==='admin');
  var mejorTema = null, mejorPuntos = 0;
  TUTORIAL_TEMAS.forEach(function(t){
    if(t.admin && !esAdmin) return;
    var textoTema = (t.titulo+' '+t.pasos.join(' ')).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var puntos = 0;
    palabras.forEach(function(p){ if(textoTema.indexOf(p)>=0) puntos++; });
    if(puntos>mejorPuntos){ mejorPuntos=puntos; mejorTema=t; }
  });
  return mejorPuntos>0 ? {tema:mejorTema, puntos:mejorPuntos} : null;
}

function enviarPreguntaChatbot(){
  var input = document.getElementById('chatbot-input');
  var pregunta = (input.value||'').trim();
  if(!pregunta) return;
  input.value = '';

  var conv = document.getElementById('chatbot-conversacion');
  conv.innerHTML += '<div class="chat-msg usuario"><div class="chat-bubble">'+pregunta.replace(/</g,'&lt;')+'</div></div>';

  // NUEVO — Confirmado por Alex: se comprueban las dos fuentes (el
  // Tutorial de siempre, y ahora también el Convenio) y se muestra la
  // que tenga más coincidencias — en empate gana el Tutorial, porque
  // da pasos directos a seguir en la app, más útil que un artículo
  // legal cuando ambos encajan igual de bien.
  var resTema = _chatbotBuscarTema(pregunta);
  var resConvenio = _chatbotBuscarConvenio(pregunta);
  var puntosTema = resTema ? resTema.puntos : 0;
  var puntosConvenio = resConvenio ? resConvenio.puntos : 0;

  if(resConvenio && resConvenio.tituloCoincidio && puntosConvenio > puntosTema){
    // NUEVO — respuesta desde el Convenio: un extracto corto (no el
    // artículo entero, que puede tener miles de caracteres) + enlace
    // para abrirlo completo en el lector.
    var extracto = resConvenio.texto.replace(/\s+/g,' ').trim();
    if(extracto.length > 320) extracto = extracto.slice(0, 320).trim() + '…';
    conv.innerHTML += '<div class="chat-msg bot"><div class="chat-bubble">'
      + '<div class="chat-tit">📜 '+(resConvenio.numero?('Art. '+resConvenio.numero+' — '):'')+resConvenio.titulo+'</div>'
      + extracto.replace(/</g,'&lt;')
      + '<div class="chat-conv-fuente" onclick="abrirConvenioEnArticulo('+resConvenio.idx+')">📖 Ver el artículo completo en el Convenio →</div>'
      + '</div></div>';
  } else if(resTema){
    var tema = resTema.tema;
    var pasosHtml = tema.pasos.map(function(p, pi){
      return '<div class="tut-step"><span class="tut-step-n">'+(pi+1)+'</span><span>'+p+'</span></div>';
    }).join('');
    conv.innerHTML += '<div class="chat-msg bot"><div class="chat-bubble">'
      + '<div class="chat-tit">'+tema.ico+' '+tema.titulo+'</div>'
      + pasosHtml + '</div></div>';
  } else {
    var waUrl = 'https://wa.me/'+WHATSAPP_SOPORTE+'?text='+encodeURIComponent('Hola, tengo una duda con TrenTurnos: '+pregunta);
    conv.innerHTML += '<div class="chat-msg bot"><div class="chat-bubble">'
      + 'No he encontrado nada claro sobre eso en el Tutorial ni en el Convenio. Puedes intentar con otras palabras, o hablar directamente conmigo:'
      + '<div><a class="chat-wa-btn" href="'+waUrl+'" target="_blank">💬 Hablar por WhatsApp</a></div>'
      + '</div></div>';
  }
  conv.scrollTop = conv.scrollHeight;
}
