import { defineConfig, devices } from '@playwright/test'

/** 画面操作のテスト（e2e/crop.spec.ts）が叩く開発サーバ。出力CSS の描画テストは setContent なので使わない。 */
const DEV_PORT = 5179

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
    baseURL: `http://localhost:${DEV_PORT}/`,
  },
  webServer: {
    command: `npx vite --port ${DEV_PORT} --strictPort`,
    url: `http://localhost:${DEV_PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
})
