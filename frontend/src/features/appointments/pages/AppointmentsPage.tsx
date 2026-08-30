import {
  useMemo,
  useState,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Ban,
  Check,
  CheckCircle2,
  Trash2,
  UserX,
  X,
} from "lucide-react";

import { DataState } from "../../../components/data/DataState";
import {
  FilterSelect,
  type FilterOption,
} from "../../../components/data/FilterSelect";
import { PageHeader } from "../../../components/data/PageHeader";
import {
  destructiveRowActionClassName,
  RowActionsMenu,
  rowActionClassName,
} from "../../../components/data/RowActionsMenu";
import { SearchField } from "../../../components/data/SearchField";
import {
  appointmentDurationMinutes,
  formatAppointmentTimeRange,
  formatLocationSuffix,
  normalizeAppointmentFormat,
} from "../lib/appointmentPresentation";
import { StatusBadge } from "../../../components/data/StatusBadge";
import { TableToolbar } from "../../../components/data/TableToolbar";
import {
  deleteAppointment,
  fetchAppointments,
  updateAppointment,
  type Appointment,
  type AppointmentStatus,
} from "../lib/appointmentsApi";

type StatusAction = {
  status: AppointmentStatus;
  label: string;
  destructive?: boolean;
};

const STATUS_ACTIONS: Record<
  AppointmentStatus,
  StatusAction[]
> = {
  requested: [
    {
      status: "confirmed",
      label: "Confirm appointment",
    },
    {
      status: "declined",
      label: "Decline request",
      destructive: true,
    },
    {
      status: "cancelled",
      label: "Cancel appointment",
      destructive: true,
    },
  ],
  confirmed: [
    {
      status: "completed",
      label: "Mark completed",
    },
    {
      status: "no_show",
      label: "Mark no-show",
    },
    {
      status: "cancelled",
      label: "Cancel appointment",
      destructive: true,
    },
  ],
  declined: [],
  cancelled: [],
  completed: [],
  no_show: [],
};

const statusOptions: FilterOption[] = [
  { value: "all", label: "All statuses" },
  { value: "requested", label: "Requested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No show" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
];

const periodOptions: FilterOption[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "past", label: "Past" },
  { value: "all", label: "All dates" },
];

const sortOptions: FilterOption[] = [
  {
    value: "upcoming",
    label: "Upcoming first",
  },
  {
    value: "newest",
    label: "Newest date first",
  },
  {
    value: "oldest",
    label: "Oldest date first",
  },
  {
    value: "client",
    label: "Client A–Z",
  },
  {
    value: "therapist",
    label: "Therapist A–Z",
  },
  {
    value: "status",
    label: "Status",
  },
];

function statusLabel(
  status: AppointmentStatus,
) {
  const labels: Record<
    AppointmentStatus,
    string
  > = {
    requested: "Requested",
    confirmed: "Confirmed",
    declined: "Declined",
    cancelled: "Cancelled",
    completed: "Completed",
    no_show: "No show",
  };

  return labels[status];
}

function statusTone(
  status: AppointmentStatus,
):
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info" {
  if (status === "confirmed") {
    return "success";
  }

  if (status === "requested") {
    return "warning";
  }

  if (status === "completed") {
    return "info";
  }

  if (
    status === "cancelled" ||
    status === "declined"
  ) {
    return "danger";
  }

  return "neutral";
}

function sourceLabel(source: string) {
  if (source === "presentation_seed") {
    return "Demo data";
  }

  return source
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase(),
    );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatValue(
  value: string | null | undefined,
  fallback: string,
) {
  if (!value) {
    return fallback;
  }

  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase(),
    );
}

function appointmentTimestamp(
  appointment: Appointment,
) {
  return new Date(
    `${appointment.appointment_date}T${appointment.start_time}`,
  ).getTime();
}

function appointmentFormat(
  appointment: Appointment,
) {
  return (
    appointment.session_format ??
    appointment.service_format
  );
}

function localDateKey(timestamp: number) {
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function actionIcon(
  status: AppointmentStatus,
) {
  if (status === "confirmed") {
    return Check;
  }

  if (status === "completed") {
    return CheckCircle2;
  }

  if (status === "no_show") {
    return UserX;
  }

  if (status === "declined") {
    return Ban;
  }

  return X;
}

export function AppointmentsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [therapistFilter, setTherapistFilter] =
    useState("all");
  const [serviceFilter, setServiceFilter] =
    useState("all");
  const [formatFilter, setFormatFilter] =
    useState("all");
  const [periodFilter, setPeriodFilter] =
    useState("upcoming");
  const [sortOption, setSortOption] =
    useState("upcoming");

  const {
    data,
    dataUpdatedAt,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["appointments"],
    queryFn: fetchAppointments,
  });

  const updateMutation = useMutation({
    mutationFn: updateAppointment,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["appointments"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["appointments"],
      });
    },
  });

  const therapistOptions = useMemo<
    FilterOption[]
  >(() => {
    const therapists = new Map<
      string,
      string
    >();

    (data ?? []).forEach((appointment) => {
      if (
        appointment.therapist_profile_id
      ) {
        therapists.set(
          appointment.therapist_profile_id,
          appointment.therapist_name ??
            "Therapist unavailable",
        );
      }
    });

    const options = Array.from(
      therapists.entries(),
    )
      .sort((a, b) =>
        a[1].localeCompare(b[1]),
      )
      .map(([value, label]) => ({
        value,
        label,
      }));

    const hasUnassigned = (data ?? []).some(
      (appointment) =>
        !appointment.therapist_profile_id,
    );

    return [
      {
        value: "all",
        label: "All therapists",
      },
      ...(hasUnassigned
        ? [
            {
              value: "__unassigned__",
              label: "Unassigned",
            },
          ]
        : []),
      ...options,
    ];
  }, [data]);

  const serviceOptions = useMemo<
    FilterOption[]
  >(() => {
    const services = new Map<
      string,
      string
    >();

    (data ?? []).forEach((appointment) => {
      if (appointment.service_id) {
        services.set(
          appointment.service_id,
          appointment.service_name ??
            "Service unavailable",
        );
      }
    });

    const options = Array.from(
      services.entries(),
    )
      .sort((a, b) =>
        a[1].localeCompare(b[1]),
      )
      .map(([value, label]) => ({
        value,
        label,
      }));

    const hasMissingService = (
      data ?? []
    ).some(
      (appointment) =>
        !appointment.service_id,
    );

    return [
      {
        value: "all",
        label: "All services",
      },
      ...(hasMissingService
        ? [
            {
              value: "__missing__",
              label: "Service pending",
            },
          ]
        : []),
      ...options,
    ];
  }, [data]);

  const formatOptions = useMemo<
    FilterOption[]
  >(() => {
    const formats = new Map<
      string,
      string
    >();

    (data ?? []).forEach((appointment) => {
      const format =
        appointmentFormat(appointment);

      const normalized =
        normalizeAppointmentFormat(
          format,
        );

      if (!format || !normalized) {
        return;
      }

      formats.set(
        normalized,
        formatValue(format, format),
      );
    });

    const options = Array.from(
      formats.entries(),
    )
      .sort((a, b) =>
        a[1].localeCompare(b[1]),
      )
      .map(([value, label]) => ({
        value,
        label,
      }));

    return [
      {
        value: "all",
        label: "All formats",
      },
      ...options,
    ];
  }, [data]);

  const filteredAppointments = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    const referenceTime = dataUpdatedAt;
    const todayKey =
      localDateKey(referenceTime);

    const referenceDate =
      new Date(referenceTime);

    const weekStart = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
    );

    const daysSinceMonday =
      (weekStart.getDay() + 6) % 7;

    weekStart.setDate(
      weekStart.getDate() -
        daysSinceMonday,
    );

    const weekEnd = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + 7,
    );

    const monthPrefix =
      todayKey.slice(0, 7);

    const filtered = (data ?? []).filter(
      (appointment) => {
        const effectiveFormat =
          appointmentFormat(appointment) ??
          "";

        const matchesSearch =
          !normalizedSearch ||
          [
            appointment.client_name,
            appointment.client_email,
            appointment.client_phone ?? "",
            appointment.therapist_name ?? "",
            appointment.service_name ?? "",
            appointment.service_category ?? "",
            appointment.appointment_date,
            appointment.start_time,
            appointment.end_time,
            effectiveFormat,
            appointment.location ?? "",
            appointment.client_message ?? "",
            appointment.admin_notes ?? "",
            appointment.source,
          ].some((value) =>
            value
              .toLowerCase()
              .includes(normalizedSearch),
          );

        const matchesStatus =
          statusFilter === "all" ||
          appointment.status ===
            statusFilter;

        const matchesTherapist =
          therapistFilter === "all" ||
          (therapistFilter ===
          "__unassigned__"
            ? !appointment.therapist_profile_id
            : appointment.therapist_profile_id ===
              therapistFilter);

        const matchesService =
          serviceFilter === "all" ||
          (serviceFilter === "__missing__"
            ? !appointment.service_id
            : appointment.service_id ===
              serviceFilter);

        const matchesFormat =
          formatFilter === "all" ||
          normalizeAppointmentFormat(
            effectiveFormat,
          ) === formatFilter;

        const timestamp =
          appointmentTimestamp(appointment);

        const appointmentDay =
          new Date(
            `${appointment.appointment_date}T00:00:00`,
          ).getTime();

        const matchesPeriod =
          periodFilter === "all" ||
          (periodFilter === "upcoming"
            ? timestamp >= referenceTime
            : periodFilter === "past"
              ? timestamp < referenceTime
              : periodFilter === "today"
                ? appointment.appointment_date ===
                  todayKey
                : periodFilter ===
                    "this_week"
                  ? appointmentDay >=
                      weekStart.getTime() &&
                    appointmentDay <
                      weekEnd.getTime()
                  : appointment.appointment_date.startsWith(
                      monthPrefix,
                    ));

        return (
          matchesSearch &&
          matchesStatus &&
          matchesTherapist &&
          matchesService &&
          matchesFormat &&
          matchesPeriod
        );
      },
    );

    return filtered.sort((a, b) => {
      const aTime =
        appointmentTimestamp(a);
      const bTime =
        appointmentTimestamp(b);

      if (sortOption === "newest") {
        return bTime - aTime;
      }

      if (sortOption === "oldest") {
        return aTime - bTime;
      }

      if (sortOption === "client") {
        return a.client_name.localeCompare(
          b.client_name,
        );
      }

      if (sortOption === "therapist") {
        return (
          a.therapist_name ??
          "Unassigned"
        ).localeCompare(
          b.therapist_name ??
            "Unassigned",
        );
      }

      if (sortOption === "status") {
        return statusLabel(
          a.status,
        ).localeCompare(
          statusLabel(b.status),
        );
      }

      const aUpcoming =
        aTime >= referenceTime;
      const bUpcoming =
        bTime >= referenceTime;

      if (aUpcoming !== bUpcoming) {
        return aUpcoming ? -1 : 1;
      }

      return aUpcoming
        ? aTime - bTime
        : bTime - aTime;
    });
  }, [
    data,
    dataUpdatedAt,
    formatFilter,
    periodFilter,
    search,
    serviceFilter,
    sortOption,
    statusFilter,
    therapistFilter,
  ]);

  const showState =
    isLoading ||
    isError ||
    !data?.length;

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    therapistFilter !== "all" ||
    serviceFilter !== "all" ||
    formatFilter !== "all" ||
    periodFilter !== "upcoming" ||
    sortOption !== "upcoming";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setTherapistFilter("all");
    setServiceFilter("all");
    setFormatFilter("all");
    setPeriodFilter("upcoming");
    setSortOption("upcoming");
  }

  function confirmDelete(
    appointment: Appointment,
  ) {
    const confirmed = window.confirm(
      `Delete the appointment for ${appointment.client_name}? This action cannot be undone.`,
    );

    if (confirmed) {
      deleteMutation.mutate(
        appointment.id,
      );
    }
  }

  function renderActions(
    appointment: Appointment,
  ) {
    const actions =
      STATUS_ACTIONS[appointment.status];

    return (
      <RowActionsMenu
        label={`Actions for ${appointment.client_name}`}
      >
        {actions.map((action) => {
          const Icon = actionIcon(
            action.status,
          );

          return (
            <button
              type="button"
              key={action.status}
              className={
                action.destructive
                  ? destructiveRowActionClassName
                  : rowActionClassName
              }
              onClick={() =>
                updateMutation.mutate({
                  id: appointment.id,
                  data: {
                    status: action.status,
                  },
                })
              }
              disabled={
                updateMutation.isPending ||
                deleteMutation.isPending
              }
            >
              <Icon className="mr-2 h-4 w-4" />
              {action.label}
            </button>
          );
        })}

        {actions.length ? (
          <div className="my-1 border-t border-slate-100" />
        ) : null}

        <button
          type="button"
          className={
            destructiveRowActionClassName
          }
          onClick={() =>
            confirmDelete(appointment)
          }
          disabled={
            deleteMutation.isPending ||
            updateMutation.isPending
          }
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete appointment
        </button>
      </RowActionsMenu>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practice operations"
        title="Appointments"
        description="Review client bookings, therapist assignments, session details and appointment status across the practice."
      />

      {updateMutation.isError ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
        >
          The appointment could not be
          updated. It may conflict with
          another appointment or an active
          booking hold.
        </p>
      ) : null}

      {deleteMutation.isError ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
        >
          The appointment could not be
          deleted. Refresh the page and try
          again.
        </p>
      ) : null}

      {showState ? (
        <DataState
          isLoading={isLoading}
          isError={isError}
          empty={!data?.length}
          emptyTitle="No appointments"
          emptyDescription="Appointment requests and confirmed sessions will appear here."
        />
      ) : (
        <>
          <TableToolbar
            resultCount={
              filteredAppointments.length
            }
            totalCount={data?.length ?? 0}
            resultLabel="appointment"
            hasActiveFilters={
              hasActiveFilters
            }
            onClear={clearFilters}
          >
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search client, therapist, service, date or location"
              label="Search appointments"
            />

            <FilterSelect
              label="Filter appointments by period"
              value={periodFilter}
              onChange={setPeriodFilter}
              options={periodOptions}
            />

            <FilterSelect
              label="Filter appointments by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />

            <FilterSelect
              label="Filter appointments by therapist"
              value={therapistFilter}
              onChange={setTherapistFilter}
              options={therapistOptions}
            />

            <FilterSelect
              label="Filter appointments by service"
              value={serviceFilter}
              onChange={setServiceFilter}
              options={serviceOptions}
            />

            <FilterSelect
              label="Filter appointments by format"
              value={formatFilter}
              onChange={setFormatFilter}
              options={formatOptions}
            />

            <FilterSelect
              label="Sort appointments"
              value={sortOption}
              onChange={setSortOption}
              options={sortOptions}
            />
          </TableToolbar>

          {!filteredAppointments.length ? (
            <DataState
              isLoading={false}
              isError={false}
              empty
              emptyTitle="No appointments match"
              emptyDescription="Adjust the search, date range or filters."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">
                        Client
                      </th>
                      <th className="px-5 py-3.5">
                        Therapist
                      </th>
                      <th className="px-5 py-3.5">
                        Session
                      </th>
                      <th className="px-5 py-3.5">
                        Date & time
                      </th>
                      <th className="px-5 py-3.5">
                        Status
                      </th>
                      <th className="w-20 px-5 py-3.5 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAppointments.map(
                      (appointment) => {
                        const effectiveFormat =
                          appointmentFormat(
                            appointment,
                          );

                        return (
                          <tr
                            key={appointment.id}
                            className="border-t border-slate-100 align-top transition hover:bg-slate-50/70"
                          >
                            <td className="max-w-[260px] px-5 py-4">
                              <div className="font-semibold text-slate-950">
                                {
                                  appointment.client_name
                                }
                              </div>

                              <div className="mt-1 text-slate-500">
                                {
                                  appointment.client_email
                                }
                              </div>

                              {appointment.client_phone ? (
                                <div className="text-slate-500">
                                  {
                                    appointment.client_phone
                                  }
                                </div>
                              ) : null}

                              {appointment.client_message ? (
                                <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                                  {
                                    appointment.client_message
                                  }
                                </p>
                              ) : null}

                              {appointment.admin_notes ? (
                                <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-slate-600">
                                  Admin note:{" "}
                                  {
                                    appointment.admin_notes
                                  }
                                </p>
                              ) : null}
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-medium text-slate-900">
                                {appointment.therapist_name ||
                                  "Unassigned"}
                              </div>
                            </td>

                            <td className="max-w-[250px] px-5 py-4">
                              <div className="font-medium text-slate-900">
                                {appointment.service_name ||
                                  "Service pending"}
                              </div>

                              {appointment.service_category ? (
                                <div className="mt-1 text-slate-500">
                                  {
                                    appointment.service_category
                                  }
                                </div>
                              ) : null}

                              <div className="text-slate-500">
                                {formatValue(
                                  effectiveFormat,
                                  "Format pending",
                                )}
                                {formatLocationSuffix(
                                  effectiveFormat,
                                  appointment.location,
                                )}
                              </div>

                              {appointmentDurationMinutes(appointment.start_time, appointment.end_time) ? (
                                <div className="text-slate-500">
                                  {
                                    appointmentDurationMinutes(appointment.start_time, appointment.end_time)
                                  }
                                  {" minutes"}
                                </div>
                              ) : null}
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-medium text-slate-900">
                                {formatDate(
                                  appointment.appointment_date,
                                )}
                              </div>

                              <div className="mt-1 text-slate-500">
                                {formatAppointmentTimeRange(
                                  appointment.start_time,
                                  appointment.end_time,
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                tone={statusTone(
                                  appointment.status,
                                )}
                              >
                                {statusLabel(
                                  appointment.status,
                                )}
                              </StatusBadge>

                              <div className="mt-2 text-xs text-slate-400">
                                {sourceLabel(
                                  appointment.source,
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-right">
                              {renderActions(
                                appointment,
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {filteredAppointments.map(
                  (appointment) => {
                    const effectiveFormat =
                      appointmentFormat(
                        appointment,
                      );

                    return (
                      <article
                        key={appointment.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-950">
                              {
                                appointment.client_name
                              }
                            </p>

                            <p className="truncate text-sm text-slate-500">
                              {
                                appointment.client_email
                              }
                            </p>

                            {appointment.client_phone ? (
                              <p className="text-sm text-slate-500">
                                {
                                  appointment.client_phone
                                }
                              </p>
                            ) : null}
                          </div>

                          {renderActions(
                            appointment,
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <StatusBadge
                            tone={statusTone(
                              appointment.status,
                            )}
                          >
                            {statusLabel(
                              appointment.status,
                            )}
                          </StatusBadge>

                          <span className="text-xs text-slate-400">
                            {sourceLabel(
                              appointment.source,
                            )}
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Therapist
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {appointment.therapist_name ||
                                "Unassigned"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Session
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {appointment.service_name ||
                                "Service pending"}
                            </p>

                            {appointment.service_category ? (
                              <p className="text-sm text-slate-500">
                                {
                                  appointment.service_category
                                }
                              </p>
                            ) : null}

                            <p className="text-sm text-slate-500">
                              {formatValue(
                                effectiveFormat,
                                "Format pending",
                              )}
                              {formatLocationSuffix(
                                  effectiveFormat,
                                  appointment.location,
                                )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Date & time
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {formatDate(
                                appointment.appointment_date,
                              )}
                            </p>
                            <p className="text-sm text-slate-500">
                              {formatAppointmentTimeRange(
                                  appointment.start_time,
                                  appointment.end_time,
                                )}
                            </p>
                          </div>
                        </div>

                        {appointment.client_message ? (
                          <div className="mt-4 border-t border-slate-100 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Client message
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              {
                                appointment.client_message
                              }
                            </p>
                          </div>
                        ) : null}

                        {appointment.admin_notes ? (
                          <div className="mt-4 border-t border-slate-100 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Admin note
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              {
                                appointment.admin_notes
                              }
                            </p>
                          </div>
                        ) : null}
                      </article>
                    );
                  },
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
