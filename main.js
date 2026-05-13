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

// --- FUNCIÓN DE AVISOS ---
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
                alert("Contraseña incorrecta");
                inputPass.value = "";
            }
        };
        container.appendChild(btnAtras);
        container.appendChild(btnEntrar);
        return;
    }

    const btn = document.createElement('button');
    btn.innerText = tipo === "ok" ? "Aceptar" : "Eliminar";
    if(tipo !== "ok") btn.style.background = "#ff4d4d";
    btn.onclick = () => { overlay.style.display = "none"; if(callback) callback(); };
    
    if(tipo !== "ok") {
        const btnCan = document.createElement('button');
        btnCan.innerText = "Cancelar";
        btnCan.style.background = "#aaa";
        btnCan.onclick = () => overlay.style.display = "none";
        container.appendChild(btnCan);
    }
    container.appendChild(btn);
}

// --- BOTÓN AZAR ---
const btnRandom = document.getElementById('btn-random');
if(btnRandom) {
    btnRandom.addEventListener('click', () => {
        const azar = Math.random().toString(36).substring(2, 7);
        document.getElementById('reg-id').value = azar;
    });
}

// --- REGISTRO ---
const formReg = document.getElementById('registro-form');
if (formReg) {
    formReg.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('reg-id').value.toLowerCase().trim();
        try {
            const docRef = doc(db, "usuarios", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                lanzarAviso("Este Identificador ya existe.");
            } else {
                await setDoc(docRef, {
                    nombre: document.getElementById('reg-nombre').value,
                    apellidos: document.getElementById('reg-apellidos').value,
                    fecha: document.getElementById('reg-fecha').value,
                    userId: id
                });
                lanzarAviso("¡Cuenta creada! ID: " + id, "ok", () => {
                    window.location.href = "index.html";
                });
            }
        } catch (error) { lanzarAviso("Error: " + error.message); }
    });
}

// --- LOGIN ---
const formLog = document.getElementById('login-form');
if (formLog) {
    formLog.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idInput = document.getElementById('login-id').value.trim();

        if (idInput.toLowerCase() === "administrador") {
            lanzarAviso("Introduce la contraseña maestra:", "admin_pass");
            return;
        }

        try {
            const userSnap = await getDoc(doc(db, "usuarios", idInput.toLowerCase()));
            if (userSnap.exists()) {
                lanzarAviso("¡Hola " + userSnap.data().nombre + "!");
            } else {
                lanzarAviso("Identificador no encontrado.");
            }
        } catch (error) { lanzarAviso("Error al entrar."); }
    });
}

// --- ADMIN ---
const lista = document.getElementById('lista-usuarios');
if (lista) {
    const cargar = async () => {
        lista.innerHTML = "Cargando...";
        try {
            const snap = await getDocs(collection(db, "usuarios"));
            lista.innerHTML = "";
            snap.forEach(d => {
                const u = d.data();
                const div = document.createElement('div');
                div.style.cssText = "padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
                div.innerHTML = `
                    <div style="text-align:left;">
                        <strong>${u.nombre} ${u.apellidos}</strong><br>
                        <small style="color:#ec407a;">ID: ${u.userId}</small>
                    </div>
                    <button id="btn-del-${d.id}" style="width:auto; background:#ff4d4d; padding:5px 15px; margin:0;">Borrar</button>
                `;
                lista.appendChild(div);
                document.getElementById(`btn-del-${d.id}`).onclick = () => {
                    lanzarAviso("¿Borrar a " + u.nombre + "?", "confirmar", async () => {
                        await deleteDoc(doc(db, "usuarios", d.id));
                        cargar();
                    });
                };
            });
        } catch (error) { lista.innerHTML = "Error."; }
    };
    cargar();
}
