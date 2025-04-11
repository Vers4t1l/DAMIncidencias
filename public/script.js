// ========================================================================
// == GLOBAL VARIABLES & INITIALIZATION ==
// ========================================================================

// REMOVED: const INCIDENCIAS_STORAGE_KEY = 'incidencias_v2';
const priorityOrderMap = { critica: 4, alta: 3, media: 2, baja: 1 };

// Firebase Configuration (Pasted from user input)
const firebaseConfig = {
  apiKey: "AIzaSyA2CntUQNPEyM_AI7ysjdM7qE3V0tSRN5k", // Replace with your actual API key if different
  authDomain: "damincidencias.firebaseapp.com",
  projectId: "damincidencias",
  storageBucket: "damincidencias.appspot.com", // Ensure this matches your console
  messagingSenderId: "1086792901405",
  appId: "1:1086792901405:web:680324e456a17e776577f4",
  measurementId: "G-MH1JQ9WL4Y" // Optional
};

// Initialize Firebase
let app;
let db;
try {
    // Use compat libraries initialized in HTML
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore(); // Use compat Firestore instance
    console.log("Firebase Initialized Successfully");
} catch (error) {
    console.error("Firebase initialization failed:", error);
    // Display error to the user - this might prevent the app from working
    // We'll try displaying in both potential feedback areas
    displayFeedback('Error crítico al conectar con la base de datos.', 'danger', 'formFeedback', false); // Don't clear immediately
    displayFeedback('Error crítico al conectar con la base de datos.', 'danger', 'panelFeedbackContainer', false); // Don't clear immediately
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Inicializando componentes...");

    // Configura el formulario SI existe en la página actual
    if (document.getElementById('nuevaIncidenciaForm')) {
        console.log("Configurando página del formulario...");
        setupFormPage();
    } else {
         console.log("Elemento 'nuevaIncidenciaForm' no encontrado. Omitiendo configuración del formulario.");
    }

    // Configura el panel SI existe en la página actual
    if (document.getElementById('listaIncidencias')) {
         console.log("Configurando página del panel/lista...");
         setupPanelPage(); // Esta función ahora llamará a listenForIncidencias() que usa Firestore
    } else {
         console.log("Elemento 'listaIncidencias' no encontrado. Omitiendo configuración del panel.");
    }
});

// ========================================================================
// == LOCALSTORAGE UTILITIES (REMOVED) ==
// ========================================================================
// REMOVED: getIncidenciasFromStorage function
// REMOVED: saveIncidenciasToStorage function

// ========================================================================
// == FORM HANDLING ==
// ========================================================================

function setupFormPage() {
    const form = document.getElementById('nuevaIncidenciaForm');
    if (!form) return;

    form.addEventListener('submit', handleFormSubmit);
    console.log("Form listeners activated.");

    // Add listener to priority radio buttons for validation feedback clearing
    const priorityRadios = form.querySelectorAll('input[name=\"prioridad\"]');
    priorityRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const group = document.getElementById('prioridadGroup');
            const errorMsg = document.getElementById('prioridad-error');
            group.classList.remove('is-invalid'); // Manually remove invalid class on change
             if (errorMsg) errorMsg.style.display = 'none';
             // Reset the hidden validation input value if needed
             const hiddenInput = document.getElementById('prioridad-hidden-validation');
             if(hiddenInput && isPrioritySelected()) hiddenInput.value = 'selected'; // Give it a value
             else if(hiddenInput) hiddenInput.value = '';
        });
    });
}

function isPrioritySelected() {
    return !!document.querySelector('#prioridadGroup input[name=\"prioridad\"]:checked');
}

async function handleFormSubmit(event) { // Made async for await
    event.preventDefault();
    event.stopPropagation();

    if (!db) { // Check if Firestore is initialized
        displayFeedback('Error: No se pudo conectar a la base de datos. Inténtalo más tarde.', 'danger', 'formFeedback');
        return;
    }

    const form = event.target;
    const isValid = form.checkValidity();
    const prioritySelected = isPrioritySelected();

    const priorityGroupDiv = document.getElementById('prioridadGroup');
    const priorityErrorDiv = document.getElementById('prioridad-error');
    const hiddenPrioInput = document.getElementById('prioridad-hidden-validation');

    if (!prioritySelected) {
        priorityGroupDiv?.classList.add('is-invalid');
         if(priorityErrorDiv) priorityErrorDiv.style.display = 'block';
         if(hiddenPrioInput) hiddenPrioInput.value = '';
    } else {
        priorityGroupDiv?.classList.remove('is-invalid');
         if(priorityErrorDiv) priorityErrorDiv.style.display = 'none';
         if(hiddenPrioInput) hiddenPrioInput.value = 'selected';
    }

    const finalValidity = form.checkValidity() && prioritySelected;
    form.classList.add('was-validated');

    if (!finalValidity) {
        console.log("Form validation failed.");
        displayFeedback('Por favor, complete todos los campos obligatorios.', 'warning', 'formFeedback');
        return; // Stop if form is not valid
    }

    console.log("Form validation passed. Processing submission to Firestore...");

    // Get values from form fields
    const nombreUsuario = document.getElementById('nombreUsuario').value.trim();
    const rolUsuario = document.getElementById('rolUsuario').value;
    const ubicacion = document.getElementById('ubicacion').value.trim();
    const equipo = document.getElementById('equipo').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const prioridadChecked = document.querySelector('#prioridadGroup input[name=\"prioridad\"]:checked');
    const prioridad = prioridadChecked ? prioridadChecked.value : 'media';

    const nuevaIncidencia = {
        // No client-side ID needed; Firestore generates one.
        titulo: `Incidencia en ${ubicacion || 'ubicación desconocida'}`,
        descripcion: descripcion,
        prioridad: prioridad,
        estado: 'abierta', // Initial state
        fecha: firebase.firestore.FieldValue.serverTimestamp(), // Use server timestamp
        reportadoPor: nombreUsuario,
        rol: rolUsuario,
        ubicacion: ubicacion,
        equipo: equipo || 'N/A'
    };

    console.log('Nueva Incidencia Data (to Firestore):', nuevaIncidencia);

    // Add to Firestore
    try {
        // Disable submit button while saving
        const submitButton = form.querySelector('button[type="submit"]');
        if(submitButton) submitButton.disabled = true;

        const docRef = await db.collection('incidencias').add(nuevaIncidencia);
        console.log("Incidencia añadida a Firestore con ID: ", docRef.id);
        displayFeedback(`Incidencia reportada con éxito (ID: ${docRef.id.substring(0,6)}...).`, 'success', 'formFeedback');

        // Reset form and validation state
        form.reset();
        form.classList.remove('was-validated');
        priorityGroupDiv?.classList.remove('is-invalid');
        if(priorityErrorDiv) priorityErrorDiv.style.display = 'none';
        if(hiddenPrioInput) hiddenPrioInput.value = ''; // Clear hidden input

        // No need to manually reload the panel, Firestore listener will handle it.
    } catch (error) {
        console.error("Error adding document to Firestore: ", error);
        displayFeedback(`Error al guardar la incidencia: ${error.message}.`, 'danger', 'formFeedback');
    } finally {
         // Re-enable submit button
         const submitButton = form.querySelector('button[type="submit"]');
         if(submitButton) submitButton.disabled = false;
    }
}

// ========================================================================
// == PANEL HANDLING (Filtering, Sorting, Displaying) ==
// ========================================================================

let unsubscribeIncidencias = null; // To store the Firestore listener unsubscribe function
let allIncidencias = []; // To store all incidents fetched from Firestore

function setupPanelPage() {
    const searchInput = document.getElementById('filtroBusqueda');
    const statusFilter = document.getElementById('filtroEstado');
    const sortOrder = document.getElementById('ordenacion');
    const listaIncidenciasContainer = document.getElementById('listaIncidencias');

    if (!listaIncidenciasContainer) {
         console.error("Panel list container 'listaIncidencias' is missing.");
         return;
    }
    if (!db) { // Check if Firestore is initialized
        displayFeedback('Error: No se pudo conectar a la base de datos. No se pueden cargar incidencias.', 'danger', 'panelFeedbackContainer', false);
        return;
    }

    // Attach event listeners to filters/sorting controls
    // These listeners will now trigger a re-render with existing data, not a DB requery
    if (searchInput) searchInput.addEventListener('input', () => renderIncidencias());
    if (statusFilter) statusFilter.addEventListener('change', () => renderIncidencias());
    if (sortOrder) sortOrder.addEventListener('change', () => renderIncidencias());

    // Add delegated event listener for action buttons on incidents
    addPanelEventListeners(listaIncidenciasContainer);

    // Initial load and start listening for real-time updates
    listenForIncidencias();
    console.log("Panel listeners activated. Firestore listener attached.");
}

// New function to attach the Firestore listener
function listenForIncidencias() {
    if (!db) return;

    // Unsubscribe from previous listener if exists
    if (unsubscribeIncidencias) {
        console.log("Unsubscribing previous Firestore listener.");
        unsubscribeIncidencias();
    }

    console.log("Attaching Firestore listener...");
    // Listen for real-time updates on the 'incidencias' collection
    unsubscribeIncidencias = db.collection('incidencias')
        // Note: Sorting in Firestore is efficient but might conflict with complex client-side sorting/filtering.
        // We'll do client-side sorting for flexibility with combined filters.
        // .orderBy('fecha', 'desc') // Example: Could order by date in the query itself
        .onSnapshot(querySnapshot => {
            allIncidencias = []; // Clear the local cache
            querySnapshot.forEach(doc => {
                // Store both data and Firestore ID
                allIncidencias.push({ id: doc.id, ...doc.data() });
            });
            console.log(`Firestore listener update: ${allIncidencias.length} incidencias received.`);
            // Render the list with the fresh data
            renderIncidencias();
        }, error => {
            console.error("Error fetching incidencias from Firestore: ", error);
            displayFeedback(`Error al cargar incidencias: ${error.message}. Intenta recargar la página.`, 'danger', 'panelFeedbackContainer', false);
            // Show error in the list area
            const listaIncidenciasContainer = document.getElementById('listaIncidencias');
            if (listaIncidenciasContainer) {
                listaIncidenciasContainer.innerHTML = `<div class=\"alert alert-danger m-3\">Error al cargar datos: ${error.message}</div>`;
            }
            allIncidencias = []; // Clear data on error
            renderIncidencias(); // Re-render to show empty state or error message
        });
}

// Renamed from cargarPanelControl - Renders based on the current `allIncidencias` array
function renderIncidencias() {
    console.log("Rendering Panel Control with current data...");
    const listaIncidenciasContainer = document.getElementById('listaIncidencias');
    const contadorIncidencias = document.getElementById('contadorIncidencias');
    if (!listaIncidenciasContainer || !contadorIncidencias) return;

    // Use the globally stored allIncidencias array
    let incidenciasToDisplay = [...allIncidencias]; // Create a copy to filter/sort

    // Get current filter/sort values from UI
    const searchTerm = document.getElementById('filtroBusqueda')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filtroEstado')?.value || 'todas';
    const sortValue = document.getElementById('ordenacion')?.value || 'recientes';

    // 1. Filter Incidents (Client-side)
    const filteredIncidencias = incidenciasToDisplay.filter(inc => {
        // Status Filter
        const statusMatch = (statusFilter === 'todas') || (inc.estado === statusFilter);
        if (!statusMatch) return false;

        // Search Term Filter (check multiple fields)
        const searchMatch = !searchTerm || (
            inc.titulo?.toLowerCase().includes(searchTerm) ||
            inc.descripcion?.toLowerCase().includes(searchTerm) ||
            inc.reportadoPor?.toLowerCase().includes(searchTerm) ||
            inc.ubicacion?.toLowerCase().includes(searchTerm) ||
            inc.equipo?.toLowerCase().includes(searchTerm) ||
            inc.id.toLowerCase().includes(searchTerm) // Search by Firestore ID (string)
        );
        return searchMatch;
    });

    // 2. Sort Incidents (Client-side)
    const sortedIncidencias = filteredIncidencias.sort((a, b) => {
        // Handle potential null or undefined fecha (Firestore Timestamps)
        const dateA = a.fecha?.toDate ? a.fecha.toDate() : new Date(0); // Use epoch if invalid
        const dateB = b.fecha?.toDate ? b.fecha.toDate() : new Date(0);

        switch (sortValue) {
            case 'antiguas':
                return dateA - dateB;
            case 'prioridad':
                // Higher priority value first (Critica=4 > Alta=3 > ...)
                return (priorityOrderMap[b.prioridad] || 0) - (priorityOrderMap[a.prioridad] || 0);
            case 'recientes':
            default:
                return dateB - dateA; // Default: Newest first
        }
    });

    // 3. Render Incidents
    listaIncidenciasContainer.innerHTML = ''; // Clear previous list

    if (sortedIncidencias.length === 0) {
        listaIncidenciasContainer.innerHTML = `
            <div class=\"text-center p-4 text-muted\">\n                <i class=\"bi bi-clipboard-x fs-2 d-block mb-2\"></i>\n                ${allIncidencias.length === 0 ? 'No hay incidencias registradas.' : 'No hay incidencias que coincidan con los filtros actuales.'}\n            </div>`;
    } else {
        sortedIncidencias.forEach(incidencia => {
            // Pass the whole incident object (including Firestore ID) to create the card
            const cardElement = createIncidentCard(incidencia);
            listaIncidenciasContainer.appendChild(cardElement);
        });
    }

    // 4. Update Counter
    const count = sortedIncidencias.length;
    const total = allIncidencias.length;
    contadorIncidencias.textContent = `${count} incidencia${count !== 1 ? 's' : ''}${count !== total ? ` (de ${total})` : ''}`;
    console.log(`Panel rendered. Displaying ${count} of ${total} total incidents.`);
}

/**
 * Creates the HTML element for a single incident card based on Firestore data.
 * @param {object} incidencia - The incident object from Firestore (including id).
 * @returns {HTMLElement} - The card element.
 */
function createIncidentCard(incidencia) {
    const card = document.createElement('div');
    // Use Firestore document ID (string) in data-id
    card.className = `card card-incidencia mb-2 shadow-sm estado-${incidencia.estado || 'desconocido'}`;
    card.dataset.id = incidencia.id; // Store the full Firestore ID

    const priorityBadgeClass = getPriorityBadgeClass(incidencia.prioridad);

    // Format Firestore Timestamp (handle potential nulls/missing toDate)
    let fechaFormateada = 'Fecha desconocida';
    if (incidencia.fecha && typeof incidencia.fecha.toDate === 'function') {
        try {
             fechaFormateada = incidencia.fecha.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year:'2-digit', hour:'2-digit', minute: '2-digit' });
        } catch (e) { console.error("Error formatting date:", e, incidencia.fecha); }
    } else if (incidencia.fecha) {
        console.warn("Incidencia date is not a Firestore Timestamp:", incidencia.fecha);
        // Attempt to parse if it's a string (legacy data?)
        try {
            fechaFormateada = new Date(incidencia.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year:'2-digit' });
        } catch (e) { /* Ignore */ }
    }


    // Simplified Title/ID display
    const cardTitle = incidencia.titulo || 'Incidencia sin título';

    card.innerHTML = `
        <div class=\"card-header d-flex justify-content-between align-items-center py-2 px-3\">\n            <h6 class=\"card-title mb-0 text-truncate\" title=\"${cardTitle} (ID: ${incidencia.id})\">\n               <span class=\"fw-bold text-muted small me-2\">ID: ${incidencia.id.substring(0, 6)}...</span> ${cardTitle}\n            </h6>\n            <span class=\"badge ${priorityBadgeClass} ms-2 text-uppercase\">${incidencia.prioridad || 'N/D'}</span>\n        </div>\n        <div class=\"card-body p-3\">\n            <p class=\"card-text small mb-2\">${incidencia.descripcion || 'Sin descripción.'}</p>\n            <p class=\"card-text small text-muted incidencia-meta mb-2 pt-1\">\n                <i class=\"bi bi-geo-alt-fill me-1\"></i> ${incidencia.ubicacion || 'N/D'}\n                <span class=\"mx-1\">|</span>\n                <i class=\"bi bi-laptop me-1\"></i> ${incidencia.equipo || 'N/D'}\n                <span class=\"mx-1\">|</span>\n                <i class=\"bi bi-person-fill me-1\"></i> ${incidencia.reportadoPor || 'Anónimo'} (${incidencia.rol || 'N/D'})\n                <span class=\"mx-1\">|</span>\n                <i class=\"bi bi-calendar-event me-1\"></i> ${fechaFormateada}\n            </p>\n            <div class=\"d-flex justify-content-between align-items-center\">\n                <span class=\"badge rounded-pill ${getStatusBadgeClass(incidencia.estado)}\">\n                    <i class=\"${getStatusIconClass(incidencia.estado)} me-1\"></i> ${incidencia.estado || 'desconocido'}\n                </span>\n                <div class=\"action-buttons\">\n                    ${incidencia.estado === 'abierta' ? `\n                        <button class=\"btn btn-sm btn-outline-primary btn-change-status\" data-new-status=\"en progreso\" title=\"Marcar En Progreso\">\n                            <i class=\"bi bi-play-circle\"></i>\n                        </button>\n                         <button class=\"btn btn-sm btn-outline-success btn-change-status\" data-new-status=\"cerrada\" title=\"Marcar Cerrada\">\n                            <i class=\"bi bi-check-circle\"></i>\n                        </button>` : ''}\n                     ${incidencia.estado === 'en progreso' ? `\n                        <button class=\"btn btn-sm btn-outline-secondary btn-change-status\" data-new-status=\"abierta\" title=\"Marcar como Abierta\">\n                            <i class=\"bi bi-arrow-clockwise\"></i>\n                        </button>\n                        <button class=\"btn btn-sm btn-outline-success btn-change-status\" data-new-status=\"cerrada\" title=\"Marcar Cerrada\">\n                            <i class=\"bi bi-check-circle\"></i>\n                        </button>` : ''}\n                    ${incidencia.estado === 'cerrada' ? `\n                         <button class=\"btn btn-sm btn-outline-secondary btn-change-status\" data-new-status=\"abierta\" title=\"Reabrir Incidencia\">\n                            <i class=\"bi bi-arrow-clockwise\"></i>\n                         </button>`: ''}\n                    <button class=\"btn btn-sm btn-outline-danger btn-delete\" title=\"Eliminar Incidencia\">\n                        <i class=\"bi bi-trash\"></i>\n                    </button>\n                </div>\n            </div>\n        </div>\n    `;
    return card;
}

// Helper functions for card badges/icons (Unchanged)
function getPriorityBadgeClass(prioridad) {
    switch (prioridad) {
        case 'critica': return 'text-bg-danger';
        case 'alta': return 'text-bg-warning';
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
     if (!listContainer) return;
     listContainer.addEventListener('click', async (event) => { // Make async for await
         const target = event.target;
         const card = target.closest('.card-incidencia'); // Find the parent card
         if (!card) return; // Clicked outside a relevant area

         // Get Firestore ID (string) from data attribute
         const incidentId = card.dataset.id;
         if (!incidentId) {
             console.error("Could not find incident ID on card:", card);
             return; // Invalid ID
         }

         // Handle Status Change Button Click
         const changeStatusButton = target.closest('.btn-change-status');
         if (changeStatusButton) {
            const newStatus = changeStatusButton.dataset.newStatus;
            if (newStatus) {
                 await cambiarEstado(incidentId, newStatus, changeStatusButton); // Pass button for disabling
            }
            return; // Action handled
         }

         // Handle Delete Button Click
         const deleteButton = target.closest('.btn-delete');
         if (deleteButton) {
             await eliminarIncidencia(incidentId, deleteButton); // Pass button for disabling
             return; // Action handled
         }
     });
}

// Modified to use Firestore update
async function cambiarEstado(id, nuevoEstado, buttonElement) {
    if (!db) {
        displayFeedback('Error: No se pudo conectar a la base de datos.', 'danger', 'panelFeedbackContainer');
        return;
    }
    console.log(`Attempting to change state of incident #${id} to \'${nuevoEstado}\' in Firestore`);

    const incidentRef = db.collection('incidencias').doc(id);

    // Disable button temporarily
    if(buttonElement) buttonElement.disabled = true;

    try {
        await incidentRef.update({
            estado: nuevoEstado
            // Optional: update a 'lastModified' timestamp here too
            // lastModified: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`State changed for incident #${id}`);
        // Feedback will be displayed, but the UI update is handled by the listener automatically
        displayFeedback(`Estado de incidencia #${id.substring(0,6)}... actualizado a '${nuevoEstado}'.`, 'info', 'panelFeedbackContainer');
    } catch (error) {
        console.error(`Error updating document ${id}: `, error);
        displayFeedback(`Error al actualizar estado: ${error.message}`, 'danger', 'panelFeedbackContainer');
    } finally {
        // Re-enable button
        if(buttonElement) buttonElement.disabled = false;
    }
    // No need to call renderIncidencias() - listener will handle it
}


// Modified to use Firestore delete
async function eliminarIncidencia(id, buttonElement) {
    if (!db) {
        displayFeedback('Error: No se pudo conectar a la base de datos.', 'danger', 'panelFeedbackContainer');
        return;
    }
    console.log(`Attempting to delete incident #${id} from Firestore`);

    // Confirmation (Still using confirm, consider a modal for better UX)
    if (confirm(`¿Estás seguro de que deseas eliminar la incidencia #${id.substring(0,6)}...? \nEsta acción no se puede deshacer.`)) {

        // Disable button temporarily
        if(buttonElement) buttonElement.disabled = true;
        const incidentRef = db.collection('incidencias').doc(id);

        try {
            await incidentRef.delete();
            console.log(`Incident #${id} deleted successfully from Firestore.`);
            // UI update handled by listener
            displayFeedback(`Incidencia #${id.substring(0,6)}... eliminada.`, 'warning', 'panelFeedbackContainer');
        } catch (error) {
            console.error(`Error deleting document ${id}: `, error);
            displayFeedback(`Error al eliminar incidencia: ${error.message}`, 'danger', 'panelFeedbackContainer');
             // Re-enable button only on error, as the element will be gone on success
             if(buttonElement) buttonElement.disabled = false;
        }
        // No finally block needed for re-enabling button here, as it disappears on success
    } else {
        console.log(`Deletion of incident #${id} cancelled.`);
    }
    // No need to call renderIncidencias() - listener will handle it
}

// ========================================================================
// == UI FEEDBACK UTILITY ==
// ========================================================================

/**
 * Displays temporary feedback message in a specified container.
 * @param {string} message - The message to display.
 * @param {'success'|'danger'|'warning'|'info'} type - Bootstrap alert type.
 * @param {string} containerId - ID of the container element (e.g., 'formFeedback' or 'panelFeedbackContainer').
 * @param {boolean} autoDismiss - Whether to auto-dismiss the alert after a delay (default: true).
 */
function displayFeedback(message, type = 'info', containerId, autoDismiss = true) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Feedback container with ID '${containerId}' not found. Falling back to console.`);
        console.log(`[${type.toUpperCase()}] ${message}`);
        return; // Cannot display if container doesn't exist
    }

    // Create the alert element using Bootstrap classes
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = `alert alert-${type} alert-dismissible fade show form-feedback-alert`;
    feedbackDiv.setAttribute('role', 'alert');
    feedbackDiv.innerHTML = `
        ${message}
        <button type=\"button\" class=\"btn-close btn-sm\" data-bs-dismiss=\"alert\" aria-label=\"Close\"></button>
    `;

    // Clear previous alerts in the container before adding new one
    // (Except for critical initialization errors)
    if (autoDismiss) {
        const existingAlert = container.querySelector('.form-feedback-alert');
        if(existingAlert) {
            // Use Bootstrap's Alert class to dismiss properly
             try {
                const alertInstance = bootstrap.Alert.getOrCreateInstance(existingAlert);
                if(alertInstance) alertInstance.close();
            } catch(e) {
                // Fallback if Bootstrap JS isn't loaded or fails
                existingAlert.remove();
            }
        }
    }


    // Add the new alert
    container.appendChild(feedbackDiv);

    // Auto-remove after a few seconds if requested
    if (autoDismiss) {
        setTimeout(() => {
             try {
                const alertInstance = bootstrap.Alert.getOrCreateInstance(feedbackDiv);
                if(alertInstance) alertInstance.close();
            } catch(e) {
                // Fallback if Bootstrap JS isn't loaded or fails during timeout
                feedbackDiv.remove();
            }
        }, 5000); // Close after 5 seconds
    }
}
