import { db } from "./firebase-config.js";

import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";



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

        

        // Botón de configuración SOLO para admins/creador

        if (datosCalendario.creador === idActivo || (datosCalendario.admins && datosCalendario.admins.includes(idActivo))) {

            document.getElementById('btn-config').classList.remove('hidden');

            document.getElementById('btn-config').onclick = function() { 

                window.abrirModalConfig(); 

                this.blur(); 

            };

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

       

        if (vistaActual === "mes") {

            fechaVisualizada.setMonth(fechaVisualizada.getMonth() + 1);

        } else {

            fechaVisualizada.setDate(fechaVisualizada.getDate() + 7);

        }

        renderizarCalendario();

       

    };



    document.getElementById('btn-vista-mes').onclick = function() {

       

        if (vistaActual === "mes") return;

        vistaActual = "mes";

        document.getElementById('btn-vista-semana').classList.remove('active');

        this.classList.add('active');

        fechaVisualizada = new Date(fechaVisualizada.getFullYear(), fechaVisualizada.getMonth(), 1);

        renderizarCalendario();

      

    };



    document.getElementById('btn-vista-semana').onclick = function() {

       

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

                    const fVueltaClean = new Date(fVueltaDoc.getFullYear(), fVueltaDoc.getMonth(), fVueltaDoc.getDate());

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

        celda.onclick = () => abrirDetalleDia(fCelda);

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

        

        celda.onclick = () => abrirDetalleDia(diaSemana);

        

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



function abrirDetalleDia(fecha) {

    console.log("Día clickeado:", fecha.toLocaleDateString());

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

            

            const esCreador = datosCalendario.creador === miembro.id;

            const esAdmin = datosCalendario.admins && datosCalendario.admins.includes(miembro.id);



            let rolHtml = "";



            if (esYo) {

                if (esCreador) {

                    rolHtml = `<span style="color: #d32f2f; font-weight: 800; font-size: 12px; margin-top: 2px;">Creador</span>`;

                } else if (esAdmin) {

                    rolHtml = `<span style="color: #ec407a; font-weight: 700; font-size: 11px; margin-top: 2px;">Eres Administrador</span>`;

                } else {

                    rolHtml = `<span style="color: #999; font-weight: normal; font-size: 11px; margin-top: 2px;">Sin rol asignado</span>`;

                }

            } else {

                if (esCreador) {

                    rolHtml = `<span style="color: #d32f2f; font-weight: 800; font-size: 12px; margin-top: 2px;">Creador</span>`;

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



        // 2. Verificación de permisos

        const esCreador = datos.creador === idActivo;

        const esAdmin = datos.admins && datos.admins.includes(idActivo);



        if (!esCreador && !esAdmin) {

            container.innerHTML = "<p style='color:red; text-align:center;'>No tienes permisos para ver esto.</p>";

            return;

        }



        // 3. Carga de miembros

        const promesas = datos.miembros.map(mId => getDoc(doc(db, "usuarios", mId)));

        const docs = await Promise.all(promesas);

        let miembrosData = [];

        docs.forEach(d => { if (d.exists()) miembrosData.push({ id: d.id, ...d.data() }); });



        // 4. Estilos reutilizables para botones (para evitar solapamientos)

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

                    <button class="btn-icono-accion" onclick="editarNombreCalendario(); this.blur();" style="${btnStyle}">

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

                        ${esCreador ? `

                           <button class="btn-icono-accion" onclick="generarCodigoAleatorio(); this.blur();" style="${btnStyle}" title="Nuevo código">

    <i class="fas fa-sync-alt"></i>

</button>



<button class="btn-icono-accion" onclick="editarCodigoInvitacion(); this.blur();" style="${btnStyle}" title="Editar código">

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

                <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">

                    <input type="checkbox" id="toggle-priv" ${requiereAprobacion ? 'checked' : ''} onchange="cambiarPrivacidad(this.checked)" style="opacity: 0; width: 0; height: 0;">

                    <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${requiereAprobacion ? '#ec407a' : '#ccc'}; border-radius: 24px; transition: .3s;">

                        <span style="position: absolute; height: 18px; width: 18px; left: ${requiereAprobacion ? '23px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>

                    </span>

                </label>

            </div>

            

            <h3 style="margin: 15px 0 -5px 0; font-size: 16px; color: #333;">Gestión de Miembros</h3>

        `;



        let htmlMiembros = `<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">`;

        miembrosData.forEach(miembro => {

            const mEsCreador = datos.creador === miembro.id;

            const mEsAdmin = datos.admins && datos.admins.includes(miembro.id);

            const soyYo = miembro.id === idActivo;

            let rolTxt = mEsCreador ? `<span style="color: #d32f2f; font-size: 11px; font-weight: bold;">Creador</span>` : mEsAdmin ? `<span style="color: #ec407a; font-size: 11px; font-weight: bold;">Administrador</span>` : `<span style="color: #999; font-size: 11px;">Miembro</span>`;



            let botonesHtml = ``;

            if (!mEsCreador && !soyYo) {

                if (esCreador) {

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

        if (esCreador) {

            htmlZonaPeligro = `

                <div style="border: 1px solid #ffcdd2; background: #fff5f5; padding: 15px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">

                    <button onclick="iniciarTraspasoCreador(); document.activeElement.blur();" style="background: white; color: #d32f2f; border: 1px solid #d32f2f; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%;">Traspasar titularidad</button>

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
