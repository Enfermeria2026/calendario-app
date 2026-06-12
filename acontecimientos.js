import { db } from "./firebase-config.js";
import { collection, addDoc, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const miID = localStorage.getItem('usuario_activo');
let misTrabajos = [];
let diasSemanaSelec = [];
let diasVariosSelec = [];
let todosLosEventos = [];
let pagActual = 1;
const limite = 10;
let modoSeleccion = false;
let idsSeleccionados = [];
let fechaCalModal = new Date();
const HOY_REAL = new Date();
let idEditando = null;

function mostrarCarga() { document.getElementById('pantalla-carga').classList.remove('hidden'); }
function ocultarCarga() { document.getElementById('pantalla-carga').classList.add('hidden'); }

document.addEventListener('DOMContentLoaded', async () => {
    if (!miID) { window.location.href = "index.html"; return; }
    mostrarCarga();
    try {
        await cargarPerfil();
        await cargarLista();
        renderizarCalendarioModal();
        configurarSelectorSemanal();
    } catch (error) {
        console.error("Error al cargar la página:", error);
    } finally {
        ocultarCarga();
    }
});

async function cargarPerfil() {
    const d = await getDoc(doc(db, "usuarios", miID));
    if (d.exists()) {
        const data = d.data();
        document.getElementById('header-usuario').innerText = `${data.nombre} ${data.apellidos}`;
        misTrabajos = data.trabajos || [];
    }
}

// --- CALENDARIO DEL MODAL ---
window.cambiarMesCal = (dir) => {
    const nuevaFecha = new Date(fechaCalModal);
    nuevaFecha.setMonth(nuevaFecha.getMonth() + dir);
    if (nuevaFecha.getFullYear() < HOY_REAL.getFullYear() || 
       (nuevaFecha.getFullYear() === HOY_REAL.getFullYear() && nuevaFecha.getMonth() < HOY_REAL.getMonth())) return;
    fechaCalModal = nuevaFecha;
    renderizarCalendarioModal();
};

function renderizarCalendarioModal() {
    const cont = document.getElementById('calendar-multi');
    const labelMes = document.getElementById('cal-mes-nombre');
    const btnPrev = document.getElementById('btn-cal-prev');
    if(!cont || !labelMes) return;
    cont.innerHTML = "";
    
    const mes = fechaCalModal.getMonth();
    const anio = fechaCalModal.getFullYear();
    const esMesActual = anio === HOY_REAL.getFullYear() && mes === HOY_REAL.getMonth();
    btnPrev.disabled = esMesActual;
    
    labelMes.innerText = fechaCalModal.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const primerDia = new Date(anio, mes, 1).getDay();
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    let startDay = (primerDia === 0) ? 6 : primerDia - 1;
    
    for (let i = 0; i < startDay; i++) cont.appendChild(document.createElement('div'));
    
    for (let d = 1; d <= ultimoDia; d++) {
        const fechaLoop = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const item = document.createElement('div');
        item.className = "date-item";
        item.innerText = d;
        const esPasado = esMesActual && d < HOY_REAL.getDate();
        
        if (esPasado) {
            item.classList.add('past');
        } else {
            if (diasVariosSelec.includes(fechaLoop)) item.classList.add('date-selected');
            item.onclick = () => {
                if (diasVariosSelec.includes(fechaLoop)) {
                    diasVariosSelec = diasVariosSelec.filter(x => x !== fechaLoop);
                    item.classList.remove('date-selected');
                } else {
                    diasVariosSelec.push(fechaLoop);
                    item.classList.add('date-selected');
                }
            };
        }
        cont.appendChild(item);
    }
}

// --- SELECCIÓN MÚLTIPLE ---
window.toggleModoSeleccion = () => {
    modoSeleccion = !modoSeleccion;
    const btn = document.getElementById('btn-toggle-sel');
    const btnBorrar = document.getElementById('btn-borrar-masivo');
    btn.innerText = modoSeleccion ? "Cancelar Selección" : "Seleccionar varios";
    btn.classList.toggle('activo', modoSeleccion);
    btnBorrar.style.display = modoSeleccion ? "block" : "none";
    if (!modoSeleccion) idsSeleccionados = [];
    document.getElementById('count-sel').innerText = "0";
    renderizar();
};

window.marcarParaBorrar = (id) => {
    if (idsSeleccionados.includes(id)) idsSeleccionados = idsSeleccionados.filter(x => x !== id);
    else idsSeleccionados.push(id);
    document.getElementById('count-sel').innerText = idsSeleccionados.length;
};

window.borrarSeleccionados = () => {
    if (idsSeleccionados.length === 0) return;
    lanzarAviso(`¿Eliminar definitivamente los ${idsSeleccionados.length} acontecimientos?`, "confirmar", async () => {
        mostrarCarga();
        try {
            for (let id of idsSeleccionados) {
                await deleteDoc(doc(db, "acontecimientos", id));
            }
            location.reload();
        } catch (error) {
            console.error(error);
            ocultarCarga(); 
        }
    });
};

// --- LOGICA MODAL INTERFAZ (ACTUALIZADA PARA VIAJES) ---
window.actualizarInterfazTipo = () => {
    const tipo = document.getElementById('ev-tipo').value;
    const divT = document.getElementById('div-trabajo-select');
    const divO = document.getElementById('div-otro-texto');
    const bloqueNormal = document.getElementById('bloque-fechas-normales');
    const bloqueViaje = document.getElementById('bloque-fechas-viaje');
    const selT = document.getElementById('ev-trabajo-id');
    const err = document.getElementById('error-no-jobs');
    const btn = document.getElementById('btn-save-event');
    
    divT.classList.add('hidden'); 
    divO.classList.add('hidden');
    bloqueNormal.classList.remove('hidden');
    bloqueViaje.classList.add('hidden');
    btn.disabled = false; 
    btn.style.opacity = "1";
    
    if (tipo === "Trabajo") {
        divT.classList.remove('hidden');
        if (misTrabajos.length === 0) {
            err.classList.remove('hidden'); 
            selT.classList.add('hidden');
            btn.disabled = true; 
            btn.style.opacity = "0.5";
        } else {
            err.classList.add('hidden'); 
            selT.classList.remove('hidden');
            selT.innerHTML = misTrabajos.map(t => `<option value="${t}">${t}</option>`).join('');
        }
    } else if (tipo === "Otro") {
        divO.classList.remove('hidden');
    } else if (tipo === "Viaje") {
        bloqueNormal.classList.add('hidden');
        bloqueViaje.classList.remove('hidden');
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
                diasSemanaSelec = diasSemanaSelec.filter(x => x !== d);
                c.classList.remove('day-selected');
            } else {
                diasSemanaSelec.push(d);
                c.classList.add('day-selected');
            }
        };
    });
}

// --- GUARDADO (ACTUALIZADO PARA VIAJES) ---
window.validarYGuardar = async () => {
    const titulo = document.getElementById('ev-titulo').value.trim();
    const tipo = document.getElementById('ev-tipo').value;
    
    if (!titulo || !tipo) {
        lanzarAviso("Por favor, rellena el título y el tipo obligatoriamente.");
        return;
    }

    if (tipo === "Viaje") {
        const fIda = document.getElementById('ev-viaje-fecha-ida').value;
        const hIda = document.getElementById('ev-viaje-hora-ida').value;
        const fVuelta = document.getElementById('ev-viaje-fecha-vuelta').value;
        const hVuelta = document.getElementById('ev-viaje-hora-vuelta').value;

        if(!fIda || !hIda || !fVuelta || !hVuelta) {
            lanzarAviso("Para un viaje, debes indicar todas las fechas y horas de ida y vuelta.");
            return;
        }
        if(fVuelta < fIda || (fVuelta === fIda && hVuelta <= hIda)) {
            lanzarAviso("La fecha y hora de vuelta deben ser posteriores a las de ida.");
            return;
        }
        procesarGuardadoViaje(titulo, fIda, hIda, fVuelta, hVuelta);
    } else {
        const hIni = document.getElementById('ev-hora-ini').value;
        const hFin = document.getElementById('ev-hora-fin').value;
        if (!hIni || !hFin) {
            lanzarAviso("Por favor, introduce la hora de inicio y fin.");
            return;
        }
        if (hFin < hIni) {
            lanzarAviso("¿Estás seguro de que el evento finaliza al día siguiente?", "confirmar", procesarGuardado);
        } else {
            procesarGuardado();
        }
    }
};

async function procesarGuardadoViaje(titulo, fIda, hIda, fVuelta, hVuelta) {
    mostrarCarga();
    try {
        if (idEditando) {
            await updateDoc(doc(db, "acontecimientos", idEditando), {
                titulo: titulo,
                tipo: "Viaje",
                lugar: document.getElementById('ev-lugar').value,
                fechaIda: fIda,
                horaIda: hIda,
                fechaVuelta: fVuelta,
                horaVuelta: hVuelta,
                fecha: fIda // Guardamos la fecha de ida como principal para ordenar la lista
            });
        } else {
            await addDoc(collection(db, "acontecimientos"), {
                userId: miID,
                titulo: titulo,
                tipo: "Viaje",
                lugar: document.getElementById('ev-lugar').value,
                fechaIda: fIda,
                horaIda: hIda,
                fechaVuelta: fVuelta,
                horaVuelta: hVuelta,
                fecha: fIda
            });
        }
        location.reload();
    } catch (e) { 
        console.error(e); 
        ocultarCarga(); 
    }
}

async function procesarGuardado() {
    const fTipo = document.getElementById('ev-fecha-tipo').value;
    let fechas = [];
    
    if (fTipo === "especifico") {
        fechas.push(document.getElementById('ev-date-single').value);
    } else if (fTipo === "semanal") {
        const fFin = new Date(document.getElementById('ev-date-end').value);
        let actual = new Date();
        while (actual <= fFin) {
            if (diasSemanaSelec.includes(actual.getDay().toString())) fechas.push(actual.toISOString().split('T')[0]);
            actual.setDate(actual.getDate() + 1);
        }
    } else {
        fechas = diasVariosSelec;
    }
    
    if (fechas.length === 0 || fechas.some(f => !f)) {
        lanzarAviso("Selecciona al menos una fecha válida.");
        return;
    }
    
    mostrarCarga();
    
    try {
        if (idEditando) {
            await updateDoc(doc(db, "acontecimientos", idEditando), {
                titulo: document.getElementById('ev-titulo').value,
                tipo: document.getElementById('ev-tipo').value,
                detalle: document.getElementById('ev-tipo').value === "Trabajo" ? document.getElementById('ev-trabajo-id').value : document.getElementById('ev-otro-nombre').value,
                lugar: document.getElementById('ev-lugar').value,
                fecha: fechas[0], 
                horaInicio: document.getElementById('ev-hora-ini').value,
                horaFin: document.getElementById('ev-hora-fin').value
            });
        } else {
            for (let f of fechas) {
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
        }
        location.reload();
    } catch (e) { 
        console.error(e); 
        ocultarCarga(); 
    }
}

// --- CARGA DE LISTA (ACTUALIZADO PARA VIAJES) ---
async function cargarLista() {
    const q = query(collection(db, "acontecimientos"), where("userId", "==", miID));
    const snap = await getDocs(q);
    todosLosEventos = [];
    snap.forEach(d => todosLosEventos.push({id: d.id, ...d.data()}));
    todosLosEventos.sort((a,b) => new Date(a.fecha + "T" + (a.horaInicio || a.horaIda)) - new Date(b.fecha + "T" + (b.horaInicio || b.horaIda)));
    
    if (todosLosEventos.length === 0) document.getElementById('subtitulo-vacio').classList.remove('hidden');
    renderizar();
}

function renderizar() {
    const totalPags = Math.ceil(todosLosEventos.length / limite) || 1;
    const inicio = (pagActual - 1) * limite;
    const lista = todosLosEventos.slice(inicio, inicio + limite);
    
    document.getElementById('barra-seleccion').style.display = todosLosEventos.length > 1 ? "flex" : "none";
    const cont = document.getElementById('contenedor-eventos');
    if(!cont) return;
    cont.innerHTML = "";
    
    lista.forEach(ev => {
        const div = document.createElement('div');
        div.className = "event-card";
        let check = modoSeleccion ? `<input type="checkbox" class="check-seleccion" onchange="marcarParaBorrar('${ev.id}')">` : "";
        
        if (ev.tipo === "Viaje") {
            const fIdaF = new Date(ev.fechaIda).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const fVuelF = new Date(ev.fechaVuelta).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            div.innerHTML = `
                <div style="display:flex; align-items:center;">
                    ${check}
                    <div>
                        <strong style="color:#333; font-size:16px;">${ev.titulo} <span style="font-size:12px; color:#aaa;">(Viaje)</span></strong><br>
                        <small style="color:#ec407a; font-weight:bold;">Ida: ${fIdaF} (${ev.horaIda})</small><br>
                        <small style="color:#ec407a; font-weight:bold;">Vuelta: ${fVuelF} (${ev.horaVuelta})</small>
                    </div>
                </div>
                <div class="event-actions">
                    <i class="fas fa-pencil-alt" onclick="prepararEdicion('${ev.id}')"></i>
                    <i class="fas fa-trash" onclick="pedirBorrado('${ev.id}')"></i>
                </div>
            `;
        } else {
            const fFormat = new Date(ev.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            div.innerHTML = `
                <div style="display:flex; align-items:center;">
                    ${check}
                    <div>
                        <strong style="color:#333; font-size:16px;">${ev.titulo}</strong> <small style="color:#ec407a; margin-left:10px; font-weight:bold;">${fFormat}</small><br>
                        <small style="color:#666;">${ev.horaInicio} - ${ev.horaFin} (${ev.detalle || ev.tipo})</small>
                    </div>
                </div>
                <div class="event-actions">
                    <i class="fas fa-pencil-alt" onclick="prepararEdicion('${ev.id}')"></i>
                    <i class="fas fa-trash" onclick="pedirBorrado('${ev.id}')"></i>
                </div>
            `;
        }
        cont.appendChild(div);
    });
    
    document.getElementById('page-info').innerText = `Página ${pagActual} de ${totalPags}`;
    document.getElementById('btn-prev').disabled = pagActual === 1;
    document.getElementById('btn-next').disabled = pagActual === totalPags;
    document.getElementById('paginacion-box').style.display = todosLosEventos.length > 0 ? "flex" : "none";
}

window.prepararEdicion = async (id) => {
    mostrarCarga();
    try {
        idEditando = id;
        const d = await getDoc(doc(db, "acontecimientos", id));
        if (d.exists()) {
            const ev = d.data();
            document.getElementById('modal-titulo-accion').innerText = "Editar Acontecimiento";
            document.getElementById('ev-titulo').value = ev.titulo;
            document.getElementById('ev-tipo').value = ev.tipo;
            actualizarInterfazTipo();
            document.getElementById('ev-lugar').value = ev.lugar || "";

            if (ev.tipo === "Viaje") {
                document.getElementById('ev-viaje-fecha-ida').value = ev.fechaIda;
                document.getElementById('ev-viaje-hora-ida').value = ev.horaIda;
                document.getElementById('ev-viaje-fecha-vuelta').value = ev.fechaVuelta;
                document.getElementById('ev-viaje-hora-vuelta').value = ev.horaVuelta;
            } else {
                document.getElementById('ev-fecha-tipo').value = "especifico";
                actualizarInterfazFecha();
                document.getElementById('ev-date-single').value = ev.fecha;
                document.getElementById('ev-hora-ini').value = ev.horaInicio;
                document.getElementById('ev-hora-fin').value = ev.horaFin;
            }
            
            document.getElementById('modal-evento').style.display = "flex";
        }
    } catch (error) {
        console.error(error);
    } finally {
        ocultarCarga(); 
    }
};

window.pedirBorrado = (id) => lanzarAviso("¿Borrar definitivamente este acontecimiento?", "confirmar", async () => { 
    mostrarCarga();
    try {
        await deleteDoc(doc(db, "acontecimientos", id)); 
        location.reload(); 
    } catch (error) {
        console.error(error);
        ocultarCarga(); 
    }
});

function lanzarAviso(msg, tipo = "ok", cb = null) {
    const m = document.getElementById('miModal');
    document.getElementById('modalMsg').innerText = msg;
    const c = document.getElementById('modalBtnsContainer');
    c.innerHTML = "";
    m.style.display = "flex";
    
    const bOk = document.createElement('button');
    bOk.innerText = "Aceptar";
    bOk.style.cssText = "background: #ec407a; color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; width: auto;";
    bOk.onclick = () => { m.style.display="none"; if(cb) cb(); };
    
    if(tipo === "confirmar") {
        const bCan = document.createElement('button');
        bCan.innerText = "Cancelar"; 
        bCan.style.cssText = "background: #f5f5f5; color: #666; border: 1px solid #ddd; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; width: auto;";
        bCan.onclick = () => m.style.display="none";
        c.appendChild(bCan);
    }
    c.appendChild(bOk);
}

window.abrirModalEvento = () => { 
    idEditando = null; 
    diasVariosSelec = []; 
    diasSemanaSelec = [];
    
    document.getElementById('ev-titulo').value = "";
    document.getElementById('ev-tipo').value = "";
    document.getElementById('ev-lugar').value = "";
    
    // Limpiar normales
    document.getElementById('ev-hora-ini').value = "";
    document.getElementById('ev-hora-fin').value = "";
    document.getElementById('ev-fecha-tipo').value = "especifico";
    
    // Limpiar viajes
    document.getElementById('ev-viaje-fecha-ida').value = "";
    document.getElementById('ev-viaje-hora-ida').value = "";
    document.getElementById('ev-viaje-fecha-vuelta').value = "";
    document.getElementById('ev-viaje-hora-vuelta').value = "";
    
    document.querySelectorAll('.day-selected').forEach(el => el.classList.remove('day-selected'));
    document.querySelectorAll('.date-selected').forEach(el => el.classList.remove('date-selected'));
    
    actualizarInterfazTipo();
    actualizarInterfazFecha();
    
    document.getElementById('modal-titulo-accion').innerText = "Nuevo Acontecimiento"; 
    document.getElementById('modal-evento').style.display = "flex"; 
};

window.cerrarModales = () => document.getElementById('modal-evento').style.display = "none";
window.toggleMenu = () => document.getElementById('sidebar').classList.toggle('active');
window.cerrarSesion = () => { localStorage.removeItem('usuario_activo'); window.location.href="index.html"; };
document.getElementById('btn-prev').onclick = () => { pagActual--; renderizar(); };
document.getElementById('btn-next').onclick = () => { pagActual++; renderizar(); };
