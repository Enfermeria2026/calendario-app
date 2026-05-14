import { db } from "./firebase-config.js";
import { collection, addDoc, query, where, getDocs, doc, getDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const miID = localStorage.getItem('usuario_activo');
let misTrabajos = [];
let diasSemanaSelec = [];
let diasVariosSelec = [];
let todosLosEventos = [];
let pagActual = 1;
const limite = 10;

document.addEventListener('DOMContentLoaded', async () => {
    if (!miID) window.location.href = "index.html";
    await cargarPerfil();
    await cargarLista();
    generarCalendarioMulti();
    configurarSelectorSemanal();
});

// --- CARGA INICIAL ---
async function cargarPerfil() {
    const d = await getDoc(doc(db, "usuarios", miID));
    if (d.exists()) {
        const data = d.data();
        document.getElementById('header-usuario').innerText = `${data.nombre} ${data.apellidos}`;
        misTrabajos = data.trabajos || [];
    }
}

// --- LOGICA DEL MODAL ---
window.actualizarInterfazTipo = () => {
    const tipo = document.getElementById('ev-tipo').value;
    const divTrabajo = document.getElementById('div-trabajo-select');
    const divOtro = document.getElementById('div-otro-texto');
    const selectTrabajos = document.getElementById('ev-trabajo-id');
    const errorJobs = document.getElementById('error-no-jobs');
    const btnSave = document.getElementById('btn-save-event');

    divTrabajo.classList.add('hidden');
    divOtro.classList.add('hidden');
    btnSave.disabled = false;
    btnSave.style.opacity = "1";

    if (tipo === "Trabajo") {
        divTrabajo.classList.remove('hidden');
        if (misTrabajos.length === 0) {
            errorJobs.classList.remove('hidden');
            selectTrabajos.classList.add('hidden');
            btnSave.disabled = true;
            btnSave.style.opacity = "0.5";
        } else {
            errorJobs.classList.add('hidden');
            selectTrabajos.classList.remove('hidden');
            selectTrabajos.innerHTML = misTrabajos.map(t => `<option value="${t}">${t}</option>`).join('');
        }
    } else if (tipo === "Otro") {
        divOtro.classList.remove('hidden');
    }
};

window.actualizarInterfazFecha = () => {
    const tipo = document.getElementById('ev-fecha-tipo').value;
    document.querySelectorAll('.fecha-box').forEach(b => b.classList.add('hidden'));
    document.getElementById(`box-${tipo}`).classList.remove('hidden');
};

function configurarSelectorSemanal() {
    document.querySelectorAll('.day-circle').forEach(c => {
        c.onclick = () => {
            const d = c.dataset.day;
            if (diasSemanaSelec.includes(d)) {
                diasSemanaSelec = diasSemanaSelec.filter(item => item !== d);
                c.classList.remove('day-selected');
            } else {
                diasSemanaSelec.push(d);
                c.classList.add('day-selected');
            }
        };
    });
}

function generarCalendarioMulti() {
    const cont = document.getElementById('calendar-multi');
    const hoy = new Date();
    // Generamos 31 días desde hoy para elegir
    for(let i=0; i<31; i++) {
        let f = new Date(); f.setDate(hoy.getDate() + i);
        let diaStr = f.toISOString().split('T')[0];
        let item = document.createElement('div');
        item.className = "date-item";
        item.innerText = f.getDate();
        item.onclick = () => {
            if (diasVariosSelec.includes(diaStr)) {
                diasVariosSelec = diasVariosSelec.filter(x => x !== diaStr);
                item.classList.remove('date-selected');
            } else {
                diasVariosSelec.push(diaStr);
                item.classList.add('date-selected');
            }
        };
        cont.appendChild(item);
    }
}

// --- GUARDADO Y VALIDACIÓN ---
window.validarYGuardar = async () => {
    const titulo = document.getElementById('ev-titulo').value.trim();
    const tipo = document.getElementById('ev-tipo').value;
    const hIni = document.getElementById('ev-hora-ini').value;
    const hFin = document.getElementById('ev-hora-fin').value;
    const fTipo = document.getElementById('ev-fecha-tipo').value;

    if (!titulo || !tipo || !hIni || !hFin) {
        lanzarAviso("Por favor, rellena los campos obligatorios.");
        return;
    }

    if (hFin < hIni) {
        lanzarAviso("¿Estás seguro de que el evento finaliza un día después?", "confirmar", procesarGuardado);
    } else {
        procesarGuardado();
    }
};

async function procesarGuardado() {
    const fTipo = document.getElementById('ev-fecha-tipo').value;
    let fechasFinales = [];

    if (fTipo === "especifico") {
        fechasFinales.push(document.getElementById('ev-date-single').value);
    } else if (fTipo === "semanal") {
        const fFin = new Date(document.getElementById('ev-date-end').value);
        let actual = new Date();
        while (actual <= fFin) {
            if (diasSemanaSelec.includes(actual.getDay().toString())) {
                fechasFinales.push(actual.toISOString().split('T')[0]);
            }
            actual.setDate(actual.getDate() + 1);
        }
    } else {
        fechasFinales = diasVariosSelec;
    }

    if (fechasFinales.length === 0 || fechasFinales.some(f => !f)) {
        lanzarAviso("Debes seleccionar al menos una fecha válida.");
        return;
    }

    // Guardar por separado
    try {
        for (let f of fechasFinales) {
            await addDoc(collection(db, "acontecimientos"), {
                userId: miID,
                titulo: document.getElementById('ev-titulo').value,
                tipo: document.getElementById('ev-tipo').value,
                detalle: document.getElementById('ev-tipo').value === "Trabajo" ? document.getElementById('ev-trabajo-id').value : document.getElementById('ev-otro-nombre').value,
                lugar: document.getElementById('ev-lugar').value,
                fecha: f,
                horaInicio: document.getElementById('ev-hora-ini').value,
                horaFin: document.getElementById('ev-hora-fin').value
            });
        }
        location.reload();
    } catch (e) { console.error(e); }
}

// --- LISTADO Y PAGINACIÓN ---
async function cargarLista() {
    const q = query(collection(db, "acontecimientos"), where("userId", "==", miID));
    const snap = await getDocs(q);
    todosLosEventos = [];
    snap.forEach(d => todosLosEventos.push({id: d.id, ...d.data()}));
    
    // Orden cronológico
    todosLosEventos.sort((a,b) => new Date(a.fecha + "T" + a.horaInicio) - new Date(b.fecha + "T" + b.horaInicio));

    if (todosLosEventos.length === 0) {
        document.getElementById('subtitulo-vacio').classList.remove('hidden');
    }
    renderizar();
}

function renderizar() {
    const totalPags = Math.ceil(todosLosEventos.length / limite) || 1;
    const inicio = (pagActual - 1) * limite;
    const fragmento = todosLosEventos.slice(inicio, inicio + limite);

    const cont = document.getElementById('contenedor-eventos');
    cont.innerHTML = "";

    fragmento.forEach(ev => {
        const fFormat = new Date(ev.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const div = document.createElement('div');
        div.className = "event-card";
        div.innerHTML = `
            <div>
                <strong style="color:#333; font-size:16px;">${ev.titulo}</strong> <small style="color:#ec407a; margin-left:10px;">${fFormat}</small><br>
                <small style="color:#666;">${ev.horaInicio} - ${ev.horaFin} (${ev.detalle || ev.tipo})</small>
            </div>
            <div>
                <i class="fas fa-trash" style="color:#bbb; cursor:pointer;" onclick="pedirBorrado('${ev.id}')"></i>
            </div>
        `;
        cont.appendChild(div);
    });

    document.getElementById('page-info').innerText = `Página ${pagActual} de ${totalPags}`;
    document.getElementById('btn-prev').disabled = pagActual === 1;
    document.getElementById('btn-next').disabled = pagActual === totalPags;
    
    if (todosLosEventos.length <= limite) document.getElementById('paginacion-box').style.display = "none";
}

// --- MODALES Y UTILIDADES ---
function lanzarAviso(msg, tipo = "ok", cb = null) {
    const modal = document.getElementById('miModal');
    document.getElementById('modalMsg').innerText = msg;
    const container = document.getElementById('modalBtnsContainer');
    container.innerHTML = "";
    modal.style.display = "flex";

    const btnOk = document.createElement('button');
    btnOk.innerText = "Aceptar";
    btnOk.onclick = () => { modal.style.display="none"; if(cb) cb(); };
    
    if(tipo === "confirmar") {
        const btnCan = document.createElement('button');
        btnCan.innerText = "Cancelar"; btnCan.style.background = "#aaa";
        btnCan.onclick = () => modal.style.display="none";
        container.appendChild(btnCan);
    }
    container.appendChild(btnOk);
}

window.pedirBorrado = (id) => {
    lanzarAviso("¿Estás seguro de eliminar este acontecimiento?", "confirmar", async () => {
        await deleteDoc(doc(db, "acontecimientos", id));
        location.reload();
    });
};

window.abrirModalEvento = () => document.getElementById('modal-evento').style.display = "flex";
window.cerrarModales = () => document.getElementById('modal-evento').style.display = "none";
window.toggleMenu = () => document.getElementById('sidebar').classList.toggle('active');
window.cerrarSesion = () => { localStorage.clear(); window.location.href="index.html"; };

document.getElementById('btn-prev').onclick = () => { pagActual--; renderizar(); };
document.getElementById('btn-next').onclick = () => { pagActual++; renderizar(); };
