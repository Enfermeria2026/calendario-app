// 1. Importamos la base de datos centralizada y las herramientas
import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, addDoc, query, where } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// Funciones globales de carga
window.mostrarCarga = () => { const el = document.getElementById('pantalla-carga'); if(el) el.classList.remove('hidden'); };
window.ocultarCarga = () => { const el = document.getElementById('pantalla-carga'); if(el) el.classList.add('hidden'); };

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
            setTimeout(() => lanzarAviso("Solicitud enviada. El administrador se pondrá en contacto contigo."), 300);
        };

        container.appendChild(btnCan);
        container.appendChild(btnEnv);
        return;
    }

    const btnOk = document.createElement('button');
    btnOk.innerText = tipo === "ok" ? "Aceptar" : "Eliminar";
    if(tipo !== "ok") btnOk.style.background = "#ff4d4d";
    btnOk.onclick = () => { overlay.style.display = "none"; if(callback) callback(); };
    if(tipo === "confirmar") {
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
const idActivo = localStorage.getItem('usuario_activo');

// --- NUEVO: FUNCIÓN PARA CARGAR CALENDARIOS EN PANTALLA CON DISEÑO PROFESIONAL ---
async function cargarCalendarios() {
    const contenedor = document.getElementById('lista-calendarios');
    if (!contenedor) return;

    try {
        // Buscamos los calendarios donde el usuario activo sea miembro
        const q = query(collection(db, "calendarios"), where("miembros", "array-contains", idActivo));
        const snap = await getDocs(q);

        if (snap.empty) {
            contenedor.innerHTML = '<p style="color: #888; margin-top: 50px; text-align: center;">No tienes calendarios activos</p>';
            return;
        }

        contenedor.innerHTML = ""; // Limpiamos el texto de "no tienes calendarios"
        
        snap.forEach(docSnap => {
            const cal = docSnap.data();
            const div = document.createElement('div');
            
            // Reutilizamos la clase event-card para que tenga el borde rosa y la sombra
            div.className = "event-card"; 
            
            // Determinamos si somos el creador del calendario
            const esCreador = cal.creador === idActivo;
            
            // Construimos la nueva estructura de tarjeta detallada y visual
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
                    ${esCreador ? `<button class="btn-action-danger" id="btn-eliminar-${docSnap.id}">Eliminar</button>` : ''}
                </div>
            `;
            
            contenedor.appendChild(div);

            // Adjuntamos el event listener para Entrar
            document.getElementById(`btn-entrar-${docSnap.id}`).onclick = () => {
                localStorage.setItem('calendario_activo', docSnap.id);
                lanzarAviso(`Entrando al calendario: ${cal.nombre}... (Próximamente)`);
                // window.location.href = "vistaCalendario.html"; // Comentar hasta que tengamos el archivo
            };

            // Adjuntamos el event listener para Eliminar (solo si eres la creadora)
            if (esCreador) {
                document.getElementById(`btn-eliminar-${docSnap.id}`).onclick = () => {
                    lanzarAviso(`¿Eliminar el calendario "${cal.nombre}" para siempre?`, "confirmar", async () => {
                        window.mostrarCarga();
                        try {
                            // Borramos el calendario de Firebase
                            await deleteDoc(doc(db, "calendarios", docSnap.id));
                            // Recargamos la lista visual de calendarios
                            cargarCalendarios();
                        } catch (error) {
                            console.error("Error al eliminar calendario:", error);
                        } finally {
                            window.ocultarCarga();
                        }
                    });
                };
            }
        });

    } catch (error) {
        console.error("Error al cargar calendarios:", error);
    }
}

if(headerUser) {
    const nombre = localStorage.getItem('userName') || "Usuario";
    const apellidos = localStorage.getItem('userLastName') || "";
    headerUser.innerText = nombre + " " + apellidos;

    // Carga de Firebase real para el Dashboard
    if (idActivo) {
        window.mostrarCarga();
        getDoc(doc(db, "usuarios", idActivo)).then(docSnap => {
            if (docSnap.exists()) {
                const d = docSnap.data();
                headerUser.innerText = `${d.nombre} ${d.apellidos}`.trim();
                cargarCalendarios(); // <--- LLAMAMOS A LA FUNCIÓN AQUÍ
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

// --- LOGICA DE CALENDARIOS (DASHBOARD) ---
const btnCrear = document.getElementById('btn-crear');

if (btnCrear) {
    btnCrear.onclick = () => {
        // Generar código de 9 cifras aleatorio: de 100000000 a 999999999
        const codigoAleatorio = Math.floor(100000000 + Math.random() * 900000000);
        document.getElementById('cal-codigo').value = codigoAleatorio;
        
        // Limpiar campos
        document.getElementById('cal-nombre').value = "";
        document.getElementById('cal-desc').value = "";
        
        document.getElementById('modal-crear-calendario').style.display = 'flex';
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
            creador: idActivo,
            fecha_creacion: new Date().toISOString(),
            miembros: [idActivo],
            admins: [idActivo]
        });
        
        window.cerrarModalCalendario();
        lanzarAviso("¡Calendario creado con éxito!");
        cargarCalendarios(); // <--- RECARGAMOS LA LISTA AL CREAR UNO NUEVO
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
            lanzarAviso("Contraseña maestra:", "admin_pass");
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

// NUEVO: Enlace de recuperar contraseña en el Login
const linkOlvido = document.getElementById('link-olvido');
if (linkOlvido) {
    linkOlvido.onclick = (e) => {
        e.preventDefault();
        lanzarAviso("Recuperar Identificador", "recuperar");
    };
}

// --- ADMIN PANEL (LOGICA INDEPENDIENTE Y PROTEGIDA) ---
const listaAdmin = document.getElementById('lista-usuarios');
const listaCalendariosAdmin = document.getElementById('lista-calendarios-admin');
const buzonBtn = document.getElementById('btn-buzon');
const notifDot = document.getElementById('notif-dot');

// 1. CARGA DE USUARIOS
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
                btn.onclick = () => { lanzarAviso(`¿Borrar a ${u.nombre}?`, "confirmar", async () => { await deleteDoc(doc(db, "usuarios", d.id)); cargarUsuarios(); }); };
                item.appendChild(btn);
                listaAdmin.appendChild(item);
            });
        } catch (e) {
            console.error("Error al cargar usuarios:", e);
        }
    };
    cargarUsuarios();
}

// 2. CARGA DE CALENDARIOS (Separado del bloque de usuarios para que no dependan entre sí)
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
                
                // Le damos formato de tarjeta apilada para que NUNCA cree scroll horizontal
                item.style.cssText = "padding: 15px; border: 1px solid #eee; display: flex; flex-direction: column; gap: 10px; background: white; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); box-sizing: border-box; width: 100%;";
                
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; flex-wrap: wrap; gap: 5px;">
                        <strong style="color: #333; font-size: 16px;">${cal.nombre}</strong>
                        <span style="color: #ec407a; background: #fff0f5; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold;">Código: ${cal.codigo_acceso || '---'}</span>
                    </div>
                    <small style="color: #666; display: block;">
                        ${cal.descripcion || 'Sin descripción'}<br>
                        <i class="fas fa-users" style="margin-top: 6px;"></i> ${cal.miembros ? cal.miembros.length : 0} miembros
                    </small>
                `;
                
                const btn = document.createElement('button');
                btn.innerText = "Eliminar Calendario"; 
                // Botón ancho en la parte inferior para móvil
                btn.style.cssText = "background: #e53935; color: white; border: none; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 5px; transition: 0.3s;";
                
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

// 3. COMPROBACIÓN DEL BUZÓN (También aislado)
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
