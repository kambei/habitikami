import { defineConfig } from 'vitest/config'

// Server tests only: the React app has no unit tests yet.
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
    fileParallelism: false,
  },
})
