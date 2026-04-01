import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    clearMocks: true,
    coverage: {
      enabled: true,
      provider: "v8",
      reportsDirectory: "coverage",
    },
    reporters: ["default"],
  },
});
