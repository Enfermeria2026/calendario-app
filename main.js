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

// --- FUNCIÓN DE MODAL PERSONALIZADO ---
function lanzarAviso(mensaje, tipo = "ok", callback = null) {
    const overlay = document.getElementById('miModal');
    const msgP = document.getElementById('modalMsg');
    const btnContainer = document.getElementById('modalBtnsContainer');
    
    msgP.innerText = mensaje;
    btnContainer.innerHTML = ""; // Limpiar botones
    overlay.style.display = "flex";

    if (tipo === "ok") {
        const btn = document.createElement('button');
        btn.innerText = "Aceptar";
        btn.onclick = () => {
            overlay.style.display = "none";
            if (callback) callback();
        };
        btnContainer.appendChild(btn);
    } else if (tipo === "confirmar") {
        const btnSi = document.createElement('button');
        btnSi.innerText = "Eliminar";
        btnSi.style.background = "red";
        btnSi.onclick = () => {
            overlay.style.display = "none";
            if (callback) callback(true);
        };
        
        const btnNo = document.createElement('button');
        btnNo.innerText = "Cancelar";
        btnNo.className = "btn-secundario";
        btnNo.onclick = () => {
            overlay.style.display = "none";
            if (callback) callback(false);
        };
        
        btnContainer.appendChild(btnNo);
        btnContainer.appendChild(btnSi);
    }
}

// --- REGISTRO ---
const formRegistro = document.getElementById('registro-form');
if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-password').value;
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            await sendEmailVerification(userCredential.user);
            
            await setDoc(doc(db, "usuarios", userCredential.user.uid), {
                nombre: document.getElementById('reg-nombre').value,
                apellidos: document.getElementById('reg-apellidos').value,
                fechaNacimiento: document.getElementById('reg-fecha').value,
                email: email
            });

            lanzarAviso("¡Registro con éxito! Por favor, verifica tu correo.", "ok", () => {
                window.location.href = "index.html";
            });
        } catch (error) {
            lanzarAviso("Error: " + error.message);
        }
    });
}

// --- LOGIN ---
const formLogin = document.getElementById('login-form');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        if (email === "Administrador" && pass === "Administrador") {
            lanzarAviso("Entrando al Panel de Control...", "ok", () => {
                window.location.href = "admin.html";
            });
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            if (userCredential.user.emailVerified) {
                lanzarAviso("¡Bienvenida!");
            } else {
                lanzarAviso("Verifica tu correo antes de entrar.");
            }
        } catch (error) {
            lanzarAviso("Datos incorrectos.");
        }
    });
}

// --- ADMIN PANEL ---
const listaDiv = document.getElementById('lista-usuarios');
if (listaDiv) {
    const cargarUsuarios = async () => {
        listaDiv.innerHTML = "Cargando...";
        const snapshot = await getDocs(collection(db, "usuarios"));
        listaDiv.innerHTML = "";
        snapshot.forEach(docSnap => {
            const user = docSnap.data();
            const div = document.createElement('div');
            div.style.padding = "10px";
            div.style.borderBottom = "1px solid #eee";
            div.innerHTML = `
                ${user.nombre} (${user.email}) 
                <button onclick="borrarUser('${docSnap.id}')" style="width:70px; background:red; font-size:10px; float:right;">Borrar</button>
            `;
            listaDiv.appendChild(div);
        });
    };

    window.borrarUser = (id) => {
        lanzarAviso("¿Seguro que quieres borrar este usuario definitivamente?", "confirmar", async (confirmado) => {
            if (confirmado) {
                await deleteDoc(doc(db, "usuarios", id));
                cargarUsuarios();
            }
        });
    };
    cargarUsuarios();
}
