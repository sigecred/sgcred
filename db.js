let db;

function initDB() {
  return new Promise((resolve, reject) => {
    // Incrementar la versión de la base de datos a 4 para añadir el almacén de cuotas
    const request = indexedDB.open('CreditisDB', 4);

    request.onupgradeneeded = event => {
      db = event.target.result;
      console.log('Database upgrade needed. Upgrading to version 4.');

      // --- Almacén de Clientes ---
      let clientesStore;
      if (!db.objectStoreNames.contains('clientes')) {
        clientesStore = db.createObjectStore('clientes', { keyPath: 'id', autoIncrement: true });
      } else {
        clientesStore = event.target.transaction.objectStore('clientes');
      }
      if (!clientesStore.indexNames.contains('cedula')) {
        clientesStore.createIndex('cedula', 'cedula', { unique: true });
      }

      // --- Almacén de Préstamos ---
      let prestamosStore;
      if (!db.objectStoreNames.contains('prestamos')) {
        prestamosStore = db.createObjectStore('prestamos', { keyPath: 'id', autoIncrement: true });
      } else {
        prestamosStore = event.target.transaction.objectStore('prestamos');
      }
      if (!prestamosStore.indexNames.contains('clienteCedula')) {
        prestamosStore.createIndex('clienteCedula', 'clienteCedula', { unique: false });
      }
      
      // --- Almacén de Cuotas (Plan de Pagos) ---
      if (!db.objectStoreNames.contains('cuotas')) {
        const cuotasStore = db.createObjectStore('cuotas', { keyPath: 'id', autoIncrement: true });
        cuotasStore.createIndex('prestamoId', 'prestamoId', { unique: false });
        console.log('Object store "cuotas" and index "prestamoId" created.');
      }
    };

    request.onsuccess = event => {
      db = event.target.result;
      window.db = event.target.result; // Exponer la DB globalmente para las pruebas
      console.log('Database opened successfully');
      resolve(db);
    };

    request.onerror = event => {
      console.error('Database error:', event.target.error);
      reject('Error opening database');
    };
  });
}

function saveCliente(cliente) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['clientes'], 'readwrite');
    const store = transaction.objectStore('clientes');
    const cedulaIndex = store.index('cedula');
    const getRequest = cedulaIndex.get(cliente.cedula);

    getRequest.onsuccess = () => {
      const existingClient = getRequest.result;
      // Si el cliente existe, actualizamos sus datos. Si no, lo creamos.
      const dataToStore = existingClient ? { ...existingClient, ...cliente } : cliente;
      const putRequest = store.put(dataToStore);
      
      putRequest.onsuccess = () => resolve(putRequest.result);
      putRequest.onerror = event => reject('Error saving client: ' + event.target.error);
    };
    getRequest.onerror = event => reject('Error fetching client by cedula: ' + event.target.error);
  });
}

function getClienteByCedula(cedula) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['clientes'], 'readonly');
    const store = transaction.objectStore('clientes');
    const index = store.index('cedula');
    const request = index.get(cedula);

    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject('Error fetching client by cedula: ' + event.target.error);
  });
}

function getClienteById(id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['clientes'], 'readonly');
    const store = transaction.objectStore('clientes');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject('Error fetching client by id: ' + event.target.error);
  });
}

function getPrestamosByClienteCedula(cedula) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['prestamos'], 'readonly');
    const store = transaction.objectStore('prestamos');
    const index = store.index('clienteCedula');
    const request = index.getAll(cedula);

    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject('Error fetching prestamos by cliente cedula: ' + event.target.error);
  });
}

function deleteCliente(clienteId) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        const transaction = db.transaction(['clientes', 'prestamos', 'cuotas'], 'readwrite');
        const clientesStore = transaction.objectStore('clientes');
        const prestamosStore = transaction.objectStore('prestamos');
        const cuotasStore = transaction.objectStore('cuotas');

        const getClientRequest = clientesStore.get(clienteId);
        getClientRequest.onsuccess = () => {
            const client = getClientRequest.result;
            if (!client) return resolve();

            const deleteClientRequest = clientesStore.delete(clienteId);
            deleteClientRequest.onerror = event => reject('Error deleting client: ' + event.target.error);

            const prestamosIndex = prestamosStore.index('clienteCedula');
            const prestamosRequest = prestamosIndex.openCursor(IDBKeyRange.only(client.cedula));
            
            prestamosRequest.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    const prestamo = cursor.value;
                    const cuotasIndex = cuotasStore.index('prestamoId');
                    const cuotasRequest = cuotasIndex.openCursor(IDBKeyRange.only(prestamo.id));
                    cuotasRequest.onsuccess = e => {
                        const cuotaCursor = e.target.result;
                        if(cuotaCursor){
                            cuotaCursor.delete();
                            cuotaCursor.continue();
                        }
                    };
                    cursor.delete();
                    cursor.continue();
                }
            };
        };
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = event => reject('Transaction error: ' + event.target.error);
    });
}


function savePrestamo(prestamo) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['prestamos'], 'readwrite');
    const store = transaction.objectStore('prestamos');
    const request = store.add(prestamo);

    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject('Error saving prestamo: ' + event.target.error);
  });
}

/**
 * Guarda un nuevo pago en la base de datos.
 * @param {object} pago - El objeto del pago a guardar.
 * @returns {Promise<number>} La ID del nuevo pago guardado.
 */
function savePago(pago) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['pagos'], 'readwrite');
    const store = transaction.objectStore('pagos');
    const request = store.add(pago);

    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject('Error saving pago: ' + event.target.error);
  });
}

function getPrestamoById(id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['prestamos'], 'readonly');
    const store = transaction.objectStore('prestamos');
    const request = store.get(id);

    request.onsuccess = () => {
        if (request.result) {
            resolve(request.result);
        } else {
            reject('Prestamo not found with id: ' + id);
        }
    };
    request.onerror = event => reject('Error fetching prestamo by id: ' + event.target.error);
  });
}

function updatePrestamo(prestamo) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['prestamos'], 'readwrite');
    const store = transaction.objectStore('prestamos');
    const request = store.put(prestamo);

    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject('Error updating prestamo: ' + event.target.error);
  });
}

function deletePrestamo(prestamoId) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        const transaction = db.transaction(['prestamos', 'cuotas'], 'readwrite');
        const prestamosStore = transaction.objectStore('prestamos');
        const cuotasStore = transaction.objectStore('cuotas');
        
        const deletePrestamoRequest = prestamosStore.delete(prestamoId);
        deletePrestamoRequest.onerror = event => reject('Error deleting prestamo: ' + event.target.error);

        const cuotasIndex = cuotasStore.index('prestamoId');
        const cuotasRequest = cuotasIndex.openCursor(IDBKeyRange.only(prestamoId));
        
        cuotasRequest.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
        cuotasRequest.onerror = event => reject('Error deleting cuotas: ' + event.target.error);

        transaction.oncomplete = () => resolve();
        transaction.onerror = event => reject('Transaction error: ' + event.target.error);
    });
}


/**
 * Guarda una nueva cuota en la base de datos.
 * @param {object} cuota - El objeto de la cuota a guardar.
 * @returns {Promise<number>} La ID de la nueva cuota guardada.
 */
function saveCuota(cuota) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['cuotas'], 'readwrite');
    const store = transaction.objectStore('cuotas');
    const request = store.add(cuota);

    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject('Error saving cuota: ' + event.target.error);
  });
}

/**
 * Obtiene todas las cuotas asociadas a un ID de préstamo.
 * @param {number} prestamoId - El ID del préstamo.
 * @returns {Promise<Array>} Una lista de las cuotas.
 */
function getCuotasByPrestamoId(prestamoId) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['cuotas'], 'readonly');
    const store = transaction.objectStore('cuotas');
    const index = store.index('prestamoId');
    const request = index.getAll(prestamoId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject('Error fetching cuotas by prestamoId: ' + event.target.error);
  });
}

/**
 * Actualiza una cuota con la información de un pago.
 * @param {number} cuotaId - El ID de la cuota a actualizar.
 * @param {string} fechaPago - La fecha en que se realizó el pago.
 * @param {number} montoPagado - El monto pagado.
 * @returns {Promise}
 */
function updateCuotaPago(cuotaId, fechaPago, montoPagado) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        const transaction = db.transaction(['cuotas'], 'readwrite');
        const store = transaction.objectStore('cuotas');
        const getRequest = store.get(cuotaId);

        getRequest.onsuccess = () => {
            const cuota = getRequest.result;
            if (cuota) {
                cuota.estado = 'PAGADO';
                cuota.fechaPago = fechaPago;
                cuota.montoPagado = montoPagado;
                cuota.saldo = cuota.montoCuota - montoPagado;
                
                const updateRequest = store.put(cuota);
                updateRequest.onsuccess = () => resolve(updateRequest.result);
                updateRequest.onerror = event => reject('Error updating cuota: ' + event.target.error);
            } else {
                reject('Cuota not found');
            }
        };
        getRequest.onerror = event => reject('Error fetching cuota: ' + event.target.error);
    });
}
