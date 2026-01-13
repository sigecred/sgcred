document.addEventListener('DOMContentLoaded', () => {
  initDB().then(() => {
    console.log('Base de datos inicializada para la página de préstamos.');
    loadAndDisplayLoans();
    setupEventListeners();
  }).catch(error => {
    console.error('Error al inicializar la base de datos:', error);
  });
});

async function loadAndDisplayLoans() {
  const params = new URLSearchParams(window.location.search);
  const cedulaFilter = params.get('cedula');

  const loansListDiv = document.getElementById('loans-list');
  const searchCedulaInput = document.getElementById('search-cedula');
  if (cedulaFilter) {
    searchCedulaInput.value = cedulaFilter;
  }
  const searchCedula = searchCedulaInput.value.toLowerCase();
  const searchNombre = document.getElementById('search-nombre').value.toLowerCase();
  const sortBy = document.getElementById('sort-by').value;
  const sortOrder = document.getElementById('sort-order').value;

  if (!db) {
    loansListDiv.innerHTML = '<p class="text-red-500">Error: La base de datos no está inicializada.</p>';
    return;
  }
  const transaction = db.transaction(['prestamos', 'clientes'], 'readonly');
  const prestamosStore = transaction.objectStore('prestamos');
  const clientesStore = transaction.objectStore('clientes');
  const getAllPrestamos = prestamosStore.getAll();

  getAllPrestamos.onsuccess = async () => {
    let prestamos = getAllPrestamos.result;
    let enrichedPrestamos = [];

    for (const prestamo of prestamos) {
      const cliente = await getClienteByCedula(prestamo.clienteCedula);
      if (cliente) {
        prestamo.nombreApellido = cliente.nombreApellido;
        enrichedPrestamos.push(prestamo);
      }
    }

    // Filtering
    if (searchCedula) {
      enrichedPrestamos = enrichedPrestamos.filter(p => p.clienteCedula.toLowerCase().includes(searchCedula));
    }
    if (searchNombre) {
      enrichedPrestamos = enrichedPrestamos.filter(p => p.nombreApellido.toLowerCase().includes(searchNombre));
    }

    // Sorting
    enrichedPrestamos.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    if (enrichedPrestamos.length === 0) {
      loansListDiv.innerHTML = '<p class="text-gray-500">No hay préstamos que coincidan con la búsqueda.</p>';
      return;
    }
    loansListDiv.innerHTML = '';

    for (const prestamo of enrichedPrestamos) {
      const cuotas = await getCuotasByPrestamoId(prestamo.id);
      const totalPagado = cuotas.reduce((acc, cuota) => acc + (cuota.montoPagado || 0), 0);
      const saldo = (prestamo.capital * (1 + prestamo.interesTotal / 100)) - totalPagado;

      let diasDeAtraso = 0;
      cuotas.forEach(cuota => {
        if (cuota.fechaPago && cuota.fechaVencimiento) {
          const fechaPago = new Date(cuota.fechaPago);
          const fechaVencimiento = new Date(cuota.fechaVencimiento);
          if (fechaPago > fechaVencimiento) {
            const diffTime = fechaPago.getTime() - fechaVencimiento.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
            diasDeAtraso += diffDays;
          }
        }
      });

      const card = document.createElement('div');
      card.className = 'bg-white p-4 rounded-lg shadow-md';
      const estadoClass = prestamo.estado === 'ACTIVO' ? 'text-green-600' : 'text-red-600';
      card.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <h2 class="text-lg font-bold text-blue-700">${prestamo.nombreApellido}</h2>
          <span class="text-sm font-semibold ${estadoClass}">${prestamo.estado}</span>
        </div>
        <p class="text-gray-600">Capital: <span class="font-medium">Gs. ${prestamo.capital.toLocaleString('es-PY')}</span></p>
        <p class="text-gray-600">Saldo: <span class="font-medium">Gs. ${saldo.toLocaleString('es-PY')}</span></p>
        <p class="text-gray-600">Fecha Desembolso: <span class="font-medium">${prestamo.fechaDesembolso}</span></p>
        <p class="text-gray-600">Frecuencia de Pago: <span class="font-medium">${prestamo.frecuenciaPago}</span></p>
        <p class="text-gray-600">Días de Atraso: <span class="font-medium text-red-500">${diasDeAtraso}</span></p>
        <div class="mt-4 flex justify-end space-x-2">
          <a href="plan_pago.html?id=${prestamo.id}" class="px-3 py-1 bg-green-500 text-white rounded-md text-sm hover:bg-green-600">Cobrar</a>
          <button data-id="${prestamo.id}" class="view-btn px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600">Ver</button>
          <button data-id="${prestamo.id}" class="delete-btn px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600">Eliminar</button>
        </div>
      `;
      loansListDiv.appendChild(card);
    }
    addEventListenersToButtons();
  };
  getAllPrestamos.onerror = event => {
    console.error('Error al leer los préstamos:', event.target.error);
    loansListDiv.innerHTML = '<p class="text-red-500">Error al cargar la lista de préstamos.</p>';
  };
}

function addEventListenersToButtons() {
    const viewLoanModal = document.getElementById('view-loan-modal');
    const viewLoanForm = document.getElementById('view-loan-form');
    const cancelViewLoanBtn = document.getElementById('cancel-view-loan-btn');

    document.querySelectorAll('.view-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const loanId = parseInt(e.target.dataset.id);
            const loan = await getPrestamoById(loanId);
            const client = await getClienteByCedula(loan.clienteCedula);

            document.getElementById('view-loan-id').value = loan.id;
            document.getElementById('view-cedula').value = loan.clienteCedula;
            document.getElementById('view-nombreApellido').value = client ? client.nombreApellido : '';
            document.getElementById('view-capital').value = loan.capital.toLocaleString('es-PY');
            document.getElementById('view-estado').value = loan.estado;
            
            viewLoanModal.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const loanId = parseInt(e.target.dataset.id);
            const cuotas = await getCuotasByPrestamoId(loanId);
            const hasPayments = cuotas.some(cuota => cuota.estado === 'PAGADO' || cuota.montoPagado > 0);

            if (hasPayments) {
                alert('ERROR, PRÉSTAMO CON PAGOS VIGENTES.');
            } else {
                if (confirm('¿Está seguro de que desea eliminar este préstamo?')) {
                    await deletePrestamo(loanId);
                    loadAndDisplayLoans();
                }
            }
        });
    });

    cancelViewLoanBtn.addEventListener('click', () => {
        viewLoanModal.classList.add('hidden');
    });

    viewLoanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const loanId = parseInt(document.getElementById('view-loan-id').value);
        const newStatus = document.getElementById('view-estado').value;

        const loan = await getPrestamoById(loanId);
        loan.estado = newStatus;

        await updatePrestamo(loan);
        viewLoanModal.classList.add('hidden');
        loadAndDisplayLoans(); // Refresh the list
    });
}

function setupEventListeners() {
  document.getElementById('search-cedula').addEventListener('input', loadAndDisplayLoans);
  document.getElementById('search-nombre').addEventListener('input', loadAndDisplayLoans);
  document.getElementById('sort-by').addEventListener('change', loadAndDisplayLoans);
  document.getElementById('sort-order').addEventListener('change', loadAndDisplayLoans);
  
  const menuBtn = document.getElementById('menu-btn');
  const navMenu = document.getElementById('nav-menu');
  if (!menuBtn || !navMenu) return;

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
