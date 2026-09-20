/* TrenTurnos v5 — Alarmas y alarma persistente
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
// Crear/recuperar el AudioContext — debe llamarse desde un evento de usuario
function alarmaGetCtx(){
  if(!_audioCtx){
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e){ _audioCtx = null; }
  }
  // Android/Chrome suspende el contexto si no hay interacción reciente
  if(_audioCtx && _audioCtx.state === 'suspended'){
    _audioCtx.resume();
  }
  return _audioCtx;
}

// Llamar esto en cada toque/clic del usuario para "desbloquear" el audio
function alarmaDesbloquear(){
  var ctx = alarmaGetCtx();
  if(ctx && ctx.state === 'suspended') ctx.resume();
}

// Minutos desde medianoche para una hora "HH:MM"
function alarmaToMin(hhmm){
  if(!hhmm || hhmm.indexOf(':')<0) return -1;
  var p = hhmm.split(':');
  var h = parseInt(p[0],10);
  var m = parseInt(p[1],10);
  if(isNaN(h)||isNaN(m)||h<0||h>23||m<0||m>59) return -1;
  return h*60 + m;
}

// Dispara notificación nativa (Web Notifications) o fallback visual
function alarmaNotificar(titulo, cuerpo, idUnico){
  if(_alarmasDisparadas[idUnico]) return; // ya avisado hoy
  _alarmasDisparadas[idUnico] = true;

  // Reproducir sonido
  alarmaSonar();

  // Notificación del SO
  if(window.Notification && Notification.permission==='granted'){
    try{ new Notification(titulo, {body:cuerpo, icon:'', tag:idUnico}); }catch(e){}
  }

  // Toast visual siempre
  toast('🔔 '+titulo);
  // Hook aditivo: activar loop persistente
  alarmaActivarPersistente(titulo, idUnico);
}

// Función de sonido separada — reutilizable desde botón de prueba
function alarmaSonar(){
  var ctx = alarmaGetCtx();
  if(!ctx) return;
  try {
    // Secuencia: 3 pitidos cortos y uno largo
    var notas = [880, 880, 880, 660];
    var tiempos = [0, 0.22, 0.44, 0.70];
    var duraciones = [0.15, 0.15, 0.15, 0.55];
    for(var ii=0; ii<notas.length; ii++){
      (function(freq, t, dur){
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + t);
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + dur + 0.05);
      })(notas[ii], tiempos[ii], duraciones[ii]);
    }
  } catch(e){
    // Si AudioContext falla, vibración como fallback
    if(navigator.vibrate) navigator.vibrate([200,100,200,100,400]);
  }
}

// Prueba manual — llamar desde botón en Ajustes
function alarmaTest(){
  alarmaDesbloquear();
  alarmaSonar();
  toast('🔔 Prueba de alarma — ¿la escuchas?');
}

// Comprueba si hoy hay turno y si toca alarma
function alarmaCheck(){
  // 1. ¿Alarmas activadas?
  if(!AJ.alarmas || !AJ.alarmas.activas) return;

  var ahora = new Date();
  var hoy   = ahora.getFullYear()+'-'+pad(ahora.getMonth()+1)+'-'+pad(ahora.getDate());
  var nowM  = ahora.getHours()*60 + ahora.getMinutes();

  var t = TV[hoy];
  if(!t) return; // sin turno hoy

  // 2. ALARMA 1 — Fichar (5 min antes de hF)
  // Tipos elegibles: ordinario, trabajado, reserva
  if(AJ.alarmas.fichar){
    var tiposF = ['ordinario','trabajado','reserva'];
    var elegible = false;
    for(var ii=0; ii<tiposF.length; ii++){
      if(t.tipo===tiposF[ii]){ elegible=true; break; }
    }
    if(elegible && t.hF){
      var minF = alarmaToMin(t.hF);
      if(minF >= 0){
        var diff = minF - nowM;
        // Ventana: entre 6 y 4 minutos antes (30s de margen por el intervalo)
        if(diff>=3 && diff<=7){   // ventana 5 min ±2
          var idF = hoy+'-fichar';
          alarmaNotificar(
            '⏰ Fichar en '+t.hF,
            'Turno '+(t.tipo)+' · Firma en 5 minutos',
            idF
          );
        }
      }
    }
  }

  // 3. ALARMA 2 — Salida fuera de base (45 min antes de hF si es fuera de base)
  // "Fuera de base" = estación de salida ≠ base del usuario
  if(AJ.alarmas.salida){
    var tiposS = ['ordinario','trabajado'];
    var elegibleS = false;
    for(var jj=0; jj<tiposS.length; jj++){
      if(t.tipo===tiposS[jj]){ elegibleS=true; break; }
    }
    if(elegibleS && t.hF && t.sal){
      var fueraDeBase = AJ.base && t.sal !== AJ.base;
      if(fueraDeBase){
        var minS = alarmaToMin(t.hF);
        if(minS >= 0){
          var diffS = minS - nowM;
          // Ventana: entre 46 y 44 minutos antes
          if(diffS>=43 && diffS<=47){ // ventana 45 min ±2
            var idS = hoy+'-salida';
            alarmaNotificar(
              '🚆 Salir hacia '+t.sal+' ('+t.hF+')',
              'Estás fuera de base — tienes 45 min para llegar al tren',
              idS
            );
          }
        }
      }
    }
  }
}

// Reinicia las alarmas disparadas a medianoche
function alarmaResetDiario(){
  var ahora = new Date();
  if(ahora.getHours()===0 && ahora.getMinutes()<1){
    _alarmasDisparadas = {};
  }
}

// Arrancar el servicio de alarmas
function alarmaIniciar(){
  if(_alarmaInterval) clearInterval(_alarmaInterval);
  _alarmaInterval = setInterval(function(){
    alarmaCheck();
    alarmaResetDiario();
  }, 30000); // cada 30 segundos
  alarmaCheck(); // comprobación inmediata al activar
}

// Detener el servicio
function alarmaDetener(){
  if(_alarmaInterval){
    clearInterval(_alarmaInterval);
    _alarmaInterval = null;
  }
}

// Toggle desde Ajustes
function toggleAlarmas(activo){
  var card = document.getElementById('alarm-sw');
  var body = card ? card.closest('.aj-card-body') : null;
  if(body){
    if(activo) body.classList.add('alarm-sw-active');
    else        body.classList.remove('alarm-sw-active');
  }
  if(!AJ.alarmas) AJ.alarmas = {activas:false, fichar:true, salida:true};
  AJ.alarmas.activas = activo;
  localStorage.setItem('aj5', JSON.stringify(AJ));
  if(activo){
    alarmaIniciar();
    // Pedir permiso de notificaciones
    if(window.Notification && Notification.permission==='default'){
      Notification.requestPermission();
    }
    toast('🔔 Alarmas activadas');
  } else {
    alarmaDetener();
    toast('🔕 Alarmas desactivadas');
  }
  // Actualizar UI del toggle
  var sw = document.getElementById('alarm-sw');
  if(sw) sw.checked = activo;
  var lbl = document.getElementById('alarm-lbl');
  if(lbl) lbl.textContent = activo ? 'Activadas' : 'Desactivadas';
  var lbl2 = document.getElementById('alarm-lbl');
  if(lbl) lbl.style.color = activo ? 'var(--green2)' : 'var(--tx3)';
}

function toggleAlarmFichar(v){
  if(!AJ.alarmas) AJ.alarmas={activas:false,fichar:true,salida:true};
  AJ.alarmas.fichar=v;
  localStorage.setItem('aj5',JSON.stringify(AJ));
}

function toggleAlarmSalida(v){
  if(!AJ.alarmas) AJ.alarmas={activas:false,fichar:true,salida:true};
  AJ.alarmas.salida=v;
  localStorage.setItem('aj5',JSON.stringify(AJ));
}   // id único de la alarma activa

// Mostrar el botón flotante "Detener alarma"
function alarmaP_mostrarBoton(titulo){
  var btn = document.getElementById('alarma-stop-btn');
  if(!btn) return;
  var lbl = document.getElementById('alarma-stop-lbl');
  if(lbl) lbl.textContent = titulo || '🔔 Alarma activa — Toca para detener';
  btn.style.display = 'flex';
  // Animación de entrada
  btn.style.opacity = '0';
  btn.style.transform = 'translateY(30px)';
  setTimeout(function(){
    btn.style.opacity = '1';
    btn.style.transform = 'translateY(0)';
  }, 30);
  // Sincronizar botón de parada en la cabecera (aditivo)
  var hbtn = document.getElementById('hbtn-stop-alarma');
  if(hbtn) hbtn.style.display = 'flex';
}

// Ocultar el botón flotante
function alarmaP_ocultarBoton(){
  var btn = document.getElementById('alarma-stop-btn');
  if(!btn) return;
  btn.style.opacity = '0';
  btn.style.transform = 'translateY(30px)';
  setTimeout(function(){ btn.style.display = 'none'; }, 300);
  // Ocultar también el botón de la cabecera (aditivo)
  var hbtn = document.getElementById('hbtn-stop-alarma');
  if(hbtn) hbtn.style.display = 'none';
}

// Detener la alarma persistente (llamado desde botón o auto)
function alarmaDetenerPersistente(){
  if(_alarmaPersLoop)  { clearInterval(_alarmaPersLoop);  _alarmaPersLoop = null; }
  if(_alarmaPersVib)   { clearInterval(_alarmaPersVib);   _alarmaPersVib  = null; }
  _alarmaPersTicker = 0;
  _alarmaActivaId   = null;
  // Detener vibración inmediatamente
  if(navigator.vibrate) navigator.vibrate(0);
  alarmaP_ocultarBoton();
}

// Activar alarma persistente — loop de 30 s
// Diseñado para ser llamado DESPUÉS de alarmaNotificar (hook aditivo)
function alarmaActivarPersistente(titulo, idUnico){
  // Si ya hay una alarma activa con el mismo id, no duplicar
  if(_alarmaActivaId === idUnico) return;

  // Detener cualquier alarma persistente previa
  alarmaDetenerPersistente();
  _alarmaActivaId = idUnico;

  // Mostrar botón Detener
  alarmaP_mostrarBoton(titulo);

  // Loop de vibración — patrón de 2 s repetido
  if(navigator.vibrate){
    navigator.vibrate([400,200,400,200,400]);
    _alarmaPersVib = setInterval(function(){
      if(navigator.vibrate) navigator.vibrate([400,200,400,200,400]);
    }, 3000);
  }

  // Loop de sonido — cada 4 s durante 30 s máximo
  var ciclos = 0;
  var maxCiclos = 7; // 7 × 4s ≈ 30 s
  _alarmaPersLoop = setInterval(function(){
    ciclos++;
    // Llamar alarmaSonar() existente — no se reescribe
    try { alarmaSonar(); } catch(e){}
    if(ciclos >= maxCiclos){
      alarmaDetenerPersistente();
    }
  }, 4000);
}

// Función alias para el botón HTML (más corta)
function detenerAlarma(){
  alarmaDetenerPersistente();
  toast('✅ Alarma detenida');
}
