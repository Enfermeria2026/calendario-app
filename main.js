import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE TU PROYECTO ---
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

// --- LÓGICA DE REGISTRO ---
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
            // 1. Crear el usuario en Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // 2. Enviar correo de verificación
            await sendEmailVerification(user);

            // 3. Guardar datos en la base de datos Firestore
            // Usamos await para asegurarnos de que se guarde antes de avisar
            await setDoc(doc(db, "usuarios", user.uid), {
                nombre: nombre,
                apellidos: apellidos,
                fechaNacimiento: fechaNac,
                email: email,
                uid: user.uid
            });

            // Si llegamos aquí, todo ha salido bien
            alert("¡ÉXITO TOTAL! Se ha enviado un correo de verificación. Por favor, revísalo para activar tu cuenta.");
            window.location.href = "index.html";

        } catch (error) {
            // Este es el catch "fuerte": te dirá exactamente qué ha fallado
            console.error("Error detallado:", error);
            alert("Vaya, algo ha fallado: " + error.message);
        }
    });
}

// --- LÓGICA DE LOGIN (CON ACCESO ADMIN) ---
const formLogin = document.getElementById('login-form');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-email').value;
        const passInput = document.getElementById('login-password').value;

        // Comprobación especial para el Panel de Administrador
        if (emailInput === "Administrador" && passInput === "Administrador") {
            alert("Accediendo al Panel de Control...");
            window.location.href = "admin.html";
            return; // Salimos de la función para no intentar loguear en Firebase
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, emailInput, passInput);
            if (userCredential.user.emailVerified) {
                alert("¡Bienvenido/a!");
                // Aquí irá el dashboard.html en el futuro
            } else {
                alert("Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada.");
            }
        } catch (error) {
            alert("Correo o contraseña incorrectos.");
        }
    });
}

// --- LÓGICA DEL PANEL DE ADMINISTRACIÓN (Solo para admin.html) ---
const listaDiv = document.getElementById('lista-usuarios');
if (listaDiv) {
    const cargarUsuarios = async () => {
        try {
            listaDiv.innerHTML = "<p>Cargando lista de usuarios...</p>";
            const querySnapshot = await getDocs(collection(db, "usuarios"));
            
            if (querySnapshot.empty) {
                listaDiv.innerHTML = "<p>No hay usuarios registrados en la base de datos.</p>";
                return;
            }

            listaDiv.innerHTML = ""; // Limpiamos el mensaje de carga
            querySnapshot.forEach((usuarioDoc) => {
                const datos = usuarioDoc.data();
                const cajaUser = document.createElement('div');
                cajaUser.style.cssText = "border-bottom: 1px solid #eee; padding: 15px; display: flex; justify-content: space-between; align-items: center;";
                
                cajaUser.innerHTML = `
                    <div style="text-align: left;">
                        <strong style="display: block;">${datos.nombre} ${datos.apellidos}</strong>
                        <small style="color: #666;">${datos.email} | Nacimiento: ${datos.fechaNacimiento}</small>
                    </div>
                    <button onclick="borrarUser('${usuarioDoc.id}')" style="width: 70px; background: #ff4d4d; font-size: 11px; padding: 5px;">Borrar</button>
                `;
                listaDiv.appendChild(cajaUser);
            });
        } catch (error) {
            listaDiv.innerHTML = "<p>Error al cargar usuarios: " + error.message + "</p>";
        }
    };

    // Función para borrar usuarios de la base de datos
    window.borrarUser = async (id) => {
        if (confirm("¿Estás segura de que quieres eliminar a este usuario de la base de datos?")) {
            try {
                await deleteDoc(doc(db, "usuarios", id));
                alert("Usuario eliminado correctamente.");
                cargarUsuarios(); // Recargamos la lista
            } catch (error) {
                alert("Error al borrar: " + error.message);
            }
        }
    };

    cargarUsuarios();
}
