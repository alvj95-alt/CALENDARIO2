/* TrenTurnos v5 — Consentimiento de cookies y carga de anuncios
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════════════════════════
   NUEVO — Consentimiento de cookies (Google AdSense / Adsterra).
   100% aditivo — no toca ningún dato de TV/AJ/turnos.
═══════════════════════════════════════════════════════════ */
function mostrarAvisoCookiesSiHaceFalta(){
  var decision = localStorage.getItem('cookie_consent');
  if(decision === 'aceptado'){ cargarAnunciosSiConsentido(); return; }
  if(decision === 'rechazado') return; // ya decidió que no, no se le vuelve a preguntar
  var banner = document.getElementById('cookie-banner');
  if(banner) banner.style.display = 'block';
}
function aceptarCookies(){
  localStorage.setItem('cookie_consent', 'aceptado');
  document.getElementById('cookie-banner').style.display = 'none';
  cargarAnunciosSiConsentido();
}
function rechazarCookies(){
  localStorage.setItem('cookie_consent', 'rechazado');
  document.getElementById('cookie-banner').style.display = 'none';
}

function cargarAnunciosSiConsentido(){
  if(PUBLICIDAD_OCULTA_TEMPORALMENTE) return;
  // QUITADO — Confirmado por Alex: el Native Banner (id 30856817) se
  // eliminó por completo. Estaba mostrando anuncios para adultos que
  // Adsterra no filtró correctamente pese a tener el interruptor de
  // "anuncios para adultos" en apagado — no era algo controlable
  // desde este lado, así que se sacó del todo en vez de arriesgarse
  // a que volviera a pasar.
  // ADSTERRA — Banner 468x60 (id 30856819). Este formato usa
  // "document.write" por dentro para dibujarse — si se ejecutara
  // directamente en la página principal DESPUÉS de que ya haya
  // cargado (que es justo este caso, se activa al aceptar cookies),
  // "document.write" borraría sin querer toda la app. Por eso se
  // mete dentro de un iframe propio, chiquito y sin bordes: dentro de
  // ESE iframe sí es seguro usar document.write (tiene su propio
  // documento en blanco), y nada de lo que haga puede tocar el resto
  // de la página.
  var huecoBanner = document.getElementById('hueco-banner-468x60');
  if(huecoBanner && !document.getElementById('adsterra-banner-468x60')){
    var iframeBanner = document.createElement('iframe');
    iframeBanner.id = 'adsterra-banner-468x60';
    iframeBanner.style.cssText = 'width:468px;height:60px;border:none;overflow:hidden';
    iframeBanner.scrolling = 'no';
    huecoBanner.appendChild(iframeBanner);
    var docBanner = iframeBanner.contentWindow.document;
    docBanner.open();
    docBanner.write(
      '<body style="margin:0;padding:0">' +
      '<script>atOptions={key:"8f85bd49ca05e6f56f1b0ed1672b232f",format:"iframe",height:60,width:468,params:{}};<\/script>' +
      '<script src="https://www.highrevenueformat.com/8f85bd49ca05e6f56f1b0ed1672b232f/invoke.js"><\/script>' +
      '</body>'
    );
    docBanner.close();
  }
  // QUITADO de aquí (carga global) — Confirmado por Alex: el Social
  // Bar (id 30856818) ahora solo se carga cuando entra en Ajustes
  // (ver cargarSocialBarSiConsentido()/quitarSocialBar() más abajo,
  // enganchados a goP()), no en toda la app como antes.
}
function cargarSocialBarSiConsentido(){
  if(PUBLICIDAD_OCULTA_TEMPORALMENTE) return;
  var decision = localStorage.getItem('cookie_consent');
  if(decision !== 'aceptado') return; // respeta el aviso de cookies igual que el resto de anuncios
  if(document.getElementById('adsterra-social-bar')) return; // ya está cargado, no se duplica
  _socialBarHijosPrevios = Array.prototype.slice.call(document.body.children);
  var s2 = document.createElement('script');
  s2.id = 'adsterra-social-bar';
  s2.src = 'https://pl30957317.effectivecpmnetwork.com/30/94/fc/3094fc270290b91a58eca9cd46919b21.js';
  document.body.appendChild(s2);
}
function quitarSocialBar(){
  var script = document.getElementById('adsterra-social-bar');
  if(script) script.remove();
  if(_socialBarHijosPrevios){
    Array.prototype.slice.call(document.body.children).forEach(function(el){
      if(_socialBarHijosPrevios.indexOf(el) === -1) el.remove();
    });
    _socialBarHijosPrevios = null;
  }
}
