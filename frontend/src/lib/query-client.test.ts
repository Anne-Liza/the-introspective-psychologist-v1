import { describe, expect, it } from "vitest";

import { shouldRetryQuery } from "./query-client";

function axiosError(status: number) {
  return {
    isAxiosError: true,
    response: {
      status,
    },
  };
}

describe("shouldRetryQuery", () => {
  it("does not retry unauthorized responses", () => {
    expect(
      shouldRetryQuery(0, axiosError(401)),
    ).toBe(false);
  });

  it("does not retry forbidden responses", () => {
    expect(
      shouldRetryQuery(0, axiosError(403)),
    ).toBe(false);
  });

  it("retries another failure once", () => {
    expect(
      shouldRetryQuery(0, axiosError(500)),
    ).toBe(true);

    expect(
      shouldRetryQuery(1, axiosError(500)),
    ).toBe(false);
  });
});
