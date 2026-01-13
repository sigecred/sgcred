const { test, expect } = require('@playwright/test');

test.describe('Full E2E User Flow with New Features', () => {

  test.use({
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://127.0.0.1:8080/src/',
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => window.indexedDB.deleteDatabase('CreditisDB'));
    await page.goto('/index.html');
    await page.waitForFunction(() => window.db !== undefined, null, { timeout: 10000 });
  });

  test('should handle the full loan and payment lifecycle', async ({ page }) => {
    // 1. Crear cliente
    await page.locator('#main-new-client-btn').click();
    const clientModal = page.locator('#client-modal');
    await page.fill('#client-cedula', '7777777');
    await page.fill('#client-nombres', 'Carlos');
    await page.fill('#client-apellidos', 'Santana');
    await page.locator('#client-form button[type="submit"]').click();
    await expect(clientModal).toBeHidden();

    // 2. Crear préstamo con fecha pasada
    await page.locator('#main-new-loan-btn').click();
    const loanModal = page.locator('#loan-modal');
    
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const pastDateString = pastDate.toISOString().split('T')[0];

    await page.fill('#cedula', '7777777');
    await page.fill('#nombreApellido', 'Carlos Santana');
    await page.fill('#capital', '1000000');
    await page.selectOption('#frecuenciaPago', 'M');
    await page.fill('#cantidadCuotas', '1');
    await page.fill('#montoCuota', '1200000');
    await page.fill('#fechaDesembolso', pastDateString);
    await page.fill('#fechaPrimerPago', pastDateString);
    await page.locator('#loan-form button[type="submit"]').click();
    await expect(loanModal).toBeHidden({ timeout: 10000 });

    // 3. Ir al plan de pagos
    await page.goto('/prestamos.html');
    await page.locator('a:has-text("Cobrar")').click();

    // 4. Hacer pago parcial y tardío
    const installmentRow = page.locator('#cuotas-table-body tr:first-child');
    await installmentRow.locator('button:has-text("Pagar")').click();
    
    const paymentModal = page.locator('#payment-modal');
    await page.fill('#payment-amount', '1000000'); // Pago parcial
    await paymentModal.locator('#confirm-payment-btn').click();
    await expect(paymentModal).toBeHidden();

    // 5. Verificar formato amarillo
    const fechaPagoCell = installmentRow.locator('td').nth(2).locator('span');
    const montoPagadoCell = installmentRow.locator('td').nth(4).locator('span');
    await expect(fechaPagoCell).toHaveClass(/bg-yellow-100/);
    await expect(montoPagadoCell).toHaveClass(/bg-yellow-100/);

    // 6. Editar pago
    await installmentRow.locator('button:has-text("VER")').click();
    await expect(paymentModal.locator('h2')).toHaveText('Editar Pago de Cuota');
    
    // 7. Corregir pago y generar PDF
    await page.fill('#payment-amount', '1200000'); // Pago completo
    const downloadPromise = page.waitForEvent('download');
    await paymentModal.locator('#confirm-and-generate-pdf-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('recibo.pdf');
    await expect(paymentModal).toBeHidden();

    // 8. Verificar formato actualizado (fecha amarilla, monto verde)
    await expect(fechaPagoCell).toHaveClass(/bg-yellow-100/);
    await expect(montoPagadoCell).toHaveClass(/bg-green-100/);
  });
});
