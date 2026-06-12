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
            div.style.cursor = "pointer";
            div.style.display = "flex";
            div.style.flexDirection = "column";
            div.style.alignItems = "flex-start";
            
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                    <strong style="font-size: 18px; color: #333;">${cal.nombre}</strong>
                    <span style="background: #fff0f5; color: #ec407a; padding: 5px 10px; border-radius: 8px; font-size: 13px; font-weight: bold;">
                        <i class="fas fa-users"></i> ${cal.miembros.length}
                    </span>
                </div>
                <p style="color: #666; font-size: 14px; margin-top: 8px; margin-bottom: 0;">${cal.descripcion || "Sin descripción"}</p>
            `;
            
            div.onclick = () => {
                localStorage.setItem('calendario_activo', docSnap.id);
                lanzarAviso(`Entrando al calendario: ${cal.nombre}... (Próximamente)`);
            };
            
            contenedor.appendChild(div);
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

// --- LOGICA DE CALENDARIOS (DASHBOARD) ---
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

const linkOlvido = document.getElementById('link-olvido');
if (linkOlvido) {
    linkOlvido.onclick = (e) => {
        e.preventDefault();
        lanzarAviso("Recuperar Identificador", "recuperar");
    };
}

// --- ADMIN PANEL (ACTUALIZADO CON CALENDARIOS) ---
const listaAdmin = document.getElementById('lista-usuarios');
const listaCalendariosAdmin = document.getElementById('lista-calendarios-admin'); // <--- NUEVA REFERENCIA
const buzonBtn = document.getElementById('btn-buzon');
const notifDot = document.getElementById('notif-dot');

if (listaAdmin || listaCalendariosAdmin) {
    const cargar = async () => {
        if (!listaAdmin) return;
        const snap = await getDocs(collection(db, "usuarios"));
        listaAdmin.innerHTML = "";
        snap.forEach(d => {
            const u = d.data();
            const item = document.createElement('div');
            item.style.cssText = "padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
            item.innerHTML = `<div><strong>${u.nombre} ${u.apellidos}</strong><br><small>${u.userId}</small></div>`;
            const btn = document.createElement('button');
            btn.innerText = "Borrar"; btn.style.width = "auto"; btn.style.background = "red";
            btn.onclick = () => { lanzarAviso(`¿Borrar a ${u.nombre}?`, "confirmar", async () => { await deleteDoc(doc(db, "usuarios", d.id)); cargar(); }); };
            item.appendChild(btn);
            listaAdmin.appendChild(item);
        });
    };
    cargar();

    // NUEVA FUNCIÓN: Cargar todos los calendarios en el panel de Admin
    const cargarCalendariosAdmin = async () => {
        if (!listaCalendariosAdmin) return;
        const snap = await getDocs(collection(db, "calendarios"));
        listaCalendariosAdmin.innerHTML = "";

        if (snap.empty) {
            listaCalendariosAdmin.innerHTML = "<p style='color: #888; padding: 15px; text-align: center;'>No hay calendarios creados en el sistema.</p>";
            return;
        }

        snap.forEach(d => {
            const cal = d.data();
            const item = document.createElement('div');
            item.style.cssText = "padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; text-align: left;";
            
            item.innerHTML = `
                <div>
                    <strong style="color: #333; font-size: 16px;">${cal.nombre}</strong> 
                    <small style="color: #ec407a; margin-left: 10px; font-weight: bold; background: #fff0f5; padding: 3px 8px; border-radius: 6px;">Código: ${cal.codigo_acceso || '---'}</small><br>
                    <small style="color: #666; display: block; margin-top: 5px;">${cal.descripcion || 'Sin descripción'} • <i class="fas fa-users"></i> ${cal.miembros ? cal.miembros.length : 0} miembros</small>
                </div>
            `;
            
            const btn = document.createElement('button');
            btn.innerText = "Eliminar"; btn.style.width = "auto"; btn.style.background = "red";
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
    };
    cargarCalendariosAdmin();

    const comprobarBuzon = async () => {
        const snap = await getDocs(collection(db, "solicitudes"));
        if (!snap.empty) {
            notifDot.style.display = "block";
        } else {
            notifDot.style.display = "none";
        }
        return snap;
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

            if (snap.empty) {
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
