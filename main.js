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

    if (!overlay || !msgP || !container) {
        alert(mensaje);
        return;
    }

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

// --- REGISTRO CORREGIDO ---
const formReg = document.getElementById('registro-form');
if (formReg) {
    formReg.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-password').value;
            
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await sendEmailVerification(res.user);
            
            await setDoc(doc(db, "usuarios", res.user.uid), {
                nombre: document.getElementById('reg-nombre').value,
                apellidos: document.getElementById('reg-apellidos').value,
                email: email
            });

            lanzarAviso("¡Registro con éxito! Se ha enviado un correo de verificación.", "ok", () => {
                window.location.href = "index.html";
            });

        } catch (err) {
            // TRADUCCIÓN DE ERRORES DE FIREBASE
            let mensajeError = "Hubo un problema al registrarse.";
            if (err.code === 'auth/email-already-in-use') {
                mensajeError = "Este correo electrónico ya está registrado. Prueba a iniciar sesión.";
            } else if (err.code === 'auth/weak-password') {
                mensajeError = "La contraseña es muy corta (mínimo 6 caracteres).";
            } else if (err.code === 'auth/invalid-email') {
                mensajeError = "El formato del correo no es válido.";
            }
            lanzarAviso(mensajeError);
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
            lanzarAviso("Accediendo al Panel...", "ok", () => {
                window.location.href = "admin.html";
            });
            return;
        }

        try {
            const res = await signInWithEmailAndPassword(auth, user, pass);
            if (res.user.emailVerified) {
                lanzarAviso("¡Bienvenida!");
            } else {
                lanzarAviso("Verifica tu correo primero.");
            }
        } catch (err) {
            lanzarAviso("Correo o contraseña incorrectos.");
        }
    });
}

// --- ADMIN ---
const lista = document.getElementById('lista-usuarios');
if (lista) {
    const cargar = async () => {
        const snap = await getDocs(collection(db, "usuarios"));
        lista.innerHTML = "";
        if (snap.empty) { lista.innerHTML = "No hay usuarios en la base de datos."; }
        
        snap.forEach(d => {
            const u = d.data();
            const item = document.createElement('div');
            item.style.padding = "10px";
            item.style.borderBottom = "1px solid #eee";
            item.innerHTML = `
                <span><strong>${u.nombre}</strong> (${u.email})</span>
                <button style="float:right; background:red; padding:5px 10px; width:auto;" id="btn-${d.id}">Borrar</button>
            `;
            lista.appendChild(item);
            
            document.getElementById(`btn-${d.id}`).onclick = () => {
                lanzarAviso("¿Borrar de la base de datos? (El usuario seguirá en Authentication)", "confirmar", async () => {
                    await deleteDoc(doc(db, "usuarios", d.id));
                    cargar();
                });
            };
        });
    };
    cargar();
}
