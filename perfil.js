// 1. Importamos la base de datos desde tu archivo de configuración y las herramientas de Firestore
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// 2. MAGIA MULTIUSUARIO: Obtenemos el ID de la persona que está usando la app
// (Esto se debe guardar en el localStorage cuando el usuario hace login o se registra)
const miID = localStorage.getItem('usuario_activo');

// Si por algún motivo entra aquí sin ID (ej. escribió la ruta directa), le avisamos
if (!miID) {
    console.error("Error: No hay usuario logueado en esta sesión.");
    // window.location.href = "index.html"; // (Opcional: descomenta esto para echarlo al Login)
}

let trabajosLocal = [];
let indiceEditando = -1;

// 3. Al abrir la página, vamos a Firebase a por los datos del usuario logueado
document.addEventListener('DOMContentLoaded', cargarDatosFirebase);

async function cargarDatosFirebase() {
    if (!miID) return; // Si no hay ID, paramos aquí
    
    document.getElementById('perfil-id').value = miID;
    
    try {
        // Le decimos a Firebase: "Búscame en 'usuarios' el documento de ESTE usuario"
        const docRef = doc(db, "usuarios", miID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const datos = docSnap.data();
            // Rellenamos los campos con lo que hay en la nube
            document.getElementById('perfil-nombre').value = datos.nombre || "";
            document.getElementById('perfil-apellidos').value = datos.apellidos || "";
            document.getElementById('perfil-fecha').value = datos.fecha || "";
            document.getElementById('perfil-desc').value = datos.descripcion || "";
            
            trabajosLocal = datos.trabajos || [];
            cargarListaTrabajos();
            actualizarNombreHeader();
        } else {
            console.log("El usuario es nuevo y no tiene datos extra guardados todavía.");
        }
    } catch (error) {
        console.error("Error conectando con Firebase:", error);
    }
}

function actualizarNombreHeader() {
    const nombre = document.getElementById('perfil-nombre').value;
    const apellidos = document.getElementById('perfil-apellidos').value;
    if(nombre || apellidos) {
        document.getElementById('header-usuario').innerText = `${nombre} ${apellidos}`.trim();
    }
}

// 4. Guardar los datos en Firebase (Solo los del usuario logueado)
async function guardarPerfil() {
    if (!miID) return; // Por seguridad

    const campos = ['perfil-nombre', 'perfil-apellidos', 'perfil-fecha', 'perfil-desc'];
    
    // Bloquear campos visualmente
    campos.forEach(id => {
        const input = document.getElementById(id);
        input.readOnly = true;
        input.style.pointerEvents = "none";
        input.style.backgroundColor = "#f9f9f9";
        input.style.borderColor = "#eee";
    });

    // Recopilar la información
    const datosAGuardar = {
        userId: miID,
        nombre: document.getElementById('perfil-nombre').value,
        apellidos: document.getElementById('perfil-apellidos').value,
        fecha: document.getElementById('perfil-fecha').value,
        descripcion: document.getElementById('perfil-desc').value,
        trabajos: trabajosLocal
    };

    try {
        // Enviamos todo a Firestore con { merge: true } para que actualice sin borrar otros datos posibles
        await setDoc(doc(db, "usuarios", miID), datosAGuardar, { merge: true });
        actualizarNombreHeader();
        mostrarMensaje("¡Nube actualizada!", "Tus datos se han guardado en Firebase con éxito.");
    } catch (error) {
        console.error("Error al guardar en Firebase:", error);
        mostrarMensaje("Error", "No se pudieron guardar los datos.");
    }
}

// --- LÓGICA DE TRABAJOS ---
function cargarListaTrabajos() {
    const lista = document.getElementById('lista-trabajos');
    lista.innerHTML = ''; 
    trabajosLocal.forEach((trabajo, index) => {
        const div = document.createElement('div');
        div.className = 'item-trabajo';
        div.innerHTML = `
            <span class="nombre-trabajo">${trabajo}</span>
            <div style="display: flex; gap: 15px;">
                <i class="fas fa-pencil-alt" style="color: #666; cursor: pointer;" onclick="abrirModalTrabajo(${index})"></i>
                <i class="fas fa-trash-alt" style="color: #e53935; cursor: pointer;" onclick="borrarTrabajo(${index})"></i>
            </div>
        `;
        lista.appendChild(div);
    });
}

function guardarTrabajo() {
    const nombre = document.getElementById('nuevo-trabajo').value.trim();
    if (nombre !== "") {
        if (indiceEditando > -1) {
            trabajosLocal[indiceEditando] = nombre; 
        } else {
            trabajosLocal.push(nombre); 
        }
        cargarListaTrabajos();
        cerrarModales();
        // Para que se guarde permanentemente en la nube
        guardarPerfil(); 
    }
}

function borrarTrabajo(index) {
    trabajosLocal.splice(index, 1); 
    cargarListaTrabajos();
    guardarPerfil(); 
}

// --- FUNCIONES DE LA INTERFAZ ---
function editarCampo(id) {
    const input = document.getElementById(id);
    input.readOnly = false;
    input.style.pointerEvents = "auto";
    input.focus();
    input.style.backgroundColor = "white";
    input.style.borderColor = "#ec407a";
}

function abrirModalTrabajo(index = -1) {
    document.getElementById('modal-trabajo').style.display = 'flex';
    const inputTrabajo = document.getElementById('nuevo-trabajo');
    indiceEditando = index;
    if (index > -1) {
        inputTrabajo.value = trabajosLocal[index];
        document.getElementById('titulo-modal-trabajo').innerText = 'Editar Trabajo';
    } else {
        inputTrabajo.value = '';
        document.getElementById('titulo-modal-trabajo').innerText = 'Nuevo Trabajo';
    }
    inputTrabajo.focus();
}

function abrirModalEliminar() {
    document.getElementById('modal-eliminar').style.display = 'flex';
}

function confirmarEliminacionFinal() {
    cerrarModales();
    mostrarMensaje("En desarrollo", "Eliminar cuenta se conectará pronto a la base de datos.");
}

function mostrarMensaje(titulo, texto) {
    document.getElementById('mensaje-titulo').innerText = titulo;
    document.getElementById('mensaje-texto').innerText = texto;
    document.getElementById('modal-mensaje').style.display = 'flex';
}

function cerrarModales() {
    document.getElementById('modal-trabajo').style.display = 'none';
    document.getElementById('modal-eliminar').style.display = 'none';
    document.getElementById('modal-mensaje').style.display = 'none';
}

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('active');
}

// 5. ATENCIÓN: Como usamos type="module", el HTML no "ve" las funciones automáticamente. 
// Tenemos que enlazarlas a la ventana global (window) así:
window.editarCampo = editarCampo;
window.guardarPerfil = guardarPerfil;
window.abrirModalTrabajo = abrirModalTrabajo;
window.guardarTrabajo = guardarTrabajo;
window.borrarTrabajo = borrarTrabajo;
window.abrirModalEliminar = abrirModalEliminar;
window.confirmarEliminacionFinal = confirmarEliminacionFinal;
window.cerrarModales = cerrarModales;
window.toggleMenu = toggleMenu;
