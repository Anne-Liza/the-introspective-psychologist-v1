import { describe, expect, it } from "vitest";

import {
  contactSectionHref,
  isPracticeContactDetail,
  isPracticeSocialLink,
  resolveLandingSectionImageUrl,
  safePublicWebUrl,
  splitPublicList,
  type LandingSection,
} from "./publicContent";

function section(key: string, title = "Example"): LandingSection {
  return {
    id: key,
    key,
    title,
    eyebrow: null,
    body: null,
    cta_label: null,
    cta_url: null,
    image_url: null,
  };
}

describe("public content helpers", () => {
  it("creates safe email and telephone links from configured contact details", () => {
    expect(contactSectionHref(section("contact.email", "hello@example.com"))).toBe(
      "mailto:hello@example.com",
    );
    expect(contactSectionHref(section("contact.phone", "+254 700 000 000"))).toBe(
      "tel:+254700000000",
    );
    expect(contactSectionHref(section("contact.location", "Nairobi"))).toBeNull();
  });

  it("keeps practice details separate from crisis and FAQ content", () => {
    expect(isPracticeContactDetail(section("contact.email"))).toBe(true);
    expect(isPracticeContactDetail(section("contact.emergency"))).toBe(false);
    expect(isPracticeContactDetail(section("contact.faq.fit"))).toBe(false);
    expect(isPracticeContactDetail(section("contact.social.instagram"))).toBe(false);
  });

  it("accepts configured web links while rejecting unsafe or invented social targets", () => {
    expect(safePublicWebUrl("https://example.com/practice")).toBe("https://example.com/practice");
    expect(safePublicWebUrl("javascript:alert(1)")).toBeNull();

    const instagram = section("contact.social.instagram");
    instagram.cta_url = "https://instagram.com/example";
    expect(isPracticeSocialLink(instagram)).toBe(true);

    const missing = section("contact.social.facebook");
    expect(isPracticeSocialLink(missing)).toBe(false);
  });

  it("resolves managed landing image URLs while preserving legacy paths", () => {
    expect(
      resolveLandingSectionImageUrl(
        "/files/public/asset-1",
      ),
    ).toContain(
      "/files/public/asset-1",
    );

    expect(
      resolveLandingSectionImageUrl(
        "/demo/practice/practice-room.svg",
      ),
    ).toBe(
      "/demo/practice/practice-room.svg",
    );

    expect(
      resolveLandingSectionImageUrl(null),
    ).toBeNull();
  });

  it("normalizes configured list values for truthful public counts", () => {
    expect(splitPublicList("English, Kiswahili | French")).toEqual([
      "English",
      "Kiswahili",
      "French",
    ]);
    expect(splitPublicList(null)).toEqual([]);
  });
});
