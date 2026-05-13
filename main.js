import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCARU84ybJ42rDV5W_UJr5NkwhO7BYvE3I",
    authDomain: "calendario-79929.firebaseapp.com",
    projectId: "calendario-79929",
    storageBucket: "calendario-79929.firebasestorage.app",
    messagingSenderId: "592556572094",
    appId: "1:592556572094:web:023aa4ee9feee18a0b4def",
    measurementId: "G-Q3FNRQTECS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- FUNCIÓN DEL CUADRO ELEGANTE ---
function lanzarAviso(mensaje, tipo = "ok", callback = null) {
    const overlay = document.getElementById('miModal');
    const msgP = document.getElementById('modalMsg');
    const container = document.getElementById('modalBtnsContainer');

    if (!overlay) return;

    msgP.innerText = mensaje;
    container.innerHTML = "";
    overlay.style.display = "flex";

    if (tipo === "ok") {
        const btn = document.createElement('button');
        btn.innerText = "Aceptar";
        btn.onclick = () => {
            overlay.style.display = "none";
            if (callback) callback();
        };
        container.appendChild(btn);
    } else {
        const btnNo = document.createElement('button');
        btnNo.innerText = "Cancelar";
        btnNo.className = "btn-secundario";
        btnNo.onclick = () => overlay.style.display = "none";
        
        const btnSi = document.createElement('button');
        btnSi.innerText = "Eliminar";
        btnSi.style.background = "#ff4d4d";
        btnSi.onclick = () => {
            overlay.style.display = "none";
            if (callback) callback();
        };
        
        container.appendChild(btnNo);
        container.appendChild(btnSi);
    }
}

// --- REGISTRO ---
const formReg = document.getElementById('registro-form');
if (formReg) {
    formReg.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-password').value;
            const nombre = document.getElementById('reg-nombre').value;
            const apellidos = document.getElementById('reg-apellidos').value;

            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await sendEmailVerification(res.user);
            
            // GUARDAMOS NOMBRE Y APELLIDOS
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nombre: nombre,
                apellidos: apellidos,
                email: email,
                uid: res.user.uid
            });

            lanzarAviso("¡Registro con éxito! Revisa tu email.", "ok", () => {
                window.location.href = "index.html";
            });
        } catch (err) {
            let msg = "Error: " + err.message;
            if (err.code === 'auth/email-already-in-use') msg = "Este correo ya está registrado.";
            lanzarAviso(msg);
        }
    });
}

// --- LOGIN ---
const formLog = document.getElementById('login-form');
if (formLog) {
    formLog.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        if (user === "Administrador" && pass === "Administrador") {
            window.location.href = "admin.html";
            return;
        }

        try {
            const res = await signInWithEmailAndPassword(auth, user, pass);
            if (res.user.emailVerified) {
                lanzarAviso("¡Bienvenida!");
            } else {
                lanzarAviso("Verifica tu correo primero.");
            }
        } catch (err) { lanzarAviso("Datos incorrectos."); }
    });
}

// --- ADMIN (ACTUALIZADO CON NOMBRE Y APELLIDOS) ---
const lista = document.getElementById('lista-usuarios');
if (lista) {
    const cargar = async () => {
        lista.innerHTML = "Cargando...";
        const snap = await getDocs(collection(db, "usuarios"));
        lista.innerHTML = "";
        
        snap.forEach(d => {
            const u = d.data();
            const item = document.createElement('div');
            item.style.cssText = "padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;";
            
            // AQUÍ SE MUESTRAN NOMBRE Y APELLIDOS
            item.innerHTML = `
                <div style="text-align: left;">
                    <strong style="font-size: 1.1em;">${u.nombre} ${u.apellidos}</strong><br>
                    <small style="color: #666;">${u.email}</small>
                </div>
                <button style="width: auto; background: #ff4d4d; padding: 5px 15px;" id="btn-${d.id}">Borrar</button>
            `;
            lista.appendChild(item);
            
            document.getElementById(`btn-${d.id}`).onclick = () => {
                lanzarAviso(`¿Borrar a ${u.nombre} de la base de datos? Recuerda borrarlo también en Authentication para que pueda volver a registrarse.`, "confirmar", async () => {
                    await deleteDoc(doc(db, "usuarios", d.id));
                    cargar();
                });
            };
        });
    };
    cargar();
}
