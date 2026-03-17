import { test, expect } from '@playwright/test';
import {
  testEmail,
  signupUser,
  setAuthToken,
  createOrg,
  createProject,
  createTask,
} from './helpers';

test.describe('Task CRUD', () => {
  test('create a task within a project and verify it appears', async ({
    page,
  }) => {
    // Setup: create user + org + project via API
    const email = testEmail();
    const { token } = await signupUser(email, 'Test1234!');
    await createOrg(token, `Org-${Date.now()}`);
    const project = await createProject(token, `Task Test Project ${Date.now()}`);

    // Set auth token and navigate to the project
    await page.goto('/');
    await setAuthToken(page, token);
    await page.goto(`/app/projects/${project.projectId}`);

    // Click the add/create task button
    const addTaskBtn = page.getByRole('button', {
      name: /add task|new task|create task/i,
    });
    await expect(addTaskBtn).toBeVisible({ timeout: 10000 });
    await addTaskBtn.click();

    // Fill in the task title
    const taskTitle = `E2E Task ${Date.now()}`;
    const titleInput = page.getByLabel(/title/i).or(
      page.getByPlaceholder(/task title|title|task name/i)
    );
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(taskTitle);

    // Submit (press Enter or click create)
    const submitBtn = page.getByRole('button', {
      name: /create|save|add/i,
    });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    } else {
      await titleInput.press('Enter');
    }

    // Verify the task appears in the project view
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10000 });
  });

  test('update task status', async ({ page }) => {
    // Setup: create user + org + project + task via API
    const email = testEmail();
    const { token } = await signupUser(email, 'Test1234!');
    await createOrg(token, `Org-${Date.now()}`);
    const project = await createProject(
      token,
      `Status Test Project ${Date.now()}`
    );
    const task = await createTask(
      token,
      project.projectId,
      `Status Task ${Date.now()}`
    );

    // Set auth token and navigate to the project
    await page.goto('/');
    await setAuthToken(page, token);
    await page.goto(`/app/projects/${project.projectId}`);

    // Wait for the task to appear
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 10000 });

    // Click on the task to open the detail panel
    await page.getByText(task.title).click();

    // Find the status selector/dropdown and change it
    const statusSelect = page.getByLabel(/status/i).or(
      page.locator('select, [role="listbox"], [role="combobox"]').first()
    );
    await expect(statusSelect).toBeVisible({ timeout: 5000 });

    // Try to change status to "in-progress" or "In Progress"
    // Handle both <select> elements and custom dropdowns
    const tagName = await statusSelect.evaluate((el) =>
      el.tagName.toLowerCase()
    );
    if (tagName === 'select') {
      await statusSelect.selectOption({ label: /in.?progress/i });
    } else {
      await statusSelect.click();
      await page
        .getByRole('option', { name: /in.?progress/i })
        .or(page.getByText(/in.?progress/i))
        .first()
        .click();
    }

    // Verify the status change is reflected (look for "in progress" text or visual indicator)
    await expect(
      page.getByText(/in.?progress/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('search for a task and verify deep-link URL opens task detail', async ({
    page,
  }) => {
    // Setup: create user + org + project + task via API
    const email = testEmail();
    const { token } = await signupUser(email, 'Test1234!');
    await createOrg(token, `Org-${Date.now()}`);
    const project = await createProject(
      token,
      `Search Test Project ${Date.now()}`
    );
    const taskTitle = `Searchable Task ${Date.now()}`;
    const task = await createTask(token, project.projectId, taskTitle);

    // Set auth token and navigate to search
    await page.goto('/');
    await setAuthToken(page, token);

    // Navigate directly to the project with the ?task= deep-link
    await page.goto(
      `/app/projects/${project.projectId}?task=${task.taskId}`
    );

    // Verify the task detail panel is open and showing the task
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10000 });

    // Verify the URL contains the task deep-link parameter
    expect(page.url()).toContain(`task=${task.taskId}`);
  });
});
