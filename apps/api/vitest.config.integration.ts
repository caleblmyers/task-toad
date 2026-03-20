import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/tasktoad_test';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Integration tests share a database — run files serially to avoid TRUNCATE race conditions
    fileParallelism: false,
    // Set DATABASE_URL so module-level PrismaClient instances connect to the test database
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
