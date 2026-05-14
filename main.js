// 1. Importamos la base de datos centralizada y las herramientas (Actualizado a v12.13.0)
import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

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
if(headerUser) {
    const nombre = localStorage.getItem('userName') || "Usuario";
    const apellidos = localStorage.getItem('userLastName') || "";
    headerUser.innerText = nombre + " " + apellidos;
}

const btnCerrar = document.getElementById('btn-cerrar-sesion');
if(btnCerrar) {
    btnCerrar.onclick = () => {
        localStorage.clear(); // Esto borra todo al salir, incluido el usuario_activo
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
                trabajos: [] // Dejamos la lista de trabajos vacía por defecto
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
            
            // ¡ESTAS SON LAS LÍNEAS MÁGICAS!
            localStorage.setItem('userName', data.nombre);
            localStorage.setItem('userLastName', data.apellidos);
            localStorage.setItem('usuario_activo', id.toLowerCase()); // Guardamos quién es para el perfil
            
            window.location.href = "dashboard.html";
        } else {
            lanzarAviso("ID no encontrado.");
        }
    };
}

// --- ADMIN PANEL ---
const listaAdmin = document.getElementById('lista-usuarios');
if (listaAdmin) {
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
}
