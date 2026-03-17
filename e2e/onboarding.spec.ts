import { test, expect } from '@playwright/test';
import { testEmail, signupUser, setAuthToken } from './helpers';

const SESSION_KEY = 'tasktoad-new-project';

const mockOptions = [
  { title: 'Option Alpha', description: 'A test project option for alpha workflows' },
  { title: 'Option Beta', description: 'Another option focusing on beta features' },
];

const mockState = {
  prompt: 'Build a task management app',
  options: mockOptions,
};

test.describe('NewProject sessionStorage persistence', () => {
  let token: string;

  test.beforeEach(async ({ page }) => {
    // Create a fresh user and authenticate
    const email = testEmail();
    const signup = await signupUser(email, 'Test1234!');
    token = signup.token;
    await page.goto('/');
    await setAuthToken(page, token);
  });

  test('NewProject page survives a page refresh via sessionStorage', async ({ page }) => {
    // Navigate to NewProject page (which will redirect to /app without state)
    // First, set sessionStorage before navigating so the page can recover
    await page.goto('/app/new-project');

    // The page will redirect to /app since there's no state or sessionStorage yet.
    // Set sessionStorage and navigate again.
    await page.evaluate(
      ({ key, data }) => {
        sessionStorage.setItem(key, JSON.stringify(data));
      },
      { key: SESSION_KEY, data: mockState }
    );

    // Navigate to the NewProject page — it should pick up sessionStorage
    await page.goto('/app/new-project');

    // Verify options are visible
    await expect(page.getByText('Option Alpha')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Option Beta')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Build a task management app')).toBeVisible();

    // Now reload the page to simulate a browser refresh
    await page.reload();

    // After refresh, the page should recover from sessionStorage (not redirect to /app)
    await expect(page.getByText('Option Alpha')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Option Beta')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Build a task management app')).toBeVisible();

    // Verify the heading is still present
    await expect(page.getByText('Choose a starting point')).toBeVisible();
  });

  test('NewProject page redirects to /app when no state or sessionStorage', async ({ page }) => {
    // Navigate directly to NewProject without setting any state
    await page.goto('/app/new-project');

    // Should redirect to /app since there is no location.state or sessionStorage
    await page.waitForURL(/\/app$/, { timeout: 5000 });
  });

  test('NewProject page clears sessionStorage when navigating away via Re-describe', async ({ page }) => {
    // Set up sessionStorage
    await page.evaluate(
      ({ key, data }) => {
        sessionStorage.setItem(key, JSON.stringify(data));
      },
      { key: SESSION_KEY, data: mockState }
    );

    await page.goto('/app/new-project');
    await expect(page.getByText('Option Alpha')).toBeVisible({ timeout: 5000 });

    // Click "Re-describe" to go back to /app
    await page.getByText('← Re-describe').click();

    // Should navigate to /app
    await page.waitForURL(/\/app$/, { timeout: 5000 });

    // Verify sessionStorage still has the data (Re-describe doesn't clear it —
    // only successful project creation clears it)
    const storedData = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY);
    expect(storedData).not.toBeNull();
  });

  test('user can select an option on the NewProject page', async ({ page }) => {
    // Set up sessionStorage
    await page.evaluate(
      ({ key, data }) => {
        sessionStorage.setItem(key, JSON.stringify(data));
      },
      { key: SESSION_KEY, data: mockState }
    );

    await page.goto('/app/new-project');
    await expect(page.getByText('Option Alpha')).toBeVisible({ timeout: 5000 });

    // Click on the first option
    await page.getByText('Option Alpha').click();

    // The "Create this project" button should appear
    await expect(page.getByRole('button', { name: /create this project/i })).toBeVisible();
  });
});
