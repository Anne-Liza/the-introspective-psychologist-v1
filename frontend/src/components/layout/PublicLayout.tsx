import { Link, Outlet } from "react-router";

import { PublicFooter } from "../../features/public/components/PublicFooter";
import { CartLink } from "../../features/cart-checkout/components/CartLink";

const navItems = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Therapists", href: "/therapists" },
  { label: "Blog", href: "/blog" },
  { label: "Store", href: "/store" },
  { label: "Contact", href: "/contact" },
];

export function PublicLayout() {
  const siteName = import.meta.env.VITE_SITE_NAME || "Therapy Practice";

  return (
    <div data-ui-contract="public.shell" className="min-h-screen bg-[#fbfaf5] text-[#1f261f]">
      <header data-ui-section="header" className="sticky top-0 z-40 border-b border-[#dfe5d6] bg-[#fbfaf5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/" className="group">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
              Therapy Practice
            </div>
            <div className="mt-1 font-serif text-2xl text-[#26311f]">
              {siteName}
            </div>
          </Link>

          <nav data-ui-section="navigation" className="hidden items-center gap-7 text-sm font-medium text-[#4d5d3a] md:flex">
            {navItems.map((item) => (
              <Link key={item.href} to={item.href} className="transition hover:text-[#26311f]">
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
            <Link key={item.href} to={item.href} className="whitespace-nowrap">
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
        tagline="A calm space for reflection, healing, and steady emotional growth."
        description="Explore the practice, meet the therapists, and take a clear next step when you feel ready."
      />
    </div>
  );
}
