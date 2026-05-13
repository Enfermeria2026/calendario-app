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

            alert("¡ÉXITO TOTAL! Revisa tu correo ahora.");
            window.location.href = "index.html";
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}

// --- LOGIN (CON ACCESO ADMIN) ---
const formLogin = document.getElementById('login-form');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        // ACCESO SECRETO ADMINISTRADOR
        if (email === "Administrador" && pass === "Administrador") {
            window.location.href = "admin.html";
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            if (userCredential.user.emailVerified) {
                alert("¡Bienvenido!");
                // window.location.href = "dashboard.html"; 
            } else {
                alert("Por favor, verifica tu correo primero.");
            }
        } catch (error) {
            alert("Datos incorrectos.");
        }
    });
}

// --- LÓGICA DEL PANEL ADMIN ---
const listaDiv = document.getElementById('lista-usuarios');
if (listaDiv) {
    const cargarUsuarios = async () => {
        listaDiv.innerHTML = "";
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        querySnapshot.forEach((usuarioDoc) => {
            const datos = usuarioDoc.data();
            const p = document.createElement('div');
            p.style.borderBottom = "1px solid #eee";
            p.style.padding = "10px";
            p.innerHTML = `
                <strong>${datos.nombre} ${datos.apellidos}</strong> (${datos.email})
                <button onclick="borrarUser('${usuarioDoc.id}')" style="width: 80px; background: red; font-size: 10px; margin-left: 10px;">Borrar</button>
            `;
            listaDiv.appendChild(p);
        });
    };

    window.borrarUser = async (id) => {
        if(confirm("¿Seguro que quieres borrar este usuario?")) {
            await deleteDoc(doc(db, "usuarios", id));
            cargarUsuarios();
        }
    };

    cargarUsuarios();
}
