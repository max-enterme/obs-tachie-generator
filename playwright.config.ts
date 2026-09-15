import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  use: {
    viewport: { width: 1920, height: 1080 },
  },
})
