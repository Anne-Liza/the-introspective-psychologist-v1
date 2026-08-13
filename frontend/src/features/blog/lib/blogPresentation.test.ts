import { describe, expect, it } from "vitest";

import { estimateReadingTime } from "./blogPresentation";

describe("blog presentation helpers", () => {
  it("keeps empty and short articles at a one-minute minimum", () => {
    expect(estimateReadingTime("")).toBe(1);
    expect(estimateReadingTime("A short reflective note.")).toBe(1);
  });

  it("rounds longer articles up to the next minute", () => {
    const article = Array.from({ length: 221 }, () => "word").join(" ");

    expect(estimateReadingTime(article)).toBe(2);
  });
});
