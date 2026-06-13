import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const idActivo = localStorage.getItem('usuario_activo');
const calId = localStorage.getItem('calendario_activo');

let fechaVisualizada = new Date(); 
const HOY_REAL = new Date(); 
let datosCalendario = null;
let mapaColores = {};
let vistaActual = "mes"; 

const COLORES_DISPONIBLES = ['c-azul', 'c-naranja', 'c-rojo', 'c-verde', 'c-morado', 'c-rosa', 'c-marron', 'c-amarillo', 'c-negro'];

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
        
        if (datosCalendario.creador === idActivo || (datosCalendario.admins && datosCalendario.admins.includes(idActivo))) {
            document.getElementById('btn-config').classList.remove('hidden');
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
    document.getElementById('btn-prev').onclick = function() {
        this.blur();
        if (vistaActual === "mes") {
            if (fechaVisualizada.getFullYear() === HOY_REAL.getFullYear() && fechaVisualizada.getMonth() === HOY_REAL.getMonth()) return;
            fechaVisualizada.setMonth(fechaVisualizada.getMonth() - 1);
        } else {
            // Comprobación de seguridad para no retroceder de la semana actual
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

// Función matemática corregida e infalible para calcular el lunes de la semana actual
function obtenerLunes(d) {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    
    // En JS: Dom=0, Lun=1, Mar=2, Mié=3, Jue=4, Vie=5, Sáb=6
    // Queremos saber cuántos días restar para volver al Lunes (donde Lunes = 0 días de resta)
    const diasPorRestar = (day === 0) ? 6 : day - 1;
    
    date.setDate(date.getDate() - diasPorRestar);
    return date;
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

    // Restauramos formato de Mes
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

    // Ocultamos la cabecera estándar de días porque los inyectaremos nosotros
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

    // Creamos los dos contenedores de filas
    const fila1 = document.createElement('div');
    fila1.className = "semana-fila-1";
    const fila2 = document.createElement('div');
    fila2.className = "semana-fila-2";

    const nombresDias = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

    // Pintamos los 7 días
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
        celda.style.flex = "1"; // Ocupa todo el alto de su fila
        
        if (diaSemana < new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(), HOY_REAL.getDate())) celda.classList.add('day-past');
        if (diaSemana.toDateString() === HOY_REAL.toDateString()) celda.classList.add('day-today');
        
        celda.innerHTML = `
            <div class="day-number">${diaSemana.getDate()} <span style="font-size:10px; color:#aaa; font-weight:normal;">${diaSemana.toLocaleDateString('es-ES', {month:'short'})}</span></div>
            <div class="stars-grid" id="estrellas-${diaSemana.getFullYear()}-${diaSemana.getMonth()+1}-${diaSemana.getDate()}"></div>
        `;
        
        celda.onclick = () => abrirDetalleDia(diaSemana);
        
        wrapper.appendChild(headerDia);
        wrapper.appendChild(celda);

        // Repartimos: L-V a la fila 1, S-D a la fila 2
        if (i < 5) fila1.appendChild(wrapper);
        else fila2.appendChild(wrapper);
    }

    grid.appendChild(fila1);
    grid.appendChild(fila2);
}

function abrirDetalleDia(fecha) {
    console.log("Día clickeado:", fecha.toLocaleDateString());
}
