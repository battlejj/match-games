import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Tests that need localStorage opt in with `// @vitest-environment happy-dom`.
    environment: 'node',
  },
})
