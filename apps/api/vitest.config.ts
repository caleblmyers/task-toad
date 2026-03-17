import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['src/**/*.test.ts'],
    // Integration tests share a database — run files serially to avoid TRUNCATE race conditions
    fileParallelism: false,
  },
});
