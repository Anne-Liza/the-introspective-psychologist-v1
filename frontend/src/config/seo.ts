const runtimeOrigin =
  typeof window !== "undefined"
    ? window.location.origin
    : "";

const configuredSiteUrl =
  import.meta.env.VITE_SITE_URL?.trim() || "";

const productionConfiguredSiteUrl =
  configuredSiteUrl &&
  !configuredSiteUrl.includes("localhost") &&
  !configuredSiteUrl.includes("127.0.0.1")
    ? configuredSiteUrl
    : "";

const siteUrl = import.meta.env.PROD
  ? productionConfiguredSiteUrl ||
    runtimeOrigin ||
    "https://theintrospectivepsychologist.netlify.app"
  : configuredSiteUrl ||
    runtimeOrigin ||
    "http://localhost:5173";

export const seoConfig = {
  siteUrl,
  siteName: "The Introspective Psychologist",
  defaultTitle:
    "Therapy in Nairobi | The Introspective Psychologist",
  defaultDescription:
    "Thoughtful, professional therapy and mental health support in Nairobi. Explore services, meet therapists, read resources, and book an appointment.",
  defaultImage: "",
};

export const noIndexRoutes = new Set([
  "/login",
  "/cart",
  "/checkout",
  "/accept-invitation",
  "/availability",
]);

export const routeSeo = {
  "/": {
    title: "Therapy in Nairobi",
    description:
      "Thoughtful, professional therapy and mental health support in Nairobi. Explore services, meet therapists, read resources, and book an appointment.",
    path: "/",
  },

  "/about": {
    title: "About",
    description:
      "Learn about The Introspective Psychologist, our approach to therapy, and the values that shape our practice.",
    path: "/about",
  },

  "/services": {
    title: "Therapy Services in Nairobi",
    description:
      "Explore therapy services offered by The Introspective Psychologist and find support that fits your needs.",
    path: "/services",
  },

  "/therapists": {
    title: "Meet Our Therapists",
    description:
      "Meet the therapists at The Introspective Psychologist and learn about their backgrounds, approaches, and areas of focus.",
    path: "/therapists",
  },

  "/book": {
    title: "Book a Therapy Appointment",
    description:
      "Book a therapy appointment with The Introspective Psychologist in Nairobi.",
    path: "/book",
  },

  "/blog": {
    title: "Mental Health Articles & Reflections",
    description:
      "Read articles and reflections on mental health, wellbeing, relationships, therapy, and personal growth.",
    path: "/blog",
  },

  "/store": {
    title: "Therapy Resources & Store",
    description:
      "Browse therapeutic resources, wellness tools, books, and products from The Introspective Psychologist.",
    path: "/store",
  },

  "/contact": {
    title: "Contact Our Therapy Practice",
    description:
      "Contact The Introspective Psychologist in Nairobi with questions about therapy, appointments, services, or the practice.",
    path: "/contact",
  },

  "/login": {
    title: "Login",
    description:
      "Log in securely to The Introspective Psychologist.",
    path: "/login",
  },

  "/cart": {
    title: "Cart",
    description:
      "Review items in your cart.",
    path: "/cart",
  },

  "/checkout": {
    title: "Checkout",
    description:
      "Complete your order securely.",
    path: "/checkout",
  },

  "/accept-invitation": {
    title: "Accept Invitation",
    description:
      "Accept your invitation securely.",
    path: "/accept-invitation",
  },

  "/availability": {
    title: "Availability",
    description:
      "View appointment availability.",
    path: "/availability",
  },

  "/privacy": {
    title: "Privacy Policy",
    description:
      "Read the privacy policy for The Introspective Psychologist.",
    path: "/privacy",
  },

  "/terms": {
    title: "Terms of Service",
    description:
      "Read the terms of service for The Introspective Psychologist.",
    path: "/terms",
  },

  "/accessibility": {
    title: "Accessibility",
    description:
      "Read accessibility information for The Introspective Psychologist.",
    path: "/accessibility",
  },

  "/cancellations": {
    title: "Cancellation Policy",
    description:
      "Read the appointment cancellation policy for The Introspective Psychologist.",
    path: "/cancellations",
  },

  "/shipping-returns": {
    title: "Shipping & Returns",
    description:
      "Read shipping and returns information for purchases from The Introspective Psychologist.",
    path: "/shipping-returns",
  },
} as const;

export type RouteSeoPath =
  keyof typeof routeSeo;
