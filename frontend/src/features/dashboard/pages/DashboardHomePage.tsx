import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BadgeAlert,
  CalendarCheck2,
  Clock3,
  HeartHandshake,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserRoundCog,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";

import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchAppointments,
  type Appointment,
} from "../../appointments/lib/appointmentsApi";
import { fetchClientRecords } from "../../client-records/lib/clientRecordsApi";
import { fetchPaymentRequests } from "../../payment-requests/lib/paymentRequestsApi";
import { fetchReceipts } from "../../receipts/lib/receiptsApi";
import { fetchMyTherapistProfile } from "../../therapist-profiles/lib/therapistProfilesApi";

type QuickAction = {
  title: string;
  body: string;
  href: string;
  permission: string;
  icon: LucideIcon;
};

const quickActions: QuickAction[] = [
  {
    title: "Review appointments",
    body: "Confirm requests, update sessions and manage the practice schedule.",
    href: "/dashboard/appointments",
    permission: "appointments.read",
    icon: CalendarCheck2,
  },
  {
    title: "Manage availability",
    body: "Update recurring hours, exceptions and therapist availability.",
    href: "/dashboard/availability",
    permission: "availability.own.read",
    icon: Clock3,
  },
  {
    title: "Review payments",
    body: "Check pending, failed and manually reviewed payment records.",
    href: "/dashboard/payment-requests",
    permission: "payment_requests.read",
    icon: WalletCards,
  },
  {
    title: "Manage services",
    body: "Update therapy services, formats, pricing and booking visibility.",
    href: "/dashboard/services",
    permission: "services.read",
    icon: HeartHandshake,
  },
];

function localDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function appointmentTimestamp(
  appointment: Appointment,
) {
  return `${appointment.appointment_date}T${appointment.start_time}`;
}

function formatAppointmentDate(
  appointment: Appointment,
) {
  return new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(
    new Date(
      `${appointment.appointment_date}T${appointment.start_time}`,
    ),
  );
}

function formatAppointmentTime(
  appointment: Appointment,
) {
  const value = new Date(
    `${appointment.appointment_date}T${appointment.start_time}`,
  );

  return new Intl.DateTimeFormat("en-KE", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function statusClasses(status: string) {
  if (
    ["confirmed", "paid", "issued", "active"].includes(
      status,
    )
  ) {
    return "bg-[#e4eadf] text-[#405038]";
  }

  if (
    ["requested", "pending", "processing"].includes(
      status,
    )
  ) {
    return "bg-[#f5ead0] text-[#795c1f]";
  }

  if (
    ["failed", "needs_review", "declined"].includes(
      status,
    )
  ) {
    return "bg-[#f4dddd] text-[#8a3d3d]";
  }

  return "bg-[#ecece6] text-[#61685e]";
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(
        status,
      )}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="group rounded-2xl border border-[#dfe3d4] bg-white p-5 shadow-[0_8px_24px_rgba(37,48,38,0.05)] transition hover:-translate-y-0.5 hover:border-[#b9c4ae] hover:shadow-[0_12px_30px_rgba(37,48,38,0.09)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-xl bg-[#eef1e8] p-2.5 text-[#4f6047]">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-[#9aa493] transition group-hover:text-[#4f6047]" />
      </div>

      <p className="mt-5 text-sm font-medium text-[#718064]">
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl font-semibold text-[#253026]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-5 text-[#788176]">
        {detail}
      </p>
    </Link>
  );
}

export function DashboardHomePage() {
  const siteName =
    import.meta.env.VITE_SITE_NAME ||
    "the practice";
  const { user, hasPermission } = useAuth();

  const canReadAppointments = hasPermission(
    "appointments.read",
  );
  const canReadClients = hasPermission(
    "client_records.read",
  );
  const canReadPayments = hasPermission(
    "payment_requests.read",
  );
  const canReadReceipts = hasPermission(
    "receipts.read",
  );

  const isTherapistWorkspace =
    hasPermission("therapist_profiles.own.read") &&
    !hasPermission("therapist_profiles.read");

  const therapistProfileQuery = useQuery({
    queryKey: ["therapist-profile", "me"],
    queryFn: fetchMyTherapistProfile,
    enabled: isTherapistWorkspace,
  });

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "dashboard"],
    queryFn: fetchAppointments,
    enabled: canReadAppointments,
  });

  const clientsQuery = useQuery({
    queryKey: ["client-records", "dashboard"],
    queryFn: fetchClientRecords,
    enabled: canReadClients,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payment-requests", "dashboard"],
    queryFn: fetchPaymentRequests,
    enabled: canReadPayments,
  });

  const receiptsQuery = useQuery({
    queryKey: ["receipts", "dashboard"],
    queryFn: fetchReceipts,
    enabled: canReadReceipts,
  });

  const today = localDateKey();
  const appointments =
    appointmentsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const receipts = receiptsQuery.data ?? [];

  const todaysAppointments = appointments.filter(
    (appointment) =>
      appointment.appointment_date === today &&
      ![
        "cancelled",
        "declined",
        "no_show",
      ].includes(appointment.status),
  );

  const pendingAppointments = appointments.filter(
    (appointment) =>
      appointment.status === "requested",
  );

  const upcomingAppointments = appointments
    .filter(
      (appointment) =>
        appointment.appointment_date >= today &&
        ![
          "cancelled",
          "declined",
          "completed",
          "no_show",
        ].includes(appointment.status),
    )
    .sort((left, right) =>
      appointmentTimestamp(left).localeCompare(
        appointmentTimestamp(right),
      ),
    )
    .slice(0, 5);

  const paymentAttention = payments
    .filter((payment) =>
      [
        "pending",
        "processing",
        "failed",
        "needs_review",
      ].includes(payment.status),
    )
    .slice(0, 5);

  const activeClients = clients.filter((client) =>
    ["lead", "active"].includes(client.status),
  );

  const recentClients = [...clients]
    .sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at),
    )
    .slice(0, 5);

  const issuedReceipts = receipts.filter(
    (receipt) => receipt.status === "issued",
  );

  const visibleQuickActions = quickActions.filter(
    (action) => hasPermission(action.permission),
  );

  const therapistProfile =
    therapistProfileQuery.data;
  const profileRevision =
    therapistProfile?.working_revision;

  const profileCardState = (() => {
    switch (profileRevision?.review_status) {
      case "draft":
        return {
          label: "Draft saved",
          body: "You have private profile changes in progress. Continue where you left off.",
          action: "Continue editing",
          emphasis: "quiet",
        };
      case "pending_review":
        return {
          label: "In review",
          body: "Your profile update is with the practice for review. Your current public version remains live.",
          action: "View submission",
          emphasis: "quiet",
        };
      case "changes_requested":
        return {
          label: "Action needed",
          body: "The practice requested changes to your profile. Review the feedback and update your draft.",
          action: "Review feedback",
          emphasis: "attention",
        };
      case "approved":
        return {
          label: "Approved",
          body: "Your update has been approved and is waiting to be published.",
          action: "View approved version",
          emphasis: "active",
        };
      default:
        return {
          label: therapistProfile?.is_published
            ? "Professional profile"
            : "Get started",
          body: therapistProfile?.is_published
            ? "Manage your introduction, areas of support, therapeutic approach and the professional details clients see on the website."
            : "Create your professional profile and prepare it for practice review.",
          action: therapistProfile?.is_published
            ? "Open my profile"
            : "Create my profile",
          emphasis: "quiet",
        };
    }
  })();

  const firstName =
    user?.email
      ?.split("@")[0]
      .split(/[._-]/)[0]
      .replace(/^./, (value) =>
        value.toUpperCase(),
      ) || "there";

  if (isTherapistWorkspace) {
    return (
      <div
        data-ui-contract="dashboard.home"
        data-ui-variant="therapy-therapist-self-service"
        className="space-y-8"
      >
        <section className="overflow-hidden rounded-3xl border border-[#dfe3d4] bg-[#253026] text-white shadow-[0_16px_44px_rgba(37,48,38,0.12)]">
          <div className="grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b8c4b0]">
                Your workspace
              </p>
              <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                Welcome back, {firstName}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d9ded3] sm:text-base">
                Keep your professional profile and working
                availability current so clients always see
                accurate information.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#b8c4b0]">
                Today
              </p>
              <p className="mt-1 font-serif text-xl font-semibold">
                {new Intl.DateTimeFormat("en-KE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date())}
              </p>
            </div>
          </div>
        </section>

        <section>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718064]">
              Your practice
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-[#253026]">
              Keep your details up to date
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#788176]">
              Manage the information clients see about you
              and the hours you make available for sessions.
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Link
              to="/dashboard/my-profile"
              className="group rounded-3xl border border-[#dfe3d4] bg-white p-6 shadow-[0_8px_24px_rgba(37,48,38,0.05)] transition hover:-translate-y-0.5 hover:border-[#b9c4ae] hover:shadow-[0_12px_30px_rgba(37,48,38,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-[#eef1e8] p-3 text-[#4f6047]">
                  <UserRoundCog className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-[#9aa493] transition group-hover:text-[#4f6047]" />
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#718064]">
                  Professional profile
                </p>

                <span
                  className={
                    profileCardState.emphasis === "attention"
                      ? "rounded-full bg-[#f5ead0] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#795c1f]"
                      : profileCardState.emphasis === "active"
                        ? "rounded-full bg-[#e4eadf] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#405038]"
                        : "rounded-full bg-[#eef1e8] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#56684b]"
                  }
                >
                  {profileCardState.label}
                </span>
              </div>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-[#253026]">
                My Profile
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#788176]">
                {profileCardState.body}
              </p>

              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#56684b]">
                {profileCardState.action}
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>

            <Link
              to="/dashboard/availability"
              className="group rounded-3xl border border-[#dfe3d4] bg-white p-6 shadow-[0_8px_24px_rgba(37,48,38,0.05)] transition hover:-translate-y-0.5 hover:border-[#b9c4ae] hover:shadow-[0_12px_30px_rgba(37,48,38,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-[#eef1e8] p-3 text-[#4f6047]">
                  <Clock3 className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-[#9aa493] transition group-hover:text-[#4f6047]" />
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-[0.17em] text-[#718064]">
                Working schedule
              </p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-[#253026]">
                My Availability
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#788176]">
                Set your recurring working hours and add
                schedule exceptions when your availability
                changes.
              </p>

              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#56684b]">
                Manage availability
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-[#dfe3d4] bg-[#eef1e8] p-6 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718064]">
                Your client work
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-[#253026]">
                More of your practice in one place
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#667064]">
                Your assigned sessions and client work will
                appear here when those workflows are enabled
                for your role.
              </p>
            </div>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#56684b] shadow-sm">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      data-ui-contract="dashboard.home"
      data-ui-variant="therapy-operations"
      className="space-y-8"
    >
      <section className="overflow-hidden rounded-3xl border border-[#dfe3d4] bg-[#253026] text-white shadow-[0_16px_44px_rgba(37,48,38,0.12)]">
        <div className="grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b8c4b0]">
              Practice overview
            </p>
            <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d9ded3] sm:text-base">
              Here is what needs attention across{" "}
              {siteName} today.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#b8c4b0]">
              Today
            </p>
            <p className="mt-1 font-serif text-xl font-semibold">
              {new Intl.DateTimeFormat("en-KE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Sessions today"
          value={
            canReadAppointments
              ? todaysAppointments.length
              : "—"
          }
          detail="Scheduled sessions requiring preparation."
          icon={CalendarCheck2}
          href="/dashboard/appointments"
        />

        <MetricCard
          label="Booking requests"
          value={
            canReadAppointments
              ? pendingAppointments.length
              : "—"
          }
          detail="New requests awaiting a decision."
          icon={BadgeAlert}
          href="/dashboard/appointments"
        />

        <MetricCard
          label="Payments to review"
          value={
            canReadPayments
              ? paymentAttention.length
              : "—"
          }
          detail="Pending, failed or review-required records."
          icon={WalletCards}
          href="/dashboard/payment-requests"
        />

        <MetricCard
          label="Active clients"
          value={
            canReadClients
              ? activeClients.length
              : "—"
          }
          detail={`${issuedReceipts.length} issued receipt${
            issuedReceipts.length === 1 ? "" : "s"
          } currently recorded.`}
          icon={UsersRound}
          href="/dashboard/client-records"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-3xl border border-[#dfe3d4] bg-white shadow-[0_8px_24px_rgba(37,48,38,0.05)]">
          <div className="flex items-center justify-between gap-4 border-b border-[#e7e9e1] px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718064]">
                Schedule
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-[#253026]">
                Upcoming appointments
              </h2>
            </div>

            <Link
              to="/dashboard/appointments"
              className="text-sm font-semibold text-[#56684b] hover:text-[#34422f]"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-[#eceee7]">
            {appointmentsQuery.isLoading ? (
              <p className="px-6 py-8 text-sm text-[#788176]">
                Loading the practice schedule…
              </p>
            ) : upcomingAppointments.length ? (
              upcomingAppointments.map(
                (appointment) => (
                  <Link
                    key={appointment.id}
                    to="/dashboard/appointments"
                    className="grid gap-3 px-5 py-4 transition hover:bg-[#fafaf6] sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:px-6"
                  >
                    <div>
                      <p className="font-semibold text-[#34422f]">
                        {formatAppointmentDate(
                          appointment,
                        )}
                      </p>
                      <p className="text-sm text-[#788176]">
                        {formatAppointmentTime(
                          appointment,
                        )}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#253026]">
                        {appointment.client_name}
                      </p>
                      <p className="truncate text-sm text-[#788176]">
                        {appointment.session_format ||
                          "Session"}
                        {appointment.location
                          ? ` · ${appointment.location}`
                          : ""}
                      </p>
                    </div>

                    <StatusBadge
                      status={appointment.status}
                    />
                  </Link>
                ),
              )
            ) : (
              <div className="px-6 py-10 text-center">
                <CalendarCheck2 className="mx-auto h-7 w-7 text-[#9aa493]" />
                <p className="mt-3 font-semibold text-[#34422f]">
                  No upcoming appointments
                </p>
                <p className="mt-1 text-sm text-[#788176]">
                  New confirmed sessions will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[#dfe3d4] bg-white shadow-[0_8px_24px_rgba(37,48,38,0.05)]">
          <div className="flex items-center justify-between gap-4 border-b border-[#e7e9e1] px-5 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718064]">
                Payments
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-[#253026]">
                Requiring attention
              </h2>
            </div>

            <Link
              to="/dashboard/payment-requests"
              className="text-sm font-semibold text-[#56684b] hover:text-[#34422f]"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-[#eceee7]">
            {paymentsQuery.isLoading ? (
              <p className="px-5 py-8 text-sm text-[#788176]">
                Loading payment activity…
              </p>
            ) : paymentAttention.length ? (
              paymentAttention.map((payment) => (
                <Link
                  key={payment.id}
                  to="/dashboard/payment-requests"
                  className="block px-5 py-4 transition hover:bg-[#fafaf6]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#253026]">
                        {payment.customer_name}
                      </p>
                      <p className="mt-1 text-sm text-[#788176]">
                        {payment.request_number}
                      </p>
                    </div>

                    <StatusBadge
                      status={payment.status}
                    />
                  </div>

                  <p className="mt-2 text-sm font-semibold text-[#4f6047]">
                    {payment.currency}{" "}
                    {payment.amount}
                  </p>
                </Link>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <ReceiptText className="mx-auto h-7 w-7 text-[#9aa493]" />
                <p className="mt-3 font-semibold text-[#34422f]">
                  Payments are clear
                </p>
                <p className="mt-1 text-sm text-[#788176]">
                  No payment records currently require review.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718064]">
              Practice tools
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-[#253026]">
              Common actions
            </h2>
          </div>

          <p className="max-w-xl text-sm leading-6 text-[#788176]">
            Go directly to the workflows used most often
            by the practice team.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleQuickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                to={action.href}
                className="group rounded-2xl border border-[#dfe3d4] bg-white p-5 shadow-[0_8px_24px_rgba(37,48,38,0.04)] transition hover:-translate-y-0.5 hover:border-[#b9c4ae]"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-[#eef1e8] p-2.5 text-[#4f6047]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[#9aa493] transition group-hover:text-[#4f6047]" />
                </div>

                <h3 className="mt-5 font-serif text-xl font-semibold text-[#253026]">
                  {action.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#788176]">
                  {action.body}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
        <div className="rounded-3xl border border-[#dfe3d4] bg-white p-5 shadow-[0_8px_24px_rgba(37,48,38,0.05)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718064]">
                Clients
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-[#253026]">
                Recently updated
              </h2>
            </div>

            <Link
              to="/dashboard/client-records"
              className="text-sm font-semibold text-[#56684b]"
            >
              View clients
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {clientsQuery.isLoading ? (
              <p className="text-sm text-[#788176]">
                Loading client activity…
              </p>
            ) : recentClients.length ? (
              recentClients.map((client) => (
                <Link
                  key={client.id}
                  to="/dashboard/client-records"
                  className="flex items-center justify-between gap-4 rounded-xl border border-[#eceee7] px-4 py-3 transition hover:bg-[#fafaf6]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#253026]">
                      {client.full_name}
                    </p>
                    <p className="truncate text-sm text-[#788176]">
                      {client.email}
                    </p>
                  </div>

                  <StatusBadge
                    status={client.status}
                  />
                </Link>
              ))
            ) : (
              <p className="text-sm text-[#788176]">
                Client records will appear here as the
                practice begins receiving bookings.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[#dfe3d4] bg-[#eef1e8] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718064]">
            Administration
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-[#253026]">
            Practice setup
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#667064]">
            Maintain the people, public offering and
            operational settings behind the practice.
          </p>

          <div className="mt-5 grid gap-2">
            {[
              {
                label: "Therapist profiles",
                href: "/dashboard/therapist-profiles",
                icon: UserRoundCog,
              },
              {
                label: "Team and invitations",
                href: "/dashboard/team",
                icon: ShieldCheck,
              },
              {
                label: "Store and packages",
                href: "/dashboard/commerce",
                icon: ShoppingBag,
              },
              {
                label: "Practice settings",
                href: "/dashboard/settings",
                icon: Settings,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className="flex items-center justify-between rounded-xl bg-white/75 px-4 py-3 text-sm font-semibold text-[#34422f] transition hover:bg-white"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-[#56684b]" />
                    {item.label}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#9aa493]" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
