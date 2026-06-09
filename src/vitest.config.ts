import 'dotenv/config';
import { defineConfig } from "vitest/config";

const junitOutputFile = process.env.VITEST_JUNIT_OUTPUT_NAME
  ? `./results/${process.env.VITEST_JUNIT_OUTPUT_NAME}`
  : './results/report.xml';

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
      junit: junitOutputFile
    },
    testTimeout: 30000,
  },
});
