import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseApiDateTime,
} from "./apiDateTime";

describe("parseApiDateTime", () => {
  it("treats timezone-less API datetimes as UTC", () => {
    expect(
      parseApiDateTime(
        "2026-09-01T10:59:00",
      ).toISOString(),
    ).toBe(
      "2026-09-01T10:59:00.000Z",
    );
  });

  it("preserves an explicit UTC timezone", () => {
    expect(
      parseApiDateTime(
        "2026-09-01T10:59:00Z",
      ).toISOString(),
    ).toBe(
      "2026-09-01T10:59:00.000Z",
    );
  });

  it("preserves an explicit numeric timezone", () => {
    expect(
      parseApiDateTime(
        "2026-09-01T13:59:00+03:00",
      ).toISOString(),
    ).toBe(
      "2026-09-01T10:59:00.000Z",
    );
  });
});
