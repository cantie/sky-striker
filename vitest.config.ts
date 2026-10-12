import { defineConfig } from 'vitest/config'

// Client unit tests only (server/ has its own Jest suite)
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
