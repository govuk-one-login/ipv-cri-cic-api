import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/tests/**/*.test.ts"],
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: ["**/*.ts"],
      exclude: [
        "**/tests/**/*.ts",
        "**/models/**/*.ts",
        "**/type/**/*.ts",
        "vitest.config.ts",
        "vitest.setup.ts",
        "**/node_modules/**",
        "config.ts",
      ],
      reportsDirectory: "coverage",
    },
    reporters: ["default", "junit", "html"],
    outputFile: {
      junit: "results/report.xml",
      html: "results/test-report.html",
    },
    testTimeout: 30000,
  },
});
