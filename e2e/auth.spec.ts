import { test, expect } from '@playwright/test';
import { testEmail, signupUser, setAuthToken } from './helpers';

test.describe('Authentication', () => {
  test('signup page renders and accepts input', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('signup creates account and redirects', async ({ page }) => {
    const email = testEmail();
    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('Test1234!');
    await page.getByRole('button', { name: /sign up/i }).click();
    // Should redirect to login or app after signup
    await expect(page).toHaveURL(/\/(login|app)/, { timeout: 10000 });
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('login with wrong password shows error', async ({ page }) => {
    const email = testEmail();
    // First signup
    await signupUser(email, 'Test1234!');
    // Try login with wrong password
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('WrongPassword!');
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    // Should show error message
    await expect(
      page.getByText(/invalid|incorrect|wrong/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('login with valid credentials succeeds', async ({ page }) => {
    const email = testEmail();
    await signupUser(email, 'Test1234!');
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('Test1234!');
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    // Should redirect to app (may be blocked by email verification)
    await page.waitForURL(/\/(app|verify)/, { timeout: 10000 });
  });

  test('authenticated user can access app layout', async ({ page }) => {
    const email = testEmail();
    const { token } = await signupUser(email, 'Test1234!');
    await page.goto('/');
    await setAuthToken(page, token);
    await page.goto('/app');
    // Should see the app layout (may redirect to verify email)
    await page.waitForURL(/\/(app|verify)/, { timeout: 10000 });
  });
});
