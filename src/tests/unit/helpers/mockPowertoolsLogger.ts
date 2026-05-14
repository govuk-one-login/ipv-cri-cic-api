import { vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";

export const mockLogger = mock<Logger>();

export function mockPowertoolsLogger() {
  vi.mock("@govuk-one-login/cri-logger", () => ({
    logger: mockLogger,
  }));
}