document.addEventListener('DOMContentLoaded', () => {
  initDB().then(() => {
    loadPaymentPlan();
    setupEventListeners();
  }).catch(error => {
    console.error('Error al inicializar la base de datos en la página del plan de pagos:', error);
    document.getElementById('loan-details').innerHTML = '<p class="text-red-500">Error al cargar la base de datos.</p>';
  });
});

async function loadPaymentPlan() {
  const params = new URLSearchParams(window.location.search);
  const prestamoId = parseInt(params.get('id'), 10);

  if (isNaN(prestamoId)) {
    document.getElementById('loan-details').innerHTML = '<p class="text-red-500">ID de préstamo no válido.</p>';
    return;
  }

  try {
    const prestamo = await getPrestamoById(prestamoId);
    if (!prestamo) {
      document.getElementById('loan-details').innerHTML = '<p class="text-red-500">Préstamo no encontrado.</p>';
      return;
    }
    
    const cliente = await getClienteByCedula(prestamo.clienteCedula);
    displayLoanDetails(prestamo, cliente);

    const cuotas = await getCuotasByPrestamoId(prestamoId);
    displayCuotas(cuotas);

  } catch (error) {
    console.error('Error al cargar el plan de pago:', error);
    document.getElementById('loan-details').innerHTML = '<p class="text-red-500">Error al cargar los datos del préstamo.</p>';
  }
}

function displayLoanDetails(prestamo, cliente) {
  const detailsDiv = document.getElementById('loan-details');
  const clienteNombre = cliente ? cliente.nombreApellido : 'Cliente no encontrado';
  detailsDiv.innerHTML = `
    <h1 class="text-2xl font-bold text-gray-800">Plan de Pago: ${clienteNombre}</h1>
    <p class="text-gray-600">Monto del Préstamo: <span class="font-semibold">Gs. ${prestamo.capital.toLocaleString('es-PY')}</span></p>
    <p class="text-gray-600">Cuotas: <span class="font-semibold">${prestamo.cantidadCuotas} de Gs. ${prestamo.montoCuota.toLocaleString('es-PY')}</span></p>
  `;
}

function displayCuotas(cuotas) {
  const tableBody = document.getElementById('cuotas-table-body');
  if (!cuotas || cuotas.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">No se encontraron cuotas para este préstamo.</td></tr>';
    return;
  }
  
  tableBody.innerHTML = '';
  cuotas.forEach(cuota => {
    let fechaPagoContent = '';
    let montoPagadoContent = '';
    let fechaPagoClass = '';
    let montoPagadoClass = '';

    if (cuota.estado === 'PAGADO' && cuota.fechaPago) {
      const fechaVencimiento = new Date(cuota.fechaVencimiento + 'T00:00:00'); // Ahora es un string YYYY-MM-DD
      const fechaPago = new Date(cuota.fechaPago + 'T00:00:00'); // Es un string YYYY-MM-DD del input
      const diffTime = fechaPago.getTime() - fechaVencimiento.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      fechaPagoClass = diffDays >= 4 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
      montoPagadoClass = cuota.montoPagado < cuota.montoCuota ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
      
      fechaPagoContent = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${fechaPagoClass}">${fechaPago.toLocaleDateString('es-PY')}</span>`;
      montoPagadoContent = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${montoPagadoClass}">Gs. ${cuota.montoPagado.toLocaleString('es-PY')}</span>`;
    }

    const estadoClass = cuota.estado === 'PAGADO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">${cuota.numeroCuota}</td>
      <td class="px-6 py-4 whitespace-nowrap">${new Date(cuota.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-PY')}</td>
      <td class="px-6 py-4 whitespace-nowrap">${fechaPagoContent}</td>
      <td class="px-6 py-4 whitespace-nowrap">Gs. ${cuota.montoCuota.toLocaleString('es-PY')}</td>
      <td class="px-6 py-4 whitespace-nowrap">${montoPagadoContent}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${estadoClass}">
          ${cuota.estado}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        ${cuota.estado === 'PENDIENTE' 
          ? `<button class="pay-cuota-btn text-indigo-600 hover:text-indigo-900" data-cuota-id="${cuota.id}" data-cuota-numero="${cuota.numeroCuota}" data-cuota-monto="${cuota.montoCuota}">Pagar</button>` 
          : `<button class="view-cuota-btn text-gray-600 hover:text-gray-900" data-cuota-id="${cuota.id}" data-cuota-numero="${cuota.numeroCuota}" data-cuota-monto="${cuota.montoCuota}" data-cuota-fecha="${cuota.fechaPago}" data-monto-pagado="${cuota.montoPagado}">VER</button>`}
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function setupEventListeners() {
    document.getElementById('generar-pdf').addEventListener('click', generateFullPDF);

    const tableBody = document.getElementById('cuotas-table-body');
    tableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('pay-cuota-btn')) {
            const cuotaId = event.target.dataset.cuotaId;
            const cuotaNumero = event.target.dataset.cuotaNumero;
            const cuotaMonto = event.target.dataset.cuotaMonto;
            openPaymentModal(cuotaId, cuotaNumero, cuotaMonto);
        } else if (event.target.classList.contains('view-cuota-btn')) {
            const cuotaId = event.target.dataset.cuotaId;
            const cuotaNumero = event.target.dataset.cuotaNumero;
            const montoPagado = event.target.dataset.montoPagado;
            const cuotaFecha = event.target.dataset.cuotaFecha;
            openPaymentModal(cuotaId, cuotaNumero, montoPagado, cuotaFecha);
        }
    });

    const paymentForm = document.getElementById('payment-form');
    const cancelBtn = document.getElementById('cancel-payment-btn');
    const confirmAndPdfBtn = document.getElementById('confirm-and-generate-pdf-btn');
    
    paymentForm.addEventListener('submit', (e) => handlePaymentSubmit(e, false));
    cancelBtn.addEventListener('click', closePaymentModal);
    confirmAndPdfBtn.addEventListener('click', (e) => handlePaymentSubmit(e, true));
}

function openPaymentModal(cuotaId, cuotaNumero, monto, fecha) {
    const modal = document.getElementById('payment-modal');
    const modalTitle = modal.querySelector('h2');
    
    document.getElementById('payment-cuota-id').value = cuotaId;
    document.getElementById('payment-cuota-numero').textContent = cuotaNumero;
    
    if (fecha) { // Modo Edición
        modalTitle.textContent = 'Editar Pago de Cuota';
        document.getElementById('payment-amount').value = parseFloat(monto).toLocaleString('es-PY');
        document.getElementById('payment-date').value = fecha;
    } else { // Modo Nuevo Pago
        modalTitle.textContent = 'Registrar Pago de Cuota';
        document.getElementById('payment-amount').value = parseFloat(monto).toLocaleString('es-PY');
        document.getElementById('payment-date').valueAsDate = new Date();
    }
    
    modal.classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
}

async function handlePaymentSubmit(event, generatePdf = false) {
    event.preventDefault();
    const cuotaId = parseInt(document.getElementById('payment-cuota-id').value, 10);
    const fechaPago = document.getElementById('payment-date').value;
    const montoPagado = parseFloat(document.getElementById('payment-amount').value.replace(/\./g, ''));

    try {
        await updateCuotaPago(cuotaId, fechaPago, montoPagado);
        console.log(`Pago registrado para la cuota ${cuotaId}`);
        closePaymentModal();
        
        if (generatePdf) {
            const params = new URLSearchParams(window.location.search);
            const prestamoId = parseInt(params.get('id'), 10);
            await generatePDFReceipt(prestamoId);
        }

        loadPaymentPlan(); // Recargar la tabla para mostrar el nuevo estado
    } catch (error) {
        console.error('Error al registrar el pago:', error);
        alert('Hubo un error al registrar el pago.');
    }
}

async function generateFullPDF() {
    const doc = new jspdf.jsPDF();
    
    const params = new URLSearchParams(window.location.search);
    const prestamoId = parseInt(params.get('id'), 10);
    const prestamo = await getPrestamoById(prestamoId);
    const cliente = await getClienteByCedula(prestamo.clienteCedula);
    const cuotas = await getCuotasByPrestamoId(prestamoId);

    doc.setFontSize(20);
    doc.text("Plan de Pago", 105, 20, null, null, "center");
    
    doc.setFontSize(12);
    doc.text(`Cliente: ${cliente.nombreApellido}`, 20, 35);
    doc.text(`Monto del Préstamo: Gs. ${prestamo.capital.toLocaleString('es-PY')}`, 20, 42);
    doc.text(`Cuotas: ${prestamo.cantidadCuotas} de Gs. ${prestamo.montoCuota.toLocaleString('es-PY')}`, 20, 49);

    let y = 60;
    doc.setFontSize(10);
    doc.text("N° Cuota", 20, y);
    doc.text("Vencimiento", 50, y);
    doc.text("Fecha de Pago", 80, y);
    doc.text("Monto", 110, y);
    doc.text("Monto Pagado", 140, y);
    doc.text("Estado", 170, y);
    y += 7;

    cuotas.forEach(cuota => {
        doc.text(cuota.numeroCuota.toString(), 20, y);
        doc.text(new Date(cuota.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-PY'), 50, y);
        doc.text(cuota.fechaPago ? new Date(cuota.fechaPago + 'T00:00:00').toLocaleDateString('es-PY') : '-', 80, y);
        doc.text(`Gs. ${cuota.montoCuota.toLocaleString('es-PY')}`, 110, y);
        doc.text(cuota.montoPagado ? `Gs. ${cuota.montoPagado.toLocaleString('es-PY')}` : '-', 140, y);
        doc.text(cuota.estado, 170, y);
        y += 7;
    });

    doc.save('plan_pago.pdf');
}

async function generatePDFReceipt(prestamoId) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const prestamo = await getPrestamoById(prestamoId);
    const cliente = await getClienteByCedula(prestamo.clienteCedula);
    const cuotas = await getCuotasByPrestamoId(prestamoId);
    const cuotasPagas = cuotas.filter(c => c.estado === 'PAGADO');

    doc.setFontSize(20);
    doc.text("RECIBO DE PAGO", 105, 20, null, null, "center");
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);
    
    doc.setFontSize(12);
    doc.text(`Cliente: ${cliente.nombreApellido}`, 20, 35);
    doc.line(20, 40, 190, 40);

    let y = 50;
    cuotasPagas.forEach(cuota => {
        doc.setFontSize(10);
        
        const fechaVencimiento = new Date(cuota.fechaVencimiento);
        const fechaPago = new Date(cuota.fechaPago);
        const diffTime = fechaPago - fechaVencimiento;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isLate = diffDays >= 4;
        const isPartial = cuota.montoPagado < cuota.montoCuota;
        
        const fechaPagoStr = new Date(cuota.fechaPago + 'T00:00:00').toLocaleDateString('es-PY');
        const montoPagadoStr = `Gs. ${cuota.montoPagado.toLocaleString('es-PY')}`;

        doc.text(`Cuota N°: ${cuota.numeroCuota}`, 20, y);
        doc.text(`Vencimiento: ${fechaVencimiento.toLocaleDateString('es-PY')}`, 60, y);
        
        if (isLate) {
            doc.setFont(undefined, 'bold');
            doc.textWithLink(fechaPagoStr, 110, y, { url: 'javascript:void(0)' });
            doc.line(110, y + 1, 135, y + 1);
            doc.setFont(undefined, 'normal');
        } else {
            doc.text(fechaPagoStr, 110, y);
        }

        if (isPartial) {
            doc.setFont(undefined, 'bold');
            doc.textWithLink(montoPagadoStr, 150, y, { url: 'javascript:void(0)' });
            doc.line(150, y + 1, 180, y + 1);
            doc.setFont(undefined, 'normal');
        } else {
            doc.text(montoPagadoStr, 150, y);
        }

        y += 7;
    });

    doc.save('recibo.pdf');
}

// (Reutilizado de app.js, podría moverse a un archivo de utilidades)
function formatNumberInput(event) {
  const input = event.target;
  let value = input.value.replace(/\./g, '');
  value = value.replace(/[^0-9]/g, ''); 
  if (value) {
    input.value = parseInt(value, 10).toLocaleString('es-PY');
  } else {
    input.value = '';
  }
}

const amountInput = document.getElementById('payment-amount');
if (amountInput) {
    amountInput.addEventListener('input', formatNumberInput);
}
