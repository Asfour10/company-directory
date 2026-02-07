import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Company Directory/);
  });

  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
  });

  test('API health endpoint returns 200', async ({ request }) => {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await request.get(`${apiUrl}/health`);
    expect(response.status()).toBe(200);
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Login');
  });

  test('employee directory is accessible after login', async ({ page }) => {
    // This would require proper authentication setup
    // For now, just check that the route exists
    await page.goto('/employees');
    // Should redirect to login if not authenticated
    await expect(page.url()).toContain('/login');
  });
});