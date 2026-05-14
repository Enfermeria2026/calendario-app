import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const miID = localStorage.getItem('usuario_activo');

if (!miID) {
    console.error("Error: No hay usuario logueado en esta sesión.");
}

let trabajosLocal = [];
let indiceEditando = -1;
let fotoBase64 = ""; // Variable para guardar la foto en formato texto

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosFirebase();
    
    // --- NUEVO: ESCUCHAR CUANDO SE ELIGE UNA FOTO ---
    const inputFoto = document.getElementById('input-foto');
    if (inputFoto) {
        inputFoto.addEventListener('change', function(event) {
            const archivo = event.target.files[0];
            if (archivo) {
                const lector = new FileReader();
                lector.onload = function(e) {
                    fotoBase64 = e.target.result; // Convertimos la imagen a código Base64
                    // Mostramos la imagen al instante en el círculo
                    document.getElementById('profile-display').innerHTML = `<img src="${fotoBase64}" alt="Mi Foto">`;
                };
                lector.readAsDataURL(archivo);
            }
        });
    }
});

async function cargarDatosFirebase() {
    if (!miID) return; 
    
    document.getElementById('perfil-id').value = miID;
    
    try {
        const docRef = doc(db, "usuarios", miID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const datos = docSnap.data();
            
            document.getElementById('perfil-nombre').value = datos.nombre || "";
            document.getElementById('perfil-apellidos').value = datos.apellidos || "";
            document.getElementById('perfil-fecha').value = datos.fecha || "";
            document.getElementById('perfil-desc').value = datos.descripcion || "";
            
            // --- NUEVO: CARGAR LA FOTO SI EXISTE ---
            if (datos.foto) {
                fotoBase64 = datos.foto;
                document.getElementById('profile-display').innerHTML = `<img src="${fotoBase64}" alt="Mi Foto">`;
            } else {
                document.getElementById('profile-display').innerHTML = `<i class="fas fa-user"></i>`;
            }
            
            trabajosLocal = datos.trabajos || [];
            cargarListaTrabajos();
            actualizarNombreHeader();
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

async function guardarPerfil() {
    if (!miID) return;

    const campos = ['perfil-nombre', 'perfil-apellidos', 'perfil-fecha', 'perfil-desc'];
    
    campos.forEach(id => {
        const input = document.getElementById(id);
        input.readOnly = true;
        input.style.pointerEvents = "none";
        input.style.backgroundColor = "#f9f9f9";
        input.style.borderColor = "#eee";
    });

    const datosAGuardar = {
        userId: miID,
        nombre: document.getElementById('perfil-nombre').value,
        apellidos: document.getElementById('perfil-apellidos').value,
        fecha: document.getElementById('perfil-fecha').value,
        descripcion: document.getElementById('perfil-desc').value,
        trabajos: trabajosLocal,
        foto: fotoBase64 // --- NUEVO: GUARDAMOS LA FOTO EN FIREBASE ---
    };

    try {
        await setDoc(doc(db, "usuarios", miID), datosAGuardar, { merge: true });
        actualizarNombreHeader();
        mostrarMensaje("¡Nube actualizada!", "Tus datos y tu foto se han guardado con éxito.");
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

window.editarCampo = editarCampo;
window.guardarPerfil = guardarPerfil;
window.abrirModalTrabajo = abrirModalTrabajo;
window.guardarTrabajo = guardarTrabajo;
window.borrarTrabajo = borrarTrabajo;
window.abrirModalEliminar = abrirModalEliminar;
window.confirmarEliminacionFinal = confirmarEliminacionFinal;
window.cerrarModales = cerrarModales;
window.toggleMenu = toggleMenu;
