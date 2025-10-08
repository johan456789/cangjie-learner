import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
    reporters: "default",
  },
  // Enable browser mode if desired (no provider configured here)
  browser: {
    enabled: true,
  },
});
