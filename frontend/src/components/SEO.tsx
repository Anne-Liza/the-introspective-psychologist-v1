import { useEffect } from "react";
import { useLocation } from "react-router";

import { routeSeo, seoConfig } from "../config/seo";

function absoluteUrl(path: string) {
  return `${seoConfig.siteUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function setMeta(selector: string, attr: "content" | "href", value: string) {
  const element = document.head.querySelector(selector);
  if (element) {
    element.setAttribute(attr, value);
  }
}

export function SEO() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const meta = routeSeo[path as keyof typeof routeSeo];

    const title = meta
      ? `${meta.title} | ${seoConfig.siteName}`
      : seoConfig.defaultTitle;

    const description = meta?.description || seoConfig.defaultDescription;
    const canonical = absoluteUrl(meta?.path || path || "/");
    const image = seoConfig.defaultImage.startsWith("http")
      ? seoConfig.defaultImage
      : absoluteUrl(seoConfig.defaultImage);

    document.title = title;

    setMeta('meta[name="description"]', "content", description);
    setMeta('link[rel="canonical"]', "href", canonical);

    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:image"]', "content", image);
    setMeta('meta[property="og:url"]', "content", canonical);
    setMeta('meta[property="og:site_name"]', "content", seoConfig.siteName);

    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);
    setMeta('meta[name="twitter:image"]', "content", image);
  }, [location.pathname]);

  return null;
}
