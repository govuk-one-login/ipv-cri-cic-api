import { vi } from "vitest";

export const mockLogger = {
  setPersistentLogAttributes: vi.fn(),
  addContext: vi.fn(),
  appendKeys: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

export function mockPowertoolsLogger() {
  vi.mock("@aws-lambda-powertools/logger", () => ({
    Logger: vi.fn().mockImplementation(function () {
      return mockLogger;
    }),
  }));
}