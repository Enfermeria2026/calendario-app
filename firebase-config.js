// 1. Importamos las herramientas de Firebase (Versión 12.13.0 que te ha dado Google)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

// 2. TUS LLAVES REALES (Copiadas de tu captura de pantalla)
const firebaseConfig = {
  apiKey: "AIzaSyCARU84ybJ42rDV5W_UJr5Nkwh07BYvE3I",
  authDomain: "calendario-79929.firebaseapp.com",
  projectId: "calendario-79929",
  storageBucket: "calendario-79929.firebasestorage.app",
  messagingSenderId: "592556572094",
  appId: "1:592556572094:web:5eec29c3a1d067740b4def",
  measurementId: "G-B1SVJMYNQ0"
};

// 3. Inicializamos la aplicación
const app = initializeApp(firebaseConfig);

// 4. Inicializamos la Base de Datos (Firestore) y la Autenticación (Auth)
const db = getFirestore(app);
const auth = getAuth(app);

// 5. Exportamos 'db' y 'auth' para poder usarlos en el resto de tu página
export { db, auth };
