// 1. Importamos la base de datos centralizada y las herramientas (Añadido addDoc)
import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

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

    // NUEVO: Formulario de recuperación
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
            // Guardamos en Firebase en la colección 'solicitudes'
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

// Funciones globales de carga
window.mostrarCarga = () => { const el = document.getElementById('pantalla-carga'); if(el) el.classList.remove('hidden'); };
window.ocultarCarga = () => { const el = document.getElementById('pantalla-carga'); if(el) el.classList.add('hidden'); };

// --- LOGICA DASHBOARD ---
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
if(menuToggle && sidebar) {
    menuToggle.onclick = () => sidebar.classList.toggle('active');
}

const headerUser = document.getElementById('header-usuario');
const idActivo = localStorage.getItem('usuario_activo'); // Variable añadida

// NUEVO: Cargar datos reales en el dashboard
if (headerUser && idActivo) {
    window.mostrarCarga();
    
    // Función auto-ejecutable para consultar Firebase
    (async () => {
        try {
            const docRef = doc(db, "usuarios", idActivo);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                headerUser.innerText = `${data.nombre} ${data.apellidos}`.trim();
                // Aquí en un futuro cargarás "lista-calendarios"
            }
        } catch (error) {
            console.error("Error al cargar dashboard:", error);
        } finally {
            window.ocultarCarga();
        }
    })();
} else if (headerUser && !idActivo) {
    // Si no hay idActivo, lo mandamos al index
    window.location.href = "index.html";
}

const btnCerrar = document.getElementById('btn-cerrar-sesion');
if(btnCerrar) {
    btnCerrar.onclick = () => {
        localStorage.clear();
        window.location.href = 'index.html';
    };
}

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

// --- ADMIN PANEL ---
const listaAdmin = document.getElementById('lista-usuarios');
const buzonBtn = document.getElementById('btn-buzon');
const notifDot = document.getElementById('notif-dot');

if (listaAdmin) {
    // Función para cargar usuarios
    const cargar = async () => {
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

    // NUEVO: Función para comprobar el buzón
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

    // NUEVO: Al hacer clic en el buzón
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
