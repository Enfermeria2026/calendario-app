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

function lanzarAviso(mensaje, tipo = "ok", callback = null) {
    const overlay = document.getElementById('miModal');
    document.getElementById('modalMsg').innerText = mensaje;
    const container = document.getElementById('modalBtnsContainer');
    container.innerHTML = "";
    overlay.style.display = "flex";
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

const btnRandom = document.getElementById('btn-random');
if(btnRandom) {
    btnRandom.onclick = () => {
        const azar = Math.random().toString(36).substring(2, 7);
        document.getElementById('reg-id').value = azar;
    };
}

const formReg = document.getElementById('registro-form');
if (formReg) {
    formReg.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('reg-id').value.toLowerCase().trim();
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
            lanzarAviso("Cuenta creada. ID: " + id, "ok", () => { window.location.href = "index.html"; });
        }
    });
}

const formLog = document.getElementById('login-form');
if (formLog) {
    formLog.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('login-id').value.toLowerCase().trim();
        if (id === "administrador") {
            window.location.href = "admin.html";
            return;
        }
        const userSnap = await getDoc(doc(db, "usuarios", id));
        if (userSnap.exists()) {
            lanzarAviso("¡Hola " + userSnap.data().nombre + "!");
        } else {
            lanzarAviso("Identificador no encontrado.");
        }
    });
}

const lista = document.getElementById('lista-usuarios');
if (lista) {
    const cargar = async () => {
        const snap = await getDocs(collection(db, "usuarios"));
        lista.innerHTML = "";
        snap.forEach(d => {
            const u = d.data();
            const div = document.createElement('div');
            div.style.cssText = "padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
            div.innerHTML = `<div><strong>${u.nombre} ${u.apellidos}</strong><br><small>ID: ${u.userId}</small></div>
                             <button onclick="borrarTotal('${d.id}')" style="width:auto; background:#ff4d4d; padding:5px 15px;">Borrar</button>`;
            lista.appendChild(div);
        });
    };
    window.borrarTotal = (id) => {
        lanzarAviso("¿Borrar a " + id + "?", "confirmar", async () => {
            await deleteDoc(doc(db, "usuarios", id));
            cargar();
        });
    };
    cargar();
}
