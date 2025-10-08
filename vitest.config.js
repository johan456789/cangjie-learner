import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/**/*.test.js"],
          exclude: ["tests/browser/**/*.test.js"],
          environment: "node",
          reporters: "default",
        },
      },
      {
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.js"],
          browser: {
            enabled: true,
            provider: "playwright",
            name: "chromium",
            instances: [{ browser: "chromium" }],
          },
          reporters: "default",
        },
      },
    ],
  },
});
