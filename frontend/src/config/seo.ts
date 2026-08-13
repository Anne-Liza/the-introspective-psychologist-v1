export const seoConfig = {
  siteUrl: import.meta.env.VITE_SITE_URL || "http://localhost:5173",
  siteName: import.meta.env.VITE_SITE_NAME || "Portfolio",
  defaultTitle: import.meta.env.VITE_DEFAULT_SEO_TITLE || "Portfolio | Professional Website",
  defaultDescription:
    import.meta.env.VITE_DEFAULT_SEO_DESCRIPTION || "A professional portfolio website.",
  defaultImage: import.meta.env.VITE_DEFAULT_OG_IMAGE || "/og-image.png",
};

export const routeSeo = {
  "/book": {
    title: "Book",
    description: "Public page.",
    path: "/book",
  },
  "/login": {
    title: "Login",
    description: "Log in to the dashboard.",
    path: "/login",
  },
  "/blog": {
    title: "Blog",
    description: "Public page.",
    path: "/blog",
  },
  "/store": {
    title: "Store",
    description: "Public page.",
    path: "/store",
  },
  "/cart": {
    title: "Cart",
    description: "Public page.",
    path: "/cart",
  },
  "/checkout": {
    title: "Checkout",
    description: "Public page.",
    path: "/checkout",
  },
  "/contact": {
    title: "Contact",
    description: "Get in touch through the contact form.",
    path: "/contact",
  },
  "/accept-invitation": {
    title: "Accept Invitation",
    description: "Public page.",
    path: "/accept-invitation",
  },
  "/": {
    title: "Home",
    description: "A professional portfolio homepage.",
    path: "/",
  },
  "/about": {
    title: "About",
    description: "Learn more about this portfolio.",
    path: "/about",
  },
  "/availability": {
    title: "Availability",
    description: "Public page.",
    path: "/availability",
  },
  "/privacy": {
    title: "Privacy",
    description: "Public page.",
    path: "/privacy",
  },
  "/terms": {
    title: "Terms",
    description: "Public page.",
    path: "/terms",
  },
  "/accessibility": {
    title: "Accessibility",
    description: "Public page.",
    path: "/accessibility",
  },
  "/cancellations": {
    title: "Cancellations",
    description: "Public page.",
    path: "/cancellations",
  },
  "/shipping-returns": {
    title: "Shipping Returns",
    description: "Public page.",
    path: "/shipping-returns",
  },
  "/services": {
    title: "Services",
    description: "Public page.",
    path: "/services",
  },
  "/therapists": {
    title: "Therapists",
    description: "Public page.",
    path: "/therapists",
  },
} as const;

export type RouteSeoPath = keyof typeof routeSeo;
