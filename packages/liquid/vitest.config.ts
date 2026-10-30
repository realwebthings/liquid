import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    execArgv: ['--expose-gc'], // lets gc.test.ts prove stores are really collected
  },
})
