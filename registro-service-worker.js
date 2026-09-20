/* TrenTurnos v5 — Registro del service worker (PWA / uso sin conexión)
   Separado del HTML único original SIN cambiar la lógica.
   El orden de carga está en index.html (importa: no lo alteres). */
  // Registro del service worker — si sw.js no existe todavía en el
  // servidor, esto simplemente falla en silencio (try/catch) y la
  // app sigue funcionando exactamente igual que antes, sin PWA
  // completa pero sin romper nada.
  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').catch(function(err){
        console.log('Service worker no disponible todavía (sube sw.js a la misma carpeta):', err);
      });
    });
  }
