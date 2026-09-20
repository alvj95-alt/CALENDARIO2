/* TrenTurnos v5 — Constantes, tarifas, ajustes (AJ), turnos (TV) y estado global
   Separado del HTML único original SIN cambiar la lógica.
   Sentencias ejecutables en su orden original. Va DESPUÉS de todos los archivos de funciones.
   El orden de carga está en index.html (importa: no lo alteres). */
/* ═══════════════════════════════════════
   DATOS CONSTANTES
═══════════════════════════════════════ */
const LINEAS={
  'AVE':[
    'Madrid Puerta de Atocha','Madrid Chamartín',
    'Zaragoza-Delicias','Barcelona Sants','Lleida-Pirineus',
    'Camp de Tarragona','Tarragona','Girona','Figueres-Vilafant',
    'Sevilla Santa Justa','Córdoba Central','Málaga María Zambrano',
    'Antequera-Santa Ana','Granada','Jaén',
    'Valencia Joaquín Sorolla','Alicante Terminal',
    'Toledo','Puertollano','Ciudad Real',
    'Cuenca F.Zóbel','Albacete-Los Llanos',
    'Guadalajara-Yebes','Segovia-Guiomar',
    'Valladolid Campo Grande','Palencia','Burgos Rosa de Lima',
    'León','Ourense','Pontevedra','Vigo-Urzáiz',
    'Huesca','Logroño',
    'Vitoria-Gasteiz','San Sebastián/Donostia',
    'Murcia del Carmen','Elche','Orihuela',
    'Almería','Huelva',
    'Cádiz','Jerez de la Frontera','El Puerto de Santa María',
    'Requena-Utiel','Castelló de la Plana',
    'Calatayud','Teruel'
  ],
  'Renfe Larga Distancia':[
    'Madrid Puerta de Atocha','Madrid Chamartín',
    'Barcelona Sants','Valencia Nord','Valencia Estació del Nord',
    'Alicante Terminal','Murcia del Carmen','Cartagena',
    'Vigo-Urzáiz','Pontevedra','Ourense',
    'Santiago de Compostela','A Coruña','Ferrol',
    'Oviedo','Gijón','Avilés','Santander',
    'León','Palencia',
    'Valladolid Campo Grande','Burgos Rosa de Lima',
    'Bilbao Abando','San Sebastián/Donostia',
    'Vitoria-Gasteiz','Pamplona/Iruña','Logroño',
    'Salamanca','Zamora','Ávila',
    'Cáceres','Badajoz','Mérida','Plasencia',
    'Huelva','Cádiz','Jerez de la Frontera',
    'El Puerto de Santa María',
    'Almería','Granada','Jaén',
    'Zaragoza-Delicias','Tarragona','Calatayud','Teruel',
    'Castelló de la Plana',
    'Córdoba Central','Sevilla Santa Justa',
    'Málaga María Zambrano','Antequera-Santa Ana',
    'Toledo','Cuenca F.Zóbel','Albacete-Los Llanos'
  ],
  'AVE Avant (Media Distancia)':[
    'Madrid Puerta de Atocha',
    'Segovia-Guiomar','Valladolid Campo Grande',
    'Toledo','Cuenca F.Zóbel',
    'Ciudad Real','Puertollano',
    'Córdoba Central','Antequera-Santa Ana',
    'Camp de Tarragona','Lleida-Pirineus',
    'Guadalajara-Yebes',
    'Alicante Terminal','Murcia del Carmen',
    'Granada','Jaén'
  ],
  'Euromed':[
    'Barcelona Sants',
    'Girona','Figueres-Vilafant',
    'Camp de Tarragona','Tarragona','Vandellós',
    'Cambrils','Salou','Reus','Tortosa',
    'Vinaròs','Benicarló-Peñíscola','Oropesa del Mar',
    'Castelló de la Plana','Sagunt',
    'Valencia Joaquín Sorolla','Valencia Nord',
    'Xàtiva','Gandia','Alicante Terminal'
  ],
  'Alvia / Intercity':[
    'Madrid Puerta de Atocha','Madrid Chamartín',
    'Valladolid Campo Grande','Palencia',
    'Burgos Rosa de Lima','Vitoria-Gasteiz',
    'San Sebastián/Donostia','Bilbao Abando',
    'Santander','Oviedo','Gijón','Avilés',
    'A Coruña','Santiago de Compostela',
    'Vigo-Urzáiz','Pontevedra','Ourense',
    'Lugo','Ferrol','León',
    'Salamanca','Zamora','Ávila','Segovia-Guiomar',
    'Cáceres','Badajoz','Mérida','Plasencia',
    'Huelva','Cádiz','Jerez de la Frontera',
    'Almería','Granada','Jaén',
    'Logroño','Pamplona/Iruña',
    'Zaragoza-Delicias','Huesca','Calatayud','Teruel',
    'Castelló de la Plana','Tarragona'
  ],
  'Internacional (Lyon/Marsella)':[
    'Madrid Puerta de Atocha','Barcelona Sants',
    'Figueres-Vilafant','Girona',
    'Perpignan','Narbonne','Montpellier St-Roch',
    'Lyon Part-Dieu','Aviñón TGV','Marsella St-Charles',
    'León'
  ],
};
const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_C=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS_L=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
const TIPO_INFO={
  ordinario:        {ico:'🚂',lbl:'Ordinario',    col:'var(--c-ord)',cls:'dc-ord'},
  reserva:          {ico:'⏳',lbl:'Reserva',      col:'var(--c-res)',cls:'dc-res'},
  descanso:         {ico:'🧘',lbl:'Descanso',     col:'var(--c-des)',cls:'dc-des'},
  baja:             {ico:'🏥',lbl:'Baja',         col:'var(--c-baj)',cls:'dc-baj'},
  trabajado:        {ico:'💼',lbl:'Trabajado',    col:'var(--c-tra)',cls:'dc-tra'},
  comp:             {ico:'📅',lbl:'Comp.',        col:'var(--c-cmp)',cls:'dc-cmp'},
  'vuelta-pernocta':{ico:'🌙',lbl:'Vuelta',       col:'var(--c-ord)',cls:'dc-res'},
  'pernocta3-intermedio':{ico:'🌙',lbl:'Pernocta (día 2/3)', col:'var(--c-ord)',cls:'dc-res'},
  vacaciones:       {ico:'✈',lbl:'Vacaciones',   col:'var(--c-vac)',cls:'dc-vac'},
  dop:              {ico:'⭐',lbl:'DOP',          col:'var(--c-dop)',cls:'dc-dop'},
};
// NUEVO — Registro aditivo del tipo 'art5152' (Artículo 51 y 52).
// No se edita el objeto TIPO_INFO original de arriba; se añade como
// propiedad nueva justo después de su declaración.
TIPO_INFO.art5152 = {ico:'⚖️', lbl:'Art. 51/52', col:'var(--acc3)', cls:'dc-art5152'};
// ── PLUSES: Activación, Internacional, JT — fijos por viaje ──
// FIX — Confirmado por el usuario: estos tres pluses son el MISMO
// importe para los tres roles (no varían por categoría), verificado
// contra el convenio: Plus Activación = Art. 53 (PTVP), 44,31 € "para
// toda la vigencia del convenio y para los trabajadores afectados por
// el mismo" — coincide exacto y confirma que NO depende del rol.
const PLUS_DEF={
  tripulante:{activacion:44.31,internacional:16.00,jt:16.73},
  auxiliar:  {activacion:44.31,internacional:16.00,jt:16.73},
  jefe:      {activacion:44.31,internacional:16.00,jt:16.73},
};
const PLUS_LABELS={activacion:'Plus Activación',internacional:'Plus Internacional',jt:'Plus JT'};

/* ═══════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════ */
var _emailCB = null; // callback email — declarado globalmente para evitar implicit global
/* ═══════════════════════════════════════════════════════════
   NUEVO — Tarifas por defecto según rol (Tripulante/Auxiliar/Jefe).
   Declarada ANTES de inicializar AJ para poder aplicarla también en
   la primera carga (ver más abajo), no solo al pulsar el botón de
   rol. El usuario puede seguir modificando estos valores a mano
   después sin ninguna restricción.
   AMPLIADO — Confirmado por Alex, para la Nómina Estimada: se añaden
   horaExtra/presencia/rebase/plusTrasl (antes solo estaban vh/
   nocturnidad/art5152Monto, que ya se usaban en otras partes de la
   app). Se añade el rol 'jefe' — según el cartel de tarifas de UGT
   2026, Jefe de Tripulación tiene EXACTAMENTE las mismas tarifas por
   hora que Tripulante — solo cambian los conceptos fijos (salario
   base, pagas extras), ver CONCEPTOS_FIJOS_ROL más abajo.
═══════════════════════════════════════════════════════════ */
var TARIFAS_ROL = {
  tripulante: { vh:19.77, nocturnidad:2.62, art5152Monto:29.65, horaExtra:21.39, presencia:11.49, rebase:11.49, plusTrasl:1.00 },
  auxiliar:   { vh:14.82, nocturnidad:1.97, art5152Monto:22.23, horaExtra:16.06, presencia:8.60,  rebase:8.60,  plusTrasl:1.00 },
  jefe:       { vh:19.77, nocturnidad:2.62, art5152Monto:29.65, horaExtra:21.39, presencia:11.49, rebase:11.49, plusTrasl:1.00 }
};
// NUEVO — Conceptos fijos de la Nómina Estimada (cartel UGT 2026).
// Plus Transporte y Plus Manutención son IGUALES para los 3 roles;
// Salario Base y Paga de Marzo sí cambian según el rol. Las Pagas de
// Verano/Otoño/Navidad usan el mismo importe que el Salario Base
// (confirmado por Alex) y solo se aplican en su mes correspondiente
// (jul/sep/dic) — ver calcularNominaEstimadaExcel().
var CONCEPTOS_FIJOS_ROL = {
  tripulante: { salarioBase:1614.15, pagaMarzo:1070.96, plusTransporte:123.62, plusManutencion:158.26 },
  auxiliar:   { salarioBase:1212.77, pagaMarzo:995.26,  plusTransporte:123.62, plusManutencion:158.26 },
  jefe:       { salarioBase:1958.42, pagaMarzo:1135.91, plusTransporte:123.62, plusManutencion:158.26 }
};


var AJ=Object.assign({
  nombre:'',matricula:'',rol:'tripulante',vh:12.5,nocturnidad:1.80,base:null,sedeBase:'',
  // FIX — art5152Monto/art5152ValorBase no tenían valor por defecto
  // (a diferencia de 'vh', que sí lo tiene: 12.5). Sin este valor
  // inicial, si el usuario nunca entraba a Ajustes → Art.51/52 y
  // guardaba explícitamente, AJ.art5152Monto quedaba 'undefined' y
  // TODOS los cálculos de Art.51/52 daban 0.00 € silenciosamente
  // (el parseFloat(...)||0 evitaba el error, pero el resultado
  // visible era dinero incorrecto). Mismo valor por defecto que 'vh'
  // para mantener coherencia; se sobreescribe en cuanto el usuario
  // guarda su propio monto en Ajustes.
  art5152Monto:12.5, art5152ValorBase:0,
  pluses:{tripulante:Object.assign({},PLUS_DEF.tripulante),auxiliar:Object.assign({},PLUS_DEF.auxiliar)},
  alarmas:{activas:false,fichar:true,salida:true}
},_leerJSONseguro('aj5', {}));

// NUEVO — Autoaplica la tarifa del rol SOLO en un perfil que nunca
// se ha guardado (el JSON crudo de localStorage no tenía el campo
// 'rol' en absoluto). Así un usuario nuevo ve la tarifa correcta
// desde el primer momento, sin tocar nada — pero si ya habías
// guardado Ajustes antes (aunque solo fuera una vez), tus valores
// personalizados NUNCA se tocan ni se sobreescriben aquí.
(function(){
  var crudo = _leerJSONseguro('aj5', {});
  if(crudo && typeof crudo.rol !== 'undefined') return; // ya configurado antes: no tocar nada
  var t = TARIFAS_ROL[AJ.rol];
  if(t){
    AJ.vh = t.vh;
    AJ.nocturnidad = t.nocturnidad;
    AJ.art5152Monto = t.art5152Monto;
  }
})();

// FIX — Confirmado por el usuario: Plus Activación/Internacional/JT
// deben valer lo MISMO en los tres roles (verificado contra el
// convenio — Activación coincide exacto con el Art. 53, PTVP: 44,31€
// "para toda la vigencia del convenio y para los trabajadores
// afectados por el mismo", que ya de por sí confirma que NO depende
// del rol). Como AJ.pluses.tripulante/auxiliar ya venían GUARDADOS en
// localStorage con los valores viejos (distintos por rol) desde la
// primera vez que se abrió la app, cambiar solo PLUS_DEF no bastaba
// — el valor guardado seguía mandando. Aquí se migran los importes
// SOLO si siguen siendo exactamente los valores viejos por defecto
// (si el usuario los cambió a mano alguna vez, nunca se tocan).
(function(){
  var VIEJOS = {
    tripulante:{activacion:3.20,internacional:4.50,jt:2.80},
    auxiliar:  {activacion:2.60,internacional:3.80,jt:2.20},
  };
  var tocado = false;
  ['tripulante','auxiliar'].forEach(function(rol){
    var p = AJ.pluses[rol], v = VIEJOS[rol];
    if(p && p.activacion===v.activacion && p.internacional===v.internacional && p.jt===v.jt){
      AJ.pluses[rol] = Object.assign({}, PLUS_DEF[rol]);
      tocado = true;
    }
  });
  if(tocado){
    try{ localStorage.setItem('aj5', JSON.stringify(AJ)); }catch(e){}
  }
})();

var TV=_leerJSONseguro('tv5', {});
var curM=new Date(), selDay=null, statsM=new Date();
// FIX — Confirmado por Alex (bug propio, detectado en pruebas):
// perfilAdminActual se declaraba mucho más abajo en el archivo. Mi
// nueva sección "Conceptos Fijos" la usa dentro de renderStats(), que
// se llama durante la carga inicial de la app — si eso pasaba antes
// de llegar a la declaración original, toda la carga se rompía con un
// error de "variable no inicializada". Se adelanta aquí, junto a las
// demás variables globales tempranas — sigue siendo el mismo null
// inicial de siempre, no cambia ningún comportamiento.
let perfilAdminActual = null; // {id, email, rol}

// NUEVO — Cómputo Excel: persistente en localStorage, indexado por mes
// ('YYYY-MM'). FIX: esto tiene que declararse AQUÍ, antes de init(),
// porque renderComparativaComputoExcel() se llama desde dentro de
// renderStats(), y esa ya se ejecuta en el primer render automático al
// cargar la página (dentro de init()). Si esta variable se declaraba
// más abajo en el archivo (después de la llamada a init()), en ese
// primerísimo render aún valía undefined pese al hoisting de "var" (el
// hoisting sube el nombre, no el valor) — y renderComparativaComputoExcel()
// petaba con "Cannot read properties of undefined (reading '2026-07')"
// al intentar leer _computoExcelPorMes[claveMes] sobre undefined.
var COMPUTO_EXCEL_KEY = 'computoExcelPorMes';
var _computoExcelPorMes = (function(){
  try{ return JSON.parse(localStorage.getItem(COMPUTO_EXCEL_KEY) || '{}'); }
  catch(e){ return {}; }
})();

// NUEVO — Filtro por categoría + exportación de "Días con diferencias".
// comparable:true = la app SÍ calcula esto, así que puede haber una
// diferencia real Excel-vs-App. comparable:false = categoría que solo
// existe en el Excel (Rebase, Traslados...): no hay "diferencia" posible,
// se listan los días en los que el Excel tiene algo en esa columna.
var COMPUTO_EXCEL_CATEGORIAS = [
  {id:'todas',      lbl:'Todas las diferencias'},
  {id:'HE',         lbl:'Horas Efectivas',    comparable:true},
  {id:'HP',         lbl:'Horas Presencia',    comparable:true},
  {id:'Noct',       lbl:'Nocturnidad',        comparable:true},
  {id:'HTDL',       lbl:'HTDL',               comparable:true},
  {id:'JT',         lbl:'Plus JT',            comparable:true, esConteo:true},
  {id:'Rebase',     lbl:'Rebase (solo Excel)',           comparable:false},
  {id:'Trasl',      lbl:'Traslados (solo Excel)',        comparable:false},
  {id:'PlusTrasl',  lbl:'Plus Traslado (solo Excel)',     comparable:false},
  {id:'TpTrans',    lbl:'Tiempo Transporte (solo Excel)', comparable:false, esNumero:true},
  {id:'PlusInter',  lbl:'Plus Interrupción (solo Excel)', comparable:false, esNumero:true}
];
var _computoExcelFiltro = 'todas';
var _computoExcelDatosActual = null; // {discrepancias, porDia, y, m, mesLbl} del último render

// ── Estado del formulario ──
// REGLA: hF/hL/sal/lle = tramo IDA (día seleccionado)
//        hF2/hL2/sal2/lle2 = tramo VUELTA
var F={};
var estField=null;
var miniM=null, diasComp=[];

// ── TimePicker state — teclado numérico ──
// field: campo de F que se está editando
// H/M: hora/minuto actual (strings "HH"/"MM")
// foco: 'h' | 'm' — qué segmento se edita
// buf: dígitos acumulados antes de confirmar
var TP={field:null, H:'08', M:'00', foco:'h', buf:''};

// ── Módulos declarados aquí para garantizar disponibilidad antes de init() ──
// C-01 FIX: SF, AGENDA y ALERTAS deben estar en el bloque global,
// no dentro de las funciones de cada módulo (evita ReferenceError)
var SF              = _leerJSONseguro('sf5', []);
var AGENDA          = _leerJSONseguro('agenda5', []);
var ALERTAS_DESCANSO = {};

// ── Sistema Horario Compañero ─────────────────────────────────
var COMP_DATA  = _leerJSONseguro('comp5', {});
var vistaMode  = 'mio';

// ── NUEVO — Módulo Artículo 51 y 52 (100% aditivo, claves propias) ──
// ART5152_DIAS: bolsa de días de descanso generados, indexada por el
//   mes DESTINO ('YYYY-MM') al que se suman (el mes siguiente al del registro).
// ART5152_USO: nº de veces que se ha usado el artículo, indexado por el
//   mes de ORIGEN ('YYYY-MM') del turno — para la validación de una vez al mes.
// ART5152_USO_ANUAL: NUEVO — nº de veces en el AÑO de origen ('YYYY'),
//   para la validación de un máximo de 3 veces al año. Universal para
//   pernocta e ida-vuelta desde el primer momento (mismo criterio que
//   el mensual: solo cuenta Dinero/Días, nunca Mix ni HTDL).
var ART5152_DIAS = _leerJSONseguro('art5152_dias', {});
var ART5152_USO  = _leerJSONseguro('art5152_uso', {});
var ART5152_USO_ANUAL = _leerJSONseguro('art5152_uso_anual', {});

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
var NOV_VERSION = 'nov_v8';
// FIX — Confirmado por Alex: antes esta fecha se calculaba con
// new Date() en el momento en que la persona ABRÍA el popup, así que
// mostraba "hoy" en vez de la fecha real en que se publicó esta
// actualización — si alguien la veía por primera vez varios días
// después de subirla, salía una fecha equivocada. Ahora es un texto
// fijo, ligado a esta versión — se actualiza a mano cada vez que se
// suba una nueva tanda de novedades (junto con NOV_VERSION y
// listaNovedades, ver instrucciones más abajo).
var NOV_FECHA = '17/8/2026';

var listaNovedades = [
  {
    ico: '📥',
    titulo: 'Carga automática de horario',
    desc: 'Sube el PDF de tu horario individual y pulsa «Cargar en calendario» — reconoce pernoctas, escalas entre trenes y tramos DH sola, sin escribir nada a mano. También carga los días de reserva («R») y vacaciones («CP») del propio PDF.'
  },
  {
    ico: '📋',
    titulo: 'Copiar turno',
    desc: 'Copia cualquier turno ya guardado y pégalo en otro día, incluso de otro mes. Eliges si se guarda como Ordinario, Art.51/52 o HTDL, y cómo se compensa (dinero, días o mixto).'
  },
  {
    ico: '🔁',
    titulo: 'Cambiar tipo de turno',
    desc: '¿Un turno ya puesto que en realidad debería ser HTDL o Art.51/52 en vez de Ordinario? Cámbialo en el sitio, sin borrar ni volver a escribir nada.'
  },
  {
    ico: '📊',
    titulo: 'Auditoría de Horas más precisa',
    desc: 'El cálculo de Horas Efectivas y de Presencia ya tiene en cuenta las esperas entre trenes conectados y los enlaces de jornada — el resultado queda mucho más cerca del cómputo oficial.'
  },
  {
    ico: '🗺️',
    titulo: 'Diccionario de estaciones que aprende solo',
    desc: 'La app ya reconoce de fábrica las siglas de estación más habituales. Si aparece una que no conoce, te pregunta una sola vez y la recuerda para siempre — para ti y para el resto.'
  }
];

/* ═══════════════════════════════════════════════════════════
   NUEVO — TUTORIAL (acordeón por tema, confirmado con Alex tras
   varias rondas de maqueta). Cada tema es independiente; el tema
   marcado admin:true solo se añade a la lista si quien abre el
   tutorial tiene sesión de Admin (ver renderTutorial()).
═══════════════════════════════════════════════════════════ */
var TUTORIAL_TEMAS = [
  {
    ico: '🚆', titulo: 'Registrar un turno Ordinario',
    pasos: [
      'Toca el día en el Calendario donde quieres registrar el turno.',
      'Elige el tipo <b>Ordinario</b> en la pantalla que se abre.',
      'Rellena la estación de salida/llegada, las horas, y el número de tren.',
      'Pulsa <b>Guardar</b> — el día queda coloreado en el calendario con el icono del turno.'
    ]
  },
  {
    ico: '🌙', titulo: 'Registrar una pernocta (ida/vuelta)',
    pasos: [
      'Toca el día donde empieza la pernocta (el día de la ida).',
      'Elige el tipo de jornada, y cuando te pregunte el modo, elige <b>Pernocta</b>.',
      'Rellena los datos de la ida (salida, llegada, tren) y los de la vuelta.',
      'Al guardar, se crean automáticamente los dos días: la ida (día actual) y la vuelta (día siguiente), enlazados entre sí.'
    ]
  },
  {
    ico: '📆', titulo: 'Descanso, Reserva, Vacaciones y DOP',
    pasos: [
      'Toca el día y elige el tipo correspondiente: <b>Descanso</b>, <b>Reserva</b>, <b>Vacaciones</b>, o <b>DOP</b> (día de descanso opcional que solicitas tú).',
      'Estos cuatro tipos se guardan directos, sin pedir más datos — no hacen falta horas ni tren.',
      'La Reserva cuenta sola 8h de Presencia; el resto no suma horas ni dinero, solo marca el día.'
    ]
  },
  {
    ico: '📥', titulo: 'Cargar tu horario individual (PDF) al calendario',
    pasos: [
      'Ve a la pestaña <b>Horario</b> y sube el PDF de tu horario individual.',
      'Cuando termine de leerlo, pulsa <b>📅 Cargar en calendario</b>.',
      'Si hay alguna estación que la app no reconoce todavía, te la pregunta una vez y la recuerda para siempre.',
      'Revisa el resumen final — te dice cuántos días se cargaron, cuántos ya coincidían, y si hay alguno para revisar a mano.'
    ]
  },
  {
    ico: '📋', titulo: 'Copiar un turno a otro día',
    pasos: [
      'Abre el día que quieres copiar, y en el desplegable de opciones pulsa <b>Copiar turno</b>.',
      'Elige el día de destino en el mini-calendario (puede ser de otro mes).',
      'Elige cómo se guarda: <b>Ordinario</b>, <b>Art.51/52</b>, o <b>HTDL</b>.',
      'Si es HTDL o Art.51/52, elige la compensación: <b>Dinero</b>, <b>Días</b>, o <b>Mixto</b>.',
      'Si el día de destino ya tenía algo puesto, no se pierde — pasa a turno secundario, y sus horas se siguen contando igual.'
    ]
  },
  {
    ico: '🔁', titulo: 'Cambiar el tipo de un turno ya puesto',
    pasos: [
      'Abre el día y pulsa el botón <b>Cambio</b>.',
      'Elige la opción <b>🔁 Cambiar tipo de turno</b> (la otra opción es para solicitar un cambio con un compañero, es distinta).',
      'Elige el nuevo tipo (Ordinario, Art.51/52, o HTDL) y, si aplica, cómo se compensa.',
      'El turno se actualiza en el mismo día, sin borrar ni volver a escribir nada — si era una pernocta, se aplica a la ida y la vuelta juntas.'
    ]
  },
  {
    ico: '⏱️', titulo: 'Registrar un retraso',
    pasos: [
      'Abre el día afectado y pulsa <b>⏱ Registrar retraso</b>.',
      'Elige a qué tramo del turno afecta (ida, vuelta, o cualquiera de continuidad) y escribe los minutos.',
      'La app te avisa en el momento si ese retraso hace que tu descanso con el día siguiente quede por debajo del mínimo legal.',
      'El aviso de descanso insuficiente se queda guardado en el calendario mientras el retraso siga puesto, no solo mientras lo estás escribiendo.'
    ]
  },
  {
    ico: '👥', titulo: 'Buscar a un compañero (por nombre o tren)',
    pasos: [
      'Ve a la pestaña <b>Compañeros</b>.',
      'Escribe un nombre para buscarlo directamente en el Horario General publicado, o escribe un número de tren para ver quién más de tu base lo hace ese día.',
      'Puedes elegir el día con el mini-calendario antes de buscar por tren.',
      '(Si tienes acceso de Interventor, ahí la búsqueda es solo por tren, y los resultados muestran nombre y base, no matrícula.)'
    ]
  },
  {
    ico: '✅', titulo: 'Subir el Check-in del día',
    pasos: [
      'Con tu Estación Base configurada, verás la píldora <b>✅ Check-in</b> en la parte de arriba del Calendario.',
      'Tócala, y si nadie ha subido el check-in de hoy todavía, pulsa <b>📤 Subir PDF del check-in</b>.',
      'Revisa el vistazo antes de confirmar — puedes tocar cualquier dato para corregirlo si algo salió mal.',
      'Una vez confirmado, queda guardado y visible para toda tu base — puedes navegar a días anteriores con las flechitas ‹ › para consultarlos.'
    ]
  },
  {
    ico: '📊', titulo: 'Auditoría de Horas y desglose económico en Stats',
    pasos: [
      'Ve a la pestaña <b>Stats</b> y pulsa <b>🔍 Auditoría de Horas</b>.',
      'Ahí comparas tus Horas Efectivas y de Presencia (calculadas por la app) contra el PDF oficial del cómputo mensual.',
      'Más abajo tienes el desglose económico completo: HTDL, Art.51/52, nocturnidad, pluses, y el Total a Pagar del mes, sumado automáticamente.'
    ]
  },
  {
    ico: '⚙️', titulo: 'Configurar tu perfil y tarifas en Ajustes',
    pasos: [
      'Ve a la pestaña <b>Ajustes</b>.',
      'Rellena tu nombre, matrícula, y tu rol (esto autocompleta las tarifas de HTDL, nocturnidad y Art.51/52 según tu rol).',
      'Configura tu Estación Base — la necesitas para el Check-in del día y para varios cálculos de descanso.',
      'Puedes ajustar cualquier tarifa a mano si la tuya es distinta a la de tu rol.'
    ]
  },
  {
    ico: '☁️', titulo: 'Copia de seguridad en la nube', admin: true,
    pasos: [
      'Esta función es solo para el Administrador de la base.',
      'Desde el Panel de Administrador puedes subir el Horario General en PDF — se publica al instante para todo el mundo.',
      'También puedes gestionar accesos, ver quién ha entrado al Buscador de Compañeros, y administrar el Check-in y el Portal de Interventor.'
    ]
  },
  {
    ico: '🗑️', titulo: 'Borrar varios días a la vez (mantener pulsado)',
    pasos: [
      'Mantén pulsado un día del Calendario durante medio segundo — entra en modo selección, con ese día ya marcado.',
      'Toca los demás días que quieras borrar — cada uno se marca con un círculo naranja.',
      'Abajo aparece una barra con el número de días seleccionados: <b>Cancelar</b> para salir sin borrar nada, o <b>🗑 Eliminar</b> para confirmar.',
      'Se pide una confirmación final antes de borrar de verdad, con la lista de días afectados.'
    ]
  }
];

/* ═══════════════════════════════════════════════════════════
   NUEVO — NÓMINA ESTIMADA. Confirmada con Alex tras varias rondas de
   maqueta:
   - Pestaña "Desde el Excel": usa las horas ya guardadas del Cómputo
     Excel (_computoExcelPorMes, el mismo que ya usa la comparación
     de horas) para Presencia/Nocturnidad/Rebase/Plus Traslación.
     HTDL y Art.51/52 se ponen A MANO (el Excel los mezcla en la
     misma columna sin distinguirlos). Seg. Social, Cuota Sindical e
     IRPF también a mano (varían según cada persona).
   - Pestaña "Desde tu Calendario": reutiliza calculateEarnings(), el
     mismo cálculo que ya usa Stats → Total a Pagar.
   - Conceptos fijos: Salario Base, Plus Transporte, Plus Manutención
     según el rol (CONCEPTOS_FIJOS_ROL). Paga de Marzo prorrateada
     TODOS los meses; Pagas de Verano/Otoño/Navidad solo se aplican
     completas en julio/septiembre/diciembre (mismo importe que el
     Salario Base, confirmado por Alex).
   100% de solo lectura sobre TV/AJ — nunca escribe en ellos.
═══════════════════════════════════════════════════════════ */
var _nominaTabActiva = 'excel';
// FIX — Confirmado por Alex: estos valores (HTDL/Art.51/52 a mano,
// Seg. Social, Cuota Sindical, IRPF) nunca se guardaban de forma
// permanente — eran solo una variable en memoria, así que se
// perdían cada vez que se recargaba la página o se cerraba la app.
// Por eso la Cuota Sindical "aprendida" desde la Nómina Real volvía
// a cero después. Ahora se guardan en localStorage y se recuperan al
// abrir la Nómina Estimada.
var _nominaValoresManuales = (function(){
  try{
    var guardado = JSON.parse(localStorage.getItem('nomina_valores_manuales')||'null');
    if(guardado) return guardado;
  }catch(e){}
  return { htdlHoras:0, art5152Horas:0, ssPct:6.50, cuotaSindical:0, irpfPct:15 };
})();

// NUEVO — Confirmado por el usuario: aunque su jornada contratada
// siempre es del 100%, la empresa resta 5,5h de la referencia de
// 163h efectivas por cada día compensatorio (COMPE/LD) que pide por
// trabajar en su descanso — así que el % "efectivo" de cada mes varía
// solo por eso, no porque su contrato cambie. _nominaJornadaRefAjustada()
// ya contaba los días COMPE automáticamente desde el calendario (TV),
// pero solo para calcular la Hora Extraordinaria — nunca se usaba
// para los Conceptos Fijos (Salario Base, Paga de Marzo, Verano...).
// Además, si ese mes no se cargó día a día en el calendario (p.ej. se
// subió el Horario Individual en su lugar), el conteo automático da 0
// aunque sí hubiera días COMPE reales — para esos casos se guarda un
// valor MANUAL por mes, que manda por encima del conteo automático.
var _diasCompeManual = (function(){
  try{ return JSON.parse(localStorage.getItem('dias_compe_manual')||'{}'); }catch(e){ return {}; }
})();

/* ═══════════════════════════════════════════════════════════
   NUEVO — NÓMINA REAL (PDF). Confirmada con Alex: una tercera cara
   de la Nómina Estimada, leyendo el PDF real que manda Serveo cada
   mes. Reutiliza EXACTAMENTE el mismo patrón de lectura de PDF que
   ya usa el Horario (pdfjsLib + asegurarPdfWorkerSeguro + ordenar por
   Y/X) — nada nuevo en esa parte. Guardado por mes en localStorage
   (_nominaRealPorMes), igual que _computoExcelPorMes.
   NUNCA se usa para calcular nada — solo se MUESTRA como referencia,
   para comparar contra las otras dos caras.
═══════════════════════════════════════════════════════════ */
var _nominaRealPorMes = (function(){
  try{ return JSON.parse(localStorage.getItem('nomina_real_por_mes')||'{}'); }catch(e){ return {}; }
})();

// NUEVO — Confirmado por el usuario: cuando algo no coincide entre la
// App y la Nómina Real, el sistema busca automáticamente EN QUÉ
// concepto está la diferencia y explica el motivo más probable — no
// es una IA investigando en vivo, es un conjunto de reglas fijas
// basadas en los patrones ya comprobados con nóminas reales
// (regularización, HTDL Forzoso sin distinguir todavía, conceptos que
// la app no calcula). Si aparece un motivo nuevo que no está aquí, se
// explica de forma genérica en vez de intentar acertar la causa exacta.
var REAL_CONCEPTO_A_APP = [
  {re:/SALARIO BASE/i, appKey:'Salario Base'},
  {re:/PLUS TRANSPORTE/i, appKey:'Plus Transporte'},
  {re:/PLUS MANUTENCI/i, appKey:'Plus Manutención'},
  {re:/PAGA EXTRA MARZO/i, appKey:'Paga de Marzo (÷12)'},
  {re:/JT|COOR\.?\s*SUPLENTE/i, appKey:'Plus JT'},
  {re:/TRASLACI/i, appKey:'Plus Traslación'},
  {re:/NOCTURNIDAD/i, appKey:'Nocturnidad'},
  {re:/REBASE/i, appKey:'Hora Rebase'}
];

/* ═══════════════════════════════════════════════════════════
   NUEVO — NÓMINA (pública, botón propio de la barra inferior).
   Aprobada por Alex tras maqueta: reutiliza EXACTAMENTE los mismos
   cálculos ya existentes para la Nómina Estimada de Admin
   (_nominaConceptosFijos, calculateEarnings, calcImporteArt5152Vivo,
   _nominaValoresManuales) — nada se duplica ni se recalcula distinto.
   Diferencias a propósito frente a la de Admin:
   - Visible para todo el mundo, no solo Admin.
   - El CAPH NO sale por defecto — solo si AJ.tieneCAPH está activado
     desde Ajustes → Economía.
   - Muestra Art.51/52 como su propia fila (la Admin lo mezclaba
     dentro de "HTDL puro"); aquí van separados para que se entienda
     mejor de dónde sale cada euro.
═══════════════════════════════════════════════════════════ */
var nomM = null;

/* ═══════════════════════════════════════════════════════════
   NUEVO — CHATBOT DE AYUDA. Búsqueda por palabras clave sobre
   TUTORIAL_TEMAS (el mismo contenido del Tutorial, ver arriba) — sin
   IA, sin coste. Si no hay ninguna coincidencia razonable, ofrece
   hablar directamente por WhatsApp con Alex.
═══════════════════════════════════════════════════════════ */
var WHATSAPP_SOPORTE = '66660753771'; // +66 660 753 771 (Alex)
// Palabras muy comunes que no ayudan a encontrar el tema — se
// ignoran al buscar, para que no distorsionen la puntuación.
var CHATBOT_PALABRAS_VACIAS = ['de','la','el','en','un','una','como','que','para','con','mi','se','a','y','o','los','las','del','al','es','no','me','tengo','puedo','quiero','hace','hacer','tiempo','manana','necesito','esta','este','hay','soy','muy','mas','pero','sobre'];


// NUEVO — Confirmado por Alex: búsqueda del chatbot sobre el
// Convenio. Las palabras que coinciden en el TÍTULO pesan más (x3)
// que las que solo aparecen en el cuerpo (x1) — necesario porque los
// artículos varían mucho de longitud (uno de 200 caracteres y otro de
// 8.000); sin este peso, un artículo muy largo ganaría solo por tener
// más palabras sueltas, no por ser realmente más relevante.
// NUEVO — caché de título/texto ya normalizados (sin acentos), para
// no tener que recalcularlo en cada búsqueda — con 131 artículos y
// textos largos, hacerlo de cero cada vez sería un desperdicio.
var _convenioNormCache = null;

// ── Verificar todos los turnos del mes visible ────────────────
// L-02 FIX: también compara el último turno del mes anterior
// con el primero del mes actual (cruce de límite de mes).
// OPTIMIZACIÓN: caché de memoización para verificarDescansosMes.
// Evita recorrer y comparar TODOS los pares de turnos en cada
// renderCal() si nada relevante cambió desde el último cálculo.
var _descansosCacheKey = null;
var _descansosCacheVal = null;

// ── Aviso normativo (Dinero/Días — una vez al mes). Mix y HTDL no lo disparan ──
var _a5152SaltarAvisoMensual = false;

var _correoMixOrigenActual = 'trabajado';
