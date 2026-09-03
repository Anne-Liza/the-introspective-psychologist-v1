export type CmsPreviewOverride = {
  key: string;
  title: string;
  eyebrow?: string | null;
  body?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  image_url?: string | null;
  is_visible?: boolean;
};

type PreviewableSection = {
  id: string;
  key: string;
  title: string;
  eyebrow: string | null;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
};

const PREVIEW_KEY =
  "therapy-cms-preview-section";

export function storeCmsPreview(
  value: CmsPreviewOverride,
) {
  localStorage.setItem(
    PREVIEW_KEY,
    JSON.stringify(value),
  );
}

export function clearCmsPreview() {
  localStorage.removeItem(
    PREVIEW_KEY,
  );
}

function readCmsPreview():
  | CmsPreviewOverride
  | null {
  try {
    const value =
      localStorage.getItem(
        PREVIEW_KEY,
      );

    return value
      ? JSON.parse(value)
      : null;
  } catch {
    return null;
  }
}

export function cmsPreviewUrl(
  path: string,
) {
  const separator =
    path.includes("?")
      ? "&"
      : "?";

  return `${path}${separator}cmsPreview=1`;
}

export function applyCmsPreview<
  T extends PreviewableSection,
>(
  page: string,
  sections: T[],
): T[] {
  if (
    typeof window === "undefined"
  ) {
    return sections;
  }

  const params =
    new URLSearchParams(
      window.location.search,
    );

  if (
    params.get("cmsPreview") !==
    "1"
  ) {
    return sections;
  }

  const preview =
    readCmsPreview();

  if (
    !preview ||
    !preview.key.startsWith(
      `${page}.`,
    )
  ) {
    return sections;
  }

  if (
    preview.is_visible === false
  ) {
    return sections.filter(
      (section) =>
        section.key !==
        preview.key,
    );
  }

  const existing =
    sections.find(
      (section) =>
        section.key ===
        preview.key,
    );

  if (!existing) {
    return [
      ...sections,
      {
        id: "cms-preview",
        key: preview.key,
        title: preview.title,
        eyebrow:
          preview.eyebrow ?? null,
        body:
          preview.body ?? null,
        cta_label:
          preview.cta_label ??
          null,
        cta_url:
          preview.cta_url ?? null,
        image_url:
          preview.image_url ??
          null,
      } as T,
    ];
  }

  return sections.map(
    (section) => {
      if (
        section.key !==
        preview.key
      ) {
        return section;
      }

      const merged = {
        ...section,
        ...preview,
      };

      if (
        preview.image_url ===
        undefined
      ) {
        merged.image_url =
          section.image_url;
      }

      return merged as T;
    },
  );
}
