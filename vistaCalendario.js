import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const idActivo = localStorage.getItem('usuario_activo');
const calId = localStorage.getItem('calendario_activo');

// Variables de estado
let fechaVisualizada = new Date(); // El mes que estamos viendo
const HOY_REAL = new Date(); // La fecha de hoy inmutable
let datosCalendario = null;
let mapaColores = {}; // Guardará qué color tiene cada miembro { 'id': 'c-rojo' }

// Colores disponibles (máx 9)
const COLORES_DISPONIBLES = ['c-azul', 'c-naranja', 'c-rojo', 'c-verde', 'c-morado', 'c-rosa', 'c-marron', 'c-amarillo', 'c-negro'];

// Funciones globales de carga
window.mostrarCarga = () => { const el = document.getElementById('pantalla-carga'); if(el) el.classList.remove('hidden'); };
window.ocultarCarga = () => { const el = document.getElementById('pantalla-carga'); if(el) el.classList.add('hidden'); };

document.addEventListener('DOMContentLoaded', async () => {
    if (!idActivo || !calId) {
        window.location.href = "dashboard.html";
        return;
    }
    
    window.mostrarCarga();
    try {
        await inicializarCalendario();
        configurarControles();
    } catch (error) {
        console.error("Error al cargar la página:", error);
    } finally {
        window.ocultarCarga();
    }
});

async function inicializarCalendario() {
    try {
        const docSnap = await getDoc(doc(db, "calendarios", calId));
        if (docSnap.exists()) {
            datosCalendario = docSnap.data();
            
            // EL TÍTULO SE PINTA EN SU NUEVA UBICACIÓN
            document.getElementById('titulo-calendario').innerText = datosCalendario.nombre;
            
            await asegurarColoresMiembros();
            renderizarMes();
            
            if (datosCalendario.creador === idActivo || (datosCalendario.admins && datosCalendario.admins.includes(idActivo))) {
                document.getElementById('btn-config').classList.remove('hidden');
            }
        } else {
            alert("El calendario no existe.");
            window.location.href = "dashboard.html";
        }
    } catch (error) {
        console.error("Error al cargar el calendario:", error);
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
        this.blur(); // ¡Esto evita que el botón se quede "clicado"!
        fechaVisualizada.setMonth(fechaVisualizada.getMonth() - 1);
        renderizarMes();
    };
    
    document.getElementById('btn-next').onclick = function() {
        this.blur(); // ¡Esto evita que el botón se quede "clicado"!
        fechaVisualizada.setMonth(fechaVisualizada.getMonth() + 1);
        renderizarMes();
    };
}

function renderizarMes() {
    const contenedorDias = document.getElementById('calendar-grid');
    const displayMes = document.getElementById('mes-actual-display');
    if(!contenedorDias || !displayMes) return;
    contenedorDias.innerHTML = "";
    
    const anio = fechaVisualizada.getFullYear();
    const mes = fechaVisualizada.getMonth();
    
    displayMes.innerText = fechaVisualizada.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    
    const primerDiaDelMes = new Date(anio, mes, 1);
    const ultimoDiaDelMes = new Date(anio, mes + 1, 0);
    const ultimoDiaDeMesPasado = new Date(anio, mes, 0);
    
    let diaSemanaInicio = primerDiaDelMes.getDay() - 1;
    if (diaSemanaInicio === -1) diaSemanaInicio = 6;
    
    // 1. Rellenar huecos vacíos antes del primer día del mes (Días de mes pasado)
    for (let i = 0; i < diaSemanaInicio; i++) {
        const celda = document.createElement('div');
        celda.className = "day-cell day-other-month day-past";
        const diaPasado = (ultimoDiaDeMesPasado.getDate() - diaSemanaInicio + 1) + i;
        celda.innerHTML = `<div class="day-number">${diaPasado}</div><div class="stars-grid"></div>`;
        contenedorDias.appendChild(celda);
    }
    
    // 2. Rellenar los días reales del mes
    for (let dia = 1; dia <= ultimoDiaDelMes.getDate(); dia++) {
        const celda = document.createElement('div');
        celda.className = "day-cell";
        
        const fechaCelda = new Date(anio, mes, dia);
        const fechaCeldaStr = fechaCelda.toDateString();
        const hoyStr = HOY_REAL.toDateString();
        
        if (fechaCelda < new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(), HOY_REAL.getDate())) {
            celda.classList.add('day-past');
        }
        if (fechaCeldaStr === hoyStr) {
            celda.classList.add('day-today');
        }
        
        celda.innerHTML = `
            <div class="day-number">${dia}</div>
            <div class="stars-grid" id="estrellas-${anio}-${mes+1}-${dia}">
                </div>
        `;
        
        celda.onclick = () => {
            abrirDetalleDia(fechaCelda);
        };
        
        contenedorDias.appendChild(celda);
    }
    
    // NUEVO: 3. Rellenar hasta completar las 6 filas fijas del CSS (42 celdas)
    // Esto es vital para que la vista full-height no se rompa visualmente.
    const celdasGeneradas = diaSemanaInicio + ultimoDiaDelMes.getDate();
    const celdasTotales = 42; // 6 semanas * 7 dias
    
    if (celdasGeneradas < celdasTotales) {
        for (let j = 1; j <= (celdasTotales - celdasGeneradas); j++) {
            const celdaVacia = document.createElement('div');
            // Como el CSS tiene 6 rows fijas, si no rellenamos, la cuadrícula se verá rota
            celdaVacia.className = "day-cell day-other-month"; 
            celdaVacia.innerHTML = `<div class="day-number">${j}</div><div class="stars-grid"></div>`;
            contenedorDias.appendChild(celdaVacia);
        }
    }
}

function abrirDetalleDia(fecha) {
    console.log("Día clickeado:", fecha.toLocaleDateString());
}
