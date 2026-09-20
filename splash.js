/* TrenTurnos v5 — Pantalla de carga animada (tren)
   Separado del HTML único original SIN cambiar la lógica.
   El orden de carga está en index.html (importa: no lo alteres). */
// ACTUALIZADO — se elimina la persistencia diaria (localStorage +
// comparación de fechas). El splash se ejecuta SIEMPRE que la página
// se cargue o se refresque. No se toca la animación CSS (@keyframes)
// ni la estructura HTML del contenedor — solo cambia este disparador.
(function(){
  var splash = document.getElementById('splash-screen');
  if(!splash) return;

  // Duración total del efecto: 2.5s máximo, luego fundido de salida
  // y eliminación completa del DOM, para que el usuario pueda
  // interactuar con la interfaz sin ningún bloqueo posterior.
  setTimeout(function(){
    // FIX — antes el Portal de Perfil decidía si aparecer usando SU
    // PROPIO cronómetro independiente (un setTimeout calculado a
    // ojo). Al ser dos temporizadores distintos, cualquier pequeño
    // desajuste dejaba un hueco en el que se veía el calendario de
    // tripulación por debajo, justo cuando el tren empezaba a
    // desvanecerse. Ahora se avisa al portal EN ESTE MISMO INSTANTE
    // — el momento exacto en que el tren empieza a desvanecerse — en
    // vez de que cada uno calcule el tiempo por su cuenta. Así es
    // imposible que se descoordinen.
    if(typeof window.__revisarPerfilAlTerminarSplash === 'function'){
      window.__revisarPerfilAlTerminarSplash();
    }
    splash.style.transition = 'opacity .4s ease';
    splash.style.opacity = '0';
    setTimeout(function(){ splash.remove(); }, 420);
  }, 2500);
})();
