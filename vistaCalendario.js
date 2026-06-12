import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const idActivo = localStorage.getItem('usuario_activo');
const calId = localStorage.getItem('calendario_activo');

// Variables de estado
let fechaVisualizada = new Date(); // Fecha de referencia para pintar
const HOY_REAL = new Date(); // Hoy inmutable
let datosCalendario = null;
let mapaColores = {};
let vistaActual = "mes"; // Puede ser "mes" o "semana"

const COLORES_DISPONIBLES = ['c-azul', 'c-naranja', 'c-rojo', 'c-verde', 'c-morado', 'c-rosa', 'c-marron', 'c-amarillo', 'c-negro'];

document.addEventListener('DOMContentLoaded', async () => {
    if (!idActivo || !calId) { window.location.href = "dashboard.html"; return; }
    
    // Forzamos que al arrancar, el estado inicial de fechaVisualizada sea Hoy
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
        
        // Pintamos el indicador de color del perfil activo en la barra superior
        const miColor = mapaColores[idActivo] || 'c-negro';
        const ind = document.getElementById('user-color-indicator');
        if(ind) ind.className = `color-dot-indicator bg-${miColor}`;
        
        renderizarCalendario();
        
        if (datosCalendario.creador === idActivo || (datosCalendario.admins && datosCalendario.admins.includes(idActivo))) {
            document.getElementById('btn-config').classList.remove('hidden');
            // Quitar el foco a los botones de config y miembros en móviles
            document.getElementById('btn-miembros').onclick = function() { this.blur(); };
            document.getElementById('btn-config').onclick = function() { this.blur(); };
        }
    } else {
        window.location.href = "dashboard.html";
    }
}

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
    // Control de flecha Anterior
    document.getElementById('btn-prev').onclick = function() {
        this.blur();
        if (vistaActual === "mes") {
            if (fechaVisualizada.getFullYear() === HOY_REAL.getFullYear() && fechaVisualizada.getMonth() === HOY_REAL.getMonth()) return;
            fechaVisualizada.setMonth(fechaVisualizada.getMonth() - 1);
        } else {
            // En vista semanal restamos 7 días, pero protegemos que no baje de la semana actual
            const copia = new Date(fechaVisualizada);
            copia.setDate(copia.getDate() - 7);
            if (obtenerLunes(copia) < obtenerLunes(HOY_REAL)) return;
            fechaVisualizada.setDate(fechaVisualizada.getDate() - 7);
        }
        renderizarCalendario();
    };
    
    // Control de flecha Siguiente
    document.getElementById('btn-next').onclick = function() {
        this.blur();
        if (vistaActual === "mes") {
            fechaVisualizada.setMonth(fechaVisualizada.getMonth() + 1);
        } else {
            fechaVisualizada.setDate(fechaVisualizada.getDate() + 7);
        }
        renderizarCalendario();
    };

    // Pestaña Vista Mensual
    document.getElementById('btn-vista-mes').onclick = function() {
        this.blur();
        if (vistaActual === "mes") return;
        vistaActual = "mes";
        document.getElementById('btn-vista-semana').classList.remove('active');
        this.classList.add('active');
        // Reajustamos la fecha al mes corriente si nos hemos movido de forma rara
        fechaVisualizada = new Date(fechaVisualizada.getFullYear(), fechaVisualizada.getMonth(), 1);
        renderizarCalendario();
    };

    // Pestaña Vista Semanal
    document.getElementById('btn-vista-semana').onclick = function() {
        this.blur();
        if (vistaActual === "semana") return;
        vistaActual = "semana";
        document.getElementById('btn-vista-mes').classList.remove('active');
        this.classList.add('active');
        renderizarCalendario();
    };
}

// Herramienta matemática para buscar el lunes de cualquier semana
function obtenerLunes(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

function renderizarCalendario() {
    if (vistaActual === "mes") {
        renderizarMes();
    } else {
        renderizarSemana();
    }
}

function renderizarMes() {
    const grid = document.getElementById('calendar-grid');
    const header = document.getElementById('dias-header');
    const display = document.getElementById('mes-actual-display');
    if(!grid || !header || !display) return;

    // Reset de clases de cuadrícula completa de mes
    header.classList.remove('vista-semanal-activa', 'vista-semanal-grid-header');
    grid.classList.remove('vista-semanal-grid-body');
    
    header.innerHTML = "<div>LUN</div><div>MAR</div><div>MIÉ</div><div>JUE</div><div>VIE</div><div>SÁB</div><div>DOM</div>";
    grid.innerHTML = "";

    const anio = fechaVisualizada.getFullYear();
    const mes = fechaVisualizada.getMonth();
    
    display.innerText = fechaVisualizada.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    
    // Comprobación de bloqueo de botón atrás
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
    
    for (let i = 0; i < diaSemInicio; i++) {
        const celda = document.createElement('div');
        celda.className = "day-cell day-other-month day-past";
        const diaPasado = (ultimoDiaPasado.getDate() - diaSemInicio + 1) + i;
        celda.innerHTML = `<div class="day-number">${diaPasado}</div><div class="stars-grid"></div>`;
        grid.appendChild(celda);
    }
    
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
        const celda = document.createElement('div');
        celda.className = "day-cell";
        
        const fCelda = new Date(anio, mes, dia);
        if (fCelda < new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(), HOY_REAL.getDate())) celda.classList.add('day-past');
        if (fCelda.toDateString() === HOY_REAL.toDateString()) celda.classList.add('day-today');
        
        celda.innerHTML = `<div class="day-number">${dia}</div><div class="stars-grid" id="estrellas-${anio}-${mes+1}-${dia}"></div>`;
        celda.onclick = () => abrirDetalleDia(fCelda);
        grid.appendChild(celda);
    }
    
    const generadas = diaSemInicio + ultimoDia.getDate();
    if (generadas < 42) {
        for (let j = 1; j <= (42 - generadas); j++) {
            const celdaVacia = document.createElement('div');
            celdaVacia.className = "day-cell day-other-month";
            celdaVacia.innerHTML = `<div class="day-number">${j}</div><div class="stars-grid"></div>`;
            grid.appendChild(celdaVacia);
        }
    }
}

function renderizarSemana() {
    const grid = document.getElementById('calendar-grid');
    const header = document.getElementById('dias-header');
    const display = document.getElementById('mes-actual-display');
    if(!grid || !header || !display) return;

    // Inyectamos las clases CSS para encoger la cuadrícula a 5 columnas fijas de lunes a viernes
    header.className = "dias-semana-header vista-semanal-grid-header";
    grid.className = "calendar-grid vista-semanal-grid-body";
    
    header.innerHTML = "<div>LUN</div><div>MAR</div><div>MIÉ</div><div>JUE</div><div>VIE</div>";
    grid.innerHTML = "";

    // Buscamos el lunes de la semana que se está visualizando
    let lunes = obtenerLunes(fechaVisualizada);
    
    // Ponemos como título el rango de fechas o el mes principal de la semana
    display.innerText = "Semana del " + lunes.toLocaleDateString('es-ES', {day:'numeric', month:'short'});

    // Capamos el botón atrás si el lunes visualizado es igual o menor al lunes de la semana actual real
    const btnPrev = document.getElementById('btn-prev');
    const esSemanaActual = lunes.toDateString() === obtenerLunes(HOY_REAL).toDateString();
    btnPrev.disabled = esSemanaActual;
    btnPrev.style.opacity = esSemanaActual ? "0.3" : "1";
    btnPrev.style.cursor = esSemanaActual ? "default" : "pointer";

    // Pintamos únicamente las 5 casillas: Lunes, Martes, Miércoles, Jueves y Viernes
    for (let i = 0; i < 5; i++) {
        const diaSemana = new Date(lunes);
        diaSemana.setDate(lunes.getDate() + i);
        
        const celda = document.createElement('div');
        celda.className = "day-cell";
        
        if (diaSemana < new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(), HOY_REAL.getDate())) celda.classList.add('day-past');
        if (diaSemana.toDateString() === HOY_REAL.toDateString()) celda.classList.add('day-today');
        
        celda.innerHTML = `
            <div class="day-number">${diaSemana.getDate()} <span style="font-size:10px; color:#aaa; font-weight:normal;">${diaSemana.toLocaleDateString('es-ES', {month:'short'})}</span></div>
            <div class="stars-grid" id="estrellas-${diaSemana.getFullYear()}-${diaSemana.getMonth()+1}-${diaSemana.getDate()}"></div>
        `;
        
        celda.onclick = () => abrirDetalleDia(diaSemana);
        grid.appendChild(celda);
    }
}

function abrirDetalleDia(fecha) {
    console.log("Día clickeado:", fecha.toLocaleDateString());
}
