/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  clearMocks: true,
  reporters: ["default"],
  collectCoverageFrom: [
    "./**/*.ts",
    "!./**/tests/**/*.ts",
    "!./tests/**/*.ts",
    "!./jest.config.ts",
  ],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  testMatch: ["**/tests/**/*.test.ts"],
  testEnvironment: "node",
};
