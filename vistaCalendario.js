import { db } from &quot;./firebase-config.js&quot;;
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from
&quot;https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js&quot;;
const idActivo = localStorage.getItem(&#39;usuario_activo&#39;);
const calId = localStorage.getItem(&#39;calendario_activo&#39;);
let fechaVisualizada = new Date();
const HOY_REAL = new Date();
let datosCalendario = null;
let mapaColores = {};
let vistaActual = &quot;mes&quot;;
// AÑADIDOS LOS 12 COLORES
const COLORES_DISPONIBLES = [&#39;c-azul&#39;, &#39;c-naranja&#39;, &#39;c-rojo&#39;, &#39;c-verde&#39;, &#39;c-morado&#39;, &#39;c-rosa&#39;,
&#39;c-marron&#39;, &#39;c-amarillo&#39;, &#39;c-negro&#39;, &#39;c-cian&#39;, &#39;c-magenta&#39;, &#39;c-celeste&#39;];
document.addEventListener(&#39;DOMContentLoaded&#39;, async () =&gt; {
if (!idActivo || !calId) { window.location.href = &quot;dashboard.html&quot;; return; }
fechaVisualizada = new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(),
HOY_REAL.getDate());
try {
await cargarDatosUsuario();
await inicializarCalendario();
configurarControles();
} catch (error) {
console.error(&quot;Error al iniciar:&quot;, error);
}
});
async function cargarDatosUsuario() {
const uSnap = await getDoc(doc(db, &quot;usuarios&quot;, idActivo));
if (uSnap.exists()) {
const uData = uSnap.data();
document.getElementById(&#39;header-user-name&#39;).innerText = uData.nombre;
}
}
async function inicializarCalendario() {
const docSnap = await getDoc(doc(db, &quot;calendarios&quot;, calId));
if (docSnap.exists()) {
datosCalendario = docSnap.data();
document.getElementById(&#39;titulo-calendario&#39;).innerText = datosCalendario.nombre;
await asegurarColoresMiembros();
const miColor = mapaColores[idActivo] || &#39;c-negro&#39;;

const ind = document.getElementById(&#39;user-color-indicator&#39;);
if(ind) ind.className = `color-dot-indicator bg-${miColor}`;
renderizarCalendario();
// Botón de miembros para TODOS
document.getElementById(&#39;btn-miembros&#39;).onclick = function() {
window.abrirModalMiembros();
this.blur();
};
// Botón de configuración SOLO para admins/creador
if (datosCalendario.creador === idActivo || (datosCalendario.admins &amp;&amp;
datosCalendario.admins.includes(idActivo))) {
document.getElementById(&#39;btn-config&#39;).classList.remove(&#39;hidden&#39;);
document.getElementById(&#39;btn-config&#39;).onclick = function() {
window.abrirModalConfig();
this.blur();
};
}
} else {
window.location.href = &quot;dashboard.html&quot;;
}
}
async function asegurarColoresMiembros() {
let necesitaActualizar = false;
mapaColores = datosCalendario.colores_miembros || {};
let coloresUsados = Object.values(mapaColores);
datosCalendario.miembros.forEach(miembroId =&gt; {
if (!mapaColores[miembroId]) {
const colorLibre = COLORES_DISPONIBLES.find(c =&gt; !coloresUsados.includes(c)) || &#39;c-
negro&#39;;
mapaColores[miembroId] = colorLibre;
coloresUsados.push(colorLibre);
necesitaActualizar = true;
}
});
if (necesitaActualizar) {
await updateDoc(doc(db, &quot;calendarios&quot;, calId), { colores_miembros: mapaColores });
datosCalendario.colores_miembros = mapaColores;
}
}

function configurarControles() {
document.getElementById(&#39;btn-prev&#39;).onclick = function() {
this.blur();
if (vistaActual === &quot;mes&quot;) {
if (fechaVisualizada.getFullYear() === HOY_REAL.getFullYear() &amp;&amp;
fechaVisualizada.getMonth() === HOY_REAL.getMonth()) return;
fechaVisualizada.setMonth(fechaVisualizada.getMonth() - 1);
} else {
const lunesActualSemana = obtenerLunes(fechaVisualizada);
const lunesSemanaHoy = obtenerLunes(HOY_REAL);
if (lunesActualSemana.getTime() &lt;= lunesSemanaHoy.getTime()) return;
fechaVisualizada.setDate(fechaVisualizada.getDate() - 7);
}
renderizarCalendario();
};
document.getElementById(&#39;btn-next&#39;).onclick = function() {
this.blur();
if (vistaActual === &quot;mes&quot;) {
fechaVisualizada.setMonth(fechaVisualizada.getMonth() + 1);
} else {
fechaVisualizada.setDate(fechaVisualizada.getDate() + 7);
}
renderizarCalendario();
};
document.getElementById(&#39;btn-vista-mes&#39;).onclick = function() {
this.blur();
if (vistaActual === &quot;mes&quot;) return;
vistaActual = &quot;mes&quot;;
document.getElementById(&#39;btn-vista-semana&#39;).classList.remove(&#39;active&#39;);
this.classList.add(&#39;active&#39;);
fechaVisualizada = new Date(fechaVisualizada.getFullYear(), fechaVisualizada.getMonth(),
1);
renderizarCalendario();
};
document.getElementById(&#39;btn-vista-semana&#39;).onclick = function() {
this.blur();

if (vistaActual === &quot;semana&quot;) return;
vistaActual = &quot;semana&quot;;
document.getElementById(&#39;btn-vista-mes&#39;).classList.remove(&#39;active&#39;);
this.classList.add(&#39;active&#39;);
renderizarCalendario();
};
}
function obtenerLunes(d) {
const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
const day = date.getDay();
const diasPorRestar = (day === 0) ? 6 : day - 1;
date.setDate(date.getDate() - diasPorRestar);
return date;
}
// =========================================================
// SISTEMA DE CARGA BASADO EN LOS MIEMBROS DEL CALENDARIO
// =========================================================
async function cargarAcontecimientosDelPeriodo(fechaInicio, fechaFin) {
const acontecimientos = [];
try {
if (!datosCalendario || !datosCalendario.miembros || datosCalendario.miembros.length ===
0) {
return acontecimientos;
}
const promesas = datosCalendario.miembros.map(miembroId =&gt; {
const q = query(collection(db, &quot;acontecimientos&quot;), where(&quot;userId&quot;, &quot;==&quot;, miembroId));
return getDocs(q);
});
const resultados = await Promise.all(promesas);
resultados.forEach(querySnapshot =&gt; {
querySnapshot.forEach((docSnap) =&gt; {
const data = docSnap.data();
if (data.tipo === &quot;Viaje&quot; &amp;&amp; data.fechaIda &amp;&amp; data.fechaVuelta) {
const fIdaDoc = new Date(data.fechaIda);
const fVueltaDoc = new Date(data.fechaVuelta);
const fIdaClean = new Date(fIdaDoc.getFullYear(), fIdaDoc.getMonth(), fIdaDoc.getDate());

const fVueltaClean = new Date(fVueltaDoc.getFullYear(), fVueltaDoc.getMonth(),
fVueltaDoc.getDate());
const fInicioClean = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(),
fechaInicio.getDate());
const fFinClean = new Date(fechaFin.getFullYear(), fechaFin.getMonth(),
fechaFin.getDate());
if (fIdaClean &lt;= fFinClean &amp;&amp; fVueltaClean &gt;= fInicioClean) {
acontecimientos.push({
id: docSnap.id,
...data,
esViaje: true,
fechaIdaObjeto: fIdaClean,
fechaVueltaObjeto: fVueltaClean
});
}
} else if (data.fecha) {
let fechaDoc = (typeof data.fecha.toDate === &#39;function&#39;) ? data.fecha.toDate() : new
Date(data.fecha);
const fDocClean = new Date(fechaDoc.getFullYear(), fechaDoc.getMonth(),
fechaDoc.getDate());
const fInicioClean = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(),
fechaInicio.getDate());
const fFinClean = new Date(fechaFin.getFullYear(), fechaFin.getMonth(),
fechaFin.getDate());
if (fDocClean &gt;= fInicioClean &amp;&amp; fDocClean &lt;= fFinClean) {
acontecimientos.push({ id: docSnap.id, ...data, esViaje: false, fechaObjeto: fDocClean });
}
}
});
});
} catch (error) {
console.error(&quot;Error cargando acontecimientos de los miembros:&quot;, error);
}
return acontecimientos;
}
function pintarEstrellas(acontecimientos, fecha, esFilaSemana1 = false, esFilaSemana2 =
false) {
const idContainer = `estrellas-${fecha.getFullYear()}-${fecha.getMonth()+1}-
${fecha.getDate()}`;
const container = document.getElementById(idContainer);

if (!container) return;
if (esFilaSemana1) container.className = &quot;stars-grid-semana-fila1&quot;;
else if (esFilaSemana2) container.className = &quot;stars-grid-semana-fila2&quot;;
else container.className = &quot;stars-grid&quot;;
container.innerHTML = &quot;&quot;;
const fActualClean = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
const delDia = acontecimientos.filter(a =&gt; {
if (a.esViaje) {
return fActualClean &gt;= a.fechaIdaObjeto &amp;&amp; fActualClean &lt;= a.fechaVueltaObjeto;
} else {
return a.fechaObjeto.getFullYear() === fecha.getFullYear() &amp;&amp;
a.fechaObjeto.getMonth() === fecha.getMonth() &amp;&amp;
a.fechaObjeto.getDate() === fecha.getDate();
}
});
const usuariosVistos = new Set();
const eventosUnicosPorUsuario = [];
for (let ev of delDia) {
if (!usuariosVistos.has(ev.userId)) {
usuariosVistos.add(ev.userId);
eventosUnicosPorUsuario.push(ev);
}
}
eventosUnicosPorUsuario.slice(0, 9).forEach(acontecimiento =&gt; {
const userId = acontecimiento.userId;
const colorClase = mapaColores[userId] || &#39;c-negro&#39;;
const estrella = document.createElement(&#39;i&#39;);
estrella.className = `fas fa-star ${colorClase}`;
estrella.style.fontSize = &quot;8px&quot;;
container.appendChild(estrella);
});
}
function renderizarCalendario() {

if (vistaActual === &quot;mes&quot;) {
renderizarMes();
} else {
renderizarSemana();
}
}
// =========================================================
// RENDERIZADO VISUAL DE LAS VISTAS
// =========================================================
async function renderizarMes() {
const grid = document.getElementById(&#39;calendar-grid&#39;);
const header = document.getElementById(&#39;dias-header&#39;);
const display = document.getElementById(&#39;mes-actual-display&#39;);
if(!grid || !header || !display) return;
header.style.display = &quot;&quot;;
grid.className = &quot;calendar-grid&quot;;
header.innerHTML =
&quot;&lt;div&gt;LUN&lt;/div&gt;&lt;div&gt;MAR&lt;/div&gt;&lt;div&gt;MIÉ&lt;/div&gt;&lt;div&gt;JUE&lt;/div&gt;&lt;div&gt;VIE&lt;/div&gt;&lt;div&gt;S
ÁB&lt;/div&gt;&lt;div&gt;DOM&lt;/div&gt;&quot;;
grid.innerHTML = &quot;&quot;;
const anio = fechaVisualizada.getFullYear();
const mes = fechaVisualizada.getMonth();
display.innerText = fechaVisualizada.toLocaleDateString(&#39;es-ES&#39;, { month: &#39;long&#39;, year:
&#39;numeric&#39; });
const btnPrev = document.getElementById(&#39;btn-prev&#39;);
const esMesActual = anio === HOY_REAL.getFullYear() &amp;&amp; mes === HOY_REAL.getMonth();
btnPrev.disabled = esMesActual;
btnPrev.style.opacity = esMesActual ? &quot;0.3&quot; : &quot;1&quot;;
btnPrev.style.cursor = esMesActual ? &quot;default&quot; : &quot;pointer&quot;;
const primerDia = new Date(anio, mes, 1);
const ultimoDia = new Date(anio, mes + 1, 0);
const ultimoDiaPasado = new Date(anio, mes, 0);
let diaSemInicio = primerDia.getDay() - 1;
if (diaSemInicio === -1) diaSemInicio = 6;

const fechaInicioCarga = new Date(anio, mes, 1 - diaSemInicio);
const celdasVaciasFinal = (diaSemInicio + ultimoDia.getDate()) &lt; 42 ? 42 - (diaSemInicio +
ultimoDia.getDate()) : 0;
const fechaFinCarga = new Date(anio, mes + 1, celdasVaciasFinal);
const listaAcontecimientos = await cargarAcontecimientosDelPeriodo(fechaInicioCarga,
fechaFinCarga);
for (let i = 0; i &lt; diaSemInicio; i++) {
const celda = document.createElement(&#39;div&#39;);
celda.className = &quot;day-cell day-other-month day-past&quot;;
const diaPasado = (ultimoDiaPasado.getDate() - diaSemInicio + 1) + i;
const fPasada = new Date(anio, mes - 1, diaPasado);
celda.innerHTML = `&lt;div class=&quot;day-number&quot;&gt;${diaPasado}&lt;/div&gt;&lt;div class=&quot;stars-grid&quot;
id=&quot;estrellas-${fPasada.getFullYear()}-${fPasada.getMonth()+1}-${diaPasado}&quot;&gt;&lt;/div&gt;`;
grid.appendChild(celda);
pintarEstrellas(listaAcontecimientos, fPasada);
}
for (let dia = 1; dia &lt;= ultimoDia.getDate(); dia++) {
const celda = document.createElement(&#39;div&#39;);
celda.className = &quot;day-cell&quot;;
const fCelda = new Date(anio, mes, dia);
if (fCelda &lt; new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(),
HOY_REAL.getDate())) celda.classList.add(&#39;day-past&#39;);
if (fCelda.toDateString() === HOY_REAL.toDateString()) celda.classList.add(&#39;day-today&#39;);
celda.innerHTML = `&lt;div class=&quot;day-number&quot;&gt;${dia}&lt;/div&gt;&lt;div class=&quot;stars-grid&quot;
id=&quot;estrellas-${anio}-${mes+1}-${dia}&quot;&gt;&lt;/div&gt;`;
celda.onclick = () =&gt; abrirDetalleDia(fCelda);
grid.appendChild(celda);
pintarEstrellas(listaAcontecimientos, fCelda);
}
if (celdasVaciasFinal &gt; 0) {
for (let j = 1; j &lt;= celdasVaciasFinal; j++) {
const celdaVacia = document.createElement(&#39;div&#39;);
celdaVacia.className = &quot;day-cell day-other-month&quot;;
const fSiguiente = new Date(anio, mes + 1, j);
celdaVacia.innerHTML = `&lt;div class=&quot;day-number&quot;&gt;${j}&lt;/div&gt;&lt;div class=&quot;stars-grid&quot;
id=&quot;estrellas-${fSiguiente.getFullYear()}-${fSiguiente.getMonth()+1}-${j}&quot;&gt;&lt;/div&gt;`;
grid.appendChild(celdaVacia);

pintarEstrellas(listaAcontecimientos, fSiguiente);
}
}
}
async function renderizarSemana() {
const grid = document.getElementById(&#39;calendar-grid&#39;);
const header = document.getElementById(&#39;dias-header&#39;);
const display = document.getElementById(&#39;mes-actual-display&#39;);
if(!grid || !header || !display) return;
header.style.display = &quot;none&quot;;
grid.className = &quot;vista-semanal-container&quot;;
grid.innerHTML = &quot;&quot;;
let lunes = obtenerLunes(fechaVisualizada);
display.innerText = &quot;Semana del &quot; + lunes.toLocaleDateString(&#39;es-ES&#39;, {day:&#39;numeric&#39;,
month:&#39;short&#39;});
const btnPrev = document.getElementById(&#39;btn-prev&#39;);
const esSemanaActual = lunes.toDateString() === obtenerLunes(HOY_REAL).toDateString();
btnPrev.disabled = esSemanaActual;
btnPrev.style.opacity = esSemanaActual ? &quot;0.3&quot; : &quot;1&quot;;
btnPrev.style.cursor = esSemanaActual ? &quot;default&quot; : &quot;pointer&quot;;
const fila1 = document.createElement(&#39;div&#39;);
fila1.className = &quot;semana-fila-1&quot;;
const fila2 = document.createElement(&#39;div&#39;);
fila2.className = &quot;semana-fila-2&quot;;
const nombresDias = [&#39;LUN&#39;, &#39;MAR&#39;, &#39;MIÉ&#39;, &#39;JUE&#39;, &#39;VIE&#39;, &#39;SÁB&#39;, &#39;DOM&#39;];
const domingo = new Date(lunes);
domingo.setDate(lunes.getDate() + 6);
const listaAcontecimientos = await cargarAcontecimientosDelPeriodo(lunes, domingo);
const llamadasPintar = [];
for (let i = 0; i &lt; 7; i++) {
const diaSemana = new Date(lunes);
diaSemana.setDate(lunes.getDate() + i);
const wrapper = document.createElement(&#39;div&#39;);

wrapper.className = &quot;dia-wrapper&quot;;
const headerDia = document.createElement(&#39;div&#39;);
headerDia.className = &quot;dia-header-semana&quot;;
headerDia.innerText = nombresDias[i];
const celda = document.createElement(&#39;div&#39;);
celda.className = &quot;day-cell&quot;;
celda.style.flex = &quot;1&quot;;
if (diaSemana &lt; new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(),
HOY_REAL.getDate())) celda.classList.add(&#39;day-past&#39;);
if (diaSemana.toDateString() === HOY_REAL.toDateString()) celda.classList.add(&#39;day-
today&#39;);
celda.innerHTML = `
&lt;div class=&quot;day-number&quot;&gt;${diaSemana.getDate()} &lt;span style=&quot;font-size:10px; color:#aaa;
font-weight:normal;&quot;&gt;${diaSemana.toLocaleDateString(&#39;es-ES&#39;,
{month:&#39;short&#39;})}&lt;/span&gt;&lt;/div&gt;
&lt;div class=&quot;stars-grid&quot; id=&quot;estrellas-${diaSemana.getFullYear()}-
${diaSemana.getMonth()+1}-${diaSemana.getDate()}&quot;&gt;&lt;/div&gt;
`;
celda.onclick = () =&gt; abrirDetalleDia(diaSemana);
wrapper.appendChild(headerDia);
wrapper.appendChild(celda);
if (i &lt; 5) {
fila1.appendChild(wrapper);
llamadasPintar.push({ fecha: diaSemana, f1: true, f2: false });
} else {
fila2.appendChild(wrapper);
llamadasPintar.push({ fecha: diaSemana, f1: false, f2: true });
}
}
grid.appendChild(fila1);
grid.appendChild(fila2);
llamadasPintar.forEach(item =&gt; {
pintarEstrellas(listaAcontecimientos, item.fecha, item.f1, item.f2);
});

}
function abrirDetalleDia(fecha) {
console.log(&quot;Día clickeado:&quot;, fecha.toLocaleDateString());
}
// =========================================================
// SISTEMA DE MIEMBROS, PERFILES Y COLORES
// =========================================================
window.abrirModalMiembros = async () =&gt; {
const modal = document.getElementById(&#39;modal-miembros&#39;);
const container = document.getElementById(&#39;lista-miembros-container&#39;);
if (!modal || !container) return;
container.innerHTML = &quot;&lt;p style=&#39;text-align:center; color:#999; margin-top:20px;&#39;&gt;&lt;i
class=&#39;fas fa-spinner fa-spin&#39;&gt;&lt;/i&gt; Cargando miembros...&lt;/p&gt;&quot;;
modal.classList.remove(&#39;hidden&#39;);
try {
const promesas = datosCalendario.miembros.map(mId =&gt; getDoc(doc(db, &quot;usuarios&quot;,
mId)));
const docs = await Promise.all(promesas);
let miembrosData = [];
docs.forEach(d =&gt; {
if (d.exists()) miembrosData.push({ id: d.id, ...d.data() });
});
miembrosData.sort((a, b) =&gt; {
if (a.id === idActivo) return -1;
if (b.id === idActivo) return 1;
return 0;
});
container.innerHTML = &quot;&quot;;
miembrosData.forEach(miembro =&gt; {
const esYo = miembro.id === idActivo;
const miColor = mapaColores[miembro.id] || &#39;c-negro&#39;;
const esCreador = datosCalendario.creador === miembro.id;

const esAdmin = datosCalendario.admins &amp;&amp;
datosCalendario.admins.includes(miembro.id);
let rolHtml = &quot;&quot;;
if (esYo) {
if (esCreador) {
rolHtml = `&lt;span style=&quot;color: #d32f2f; font-weight: 800; font-size: 12px; margin-top:
2px;&quot;&gt;Creador&lt;/span&gt;`;
} else if (esAdmin) {
rolHtml = `&lt;span style=&quot;color: #ec407a; font-weight: 700; font-size: 11px; margin-top:
2px;&quot;&gt;Eres Administrador&lt;/span&gt;`;
} else {
rolHtml = `&lt;span style=&quot;color: #999; font-weight: normal; font-size: 11px; margin-top:
2px;&quot;&gt;Sin rol asignado&lt;/span&gt;`;
}
} else {
if (esCreador) {
rolHtml = `&lt;span style=&quot;color: #d32f2f; font-weight: 800; font-size: 12px; margin-top:
2px;&quot;&gt;Creador&lt;/span&gt;`;
} else if (esAdmin) {
rolHtml = `&lt;span style=&quot;color: #f06292; font-weight: 600; font-size: 11px; margin-top:
2px;&quot;&gt;Administrador&lt;/span&gt;`;
} else {
rolHtml = `&lt;span style=&quot;color: #999; font-weight: normal; font-size: 11px; margin-top:
2px;&quot;&gt;Sin rol asignado&lt;/span&gt;`;
}
}
const fotoHtml = miembro.foto
? `&lt;img src=&quot;${miembro.foto}&quot; class=&quot;miembro-foto&quot;&gt;`
: `&lt;div class=&quot;miembro-foto&quot;&gt;&lt;i class=&quot;fas fa-user&quot;&gt;&lt;/i&gt;&lt;/div&gt;`;
// Botón de lápiz y ojo limpios
const accionHtml = esYo
? `&lt;button class=&quot;btn-icono-accion&quot; onclick=&quot;mostrarSelectorColor()&quot;&gt;&lt;i class=&quot;fas fa-
pencil-alt&quot;&gt;&lt;/i&gt;&lt;/button&gt;`
: `&lt;button class=&quot;btn-icono-accion&quot;
onclick=&#39;verPerfilUsuario(${JSON.stringify(miembro).replace(/&#39;/g, &quot;&amp;#39;&quot;)})&#39;&gt;&lt;i
class=&quot;fas fa-eye&quot;&gt;&lt;/i&gt;&lt;/button&gt;`;
const tuBadge = esYo ? `&lt;span style=&quot;color:#ec407a; font-weight:bold; font-size:15px; flex-
shrink:0; margin-right: 12px;&quot;&gt;(Tú)&lt;/span&gt;` : &#39;&#39;;

const row = document.createElement(&#39;div&#39;);
row.className = &quot;miembro-row&quot;;
row.innerHTML = `
&lt;div class=&quot;miembro-info&quot;&gt;
${fotoHtml}
&lt;div style=&quot;display: flex; flex-direction: column; align-items: flex-start; text-align: left;
overflow: hidden; width: 100%;&quot;&gt;
&lt;div class=&quot;miembro-detalles&quot; style=&quot;width: 100%;&quot;&gt;
&lt;span class=&quot;miembro-nombre&quot;&gt;${miembro.nombre} ${miembro.apellidos || &#39;&#39;}&lt;/span&gt;
${tuBadge}
&lt;/div&gt;
${rolHtml}
&lt;/div&gt;
&lt;/div&gt;
&lt;div class=&quot;miembro-actions&quot;&gt;
&lt;div class=&quot;color-dot-indicator bg-${miColor}&quot; style=&quot;width:16px; height:16px; min-
width:16px; min-height:16px; border-radius:50%; flex-shrink:0; box-shadow:none;
border:none;&quot;&gt;&lt;/div&gt;
${accionHtml}
&lt;/div&gt;
`;
container.appendChild(row);
if (esYo) {
const pickerBox = document.createElement(&#39;div&#39;);
pickerBox.id = &quot;selector-colores-box&quot;;
pickerBox.className = &quot;color-picker-box hidden&quot;;
container.appendChild(pickerBox);
}
});
} catch (error) {
console.error(&quot;Error cargando miembros con roles:&quot;, error);
container.innerHTML = &quot;&lt;p style=&#39;color:red; text-align:center;&#39;&gt;Error al cargar.&lt;/p&gt;&quot;;
}
};
window.mostrarSelectorColor = () =&gt; {
const box = document.getElementById(&#39;selector-colores-box&#39;);
if (!box) return;

if (!box.classList.contains(&#39;hidden&#39;)) {
box.classList.add(&#39;hidden&#39;);
return;
}
const coloresOcupados = Object.entries(mapaColores)
.filter(([id, color]) =&gt; id !== idActivo)
.map(([id, color]) =&gt; color);
box.innerHTML = &quot;&quot;;
box.classList.remove(&#39;hidden&#39;);
COLORES_DISPONIBLES.forEach(color =&gt; {
const dot = document.createElement(&#39;div&#39;);
dot.className = `color-picker-dot bg-${color}`;
dot.style.display = &quot;flex&quot;;
dot.style.alignItems = &quot;center&quot;;
dot.style.justifyContent = &quot;center&quot;;
if (coloresOcupados.includes(color)) {
dot.style.cursor = &quot;not-allowed&quot;;
dot.style.opacity = &quot;0.5&quot;;
dot.innerHTML = `&lt;i class=&quot;fas fa-lock&quot; style=&quot;color: rgba(255,255,255,0.9); font-size:
12px;&quot;&gt;&lt;/i&gt;`;
} else {
dot.onclick = () =&gt; cambiarMiColor(color);
}
if (mapaColores[idActivo] === color) {
dot.style.border = &quot;3px solid #333&quot;;
}
box.appendChild(dot);
});
};
window.cambiarMiColor = async (nuevoColor) =&gt; {
mapaColores[idActivo] = nuevoColor;
try {
await updateDoc(doc(db, &quot;calendarios&quot;, calId), { colores_miembros: mapaColores });
datosCalendario.colores_miembros = mapaColores;
abrirModalMiembros();

const ind = document.getElementById(&#39;user-color-indicator&#39;);
if(ind) ind.className = `color-dot-indicator bg-${nuevoColor}`;
} catch (error) {
console.error(&quot;Error guardando nuevo color:&quot;, error);
}
};
window.cerrarModalMiembros = () =&gt; {
document.getElementById(&#39;modal-miembros&#39;).classList.add(&#39;hidden&#39;);
renderizarCalendario();
};
window.verPerfilUsuario = (user) =&gt; {
const modal = document.getElementById(&#39;modal-perfil-miembro&#39;);
const content = document.getElementById(&#39;perfil-miembro-content&#39;);
const fotoHtml = user.foto
? `&lt;img src=&quot;${user.foto}&quot; style=&quot;width:110px; height:110px; border-radius:50%; object-
fit:cover; margin:0 auto 15px auto; display:block; box-shadow: 0 4px 10px
rgba(0,0,0,0.1);&quot;&gt;`
: `&lt;div style=&quot;width:110px; height:110px; border-radius:50%; background:#ddd;
color:white; font-size:45px; display:flex; align-items:center; justify-content:center; margin:0
auto 15px auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1);&quot;&gt;&lt;i class=&quot;fas fa-
user&quot;&gt;&lt;/i&gt;&lt;/div&gt;`;
content.innerHTML = `
${fotoHtml}
&lt;h2 style=&quot;margin: 0; color: #333; font-size: 22px;&quot;&gt;${user.nombre} ${user.apellidos ||
&#39;&#39;}&lt;/h2&gt;
&lt;p style=&quot;color: #ec407a; font-weight: bold; font-size: 14px; margin-top: 5px; margin-
bottom: 20px;&quot;&gt;&lt;i class=&quot;fas fa-birthday-cake&quot;&gt;&lt;/i&gt; ${user.fecha || &#39;Sin fecha
registrada&#39;}&lt;/p&gt;
&lt;div style=&quot;background: #fcfcfc; padding: 20px; border-radius: 12px; border: 1px solid
#eee; text-align: left;&quot;&gt;
&lt;strong style=&quot;color: #999; font-size: 12px; letter-spacing: 1px;&quot;&gt;DESCRIPCIÓN&lt;/strong&gt;
&lt;p style=&quot;color: #444; margin-top: 8px; font-size: 15px; line-height: 1.5; margin-bottom:
0;&quot;&gt;${user.descripcion || &#39;Este usuario aún no ha escrito ninguna descripción en su
perfil.&#39;}&lt;/p&gt;
&lt;/div&gt;
`;

modal.classList.remove(&#39;hidden&#39;);
};
// =========================================================
// SISTEMA DE CONFIGURACIÓN DEL CALENDARIO
// =========================================================
window.abrirModalConfig = async () =&gt; {
const modal = document.getElementById(&#39;modal-config&#39;);
const container = document.getElementById(&#39;config-container&#39;);
if (!modal || !container) return;
modal.classList.remove(&#39;hidden&#39;);
container.innerHTML = &quot;&lt;p style=&#39;text-align:center; color:#999;&#39;&gt;&lt;i class=&#39;fas fa-spinner fa-
spin&#39;&gt;&lt;/i&gt; Cargando ajustes...&lt;/p&gt;&quot;;
try {
// 1. Carga de datos frescos desde Firebase
const docSnap = await getDoc(doc(db, &quot;calendarios&quot;, calId));
if (!docSnap.exists()) throw new Error(&quot;Calendario no encontrado&quot;);
const datos = docSnap.data();
// 2. Verificación de permisos
const esCreador = datos.creador === idActivo;
const esAdmin = datos.admins &amp;&amp; datos.admins.includes(idActivo);
if (!esCreador &amp;&amp; !esAdmin) {
container.innerHTML = &quot;&lt;p style=&#39;color:red; text-align:center;&#39;&gt;No tienes permisos para ver
esto.&lt;/p&gt;&quot;;
return;
}
// 3. Carga de miembros
const promesas = datos.miembros.map(mId =&gt; getDoc(doc(db, &quot;usuarios&quot;, mId)));
const docs = await Promise.all(promesas);
let miembrosData = [];
docs.forEach(d =&gt; { if (d.exists()) miembrosData.push({ id: d.id, ...d.data() }); });
// 4. Estilos reutilizables para botones (para evitar solapamientos)
const btnStyle = &quot;width: 32px; height: 32px; display: flex; align-items: center; justify-
content: center; padding: 0; flex-shrink: 0; margin-left: 10px; border: 1px solid #ddd;
border-radius: 6px; cursor: pointer; background: white;&quot;;

// 5. Construcción del HTML
const requiereAprobacion = datos.requiere_aprobacion || false;
let htmlInfo = `
&lt;div style=&quot;background: #fdf5f8; padding: 15px; border-radius: 12px; border: 1px solid
#fce4ec; text-align: left;&quot;&gt;
&lt;div style=&quot;display: flex; justify-content: space-between; align-items: center; margin-
bottom: 15px;&quot;&gt;
&lt;div style=&quot;min-width: 0; flex: 1;&quot;&gt;
&lt;span style=&quot;font-size: 11px; color: #999; text-transform: uppercase; letter-spacing:
1px;&quot;&gt;Nombre&lt;/span&gt;
&lt;div style=&quot;font-size: 16px; font-weight: bold; color: #333; margin-top: 2px; white-space:
nowrap; overflow: hidden; text-overflow: ellipsis;&quot;&gt;
${datos.nombre || &#39;Sin nombre&#39;}
&lt;/div&gt;
&lt;/div&gt;
&lt;button class=&quot;btn-icono-accion&quot; onclick=&quot;editarNombreCalendario();
document.activeElement.blur();&quot; style=&quot;${btnStyle}&quot;&gt;
&lt;i class=&quot;fas fa-pencil-alt&quot;&gt;&lt;/i&gt;
&lt;/button&gt;
&lt;/button&gt;
&lt;/div&gt;
&lt;hr style=&quot;border: none; border-top: 1px solid #fce4ec; margin: 12px 0;&quot;&gt;
&lt;div style=&quot;display: flex; justify-content: space-between; align-items: center;&quot;&gt;
&lt;div style=&quot;min-width: 0; flex: 1;&quot;&gt;
&lt;span style=&quot;font-size: 11px; color: #999; text-transform: uppercase; letter-spacing:
1px;&quot;&gt;Código&lt;/span&gt;
&lt;div style=&quot;font-size: 16px; font-weight: bold; color: #ec407a; margin-top: 2px; letter-
spacing: 2px;&quot;&gt;${datos.codigo_acceso || &#39;---&#39;}&lt;/div&gt;
&lt;/div&gt;
&lt;div style=&quot;display: flex; flex-shrink: 0;&quot;&gt;
${esCreador ? `
&lt;button class=&quot;btn-icono-accion&quot; onclick=&quot;generarCodigoAleatorio();
document.activeElement.blur();&quot; style=&quot;${btnStyle}&quot; title=&quot;Nuevo código&quot;&gt;
&lt;i class=&quot;fas fa-sync-alt&quot;&gt;&lt;/i&gt;
&lt;/button&gt;
&lt;button class=&quot;btn-icono-accion&quot; onclick=&quot;editarCodigoInvitacion();
document.activeElement.blur();&quot; style=&quot;${btnStyle}&quot; title=&quot;Editar código&quot;&gt;
&lt;i class=&quot;fas fa-pencil-alt&quot;&gt;&lt;/i&gt;
&lt;/button&gt;

` : &#39;&lt;i class=&quot;fas fa-lock&quot; style=&quot;color:#ccc; margin-left: 10px;&quot;&gt;&lt;/i&gt;&#39;}
&lt;/div&gt;
&lt;/div&gt;
&lt;/div&gt;
&lt;div style=&quot;display: flex; justify-content: space-between; align-items: center; background:
#fff; padding: 12px 15px; border-radius: 12px; border: 1px solid #eee; margin-top: 10px;
text-align: left;&quot;&gt;
&lt;div&gt;
&lt;div style=&quot;font-size: 14px; font-weight: bold; color: #333;&quot;&gt;Privacidad&lt;/div&gt;
&lt;div style=&quot;font-size: 11px; color: #999;&quot;&gt;Requerir aprobación para unirse&lt;/div&gt;
&lt;/div&gt;
&lt;label style=&quot;position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink:
0;&quot;&gt;
&lt;input type=&quot;checkbox&quot; id=&quot;toggle-priv&quot; ${requiereAprobacion ? &#39;checked&#39; : &#39;&#39;}
onchange=&quot;cambiarPrivacidad(this.checked)&quot; style=&quot;opacity: 0; width: 0; height: 0;&quot;&gt;
&lt;span style=&quot;position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
background-color: ${requiereAprobacion ? &#39;#ec407a&#39; : &#39;#ccc&#39;}; border-radius: 24px;
transition: .3s;&quot;&gt;
&lt;span style=&quot;position: absolute; height: 18px; width: 18px; left: ${requiereAprobacion ?
&#39;23px&#39; : &#39;3px&#39;}; bottom: 3px; background-color: white; border-radius: 50%; transition: .3s;
box-shadow: 0 2px 4px rgba(0,0,0,0.2);&quot;&gt;&lt;/span&gt;
&lt;/span&gt;
&lt;/label&gt;
&lt;/div&gt;
&lt;h3 style=&quot;margin: 15px 0 -5px 0; font-size: 16px; color: #333;&quot;&gt;Gestión de
Miembros&lt;/h3&gt;
`;
let htmlMiembros = `&lt;div style=&quot;display: flex; flex-direction: column; gap: 10px; margin-top:
10px;&quot;&gt;`;
miembrosData.forEach(miembro =&gt; {
const mEsCreador = datos.creador === miembro.id;
const mEsAdmin = datos.admins &amp;&amp; datos.admins.includes(miembro.id);
const soyYo = miembro.id === idActivo;
let rolTxt = mEsCreador ? `&lt;span style=&quot;color: #d32f2f; font-size: 11px; font-weight:
bold;&quot;&gt;Creador&lt;/span&gt;` : mEsAdmin ? `&lt;span style=&quot;color: #ec407a; font-size: 11px; font-
weight: bold;&quot;&gt;Administrador&lt;/span&gt;` : `&lt;span style=&quot;color: #999; font-size:
11px;&quot;&gt;Miembro&lt;/span&gt;`;
let botonesHtml = ``;
if (!mEsCreador &amp;&amp; !soyYo) {

if (esCreador) {
const iconoCorona = mEsAdmin ? `&lt;i class=&quot;fas fa-user-times&quot; style=&quot;color:#ffb300;&quot;&gt;&lt;/i&gt;`
: `&lt;i class=&quot;fas fa-user-shield&quot; style=&quot;color:#ffb300;&quot;&gt;&lt;/i&gt;`;
botonesHtml += `&lt;button class=&quot;btn-icono-accion&quot; onclick=&quot;toggleAdmin(&#39;${miembro.id}&#39;,
${mEsAdmin}); document.activeElement.blur();&quot;
style=&quot;${btnStyle}&quot;&gt;${iconoCorona}&lt;/button&gt;`;
botonesHtml += `&lt;button class=&quot;btn-icono-accion&quot;
onclick=&quot;expulsarMiembro(&#39;${miembro.id}&#39;, &#39;${miembro.nombre}&#39;);
document.activeElement.blur();&quot; style=&quot;${btnStyle} color: #ef5350;&quot;&gt;&lt;i class=&quot;fas fa-
trash&quot;&gt;&lt;/i&gt;&lt;/button&gt;`;
} else if (esAdmin &amp;&amp; !mEsAdmin) {
botonesHtml += `&lt;button class=&quot;btn-icono-accion&quot;
onclick=&quot;expulsarMiembro(&#39;${miembro.id}&#39;, &#39;${miembro.nombre}&#39;);
document.activeElement.blur();&quot; style=&quot;${btnStyle} color: #ef5350;&quot;&gt;&lt;i class=&quot;fas fa-
trash&quot;&gt;&lt;/i&gt;&lt;/button&gt;`;
}
}
htmlMiembros += `
&lt;div style=&quot;display: flex; align-items: center; justify-content: space-between; padding: 10px;
border: 1px solid #f0f0f0; border-radius: 8px;&quot;&gt;
&lt;div style=&quot;display: flex; flex-direction: column; align-items: flex-start;&quot;&gt;
&lt;span style=&quot;font-weight: bold; font-size: 14px; color: #333;&quot;&gt;${miembro.nombre}
${miembro.apellidos || &#39;&#39;} ${soyYo ? &#39;&lt;span style=&quot;color:#ec407a;&quot;&gt;(Tú)&lt;/span&gt;&#39; :
&#39;&#39;}&lt;/span&gt;
${rolTxt}
&lt;/div&gt;
&lt;div style=&quot;display: flex; gap: 5px; flex-shrink: 0;&quot;&gt;${botonesHtml}&lt;/div&gt;
&lt;/div&gt;
`;
});
htmlMiembros += `&lt;/div&gt;`;
let htmlZonaPeligro = ``;
if (esCreador) {
htmlZonaPeligro = `
&lt;div style=&quot;border: 1px solid #ffcdd2; background: #fff5f5; padding: 15px; border-radius:
12px; display: flex; flex-direction: column; gap: 10px; margin-top: 15px;&quot;&gt;
&lt;button onclick=&quot;iniciarTraspasoCreador(); document.activeElement.blur();&quot;
style=&quot;background: white; color: #d32f2f; border: 1px solid #d32f2f; padding: 10px;
border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%;&quot;&gt;Traspasar
titularidad&lt;/button&gt;
&lt;button onclick=&quot;eliminarCalendarioDefinitivo(); document.activeElement.blur();&quot;

style=&quot;background: #d32f2f; color: white; border: none; padding: 10px; border-radius: 8px;
font-weight: bold; cursor: pointer; width: 100%;&quot;&gt;Eliminar Calendario&lt;/button&gt;
&lt;/div&gt;
`;
}
container.innerHTML = htmlInfo + htmlMiembros + htmlZonaPeligro;
} catch (error) {
console.error(&quot;Error:&quot;, error);
container.innerHTML = &quot;&lt;p style=&#39;color:red; text-align:center;&#39;&gt;Error al cargar los
ajustes.&lt;/p&gt;&quot;;
}
};
