import { defineConfig } from 'vitest/config'

// Client unit tests + the Lua match under fengari (server/ has its own Jest suite)
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'nakama/**/*.test.ts'] },
})
