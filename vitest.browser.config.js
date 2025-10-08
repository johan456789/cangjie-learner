import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/browser/**/*.test.js"],
    browser: {
      enabled: true,
      provider: "playwright",
      // Vitest 2.x requires explicit name
      name: "chromium",
      instances: [{ browser: "chromium" }],
    },
    reporters: "default",
  },
});
