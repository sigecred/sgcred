const { test, expect } = require('@playwright/test');

test.describe('Modal Scrolling and Form Submission', () => {

  test.use({
    viewport: { width: 375, height: 667 }, // iPhone 8 viewport
    baseURL: 'http://127.0.0.1:8080/src/',
  });

  test('should open New Client modal, scroll, and verify submit button is visible', async ({ page }) => {
    await page.goto('/index.html');
    // Open the navigation menu
    await page.locator('#menu-btn').click();
    
    // Click the "Nuevo Cliente" link
    await page.locator('#new-client-link').click();

    // Wait for the modal to be visible
    const clientModal = page.locator('#client-modal');
    await expect(clientModal).toBeVisible();

    // Find the submit button
    const submitButton = clientModal.locator('button[type="submit"]');

    // Scroll the button into view
    await submitButton.scrollIntoViewIfNeeded();

    // Verify the button is now visible within the viewport
    await expect(submitButton).toBeVisible();
    
    // For good measure, check if it's actually in the viewport
    const isInViewport = await submitButton.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    });
    expect(isInViewport).toBe(true);

    // Close the modal
    await clientModal.locator('#cancel-client-btn').click();
    await expect(clientModal).toBeHidden();
  });

  test('should open New Loan modal, scroll, and verify submit button is visible', async ({ page }) => {
    await page.goto('/index.html');
    // Open the navigation menu
    await page.locator('#menu-btn').click();

    // Click the "Nuevo Préstamo" link
    await page.locator('#new-loan-link').click();

    // Wait for the modal to be visible
    const loanModal = page.locator('#loan-modal');
    await expect(loanModal).toBeVisible();

    // Find the submit button
    const submitButton = loanModal.locator('button[type="submit"]');

    // Scroll the button into view
    await submitButton.scrollIntoViewIfNeeded();

    // Verify the button is visible
    await expect(submitButton).toBeVisible();

    // Close the modal
    await loanModal.locator('#cancel-loan-btn').click();
    await expect(loanModal).toBeHidden();
  });

  test('should open Payment modal, scroll, and verify submit button is visible', async ({ page }) => {
    // Listen for console messages to debug the save operation
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.type()}: ${msg.text()}`));
    
    await page.goto('/index.html');
    // First, create a client and a loan to have something to pay
    // Open and fill client form
    await page.locator('#menu-btn').click();
    await page.locator('#new-client-link').click();
    await page.fill('#client-cedula', '1234567');
    await page.fill('#client-nombres', 'Juan');
    await page.fill('#client-apellidos', 'Perez');
    await page.fill('#client-telefono1', '0981123456');
    await page.locator('#client-form button[type="submit"]').click();

    // Open and fill loan form
    await page.locator('#menu-btn').click();
    await page.locator('#new-loan-link').click();
    await page.fill('#cedula', '1234567');
    await page.fill('#capital', '1000000');
    await page.selectOption('#frecuenciaPago', 'M');
    await page.fill('#cantidadCuotas', '3');
    await page.fill('#montoCuota', '350000');
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#fechaDesembolso', today);
    await page.fill('#fechaPrimerPago', today);
    
    // Wait for the modal to close, which indicates the save is complete
    const loanModal = page.locator('#loan-modal');
    await page.locator('#loan-form button[type="submit"]').click();
    await expect(loanModal).toBeHidden();

    // Navigate to the loans page
    await page.goto('/prestamos.html');
    
    // Wait for the loan card to be visible
    const loanCard = page.locator('.bg-white.p-4.rounded-lg.shadow-md');
    await expect(loanCard).toBeVisible();

    // Click the "Cobrar" button on the first loan
    await loanCard.locator('button:has-text("Cobrar")').first().click();
    
    // Wait for the payment modal to be visible
    const paymentModal = page.locator('#payment-modal');
    await expect(paymentModal).toBeVisible();
    
    // Find the submit button
    const submitButton = paymentModal.locator('button[type="submit"]');

    // Scroll the button into view
    await submitButton.scrollIntoViewIfNeeded();
    
    // Verify the button is visible
    await expect(submitButton).toBeVisible();

    // Close the modal
    await paymentModal.locator('#cancel-payment-btn').click();
    await expect(paymentModal).toBeHidden();
  });
});
