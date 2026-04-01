import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config();
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/tests/**/*.test.ts"],
    clearMocks: true,
    coverage: {
      enabled: true,
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
      reporter: ["text", "lcov"],
    },
    reporters: ["default", "junit", "html"],
    outputFile: {
      junit: "results/report.xml",
      html: "results/test-report.html",
    },
    testTimeout: 30000,
  },
});
