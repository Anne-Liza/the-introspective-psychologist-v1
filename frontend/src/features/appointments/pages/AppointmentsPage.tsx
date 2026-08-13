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
import { StatusBadge } from "../../../components/data/StatusBadge";
import { TableToolbar } from "../../../components/data/TableToolbar";
import {
  deleteAppointment,
  fetchAppointments,
  updateAppointment,
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
  {
    value: "all",
    label: "All statuses",
  },
  {
    value: "requested",
    label: "Requested",
  },
  {
    value: "confirmed",
    label: "Confirmed",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "no_show",
    label: "No show",
  },
  {
    value: "declined",
    label: "Declined",
  },
  {
    value: "cancelled",
    label: "Cancelled",
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
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(
    new Date(`${value}T00:00:00`),
  );
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
  const [formatFilter, setFormatFilter] =
    useState("all");

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["appointments"],
    queryFn: fetchAppointments,
  });

  const updateMutation = useMutation({
    mutationFn: updateAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["appointments"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["appointments"],
      });
    },
  });

  const formatOptions = useMemo<
    FilterOption[]
  >(() => {
    const formats = Array.from(
      new Set(
        (data ?? [])
          .map(
            (appointment) =>
              appointment.session_format,
          )
          .filter(
            (
              format,
            ): format is string =>
              Boolean(format),
          ),
      ),
    ).sort();

    return [
      {
        value: "all",
        label: "All formats",
      },
      ...formats.map((format) => ({
        value: format,
        label: format
          .replace(/_/g, " ")
          .replace(/\b\w/g, (letter) =>
            letter.toUpperCase(),
          ),
      })),
    ];
  }, [data]);

  const filteredAppointments = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return (data ?? []).filter(
      (appointment) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            appointment.client_name,
            appointment.client_email,
            appointment.client_phone ?? "",
            appointment.appointment_date,
            appointment.start_time,
            appointment.end_time,
            appointment.session_format ?? "",
            appointment.location ?? "",
            appointment.client_message ?? "",
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

        const matchesFormat =
          formatFilter === "all" ||
          appointment.session_format ===
            formatFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesFormat
        );
      },
    );
  }, [
    data,
    formatFilter,
    search,
    statusFilter,
  ]);

  const showState =
    isLoading ||
    isError ||
    !data?.length;

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    formatFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setFormatFilter("all");
  }

  function confirmDelete(
    appointment: NonNullable<
      typeof data
    >[number],
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
    appointment: NonNullable<
      typeof data
    >[number],
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
        eyebrow="Client workflow"
        title="Appointments"
        description="Review appointment requests, confirm sessions and manage the appointment lifecycle."
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
              placeholder="Search client, date, format or location"
              label="Search appointments"
            />

            <FilterSelect
              label="Filter appointments by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />

            <FilterSelect
              label="Filter appointments by format"
              value={formatFilter}
              onChange={setFormatFilter}
              options={formatOptions}
            />
          </TableToolbar>

          {!filteredAppointments.length ? (
            <DataState
              isLoading={false}
              isError={false}
              empty
              emptyTitle="No appointments match"
              emptyDescription="Adjust the search term or clear the active filters."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">
                        Client
                      </th>
                      <th className="px-5 py-3.5">
                        Appointment
                      </th>
                      <th className="px-5 py-3.5">
                        Status
                      </th>
                      <th className="px-5 py-3.5">
                        Message
                      </th>
                      <th className="w-20 px-5 py-3.5 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAppointments.map(
                      (appointment) => (
                        <tr
                          key={appointment.id}
                          className="border-t border-slate-100 align-top transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
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
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {formatDate(
                                appointment.appointment_date,
                              )}
                            </div>
                            <div className="mt-1 text-slate-500">
                              {
                                appointment.start_time
                              }
                              {" to "}
                              {
                                appointment.end_time
                              }
                            </div>
                            <div className="text-slate-500">
                              {appointment.session_format
                                ?.replace(
                                  /_/g,
                                  " ",
                                ) ||
                                "Format pending"}
                            </div>
                            {appointment.location ? (
                              <div className="text-slate-500">
                                {
                                  appointment.location
                                }
                              </div>
                            ) : null}
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

                          <td className="max-w-sm px-5 py-4">
                            <p className="line-clamp-3 leading-6 text-slate-500">
                              {appointment.client_message ||
                                "No client message"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-right">
                            {renderActions(
                              appointment,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {filteredAppointments.map(
                  (appointment) => (
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

                      <div className="mt-4">
                        <p className="font-medium text-slate-900">
                          {formatDate(
                            appointment.appointment_date,
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {
                            appointment.start_time
                          }
                          {" to "}
                          {
                            appointment.end_time
                          }
                        </p>
                        <p className="text-sm text-slate-500">
                          {appointment.session_format
                            ?.replace(/_/g, " ") ||
                            "Format pending"}
                          {appointment.location
                            ? ` · ${appointment.location}`
                            : ""}
                        </p>
                      </div>

                      {appointment.client_message ? (
                        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">
                          {
                            appointment.client_message
                          }
                        </p>
                      ) : null}
                    </article>
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
