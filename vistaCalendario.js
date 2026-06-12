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

document.addEventListener('DOMContentLoaded', async () => {
    if (!idActivo || !calId) {
        window.location.href = "dashboard.html";
        return;
    }
    
    await inicializarCalendario();
    configurarControles();
});

async function inicializarCalendario() {
    try {
        const docSnap = await getDoc(doc(db, "calendarios", calId));
        if (docSnap.exists()) {
            datosCalendario = docSnap.data();
            document.getElementById('titulo-calendario').innerText = datosCalendario.nombre;
            
            // Asignar colores a los miembros si no los tienen
            await asegurarColoresMiembros();
            
            // Dibujamos la cuadrícula del mes
            renderizarMes();
            
            // Si el perfil activo es creador o admin, mostramos el botón del engranaje
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
    
    // Lista de colores que ya están pillados
    let coloresUsados = Object.values(mapaColores);
    
    // Revisamos cada miembro
    datosCalendario.miembros.forEach(miembroId => {
        if (!mapaColores[miembroId]) {
            // Buscamos el primer color que no esté usado
            const colorLibre = COLORES_DISPONIBLES.find(c => !coloresUsados.includes(c)) || 'c-negro'; 
            mapaColores[miembroId] = colorLibre;
            coloresUsados.push(colorLibre);
            necesitaActualizar = true;
        }
    });

    // Si hemos asignado colores nuevos, los guardamos en Firebase para que todos vean lo mismo
    if (necesitaActualizar) {
        await updateDoc(doc(db, "calendarios", calId), {
            colores_miembros: mapaColores
        });
        datosCalendario.colores_miembros = mapaColores;
    }
}

function configurarControles() {
    // Botones de Anterior / Siguiente Mes
    document.getElementById('btn-prev').onclick = () => {
        fechaVisualizada.setMonth(fechaVisualizada.getMonth() - 1);
        renderizarMes();
    };
    
    document.getElementById('btn-next').onclick = () => {
        fechaVisualizada.setMonth(fechaVisualizada.getMonth() + 1);
        renderizarMes();
    };
    
    // (Próximamente: configuración de vista semanal)
}

function renderizarMes() {
    const contenedorDias = document.getElementById('calendar-grid');
    const displayMes = document.getElementById('mes-actual-display');
    contenedorDias.innerHTML = "";
    
    const anio = fechaVisualizada.getFullYear();
    const mes = fechaVisualizada.getMonth();
    
    // Título del mes (Ej: "Junio 2026")
    displayMes.innerText = fechaVisualizada.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    
    // Calculamos los días del mes
    const primerDiaDelMes = new Date(anio, mes, 1);
    const ultimoDiaDelMes = new Date(anio, mes + 1, 0);
    
    // Ajustar para que la semana empiece en Lunes (0 = Lunes, 6 = Domingo)
    let diaSemanaInicio = primerDiaDelMes.getDay() - 1;
    if (diaSemanaInicio === -1) diaSemanaInicio = 6; // El domingo es 0 en JS, lo pasamos al 6
    
    // 1. Rellenar huecos vacíos antes del primer día del mes
    for (let i = 0; i < diaSemanaInicio; i++) {
        const celdaVacia = document.createElement('div');
        celdaVacia.className = "day-cell day-other-month";
        contenedorDias.appendChild(celdaVacia);
    }
    
    // 2. Rellenar los días reales del mes
    for (let dia = 1; dia <= ultimoDiaDelMes.getDate(); dia++) {
        const celda = document.createElement('div');
        celda.className = "day-cell";
        
        // Comprobamos si es hoy o es pasado
        const fechaCelda = new Date(anio, mes, dia);
        
        // Truco para comparar fechas sin horas
        const fechaCeldaStr = fechaCelda.toDateString();
        const hoyStr = HOY_REAL.toDateString();
        
        if (fechaCelda < new Date(HOY_REAL.getFullYear(), HOY_REAL.getMonth(), HOY_REAL.getDate())) {
            celda.classList.add('day-past');
        }
        if (fechaCeldaStr === hoyStr) {
            celda.classList.add('day-today');
        }
        
        // Estructura interna de la celda
        celda.innerHTML = `
            <div class="day-number">${dia}</div>
            <div class="stars-grid" id="estrellas-${anio}-${mes+1}-${dia}">
                </div>
        `;
        
        // Evento al hacer clic en un día
        celda.onclick = () => {
            abrirDetalleDia(fechaCelda);
        };
        
        contenedorDias.appendChild(celda);
    }
}

function abrirDetalleDia(fecha) {
    // Esta función la desarrollaremos en el próximo paso
    console.log("Día clickeado:", fecha.toLocaleDateString());
}
