document.addEventListener('DOMContentLoaded', () => {
  initDB().then(() => {
    console.log('Base de datos inicializada para la página de clientes.');
    loadAndDisplayClients();
    setupEventListeners();
  }).catch(error => {
    console.error('Error al inicializar la base de datos:', error);
  });
});

async function loadAndDisplayClients() {
  const clientsListDiv = document.getElementById('clients-list');
  
  if (!db) {
    clientsListDiv.innerHTML = '<p class="text-red-500">Error: La base de datos no está inicializada.</p>';
    return;
  }

  const transaction = db.transaction(['clientes'], 'readonly');
  const store = transaction.objectStore('clientes');
  const getAllRequest = store.getAll();

  getAllRequest.onsuccess = () => {
    const clientes = getAllRequest.result;

    if (clientes.length === 0) {
      clientsListDiv.innerHTML = '<p class="text-gray-500">No hay clientes registrados.</p>';
      return;
    }

    clientsListDiv.innerHTML = '';

    clientes.forEach(cliente => {
      const card = document.createElement('div');
      card.className = 'bg-white p-4 rounded-lg shadow-md';

      card.innerHTML = `
        <div class="mb-2">
          <h2 class="text-lg font-bold text-blue-700">${cliente.nombreApellido}</h2>
          <p class="text-sm text-gray-600">Cédula: ${cliente.cedula}</p>
          <p class="text-sm text-gray-600">Teléfono: ${cliente.telefono1 || 'No disponible'}</p>
        </div>
        <div class="mt-4 flex justify-end space-x-2">
          <button data-id="${cliente.id}" class="view-btn px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600">VER</button>
          <button data-id="${cliente.id}" class="delete-btn px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600">ELIMINAR</button>
          <button data-cedula="${cliente.cedula}" class="prestamos-btn px-3 py-1 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600">PRESTAMOS</button>
        </div>
      `;
      clientsListDiv.appendChild(card);
    });
    addEventListenersToButtons();
  };

  getAllRequest.onerror = event => {
    console.error('Error al leer los clientes:', event.target.error);
    clientsListDiv.innerHTML = '<p class="text-red-500">Error al cargar la lista de clientes.</p>';
  };
}

function addEventListenersToButtons() {
    const viewClientModal = document.getElementById('view-client-modal');
    const viewClientForm = document.getElementById('view-client-form');
    const cancelViewClientBtn = document.getElementById('cancel-view-client-btn');

    document.querySelectorAll('.view-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const clientId = parseInt(e.target.dataset.id);
            const client = await getClienteById(clientId);

            document.getElementById('view-client-id').value = client.id;
            document.getElementById('view-cedula').value = client.cedula;
            document.getElementById('view-nombres').value = client.nombres;
            document.getElementById('view-apellidos').value = client.apellidos;
            document.getElementById('view-direccion').value = client.direccion || '';
            document.getElementById('view-barrio').value = client.barrio || '';
            document.getElementById('view-ciudad').value = client.ciudad || '';
            document.getElementById('view-telefono1').value = client.telefono1 || '';
            document.getElementById('view-telefono2').value = client.telefono2 || '';
            
            viewClientModal.classList.remove('hidden');
        });
    });

    cancelViewClientBtn.addEventListener('click', () => {
        viewClientModal.classList.add('hidden');
    });

    viewClientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const clientId = parseInt(document.getElementById('view-client-id').value);
        const client = await getClienteById(clientId);

        client.direccion = document.getElementById('view-direccion').value;
        client.barrio = document.getElementById('view-barrio').value;
        client.ciudad = document.getElementById('view-ciudad').value;
        client.telefono1 = document.getElementById('view-telefono1').value;
        client.telefono2 = document.getElementById('view-telefono2').value;

        await saveCliente(client);
        viewClientModal.classList.add('hidden');
        loadAndDisplayClients(); // Refresh the list
    });

    document.querySelectorAll('.prestamos-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const cedula = e.target.dataset.cedula;
            const prestamos = await getPrestamosByClienteCedula(cedula);

            if (prestamos.length === 0) {
                alert('CLIENTE SIN PRESTAMOS');
            } else {
                window.location.href = `prestamos.html?cedula=${cedula}`;
            }
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const clientId = parseInt(e.target.dataset.id);
            const client = await getClienteById(clientId);
            const prestamos = await getPrestamosByClienteCedula(client.cedula);
            const hasActiveLoans = prestamos.some(p => p.estado === 'ACTIVO');

            if (hasActiveLoans) {
                alert('ERROR, CLIENTE CON PRESTAMOS ACTIVOS.');
            } else {
                if (confirm('¿Está seguro de que desea eliminar este cliente? Todos sus préstamos asociados (activos o no) también serán eliminados.')) {
                    await deleteCliente(clientId);
                    loadAndDisplayClients();
                }
            }
        });
    });
}

function setupEventListeners() {
  const menuBtn = document.getElementById('menu-btn');
  const navMenu = document.getElementById('nav-menu');
  
  menuBtn.addEventListener('click', () => {
    const isHidden = navMenu.classList.contains('hidden');
    if (isHidden) {
      navMenu.classList.remove('hidden', 'opacity-0', 'scale-95');
      navMenu.classList.add('opacity-100', 'scale-100');
    } else {
      navMenu.classList.add('opacity-0', 'scale-95');
      setTimeout(() => navMenu.classList.add('hidden'), 300);
    }
  });

  document.addEventListener('click', (event) => {
    if (!menuBtn.contains(event.target) && !navMenu.contains(event.target)) {
      navMenu.classList.add('opacity-0', 'scale-95');
      setTimeout(() => navMenu.classList.add('hidden'), 300);
    }
  });
}
