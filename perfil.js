// Variable global para saber si creamos un trabajo o editamos uno existente
let trabajoEditando = null;

// Abrir/cerrar menú lateral
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('active');
}

// 1. Activar campo al pulsar el lápiz
function editarCampo(id) {
    const input = document.getElementById(id);
    input.readOnly = false;
    input.style.pointerEvents = "auto"; // Desbloquea el clic
    input.focus();
    input.style.backgroundColor = "white";
    input.style.borderColor = "#ec407a";
}

// 2. Guardar todos los campos personales
function guardarPerfil() {
    const campos = ['perfil-nombre', 'perfil-apellidos', 'perfil-fecha', 'perfil-desc'];
    
    campos.forEach(id => {
        const input = document.getElementById(id);
        input.readOnly = true;
        input.style.pointerEvents = "none"; // Vuelve a bloquear el clic
        input.style.backgroundColor = "#f9f9f9";
        input.style.borderColor = "#eee";
    });

    mostrarMensaje("¡Perfil actualizado!", "Tus datos personales se han guardado con éxito.");
}

// 3. Modales de Trabajos
function abrirModalTrabajo(elementoSpan = null) {
    document.getElementById('modal-trabajo').style.display = 'flex';
    const inputTrabajo = document.getElementById('nuevo-trabajo');
    
    if (elementoSpan) {
        // MODO EDICIÓN
        inputTrabajo.value = elementoSpan.innerText;
        trabajoEditando = elementoSpan;
        document.getElementById('titulo-modal-trabajo').innerText = 'Editar Trabajo';
    } else {
        // MODO NUEVO
        inputTrabajo.value = '';
        trabajoEditando = null;
        document.getElementById('titulo-modal-trabajo').innerText = 'Nuevo Trabajo';
    }
    inputTrabajo.focus();
}

function guardarTrabajo() {
    const nombre = document.getElementById('nuevo-trabajo').value.trim();
    if (nombre !== "") {
        if (trabajoEditando) {
            // Actualiza el texto si estábamos editando
            trabajoEditando.innerText = nombre;
        } else {
            // Crea un nuevo recuadro en la lista
            const lista = document.getElementById('lista-trabajos');
            const div = document.createElement('div');
            div.className = 'item-trabajo';
            div.innerHTML = `
                <span class="nombre-trabajo">${nombre}</span>
                <div style="display: flex; gap: 15px;">
                    <i class="fas fa-pencil-alt" style="color: #666; cursor: pointer;" onclick="abrirModalTrabajo(this.parentElement.previousElementSibling)"></i>
                    <i class="fas fa-trash-alt" style="color: #e53935; cursor: pointer;" onclick="this.parentElement.parentElement.remove()"></i>
                </div>
            `;
            lista.appendChild(div);
        }
        cerrarModales();
    }
}

// 4. Modales de Seguridad y Mensajes
function abrirModalEliminar() {
    document.getElementById('modal-eliminar').style.display = 'flex';
}

function confirmarEliminacionFinal() {
    cerrarModales();
    // Aquí iría el código que borra de la base de datos, por ahora mostramos mensaje
    mostrarMensaje("Cuenta eliminada", "Tu cuenta ha sido eliminada del sistema.");
}

function mostrarMensaje(titulo, texto) {
    document.getElementById('mensaje-titulo').innerText = titulo;
    document.getElementById('mensaje-texto').innerText = texto;
    document.getElementById('modal-mensaje').style.display = 'flex';
}

function cerrarModales() {
    // Cierra cualquier modal que esté abierto
    document.getElementById('modal-trabajo').style.display = 'none';
    document.getElementById('modal-eliminar').style.display = 'none';
    document.getElementById('modal-mensaje').style.display = 'none';
}
