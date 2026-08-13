import { describe, expect, it } from "vitest";

import { contactSubmissionErrorMessage } from "./contactSubmission";

describe("contact submission errors", () => {
  it("explains rate limiting without blaming the submitted details", () => {
    expect(
      contactSubmissionErrorMessage({
        isAxiosError: true,
        response: { status: 429 },
      }),
    ).toBe("Too many recent requests. Please wait a few minutes before trying again.");
  });

  it("keeps unexpected failures generic", () => {
    expect(contactSubmissionErrorMessage(new Error("internal detail"))).toBe(
      "Message failed to send. Please try again later.",
    );
  });
});
