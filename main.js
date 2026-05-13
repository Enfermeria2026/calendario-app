import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCARU84ybJ42rDV5W_UJr5NkwhO7BYvE3I",
    authDomain: "calendario-79929.firebaseapp.com",
    projectId: "calendario-79929",
    storageBucket: "calendario-79929.firebasestorage.app",
    messagingSenderId: "592556572094",
    appId: "1:592556572094:web:023aa4ee9feee18a0b4def"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- SISTEMA DE MODALES ---
function lanzarAviso(mensaje, tipo = "ok", callback = null) {
    const overlay = document.getElementById('miModal');
    const msgP = document.getElementById('modalMsg');
    const extra = document.getElementById('modalExtra');
    const container = document.getElementById('modalBtnsContainer');
    
    if(!overlay || !msgP || !container) return;

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
        btnAtras.innerText = "Atrás";
        btnAtras.style.background = "#aaa";
        btnAtras.onclick = () => overlay.style.display = "none";

        const btnEntrar = document.createElement('button');
        btnEntrar.innerText = "Entrar";
        btnEntrar.onclick = () => {
            if (inputPass.value === "12345") {
                overlay.style.display = "none";
                window.location.href = "admin.html";
            } else {
                lanzarAviso("Contraseña incorrecta. Prueba de nuevo.");
            }
        };
        container.appendChild(btnAtras);
        container.appendChild(btnEntrar);
        return;
    }

    const btnOk = document.createElement('button');
    btnOk.innerText = tipo === "ok" ? "Aceptar" : "Eliminar";
    if(tipo !== "ok") btnOk.style.background = "#ff4d4d";
    btnOk.onclick = () => {
        overlay.style.display = "none";
        if (callback) callback();
    };
    
    if(tipo === "confirmar") {
        const btnCan = document.createElement('button');
        btnCan.innerText = "Cancelar";
        btnCan.style.background = "#aaa";
        btnCan.onclick = () => overlay.style.display = "none";
        container.appendChild(btnCan);
    }
    container.appendChild(btnOk);
}

// --- LÓGICA DE REGISTRO ---
const btnRandom = document.getElementById('btn-random');
if(btnRandom) {
    btnRandom.onclick = () => {
        const azar = Math.random().toString(36).substring(2, 7);
        document.getElementById('reg-id').value = azar;
    };
}

const formReg = document.getElementById('registro-form');
if (formReg) {
    formReg.onsubmit = async (e) => {
        e.preventDefault();
        const idInput = document.getElementById('reg-id').value.toLowerCase().trim();
        try {
            const docRef = doc(db, "usuarios", idInput);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                lanzarAviso("Este Identificador ya existe. Elige otro.");
            } else {
                await setDoc(docRef, {
                    nombre: document.getElementById('reg-nombre').value,
                    apellidos: document.getElementById('reg-apellidos').value,
                    fecha: document.getElementById('reg-fecha').value,
                    userId: idInput
                });
                lanzarAviso("¡Cuenta creada! Tu ID es: " + idInput, "ok", () => {
                    window.location.href = "index.html";
                });
            }
        } catch (error) { lanzarAviso("Error al guardar: " + error.message); }
    };
}

// --- LÓGICA DE LOGIN ---
const formLog = document.getElementById('login-form');
if (formLog) {
    formLog.onsubmit = async (e) => {
        e.preventDefault();
        const idValue = document.getElementById('login-id').value.trim();

        if (idValue.toLowerCase() === "administrador") {
            lanzarAviso("Introduce la contraseña maestra:", "admin_pass");
            return;
        }

        try {
            const userSnap = await getDoc(doc(db, "usuarios", idValue.toLowerCase()));
            if (userSnap.exists()) {
                lanzarAviso("¡Hola " + userSnap.data().nombre + "! Bienvenida.");
            } else {
                lanzarAviso("Identificador no encontrado.");
            }
        } catch (error) { lanzarAviso("Error al conectar."); }
    };
}

// --- LÓGICA DEL PANEL ADMIN ---
const listaDiv = document.getElementById('lista-usuarios');
if (listaDiv) {
    const cargarUsuarios = async () => {
        listaDiv.innerHTML = "Cargando usuarios...";
        try {
            const snap = await getDocs(collection(db, "usuarios"));
            listaDiv.innerHTML = "";
            if(snap.empty) listaDiv.innerHTML = "No hay usuarios registrados.";

            snap.forEach(docSnap => {
                const u = docSnap.data();
                const item = document.createElement('div');
                item.style.cssText = "padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
                item.innerHTML = `
                    <div style="text-align:left;">
                        <strong>${u.nombre} ${u.apellidos}</strong><br>
                        <small style="color:#ec407a;">ID: ${u.userId}</small>
                    </div>
                `;
                
                const btnBorrar = document.createElement('button');
                btnBorrar.innerText = "Borrar";
                btnBorrar.style.cssText = "width:auto; background:#ff4d4d; padding:5px 15px; margin:0;";
                btnBorrar.onclick = () => {
                    lanzarAviso(`¿Eliminar a ${u.nombre}?`, "confirmar", async () => {
                        await deleteDoc(doc(db, "usuarios", docSnap.id));
                        cargarUsuarios();
                    });
                };

                item.appendChild(btnBorrar);
                listaDiv.appendChild(item);
            });
        } catch (err) { listaDiv.innerHTML = "Error al cargar."; }
    };
    cargarUsuarios();

    const btnCerrar = document.getElementById('btn-cerrar-sesion');
    if(btnCerrar) btnCerrar.onclick = () => window.location.href = 'index.html';
}
