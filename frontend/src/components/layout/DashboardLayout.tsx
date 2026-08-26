import { useState } from "react";
import {
  BookOpenText,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  HeartHandshake,
  Hourglass,
  Image,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PackageCheck,
  PanelsTopLeft,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  UserRoundCog,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";

import {
  sidebarNavigationSections,
  type SidebarNavigationItem,
} from "../../config/navigation";
import { filterNavigationSections } from "../../config/navigation-access";
import { useAuth } from "../../features/auth/context/AuthContext";

const navigationIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/my-profile": UserRoundCog,
  "/dashboard/appointments": CalendarDays,
  "/dashboard/booking-holds": Hourglass,
  "/dashboard/client-records": UsersRound,
  "/dashboard/services": HeartHandshake,
  "/dashboard/availability": Clock3,
  "/dashboard/therapist-profiles": UserRoundCog,
  "/dashboard/team": ShieldCheck,
  "/dashboard/commerce": ShoppingBag,
  "/dashboard/products": ShoppingBag,
  "/dashboard/orders": PackageCheck,
  "/dashboard/payment-requests": WalletCards,
  "/dashboard/payment-attempts": PanelsTopLeft,
  "/dashboard/mpesa-payments": Smartphone,
  "/dashboard/receipts": ReceiptText,
  "/dashboard/fulfillment": PackageCheck,
  "/dashboard/contact-messages": Mail,
  "/dashboard/email-templates": FileText,
  "/dashboard/blog": BookOpenText,
  "/dashboard/files": Image,
  "/dashboard/content": PanelsTopLeft,
  "/dashboard/settings": Settings,
};

function itemIsActive(
  pathname: string,
  item: SidebarNavigationItem,
) {
  return (
    pathname === item.href ||
    (
      item.href !== "/dashboard" &&
      pathname.startsWith(`${item.href}/`)
    )
  );
}

function NavigationLinks({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const [collapsedSections, setCollapsedSections] =
    useState<Record<string, boolean>>({});

  const visibleSections = filterNavigationSections(
    sidebarNavigationSections,
    hasPermission,
  );

  return (
    <nav
      aria-label="Practice administration"
      className="space-y-4"
    >
      {visibleSections.map((section) => {
        const collapsed =
          collapsedSections[section.title] ?? false;

        return (
          <section key={section.title}>
            <button
              type="button"
              onClick={() =>
                setCollapsedSections((current) => ({
                  ...current,
                  [section.title]:
                    !current[section.title],
                }))
              }
              className="flex w-full items-center justify-between px-3 py-1 text-left text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#aeb8a6]"
              aria-expanded={!collapsed}
            >
              <span>{section.title}</span>
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {!collapsed ? (
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const active = itemIsActive(
                    location.pathname,
                    item,
                  );
                  const Icon =
                    navigationIcons[item.href] ??
                    PanelsTopLeft;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={onNavigate}
                      aria-current={
                        active ? "page" : undefined
                      }
                      className={
                        active
                          ? "flex items-center gap-3 rounded-xl bg-[#eef1e8] px-3 py-2.5 text-sm font-semibold text-[#253026] shadow-sm"
                          : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#d9ded3] transition hover:bg-white/10 hover:text-white"
                      }
                    >
                      <Icon
                        className="h-[1.05rem] w-[1.05rem] shrink-0"
                        strokeWidth={1.8}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </nav>
  );
}

function userInitial(email?: string) {
  return email?.trim().charAt(0).toUpperCase() || "A";
}

export function DashboardLayout() {
  const siteName =
    import.meta.env.VITE_SITE_NAME ||
    "Therapy practice";
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const currentItem =
    sidebarNavigationSections
      .flatMap((section) => section.items)
      .find((item) =>
        itemIsActive(location.pathname, item),
      );

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const sidebar = (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <Link
          to="/dashboard"
          onClick={() => setMobileMenuOpen(false)}
          className="block"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#aeb8a6]">
            Practice workspace
          </p>
          <h1 className="mt-2 font-serif text-2xl font-semibold leading-tight text-white">
            {siteName}
          </h1>
        </Link>

        <Link
          to="/"
          target="_blank"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#d9ded3] transition hover:text-white"
        >
          View public website
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="px-4 py-4">
        <NavigationLinks
          onNavigate={() =>
            setMobileMenuOpen(false)
          }
        />
      </div>

      <div className="mt-auto border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dce4d3] text-sm font-bold text-[#253026]">
            {userInitial(user?.email)}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {user?.email}
            </p>
            <p className="truncate text-xs text-[#aeb8a6]">
              {user?.roles
                .map((role) => role.name)
                .join(", ") || "Practice user"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="rounded-lg p-2 text-[#d9ded3] transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      data-ui-contract="dashboard.shell"
      data-ui-variant="therapy-admin"
      className="min-h-screen bg-[#f7f6f0] text-[#253026]"
    >
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 overflow-y-auto bg-[#253026] lg:block">
        {sidebar}
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() =>
              setMobileMenuOpen(false)
            }
            className="absolute inset-0 bg-[#172019]/60 backdrop-blur-sm"
          />

          <aside className="relative h-full w-[min(88vw,19rem)] bg-[#253026] shadow-2xl">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() =>
                setMobileMenuOpen(false)
              }
              className="absolute right-3 top-3 z-10 rounded-lg bg-white/10 p-2 text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-[#dfe3d4] bg-[#f7f6f0]/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setMobileMenuOpen(true)
                }
                aria-label="Open navigation"
                className="rounded-xl border border-[#d7ddcf] bg-white p-2.5 text-[#34422f] lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718064]">
                  {siteName}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-[#34422f]">
                  {currentItem?.label || "Dashboard"}
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right">
                <p className="max-w-[15rem] truncate text-sm font-semibold text-[#34422f]">
                  {user?.email}
                </p>
                <p className="text-xs text-[#788176]">
                  Secure practice access
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dce4d3] text-sm font-bold text-[#253026]">
                {userInitial(user?.email)}
              </div>
            </div>
          </div>
        </header>

        <main className="w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
