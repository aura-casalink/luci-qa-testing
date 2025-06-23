import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['allure-playwright']
  ],
  timeout: 120000, // 2 minutos por test
  expect: {
    timeout: 30000 // 30 segundos para assertions
  },
  use: {
    baseURL: 'https://lucy-chatbot.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    // Desktop Browsers
    {
      name: 'Desktop Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'Desktop Firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'Desktop Safari',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
    },

    // Mobile Devices
    {
      name: 'Mobile Chrome Android',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Mobile Safari iPhone',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'Mobile Safari iPhone Pro',
      use: { ...devices['iPhone 14 Pro Max'] },
    },
    {
      name: 'Mobile Chrome Samsung',
      use: { ...devices['Galaxy S9+'] },
    },

    // Tablets
    {
      name: 'Tablet iPad',
      use: { ...devices['iPad Pro'] },
    },
    {
      name: 'Tablet Android',
      use: { ...devices['Galaxy Tab S4'] },
    },

    // Edge Cases - Pantallas pequeñas y grandes
    {
      name: 'Small Screen',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 640 }
      },
    },
    {
      name: 'Large Screen',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    }
  ]
});
