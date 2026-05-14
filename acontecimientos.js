import { db } from "./firebase-config.js";
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const miID = localStorage.getItem('usuario_activo');
let userJobs = [];
let selectedDays = []; // Para repetir semanalmente
let eventosCargados = [];
let paginaActual = 1;
const itemsPorPagina = 10;
let editandoID = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!miID) window.location.href = "index.html";
    
    await cargarDatosUsuario();
    await cargarAcontecimientos();
    configurarSelectorSemanal();
});

// 1. Cargar trabajos del perfil para el desplegable
async function cargarDatosUsuario() {
    const docRef = doc(db, "usuarios", miID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('header-usuario').innerText = `${data.nombre} ${data.apellidos}`;
        userJobs = data.trabajos || [];
    }
}

// 2. Lógica de los desplegables dinámicos
window.toggleTipoDetalle = () => {
    const tipo = document.getElementById('ev-tipo').value;
    const divTrabajo = document.getElementById('div-trabajo');
    const divOtro = document.getElementById('div-otro');
    const selectTrabajo = document.getElementById('ev-trabajo-select');
    const aviso = document.getElementById('aviso-trabajo');

    divTrabajo.classList.add('hidden');
    divOtro.classList.add('hidden');

    if (tipo === "Trabajo") {
        divTrabajo.classList.remove('hidden');
        selectTrabajo.innerHTML = "";
        if (userJobs.length === 0) {
            aviso.classList.remove('hidden');
        } else {
            aviso.classList.add('hidden');
            userJobs.forEach(j => {
                let opt = document.createElement('option');
                opt.value = j; opt.innerText = j;
                selectTrabajo.appendChild(opt);
            });
        }
    } else if (tipo === "Otro") {
        divOtro.classList.remove('hidden');
    }
};

window.toggleFechaDetalle = () => {
    const tipo = document.getElementById('ev-fecha-tipo').value;
    document.querySelectorAll('.fecha-seccion').forEach(s => s.classList.add('hidden'));
    document.getElementById(`fecha-${tipo}`).classList.remove('hidden');
};

// 3. Configurar el selector de días de la semana (L, M, X...)
function configurarSelectorSemanal() {
    document.querySelectorAll('.day-circle').forEach(circle => {
        circle.onclick = () => {
            const day = circle.getAttribute('data-day');
            if (selectedDays.includes(day)) {
                selectedDays = selectedDays.filter(d => d !== day);
                circle.classList.remove('day-selected');
            } else {
                selectedDays.push(day);
                circle.classList.add('day-selected');
            }
        };
    });
}

// 4. GUARDAR ACONTECIMIENTO (Con validación de turno nocturno)
window.guardarAcontecimiento = async () => {
    const titulo = document.getElementById('ev-titulo').value.trim();
    const tipo = document.getElementById('ev-tipo').value;
    const fechaTipo = document.getElementById('ev-fecha-tipo').value;
    const horaInicio = document.getElementById('ev-hora-inicio').value;
    const horaFin = document.getElementById('ev-hora-fin').value;

    if (!titulo || !horaInicio || !horaFin) {
        alert("Rellena los campos obligatorios.");
        return;
    }

    // Validación Turno Nocturno (Ej: 22:00 a 06:00)
    if (horaFin < horaInicio) {
        const confirmar = confirm("La hora de fin es anterior a la de inicio. ¿Este evento termina al día siguiente? (Ideal para turnos de noche)");
        if (!confirmar) return;
    }

    const nuevoEv = {
        userId: miID,
        titulo,
        tipo,
        tipoDetalle: tipo === "Trabajo" ? document.getElementById('ev-trabajo-select').value : 
                     tipo === "Otro" ? document.getElementById('ev-tipo-otro').value : "",
        lugar: document.getElementById('ev-lugar').value,
        fechaTipo,
        horaInicio,
        horaFin,
        fechaCreacion: new Date().toISOString()
    };

    // Manejo de fechas según tipo
    if (fechaTipo === "especifico") nuevoEv.fechaValor = document.getElementById('ev-date-single').value;
    else if (fechaTipo === "semanal") nuevoEv.fechaValor = selectedDays;
    else nuevoEv.fechaValor = document.getElementById('ev-date-multiple').value;

    try {
        if (editandoID) {
            await updateDoc(doc(db, "acontecimientos", editandoID), nuevoEv);
        } else {
            await addDoc(collection(db, "acontecimientos"), nuevoEv);
        }
        cerrarModales();
        location.reload();
    } catch (e) { console.error(e); }
};

// 5. CARGAR Y PAGINAR
async function cargarAcontecimientos() {
    const q = query(collection(db, "acontecimientos"), where("userId", "==", miID));
    const snap = await getDocs(q);
    eventosCargados = [];
    snap.forEach(d => eventosCargados.push({ id: d.id, ...d.data() }));

    // Ordenar cronológico (Simplificado: por fecha de creación o valor si es específico)
    eventosCargados.sort((a, b) => new Date(a.fechaCreacion) - new Date(b.fechaCreacion));
    
    renderizarPagina();
}

function renderizarPagina() {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    const lista = eventosCargados.slice(inicio, fin);
    
    const contenedor = document.getElementById('contenedor-eventos');
    contenedor.innerHTML = "";

    lista.forEach(ev => {
        const div = document.createElement('div');
        div.className = "event-card";
        div.innerHTML = `
            <div>
                <strong>${ev.titulo}</strong> <br>
                <small>${ev.horaInicio} - ${ev.horaFin} (${ev.tipo})</small>
            </div>
            <div>
                <i class="fas fa-edit" style="color: #ec407a; cursor:pointer; margin-right:15px;" onclick="prepararEdicion('${ev.id}')"></i>
                <i class="fas fa-trash" style="color: #666; cursor:pointer;" onclick="borrarEvento('${ev.id}')"></i>
            </div>
        `;
        contenedor.appendChild(div);
    });

    document.getElementById('page-info').innerText = `Página ${paginaActual}`;
    document.getElementById('btn-prev').disabled = paginaActual === 1;
    document.getElementById('btn-next').disabled = fin >= eventosCargados.length;
}

// Botones paginación
document.getElementById('btn-prev').onclick = () => { if(paginaActual > 1) { paginaActual--; renderizarPagina(); }};
document.getElementById('btn-next').onclick = () => { if((paginaActual * itemsPorPagina) < eventosCargados.length) { paginaActual++; renderizarPagina(); }};

window.abrirModalEvento = () => {
    editandoID = null;
    document.getElementById('modal-titulo-accion').innerText = "Nuevo Acontecimiento";
    document.getElementById('modal-evento').style.display = "flex";
};

window.cerrarModales = () => {
    document.getElementById('modal-evento').style.display = "none";
};

window.borrarEvento = async (id) => {
    if(confirm("¿Borrar este acontecimiento?")) {
        await deleteDoc(doc(db, "acontecimientos", id));
        location.reload();
    }
};

window.toggleMenu = () => document.getElementById('sidebar').classList.toggle('active');

// Función para cerrar sesión desde cualquier pantalla
window.cerrarSesion = () => {
    localStorage.clear();
    window.location.href = 'index.html';
};
