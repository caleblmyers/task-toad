import { test, expect } from '@playwright/test';
import {
  testEmail,
  signupUser,
  setAuthToken,
  createOrg,
  createProject,
} from './helpers';

test.describe('Project CRUD', () => {
  test('create a project and verify it appears in the project list', async ({
    page,
  }) => {
    // Setup: create user + org via API
    const email = testEmail();
    const { token } = await signupUser(email, 'Test1234!');
    await createOrg(token, `Org-${Date.now()}`);

    // Set auth token in the browser
    await page.goto('/');
    await setAuthToken(page, token);

    // Navigate to projects list
    await page.goto('/app/projects');
    await page.waitForURL(/\/app/, { timeout: 10000 });

    // Click new project button (look for common button patterns)
    const newProjectBtn = page.getByRole('button', {
      name: /new project|create project|add project/i,
    });
    await expect(newProjectBtn).toBeVisible({ timeout: 10000 });
    await newProjectBtn.click();

    // Fill in the project name
    const projectName = `E2E Project ${Date.now()}`;
    const nameInput = page.getByLabel(/name/i).or(
      page.getByPlaceholder(/project name|name/i)
    );
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(projectName);

    // Submit the form
    const submitBtn = page.getByRole('button', {
      name: /create|save|submit/i,
    });
    await submitBtn.click();

    // Verify the project appears (either redirected to it, or visible in list)
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });
  });

  test('project created via API appears in the project list', async ({
    page,
  }) => {
    // Setup: create user + org + project via API
    const email = testEmail();
    const { token } = await signupUser(email, 'Test1234!');
    await createOrg(token, `Org-${Date.now()}`);
    const projectName = `API Project ${Date.now()}`;
    await createProject(token, projectName);

    // Set auth token and navigate to projects list
    await page.goto('/');
    await setAuthToken(page, token);
    await page.goto('/app/projects');

    // Verify the project appears in the list
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });
  });
});
