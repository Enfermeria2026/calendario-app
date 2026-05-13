import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Tu configuración (ya está puesta la tuya)
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

// --- FUNCIÓN DE REGISTRO ---
const formRegistro = document.getElementById('registro-form');
if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        const nombre = document.getElementById('reg-nombre').value;
        const apellidos = document.getElementById('reg-apellidos').value;
        const fechaNac = document.getElementById('reg-fecha').value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            await sendEmailVerification(userCredential.user);
            
            await setDoc(doc(db, "usuarios", userCredential.user.uid), {
                nombre: nombre,
                apellidos: apellidos,
                fechaNacimiento: fechaNac,
                email: email
            });

            alert("¡ÉXITO! Se ha enviado un correo de verificación. Por favor, revísalo.");
            window.location.href = "index.html";
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}

// --- FUNCIÓN DE LOGIN ---
const formLogin = document.getElementById('login-form');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            if (userCredential.user.emailVerified) {
                alert("¡Bienvenido/a!");
                // window.location.href = "dashboard.html"; 
            } else {
                alert("Primero debes verificar tu correo. Revisa tu bandeja de entrada.");
            }
        } catch (error) {
            alert("Error al entrar: " + error.message);
        }
    });
}
