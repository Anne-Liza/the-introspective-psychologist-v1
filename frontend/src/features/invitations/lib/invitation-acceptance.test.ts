import { describe, expect, it } from "vitest";

import {
  invitationTokenFromUrl,
  passwordMeetsRequirements,
  passwordRequirements,
} from "./invitation-acceptance";

describe("invitation acceptance helpers", () => {
  it("prefers a fragment token and supports previously delivered query links", () => {
    expect(
      invitationTokenFromUrl("#token=fragment-secret", "?token=query-secret"),
    ).toBe("fragment-secret");
    expect(invitationTokenFromUrl("", "?token=legacy-secret")).toBe(
      "legacy-secret",
    );
  });

  it("mirrors the non-sensitive password guidance shown in the form", () => {
    expect(passwordRequirements("short")).toEqual({
      hasMinimumLength: false,
      hasLetter: true,
      hasNumber: false,
    });
    expect(passwordMeetsRequirements("CorrectHorse2026")).toBe(true);
  });
});
