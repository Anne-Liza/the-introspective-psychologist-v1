export type SidebarNavigationItem = {
  label: string;
  href: string;
  permission?: string;
  exclude_permission?: string;
};

export type SidebarNavigationSection = {
  title: string;
  items: SidebarNavigationItem[];
};

export const sidebarNavigationSections: SidebarNavigationSection[] = [
  {
    title: "Practice",
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "My Profile", href: "/dashboard/my-profile", permission: "therapist_profiles.own.read", exclude_permission: "therapist_profiles.read" },
      { label: "Appointments", href: "/dashboard/appointments", permission: "appointments.read" },
      { label: "Booking Holds", href: "/dashboard/booking-holds", permission: "booking_engine.read" },
      { label: "Client Records", href: "/dashboard/client-records", permission: "client_records.read" },
      { label: "Services", href: "/dashboard/services", permission: "services.read" },
      { label: "Availability", href: "/dashboard/availability", permission: "availability.own.read" },
      { label: "Therapist Profiles", href: "/dashboard/therapist-profiles", permission: "therapist_profiles.read" },
      { label: "Team", href: "/dashboard/team", permission: "users.read" },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "Payment Requests", href: "/dashboard/payment-requests", permission: "payment_requests.read" },
      { label: "Payment Attempts", href: "/dashboard/payment-attempts", permission: "payment_attempts.read" },
      { label: "M-Pesa Operations", href: "/dashboard/mpesa-payments", permission: "mpesa_payments.read" },
      { label: "Receipts", href: "/dashboard/receipts", permission: "receipts.read" },
    ],
  },
  {
    title: "Store",
    items: [
      { label: "Products", href: "/dashboard/products", permission: "commerce_core.read" },
      { label: "Orders", href: "/dashboard/orders", permission: "commerce_core.read" },
      { label: "Fulfillment", href: "/dashboard/fulfillment", permission: "fulfillment.read" },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Contact Messages", href: "/dashboard/contact-messages", permission: "contact_messages.read" },
      { label: "Email Templates", href: "/dashboard/email-templates", permission: "email_templates.read" },
      { label: "Email Logs",
      href: "/dashboard/email-logs",
      permission: "email_logs.read",},
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Blog", href: "/dashboard/blog", permission: "blog.read" },
      { label: "Files", href: "/dashboard/files", permission: "files.read" },
      { label: "Content", href: "/dashboard/content", permission: "landing_sections.update" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", href: "/dashboard/settings", permission: "settings.read" },
    ],
  },
  {
    title: "More",
    items: [
      { label: "Booking Settings", href: "/dashboard/booking-settings", permission: "booking_engine.read" },
    ],
  },
];

export const sidebarNavigation: SidebarNavigationItem[] = sidebarNavigationSections.flatMap(
  (section) => section.items
);
