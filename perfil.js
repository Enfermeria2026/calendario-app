// Lógica para la pantalla de Mi Perfil

// Función para abrir/cerrar menú
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('active');
}

// Función para habilitar edición de campos
function editarCampo(id) {
    const input = document.getElementById(id);
    input.readOnly = !input.readOnly;
    
    if (!input.readOnly) {
        input.focus();
        input.style.backgroundColor = "white";
        input.style.borderColor = "#ec407a";
    } else {
        input.style.backgroundColor = "#f9f9f9";
        input.style.borderColor = "#eee";
        alert("Campo actualizado localmente");
    }
}

// Funciones para el Modal de Trabajos
function abrirModalTrabajo() {
    document.getElementById('modal-trabajo').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modal-trabajo').style.display = 'none';
}

function guardarTrabajo() {
    const nombre = document.getElementById('nuevo-trabajo').value;
    if (nombre) {
        const lista = document.getElementById('lista-trabajos');
        const div = document.createElement('div');
        div.className = 'item-trabajo';
        div.innerHTML = `<span>${nombre}</span><i class="fas fa-trash-alt" style="color: #e53935; cursor: pointer;" onclick="this.parentElement.remove()"></i>`;
        lista.appendChild(div);
        document.getElementById('nuevo-trabajo').value = '';
        cerrarModal();
    }
}
