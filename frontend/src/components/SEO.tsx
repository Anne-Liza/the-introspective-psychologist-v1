import { useEffect } from "react";
import { useLocation } from "react-router";

import {
  noIndexRoutes,
  routeSeo,
  seoConfig,
} from "../config/seo";

function absoluteUrl(path: string) {
  return `${seoConfig.siteUrl.replace(/\/$/, "")}/${path.replace(
    /^\//,
    "",
  )}`;
}

function upsertNamedMeta(
  name: string,
  content: string,
) {
  let element = document.head.querySelector(
    `meta[name="${name}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertPropertyMeta(
  property: string,
  content: string,
) {
  let element = document.head.querySelector(
    `meta[property="${property}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function removeNamedMeta(name: string) {
  document.head
    .querySelector(`meta[name="${name}"]`)
    ?.remove();
}

function removePropertyMeta(property: string) {
  document.head
    .querySelector(`meta[property="${property}"]`)
    ?.remove();
}

function upsertCanonical(href: string) {
  let element =
    document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

export function SEO() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const meta =
      routeSeo[path as keyof typeof routeSeo];

    const title = meta
      ? `${meta.title} | ${seoConfig.siteName}`
      : seoConfig.defaultTitle;

    const description =
      meta?.description ||
      seoConfig.defaultDescription;

    const canonical = absoluteUrl(
      meta?.path || path || "/",
    );

    const shouldNoIndex =
      noIndexRoutes.has(path) ||
      path.startsWith("/receipt/");

    document.title = title;

    upsertNamedMeta(
      "description",
      description,
    );

    upsertNamedMeta(
      "robots",
      shouldNoIndex
        ? "noindex, nofollow"
        : "index, follow",
    );

    upsertCanonical(canonical);

    upsertPropertyMeta(
      "og:title",
      title,
    );
    upsertPropertyMeta(
      "og:description",
      description,
    );
    upsertPropertyMeta(
      "og:url",
      canonical,
    );
    upsertPropertyMeta(
      "og:type",
      "website",
    );
    upsertPropertyMeta(
      "og:site_name",
      seoConfig.siteName,
    );

    upsertNamedMeta(
      "twitter:card",
      seoConfig.defaultImage
        ? "summary_large_image"
        : "summary",
    );

    upsertNamedMeta(
      "twitter:title",
      title,
    );

    upsertNamedMeta(
      "twitter:description",
      description,
    );

    if (seoConfig.defaultImage) {
      const image =
        seoConfig.defaultImage.startsWith("http")
          ? seoConfig.defaultImage
          : absoluteUrl(
              seoConfig.defaultImage,
            );

      upsertPropertyMeta(
        "og:image",
        image,
      );

      upsertNamedMeta(
        "twitter:image",
        image,
      );
    } else {
      removePropertyMeta("og:image");
      removeNamedMeta("twitter:image");
    }
  }, [location.pathname]);

  return null;
}
