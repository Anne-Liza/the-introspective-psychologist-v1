import { useQuery } from "@tanstack/react-query";
import { Clock3, Facebook, Globe2, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from "lucide-react";
import { Link } from "react-router";

import {
  contactSectionHref,
  fetchPublicSections,
  isPracticeContactDetail,
  isPracticeSocialLink,
  safePublicWebUrl,
  type LandingSection,
} from "../lib/publicContent";

export type PublicFooterNavItem = {
  label: string;
  href: string;
};

type PublicFooterProps = {
  siteName: string;
  navItems: PublicFooterNavItem[];
  tagline: string;
  description?: string;
};

const detailIcons = {
  "contact.email": Mail,
  "contact.phone": Phone,
  "contact.location": MapPin,
  "contact.hours": Clock3,
};

const socialIcons = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
};

function ContactDetail({ detail }: { detail: LandingSection }) {
  const Icon = detailIcons[detail.key as keyof typeof detailIcons] ?? MapPin;
  const href = contactSectionHref(detail);
  const content = (
    <>
      <Icon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[#b9c69d]" />
      <span>
        <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-[#9daa85]">
          {detail.eyebrow}
        </span>
        <span className="mt-1 block break-words text-sm leading-6 text-[#f1f0e9]">
          {detail.title}
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className="flex gap-3 transition hover:text-white">
        {content}
      </a>
    );
  }

  return <div className="flex gap-3">{content}</div>;
}

export function PublicFooter({ siteName, navItems, tagline, description }: PublicFooterProps) {
  const { data } = useQuery({
    queryKey: ["public-contact-sections"],
    queryFn: () => fetchPublicSections("contact"),
    retry: 1,
  });

  const contactDetails = data?.filter(isPracticeContactDetail).slice(0, 4) ?? [];
  const socialLinks = data?.filter(isPracticeSocialLink) ?? [];
  const year = new Date().getFullYear();

  return (
    <footer data-ui-contract="public.footer" className="border-t border-[#35452f] bg-[#1e2b1c] text-[#e8eadf]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 lg:grid-cols-[1.25fr_0.75fr_1fr] lg:px-8 lg:py-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#aab88d]">
            {siteName}
          </p>
          <h2 className="mt-4 max-w-xl font-serif text-3xl leading-tight text-white md:text-4xl">
            {tagline}
          </h2>
          {description ? (
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#c8cfbd]">{description}</p>
          ) : null}
          {socialLinks.length ? (
            <div className="mt-7 flex flex-wrap gap-3" aria-label="Practice social links">
              {socialLinks.map((social) => {
                const network = social.key.replace("contact.social.", "");
                const Icon = socialIcons[network as keyof typeof socialIcons] ?? Globe2;
                const href = safePublicWebUrl(social.cta_url);
                return href ? (
                  <a
                    key={social.key}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.title || network}
                    className="grid h-10 w-10 place-items-center rounded-full border border-[#4b5b45] text-[#c8cfbd] transition hover:border-[#aab88d] hover:text-white"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </a>
                ) : null;
              })}
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aab88d]">
            Explore
          </h3>
          <nav className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-[#e8eadf] lg:grid-cols-1">
            {navItems.map((item) => (
              <Link key={item.href} to={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aab88d]">
            Contact
          </h3>
          {contactDetails.length ? (
            <div className="mt-5 grid gap-5">
              {contactDetails.map((detail) => (
                <ContactDetail key={detail.key} detail={detail} />
              ))}
            </div>
          ) : (
            <Link to="/contact" className="mt-5 inline-flex text-sm text-[#e8eadf] hover:text-white">
              View practice contact details
            </Link>
          )}
        </div>
      </div>

      <div className="border-t border-[#35452f]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-xs text-[#aeb7a4] sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© {year} {siteName}. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link to="/terms" className="transition hover:text-white">Terms</Link>
            <Link to="/accessibility" className="transition hover:text-white">Accessibility</Link>
            <Link to="/cancellations" className="transition hover:text-white">Cancellations</Link>
            <Link to="/shipping-returns" className="transition hover:text-white">Shipping &amp; returns</Link>
            <Link to="/contact#urgent-support" className="transition hover:text-white">
              Urgent support information
            </Link>
            <Link to="/login" className="transition hover:text-white">
              Staff sign in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
