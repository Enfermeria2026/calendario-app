import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, arrayUnion, arrayRemove, addDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
const idActivo = localStorage.getItem('usuario_activo');
const calId = localStorage.getItem('calendario_activo');
let fechaVisualizada = new Date();
const HOY_REAL = new Date();
let datosCalendario = null;
let mapaColores = {};
let vistaActual = "mes";
// AÑADIDOS LOS 12 COLORES
const COLORES_DISPONIBLES = ['c-azul', 'c-naranja', 'c-rojo', 'c-verde', 'c-morado', 'c-rosa', 'c-marron', 'c-amarillo', 'c-negro', 'c-cian', 'c-magenta', 'c-celeste'];
document.addEventListener('DOMContentLoaded', async () => {
if (!idActivo || !calId) { window.location.href = "dashboard.html"; return; }
fechaVisualizada = new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(), HOY_REAL.getDate());
  try {
await cargarDatosUsuario();
await inicializarCalendario();
configurarControles();
} catch (error) {
console.error("Error al iniciar:", error);
}
});
async function cargarDatosUsuario() {
const uSnap = await getDoc(doc(db, "usuarios", idActivo));
if (uSnap.exists()) {
const uData = uSnap.data();
document.getElementById('header-user-name').innerText = uData.nombre;
}
}

async function inicializarCalendario() {
    const docSnap = await getDoc(doc(db, "calendarios", calId));
    if (docSnap.exists()) {
        datosCalendario = docSnap.data();
        document.getElementById('titulo-calendario').innerText = datosCalendario.nombre;
        await asegurarColoresMiembros();

        const miColor = mapaColores[idActivo] || 'c-negro';
        const ind = document.getElementById('user-color-indicator');
        if(ind) ind.className = `color-dot-indicator bg-${miColor}`;

        renderizarCalendario();

        // Botón de miembros para TODOS
        document.getElementById('btn-miembros').onclick = function() {
            window.abrirModalMiembros();
            this.blur();
        };

        // Extraemos estas dos variables para saber si quien mira es Titular o Admin
        const esTitular = datosCalendario.titular === idActivo;
        const esAdmin = datosCalendario.admins && datosCalendario.admins.includes(idActivo);

        // Botón de configuración SOLO para admins/titular
        if (esTitular || esAdmin) {
            document.getElementById('btn-config').classList.remove('hidden');
            document.getElementById('btn-config').onclick = function() {
                window.abrirModalConfig();
                this.blur();
            };
        }

        // --- NUEVO: GESTIÓN DEL BUZÓN DE SOLICITUDES ---
        const btnSolicitudes = document.getElementById('btn-solicitudes');
        const badgeSolicitudes = document.getElementById('solicitudes-badge');
        
        if (btnSolicitudes) {
            // El buzón solo se muestra si eres titular/admin Y la privacidad está activada
            if ((esTitular || esAdmin) && datosCalendario.requiere_aprobacion === true) {
                btnSolicitudes.classList.remove('hidden');
                btnSolicitudes.onclick = function() { 
                    window.abrirModalSolicitudes(); 
                    this.blur(); 
                };
                
                // Si hay solicitudes pendientes, mostramos el puntito rojo flotante
                if (datosCalendario.solicitudes && datosCalendario.solicitudes.length > 0) {
                    if (badgeSolicitudes) badgeSolicitudes.classList.remove('hidden');
                } else {
                    if (badgeSolicitudes) badgeSolicitudes.classList.add('hidden');
                }
            } else {
                btnSolicitudes.classList.add('hidden');
            }
        }
        // -----------------------------------------------

    } else {
        window.location.href = "dashboard.html";
    }
}

window.cambiarPrivacidad = async (checked) => {
    // 1. CAMBIO ESTÉTICO INSTANTÁNEO: Buscamos los elementos del botón y los movemos al vuelo
    const inputPriv = document.getElementById('toggle-priv');
    if (inputPriv) {
        const fondoBoton = inputPriv.nextElementSibling; // El span del fondo gris/rosa
        if (fondoBoton) {
            // Cambiamos el color de fondo según esté activado (checked) o no
            fondoBoton.style.backgroundColor = checked ? '#ec407a' : '#ccc';
            
            const circuloBoton = fondoBoton.firstElementChild; // El circulito blanco de dentro
            if (circuloBoton) {
                // Movemos el círculo a la derecha (23px) o a la izquierda (3px)
                circuloBoton.style.left = checked ? '23px' : '3px';
            }
        }
    }

    // 2. PROCESO SILENCIOSO EN SEGUNDO PLANO: Guardamos en Firebase sin molestar al usuario
    try {
        const calRef = doc(db, "calendarios", calId);
        await updateDoc(calRef, { requiere_aprobacion: checked });
        datosCalendario.requiere_aprobacion = checked;
        
        // Relanzamos la inicialización para ocultar o mostrar el buzón en la cabecera de fondo
        await inicializarCalendario();
  
    } catch (error) {
        console.error("Error al cambiar privacidad:", error);
        alert("Hubo un error de conexión al guardar la privacidad.");
        
        // Si la base de datos falla, devolvemos el botón a su estado original para no engañar al usuario
        if (inputPriv) {
            inputPriv.checked = !checked;
            const fondoBoton = inputPriv.nextElementSibling;
            if (fondoBoton) {
                fondoBoton.style.backgroundColor = !checked ? '#ec407a' : '#ccc';
                const circuloBoton = fondoBoton.firstElementChild;
                if (circuloBoton) circuloBoton.style.left = !checked ? '23px' : '3px';
            }
        }
    }
};

async function asegurarColoresMiembros() {
let necesitaActualizar = false;
mapaColores = datosCalendario.colores_miembros || {};
let coloresUsados = Object.values(mapaColores);

datosCalendario.miembros.forEach(miembroId => {
if (!mapaColores[miembroId]) {
const colorLibre = COLORES_DISPONIBLES.find(c => !coloresUsados.includes(c)) || 'c-negro';
mapaColores[miembroId] = colorLibre;
coloresUsados.push(colorLibre);
necesitaActualizar = true;
}
});
if (necesitaActualizar) {
await updateDoc(doc(db, "calendarios", calId), { colores_miembros: mapaColores });
datosCalendario.colores_miembros = mapaColores;
}
}
function configurarControles() {
document.getElementById('btn-prev').onclick = function() {
this.blur();

if (vistaActual === "mes") {
if (fechaVisualizada.getFullYear() === HOY_REAL.getFullYear() && fechaVisualizada.getMonth() === HOY_REAL.getMonth()) return;
fechaVisualizada.setMonth(fechaVisualizada.getMonth() - 1);
} else {
const lunesActualSemana = obtenerLunes(fechaVisualizada);
const lunesSemanaHoy = obtenerLunes(HOY_REAL);
if (lunesActualSemana.getTime() <= lunesSemanaHoy.getTime()) return;
fechaVisualizada.setDate(fechaVisualizada.getDate() - 7);
}
renderizarCalendario();
};

document.getElementById('btn-next').onclick = function() {
this.blur();

if (vistaActual === "mes") {
fechaVisualizada.setMonth(fechaVisualizada.getMonth() + 1);
} else {
fechaVisualizada.setDate(fechaVisualizada.getDate() + 7);
}
renderizarCalendario();

};
document.getElementById('btn-vista-mes').onclick = function() {
this.blur();

if (vistaActual === "mes") return;
vistaActual = "mes";
document.getElementById('btn-vista-semana').classList.remove('active');
this.classList.add('active');
fechaVisualizada = new Date(fechaVisualizada.getFullYear(), fechaVisualizada.getMonth(), 1);
renderizarCalendario();

};
document.getElementById('btn-vista-semana').onclick = function() {
this.blur();
  if (vistaActual === "semana") return;
vistaActual = "semana";
document.getElementById('btn-vista-mes').classList.remove('active');
this.classList.add('active');
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
if (!datosCalendario || !datosCalendario.miembros || datosCalendario.miembros.length === 0) {
return acontecimientos;
}

const promesas = datosCalendario.miembros.map(miembroId => {
const q = query(collection(db, "acontecimientos"), where("userId", "==", miembroId));
return getDocs(q);
});

const resultados = await Promise.all(promesas);

resultados.forEach(querySnapshot => {
querySnapshot.forEach((docSnap) => {
const data = docSnap.data();

if (data.tipo === "Viaje" && data.fechaIda && data.fechaVuelta) {
const fIdaDoc = new Date(data.fechaIda);
const fVueltaDoc = new Date(data.fechaVuelta);

const fIdaClean = new Date(fIdaDoc.getFullYear(), fIdaDoc.getMonth(), fIdaDoc.getDate());
const fVueltaClean = new Date(fVueltaDoc.getFullYear(), fVueltaDoc.getMonth(), 
fVueltaDoc.getDate());
const fInicioClean = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate());
const fFinClean = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate());

if (fIdaClean <= fFinClean && fVueltaClean >= fInicioClean) {
acontecimientos.push({
id: docSnap.id,
...data,
esViaje: true,
fechaIdaObjeto: fIdaClean,
fechaVueltaObjeto: fVueltaClean
});
}
} else if (data.fecha) {
let fechaDoc = (typeof data.fecha.toDate === 'function') ? data.fecha.toDate() : new Date(data.fecha);
const fDocClean = new Date(fechaDoc.getFullYear(), fechaDoc.getMonth(), fechaDoc.getDate());
const fInicioClean = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate());
const fFinClean = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate());

if (fDocClean >= fInicioClean && fDocClean <= fFinClean) {
acontecimientos.push({ id: docSnap.id, ...data, esViaje: false, fechaObjeto: fDocClean });
}
}
});
});
} catch (error) {
console.error("Error cargando acontecimientos de los miembros:", error);
}
return acontecimientos;
}

function pintarEstrellas(acontecimientos, fecha, esFilaSemana1 = false, esFilaSemana2 = false) {
const idContainer = `estrellas-${fecha.getFullYear()}-${fecha.getMonth()+1}-${fecha.getDate()}`;
const container = document.getElementById(idContainer);
if (!container) return;
if (esFilaSemana1) container.className = "stars-grid-semana-fila1";
else if (esFilaSemana2) container.className = "stars-grid-semana-fila2";
else container.className = "stars-grid";

container.innerHTML = "";

const fActualClean = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

const delDia = acontecimientos.filter(a => {
if (a.esViaje) {
return fActualClean >= a.fechaIdaObjeto && fActualClean <= a.fechaVueltaObjeto;
} else {
return a.fechaObjeto.getFullYear() === fecha.getFullYear() &&
a.fechaObjeto.getMonth() === fecha.getMonth() &&
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

eventosUnicosPorUsuario.slice(0, 9).forEach(acontecimiento => {
const userId = acontecimiento.userId;
const colorClase = mapaColores[userId] || 'c-negro';

const estrella = document.createElement('i');
estrella.className = `fas fa-star ${colorClase}`;
estrella.style.fontSize = "8px";

container.appendChild(estrella);
});
}

function renderizarCalendario() {
if (vistaActual === "mes") {
renderizarMes();
} else {
renderizarSemana();
}
}

// =========================================================
// RENDERIZADO VISUAL DE LAS VISTAS
// =========================================================

async function renderizarMes() {
const grid = document.getElementById('calendar-grid');
const header = document.getElementById('dias-header');
const display = document.getElementById('mes-actual-display');
if(!grid || !header || !display) return;

header.style.display = "";
grid.className = "calendar-grid";
header.innerHTML = "<div>LUN</div><div>MAR</div><div>MIÉ</div><div>JUE</div><div>VIE</div><div>SÁB</div><div>DOM</div>";
grid.innerHTML = "";

const anio = fechaVisualizada.getFullYear();
const mes = fechaVisualizada.getMonth();

display.innerText = fechaVisualizada.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

const btnPrev = document.getElementById('btn-prev');
const esMesActual = anio === HOY_REAL.getFullYear() && mes === HOY_REAL.getMonth();
btnPrev.disabled = esMesActual;
btnPrev.style.opacity = esMesActual ? "0.3" : "1";
btnPrev.style.cursor = esMesActual ? "default" : "pointer";

const primerDia = new Date(anio, mes, 1);
const ultimoDia = new Date(anio, mes + 1, 0);
const ultimoDiaPasado = new Date(anio, mes, 0);

let diaSemInicio = primerDia.getDay() - 1;
if (diaSemInicio === -1) diaSemInicio = 6;

const fechaInicioCarga = new Date(anio, mes, 1 - diaSemInicio);
const celdasVaciasFinal = (diaSemInicio + ultimoDia.getDate()) < 42 ? 42 - (diaSemInicio + ultimoDia.getDate()) : 0;
const fechaFinCarga = new Date(anio, mes + 1, celdasVaciasFinal);

const listaAcontecimientos = await cargarAcontecimientosDelPeriodo(fechaInicioCarga, fechaFinCarga);

for (let i = 0; i < diaSemInicio; i++) {
const celda = document.createElement('div');
celda.className = "day-cell day-other-month day-past";
const diaPasado = (ultimoDiaPasado.getDate() - diaSemInicio + 1) + i;
const fPasada = new Date(anio, mes - 1, diaPasado);
celda.innerHTML = `<div class="day-number">${diaPasado}</div><div class="stars-grid" id="estrellas-${fPasada.getFullYear()}-${fPasada.getMonth()+1}-${diaPasado}"></div>`;
grid.appendChild(celda);
pintarEstrellas(listaAcontecimientos, fPasada);
}

for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
const celda = document.createElement('div');
celda.className = "day-cell";

const fCelda = new Date(anio, mes, dia);
if (fCelda < new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(), HOY_REAL.getDate())) celda.classList.add('day-past');
if (fCelda.toDateString() === HOY_REAL.toDateString()) celda.classList.add('day-today');

celda.innerHTML = `<div class="day-number">${dia}</div><div class="stars-grid" id="estrellas-${anio}-${mes+1}-${dia}"></div>`;
celda.onclick = () => abrirDetalleDia(fCelda, listaAcontecimientos);
grid.appendChild(celda);
pintarEstrellas(listaAcontecimientos, fCelda);
}

if (celdasVaciasFinal > 0) {
for (let j = 1; j <= celdasVaciasFinal; j++) {
const celdaVacia = document.createElement('div');
celdaVacia.className = "day-cell day-other-month";
const fSiguiente = new Date(anio, mes + 1, j);
celdaVacia.innerHTML = `<div class="day-number">${j}</div><div class="stars-grid" id="estrellas-${fSiguiente.getFullYear()}-${fSiguiente.getMonth()+1}-${j}"></div>`;
grid.appendChild(celdaVacia);
pintarEstrellas(listaAcontecimientos, fSiguiente);
  }
}
}

async function renderizarSemana() {
const grid = document.getElementById('calendar-grid');
const header = document.getElementById('dias-header');
const display = document.getElementById('mes-actual-display');
if(!grid || !header || !display) return;

header.style.display = "none";
grid.className = "vista-semanal-container";
grid.innerHTML = "";

let lunes = obtenerLunes(fechaVisualizada);
display.innerText = "Semana del " + lunes.toLocaleDateString('es-ES', {day:'numeric', month:'short'});

const btnPrev = document.getElementById('btn-prev');
const esSemanaActual = lunes.toDateString() === obtenerLunes(HOY_REAL).toDateString();
btnPrev.disabled = esSemanaActual;
btnPrev.style.opacity = esSemanaActual ? "0.3" : "1";
btnPrev.style.cursor = esSemanaActual ? "default" : "pointer";

const fila1 = document.createElement('div');
fila1.className = "semana-fila-1";
const fila2 = document.createElement('div');
fila2.className = "semana-fila-2";

const nombresDias = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const domingo = new Date(lunes);
domingo.setDate(lunes.getDate() + 6);
const listaAcontecimientos = await cargarAcontecimientosDelPeriodo(lunes, domingo);

const llamadasPintar = [];

for (let i = 0; i < 7; i++) {
const diaSemana = new Date(lunes);
diaSemana.setDate(lunes.getDate() + i);

const wrapper = document.createElement('div');
wrapper.className = "dia-wrapper";
const headerDia = document.createElement('div');
headerDia.className = "dia-header-semana";
headerDia.innerText = nombresDias[i];

const celda = document.createElement('div');
celda.className = "day-cell";
celda.style.flex = "1";

if (diaSemana < new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(), HOY_REAL.getDate())) celda.classList.add('day-past');
if (diaSemana.toDateString() === HOY_REAL.toDateString()) celda.classList.add('day-today');

celda.innerHTML = `
<div class="day-number">${diaSemana.getDate()} <span style="font-size:10px; color:#aaa; font-weight:normal;">${diaSemana.toLocaleDateString('es-ES', {month:'short'})}</span></div>
<div class="stars-grid" id="estrellas-${diaSemana.getFullYear()}-${diaSemana.getMonth()+1}-${diaSemana.getDate()}"></div>
`;

celda.onclick = () => abrirDetalleDia(diaSemana, listaAcontecimientos);

wrapper.appendChild(headerDia);
wrapper.appendChild(celda);

if (i < 5) {
fila1.appendChild(wrapper);
llamadasPintar.push({ fecha: diaSemana, f1: true, f2: false });
} else {
fila2.appendChild(wrapper);
llamadasPintar.push({ fecha: diaSemana, f1: false, f2: true });
}
}

grid.appendChild(fila1);
grid.appendChild(fila2);

llamadasPintar.forEach(item => {
pintarEstrellas(listaAcontecimientos, item.fecha, item.f1, item.f2);
});
}

// =========================================================
// FUNCIONALIDAD: VER DETALLES DE UN DÍA ESPECÍFICO
// =========================================================
async function abrirDetalleDia(fecha, todosLosAcontecimientos) {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');

    if (!modal) return;

    // 1. Filtrar los acontecimientos exactos del día clickeado
    const fActualClean = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    
    const delDia = todosLosAcontecimientos.filter(a => {
        if (a.esViaje) {
            return fActualClean >= a.fechaIdaObjeto && fActualClean <= a.fechaVueltaObjeto;
        } else {
            return a.fechaObjeto.getFullYear() === fecha.getFullYear() &&
                   a.fechaObjeto.getMonth() === fecha.getMonth() &&
                   a.fechaObjeto.getDate() === fecha.getDate();
        }
    });

    // Formatear la fecha para el título del modal (Ej: "lunes, 14 de junio")
    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
    let fechaStr = fecha.toLocaleDateString('es-ES', opcionesFecha);
    fechaStr = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1);
    msg.innerText = `Acontecimientos del ${fechaStr}`;
    
    // 2. Si no hay eventos ese día, mostramos un mensaje vacío
    if (delDia.length === 0) {
        extra.innerHTML = `<p style="text-align:center; color:#888; margin: 20px 0;">No hay ningún acontecimiento para este día.</p>`;
        btns.innerHTML = `<button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; outline:none;">Cerrar</button>`;
        modal.classList.remove('hidden');
        return;
    }

    // 3. Mostrar estado de carga mientras buscamos los nombres
    extra.innerHTML = "<p style='text-align:center; color:#999;'><i class='fas fa-spinner fa-spin'></i> Cargando detalles...</p>";
    btns.innerHTML = `<button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; outline:none;">Cerrar</button>`;
    modal.classList.remove('hidden');

    try {
        const usersIds = [...new Set(delDia.map(ev => ev.userId))];
        const promesas = usersIds.map(id => getDoc(doc(db, "usuarios", id)));
        const docs = await Promise.all(promesas);
        
        const mapaUsuarios = {};
        docs.forEach(d => {
            if (d.exists()) mapaUsuarios[d.id] = d.data();
        });

        // 4. Construimos la lista en formato "Scroll" con tarjetas elegantes
        let htmlContenido = `<div style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; padding-right: 5px; text-align: left;">`;

        delDia.forEach(ev => {
            const u = mapaUsuarios[ev.userId] || { nombre: "Usuario", apellidos: "Desconocido" };
            const colorClase = mapaColores[ev.userId] || 'c-negro'; 

            // Datos comunes
            const titulo = ev.titulo || 'Sin título';
            const tipo = ev.tipo || 'Evento';
            const lugarHtml = ev.lugar ? `<div style="color: #666; font-size: 13px; margin-top: 4px;"><i class="fas fa-map-marker-alt" style="color:#ef5350; width:16px;"></i> ${ev.lugar}</div>` : '';

            let tiempoHtml = '';
            
            // Si es un Viaje (Mostramos ida y vuelta detalladas)
            if (ev.esViaje) {
                const fIda = new Date(ev.fechaIda);
                const fVuelta = new Date(ev.fechaVuelta);
                const fIdaStr = fIda.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                const fVueltaStr = fVuelta.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                
                const hIda = ev.horaIda || ev.hora_ida || '';
                const hVuelta = ev.horaVuelta || ev.hora_vuelta || '';

                const txtIda = hIda ? `${fIdaStr} - ${hIda}` : fIdaStr;
                const txtVuelta = hVuelta ? `${fVueltaStr} - ${hVuelta}` : fVueltaStr;

                tiempoHtml = `
                    <div style="color: #666; font-size: 13px; margin-top: 6px; display:flex; flex-direction:column; gap:4px; background: #f5f5f5; padding: 8px; border-radius: 6px;">
                        <span><i class="fas fa-plane-departure" style="color:#2196F3; width:18px;"></i> <b>Ida:</b> ${txtIda}</span>
                        <span><i class="fas fa-plane-arrival" style="color:#4CAF50; width:18px;"></i> <b>Vuelta:</b> ${txtVuelta}</span>
                    </div>
                `;
            } 
            // Si es un evento normal (Mostramos Inicio y Fin debajo del título)
            else {
                // Soportamos diferentes formas de llamar a las variables en Firebase
                const hInicio = ev.horaInicio || ev.hora_inicio || ev.hora || '';
                const hFin = ev.horaFin || ev.hora_fin || '';

                if (hInicio || hFin) {
                    let textoHora = '';
                    if (hInicio && hFin) {
                        textoHora = `<b>Inicio:</b> ${hInicio} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Fin:</b> ${hFin}`;
                    } else if (hInicio) {
                        textoHora = `<b>Inicio:</b> ${hInicio}`;
                    } else if (hFin) {
                        textoHora = `<b>Fin:</b> ${hFin}`;
                    }
                    
                    tiempoHtml = `<div style="color: #666; font-size: 13px; margin-top: 5px;"><i class="far fa-clock" style="color:#ff9800; width:16px;"></i> ${textoHora}</div>`;
                }
            }

            // Diseño de la tarjeta: Título -> Tiempo -> Lugar
            htmlContenido += `
                <div style="border: 1px solid #eee; border-radius: 8px; padding: 15px; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f5f5f5; padding-bottom: 8px;">
                        <div style="display: flex; align-items: center;">
                            <div class="color-dot-indicator bg-${colorClase}" style="width:12px; height:12px; min-width:12px; border:none; box-shadow:none; margin-right:8px;"></div>
                            <span style="font-size: 13px; color: #555; font-weight: bold; text-transform: uppercase;">
                                ${u.nombre} ${u.apellidos || ''}
                            </span>
                        </div>
                        <span style="background: #fdf5f8; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; color: #ec407a; border: 1px solid #fce4ec; white-space: nowrap;">${tipo}</span>
                    </div>
                    <div style="font-size: 16px; font-weight: 900; color: #333;">${titulo}</div>
                    ${tiempoHtml}
                    ${lugarHtml}
                </div>
            `;
        });

        htmlContenido += `</div>`;
        extra.innerHTML = htmlContenido;

    } catch (error) {
        console.error("Error cargando detalles del día:", error);
        extra.innerHTML = "<p style='color:red; text-align:center;'>Error de conexión al cargar los detalles.</p>";
    }
}

// =========================================================
// SISTEMA DE MIEMBROS, PERFILES Y COLORES
// =========================================================

window.abrirModalMiembros = async () => {
const modal = document.getElementById('modal-miembros');
const container = document.getElementById('lista-miembros-container');
if (!modal || !container) return;

container.innerHTML = "<p style='text-align:center; color:#999; margin-top:20px;'><i class='fas fa-spinner fa-spin'></i> Cargando miembros...</p>";
modal.classList.remove('hidden');

try {
const promesas = datosCalendario.miembros.map(mId => getDoc(doc(db, "usuarios", mId)));
const docs = await Promise.all(promesas);

let miembrosData = [];
docs.forEach(d => {
if (d.exists()) miembrosData.push({ id: d.id, ...d.data() });
});

miembrosData.sort((a, b) => {
if (a.id === idActivo) return -1;
if (b.id === idActivo) return 1;
return 0;
});

container.innerHTML = "";

miembrosData.forEach(miembro => {
const esYo = miembro.id === idActivo;
const miColor = mapaColores[miembro.id] || 'c-negro';

const estitular = datosCalendario.titular === miembro.id;
const esAdmin = datosCalendario.admins && datosCalendario.admins.includes(miembro.id);
let rolHtml = "";

if (esYo) {
if (estitular) {
rolHtml = `<span style="color: #d32f2f; font-weight: 800; font-size: 12px; margin-top: 2px;">Titular</span>`;
} else if (esAdmin) {
rolHtml = `<span style="color: #ec407a; font-weight: 700; font-size: 11px; margin-top: 2px;">Eres Administrador</span>`;
} else {
rolHtml = `<span style="color: #999; font-weight: normal; font-size: 11px; margin-top: 2px;">Sin rol asignado</span>`;
}
} else {
if (estitular) {
rolHtml = `<span style="color: #d32f2f; font-weight: 800; font-size: 12px; margin-top: 2px;">Titular</span>`;
} else if (esAdmin) {
rolHtml = `<span style="color: #f06292; font-weight: 600; font-size: 11px; margin-top: 2px;">Administrador</span>`;
} else {
rolHtml = `<span style="color: #999; font-weight: normal; font-size: 11px; margin-top: 2px;">Sin rol asignado</span>`;
}
}

const fotoHtml = miembro.foto
? `<img src="${miembro.foto}" class="miembro-foto">`
: `<div class="miembro-foto"><i class="fas fa-user"></i></div>`;

// Botón de lápiz y ojo limpios
const accionHtml = esYo
? `<button class="btn-icono-accion" onclick="mostrarSelectorColor()"><i class="fas fa-pencil-alt"></i></button>`
: `<button class="btn-icono-accion" onclick='verPerfilUsuario(${JSON.stringify(miembro).replace(/'/g, "&#39;")})'><i class="fas fa-eye"></i></button>`;

const tuBadge = esYo ? `<span style="color:#ec407a; font-weight:bold; font-size:15px; flex-shrink:0; margin-right: 12px;">(Tú)</span>` : '';

const row = document.createElement('div');
row.className = "miembro-row";

row.innerHTML = `
<div class="miembro-info">
${fotoHtml}
<div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; overflow: hidden; width: 100%;">
<div class="miembro-detalles" style="width: 100%;">
<span class="miembro-nombre">${miembro.nombre} ${miembro.apellidos || ''}</span>
${tuBadge}
</div>
${rolHtml}
</div>
</div>
<div class="miembro-actions">
<div class="color-dot-indicator bg-${miColor}" style="width:16px; height:16px; min-width:16px; min-height:16px; border-radius:50%; flex-shrink:0; box-shadow:none; border:none;"></div>
${accionHtml}
</div>
`;
container.appendChild(row);

if (esYo) {
const pickerBox = document.createElement('div');
pickerBox.id = "selector-colores-box";
pickerBox.className = "color-picker-box hidden";
container.appendChild(pickerBox);
}
});

} catch (error) {
console.error("Error cargando miembros con roles:", error);
container.innerHTML = "<p style='color:red; text-align:center;'>Error al cargar.</p>";
}
};

window.mostrarSelectorColor = () => {
const box = document.getElementById('selector-colores-box');
if (!box) return;

if (!box.classList.contains('hidden')) {
box.classList.add('hidden');
  return;
}

const coloresOcupados = Object.entries(mapaColores)
.filter(([id, color]) => id !== idActivo)
.map(([id, color]) => color);

box.innerHTML = "";
box.classList.remove('hidden');

COLORES_DISPONIBLES.forEach(color => {
const dot = document.createElement('div');
dot.className = `color-picker-dot bg-${color}`;

dot.style.display = "flex";
dot.style.alignItems = "center";
dot.style.justifyContent = "center";

if (coloresOcupados.includes(color)) {
dot.style.cursor = "not-allowed";
dot.style.opacity = "0.5";
dot.innerHTML = `<i class="fas fa-lock" style="color: rgba(255,255,255,0.9); font-size: 12px;"></i>`;
} else {
dot.onclick = () => cambiarMiColor(color);
}

if (mapaColores[idActivo] === color) {
dot.style.border = "3px solid #333";
}

box.appendChild(dot);
});
};

window.cambiarMiColor = async (nuevoColor) => {
mapaColores[idActivo] = nuevoColor;
try {
await updateDoc(doc(db, "calendarios", calId), { colores_miembros: mapaColores });
datosCalendario.colores_miembros = mapaColores;
abrirModalMiembros();

const ind = document.getElementById('user-color-indicator');

if(ind) ind.className = `color-dot-indicator bg-${nuevoColor}`;
} catch (error) {
console.error("Error guardando nuevo color:", error);
}
};

window.cerrarModalMiembros = () => {
document.getElementById('modal-miembros').classList.add('hidden');
renderizarCalendario();
};

window.verPerfilUsuario = (user) => {
const modal = document.getElementById('modal-perfil-miembro');
const content = document.getElementById('perfil-miembro-content');

const fotoHtml = user.foto
? `<img src="${user.foto}" style="width:110px; height:110px; border-radius:50%; object-fit:cover; margin:0 auto 15px auto; display:block; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`
: `<div style="width:110px; height:110px; border-radius:50%; background:#ddd; color:white; font-size:45px; display:flex; align-items:center; justify-content:center; margin:0 auto 15px auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"><i class="fas fa-user"></i></div>`;

content.innerHTML = `
${fotoHtml}
<h2 style="margin: 0; color: #333; font-size: 22px;">${user.nombre} ${user.apellidos || ''}</h2>
<p style="color: #ec407a; font-weight: bold; font-size: 14px; margin-top: 5px; margin-bottom: 20px;"><i class="fas fa-birthday-cake"></i> ${user.fecha || 'Sin fecha registrada'}</p>

<div style="background: #fcfcfc; padding: 20px; border-radius: 12px; border: 1px solid #eee; text-align: left;">
<strong style="color: #999; font-size: 12px; letter-spacing: 1px;">DESCRIPCIÓN</strong>
<p style="color: #444; margin-top: 8px; font-size: 15px; line-height: 1.5; margin-bottom: 0;">${user.descripcion || 'Este usuario aún no ha escrito ninguna descripción en su perfil.'}</p>
</div>
`;

modal.classList.remove('hidden');
};
// =========================================================
// SISTEMA DE CONFIGURACIÓN DEL CALENDARIO
// =========================================================

window.abrirModalConfig = async () => {
    const modal = document.getElementById('modal-config');
    const container = document.getElementById('config-container');
    if (!modal || !container) return;

    modal.classList.remove('hidden');
    container.innerHTML = "<p style='text-align:center; color:#999;'><i class='fas fa-spinner fa-spin'></i> Cargando ajustes...</p>";

    try {
        // 1. Carga de datos frescos desde Firebase
        const docSnap = await getDoc(doc(db, "calendarios", calId));
        if (!docSnap.exists()) throw new Error("Calendario no encontrado");
        const datos = docSnap.data();

        // 2. Verificación de permisos (Corregido a esTitular con T mayúscula)
        const esTitular = datos.titular === idActivo;
        const esAdmin = datos.admins && datos.admins.includes(idActivo);

        if (!esTitular && !esAdmin) {
            container.innerHTML = "<p style='color:red; text-align:center;'>No tienes permisos para ver esto.</p>";
            return;
        }

        // 3. Carga de miembros
        const promesas = datos.miembros.map(mId => getDoc(doc(db, "usuarios", mId)));
        const docs = await Promise.all(promesas);
        let miembrosData = [];
        docs.forEach(d => { if (d.exists()) miembrosData.push({ id: d.id, ...d.data() }); });

        // 4. Estilos reutilizables para botones
        const btnStyle = "width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; margin-left: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white;";

        // 5. Construcción del HTML
        const requiereAprobacion = datos.requiere_aprobacion || false;
        let htmlInfo = `
        <div style="background: #fdf5f8; padding: 15px; border-radius: 12px; border: 1px solid #fce4ec; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div style="min-width: 0; flex: 1;">
                    <span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Nombre</span>
                    <div style="font-size: 16px; font-weight: bold; color: #333; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${datos.nombre || 'Sin nombre'}
                    </div>
                </div>
                <button class="btn-icono-accion" onclick="editarNombreCalendario(); document.activeElement.blur();" style="${btnStyle}">
                    <i class="fas fa-pencil-alt"></i>
                </button>
            </div>

            <hr style="border: none; border-top: 1px solid #fce4ec; margin: 12px 0;">

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="min-width: 0; flex: 1;">
                    <span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Código</span>
                    <div style="font-size: 16px; font-weight: bold; color: #ec407a; margin-top: 2px; letter-spacing: 2px;">${datos.codigo_acceso || '---'}</div>
                </div>
                <div style="display: flex; flex-shrink: 0;">
                    ${esTitular ? `
                    <button class="btn-icono-accion" onclick="generarCodigoAleatorio(); document.activeElement.blur();" style="${btnStyle}" title="Nuevo código">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="btn-icono-accion" onclick="editarCodigoInvitacion(); document.activeElement.blur();" style="${btnStyle}" title="Editar código">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    ` : '<i class="fas fa-lock" style="color:#ccc; margin-left: 10px;"></i>'}
                </div>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 12px 15px; border-radius: 12px; border: 1px solid #eee; margin-top: 10px; text-align: left;">
            <div>
                <div style="font-size: 14px; font-weight: bold; color: #333;">Privacidad</div>
                <div style="font-size: 11px; color: #999;">Requerir aprobación para unirse</div>
            </div>
            ${esTitular ? `
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
                <input type="checkbox" id="toggle-priv" ${requiereAprobacion ? 'checked' : ''} onchange="window.cambiarPrivacidad(this.checked)" style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${requiereAprobacion ? '#ec407a' : '#ccc'}; border-radius: 24px; transition: .3s;">
                    <span style="position: absolute; height: 18px; width: 18px; left: ${requiereAprobacion ? '23px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>
                </span>
            </label>
            ` : `
            <i class="fas fa-lock" style="color:#ccc; margin-left: 10px; font-size: 16px;" title="Solo el titular puede cambiar la privacidad"></i>
            `}
        </div>

        <h3 style="margin: 15px 0 -5px 0; font-size: 16px; color: #333;">Gestión de Miembros</h3>
        `;

        let htmlMiembros = `<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">`;
        miembrosData.forEach(miembro => {
            const mEsTitular = datos.titular === miembro.id;
            const mEsAdmin = datos.admins && datos.admins.includes(miembro.id);
            const soyYo = miembro.id === idActivo;
            let rolTxt = mEsTitular ? `<span style="color: #d32f2f; font-size: 11px; font-weight: bold;">Titular</span>` : mEsAdmin ? `<span style="color: #ec407a; font-size: 11px; font-weight: bold;">Administrador</span>` : `<span style="color: #999; font-size: 11px;">Miembro</span>`;

            let botonesHtml = ``;
            if (!mEsTitular && !soyYo) {
                if (esTitular) {
                    const iconoCorona = mEsAdmin ? `<i class="fas fa-user-times" style="color:#ffb300;"></i>` : `<i class="fas fa-user-shield" style="color:#ffb300;"></i>`;
                    botonesHtml += `<button class="btn-icono-accion" onclick="toggleAdmin('${miembro.id}', ${mEsAdmin}); document.activeElement.blur();" style="${btnStyle}">${iconoCorona}</button>`;
                    botonesHtml += `<button class="btn-icono-accion" onclick="expulsarMiembro('${miembro.id}', '${miembro.nombre}'); document.activeElement.blur();" style="${btnStyle} color: #ef5350;"><i class="fas fa-trash"></i></button>`;
                } else if (esAdmin && !mEsAdmin) {
                    botonesHtml += `<button class="btn-icono-accion" onclick="expulsarMiembro('${miembro.id}', '${miembro.nombre}'); document.activeElement.blur();" style="${btnStyle} color: #ef5350;"><i class="fas fa-trash"></i></button>`;
                }
            }

            htmlMiembros += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border: 1px solid #f0f0f0; border-radius: 8px;">
                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                    <span style="font-weight: bold; font-size: 14px; color: #333;">${miembro.nombre} ${miembro.apellidos || ''} ${soyYo ? '<span style="color:#ec407a;">(Tú)</span>' : ''}</span>
                    ${rolTxt}
                </div>
                <div style="display: flex; gap: 5px; flex-shrink: 0;">${botonesHtml}</div>
            </div>
            `;
        });
        htmlMiembros += `</div>`;

        let htmlZonaPeligro = ``;
        if (esTitular) {
            htmlZonaPeligro = `
            <div style="border: 1px solid #ffcdd2; background: #fff5f5; padding: 15px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                <button onclick="iniciarTraspasoTitular(); document.activeElement.blur();" style="background: white; color: #d32f2f; border: 1px solid #d32f2f; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%;">Traspasar titularidad</button>
                <button onclick="eliminarCalendarioDefinitivo(); document.activeElement.blur();" style="background: #d32f2f; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%;">Eliminar Calendario</button>
            </div>
            `;
        }

        container.innerHTML = htmlInfo + htmlMiembros + htmlZonaPeligro;

    } catch (error) {
        console.error("Error:", error);
        container.innerHTML = "<p style='color:red; text-align:center;'>Error al cargar los ajustes.</p>";
    }
};
// =========================================================
// FUNCIONALIDAD: CAMBIAR NOMBRE DEL CALENDARIO (MODAL PERSONALIZADO)
// =========================================================

window.editarNombreCalendario = () => {
    // 1. Pillamos el modal genérico que ya tienes en tu HTML
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');

    if (!modal) return;

    // 2. Obtenemos el nombre actual
    const nombreActual = datosCalendario ? datosCalendario.nombre : "";

    // 3. Montamos el diseño del modal al vuelo
    msg.innerText = "Cambiar nombre del calendario";
    
    // Metemos un input bonito que encaje con tu diseño
    extra.innerHTML = `
        <input type="text" id="input-nuevo-nombre" value="${nombreActual}" 
               style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 15px; box-sizing: border-box; outline: none; margin-bottom: 10px; font-family: inherit; color: #333;"
               placeholder="Escribe el nuevo nombre..." autocomplete="off">
        <p id="error-nombre" style="color: #ef5350; font-size: 12px; margin: 0; min-height: 15px;"></p>
    `;

    // Metemos los botones de Cancelar y Guardar con los colores de tu app
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" 
                style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Cancelar
        </button>
        <button id="btn-guardar-nombre" onclick="guardarNuevoNombreCalendario()" 
                style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Guardar
        </button>
    `;

    // 4. Mostramos el modal
    modal.classList.remove('hidden');
    
    // 5. Pequeño truco: ponemos el cursor directamente dentro del cuadro de texto
    setTimeout(() => {
        const input = document.getElementById('input-nuevo-nombre');
        if (input) {
            input.focus();
            // Esto pone el cursor al final del texto existente
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }, 100);
};

// FUNCIÓN PARA CAMBIAR EL NOMBRE AL CALENDARIO
// Esta es la función que se ejecuta al darle al botón rosa de "Guardar"
window.guardarNuevoNombreCalendario = async () => {
    const input = document.getElementById('input-nuevo-nombre');
    const errorMsg = document.getElementById('error-nombre');
    const btnGuardar = document.getElementById('btn-guardar-nombre');
    
    if (!input) return;
    
    const nuevoNombre = input.value.trim();
    
    // Validamos que no intente guardar un nombre vacío
    if (nuevoNombre === "") {
        errorMsg.innerText = "El nombre no puede estar vacío.";
        input.style.borderColor = "#ef5350"; // Borde rojo para avisar
        return;
    }

    // Efecto de carga en el botón para que el usuario sepa que está trabajando
    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    btnGuardar.style.opacity = "0.7";
    btnGuardar.disabled = true;

    try {
        // Actualizamos en Firebase
        const calRef = doc(db, "calendarios", calId);
        await updateDoc(calRef, { nombre: nuevoNombre });

        // Actualizamos en memoria
        if (datosCalendario) {
            datosCalendario.nombre = nuevoNombre;
        }

        // Actualizamos el título de la pantalla de fondo
        const tituloMain = document.getElementById('titulo-calendario');
        if (tituloMain) {
            tituloMain.innerText = nuevoNombre;
        }

        // Cerramos el modal de edición y recargamos el modal de configuración de fondo
        document.getElementById('miModal').classList.add('hidden');
        await window.abrirModalConfig();

    } catch (error) {
        console.error("Error al actualizar el nombre del calendario:", error);
        errorMsg.innerText = "Hubo un error de conexión.";
        btnGuardar.innerHTML = 'Guardar';
        btnGuardar.style.opacity = "1";
        btnGuardar.disabled = false;
    }
};

// =========================================================
// FUNCIONALIDAD: EDITAR CÓDIGO DE INVITACIÓN MANUALMENTE
// =========================================================
window.editarCodigoInvitacion = () => {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');

    if (!modal) return;

    const codigoActual = datosCalendario ? (datosCalendario.codigo_acceso || "") : "";

    msg.innerText = "Cambiar código de invitación";
    
    // CORRECCIÓN: Se quita 'text-transform: uppercase;' para permitir escribir en minúsculas nativamente
    extra.innerHTML = `
        <input type="text" id="input-nuevo-codigo" value="${codigoActual}" 
               style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 15px; box-sizing: border-box; outline: none; margin-bottom: 10px; font-family: inherit; color: #333;"
               placeholder="Mínimo 6 y máximo 10 caracteres..." autocomplete="off">
        <p id="error-codigo" style="color: #ef5350; font-size: 12px; margin: 0; min-height: 15px;"></p>
    `;

    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" 
                style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Cancelar
        </button>
        <button id="btn-guardar-codigo" onclick="guardarNuevoCodigoInvitacion()" 
                style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Guardar
        </button>
    `;

    modal.classList.remove('hidden');
    
    setTimeout(() => {
        const input = document.getElementById('input-nuevo-codigo');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }, 100);
};

// Guardar el código manual con la nueva validación de campo vacío
window.guardarNuevoCodigoInvitacion = async () => {
    const input = document.getElementById('input-nuevo-codigo');
    const errorMsg = document.getElementById('error-codigo');
    const btnGuardar = document.getElementById('btn-guardar-codigo');
    
    if (!input) return;
    
    const valorInput = input.value.trim();
    
    // CORRECCIÓN 1: Si está vacío, muestra el mensaje personalizado exacto que pides
    if (valorInput === "") {
        errorMsg.innerText = "Inserte el nuevo código de invitación.";
        input.style.borderColor = "#ef5350";
        return;
    }
    
    // Lo convertimos a mayúsculas internamente para guardarlo estandarizado en la base de datos
    const nuevoCodigo = valorInput.toUpperCase();
    
    // Validación de longitud (Mínimo 6 y máximo 10)
    if (nuevoCodigo.length < 6 || nuevoCodigo.length > 10) {
        errorMsg.innerText = "El código debe tener entre 6 y 10 caracteres.";
        input.style.borderColor = "#ef5350";
        return;
    }

    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    btnGuardar.style.opacity = "0.7";
    btnGuardar.disabled = true;

    try {
        const calRef = doc(db, "calendarios", calId);
        await updateDoc(calRef, { codigo_acceso: nuevoCodigo });

        if (datosCalendario) {
            datosCalendario.codigo_acceso = nuevoCodigo;
        }

        document.getElementById('miModal').classList.add('hidden');
        await window.abrirModalConfig();

    } catch (error) {
        console.error("Error:", error);
        errorMsg.innerText = "Hubo un error al guardar en la base de datos.";
        btnGuardar.innerHTML = 'Guardar';
        btnGuardar.style.opacity = "1";
        btnGuardar.disabled = false;
    }
};


// =========================================================
// FUNCIONALIDAD: GENERAR CÓDIGO ALEATORIO (9 DÍGITOS NUMÉRICOS)
// =========================================================
window.generarCodigoAleatorio = () => {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');

    if (!modal) return;

    msg.innerText = "¿Generar código aleatorio?";
    
    extra.innerHTML = `
        <p style="color: #666; font-size: 14px; margin: 0 0 15px 0; line-height: 1.5; text-align: left;">
            ¿Estás seguro de que quieres cambiar el código de invitación actual por un nuevo código generado de forma completamente aleatoria?
        </p>
    `;

    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" 
                style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Cancelar
        </button>
        <button id="btn-confirmar-aleatorio" onclick="confirmarCodigoAleatorio()" 
                style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Aceptar
        </button>
    `;

    modal.classList.remove('hidden');
};

// CORRECCIÓN: Ahora genera estrictamente un código NUMÉRICO de 9 dígitos
window.confirmarCodigoAleatorio = async () => {
    const btnConfirmar = document.getElementById('btn-confirmar-aleatorio');
    if (!btnConfirmar) return;

    btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
    btnConfirmar.style.opacity = "0.7";
    btnConfirmar.disabled = true;

    // Generamos un código puramente numérico de 9 dígitos (0-9)
    let codigoAleatorio = "";
    for (let i = 0; i < 9; i++) {
        codigoAleatorio += Math.floor(Math.random() * 10).toString();
    }

    try {
        const calRef = doc(db, "calendarios", calId);
        await updateDoc(calRef, { codigo_acceso: codigoAleatorio });

        if (datosCalendario) {
            datosCalendario.codigo_acceso = codigoAleatorio;
        }

        document.getElementById('miModal').classList.add('hidden');
        await window.abrirModalConfig(); // Recarga automáticamente el panel de configuración de fondo

    } catch (error) {
        console.error("Error:", error);
        alert("No se pudo generar el código aleatorio. Comprueba tu conexión.");
        btnConfirmar.innerHTML = 'Aceptar';
        btnConfirmar.style.opacity = "1";
        btnConfirmar.disabled = false;
    }
};

// =========================================================
// FUNCIONALIDAD: ASIGNAR O QUITAR ROL DE ADMINISTRADOR
// =========================================================
window.toggleAdmin = (miembroId, esAdminActual) => {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');

    if (!modal) return;

    // Cambiamos el texto dependiendo de si le vamos a dar o quitar el rol
    const accionTexto = esAdminActual ? "quitarle el rol de Administrador a" : "hacer Administrador a";
    
    msg.innerText = `¿Deseas ${accionTexto} este usuario?`;
    
    extra.innerHTML = `
        <p style="color: #666; font-size: 14px; margin: 0 0 15px 0; line-height: 1.5; text-align: left;">
            Los administradores pueden cambiar el nombre del calendario, el código de invitación y gestionar a los miembros.
        </p>
    `;

    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" 
                style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Cancelar
        </button>
        <button id="btn-confirmar-admin" onclick="confirmarToggleAdmin('${miembroId}', ${esAdminActual})" 
                style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Aceptar
        </button>
    `;

    modal.classList.remove('hidden');
};

window.confirmarToggleAdmin = async (miembroId, esAdminActual) => {
    const btnConfirmar = document.getElementById('btn-confirmar-admin');
    if (btnConfirmar) {
        btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        btnConfirmar.style.opacity = "0.7";
        btnConfirmar.disabled = true;
    }

    try {
        // Obtenemos la lista actual de administradores (o creamos una vacía si no existe)
        let adminsActuales = datosCalendario.admins || [];
        
        if (esAdminActual) {
            // Si ya es admin, lo filtramos para sacarlo de la lista
            adminsActuales = adminsActuales.filter(id => id !== miembroId);
        } else {
            // Si no es admin, lo metemos en la lista
            if (!adminsActuales.includes(miembroId)) {
                adminsActuales.push(miembroId);
            }
        }

        // Actualizamos Firebase
        const calRef = doc(db, "calendarios", calId);
        await updateDoc(calRef, { admins: adminsActuales });

        // Actualizamos la memoria local
        if (datosCalendario) {
            datosCalendario.admins = adminsActuales;
        }

        // Cerramos modal y recargamos configuración
        document.getElementById('miModal').classList.add('hidden');
        await window.abrirModalConfig();

    } catch (error) {
        console.error("Error al cambiar rol:", error);
        alert("Hubo un error al cambiar los permisos.");
        if (btnConfirmar) {
            btnConfirmar.innerHTML = 'Aceptar';
            btnConfirmar.style.opacity = "1";
            btnConfirmar.disabled = false;
        }
    }
};


// =========================================================
// FUNCIONALIDAD: ELIMINAR / EXPULSAR A UN MIEMBRO
// =========================================================
window.expulsarMiembro = (miembroId, nombreMiembro) => {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');

    if (!modal) return;

    msg.innerText = `¿Eliminar a ${nombreMiembro}?`;
    
    extra.innerHTML = `
        <p style="color: #666; font-size: 14px; margin: 0 0 15px 0; line-height: 1.5; text-align: left;">
            Estás a punto de expulsar a <strong>${nombreMiembro}</strong> del calendario. 
            Perderá el acceso y su color asignado quedará libre. ¿Deseas continuar?
        </p>
    `;

    // Usamos rojo (#ef5350) para el botón de expulsar, advirtiendo del peligro
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" 
                style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Cancelar
        </button>
        <button id="btn-confirmar-expulsion" onclick="confirmarExpulsion('${miembroId}')" 
                style="background: #ef5350; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Expulsar
        </button>
    `;

    modal.classList.remove('hidden');
};

window.confirmarExpulsion = async (miembroId) => {
    const btnConfirmar = document.getElementById('btn-confirmar-expulsion');
    if (btnConfirmar) {
        btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
        btnConfirmar.style.opacity = "0.7";
        btnConfirmar.disabled = true;
    }

    try {
        // 1. Quitarlo de la lista de miembros
        let miembrosActuales = datosCalendario.miembros || [];
        miembrosActuales = miembrosActuales.filter(id => id !== miembroId);

        // 2. Quitarlo de la lista de admins (por si era administrador)
        let adminsActuales = datosCalendario.admins || [];
        adminsActuales = adminsActuales.filter(id => id !== miembroId);

        // 3. Quitarle el color que tenía reservado para que otro lo pueda usar
        let coloresActuales = datosCalendario.colores_miembros || {};
        if (coloresActuales[miembroId]) {
            delete coloresActuales[miembroId];
        }

        // 4. Mandar la actualización completa a Firebase
        const calRef = doc(db, "calendarios", calId);
        await updateDoc(calRef, { 
            miembros: miembrosActuales,
            admins: adminsActuales,
            colores_miembros: coloresActuales
        });

        // 5. Actualizar la memoria local para no tener que refrescar toda la página
        if (datosCalendario) {
            datosCalendario.miembros = miembrosActuales;
            datosCalendario.admins = adminsActuales;
            datosCalendario.colores_miembros = coloresActuales;
            mapaColores = coloresActuales; // ¡Sincronizamos la variable global de colores!
        }

        document.getElementById('miModal').classList.add('hidden');
        
        // 6. Recargamos la configuración para que el miembro desaparezca de la lista
        await window.abrirModalConfig();
        
        // 7. Recargamos el calendario de fondo para que desaparezcan sus estrellas/eventos
        renderizarCalendario(); 

    } catch (error) {
        console.error("Error al expulsar miembro:", error);
        alert("Hubo un error al intentar eliminar al miembro.");
        if (btnConfirmar) {
            btnConfirmar.innerHTML = 'Expulsar';
            btnConfirmar.style.opacity = "1";
            btnConfirmar.disabled = false;
        }
    }
};

// =========================================================
// FUNCIONALIDAD: TRASPASAR TITULARIDAD DEL CALENDARIO
// =========================================================
window.iniciarTraspasoTitular = async () => {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');

    if (!modal) return;

    msg.innerText = "Traspasar titularidad del calendario";
    
    // Mostramos un spinner de carga dentro del modal mientras leemos los nombres de los miembros
    extra.innerHTML = "<p style='text-align:center; color:#999;'><i class='fas fa-spinner fa-spin'></i> Cargando miembros del equipo...</p>";
    
    // El botón de aceptar empieza deshabilitado (disabled) y con opacidad reducida hasta que elijan a alguien
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" 
                style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            Cancelar
        </button>
        <button id="btn-ejecutar-traspaso" disabled 
                style="background: #ef5350; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: default; transition: 0.2s; opacity: 0.5;">
            Confirmar
        </button>
    `;
    
    modal.classList.remove('hidden');

    try {
        // Cargamos los datos de todos los miembros para poder mostrar sus nombres reales
        const promesas = datosCalendario.miembros.map(mId => getDoc(doc(db, "usuarios", mId)));
        const docs = await Promise.all(promesas);
        
        let miembrosCandidatos = [];
        docs.forEach(d => {
            // SÓLO añadimos a los miembros que NO sean el usuario activo actual (tú no te puedes traspasar a ti mismo)
            if (d.exists() && d.id !== idActivo) {
                miembrosCandidatos.push({ id: d.id, ...d.data() });
            }
        });

        // Si no hay más miembros en el calendario, avisamos de que es imposible realizar el traspaso
        if (miembrosCandidatos.length === 0) {
            extra.innerHTML = `
                <p style="color: #ef5350; font-size: 14px; line-height: 1.5; margin: 0; text-align: left;">
                    No puedes traspasar la titularidad porque eres el único miembro actual de este calendario.
                </p>
            `;
            return;
        }

        // Construimos el aviso de peligro y la lista seleccionable
        let htmlContenido = `
            <p style="color: #ef5350; font-weight: bold; font-size: 13px; margin: 0 0 12px 0; text-align: left; line-height: 1.4;">
                <i class="fas fa-exclamation-triangle"></i> ¡ATENCIÓN! Al aceptar, cederás todos tus derechos de titular, serás ELIMINADO de este calendario inmediatamente y perderás el acceso al mismo.
            </p>
            <p style="color: #666; font-size: 13px; margin: 0 0 10px 0; text-align: left;">
                Selecciona al nuevo titular del calendario:
            </p>
            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; padding-right: 5px; text-align: left;">
        `;

        miembrosCandidatos.forEach(miembro => {
            // El truco de usar input type="radio" con el mismo 'name' garantiza que SÓLO SE PUEDA SELECCIONAR UNO
            htmlContenido += `
                <label style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 15px; border: 1px solid #eee; border-radius: 8px; cursor: pointer; background: #fafafa;">
                    <span style="font-size: 14px; font-weight: bold; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                        ${miembro.nombre} ${miembro.apellidos || ''}
                    </span>
                    <input type="radio" name="radio-nuevo-titular" value="${miembro.id}" onchange="window.desbloquearBotonTraspaso()" style="accent-color: #ec407a; cursor: pointer; width: 18px; height: 18px; margin: 0; flex-shrink: 0; outline: none;">
                </label>
            `;
        });

        htmlContenido += `</div>`;
        extra.innerHTML = htmlContenido;

    } catch (error) {
        console.error("Error al preparar el traspaso:", error);
        extra.innerHTML = "<p style='color:red; text-align:center;'>Error al cargar los miembros.</p>";
    }
};

// Esta función se ejecuta en tiempo real en cuanto el usuario marca un radio button de la lista
window.desbloquearBotonTraspaso = () => {
    const btn = document.getElementById('btn-ejecutar-traspaso');
    if (!btn) return;

    // Conseguimos el ID del usuario seleccionado en los radio buttons
    const seleccionado = document.querySelector('input[name="radio-nuevo-titular"]:checked');
    
    if (seleccionado) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
        // Vinculamos la ejecución final pasándole el ID elegido
        btn.onclick = () => window.procesarTraspasoTitularDefinitivo(seleccionado.value);
    }
};

// La ejecución crítica en Firebase al pulsar "Confirmar Traspaso"
window.procesarTraspasoTitularDefinitivo = async (nuevoTitularId) => {
    const btn = document.getElementById('btn-ejecutar-traspaso');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traspasando...';
        btn.disabled = true;
        btn.style.opacity = "0.7";
    }

    try {
        // 1. Te eliminamos de la lista general de miembros del calendario
        let miembrosActuales = datosCalendario.miembros || [];
        miembrosActuales = miembrosActuales.filter(id => id !== idActivo);

        // 2. Te eliminamos de la lista de administradores por si acaso estabas metido en ella
        let adminsActuales = datosCalendario.admins || [];
        adminsActuales = adminsActuales.filter(id => id !== idActivo);

        // 3. Eliminamos tu color asignado del mapa para dejarlo libre
        let coloresActuales = datosCalendario.colores_miembros || {};
        if (coloresActuales[idActivo]) {
            delete coloresActuales[idActivo];
        }

        // 4. Subimos los datos limpios a Firebase Firestore sustituyendo 'creador' por 'titular' como me pediste
        const calRef = doc(db, "calendarios", calId);
        await updateDoc(calRef, {
            titular: nuevoTitularId, // <-- Modificado con tu nuevo campo 'titular'
            miembros: miembrosActuales,
            admins: adminsActuales,
            colores_miembros: coloresActuales
        });

        // 5. Cerramos los modales visuales para que no parpadee la interfaz
        document.getElementById('miModal').classList.add('hidden');
        document.getElementById('modal-config').classList.add('hidden');

        // 6. ¡Redirección obligatoria! Como ya no eres parte del calendario, volvemos a la pantalla principal
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Error crítico durante el traspaso de titularidad:", error);
        alert("Hubo un error de conexión al intentar procesar el traspaso.");
        if (btn) {
            btn.innerHTML = 'Confirmar Traspaso';
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
};

// =========================================================
// FUNCIONALIDAD: ELIMINAR CALENDARIO DEFINITIVAMENTE
// =========================================================
window.eliminarCalendarioDefinitivo = () => {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');

    if (!modal) return;

    msg.innerText = "¿Eliminar este calendario?";
    
    // Diseño del aviso de peligro con enfoque de advertencia crítica
    extra.innerHTML = `
        <p style="color: #ef5350; font-weight: bold; font-size: 14px; margin: 0 0 12px 0; text-align: left; line-height: 1.4;">
            <i class="fas fa-exclamation-triangle"></i> ¡ATENCIÓN! Esta acción es irreversible. 
        </p>
        <p style="color: #666; font-size: 13px; margin: 0; text-align: left; line-height: 1.5;">
            Al confirmar, este calendario se borrará de forma permanente de la base de datos. 
            Implica la pérdida total de los datos asociados y se eliminará el acceso tanto para ti como para todos los demás miembros del equipo.
        </p>
    `;

    // Botón de cancelar gris y botón de acción destructiva en rojo oscuro (#d32f2f)
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" 
                style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; outline: none;">
            Cancelar
        </button>
        <button id="btn-borrar-calendario-ok" onclick="window.procesarBorradoCalendarioTotal()" 
                style="background: #d32f2f; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; outline: none;">
            Eliminar
        </button>
    `;

    modal.classList.remove('hidden');
};

// Ejecución del borrado en la base de datos de Firebase Firestore
window.procesarBorradoCalendarioTotal = async () => {
    const btn = document.getElementById('btn-borrar-calendario-ok');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
        btn.disabled = true;
        btn.style.opacity = "0.7";
    }

    try {
        // 1. Eliminamos físicamente el documento usando tu calId y db globales
        const calRef = doc(db, "calendarios", calId);
        await deleteDoc(calRef);

        // 2. Limpiamos la memoria del navegador por seguridad
        localStorage.removeItem('calendario_activo');

        // 3. Ocultamos los contenedores de los modales para evitar saltos visuales
        document.getElementById('miModal').classList.add('hidden');
        document.getElementById('modal-config').classList.add('hidden');
        
        // 4. Redirección automática hacia la pantalla de inicio
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Error crítico al eliminar el calendario:", error);
        alert("Hubo un problema de conexión al intentar eliminar el calendario.");
        if (btn) {
            btn.innerHTML = 'Eliminar definitivamente';
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
};

// =========================================================
// FUNCIONALIDAD: GESTIÓN DEL BUZÓN DE SOLICITUDES PENDIENTES
// =========================================================
window.abrirModalSolicitudes = async () => {
    const modal = document.getElementById('modal-solicitudes');
    const container = document.getElementById('lista-solicitudes-container');
    if (!modal || !container) return;

    container.innerHTML = "<p style='text-align:center; color:#999; margin-top:20px;'><i class='fas fa-spinner fa-spin'></i> Cargando solicitudes...</p>";
    modal.classList.remove('hidden');

    try {
        // Leemos las solicitudes actuales del calendario directamente de memoria
        const listaSolicitudes = datosCalendario.solicitudes || [];

        if (listaSolicitudes.length === 0) {
            container.innerHTML = "<p style='text-align:center; color:#888; margin-top:40px;'>No hay solicitudes pendientes</p>";
            return;
        }

        // Cargamos los perfiles de los usuarios que están pidiendo entrar
        const promesas = listaSolicitudes.map(mId => getDoc(doc(db, "usuarios", mId)));
        const docs = await Promise.all(promesas);

        container.innerHTML = "";

        docs.forEach(d => {
            if (d.exists()) {
                const usuario = d.data();
                const fotoHtml = usuario.foto
                    ? `<img src="${usuario.foto}" class="miembro-foto">`
                    : `<div class="miembro-foto"><i class="fas fa-user"></i></div>`;

                const row = document.createElement('div');
                row.className = "miembro-row";
               row.innerHTML = `
                    <div class="miembro-info">
                        ${fotoHtml}
                        <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
                            <span class="miembro-nombre">${usuario.nombre} ${usuario.apellidos || ''}</span>
                            <span style="color:#999; font-size:11px;">Desea unirse</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center;">
                        <button class="btn-icono-accion" onclick="window.rechazarSolicitud('${d.id}')" style="color: #ef5350; width:32px; height:32px; border: 1px solid #ddd; border-radius:6px; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0;"><i class="fas fa-times"></i></button>
                        <button class="btn-icono-accion" onclick="window.aceptarSolicitud('${d.id}')" style="color: #4CAF50; width:32px; height:32px; border: 1px solid #ddd; border-radius:6px; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0;"><i class="fas fa-check"></i></button>
                    </div>
                `;
                container.appendChild(row);
            }
        });
    } catch (error) {
        console.error("Error al cargar solicitudes:", error);
        container.innerHTML = "<p style='color:red; text-align:center;'>Error al cargar las solicitudes.</p>";
    }
};

window.cerrarModalSolicitudes = () => {
    document.getElementById('modal-solicitudes').classList.add('hidden');
};

window.aceptarSolicitud = async (solicitanteId) => {
    try {
        const calRef = doc(db, "calendarios", calId);
        
        // Pasamos al usuario de 'solicitudes' a 'miembros' en Firebase
        await updateDoc(calRef, {
            miembros: arrayUnion(solicitanteId),
            solicitudes: arrayRemove(solicitanteId)
        });

        // Sincronizamos en memoria local
        datosCalendario.miembros.push(solicitanteId);
        datosCalendario.solicitudes = datosCalendario.solicitudes.filter(id => id !== solicitanteId);

        // Volvemos a asegurar los colores y refrescar vistas
        await asegurarColoresMiembros();
        await window.abrirModalSolicitudes(); // Refresca la lista de la modal
        await inicializarCalendario();       // Refresca el botón del buzón y puntito rojo
        
    } catch (error) {
        console.error("Error al aceptar solicitud:", error);
    }
};

window.rechazarSolicitud = async (solicitanteId) => {
    try {
        const calRef = doc(db, "calendarios", calId);
        
        // Simplemente lo quitamos del array de solicitudes
        await updateDoc(calRef, {
            solicitudes: arrayRemove(solicitanteId)
        });

        // Sincronizamos en memoria local
        datosCalendario.solicitudes = datosCalendario.solicitudes.filter(id => id !== solicitanteId);

        await window.abrirModalSolicitudes();
        await inicializarCalendario();
        
    } catch (error) {
        console.error("Error al rechazar solicitud:", error);
    }
};
