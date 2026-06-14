// =========================================================================
// 1. IMPORTACIONES Y VARIABLES GLOBALES
// =========================================================================
import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, arrayUnion, arrayRemove, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const idActivo = localStorage.getItem('usuario_activo');
const calId = localStorage.getItem('calendario_activo');
let fechaVisualizada = new Date();
const HOY_REAL = new Date();

let datosCalendario = null;
let mapaColores = {};
let vistaActual = "mes";

// VARIABLES PARA EL TIEMPO REAL Y FILTROS
window.unsubscribeCalendario = null;
window.unsubscribeEventos = null;
window.listaEventosActivos = []; 
window.miembrosFiltroActivos = [];
window.mapaPerfilesMiembros = {};

const COLORES_DISPONIBLES = ['c-azul', 'c-naranja', 'c-rojo', 'c-verde', 'c-morado', 'c-rosa', 'c-marron', 'c-amarillo', 'c-negro', 'c-cian', 'c-magenta', 'c-celeste'];

// =========================================================================
// 2. INICIALIZACIÓN DE LA APP
// =========================================================================
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

// =========================================================================
// 3. LA "RADIO" DEL TIEMPO REAL Y AUTO-LIMPIEZA
// =========================================================================
async function inicializarCalendario() {
    if (window.unsubscribeCalendario) window.unsubscribeCalendario();

    window.unsubscribeCalendario = onSnapshot(doc(db, "calendarios", calId), async (docSnap) => {
        try {
            if (!docSnap.exists()) {
                window.location.href = "dashboard.html";
                return;
            }

            datosCalendario = docSnap.data();
            datosCalendario.miembros = datosCalendario.miembros || [];
            
            document.getElementById('titulo-calendario').innerText = datosCalendario.nombre || "Sin nombre";
            window.miembrosFiltroActivos = [...datosCalendario.miembros];
            
            // Consultamos a los usuarios
            const promesasUsuarios = datosCalendario.miembros.map(mId => getDoc(doc(db, "usuarios", mId)));
            const docsUsuarios = await Promise.all(promesasUsuarios);
            
            let miembrosExistentesIds = [];
            docsUsuarios.forEach(d => { 
                if (d.exists()) {
                    window.mapaPerfilesMiembros[d.id] = d.data(); 
                    miembrosExistentesIds.push(d.id); 
                }
            });

            // --- SISTEMA DE AUTO-LIMPIEZA ---
            if (miembrosExistentesIds.length !== datosCalendario.miembros.length) {
                console.log("¡Detectados miembros eliminados! Limpiando el calendario...");
                let nuevosAdmins = (datosCalendario.admins || []).filter(id => miembrosExistentesIds.includes(id));
                let mapaColoresOriginal = datosCalendario.colores_miembros || {};
                let nuevosColores = {};
                miembrosExistentesIds.forEach(id => {
                    if (mapaColoresOriginal[id]) nuevosColores[id] = mapaColoresOriginal[id];
                });

                const calRef = doc(db, "calendarios", calId);
                await updateDoc(calRef, {
                    miembros: miembrosExistentesIds,
                    admins: nuevosAdmins,
                    colores_miembros: nuevosColores
                });
                return; 
            }
            // --------------------------------

            await asegurarColoresMiembros();
            window.dibujarFiltroMiembros();

            const miColor = mapaColores[idActivo] || 'c-negro';
            const ind = document.getElementById('user-color-indicator');
            if(ind) ind.className = `color-dot-indicator bg-${miColor}`;

            // Iniciamos la escucha de eventos (Tiempo Real)
            iniciarEscuchaEventos();

            // Asignación de botones superiores
            const btnMiembros = document.getElementById('btn-miembros');
            if(btnMiembros) btnMiembros.onclick = function() { window.abrirModalMiembros(); this.blur(); };
            
            const btnNuevoEvento = document.getElementById('btn-nuevo-evento');
            if (btnNuevoEvento) btnNuevoEvento.onclick = function() { window.abrirModalNuevoAcontecimiento(); this.blur(); };

            const esTitular = datosCalendario.titular === idActivo;
            const esAdmin = (datosCalendario.admins || []).includes(idActivo);

            const btnConfig = document.getElementById('btn-config');
            if(btnConfig) {
                if (esTitular || esAdmin) {
                    btnConfig.classList.remove('hidden');
                    btnConfig.onclick = function() { window.abrirModalConfig(); this.blur(); };
                } else {
                    btnConfig.classList.add('hidden');
                }
            }

            const btnSolicitudes = document.getElementById('btn-solicitudes');
            const badgeSolicitudes = document.getElementById('solicitudes-badge');
            if (btnSolicitudes) {
                if ((esTitular || esAdmin) && datosCalendario.requiere_aprobacion === true) {
                    btnSolicitudes.classList.remove('hidden');
                    btnSolicitudes.onclick = function() { window.abrirModalSolicitudes(); this.blur(); };
                    if (datosCalendario.solicitudes && datosCalendario.solicitudes.length > 0) {
                        if (badgeSolicitudes) badgeSolicitudes.classList.remove('hidden');
                    } else {
                        if (badgeSolicitudes) badgeSolicitudes.classList.add('hidden');
                    }
                } else {
                    btnSolicitudes.classList.add('hidden');
                }
            }

        } catch (error) {
            console.error("Error en inicializarCalendario:", error);
            renderizarCalendario(); // Para evitar cuelgues
        }
    });
}

function iniciarEscuchaEventos() {
    if (window.unsubscribeEventos) window.unsubscribeEventos();
    
    if (!datosCalendario || !datosCalendario.miembros || datosCalendario.miembros.length === 0) {
        window.listaEventosActivos = [];
        renderizarCalendario();
        return;
    }

    try {
        const q = query(collection(db, "acontecimientos"), where("userId", "in", datosCalendario.miembros));
        window.unsubscribeEventos = onSnapshot(q, (snapshot) => {
            window.listaEventosActivos = []; 
            snapshot.forEach(docSnap => {
                window.listaEventosActivos.push({ id: docSnap.id, ...docSnap.data() });
            });
            renderizarCalendario(); // Repinta automáticamente
        });
    } catch (error) {
        console.error("Error en escucha de eventos:", error);
        renderizarCalendario();
    }
}

// =========================================================================
// 4. LÓGICA DE CARGA Y FILTRADO
// =========================================================================
function obtenerAcontecimientosDelPeriodo(fechaInicio, fechaFin) {
    const acontecimientos = [];
    window.listaEventosActivos.forEach(data => {
        if (data.tipo === "Viaje" && data.fechaIda && data.fechaVuelta) {
            const fIdaDoc = new Date(data.fechaIda);
            const fVueltaDoc = new Date(data.fechaVuelta);
            const fIdaClean = new Date(fIdaDoc.getFullYear(), fIdaDoc.getMonth(), fIdaDoc.getDate());
            const fVueltaClean = new Date(fVueltaDoc.getFullYear(), fVueltaDoc.getMonth(), fVueltaDoc.getDate());
            const fInicioClean = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate());
            const fFinClean = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate());

            if (fIdaClean <= fFinClean && fVueltaClean >= fInicioClean) {
                acontecimientos.push({ ...data, esViaje: true, fechaIdaObjeto: fIdaClean, fechaVueltaObjeto: fVueltaClean });
            }
        } else if (data.fecha) {
            let fechaDoc = (typeof data.fecha.toDate === 'function') ? data.fecha.toDate() : new Date(data.fecha);
            const fDocClean = new Date(fechaDoc.getFullYear(), fechaDoc.getMonth(), fechaDoc.getDate());
            const fInicioClean = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate());
            const fFinClean = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate());

            if (fDocClean >= fInicioClean && fDocClean <= fFinClean) {
                acontecimientos.push({ ...data, esViaje: false, fechaObjeto: fDocClean });
            }
        }
    });
    return acontecimientos;
}

// =========================================================================
// 5. RENDERIZADO VISUAL
// =========================================================================
function renderizarCalendario() {
    if (vistaActual === "mes") renderizarMes();
    else renderizarSemana();
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
        // Filtro visual por avatares superiores
        if (!window.miembrosFiltroActivos.includes(a.userId)) return false;

        if (a.esViaje) return fActualClean >= a.fechaIdaObjeto && fActualClean <= a.fechaVueltaObjeto;
        else return a.fechaObjeto.getFullYear() === fecha.getFullYear() && a.fechaObjeto.getMonth() === fecha.getMonth() && a.fechaObjeto.getDate() === fecha.getDate();
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

function renderizarMes() {
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

    const listaAcontecimientos = obtenerAcontecimientosDelPeriodo(fechaInicioCarga, fechaFinCarga);

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

function renderizarSemana() {
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
    
    const listaAcontecimientos = obtenerAcontecimientosDelPeriodo(lunes, domingo);
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

        celda.innerHTML = `<div class="day-number">${diaSemana.getDate()} <span style="font-size:10px; color:#aaa; font-weight:normal;">${diaSemana.toLocaleDateString('es-ES', {month:'short'})}</span></div><div class="stars-grid" id="estrellas-${diaSemana.getFullYear()}-${diaSemana.getMonth()+1}-${diaSemana.getDate()}"></div>`;
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
    llamadasPintar.forEach(item => pintarEstrellas(listaAcontecimientos, item.fecha, item.f1, item.f2));
}

// =========================================================================
// 6. DETALLE DEL DÍA
// =========================================================================
async function abrirDetalleDia(fecha, todosLosAcontecimientos) {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    if (!modal) return;

    window.mapaEventos = {};
    const fActualClean = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    
    const delDia = todosLosAcontecimientos.filter(a => {
        if (!window.miembrosFiltroActivos.includes(a.userId)) return false;

        if (a.esViaje) return fActualClean >= a.fechaIdaObjeto && fActualClean <= a.fechaVueltaObjeto;
        else return a.fechaObjeto.getFullYear() === fecha.getFullYear() && a.fechaObjeto.getMonth() === fecha.getMonth() && a.fechaObjeto.getDate() === fecha.getDate();
    });

    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
    let fechaStr = fecha.toLocaleDateString('es-ES', opcionesFecha);
    fechaStr = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1);
    msg.innerText = `Acontecimientos del ${fechaStr}`;
    
    if (delDia.length === 0) {
        extra.innerHTML = `<p style="text-align:center; color:#888; margin: 20px 0;">No hay ningún acontecimiento para este día.</p>`;
        btns.innerHTML = `<button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; outline:none;">Cerrar</button>`;
        modal.classList.remove('hidden');
        return;
    }

    extra.innerHTML = "<p style='text-align:center; color:#999;'><i class='fas fa-spinner fa-spin'></i> Cargando detalles...</p>";
    btns.innerHTML = `<button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; outline:none;">Cerrar</button>`;
    modal.classList.remove('hidden');

    try {
        const usersIds = [...new Set(delDia.map(ev => ev.userId))];
        const promesas = usersIds.map(id => getDoc(doc(db, "usuarios", id)));
        const docs = await Promise.all(promesas);
        
        const mapaUsuarios = {};
        docs.forEach(d => { if (d.exists()) mapaUsuarios[d.id] = d.data(); });

        let htmlContenido = `<div style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; padding-right: 5px; text-align: left;">`;

        delDia.forEach(ev => {
            window.mapaEventos[ev.id] = ev;
            const u = mapaUsuarios[ev.userId] || { nombre: "Usuario", apellidos: "Desconocido" };
            const colorClase = mapaColores[ev.userId] || 'c-negro'; 

            const titulo = ev.titulo || 'Sin título';
            const tipo = ev.tipo || 'Evento';
            const lugarHtml = ev.lugar ? `<div style="color: #666; font-size: 13px; margin-top: 4px;"><i class="fas fa-map-marker-alt" style="color:#ef5350; width:16px;"></i> ${ev.lugar}</div>` : '';

            let tiempoHtml = '';
            
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
            } else {
                const hInicio = ev.horaInicio || ev.hora_inicio || ev.hora || '';
                const hFin = ev.horaFin || ev.hora_fin || '';

                if (hInicio || hFin) {
                    let textoHora = '';
                    if (hInicio && hFin) textoHora = `<b>Inicio:</b> ${hInicio} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Fin:</b> ${hFin}`;
                    else if (hInicio) textoHora = `<b>Inicio:</b> ${hInicio}`;
                    else if (hFin) textoHora = `<b>Fin:</b> ${hFin}`;
                    tiempoHtml = `<div style="color: #666; font-size: 13px; margin-top: 5px;"><i class="far fa-clock" style="color:#ff9800; width:16px;"></i> ${textoHora}</div>`;
                }
            }

            const esMio = ev.userId === idActivo;
            let accionesHtml = '';
            if (esMio) {
                accionesHtml = `
                    <div style="display: flex; gap: 8px; margin-top: 12px; border-top: 1px dashed #eee; padding-top: 12px;">
                        <button onclick="window.editarAcontecimiento('${ev.id}')" style="background: #fdfdfd; color: #666; border: 1px solid #ddd; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; flex: 1; transition: 0.2s; outline:none;"><i class="fas fa-edit" style="color:#2196F3;"></i> Editar</button>
                        <button onclick="window.eliminarAcontecimiento('${ev.id}')" style="background: #fff5f5; color: #ef5350; border: 1px solid #ffcdd2; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; flex: 1; transition: 0.2s; outline:none;"><i class="fas fa-trash"></i> Eliminar</button>
                    </div>
                `;
            }

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
                    ${accionesHtml}
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

// =========================================================================
// 7. FUNCIONES GLOBALES (AÑADIR, EDITAR, ELIMINAR ACONTECIMIENTOS)
// =========================================================================
window.abrirModalNuevoAcontecimiento = async () => {
    const modal = document.getElementById('miModal');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    if (!modal) return;

    document.getElementById('modalMsg').innerText = "Nuevo Acontecimiento";
    extra.innerHTML = "<p style='text-align:center; color:#999;'><i class='fas fa-spinner fa-spin'></i> Preparando formulario...</p>";
    btns.innerHTML = "";
    modal.classList.remove('hidden');

    try {
        const uSnap = await getDoc(doc(db, "usuarios", idActivo));
        let opcionesTrabajo = '<option value="">Selecciona qué trabajo es...</option>';
        if (uSnap.exists()) {
            const uData = uSnap.data();
            const listaTrabajos = uData.trabajos || uData.empleos || (uData.trabajo ? [uData.trabajo] : []);
            if (Array.isArray(listaTrabajos) && listaTrabajos.length > 0) {
                listaTrabajos.forEach(t => opcionesTrabajo += `<option value="${t}">${t}</option>`);
            } else if (typeof listaTrabajos === 'string' && listaTrabajos.trim() !== '') {
                opcionesTrabajo += `<option value="${listaTrabajos}">${listaTrabajos}</option>`;
            } else {
                opcionesTrabajo += `<option value="Mi trabajo principal">Mi trabajo principal</option>`;
            }
        }

        const inputStyle = "width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; box-sizing: border-box; outline: none; margin-bottom: 12px; font-family: inherit; color: #333;";
        const labelStyle = "display: block; font-size: 12px; color: #777; font-weight: bold; margin-bottom: 4px; text-align: left;";

        extra.innerHTML = `
            <div style="max-height: 420px; overflow-y: auto; padding-right: 5px;">
                <label style="${labelStyle}">Título *</label>
                <input type="text" id="event-titulo" placeholder="Ej: Guardia, Cumpleaños..." style="${inputStyle}" autocomplete="off">
                <label style="${labelStyle}">Tipo de Acontecimiento *</label>
                <select id="event-tipo" onchange="window.toggleCamposTipoEvento()" style="${inputStyle} background: white; cursor: pointer;">
                    <option value="Trabajo">Trabajo</option>
                    <option value="Escuela">Escuela</option>
                    <option value="Tarea">Tarea</option>
                    <option value="Evento">Evento</option>
                    <option value="Viaje">Viaje</option>
                    <option value="Otro">Otro</option>
                </select>
                <div id="bloque-tipo-otro" style="display: none;">
                    <label style="${labelStyle}">Especifica qué es *</label>
                    <input type="text" id="event-tipo-otro" style="${inputStyle}" autocomplete="off">
                </div>
                <div id="bloque-trabajo" style="display: block;">
                    <label style="${labelStyle}">Selecciona tu trabajo *</label>
                    <select id="event-trabajo-select" style="${inputStyle} background: white; cursor: pointer;">${opcionesTrabajo}</select>
                </div>
                <label style="${labelStyle}">Lugar (Opcional)</label>
                <input type="text" id="event-lugar" style="${inputStyle}" autocomplete="off">
                <div id="bloque-fecha-normal">
                    <label style="${labelStyle}">Fecha *</label><input type="date" id="event-fecha" style="${inputStyle}">
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;"><label style="${labelStyle}">Hora Inicio *</label><input type="time" id="event-hora-inicio" style="${inputStyle}"></div>
                        <div style="flex: 1;"><label style="${labelStyle}">Hora Fin *</label><input type="time" id="event-hora-fin" style="${inputStyle}"></div>
                    </div>
                </div>
                <div id="bloque-fecha-viaje" style="display: none;">
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;"><label style="${labelStyle}">Fecha Ida *</label><input type="date" id="event-fecha-ida" style="${inputStyle}"></div>
                        <div style="flex: 1;"><label style="${labelStyle}">Hora Ida *</label><input type="time" id="event-hora-ida" style="${inputStyle}"></div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;"><label style="${labelStyle}">Fecha Vuelta *</label><input type="date" id="event-fecha-vuelta" style="${inputStyle}"></div>
                        <div style="flex: 1;"><label style="${labelStyle}">Hora Vuelta *</label><input type="time" id="event-hora-vuelta" style="${inputStyle}"></div>
                    </div>
                </div>
                <p id="error-evento" style="color: #ef5350; font-size: 12px; margin: 0; min-height: 15px; text-align: left; font-weight: bold;"></p>
            </div>
        `;
        btns.innerHTML = `
            <button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>
            <button id="btn-guardar-evento" onclick="window.guardarNuevoAcontecimiento()" style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Crear</button>
        `;

        const hoyStr = new Date().toISOString().split('T')[0];
        if(document.getElementById('event-fecha')) document.getElementById('event-fecha').value = hoyStr;
        if(document.getElementById('event-fecha-ida')) document.getElementById('event-fecha-ida').value = hoyStr;
        if(document.getElementById('event-fecha-vuelta')) document.getElementById('event-fecha-vuelta').value = hoyStr;
    } catch (error) {
        console.error(error);
    }
};

window.toggleCamposTipoEvento = () => {
    const tipo = document.getElementById('event-tipo').value;
    document.getElementById('bloque-fecha-normal').style.display = tipo === "Viaje" ? "none" : "block";
    document.getElementById('bloque-fecha-viaje').style.display = tipo === "Viaje" ? "block" : "none";
    document.getElementById('bloque-tipo-otro').style.display = tipo === "Otro" ? "block" : "none";
    document.getElementById('bloque-trabajo').style.display = tipo === "Trabajo" ? "block" : "none";
};

window.guardarNuevoAcontecimiento = async () => {
    const errorMsg = document.getElementById('error-evento');
    const btnGuardar = document.getElementById('btn-guardar-evento');
    const titulo = document.getElementById('event-titulo').value.trim();
    const tipoSeleccionado = document.getElementById('event-tipo').value;
    const lugar = document.getElementById('event-lugar').value.trim();

    if (titulo === "") { errorMsg.innerText = "Escribe un título."; return; }

    let tipoFinal = tipoSeleccionado;
    let trabajoElegido = "";

    if (tipoSeleccionado === "Otro") {
        const txtOtro = document.getElementById('event-tipo-otro').value.trim();
        if (txtOtro === "") { errorMsg.innerText = "Especifica el tipo."; return; }
        tipoFinal = txtOtro;
    }
    if (tipoSeleccionado === "Trabajo") {
        trabajoElegido = document.getElementById('event-trabajo-select').value;
        if (!trabajoElegido) { errorMsg.innerText = "Selecciona un trabajo."; return; }
    }

    let objetoAcontecimiento = {
        titulo: titulo, tipo: tipoFinal, categoria_original: tipoSeleccionado, lugar: lugar,
        userId: idActivo, fecha_registro: new Date().toISOString()
    };

    if (tipoSeleccionado === "Trabajo") {
        objetoAcontecimiento.trabajo_seleccionado = trabajoElegido;
        if (lugar === "") objetoAcontecimiento.lugar = trabajoElegido; 
    }

    if (tipoSeleccionado === "Viaje") {
        const fechaIda = document.getElementById('event-fecha-ida').value;
        const fechaVuelta = document.getElementById('event-fecha-vuelta').value;
        const horaIda = document.getElementById('event-hora-ida').value;
        const horaVuelta = document.getElementById('event-hora-vuelta').value;

        if (!fechaIda || !fechaVuelta || !horaIda || !horaVuelta) { errorMsg.innerText = "Fechas y horas obligatorias."; return; }
        if (new Date(fechaVuelta) < new Date(fechaIda)) { errorMsg.innerText = "La vuelta no puede ser antes de la ida."; return; }

        objetoAcontecimiento.fechaIda = fechaIda; objetoAcontecimiento.fechaVuelta = fechaVuelta;
        objetoAcontecimiento.horaIda = horaIda; objetoAcontecimiento.horaVuelta = horaVuelta;
        objetoAcontecimiento.esViaje = true; 
    } else {
        const fecha = document.getElementById('event-fecha').value;
        const horaInicio = document.getElementById('event-hora-inicio').value;
        const horaFin = document.getElementById('event-hora-fin').value;

        if (!fecha || !horaInicio || !horaFin) { errorMsg.innerText = "Fecha y horas obligatorias."; return; }

        objetoAcontecimiento.fecha = fecha;
        objetoAcontecimiento.horaInicio = horaInicio;
        objetoAcontecimiento.horaFin = horaFin;
        objetoAcontecimiento.esViaje = false;
    }

    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
    btnGuardar.disabled = true; btnGuardar.style.opacity = "0.7";

    try {
        await addDoc(collection(db, "acontecimientos"), objetoAcontecimiento);
        document.getElementById('miModal').classList.add('hidden');
    } catch (error) {
        console.error(error);
        errorMsg.innerText = "Error de red al guardar.";
        btnGuardar.innerHTML = 'Crear'; btnGuardar.disabled = false; btnGuardar.style.opacity = "1";
    }
};

window.eliminarAcontecimiento = (eventoId) => {
    const ev = window.mapaEventos[eventoId];
    if (!ev) return;
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    document.getElementById('modalMsg').innerText = "¿Eliminar acontecimiento?";
    
    extra.innerHTML = `<p style="color: #666; font-size: 14px; text-align: left;">Estás a punto de eliminar <strong>${ev.titulo}</strong>. Se borrará para todos los miembros.</p>`;
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>
        <button id="btn-confirmar-eliminar-ev" onclick="window.confirmarEliminarAcontecimiento('${eventoId}')" style="background: #ef5350; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Eliminar</button>
    `;
};

window.confirmarEliminarAcontecimiento = async (eventoId) => {
    const btn = document.getElementById('btn-confirmar-eliminar-ev');
    if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; btn.style.opacity = "0.7"; }
    try {
        await deleteDoc(doc(db, "acontecimientos", eventoId));
        document.getElementById('miModal').classList.add('hidden');
    } catch(error) {
        console.error(error); alert("Hubo un problema al eliminar.");
    }
};

window.editarAcontecimiento = async (eventoId) => {
    const ev = window.mapaEventos[eventoId];
    if (!ev) return;
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    document.getElementById('modalMsg').innerText = "Editar Acontecimiento";
    extra.innerHTML = "<p style='text-align:center; color:#999;'><i class='fas fa-spinner fa-spin'></i> Abriendo editor...</p>";
    btns.innerHTML = "";
    
    try {
        const uSnap = await getDoc(doc(db, "usuarios", idActivo));
        let opcionesTrabajo = '<option value="">Selecciona qué trabajo es...</option>';
        if (uSnap.exists()) {
            const uData = uSnap.data();
            const listaTrabajos = uData.trabajos || uData.empleos || (uData.trabajo ? [uData.trabajo] : []);
            if (Array.isArray(listaTrabajos) && listaTrabajos.length > 0) listaTrabajos.forEach(t => opcionesTrabajo += `<option value="${t}">${t}</option>`);
            else if (typeof listaTrabajos === 'string' && listaTrabajos.trim() !== '') opcionesTrabajo += `<option value="${listaTrabajos}">${listaTrabajos}</option>`;
            else opcionesTrabajo += `<option value="Mi trabajo principal">Mi trabajo principal</option>`;
        }

        const inputStyle = "width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; margin-bottom: 12px; outline: none;";
        const labelStyle = "display: block; font-size: 12px; color: #777; font-weight: bold; margin-bottom: 4px; text-align: left;";

        extra.innerHTML = `
            <div style="max-height: 420px; overflow-y: auto; padding-right: 5px;">
                <label style="${labelStyle}">Título *</label><input type="text" id="event-titulo" style="${inputStyle}">
                <label style="${labelStyle}">Tipo *</label>
                <select id="event-tipo" onchange="window.toggleCamposTipoEvento()" style="${inputStyle} background: white; cursor: pointer;">
                    <option value="Trabajo">Trabajo</option><option value="Escuela">Escuela</option><option value="Tarea">Tarea</option>
                    <option value="Evento">Evento</option><option value="Viaje">Viaje</option><option value="Otro">Otro</option>
                </select>
                <div id="bloque-tipo-otro" style="display: none;"><label style="${labelStyle}">Especifica qué es *</label><input type="text" id="event-tipo-otro" style="${inputStyle}"></div>
                <div id="bloque-trabajo" style="display: block;"><label style="${labelStyle}">Selecciona tu trabajo *</label><select id="event-trabajo-select" style="${inputStyle}">${opcionesTrabajo}</select></div>
                <label style="${labelStyle}">Lugar (Opcional)</label><input type="text" id="event-lugar" style="${inputStyle}">
                <div id="bloque-fecha-normal">
                    <label style="${labelStyle}">Fecha *</label><input type="date" id="event-fecha" style="${inputStyle}">
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;"><label style="${labelStyle}">Inicio *</label><input type="time" id="event-hora-inicio" style="${inputStyle}"></div>
                        <div style="flex: 1;"><label style="${labelStyle}">Fin *</label><input type="time" id="event-hora-fin" style="${inputStyle}"></div>
                    </div>
                </div>
                <div id="bloque-fecha-viaje" style="display: none;">
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;"><label style="${labelStyle}">Fecha Ida *</label><input type="date" id="event-fecha-ida" style="${inputStyle}"></div>
                        <div style="flex: 1;"><label style="${labelStyle}">Hora Ida *</label><input type="time" id="event-hora-ida" style="${inputStyle}"></div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;"><label style="${labelStyle}">Fecha Vuelta *</label><input type="date" id="event-fecha-vuelta" style="${inputStyle}"></div>
                        <div style="flex: 1;"><label style="${labelStyle}">Hora Vuelta *</label><input type="time" id="event-hora-vuelta" style="${inputStyle}"></div>
                    </div>
                </div>
                <p id="error-evento" style="color: #ef5350; font-size: 12px; margin: 0; min-height: 15px; font-weight: bold;"></p>
            </div>
        `;

        btns.innerHTML = `
            <button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>
            <button id="btn-guardar-edicion" onclick="window.guardarEdicionAcontecimiento('${eventoId}')" style="background: #2196F3; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Guardar</button>
        `;

        document.getElementById('event-titulo').value = ev.titulo || '';
        document.getElementById('event-lugar').value = ev.lugar || '';
        const tipoSelect = document.getElementById('event-tipo');
        if (ev.categoria_original) tipoSelect.value = ev.categoria_original;
        else if (["Trabajo", "Escuela", "Tarea", "Evento", "Viaje"].includes(ev.tipo)) tipoSelect.value = ev.tipo;
        else { tipoSelect.value = "Otro"; document.getElementById('event-tipo-otro').value = ev.tipo; }
        
        window.toggleCamposTipoEvento(); 
        if (tipoSelect.value === "Trabajo" && ev.trabajo_seleccionado) document.getElementById('event-trabajo-select').value = ev.trabajo_seleccionado;

        if (ev.esViaje) {
            document.getElementById('event-fecha-ida').value = ev.fechaIda || ''; document.getElementById('event-fecha-vuelta').value = ev.fechaVuelta || '';
            document.getElementById('event-hora-ida').value = ev.horaIda || ''; document.getElementById('event-hora-vuelta').value = ev.horaVuelta || '';
        } else {
            document.getElementById('event-fecha').value = ev.fecha || '';
            document.getElementById('event-hora-inicio').value = ev.horaInicio || ev.hora_inicio || '';
            document.getElementById('event-hora-fin').value = ev.horaFin || ev.hora_fin || '';
        }
    } catch (error) { console.error(error); }
};

window.guardarEdicionAcontecimiento = async (eventoId) => {
    const errorMsg = document.getElementById('error-evento');
    const btnGuardar = document.getElementById('btn-guardar-edicion');
    const titulo = document.getElementById('event-titulo').value.trim();
    const tipoSeleccionado = document.getElementById('event-tipo').value;
    const lugar = document.getElementById('event-lugar').value.trim();

    if (titulo === "") { errorMsg.innerText = "Escribe un título."; return; }

    let tipoFinal = tipoSeleccionado; let trabajoElegido = "";
    if (tipoSeleccionado === "Otro") {
        const txtOtro = document.getElementById('event-tipo-otro').value.trim();
        if (txtOtro === "") { errorMsg.innerText = "Especifica el tipo."; return; }
        tipoFinal = txtOtro;
    }
    if (tipoSeleccionado === "Trabajo") {
        trabajoElegido = document.getElementById('event-trabajo-select').value;
        if (!trabajoElegido) { errorMsg.innerText = "Selecciona un trabajo."; return; }
    }

    let objetoUpdate = { titulo: titulo, tipo: tipoFinal, categoria_original: tipoSeleccionado, lugar: lugar === "" && tipoSeleccionado === "Trabajo" ? trabajoElegido : lugar };
    if (tipoSeleccionado === "Trabajo") objetoUpdate.trabajo_seleccionado = trabajoElegido;

    if (tipoSeleccionado === "Viaje") {
        const fechaIda = document.getElementById('event-fecha-ida').value; const fechaVuelta = document.getElementById('event-fecha-vuelta').value;
        const horaIda = document.getElementById('event-hora-ida').value; const horaVuelta = document.getElementById('event-hora-vuelta').value;

        if (!fechaIda || !fechaVuelta || !horaIda || !horaVuelta) { errorMsg.innerText = "Fechas y horas obligatorias."; return; }
        if (new Date(fechaVuelta) < new Date(fechaIda)) { errorMsg.innerText = "La vuelta no puede ser antes de la ida."; return; }

        objetoUpdate.esViaje = true; objetoUpdate.fechaIda = fechaIda; objetoUpdate.fechaVuelta = fechaVuelta; objetoUpdate.horaIda = horaIda; objetoUpdate.horaVuelta = horaVuelta;
    } else {
        const fecha = document.getElementById('event-fecha').value;
        const horaInicio = document.getElementById('event-hora-inicio').value; const horaFin = document.getElementById('event-hora-fin').value;

        if (!fecha || !horaInicio || !horaFin) { errorMsg.innerText = "Fecha y horas obligatorias."; return; }
        objetoUpdate.esViaje = false; objetoUpdate.fecha = fecha; objetoUpdate.horaInicio = horaInicio; objetoUpdate.horaFin = horaFin;
    }

    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btnGuardar.disabled = true; btnGuardar.style.opacity = "0.7";

    try {
        await updateDoc(doc(db, "acontecimientos", eventoId), objetoUpdate);
        document.getElementById('miModal').classList.add('hidden');
    } catch (error) {
        console.error(error); errorMsg.innerText = "Error de red.";
        btnGuardar.innerHTML = 'Guardar'; btnGuardar.disabled = false; btnGuardar.style.opacity = "1";
    }
};

// =========================================================================
// 8. FUNCIONALIDADES DE FILTRO Y COLORES
// =========================================================================
window.dibujarFiltroMiembros = () => {
    const container = document.getElementById('filtro-miembros-container');
    if (!container) return;
    let html = '';
    const miembrosList = datosCalendario.miembros || [];
    miembrosList.forEach(mId => {
        const u = window.mapaPerfilesMiembros[mId] || {};
        const nombreSeguro = u.nombre || "Usuario"; 
        const colorClass = mapaColores[mId] || 'c-negro';
        const estaActivo = window.miembrosFiltroActivos.includes(mId);
        
        const opacidad = estaActivo ? '1' : '0.4';
        const escala = estaActivo ? 'scale(1)' : 'scale(0.85)';
        const filtroVisual = estaActivo ? 'none' : 'grayscale(100%)';
        const inicial = nombreSeguro.charAt(0).toUpperCase();

        html += `
            <div onclick="window.toggleFiltroMiembro('${mId}')" style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.3s; opacity: ${opacidad}; transform: ${escala}; filter: ${filtroVisual}; flex-shrink: 0; width: 38px;">
                <div class="bg-${colorClass}" style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.15); margin-bottom: 4px;">
                    ${inicial}
                </div>
                <span style="font-size: 9px; color: #555; font-weight: 700; white-space: nowrap; max-width: 38px; overflow: hidden; text-overflow: ellipsis;">${nombreSeguro}</span>
            </div>
        `;
    });
    container.innerHTML = html;
};

window.toggleFiltroMiembro = (mId) => {
    if (window.miembrosFiltroActivos.includes(mId)) window.miembrosFiltroActivos = window.miembrosFiltroActivos.filter(id => id !== mId);
    else window.miembrosFiltroActivos.push(mId);
    window.dibujarFiltroMiembros(); renderizarCalendario();
};

async function asegurarColoresMiembros() {
    let necesitaActualizar = false;
    mapaColores = datosCalendario.colores_miembros || {};
    let coloresUsados = Object.values(mapaColores);
    const miembrosList = datosCalendario.miembros || [];

    miembrosList.forEach(miembroId => {
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
        if (vistaActual === "mes") fechaVisualizada.setMonth(fechaVisualizada.getMonth() + 1);
        else fechaVisualizada.setDate(fechaVisualizada.getDate() + 7);
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

// =========================================================================
// 9. FUNCIONES DE CONFIGURACIÓN, PRIVACIDAD, Y MIEMBROS
// =========================================================================
window.cambiarPrivacidad = async (checked) => {
    const inputPriv = document.getElementById('toggle-priv');
    if (inputPriv) {
        const fondoBoton = inputPriv.nextElementSibling; 
        if (fondoBoton) {
            fondoBoton.style.backgroundColor = checked ? '#ec407a' : '#ccc';
            const circuloBoton = fondoBoton.firstElementChild; 
            if (circuloBoton) circuloBoton.style.left = checked ? '23px' : '3px';
        }
    }
    try {
        const calRef = doc(db, "calendarios", calId);
        await updateDoc(calRef, { requiere_aprobacion: checked });
        datosCalendario.requiere_aprobacion = checked;
    } catch (error) {
        console.error("Error al cambiar privacidad:", error);
        alert("Hubo un error de conexión al guardar la privacidad.");
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

window.abrirModalConfig = async () => {
    const modal = document.getElementById('modal-config');
    const container = document.getElementById('config-container');
    if (!modal || !container) return;

    modal.classList.remove('hidden');
    container.innerHTML = "<p style='text-align:center; color:#999;'><i class='fas fa-spinner fa-spin'></i> Cargando ajustes...</p>";

    try {
        const docSnap = await getDoc(doc(db, "calendarios", calId));
        if (!docSnap.exists()) throw new Error("Calendario no encontrado");
        const datos = docSnap.data();

        const esTitular = datos.titular === idActivo;
        const esAdmin = datos.admins && datos.admins.includes(idActivo);

        if (!esTitular && !esAdmin) {
            container.innerHTML = "<p style='color:red; text-align:center;'>No tienes permisos para ver esto.</p>"; return;
        }

        const promesas = datos.miembros.map(mId => getDoc(doc(db, "usuarios", mId)));
        const docs = await Promise.all(promesas);
        let miembrosData = [];
        docs.forEach(d => { if (d.exists()) miembrosData.push({ id: d.id, ...d.data() }); });

        const btnStyle = "width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; margin-left: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white;";
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
                <button class="btn-icono-accion" onclick="editarNombreCalendario(); document.activeElement.blur();" style="${btnStyle}"><i class="fas fa-pencil-alt"></i></button>
            </div>
            <hr style="border: none; border-top: 1px solid #fce4ec; margin: 12px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="min-width: 0; flex: 1;">
                    <span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Código</span>
                    <div style="font-size: 16px; font-weight: bold; color: #ec407a; margin-top: 2px; letter-spacing: 2px;">${datos.codigo_acceso || '---'}</div>
                </div>
                <div style="display: flex; flex-shrink: 0;">
                    ${esTitular ? `
                    <button class="btn-icono-accion" onclick="generarCodigoAleatorio(); document.activeElement.blur();" style="${btnStyle}" title="Nuevo código"><i class="fas fa-sync-alt"></i></button>
                    <button class="btn-icono-accion" onclick="editarCodigoInvitacion(); document.activeElement.blur();" style="${btnStyle}" title="Editar código"><i class="fas fa-pencil-alt"></i></button>
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
            ` : `<i class="fas fa-lock" style="color:#ccc; margin-left: 10px; font-size: 16px;"></i>`}
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

window.editarNombreCalendario = () => {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    if (!modal) return;
    const nombreActual = datosCalendario ? datosCalendario.nombre : "";
    msg.innerText = "Cambiar nombre del calendario";
    extra.innerHTML = `
        <input type="text" id="input-nuevo-nombre" value="${nombreActual}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 15px; outline: none; margin-bottom: 10px;" autocomplete="off">
        <p id="error-nombre" style="color: #ef5350; font-size: 12px; margin: 0; min-height: 15px;"></p>
    `;
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>
        <button id="btn-guardar-nombre" onclick="guardarNuevoNombreCalendario()" style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Guardar</button>
    `;
    modal.classList.remove('hidden');
};

window.guardarNuevoNombreCalendario = async () => {
    const input = document.getElementById('input-nuevo-nombre');
    const errorMsg = document.getElementById('error-nombre');
    const btnGuardar = document.getElementById('btn-guardar-nombre');
    if (!input) return;
    const nuevoNombre = input.value.trim();
    if (nuevoNombre === "") { errorMsg.innerText = "El nombre no puede estar vacío."; return; }

    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btnGuardar.disabled = true;
    try {
        await updateDoc(doc(db, "calendarios", calId), { nombre: nuevoNombre });
        document.getElementById('miModal').classList.add('hidden');
        await window.abrirModalConfig();
    } catch (error) {
        errorMsg.innerText = "Hubo un error de conexión."; btnGuardar.innerHTML = 'Guardar'; btnGuardar.disabled = false;
    }
};

window.editarCodigoInvitacion = () => {
    const modal = document.getElementById('miModal');
    const msg = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    if (!modal) return;
    const codigoActual = datosCalendario ? (datosCalendario.codigo_acceso || "") : "";
    msg.innerText = "Cambiar código de invitación";
    extra.innerHTML = `
        <input type="text" id="input-nuevo-codigo" value="${codigoActual}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 15px; outline: none; margin-bottom: 10px;" autocomplete="off">
        <p id="error-codigo" style="color: #ef5350; font-size: 12px; margin: 0; min-height: 15px;"></p>
    `;
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>
        <button id="btn-guardar-codigo" onclick="guardarNuevoCodigoInvitacion()" style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Guardar</button>
    `;
    modal.classList.remove('hidden');
};

window.guardarNuevoCodigoInvitacion = async () => {
    const input = document.getElementById('input-nuevo-codigo');
    const errorMsg = document.getElementById('error-codigo');
    const btnGuardar = document.getElementById('btn-guardar-codigo');
    if (!input) return;
    const valorInput = input.value.trim();
    if (valorInput === "") { errorMsg.innerText = "Inserte el nuevo código de invitación."; return; }
    const nuevoCodigo = valorInput.toUpperCase();
    if (nuevoCodigo.length < 6 || nuevoCodigo.length > 10) { errorMsg.innerText = "El código debe tener entre 6 y 10 caracteres."; return; }

    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btnGuardar.disabled = true;
    try {
        await updateDoc(doc(db, "calendarios", calId), { codigo_acceso: nuevoCodigo });
        document.getElementById('miModal').classList.add('hidden');
        await window.abrirModalConfig();
    } catch (error) {
        errorMsg.innerText = "Error al guardar."; btnGuardar.innerHTML = 'Guardar'; btnGuardar.disabled = false;
    }
};

window.generarCodigoAleatorio = () => {
    const modal = document.getElementById('miModal');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    if (!modal) return;
    document.getElementById('modalMsg').innerText = "¿Generar código aleatorio?";
    extra.innerHTML = `<p style="color: #666; font-size: 14px; text-align: left;">¿Estás seguro de que quieres generar un nuevo código aleatorio?</p>`;
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>
        <button id="btn-confirmar-aleatorio" onclick="confirmarCodigoAleatorio()" style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Aceptar</button>
    `;
    modal.classList.remove('hidden');
};

window.confirmarCodigoAleatorio = async () => {
    const btnConfirmar = document.getElementById('btn-confirmar-aleatorio');
    if (!btnConfirmar) return;
    btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btnConfirmar.disabled = true;
    let codigoAleatorio = "";
    for (let i = 0; i < 9; i++) codigoAleatorio += Math.floor(Math.random() * 10).toString();
    try {
        await updateDoc(doc(db, "calendarios", calId), { codigo_acceso: codigoAleatorio });
        document.getElementById('miModal').classList.add('hidden');
        await window.abrirModalConfig();
    } catch (error) {
        alert("Error al generar código."); btnConfirmar.innerHTML = 'Aceptar'; btnConfirmar.disabled = false;
    }
};

window.toggleAdmin = (miembroId, esAdminActual) => {
    const modal = document.getElementById('miModal');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    if (!modal) return;
    const accionTexto = esAdminActual ? "quitarle el rol de Administrador a" : "hacer Administrador a";
    document.getElementById('modalMsg').innerText = `¿Deseas ${accionTexto} este usuario?`;
    extra.innerHTML = `<p style="color: #666; font-size: 14px; text-align: left;">Los administradores pueden gestionar el calendario.</p>`;
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>
        <button id="btn-confirmar-admin" onclick="confirmarToggleAdmin('${miembroId}', ${esAdminActual})" style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Aceptar</button>
    `;
    modal.classList.remove('hidden');
};

window.confirmarToggleAdmin = async (miembroId, esAdminActual) => {
    try {
        let adminsActuales = datosCalendario.admins || [];
        if (esAdminActual) adminsActuales = adminsActuales.filter(id => id !== miembroId);
        else if (!adminsActuales.includes(miembroId)) adminsActuales.push(miembroId);
        await updateDoc(doc(db, "calendarios", calId), { admins: adminsActuales });
        document.getElementById('miModal').classList.add('hidden');
        await window.abrirModalConfig();
    } catch (error) {
        alert("Hubo un error al cambiar los permisos.");
    }
};

window.expulsarMiembro = (miembroId, nombreMiembro) => {
    const modal = document.getElementById('miModal');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    if (!modal) return;
    document.getElementById('modalMsg').innerText = `¿Eliminar a ${nombreMiembro}?`;
    extra.innerHTML = `<p style="color: #666; font-size: 14px; text-align: left;">Estás a punto de expulsar a <strong>${nombreMiembro}</strong> del calendario.</p>`;
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>
        <button id="btn-confirmar-expulsion" onclick="confirmarExpulsion('${miembroId}')" style="background: #ef5350; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Expulsar</button>
    `;
    modal.classList.remove('hidden');
};

window.confirmarExpulsion = async (miembroId) => {
    try {
        let miembrosActuales = datosCalendario.miembros || [];
        miembrosActuales = miembrosActuales.filter(id => id !== miembroId);
        let adminsActuales = datosCalendario.admins || [];
        adminsActuales = adminsActuales.filter(id => id !== miembroId);
        let coloresActuales = datosCalendario.colores_miembros || {};
        if (coloresActuales[miembroId]) delete coloresActuales[miembroId];

        await updateDoc(doc(db, "calendarios", calId), { miembros: miembrosActuales, admins: adminsActuales, colores_miembros: coloresActuales });
        document.getElementById('miModal').classList.add('hidden');
    } catch (error) {
        alert("Hubo un error al intentar eliminar al miembro.");
    }
};

window.iniciarTraspasoTitular = async () => {
    const modal = document.getElementById('miModal');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    if (!modal) return;
    document.getElementById('modalMsg').innerText = "Traspasar titularidad";
    extra.innerHTML = "<p style='text-align:center; color:#999;'><i class='fas fa-spinner fa-spin'></i> Cargando miembros...</p>";
    btns.innerHTML = `<button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>`;
    modal.classList.remove('hidden');

    try {
        const promesas = datosCalendario.miembros.map(mId => getDoc(doc(db, "usuarios", mId)));
        const docs = await Promise.all(promesas);
        let miembrosCandidatos = [];
        docs.forEach(d => { if (d.exists() && d.id !== idActivo) miembrosCandidatos.push({ id: d.id, ...d.data() }); });

        if (miembrosCandidatos.length === 0) {
            extra.innerHTML = `<p style="color: #ef5350; font-size: 14px;">No puedes traspasar la titularidad porque eres el único miembro.</p>`; return;
        }

        let htmlContenido = `<div style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; padding-right: 5px; text-align: left;">`;
        miembrosCandidatos.forEach(miembro => {
            htmlContenido += `
                <label style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 15px; border: 1px solid #eee; border-radius: 8px; cursor: pointer; background: #fafafa;">
                    <span style="font-size: 14px; font-weight: bold; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${miembro.nombre} ${miembro.apellidos || ''}</span>
                    <input type="radio" name="radio-nuevo-titular" value="${miembro.id}" onchange="window.desbloquearBotonTraspaso()" style="accent-color: #ec407a; cursor: pointer; width: 18px; height: 18px;">
                </label>
            `;
        });
        htmlContenido += `</div>`;
        extra.innerHTML = htmlContenido;
        btns.innerHTML += `<button id="btn-ejecutar-traspaso" disabled style="background: #ef5350; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: default; opacity: 0.5;">Confirmar</button>`;
    } catch (error) {
        extra.innerHTML = "<p style='color:red; text-align:center;'>Error al cargar.</p>";
    }
};

window.desbloquearBotonTraspaso = () => {
    const btn = document.getElementById('btn-ejecutar-traspaso');
    const seleccionado = document.querySelector('input[name="radio-nuevo-titular"]:checked');
    if (seleccionado && btn) {
        btn.disabled = false; btn.style.opacity = "1"; btn.style.cursor = "pointer";
        btn.onclick = () => window.procesarTraspasoTitularDefinitivo(seleccionado.value);
    }
};

window.procesarTraspasoTitularDefinitivo = async (nuevoTitularId) => {
    try {
        let miembrosActuales = datosCalendario.miembros || [];
        miembrosActuales = miembrosActuales.filter(id => id !== idActivo);
        let adminsActuales = datosCalendario.admins || [];
        adminsActuales = adminsActuales.filter(id => id !== idActivo);
        let coloresActuales = datosCalendario.colores_miembros || {};
        if (coloresActuales[idActivo]) delete coloresActuales[idActivo];

        await updateDoc(doc(db, "calendarios", calId), { titular: nuevoTitularId, miembros: miembrosActuales, admins: adminsActuales, colores_miembros: coloresActuales });
        window.location.href = "dashboard.html";
    } catch (error) {
        alert("Hubo un error de conexión al intentar procesar el traspaso.");
    }
};

window.eliminarCalendarioDefinitivo = () => {
    const modal = document.getElementById('miModal');
    const extra = document.getElementById('modalExtra');
    const btns = document.getElementById('modalBtnsContainer');
    if (!modal) return;
    document.getElementById('modalMsg').innerText = "¿Eliminar este calendario?";
    extra.innerHTML = `<p style="color: #666; font-size: 13px; text-align: left;">Al confirmar, este calendario se borrará de forma permanente de la base de datos.</p>`;
    btns.innerHTML = `
        <button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #f5f5f5; color: #666; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Cancelar</button>
        <button onclick="window.procesarBorradoCalendarioTotal()" style="background: #d32f2f; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Eliminar</button>
    `;
    modal.classList.remove('hidden');
};

window.procesarBorradoCalendarioTotal = async () => {
    try {
        await deleteDoc(doc(db, "calendarios", calId));
        localStorage.removeItem('calendario_activo');
        window.location.href = "dashboard.html";
    } catch (error) {
        alert("Hubo un problema de conexión al intentar eliminar el calendario.");
    }
};

window.abrirModalSolicitudes = async () => {
    const modal = document.getElementById('modal-solicitudes');
    const container = document.getElementById('lista-solicitudes-container');
    if (!modal || !container) return;

    container.innerHTML = "<p style='text-align:center; color:#999; margin-top:20px;'><i class='fas fa-spinner fa-spin'></i> Cargando solicitudes...</p>";
    modal.classList.remove('hidden');

    try {
        const listaSolicitudes = datosCalendario.solicitudes || [];
        if (listaSolicitudes.length === 0) {
            container.innerHTML = "<p style='text-align:center; color:#888; margin-top:40px;'>No hay solicitudes pendientes</p>"; return;
        }

        const promesas = listaSolicitudes.map(mId => getDoc(doc(db, "usuarios", mId)));
        const docs = await Promise.all(promesas);
        container.innerHTML = "";

        docs.forEach(d => {
            if (d.exists()) {
                const usuario = d.data();
                const fotoHtml = usuario.foto ? `<img src="${usuario.foto}" class="miembro-foto">` : `<div class="miembro-foto"><i class="fas fa-user"></i></div>`;
                const row = document.createElement('div');
                row.className = "miembro-row";
                row.innerHTML = `
                    <div class="miembro-info">${fotoHtml}<div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left;"><span class="miembro-nombre">${usuario.nombre} ${usuario.apellidos || ''}</span><span style="color:#999; font-size:11px;">Desea unirse</span></div></div>
                    <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center;">
                        <button class="btn-icono-accion" onclick="window.rechazarSolicitud('${d.id}')" style="color: #ef5350; width:32px; height:32px; border: 1px solid #ddd; border-radius:6px; background:white; cursor:pointer;"><i class="fas fa-times"></i></button>
                        <button class="btn-icono-accion" onclick="window.aceptarSolicitud('${d.id}')" style="color: #4CAF50; width:32px; height:32px; border: 1px solid #ddd; border-radius:6px; background:white; cursor:pointer;"><i class="fas fa-check"></i></button>
                    </div>
                `;
                container.appendChild(row);
            }
        });
    } catch (error) {
        container.innerHTML = "<p style='color:red; text-align:center;'>Error al cargar las solicitudes.</p>";
    }
};

window.cerrarModalSolicitudes = () => { document.getElementById('modal-solicitudes').classList.add('hidden'); };

window.aceptarSolicitud = async (solicitanteId) => {
    if (datosCalendario.miembros && datosCalendario.miembros.length >= 9) {
        const modalAlerta = document.getElementById('miModal');
        const extraAlerta = document.getElementById('modalExtra');
        const btnsAlerta = document.getElementById('modalBtnsContainer');
        if (modalAlerta) {
            document.getElementById('modalMsg').innerText = "Calendario Completo";
            extraAlerta.innerHTML = `<p style="color: #666; font-size: 14px; text-align: left;"><i class="fas fa-exclamation-circle" style="color: #ef5350;"></i> No puedes aceptar esta solicitud. El calendario ha alcanzado el límite máximo de 9 participantes.</p>`;
            btnsAlerta.innerHTML = `<button onclick="document.getElementById('miModal').classList.add('hidden');" style="background: #ec407a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">Entendido</button>`;
            modalAlerta.style.zIndex = "9999"; modalAlerta.classList.remove('hidden');
        }
        return; 
    }
    try {
        await updateDoc(doc(db, "calendarios", calId), { miembros: arrayUnion(solicitanteId), solicitudes: arrayRemove(solicitanteId) });
        await window.abrirModalSolicitudes();
    } catch (error) { console.error("Error al aceptar:", error); }
};

window.rechazarSolicitud = async (solicitanteId) => {
    try {
        await updateDoc(doc(db, "calendarios", calId), { solicitudes: arrayRemove(solicitanteId) });
        await window.abrirModalSolicitudes();
    } catch (error) { console.error("Error al rechazar:", error); }
};

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
        docs.forEach(d => { if (d.exists()) miembrosData.push({ id: d.id, ...d.data() }); });
        miembrosData.sort((a, b) => { if (a.id === idActivo) return -1; if (b.id === idActivo) return 1; return 0; });
        container.innerHTML = "";
        miembrosData.forEach(miembro => {
            const esYo = miembro.id === idActivo;
            const miColor = mapaColores[miembro.id] || 'c-negro';
            const estitular = datosCalendario.titular === miembro.id;
            const esAdmin = datosCalendario.admins && datosCalendario.admins.includes(miembro.id);
            let rolHtml = "";
            if (estitular) rolHtml = `<span style="color: #d32f2f; font-weight: 800; font-size: 12px; margin-top: 2px;">Titular</span>`;
            else if (esAdmin) rolHtml = `<span style="color: ${esYo ? '#ec407a' : '#f06292'}; font-weight: ${esYo ? '700' : '600'}; font-size: 11px; margin-top: 2px;">${esYo ? 'Eres Administrador' : 'Administrador'}</span>`;
            else rolHtml = `<span style="color: #999; font-weight: normal; font-size: 11px; margin-top: 2px;">Sin rol asignado</span>`;
            
            const fotoHtml = miembro.foto ? `<img src="${miembro.foto}" class="miembro-foto">` : `<div class="miembro-foto"><i class="fas fa-user"></i></div>`;
            const accionHtml = esYo ? `<button class="btn-icono-accion" onclick="mostrarSelectorColor()"><i class="fas fa-pencil-alt"></i></button>` : `<button class="btn-icono-accion" onclick='verPerfilUsuario(${JSON.stringify(miembro).replace(/'/g, "&#39;")})'><i class="fas fa-eye"></i></button>`;
            const tuBadge = esYo ? `<span style="color:#ec407a; font-weight:bold; font-size:15px; flex-shrink:0; margin-right: 12px;">(Tú)</span>` : '';

            const row = document.createElement('div');
            row.className = "miembro-row";
            row.innerHTML = `
                <div class="miembro-info">
                    ${fotoHtml}
                    <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; overflow: hidden; width: 100%;">
                        <div class="miembro-detalles" style="width: 100%;"><span class="miembro-nombre">${miembro.nombre} ${miembro.apellidos || ''}</span>${tuBadge}</div>
                        ${rolHtml}
                    </div>
                </div>
                <div class="miembro-actions"><div class="color-dot-indicator bg-${miColor}" style="width:16px; height:16px; min-width:16px; min-height:16px; border-radius:50%; flex-shrink:0; box-shadow:none; border:none;"></div>${accionHtml}</div>
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
        container.innerHTML = "<p style='color:red; text-align:center;'>Error al cargar.</p>";
    }
};

window.mostrarSelectorColor = () => {
    const box = document.getElementById('selector-colores-box');
    if (!box) return;
    if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
    const coloresOcupados = Object.entries(mapaColores).filter(([id, color]) => id !== idActivo).map(([id, color]) => color);
    box.innerHTML = "";
    box.classList.remove('hidden');
    COLORES_DISPONIBLES.forEach(color => {
        const dot = document.createElement('div');
        dot.className = `color-picker-dot bg-${color}`;
        dot.style.display = "flex"; dot.style.alignItems = "center"; dot.style.justifyContent = "center";
        if (coloresOcupados.includes(color)) {
            dot.style.cursor = "not-allowed"; dot.style.opacity = "0.5"; dot.innerHTML = `<i class="fas fa-lock" style="color: rgba(255,255,255,0.9); font-size: 12px;"></i>`;
        } else dot.onclick = () => cambiarMiColor(color);
        if (mapaColores[idActivo] === color) dot.style.border = "3px solid #333";
        box.appendChild(dot);
    });
};

window.cambiarMiColor = async (nuevoColor) => {
    mapaColores[idActivo] = nuevoColor;
    try {
        await updateDoc(doc(db, "calendarios", calId), { colores_miembros: mapaColores });
        abrirModalMiembros();
    } catch (error) { console.error("Error guardando nuevo color:", error); }
};

window.cerrarModalMiembros = () => { document.getElementById('modal-miembros').classList.add('hidden'); };

window.verPerfilUsuario = (user) => {
    const modal = document.getElementById('modal-perfil-miembro');
    const content = document.getElementById('perfil-miembro-content');
    const fotoHtml = user.foto ? `<img src="${user.foto}" style="width:110px; height:110px; border-radius:50%; object-fit:cover; margin:0 auto 15px auto; display:block; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">` : `<div style="width:110px; height:110px; border-radius:50%; background:#ddd; color:white; font-size:45px; display:flex; align-items:center; justify-content:center; margin:0 auto 15px auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"><i class="fas fa-user"></i></div>`;
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
