/**
 * Calcula la cuota mensual de un préstamo utilizando el método de amortización francés.
 */
function calculateAmortization(principal, monthlyInterestRatePercentage, numberOfMonths) {
  if (principal <= 0 || numberOfMonths <= 0) return 0;
  if (monthlyInterestRatePercentage === 0) {
    // Redondear solo al final
    return Math.round((principal / numberOfMonths) * 100) / 100;
  }
  const monthlyRate = monthlyInterestRatePercentage / 100;
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfMonths);
  const denominator = Math.pow(1 + monthlyRate, numberOfMonths) - 1;
  if (denominator === 0) return 0;
  const monthlyPayment = numerator / denominator;
  // Redondear a 2 decimales solo al final para mayor precisión
  return Math.round(monthlyPayment * 100) / 100;
}

// --- Funciones de Utilidad ---

/**
 * Formatea el valor de un input numérico para incluir separadores de miles (puntos).
 * @param {Event} event - El evento del input.
 */
function formatNumberInput(event) {
  const input = event.target;
  let value = input.value.replace(/\./g, ''); // Eliminar puntos existentes
  value = value.replace(/[^0-9]/g, ''); // Permitir solo números
  
  if (value) {
    const formattedValue = parseInt(value, 10).toLocaleString('es-PY');
    input.value = formattedValue;
  } else {
    input.value = '';
  }
}

/**
 * Elimina el formato de miles de un string numérico.
 * @param {string} value - El valor formateado (ej. "1.000.000").
 * @returns {number} El número sin formato.
 */
function unformatNumber(value) {
  if (typeof value !== 'string') return value;
  return parseFloat(value.replace(/\./g, ''));
}


// --- Lógica del Dashboard ---

document.addEventListener('DOMContentLoaded', () => {
  initDB().then(() => {
    console.log('Base de datos inicializada.');
    setupEventListeners();
  }).catch(error => {
    console.error('Error al inicializar la base de datos:', error);
  });
});

// --- Lógica de Eventos y Formularios ---

function setupEventListeners() {
  const menuBtn = document.getElementById('menu-btn');
  const navMenu = document.getElementById('nav-menu');
  
  // Modales y formularios
  const newLoanLink = document.getElementById('new-loan-link');
  const loanModal = document.getElementById('loan-modal');
  const cancelLoanBtn = document.getElementById('cancel-loan-btn');
  const loanForm = document.getElementById('loan-form');
  
  const newClientLink = document.getElementById('new-client-link');
  const clientModal = document.getElementById('client-modal');
  const cancelClientBtn = document.getElementById('cancel-client-btn');
  const clientForm = document.getElementById('client-form');

  // Botones del Dashboard
  const mainNewLoanBtn = document.getElementById('main-new-loan-btn');
  const mainNewClientBtn = document.getElementById('main-new-client-btn');

  // Lógica del Menú
  if (menuBtn) {
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
  
  // Cerrar menú al hacer clic fuera
    document.addEventListener('click', (event) => {
        if (menuBtn && navMenu && !menuBtn.contains(event.target) && !navMenu.contains(event.target)) {
            navMenu.classList.add('opacity-0', 'scale-95');
            setTimeout(() => navMenu.classList.add('hidden'), 300);
        }
    });
  }

  // --- Lógica para los botones del Dashboard ---
  if (mainNewLoanBtn) {
    mainNewLoanBtn.addEventListener('click', () => {
      loanModal.classList.remove('hidden');
    });
  }
  if (mainNewClientBtn) {
    mainNewClientBtn.addEventListener('click', () => {
      clientModal.classList.remove('hidden');
    });
  }

  // --- Lógica para Modal de Nuevo Préstamo ---
  if (newLoanLink) {
    newLoanLink.addEventListener('click', (e) => {
      e.preventDefault();
      loanModal.classList.remove('hidden');
      navMenu.classList.add('hidden', 'opacity-0', 'scale-95');
    });
  }
  if (cancelLoanBtn) {
    cancelLoanBtn.addEventListener('click', () => {
      loanModal.classList.add('hidden');
    });
  }

  // --- Lógica para Modal de Nuevo Cliente ---
  if (newClientLink) {
    newClientLink.addEventListener('click', (e) => {
      e.preventDefault();
      clientModal.classList.remove('hidden');
      navMenu.classList.add('hidden', 'opacity-0', 'scale-95');
    });
  }
  if (cancelClientBtn) {
    cancelClientBtn.addEventListener('click', () => {
      clientModal.classList.add('hidden');
    });
  }
  
  if (loanForm) {
    // --- Lógica para guardar Nuevo Cliente ---
    if(clientForm) {
      clientForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(clientForm);
        
        const cliente = {
          cedula: formData.get('cedula'),
          nombres: formData.get('nombres'),
          apellidos: formData.get('apellidos'),
          nombreApellido: `${formData.get('nombres')} ${formData.get('apellidos')}`, // Campo unificado
          direccion: formData.get('direccion'),
          barrio: formData.get('barrio'),
          ciudad: formData.get('ciudad'),
          telefono1: formData.get('telefono1'),
          telefono2: formData.get('telefono2'),
          refNombre: formData.get('refNombre'),
          refTelefono: formData.get('refTelefono'),
        };

        try {
          await saveCliente(cliente);
          alert('CLIENTE AGREGADO');
          clientForm.reset();
          clientModal.classList.add('hidden');
        } catch (error) {
          console.error('Error al guardar el cliente:', error);
          alert('Error al guardar el cliente. Verifique que la Cédula no esté duplicada.');
        }
      });
    }

    // Calcular interés total dinámicamente y aplicar formato
    const capitalInput = document.getElementById('capital');
    const cantidadCuotasInput = document.getElementById('cantidadCuotas');
    const montoCuotaInput = document.getElementById('montoCuota');
    const interesTotalInput = document.getElementById('interesTotal');

    const calculateInterest = () => {
      const capital = unformatNumber(capitalInput.value) || 0;
      const cantidadCuotas = parseInt(cantidadCuotasInput.value) || 0;
      const montoCuota = unformatNumber(montoCuotaInput.value) || 0;

      if (capital > 0 && cantidadCuotas > 0 && montoCuota > 0) {
        const totalPagado = cantidadCuotas * montoCuota;
        const interesGanado = totalPagado - capital;
        const porcentajeInteres = (interesGanado / capital) * 100;
        interesTotalInput.value = porcentajeInteres.toFixed(2) + ' %';
      } else {
        interesTotalInput.value = '';
      }
    };

    capitalInput.addEventListener('input', formatNumberInput);
    montoCuotaInput.addEventListener('input', formatNumberInput);
    
    capitalInput.addEventListener('input', calculateInterest);
    cantidadCuotasInput.addEventListener('input', calculateInterest);
    montoCuotaInput.addEventListener('input', calculateInterest);

    const cedulaInput = document.getElementById('cedula');
    cedulaInput.addEventListener('blur', async () => {
        const cedula = cedulaInput.value;
        if (cedula) {
            const cliente = await getClienteByCedula(cedula);
            if (cliente) {
                document.getElementById('nombres').value = cliente.nombres;
                document.getElementById('apellidos').value = cliente.apellidos;
            }
        }
    });

    loanForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(loanForm);
      const cedula = formData.get('cedula');

      const nombres = formData.get('nombres');
      const apellidos = formData.get('apellidos');
      
      const existingClient = await getClienteByCedula(cedula);

      if (existingClient) {
        // Update existing client
        existingClient.nombres = nombres;
        existingClient.apellidos = apellidos;
        existingClient.nombreApellido = `${nombres} ${apellidos}`;
        await saveCliente(existingClient);
      } else {
        // Create new client
        const newClient = {
          cedula: cedula,
          nombres: nombres,
          apellidos: apellidos,
          nombreApellido: `${nombres} ${apellidos}`,
        };
        await saveCliente(newClient);
        alert('NUEVO CLIENTE REGISTRADO');
      }

      // Recalcular el interés para asegurar que se guarda el valor numérico
      const capital = unformatNumber(formData.get('capital')) || 0;
      const cantidadCuotas = parseInt(formData.get('cantidadCuotas')) || 0;
      const montoCuota = unformatNumber(formData.get('montoCuota')) || 0;
      let interesTotalNumerico = 0;
      if (capital > 0 && cantidadCuotas > 0 && montoCuota > 0) {
        const totalPagado = cantidadCuotas * montoCuota;
        const interesGanado = totalPagado - capital;
        interesTotalNumerico = parseFloat(((interesGanado / capital) * 100).toFixed(2));
      }

      const prestamo = {
        clienteCedula: cedula,
        capital: capital,
        frecuenciaPago: formData.get('frecuenciaPago'),
        cantidadCuotas: cantidadCuotas,
        montoCuota: montoCuota,
        interesTotal: interesTotalNumerico, // Guardar solo el número
        fechaDesembolso: formData.get('fechaDesembolso'),
        fechaPrimerPago: formData.get('fechaPrimerPago'),
        estado: formData.get('estado'),
      };

      try {
        const prestamoId = await savePrestamo(prestamo);
        console.log('Préstamo grabado exitosamente con ID:', prestamoId);
        
        await generarYGuardarPlanDePago(prestamo, prestamoId);

        loanForm.reset();
        loanModal.classList.add('hidden');
        console.log('Plan de pago generado y modal cerrado.');

      } catch (error) {
        console.error('Error durante el proceso de grabación del préstamo y plan de pago:', error);
      }
    });
  }
}

/**
 * Genera el plan de pagos para un préstamo y lo guarda en la base de datos.
 * @param {object} prestamo - El objeto del préstamo.
 * @param {number} prestamoId - El ID del préstamo recién guardado.
 */
async function generarYGuardarPlanDePago(prestamo, prestamoId) {
  const { fechaPrimerPago, cantidadCuotas, frecuenciaPago, montoCuota } = prestamo;
  let fechaActual = new Date(fechaPrimerPago + 'T00:00:00'); // Asegurar que se interpreta como fecha local

  for (let i = 1; i <= cantidadCuotas; i++) {
    const cuota = {
      prestamoId: prestamoId,
      numeroCuota: i,
      montoCuota: montoCuota,
      fechaVencimiento: fechaActual.toISOString().split('T')[0], // Guardar como YYYY-MM-DD
      estado: 'PENDIENTE',
      // Campos para el pago
      fechaPago: null,
      montoPagado: null,
      saldo: montoCuota,
    };
    
    // Guardar la cuota en la base de datos
    await saveCuota(cuota);
    console.log(`Cuota ${i} guardada para el préstamo ${prestamoId}`);

    // Calcular la fecha de la siguiente cuota
    switch (frecuenciaPago) {
      case 'D':
        fechaActual.setDate(fechaActual.getDate() + 1);
        break;
      case 'S':
        fechaActual.setDate(fechaActual.getDate() + 7);
        break;
      case 'Q':
        fechaActual.setDate(fechaActual.getDate() + 15);
        break;
      case 'M':
        fechaActual.setMonth(fechaActual.getMonth() + 1);
        break;
    }
  }
}
