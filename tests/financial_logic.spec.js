const { test, expect } = require('@playwright/test');

test('Financial calculations should be correct', async ({ page }) => {
  // Adjust the path to be relative to the root of the project where Playwright is run
  await page.goto('file://' + __dirname + '/test_runner.html');

  // Wait for the results to be displayed
  await page.waitForSelector('#results');

  // Check for the success message
  const successMessage = await page.textContent('#results');
  expect(successMessage).toContain('All tests passed!');

  // Also, ensure there are no failure messages
  const failures = await page.$$('.failure');
  expect(failures.length).toBe(0);
});
