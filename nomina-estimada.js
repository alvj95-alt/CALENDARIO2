/* TrenTurnos v5 — Nómina Estimada: conceptos fijos, devengo de pagas, apertura del panel
   Separado del HTML único original SIN cambiar la lógica.
   Contiene SOLO declaraciones de función (se cargan antes que el estado, igual que el hoisting del script original).
   El orden de carga está en index.html (importa: no lo alteres). */
function _guardarNominaValoresManuales(){
  try{ localStorage.setItem('nomina_valores_manuales', JSON.stringify(_nominaValoresManuales)); }catch(e){}
}

// NUEVO — Confirmado por Alex: si empiezas a trabajar a mitad de un
// periodo de devengo, esa paga se cobra proporcional (solo los meses
// que llevas trabajando dentro de ESE periodo, no el importe
// completo). "inicioPeriodo"/"finPeriodo" son fechas (Date); cuenta
// meses completos desde la más tardía entre tu punto de partida y el
// inicio del periodo, hasta el fin del periodo.
// FIX — Confirmado por Alex: si hubo una LIQUIDACIÓN, esa fecha
// manda por encima de la antigüedad para estas pagas — la
// liquidación ya "cerró cuentas" con lo devengado hasta ese momento,
// así que contar desde la antigüedad original pagaría dos veces por
// el mismo periodo. Si no hay liquidación puesta, se sigue usando la
// antigüedad de siempre, sin ningún cambio.
function _nominaFraccionDevengo(inicioPeriodo, finPeriodo){
  var fechaBase = AJ.liquidacion || AJ.antiguedad;
  var punto = fechaBase ? new Date(fechaBase+'T00:00:00') : null;
  var inicioReal = (punto && punto>inicioPeriodo) ? punto : inicioPeriodo;
  if(inicioReal > finPeriodo) return 0; // no habías empezado a trabajar en todo el periodo
  var totalMeses = (finPeriodo.getFullYear()-inicioPeriodo.getFullYear())*12 + (finPeriodo.getMonth()-inicioPeriodo.getMonth()) + 1;
  var mesesTrabajados = (finPeriodo.getFullYear()-inicioReal.getFullYear())*12 + (finPeriodo.getMonth()-inicioReal.getMonth()) + 1;
  return Math.max(0, Math.min(1, mesesTrabajados/totalMeses));
}
function _guardarDiasCompeManual(){
  try{ localStorage.setItem('dias_compe_manual', JSON.stringify(_diasCompeManual)); }catch(e){}
}

function _nominaConceptosFijos(rol, anio, mes){
  var c = CONCEPTOS_FIJOS_ROL[rol] || CONCEPTOS_FIJOS_ROL.tripulante;
  // CORREGIDO — el usuario detectó el error: la referencia ajustada
  // (163h − 5,5h × días COMPE) existe para GARANTIZAR el sueldo
  // completo del mes pese a haber trabajado menos horas por el día
  // compensatorio (y para que cualquier hora de más cuente antes como
  // Hora Extraordinaria) — NO para reducir el Salario Base ni las
  // demás pagas fijas. Usarla como "%" para multiplicar el Salario
  // Base hacía justo lo contrario de lo que debía. Se revierte: los
  // Conceptos Fijos vuelven a usar el % de jornada contratada real,
  // puesto en Ajustes → "% de jornada contratada" (100% si no se ha
  // tocado nada), sin que los días COMPE lo afecten en absoluto.
  var pct = (parseFloat(AJ.jornadaPct)||100) / 100;
  // FIX — Confirmado el bug (reportado por el usuario): la ventana de
  // la Paga de Marzo SIEMPRE apuntaba al marzo del mismo "anio" que se
  // está viendo, incluso cuando el mes visto es POSTERIOR a marzo. Eso
  // hacía que, para alguien que empezó a trabajar después de marzo (ej.
  // en agosto) y mira la nómina de agosto, la ventana comparada fuera
  // "abril del año pasado → marzo de ESTE año" — un periodo que ya
  // terminó ANTES de que la persona empezara, dando siempre 0,00 €.
  // Ahora, si el mes que se ve es posterior a marzo, la Paga de Marzo
  // relevante es la del AÑO QUE VIENE (la próxima a cobrarse), así que
  // la ventana se corre un año hacia adelante: abril de este año →
  // marzo del año que viene. Si el mes visto es marzo o anterior, la
  // ventana se queda igual que antes (abril del año pasado → marzo de
  // este año), porque esa es la que está a punto de cobrarse o se
  // acaba de cobrar.
  var anioPagoMarzo = mes<=3 ? anio : anio+1;
  var fracMarzo = ventanaPaga(3, anioPagoMarzo);
  var pagaMarzoMensual = Math.round((c.pagaMarzo*pct*fracMarzo/12)*100)/100;
  var salarioBaseProp = Math.round(c.salarioBase*pct*100)/100;
  var fijos = [
    {label:'Salario Base', val:salarioBaseProp},
    {label:'Plus Transporte', val:Math.round(c.plusTransporte*pct*100)/100},
    {label:'Plus Manutención', val:Math.round(c.plusManutencion*pct*100)/100},
    {label:'Paga de Marzo (÷12)'+(fracMarzo<1?' · prorrateada':''), val:pagaMarzoMensual}
  ];
  // CONFIRMADO por Alex (última versión): las tres pagas (Verano,
  // Otoño, Navidad) usan la MISMA regla — cada una tiene su propia
  // ventana de 12 meses que termina en su propio mes de pago
  // (Verano=julio, Otoño=septiembre, Navidad=diciembre), no un año
  // natural compartido ni semestres. Ej.: Navidad mira de enero a
  // diciembre de ESTE año; Verano mira de agosto del año anterior a
  // julio de este año; Otoño mira de octubre del año anterior a
  // septiembre de este año. Estas tres solo se calculan cuando "mes"
  // coincide exactamente con su mes de pago, así que nunca tienen el
  // problema de la Paga de Marzo (que se muestra TODOS los meses).
  function ventanaPaga(mesPago, anioOverride){
    var anioPago = anioOverride || anio;
    var fin = new Date(anioPago, mesPago, 0); // último día del mes de pago
    var inicio = new Date(anioPago-1, mesPago, 1); // mismo mes, año anterior, día siguiente
    return _nominaFraccionDevengo(inicio, fin);
  }
  // FIX — Confirmado por el usuario y el propio convenio (art. 41): la
  // Paga de Verano se cobra CON LA MENSUALIDAD DE JUNIO, no de julio.
  // El código decía "mes===7" (julio) cuando debía decir "mes===6"
  // (junio) — por eso nunca se mostraba en el mes correcto. De paso,
  // esto también corrige la ventana de devengo: al pasar mesPago=6,
  // ventanaPaga() calcula "1 de julio del año anterior → 30 de junio
  // de este año", que es EXACTAMENTE el periodo de devengo que dice
  // el convenio para esta paga (antes, con mesPago=7, la ventana
  // quedaba desplazada un mes de más).
  if(mes===6){
    var fracVerano = ventanaPaga(6);
    fijos.push({label:'Paga Extra (Verano)'+(fracVerano<1?' · prorrateada':''), val:Math.round(salarioBaseProp*fracVerano*100)/100});
  }
  if(mes===9){
    var fracOtono = ventanaPaga(9);
    fijos.push({label:'Paga Otoño'+(fracOtono<1?' · prorrateada':''), val:Math.round(salarioBaseProp*fracOtono*100)/100});
  }
  if(mes===12){
    var fracNavidad = ventanaPaga(12);
    fijos.push({label:'Paga Extra (Navidad)'+(fracNavidad<1?' · prorrateada':''), val:Math.round(salarioBaseProp*fracNavidad*100)/100});
  }
  return fijos;
}

function abrirNominaEstimada(){
  var rolLbl = {tripulante:'Tripulante', auxiliar:'Tripulante Auxiliar', jefe:'Jefe de Tripulación'}[AJ.rol] || 'Tripulante';
  document.getElementById('nomina-subtitulo').textContent = MESES[statsM.getMonth()]+' '+statsM.getFullYear()+' · '+rolLbl;
  renderNominaTodasLasCaras();
  openOv('ov-nomina');
}

// NUEVO — Confirmado por Alex: las tres caras (Excel/Calendario/Real)
// se muestran TODAS a la vez, apiladas (Estilo 2 de la maqueta), en
// vez de en pestañas. Cada _construirCard*() ahora DEVUELVE su HTML
// (ya no escribe directo en la pantalla), y aquí se juntan las tres
// en un único innerHTML.
function renderNominaTodasLasCaras(){
  var html = _construirCardExcel() + _construirCardCalendario() + _construirCardReal();
  document.getElementById('nomina-body').innerHTML = html;
}
