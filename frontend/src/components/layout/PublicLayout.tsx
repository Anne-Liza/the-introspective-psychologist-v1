import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "react-router";

import { CartLink } from "../../features/cart-checkout/components/CartLink";
import { PublicFooter } from "../../features/public/components/PublicFooter";
import {
  fetchPublicSections,
  findSection,
  resolveLandingSectionImageUrl,
} from "../../features/public/lib/publicContent";

const navItems = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Therapists", href: "/therapists" },
  { label: "Blog", href: "/blog" },
  { label: "Store", href: "/store" },
  { label: "Contact", href: "/contact" },
];

export function PublicLayout() {
  const fallbackSiteName =
    import.meta.env.VITE_SITE_NAME ||
    "Therapy Practice";

  const brandingQuery = useQuery({
    queryKey: [
      "public-landing-sections",
      "branding",
    ],
    queryFn: () =>
      fetchPublicSections("branding"),
    retry: 1,
  });

  const branding =
    brandingQuery.data ?? [];

  const siteName =
    findSection(
      branding,
      "branding.name",
    )?.title ||
    fallbackSiteName;

  const shortLabel =
    findSection(
      branding,
      "branding.label",
    )?.title ||
    "Therapy Practice";

  const footerTagline =
    findSection(
      branding,
      "branding.footer_tagline",
    )?.title ||
    "A calm space for reflection, healing, and steady emotional growth.";

  const footerDescription =
    findSection(
      branding,
      "branding.footer_description",
    )?.title ||
    "Explore the practice, meet the therapists, and take a clear next step when you feel ready.";

  const logoSection = findSection(
    branding,
    "branding.logo",
  );

  const logoUrl =
    resolveLandingSectionImageUrl(
      logoSection?.image_url,
    );

  return (
    <div
      data-ui-contract="public.shell"
      className="min-h-screen bg-[#fbfaf5] text-[#1f261f]"
    >
      <header
        data-ui-section="header"
        className="sticky top-0 z-40 border-b border-[#dfe5d6] bg-[#fbfaf5]/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link
            to="/"
            className="group flex items-center gap-3"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${siteName} logo`}
                className="h-12 w-12 rounded-xl object-contain"
              />
            ) : null}

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
                {shortLabel}
              </div>

              <div className="mt-1 font-serif text-2xl text-[#26311f]">
                {siteName}
              </div>
            </div>
          </Link>

          <nav
            data-ui-section="navigation"
            className="hidden items-center gap-7 text-sm font-medium text-[#4d5d3a] md:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="transition hover:text-[#26311f]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <CartLink />

            <Link
              to="/book"
              className="rounded-full bg-[#556b2f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#465a27] focus:outline-none focus:ring-4 focus:ring-[#c8d3b1]"
            >
              Request Appointment
            </Link>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto border-t border-[#e7ebdf] px-5 py-3 text-sm font-medium text-[#4d5d3a] md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <PublicFooter
        siteName={siteName}
        navItems={navItems}
        tagline={footerTagline}
        description={footerDescription}
      />
    </div>
  );
}
