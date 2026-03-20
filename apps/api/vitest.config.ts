import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/tasktoad_test';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['src/**/*.test.ts'],
    // Integration tests share a database — run files serially to avoid TRUNCATE race conditions
    fileParallelism: false,
    // Set DATABASE_URL before any module is evaluated so that module-level
    // PrismaClient instances (e.g. in context.ts) connect to the test database
    // instead of the production URL from .env.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
