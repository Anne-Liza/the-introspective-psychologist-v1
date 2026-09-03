import {
  apiClient,
  resolveApiAssetUrl,
} from "../../../lib/api-client";

export type PublicPageName = "home" | "about" | "contact";

export type LandingSection = {
  id: string;
  key: string;
  title: string;
  eyebrow: string | null;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
};

export async function fetchPublicSections(page: PublicPageName) {
  const response = await apiClient.get<LandingSection[]>(`/landing-sections/public/${page}`);
  return response.data;
}

export function resolveLandingSectionImageUrl(
  value: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  if (value.startsWith("/files/public/")) {
    return resolveApiAssetUrl(value);
  }

  return value;
}

export function findSection(sections: LandingSection[], key: string) {
  return sections.find((section) => section.key === key);
}

export function splitPublicList(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function contactSectionHref(section: LandingSection) {
  if (section.key === "contact.email") {
    return `mailto:${section.title.trim()}`;
  }

  if (section.key === "contact.phone") {
    const number = section.title.replace(/[^+\d]/g, "");
    return number ? `tel:${number}` : null;
  }

  return null;
}

export function safePublicWebUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isPracticeSocialLink(section: LandingSection) {
  return section.key.startsWith("contact.social.") && Boolean(safePublicWebUrl(section.cta_url));
}

export function isPracticeContactDetail(section: LandingSection) {
  return (
    section.key.startsWith("contact.") &&
    section.key !== "contact.emergency" &&
    !section.key.startsWith("contact.faq.") &&
    !section.key.startsWith("contact.social.") &&
    !section.key.startsWith("contact.legal.")
  );
}
