export type CmsPageKey =
  | "branding"
  | "home"
  | "about"
  | "services"
  | "contact"
  | "footer";

export type CmsField =
  | "eyebrow"
  | "title"
  | "body"
  | "cta"
  | "image"
  | "url"
  | "email";

export type CmsSectionContent = {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
};

export type CmsSectionDefinition = {
  key: string;
  label: string;
  description: string;
  titleLabel?: string;
  fields: CmsField[];
  defaults: CmsSectionContent;
  note?: string;
};

export type CmsPageDefinition = {
  key: CmsPageKey;
  label: string;
  publicPath: string;
  description: string;
  sections: CmsSectionDefinition[];
};

function content(
  title: string,
  body = "",
  eyebrow = "",
  ctaLabel = "",
  ctaUrl = "",
  imageUrl = "",
): CmsSectionContent {
  return {
    eyebrow,
    title,
    body,
    ctaLabel,
    ctaUrl,
    imageUrl,
  };
}

export const cmsPages: CmsPageDefinition[] = [
  {
    key: "branding",
    label: "Branding",
    publicPath: "/",
    description:
      "Manage the practice name, identity and site-wide branding.",
    sections: [
      {
        key: "branding.name",
        label: "Practice name",
        description:
          "The main practice name shown in the website header and footer.",
        titleLabel: "Practice name",
        fields: ["title"],
        defaults: content(
          "The Introspective Psychologist Production Proof",
        ),
      },
      {
        key: "branding.label",
        label: "Short label",
        description:
          "The small descriptor shown above the practice name.",
        titleLabel: "Short label",
        fields: ["title"],
        defaults: content(
          "Therapy Practice",
        ),
      },
      {
        key: "branding.logo",
        label: "Logo",
        description:
          "Upload the practice logo used across the public website.",
        fields: ["image"],
        defaults: content(
          "Site logo",
        ),
      },
      {
        key: "branding.footer_tagline",
        label: "Footer tagline",
        description:
          "The main message shown in the website footer.",
        titleLabel: "Footer tagline",
        fields: ["title"],
        defaults: content(
          "A calm space for reflection, healing, and steady emotional growth.",
        ),
      },
      {
        key: "branding.footer_description",
        label: "Footer description",
        description:
          "A short description shown beneath the footer tagline.",
        titleLabel: "Footer description",
        fields: ["title"],
        defaults: content(
          "Explore the practice, meet the therapists, and take a clear next step when you feel ready.",
        ),
      },
    ],
  },
  {
    key: "home",
    label: "Home",
    publicPath: "/",
    description:
      "Manage the main messages and sections visitors see when they arrive.",
    sections: [
      {
        key: "home.hero",
        label: "Hero",
        description:
          "The opening message, image and primary invitation.",
        fields: [
          "eyebrow",
          "title",
          "body",
          "cta",
          "image",
        ],
        defaults: content(
          "Therapy that makes room for reflection, care, and becoming.",
          "A calm multi-therapist practice where clients can explore services, meet the team, check availability, and request a session with ease.",
          "The Introspective Psychologist",
          "Request an appointment",
          "/book",
          "/demo/practice/practice-room.svg",
        ),
      },
      {
        key: "home.approach",
        label: "Practice introduction",
        description:
          "Introduce the practice and its approach to care.",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "Grounded, thoughtful care for people navigating inner and outer change.",
          "This practice is shaped around reflection, emotional safety, and practical support. The experience is intentionally simple so clients can understand the offering and take the next step without overwhelm.",
          "Approach",
        ),
      },
      {
        key: "home.support_areas",
        label: "Areas of support",
        description:
          "Introduce the concerns and situations the practice supports.",
        fields: ["eyebrow", "title", "body", "cta"],
        defaults: content(
          "Space for what feels heavy, unclear, or ready to change.",
          "Explore the practice team to find support aligned with your needs and preferences.",
          "Support areas",
          "Meet the therapists",
          "/therapists",
        ),
      },
      {
        key: "home.blog",
        label: "Blog introduction",
        description:
          "Manage the copy above the latest published articles.",
        fields: ["eyebrow", "title", "body", "cta"],
        defaults: content(
          "Gentle resources for reflection and everyday wellbeing.",
          "Explore recent articles from the practice.",
          "From the blog",
          "View all articles",
          "/blog",
        ),
        note:
          "Article cards come automatically from the Blog workspace.",
      },
      {
        key: "home.process",
        label: "How it works",
        description:
          "Introduce the steps from exploring the practice to requesting care.",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "A simple path from curiosity to care.",
          "Explore the practice, review availability, and request a session when you are ready.",
          "How it works",
        ),
      },
      {
        key: "home.cta",
        label: "Final call to action",
        description:
          "The closing invitation visitors see near the bottom of the homepage.",
        fields: ["eyebrow", "title", "body", "cta"],
        defaults: content(
          "Begin with a gentle appointment request.",
          "Clients can request a session, send a message, or check availability. The practice team can guide the next steps from a private workspace.",
          "Ready when you are",
          "Request appointment",
          "/book",
        ),
      },
    ],
  },

  {
    key: "about",
    label: "About",
    publicPath: "/about",
    description:
      "Manage the practice story, principles and team introduction.",
    sections: [
      {
        key: "about.hero",
        label: "Hero",
        description:
          "The main About page introduction and image.",
        fields: [
          "eyebrow",
          "title",
          "body",
          "image",
        ],
        defaults: content(
          "Thoughtful therapy, held by a collaborative team.",
          "A multi-therapist practice offering grounded support for people seeking reflection, emotional safety, and practical change.",
          "Our practice",
          "",
          "",
          "/demo/practice/practice-room.svg",
        ),
      },
      {
        key: "about.profile",
        label: "Practice story",
        description:
          "Explain how the practice works and what guides the team.",
        fields: [
          "eyebrow",
          "title",
          "body",
          "cta",
        ],
        defaults: content(
          "Care begins with fit, clarity, and emotional safety.",
          "Our therapists bring different specialties and approaches while sharing a commitment to respectful, collaborative care.",
          "How we work",
          "Meet the therapists",
          "/therapists",
        ),
      },
      {
        key: "about.principles",
        label: "Practice principles",
        description:
          "Introduce the principles that shape the experience of care.",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "What guides the experience of care.",
          "Care should be understandable, respectful, collaborative, and shaped around real people.",
          "Practice principles",
        ),
      },
      {
        key: "about.team",
        label: "Team introduction",
        description:
          "Manage the introduction above the published therapist profiles.",
        fields: [
          "eyebrow",
          "title",
          "body",
          "cta",
        ],
        defaults: content(
          "Different perspectives, one thoughtful practice.",
          "Meet the therapists who make up the practice team.",
          "Meet the team",
          "View all therapist profiles",
          "/therapists",
        ),
        note:
          "Therapist cards come automatically from Therapist Profiles.",
      },
      {
        key: "about.cta",
        label: "Call to action",
        description:
          "Help visitors take the next appropriate step.",
        fields: [
          "eyebrow",
          "title",
          "body",
          "cta",
        ],
        defaults: content(
          "Not sure which therapist or service fits?",
          "Send the practice an administrative message. We can explain formats, fees, availability, and the booking process without asking you to share sensitive clinical information online.",
          "A gentle next step",
          "Contact the practice",
          "/contact",
        ),
      },
    ],
  },

  {
    key: "services",
    label: "Services",
    publicPath: "/services",
    description:
      "Manage the page around your live service catalogue.",
    sections: [
      {
        key: "services.hero",
        label: "Hero",
        description:
          "Introduce the practice services and what visitors can expect.",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "Support shaped around real life.",
          "Compare the practice's current services, session formats, typical duration, and fees before choosing a comfortable next step.",
          "Services",
        ),
        note:
          "Service cards come automatically from the Services workspace.",
      },
      {
        key: "services.guidance",
        label: "Choosing support",
        description:
          "Help visitors who are unsure where to begin.",
        fields: [
          "eyebrow",
          "title",
          "body",
          "cta",
        ],
        defaults: content(
          "Not sure where to begin?",
          "Meet the team or send an administrative question. You do not need to diagnose yourself before reaching out.",
          "Guidance",
          "Meet the therapists",
          "/therapists",
        ),
      },
      {
        key: "services.formats",
        label: "Session formats",
        description:
          "Introduce online and in-person support options.",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "Flexible ways to meet.",
          "Available session formats depend on the selected service and therapist.",
          "Session formats",
        ),
      },
      {
        key: "services.process",
        label: "How it works",
        description:
          "Explain how exploring support becomes a confirmed appointment.",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "A clear path from exploring to confirmation.",
          "Explore available services, request a suitable option, and let the practice confirm fit and availability.",
          "How it works",
        ),
      },
      {
        key: "services.cta",
        label: "Call to action",
        description:
          "Invite visitors to request an appointment.",
        fields: [
          "eyebrow",
          "title",
          "body",
          "cta",
        ],
        defaults: content(
          "Ready to ask about the right kind of support?",
          "Send an appointment request and the practice will guide the next step.",
          "Next step",
          "Request an appointment",
          "/book",
        ),
      },
    ],
  },

  {
    key: "contact",
    label: "Contact",
    publicPath: "/contact",
    description:
      "Manage public contact information, FAQs and support guidance.",
    sections: [
      {
        key: "contact.hero",
        label: "Hero",
        description:
          "Introduce the Contact page and administrative enquiry options.",
        fields: [
          "eyebrow",
          "title",
          "body",
          "image",
        ],
        defaults: content(
          "A clear place to ask practical questions before taking the next step.",
          "Contact the practice for administrative questions about services, therapists, fees, formats, and booking.",
          "Contact the practice",
          "",
          "",
          "/demo/practice/practice-room.svg",
        ),
      },
      {
        key: "contact.email",
        label: "Email",
        description:
          "The public administrative email address.",
        titleLabel: "Email address",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "hello@therapy.demo.example",
          "For general administrative enquiries.",
          "Email",
        ),
      },
      {
        key: "contact.phone",
        label: "Phone",
        description:
          "The public practice telephone number.",
        titleLabel: "Phone number",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "+254 700 000 000",
          "For administrative and booking enquiries.",
          "Phone",
        ),
      },
      {
        key: "contact.location",
        label: "Location",
        description:
          "The location visitors should see publicly.",
        titleLabel: "Location",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "Westlands, Nairobi",
          "Exact appointment details are shared after confirmation.",
          "Location",
        ),
      },
      {
        key: "contact.hours",
        label: "Office hours",
        description:
          "The hours when administrative enquiries are handled.",
        titleLabel: "Hours",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "Monday–Friday, 8:00–18:00 EAT",
          "Messages received outside these hours are reviewed during the next working period.",
          "Office hours",
        ),
      },
      {
        key: "contact.emergency",
        label: "Urgent support notice",
        description:
          "Public guidance for urgent or emergency situations.",
        fields: ["eyebrow", "title", "body"],
        defaults: content(
          "This website is not an emergency or crisis service.",
          "If you or someone else is in immediate danger, contact local emergency services or go to the nearest emergency department.",
          "Urgent support",
        ),
      },
    ],
  },
  {
    key: "footer",
    label: "Footer",
    publicPath: "/",
    description:
      "Manage the site-wide footer message and social links.",
    sections: [
      {
        key: "branding.footer_tagline",
        label: "Footer tagline",
        description:
          "The main statement shown in the website footer.",
        titleLabel: "Footer tagline",
        fields: ["title"],
        defaults: content(
          "A calm space for reflection, healing, and steady emotional growth.",
        ),
      },
      {
        key: "branding.footer_description",
        label: "Footer description",
        description:
          "The supporting text beneath the footer tagline.",
        titleLabel: "Footer description",
        fields: ["title"],
        defaults: content(
          "Explore the practice, meet the therapists, and take a clear next step when you feel ready.",
        ),
      },
      {
        key: "contact.social.instagram",
        label: "Instagram",
        description:
          "Add the practice Instagram profile.",
        titleLabel: "Label",
        fields: ["title", "url"],
        defaults: content(
          "Instagram",
        ),
      },
      {
        key: "contact.social.facebook",
        label: "Facebook",
        description:
          "Add the practice Facebook page.",
        titleLabel: "Label",
        fields: ["title", "url"],
        defaults: content(
          "Facebook",
        ),
      },
      {
        key: "contact.social.linkedin",
        label: "LinkedIn",
        description:
          "Add the practice LinkedIn page.",
        titleLabel: "Label",
        fields: ["title", "url"],
        defaults: content(
          "LinkedIn",
        ),
      },
      {
        key: "contact.social.youtube",
        label: "YouTube",
        description:
          "Add the practice YouTube channel.",
        titleLabel: "Label",
        fields: ["title", "url"],
        defaults: content(
          "YouTube",
        ),
      },
      {
        key: "contact.social.tiktok",
        label: "TikTok",
        description:
          "Add the practice TikTok profile.",
        titleLabel: "Label",
        fields: ["title", "url"],
        defaults: content(
          "TikTok",
        ),
      },
      {
        key: "contact.social.whatsapp",
        label: "WhatsApp",
        description:
          "Add the practice WhatsApp contact link.",
        titleLabel: "Label",
        fields: ["title", "url"],
        defaults: content(
          "WhatsApp",
        ),
      },

    ],
  },

];

export function getCmsPage(
  key: string | undefined,
) {
  return cmsPages.find(
    (page) => page.key === key,
  );
}
