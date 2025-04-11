// ========================================================================
// == GLOBAL VARIABLES & INITIALIZATION ==
// ========================================================================

const INCIDENCIAS_STORAGE_KEY = 'incidencias_v2'; // Use a distinct key for this version
const priorityOrderMap = { critica: 4, alta: 3, media: 2, baja: 1 };

document.addEventListener('DOMContentLoaded', () => {
    // This script assumes index.html contains BOTH the form and the list
    if (document.getElementById('nuevaIncidenciaForm') && document.getElementById('listaIncidencias')) {
        console.log("Initializing DAMIncidencias App...");
        setupFormPage();
        setupPanelPage();
    } else {
        console.warn("Required elements 'nuevaIncidenciaForm' or 'listaIncidencias' not found. App might not function correctly.");
    }
});

// ========================================================================
// == LOCALSTORAGE UTILITIES ==
// ========================================================================

function getIncidenciasFromStorage() {
    try {
        const storedIncidencias = localStorage.getItem(INCIDENCIAS_STORAGE_KEY);
        return storedIncidencias ? JSON.parse(storedIncidencias) : [];
    } catch (error) {
        console.error("Error reading from localStorage:", error);
        return []; // Return empty array on error
    }
}

function saveIncidenciasToStorage(incidencias) {
    try {
        localStorage.setItem(INCIDENCIAS_STORAGE_KEY, JSON.stringify(incidencias));
    } catch (error) {
        console.error("Error saving to localStorage:", error);
        // Optionally display an error message to the user
        displayFeedback('Error al guardar datos. Es posible que el almacenamiento esté lleno.', 'danger', 'panelFeedbackContainer');
    }
}

// ========================================================================
// == FORM HANDLING ==
// ========================================================================

function setupFormPage() {
    const form = document.getElementById('nuevaIncidenciaForm');
    if (!form) return;

    form.addEventListener('submit', handleFormSubmit);
    console.log("Form listeners activated.");

    // Add listener to priority radio buttons for validation feedback clearing
    const priorityRadios = form.querySelectorAll('input[name="prioridad"]');
    priorityRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const group = document.getElementById('prioridadGroup');
            const errorMsg = document.getElementById('prioridad-error');
            group.classList.remove('is-invalid'); // Manually remove invalid class on change
             if (errorMsg) errorMsg.style.display = 'none';
             // Reset the hidden validation input value if needed (though checking radio directly is better)
             const hiddenInput = document.getElementById('prioridad-hidden-validation');
             if(hiddenInput && isPrioritySelected()) hiddenInput.value = 'selected'; // Give it a value
             else if(hiddenInput) hiddenInput.value = '';

        });
    });
}

function isPrioritySelected() {
    return !!document.querySelector('#prioridadGroup input[name="prioridad"]:checked');
}

function handleFormSubmit(event) {
    event.preventDefault(); // Prevent default browser submission
    event.stopPropagation(); // Stop propagation for Bootstrap validation

    const form = event.target;
    const isValid = form.checkValidity(); // Use Bootstrap's check
    const prioritySelected = isPrioritySelected();

    // Manual check for priority radio button group
    const priorityGroupDiv = document.getElementById('prioridadGroup');
    const priorityErrorDiv = document.getElementById('prioridad-error');
    const hiddenPrioInput = document.getElementById('prioridad-hidden-validation');

    if (!prioritySelected) {
        priorityGroupDiv?.classList.add('is-invalid'); // Visually mark the group
         if(priorityErrorDiv) priorityErrorDiv.style.display = 'block';
         if(hiddenPrioInput) hiddenPrioInput.value = ''; // Make hidden input invalid
    } else {
        priorityGroupDiv?.classList.remove('is-invalid');
         if(priorityErrorDiv) priorityErrorDiv.style.display = 'none';
         if(hiddenPrioInput) hiddenPrioInput.value = 'selected'; // Make hidden input valid
    }

    // Re-check form validity after potentially changing hidden priority input
    const finalValidity = form.checkValidity() && prioritySelected;

    form.classList.add('was-validated'); // Trigger Bootstrap visual feedback

    if (!finalValidity) {
        console.log("Form validation failed.");
        displayFeedback('Por favor, complete todos los campos obligatorios.', 'warning', 'formFeedback');
        return; // Stop if form is not valid
    }

    console.log("Form validation passed. Processing submission...");

    // Get values from form fields
    const nombreUsuario = document.getElementById('nombreUsuario').value.trim();
    const rolUsuario = document.getElementById('rolUsuario').value;
    const ubicacion = document.getElementById('ubicacion').value.trim();
    const equipo = document.getElementById('equipo').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const prioridadChecked = document.querySelector('#prioridadGroup input[name="prioridad"]:checked');
    const prioridad = prioridadChecked ? prioridadChecked.value : 'media'; // Default if somehow missed

    const nuevaIncidencia = {
        id: Date.now(), // Simple unique ID
        titulo: `Incidencia en ${ubicacion || 'ubicación desconocida'}`, // Auto-generate title maybe?
        descripcion: descripcion,
        prioridad: prioridad,
        estado: 'abierta', // Initial state
        fecha: new Date().toISOString(), // Creation timestamp
        reportadoPor: nombreUsuario,
        rol: rolUsuario,
        ubicacion: ubicacion,
        equipo: equipo || 'N/A' // Add equipo info
    };

    console.log('Nueva Incidencia Data:', nuevaIncidencia);

    // Add to storage
    let incidencias = getIncidenciasFromStorage();
    incidencias.push(nuevaIncidencia);
    saveIncidenciasToStorage(incidencias);

    // Provide user feedback
    displayFeedback(`Incidencia #${nuevaIncidencia.id} reportada con éxito.`, 'success', 'formFeedback');

    // Reset form and validation state
    form.reset();
    form.classList.remove('was-validated');
    priorityGroupDiv?.classList.remove('is-invalid'); // Clear priority group error style
    if(priorityErrorDiv) priorityErrorDiv.style.display = 'none'; // Hide priority error message

    // Reload the panel list to show the new item immediately
    cargarPanelControl();
}

// ========================================================================
// == PANEL HANDLING (Filtering, Sorting, Displaying) ==
// ========================================================================

function setupPanelPage() {
    const searchInput = document.getElementById('filtroBusqueda');
    const statusFilter = document.getElementById('filtroEstado');
    const sortOrder = document.getElementById('ordenacion');
    const listaIncidenciasContainer = document.getElementById('listaIncidencias');

    if (!searchInput || !statusFilter || !sortOrder || !listaIncidenciasContainer) {
         console.error("One or more panel filter/list elements are missing.");
         return;
    }

    // Attach event listeners to filters/sorting controls
    searchInput.addEventListener('input', () => cargarPanelControl());
    statusFilter.addEventListener('change', () => cargarPanelControl());
    sortOrder.addEventListener('change', () => cargarPanelControl());

    // Add delegated event listener for action buttons on incidents
    addPanelEventListeners(listaIncidenciasContainer);

    // Initial load of the panel
    cargarPanelControl();
    console.log("Panel listeners and initial load activated.");
}

function cargarPanelControl() {
    console.log("Loading/Reloading Panel Control...");
    const listaIncidenciasContainer = document.getElementById('listaIncidencias');
    const contadorIncidencias = document.getElementById('contadorIncidencias');
    if (!listaIncidenciasContainer || !contadorIncidencias) return;

    const incidencias = getIncidenciasFromStorage();

    // Get filter/sort values
    const searchTerm = document.getElementById('filtroBusqueda')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filtroEstado')?.value || 'todas';
    const sortValue = document.getElementById('ordenacion')?.value || 'recientes';

    // 1. Filter Incidents
    const filteredIncidencias = incidencias.filter(inc => {
        // Status Filter
        const statusMatch = (statusFilter === 'todas') || (inc.estado === statusFilter);

        // Search Term Filter (check multiple fields)
        const searchMatch = !searchTerm || (
            inc.titulo?.toLowerCase().includes(searchTerm) ||
            inc.descripcion?.toLowerCase().includes(searchTerm) ||
            inc.reportadoPor?.toLowerCase().includes(searchTerm) ||
            inc.ubicacion?.toLowerCase().includes(searchTerm) ||
            inc.equipo?.toLowerCase().includes(searchTerm) ||
            inc.id.toString().includes(searchTerm) // Allow searching by ID
        );

        return statusMatch && searchMatch;
    });

    // 2. Sort Incidents
    const sortedIncidencias = filteredIncidencias.sort((a, b) => {
        switch (sortValue) {
            case 'antiguas':
                return new Date(a.fecha) - new Date(b.fecha);
            case 'prioridad':
                // Higher priority value first (Critica=4 > Alta=3 > ...)
                return (priorityOrderMap[b.prioridad] || 0) - (priorityOrderMap[a.prioridad] || 0);
            case 'recientes':
            default:
                return new Date(b.fecha) - new Date(a.fecha); // Default: Newest first
        }
    });

    // 3. Render Incidents
    listaIncidenciasContainer.innerHTML = ''; // Clear previous list

    if (sortedIncidencias.length === 0) {
        listaIncidenciasContainer.innerHTML = `
            <div class="text-center p-4 text-muted">
                <i class="bi bi-clipboard-x fs-2 d-block mb-2"></i>
                ${incidencias.length === 0 ? 'No hay incidencias registradas.' : 'No hay incidencias que coincidan con los filtros.'}
            </div>`;
    } else {
        sortedIncidencias.forEach(incidencia => {
            const cardElement = createIncidentCard(incidencia);
            listaIncidenciasContainer.appendChild(cardElement);
        });
    }

    // 4. Update Counter
    const count = sortedIncidencias.length;
    contadorIncidencias.textContent = `${count} incidencia${count !== 1 ? 's' : ''}`;
    console.log(`Panel reloaded. Displaying ${count} incidents.`);
}

/**
 * Creates the HTML element for a single incident card based on the new dark theme layout.
 * @param {object} incidencia - The incident object.
 * @returns {HTMLElement} - The card element.
 */
function createIncidentCard(incidencia) {
    const card = document.createElement('div');
    card.className = `card card-incidencia mb-2 shadow-sm estado-${incidencia.estado}`; // Added shadow-sm for subtle depth
    card.dataset.id = incidencia.id;

    const priorityBadgeClass = getPriorityBadgeClass(incidencia.prioridad); // Get BS background class

    card.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center py-2 px-3">
            <h6 class="card-title mb-0 text-truncate" title="${incidencia.titulo} (ID: ${incidencia.id})">
               <span class="fw-bold"> #${incidencia.id}</span> - ${incidencia.titulo || 'Incidencia sin título'}
            </h6>
            <span class="badge ${priorityBadgeClass} ms-2 text-uppercase">${incidencia.prioridad}</span>
        </div>
        <div class="card-body p-3">
            <p class="card-text small mb-2">${incidencia.descripcion}</p>
            <p class="card-text small text-muted incidencia-meta mb-2 pt-1">
                <i class="bi bi-geo-alt-fill me-1"></i> ${incidencia.ubicacion || 'N/D'}
                <span class="mx-1">|</span>
                <i class="bi bi-laptop me-1"></i> ${incidencia.equipo || 'N/D'}
                <span class="mx-1">|</span>
                <i class="bi bi-person-fill me-1"></i> ${incidencia.reportadoPor || 'Anónimo'} (${incidencia.rol || 'N/D'})
                <span class="mx-1">|</span>
                <i class="bi bi-calendar-event me-1"></i> ${new Date(incidencia.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year:'2-digit' })}
            </p>
            <div class="d-flex justify-content-between align-items-center">
                <span class="badge rounded-pill ${getStatusBadgeClass(incidencia.estado)}">
                    <i class="${getStatusIconClass(incidencia.estado)} me-1"></i> ${incidencia.estado}
                </span>
                <div class="action-buttons">
                    ${incidencia.estado === 'abierta' ? `
                        <button class="btn btn-sm btn-outline-primary btn-change-status" data-new-status="en progreso" title="Marcar En Progreso">
                            <i class="bi bi-play-circle"></i>
                        </button>` : ''}
                     ${incidencia.estado === 'en progreso' ? `
                        <button class="btn btn-sm btn-outline-secondary btn-change-status" data-new-status="abierta" title="Marcar como Abierta">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>` : ''}
                    ${incidencia.estado !== 'cerrada' ? `
                        <button class="btn btn-sm btn-outline-success btn-change-status" data-new-status="cerrada" title="Marcar Cerrada">
                            <i class="bi bi-check-circle"></i>
                        </button>` : ''}
                    ${incidencia.estado === 'cerrada' ? `
                         <button class="btn btn-sm btn-outline-secondary btn-change-status" data-new-status="abierta" title="Reabrir Incidencia">
                            <i class="bi bi-arrow-clockwise"></i>
                         </button>`: ''}
                    <button class="btn btn-sm btn-outline-danger btn-delete" title="Eliminar Incidencia">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    return card;
}

// Helper functions for card badges/icons
function getPriorityBadgeClass(prioridad) {
    switch (prioridad) {
        case 'critica': return 'text-bg-danger';
        case 'alta': return 'text-bg-warning'; // Keep warning, maybe add text-dark if needed
        case 'media': return 'text-bg-primary';
        case 'baja': return 'text-bg-secondary';
        default: return 'text-bg-info';
    }
}

function getStatusBadgeClass(estado) {
     switch (estado) {
        case 'abierta': return 'text-bg-info';
        case 'en progreso': return 'text-bg-primary';
        case 'cerrada': return 'text-bg-success';
        default: return 'text-bg-light';
    }
}

function getStatusIconClass(estado) {
     switch (estado) {
        case 'abierta': return 'bi bi-envelope-open-fill';
        case 'en progreso': return 'bi bi-hourglass-split';
        case 'cerrada': return 'bi bi-check-circle-fill';
        default: return 'bi bi-question-circle';
    }
}

// ========================================================================
// == INCIDENT ACTIONS (Event Delegation & Logic) ==
// ========================================================================

function addPanelEventListeners(listContainer) {
     listContainer.addEventListener('click', (event) => {
         const target = event.target;
         const card = target.closest('.card-incidencia'); // Find the parent card
         if (!card) return; // Clicked outside a relevant area

         const incidentId = parseInt(card.dataset.id, 10);
         if (isNaN(incidentId)) return; // Invalid ID

         // Handle Status Change Button Click
         const changeStatusButton = target.closest('.btn-change-status');
         if (changeStatusButton) {
            const newStatus = changeStatusButton.dataset.newStatus;
            if (newStatus) {
                 cambiarEstado(incidentId, newStatus);
            }
            return; // Action handled
         }

         // Handle Delete Button Click
         const deleteButton = target.closest('.btn-delete');
         if (deleteButton) {
             eliminarIncidencia(incidentId);
             return; // Action handled
         }

         // Potential future: Click on card itself could open a detail view/modal
         // console.log(`Clicked on card with ID: ${incidentId}`);
     });
}


function cambiarEstado(id, nuevoEstado) {
    console.log(`Attempting to change state of incident #${id} to '${nuevoEstado}'`);
    let incidencias = getIncidenciasFromStorage();
    let changed = false;
    const updatedIncidencias = incidencias.map(inc => {
        if (inc.id === id && inc.estado !== nuevoEstado) {
            inc.estado = nuevoEstado;
            // Optional: Add a log/history entry to the incident here
            changed = true;
            console.log(`State changed for incident #${id}`);
        }
        return inc;
    });

    if (changed) {
        saveIncidenciasToStorage(updatedIncidencias);
        cargarPanelControl(); // Reload the panel to reflect the change immediately
        displayFeedback(`Estado de incidencia #${id} actualizado a '${nuevoEstado}'.`, 'info', 'panelFeedbackContainer');
    } else {
        console.log(`Incidencia #${id} not found or already in state '${nuevoEstado}'.`);
    }
}


function eliminarIncidencia(id) {
    console.log(`Attempting to delete incident #${id}`);
    // Consider using a Bootstrap Modal for confirmation instead of confirm() for better UX
    if (confirm(`¿Estás seguro de que deseas eliminar la incidencia #${id}? \nEsta acción no se puede deshacer.`)) {
        let incidencias = getIncidenciasFromStorage();
        const initialLength = incidencias.length;
        const updatedIncidencias = incidencias.filter(inc => inc.id !== id);

        if (updatedIncidencias.length < initialLength) {
            saveIncidenciasToStorage(updatedIncidencias);
            console.log(`Incident #${id} deleted successfully.`);
            cargarPanelControl(); // Reload panel
            displayFeedback(`Incidencia #${id} eliminada.`, 'warning', 'panelFeedbackContainer');
        } else {
             console.warn(`Incident #${id} not found for deletion.`);
        }
    } else {
        console.log(`Deletion of incident #${id} cancelled.`);
    }
}

// ========================================================================
// == UI FEEDBACK UTILITY ==
// ========================================================================

/**
 * Displays temporary feedback message in a specified container.
 * @param {string} message - The message to display.
 * @param {'success'|'danger'|'warning'|'info'} type - Bootstrap alert type.
 * @param {string} containerId - ID of the container element (e.g., 'formFeedback' or 'panelFeedbackContainer').
 */
function displayFeedback(message, type = 'info', containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Feedback container with ID '${containerId}' not found.`);
        // Fallback to simple alert if container doesn't exist
        alert(`[${type.toUpperCase()}] ${message}`);
        return;
    }

    // Create the alert element using Bootstrap classes
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = `alert alert-${type} alert-dismissible fade show form-feedback-alert`; // Added common class
    feedbackDiv.setAttribute('role', 'alert');
    feedbackDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close btn-sm" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Clear previous alerts in the container before adding new one
     const existingAlert = container.querySelector('.form-feedback-alert');
     if(existingAlert) {
         const alertInstance = bootstrap.Alert.getOrCreateInstance(existingAlert);
         if(alertInstance) alertInstance.close(); // Use Bootstrap's JS to close existing alert
     }

    // Add the new alert
    container.appendChild(feedbackDiv);

    // Optional: Auto-remove after a few seconds (Bootstrap's dismiss button handles manual removal)
    // setTimeout(() => {
    //     const alertInstance = bootstrap.Alert.getOrCreateInstance(feedbackDiv);
    //     if(alertInstance) alertInstance.close();
    // }, 5000); // Close after 5 seconds
}