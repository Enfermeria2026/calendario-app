// 1. Importamos la base de datos centralizada y las herramientas (NUEVO: arrayUnion)
import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, addDoc, query, where, updateDoc, arrayRemove, arrayUnion } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// Funciones globales de carga
window.mostrarCarga = () => { const el = document.getElementById('pantalla-carga'); if(el) el.classList.remove('hidden'); };
window.ocultarCarga = () => { const el = document.getElementById('pantalla-carga'); if(el) el.classList.add('hidden'); };

const idActivo = localStorage.getItem('usuario_activo');

// --- AUTO-LOGIN: REDIRECCIÓN AUTOMÁTICA ---
const rutaActual = window.location.pathname;
if (idActivo && (rutaActual.endsWith('index.html') || rutaActual === '/' || rutaActual === '')) {
    window.location.replace("dashboard.html");
}

// --- MODALES ---
function lanzarAviso(mensaje, tipo = "ok", callback = null) {
    const overlay = document.getElementById('miModal');
    const msgP = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const container = document.getElementById('modalBtnsContainer');
    if(!overlay) return;

    msgP.innerText = mensaje;
    if(extra) extra.innerHTML = "";
    container.innerHTML = "";
    overlay.style.display = "flex";

    // NUEVO: Modal para unirse a un calendario por código
    if (tipo === "unirse") {
        const inputCodigo = document.createElement('input');
        inputCodigo.type = "text";
        inputCodigo.placeholder = "Código de acceso (Ej: 123456789)";
        inputCodigo.className = "modal-input";
        inputCodigo.style.marginBottom = "15px";
        inputCodigo.style.textAlign = "center";
        inputCodigo.style.letterSpacing = "2px";
        inputCodigo.style.fontWeight = "bold";
        extra.appendChild(inputCodigo);

        const btnCan = document.createElement('button');
        btnCan.innerText = "Cancelar"; btnCan.style.background = "#aaa";
        btnCan.onclick = () => overlay.style.display = "none";

        const btnEntrar = document.createElement('button');
        btnEntrar.innerText = "Unirse";
        btnEntrar.onclick = () => {
            const cod = inputCodigo.value.trim();
            if(!cod) return;
            overlay.style.display = "none";
            if(callback) callback(cod); // Enviamos el código escrito al callback
        };

        container.appendChild(btnCan);
        container.appendChild(btnEntrar);
        return;
    }

    if (tipo === "admin_pass") {
        const inputPass = document.createElement('input');
        inputPass.type = "password";
        inputPass.placeholder = "Contraseña";
        inputPass.className = "modal-input";
        extra.appendChild(inputPass);

        const btnAtras = document.createElement('button');
        btnAtras.innerText = "Atras"; btnAtras.style.background = "#aaa";
        btnAtras.onclick = () => overlay.style.display = "none";

        const btnEntrar = document.createElement('button');
        btnEntrar.innerText = "Entrar";
        btnEntrar.onclick = () => {
            if (inputPass.value === "12345") {
                overlay.style.display = "none";
                window.location.href = "admin.html";
            } else {
                overlay.style.display = "none";
                setTimeout(() => { lanzarAviso("Contraseña incorrecta."); }, 300);
            }
        };
        container.appendChild(btnAtras);
        container.appendChild(btnEntrar);
        return;
    }

    if (tipo === "recuperar") {
        const inpNombre = document.createElement('input');
        inpNombre.placeholder = "Nombre"; inpNombre.className = "modal-input"; inpNombre.style.marginBottom = "10px";
        const inpApellidos = document.createElement('input');
        inpApellidos.placeholder = "Apellidos"; inpApellidos.className = "modal-input"; inpApellidos.style.marginBottom = "10px";
        const inpCorreo = document.createElement('input');
        inpCorreo.type = "email"; inpCorreo.placeholder = "Correo electrónico"; inpCorreo.className = "modal-input"; inpCorreo.style.marginBottom = "15px";

        extra.appendChild(inpNombre);
        extra.appendChild(inpApellidos);
        extra.appendChild(inpCorreo);

        const btnCan = document.createElement('button');
        btnCan.innerText = "Cancelar"; btnCan.style.background = "#aaa";
        btnCan.onclick = () => overlay.style.display = "none";

        const btnEnv = document.createElement('button');
        btnEnv.innerText = "Enviar Solicitud";
        btnEnv.onclick = async () => {
            if (!inpNombre.value || !inpApellidos.value || !inpCorreo.value) {
                alert("Por favor, rellena todos los campos.");
                return;
            }
            btnEnv.innerText = "Enviando...";
            btnEnv.disabled = true;
            await addDoc(collection(db, "solicitudes"), {
                nombre: inpNombre.value,
                apellidos: inpApellidos.value,
                correo: inpCorreo.value,
                fecha: new Date().toLocaleDateString()
            });
            overlay.style.display = "none";
            setTimeout(() => lanzarAviso("Solicitud enviada. El equipo de soporte se pondrá en contacto contigo."), 300);
        };

        container.appendChild(btnCan);
        container.appendChild(btnEnv);
        return;
    }

    const btnOk = document.createElement('button');
    btnOk.innerText = tipo === "ok" ? "Aceptar" : (tipo === "confirmar_salir" ? "Salir" : "Eliminar");
    if(tipo !== "ok") btnOk.style.background = "#ff4d4d";
    btnOk.onclick = () => { overlay.style.display = "none"; if(callback) callback(); };
    if(tipo === "confirmar" || tipo === "confirmar_salir") {
        const btnCan = document.createElement('button');
        btnCan.innerText = "Cancelar"; btnCan.style.background = "#aaa";
        btnCan.onclick = () => overlay.style.display = "none";
        container.appendChild(btnCan);
    }
    container.appendChild(btnOk);
}

// --- LOGICA DASHBOARD ---
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
if(menuToggle && sidebar) {
    menuToggle.onclick = () => sidebar.classList.toggle('active');
}

const headerUser = document.getElementById('header-usuario');


async function cargarCalendarios() {
    const contenedor = document.getElementById('lista-calendarios');
    if (!contenedor) return;

    try {
        const q = query(collection(db, "calendarios"), where("miembros", "array-contains", idActivo));
        const snap = await getDocs(q);

        if (snap.empty) {
            contenedor.innerHTML = '<p style="color: #888; margin-top: 50px; text-align: center;">No tienes calendarios activos</p>';
            return;
        }

        contenedor.innerHTML = "";
        
        snap.forEach(docSnap => {
            const cal = docSnap.data();
            const div = document.createElement('div');
            
            div.className = "event-card"; 
            
            const estitular = cal.titular === idActivo;
            
            div.innerHTML = `
                <div class="card-header">
                    <strong style="color: #333; font-size: 16px;">${cal.nombre}</strong> 
                    <small class="tag-pink">Código: ${cal.codigo_acceso || '---'}</small>
                </div>
                
                <p class="cal-desc">${cal.descripcion || "Sin descripción"}</p>
                
                <small class="cal-members">
                    <i class="fas fa-users"></i> ${cal.miembros ? cal.miembros.length : 0} miembros
                </small>
                
                <div class="card-actions">
                    <button class="btn-action-primary" id="btn-entrar-${docSnap.id}">Entrar</button>
                    <button class="${estitular ? 'btn-action-danger' : 'btn-action-secondary'}" id="btn-accion-${docSnap.id}">
                        ${estitular ? 'Eliminar' : 'Salir del calendario'}
                    </button>
                </div>
            `;
            
            contenedor.appendChild(div);

            // Acción Entrar
            document.getElementById(`btn-entrar-${docSnap.id}`).onclick = () => {
                localStorage.setItem('calendario_activo', docSnap.id);
                window.location.href = "vistaCalendario.html"; // ¡Ahora sí viaja a la nueva pantalla!
            };

            // Acción Dinámica (Eliminar / Salir)
            document.getElementById(`btn-accion-${docSnap.id}`).onclick = () => {
                if (estitular) {
                    lanzarAviso(`¡Atención! Esta acción eliminará definitivamente el calendario "${cal.nombre}" tanto para ti como para todos los miembros que forman parte de él. ¿Deseas continuar?`, "confirmar", async () => {
                        window.mostrarCarga();
                        try {
                            await deleteDoc(doc(db, "calendarios", docSnap.id));
                            cargarCalendarios();
                        } catch (error) {
                            console.error(error);
                        } finally {
                            window.ocultarCarga();
                        }
                    });
                } else {
                    lanzarAviso(`¿Deseas salir del calendario "${cal.nombre}"? Esta acción no es revertible. Si deseas volver a incorporarte en el futuro, necesitarás el código de invitación.`, "confirmar_salir", async () => {
                        window.mostrarCarga();
                        try {
                            const calRef = doc(db, "calendarios", docSnap.id);
                            await updateDoc(calRef, {
                                miembros: arrayRemove(idActivo)
                            });
                            cargarCalendarios();
                        } catch (error) {
                            console.error(error);
                        } finally {
                            window.ocultarCarga();
                        }
                    });
                }
            };
        });

    } catch (error) {
        console.error("Error al cargar calendarios:", error);
    }
}

if(headerUser) {
    const nombre = localStorage.getItem('userName') || "Usuario";
    const apellidos = localStorage.getItem('userLastName') || "";
    headerUser.innerText = nombre + " " + apellidos;

    if (idActivo) {
        window.mostrarCarga();
        getDoc(doc(db, "usuarios", idActivo)).then(docSnap => {
            if (docSnap.exists()) {
                const d = docSnap.data();
                headerUser.innerText = `${d.nombre} ${d.apellidos}`.trim();
                cargarCalendarios();
            }
        }).finally(() => {
            window.ocultarCarga();
        });
    }
}

const btnCerrar = document.getElementById('btn-cerrar-sesion');
if(btnCerrar) {
    btnCerrar.onclick = () => {
        localStorage.clear();
        window.location.href = 'index.html';
    };
}

// --- LOGICA DE CALENDARIOS (CREAR Y UNIRSE) ---
const btnCrear = document.getElementById('btn-crear');

if (btnCrear) {
    btnCrear.onclick = () => {
        const codigoAleatorio = Math.floor(100000000 + Math.random() * 900000000);
        document.getElementById('cal-codigo').value = codigoAleatorio;
        document.getElementById('cal-nombre').value = "";
        document.getElementById('cal-desc').value = "";
        document.getElementById('modal-crear-calendario').style.display = 'flex';
    };
}

// NUEVO: Lógica del botón "Unirse a un calendario" de la cabecera
const btnUnirse = document.querySelector('.btn-unirse');
if (btnUnirse) {
    btnUnirse.onclick = () => {
        lanzarAviso("Introduce el código de acceso del calendario:", "unirse", async (codigo) => {
            window.mostrarCarga();
            try {
                // Buscamos si existe un calendario con ese código
                const q = query(collection(db, "calendarios"), where("codigo_acceso", "==", codigo.toString()));
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    window.ocultarCarga();
                    setTimeout(() => lanzarAviso("El código introducido no existe. Revisa que sea correcto."), 300);
                } else {
                    const calDoc = snap.docs[0];
                    const calData = calDoc.data();
                    
                // Comprobamos si el usuario ya está dentro
                    if (calData.miembros && calData.miembros.includes(idActivo)) {
                        window.ocultarCarga();
                        setTimeout(() => lanzarAviso("Ya formas parte de este calendario."), 300);
                        return;
                    }

                    // --- NUEVO: COMPROBACIÓN DE PRIVACIDAD (REQUERIR APROBACIÓN) ---
                    if (calData.requiere_aprobacion === true) {
                        // Si ya envió una solicitud previamente, le avisamos para no duplicar
                        if (calData.solicitudes && calData.solicitudes.includes(idActivo)) {
                            window.ocultarCarga();
                            setTimeout(() => lanzarAviso("Tu solicitud de acceso ya está enviada y pendiente de aprobación."), 300);
                            return;
                        }

                        // Guardamos su ID en la lista de solicitudes pendientes
                        await updateDoc(doc(db, "calendarios", calDoc.id), {
                            solicitudes: arrayUnion(idActivo)
                        });

                        window.ocultarCarga();
                        setTimeout(() => lanzarAviso("La solicitud ya ha sido enviada al titular y administradores del calendario."), 300);
                        return; // Cortamos la función aquí para que NO se una directamente
                    }

                    
                    // --- NUEVA RESTRICCIÓN: LÍMITE DE 9 PARTICIPANTES ---
                    if (calData.miembros && calData.miembros.length >= 9) {
                        window.ocultarCarga();
                        setTimeout(() => lanzarAviso("No puedes unirte. Este calendario ha alcanzado el límite máximo de 9 participantes."), 300);
                        return;
                    }
                    // ----------------------------------------------------
                    
                    // Añadimos al usuario a la lista de miembros usando arrayUnion
                    await updateDoc(doc(db, "calendarios", calDoc.id), {
                        miembros: arrayUnion(idActivo)
                    });
                    // Recargamos la lista visual de calendarios
                    cargarCalendarios();
                    window.ocultarCarga();
                    setTimeout(() => lanzarAviso(`¡Te has unido con éxito al calendario "${calData.nombre}"!`), 300);
                }
            } catch (error) {
                console.error("Error al unirse:", error);
                window.ocultarCarga();
                setTimeout(() => lanzarAviso("Hubo un error al intentar unirse al calendario."), 300);
            }
        });
    };
}

window.cerrarModalCalendario = () => {
    document.getElementById('modal-crear-calendario').style.display = 'none';
};

window.copiarCodigo = () => {
    const codigoInput = document.getElementById('cal-codigo');
    navigator.clipboard.writeText(codigoInput.value).then(() => {
        lanzarAviso("¡Código copiado al portapapeles!");
    });
};

window.guardarCalendario = async () => {
    const nombre = document.getElementById('cal-nombre').value.trim();
    const desc = document.getElementById('cal-desc').value.trim();
    const codigo = document.getElementById('cal-codigo').value;

    if (!nombre) {
        lanzarAviso("El nombre del calendario es obligatorio.");
        return;
    }

    window.mostrarCarga();

    try {
        await addDoc(collection(db, "calendarios"), {
            nombre: nombre,
            descripcion: desc,
            codigo_acceso: codigo,
            titular: idActivo,
            fecha_creacion: new Date().toISOString(),
            miembros: [idActivo],
            admins: [idActivo]
        });
        
        window.cerrarModalCalendario();
        lanzarAviso("¡Calendario creado con éxito!");
        cargarCalendarios();
    } catch (error) {
        console.error("Error al crear calendario:", error);
        lanzarAviso("Hubo un error al crear el calendario.");
    } finally {
        window.ocultarCarga();
    }
};

// --- LOGICA REGISTRO ---
const btnRand = document.getElementById('btn-random');
if(btnRand) {
    btnRand.onclick = () => { document.getElementById('reg-id').value = Math.random().toString(36).substring(2, 7); };
}

const formReg = document.getElementById('registro-form');
if (formReg) {
    formReg.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('reg-id').value.toLowerCase().trim();
        const docSnap = await getDoc(doc(db, "usuarios", id));
        if (docSnap.exists()) {
            lanzarAviso("ID ya existe.");
        } else {
            await setDoc(doc(db, "usuarios", id), {
                nombre: document.getElementById('reg-nombre').value,
                apellidos: document.getElementById('reg-apellidos').value,
                fecha: document.getElementById('reg-fecha').value,
                userId: id,
                trabajos: [] 
            });
            lanzarAviso("¡Cuenta creada!", "ok", () => { window.location.href = "index.html"; });
        }
    };
}

// --- LOGICA LOGIN ---
const formLog = document.getElementById('login-form');
if (formLog) {
    formLog.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('login-id').value.trim();
        
        if (id.toLowerCase() === "administrador") {
            lanzarAviso("Contraseña de seguridad:", "admin_pass");
            return;
        }
        
        const userSnap = await getDoc(doc(db, "usuarios", id.toLowerCase()));
        if (userSnap.exists()) {
            const data = userSnap.data();
            localStorage.setItem('userName', data.nombre);
            localStorage.setItem('userLastName', data.apellidos);
            localStorage.setItem('usuario_activo', id.toLowerCase());
            window.location.href = "dashboard.html";
        } else {
            lanzarAviso("ID no encontrado.");
        }
    };
}

const linkOlvido = document.getElementById('link-olvido');
if (linkOlvido) {
    linkOlvido.onclick = (e) => {
        e.preventDefault();
        lanzarAviso("Recuperar Identificador", "recuperar");
    };
}


// =========================================================
// NUEVO: FUNCIONALIDAD DE LIMPIEZA TOTAL PARA EL ADMIN
// =========================================================
async function purgarDatosDeUsuario(userIdABorrar) {
    try {
        console.log("Iniciando purga de datos para el usuario:", userIdABorrar);

        // 1. ELIMINAR TODOS SUS ACONTECIMIENTOS
        const qEventos = query(collection(db, "acontecimientos"), where("userId", "==", userIdABorrar));
        const snapshotEventos = await getDocs(qEventos);
        const promesasEventos = [];
        snapshotEventos.forEach(docSnap => {
            promesasEventos.push(deleteDoc(doc(db, "acontecimientos", docSnap.id)));
        });
        await Promise.all(promesasEventos);
        console.log(`Se han borrado ${snapshotEventos.size} acontecimientos.`);

        // 2. SACARLO DE TODOS LOS CALENDARIOS
        const qCalendarios = query(collection(db, "calendarios"), where("miembros", "array-contains", userIdABorrar));
        const snapshotCalendarios = await getDocs(qCalendarios);
        const promesasCalendarios = [];
        snapshotCalendarios.forEach(docSnap => {
            promesasCalendarios.push(updateDoc(doc(db, "calendarios", docSnap.id), {
                miembros: arrayRemove(userIdABorrar),
                admins: arrayRemove(userIdABorrar),
                solicitudes: arrayRemove(userIdABorrar)
            }));
        });
        await Promise.all(promesasCalendarios);
        console.log(`El usuario ha sido expulsado de ${snapshotCalendarios.size} calendarios.`);

        return true; 
    } catch (error) {
        console.error("Error crítico al purgar datos del usuario:", error);
        return false;
    }
}


// --- ADMIN PANEL ---
const listaAdmin = document.getElementById('lista-usuarios');
const listaCalendariosAdmin = document.getElementById('lista-calendarios-admin');
const buzonBtn = document.getElementById('btn-buzon');
const notifDot = document.getElementById('notif-dot');

if (listaAdmin) {
    const cargarUsuarios = async () => {
        try {
            const snap = await getDocs(collection(db, "usuarios"));
            listaAdmin.innerHTML = "";
            snap.forEach(d => {
                const u = d.data();
                const item = document.createElement('div');
                item.style.cssText = "padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
                item.innerHTML = `<div><strong>${u.nombre} ${u.apellidos}</strong><br><small>${u.userId}</small></div>`;
                const btn = document.createElement('button');
                btn.innerText = "Borrar"; btn.style.width = "auto"; btn.style.background = "red";
                
                // --- NUEVO: IMPLEMENTADA LA BARREDORA ANTES DE BORRAR AL USUARIO ---
                btn.onclick = () => { 
                    lanzarAviso(`¿Borrar a ${u.nombre}?`, "confirmar", async () => { 
                        window.mostrarCarga();
                        try {
                            // 1. Limpiamos calendarios y eventos del usuario
                            await purgarDatosDeUsuario(d.id);
                            // 2. Borramos la cuenta de la colección usuarios
                            await deleteDoc(doc(db, "usuarios", d.id)); 
                            // 3. Recargamos la lista
                            cargarUsuarios(); 
                        } catch(e) {
                            console.error("Error al borrar usuario:", e);
                        } finally {
                            window.ocultarCarga();
                        }
                    }); 
                };
                
                item.appendChild(btn);
                listaAdmin.appendChild(item);
            });
        } catch (e) {
            console.error("Error al cargar usuarios:", e);
        }
    };
    cargarUsuarios();
}

if (listaCalendariosAdmin) {
    const cargarCalendariosAdmin = async () => {
        try {
            const snap = await getDocs(collection(db, "calendarios"));
            listaCalendariosAdmin.innerHTML = "";

            if (snap.empty) {
                listaCalendariosAdmin.innerHTML = "<p style='color: #888; padding: 15px; text-align: center;'>No hay calendarios creados en el sistema.</p>";
                return;
            }

            snap.forEach(d => {
                const cal = d.data();
                const item = document.createElement('div');
                item.style.cssText = "padding: 15px; border: 1px solid #eee; display: flex; flex-direction: column; gap: 10px; background: white; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); box-sizing: border-box; width: 100%;";
                
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; gap: 10px;">
                        <strong style="color: #333; font-size: 17px; word-break: break-word;">${cal.nombre}</strong>
                        <span style="color: #ec407a; background: #fff0f5; padding: 5px 8px; border-radius: 6px; font-size: 13px; font-weight: bold; white-space: nowrap; flex-shrink: 0;">
                            Código: ${cal.codigo_acceso || '---'}
                        </span>
                    </div>
                    <small style="color: #666; display: block; font-size: 14px;">
                        ${cal.descripcion || 'Sin descripción'}<br>
                        <i class="fas fa-users" style="margin-top: 8px;"></i> ${cal.miembros ? cal.miembros.length : 0} miembros
                    </small>
                `;
                
                const btn = document.createElement('button');
                btn.innerText = "Eliminar Calendario"; 
                btn.style.cssText = "background: #e53935; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 5px; transition: 0.3s;";
                
                btn.onclick = () => { 
                    lanzarAviso(`¿Eliminar el calendario "${cal.nombre}" permanentemente?`, "confirmar", async () => { 
                        window.mostrarCarga();
                        try {
                            await deleteDoc(doc(db, "calendarios", d.id)); 
                            cargarCalendariosAdmin(); 
                        } catch (e) {
                            console.error(e);
                        } finally {
                            window.ocultarCarga();
                        }
                    }); 
                };
                
                item.appendChild(btn);
                listaCalendariosAdmin.appendChild(item);
            });
        } catch (error) {
            console.error("Error al cargar calendarios en admin:", error);
        }
    };
    cargarCalendariosAdmin();
}

if (listaAdmin || listaCalendariosAdmin) {
    const comprobarBuzon = async () => {
        try {
            const snap = await getDocs(collection(db, "solicitudes"));
            if (notifDot) {
                notifDot.style.display = !snap.empty ? "block" : "none";
            }
            return snap;
        } catch (e) {
            console.error("Error en buzón:", e);
        }
    };
    comprobarBuzon();

    if (buzonBtn) {
        buzonBtn.onclick = async () => {
            const snap = await comprobarBuzon();
            const overlay = document.getElementById('miModal');
            const msgP = document.getElementById('modalMsg');
            const extra = document.getElementById('modalExtra');
            const container = document.getElementById('modalBtnsContainer');

            msgP.innerText = "Buzón de Solicitudes";
            extra.innerHTML = "";
            container.innerHTML = "";

            if (!snap || snap.empty) {
                extra.innerHTML = "<p style='color: #666; font-size: 14px;'>No hay solicitudes de recuperación pendientes.</p>";
            } else {
                snap.forEach(d => {
                    const s = d.data();
                    const item = document.createElement('div');
                    item.style.cssText = "padding: 12px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px; text-align: left; background: #fff5f8;";
                    item.innerHTML = `
                        <strong style="color: #333;">${s.nombre} ${s.apellidos}</strong><br>
                        <a href="mailto:${s.correo}" style="color: #ec407a; font-size: 14px;">${s.correo}</a><br>
                        <small style="color: #999;">${s.fecha}</small>
                    `;

                    const btnOk = document.createElement('button');
                    btnOk.innerText = "Marcar Resuelta";
                    btnOk.style.cssText = "background: #4CAF50; width: auto; padding: 6px 12px; font-size: 12px; margin-top: 8px;";
                    btnOk.onclick = async () => {
                        await deleteDoc(doc(db, "solicitudes", d.id));
                        overlay.style.display = "none";
                        comprobarBuzon();
                    };
                    item.appendChild(btnOk);
                    extra.appendChild(item);
                });
            }

            const btnCerrar = document.createElement('button');
            btnCerrar.innerText = "Cerrar Buzón";
            btnCerrar.style.background = "#aaa";
            btnCerrar.onclick = () => overlay.style.display = "none";
            container.appendChild(btnCerrar);

            overlay.style.display = "flex";
        };
    }
}
