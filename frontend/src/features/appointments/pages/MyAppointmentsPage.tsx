import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import {
  FilterSelect,
  type FilterOption,
} from "../../../components/data/FilterSelect";
import { PageHeader } from "../../../components/data/PageHeader";
import { SearchField } from "../../../components/data/SearchField";
import { StatusBadge } from "../../../components/data/StatusBadge";
import { TableToolbar } from "../../../components/data/TableToolbar";
import {
  fetchMyAppointments,
  type AppointmentStatus,
  type TherapistAppointment,
} from "../lib/appointmentsApi";

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
  { value: "past", label: "Past" },
  { value: "all", label: "All dates" },
];

const sortOptions: FilterOption[] = [
  { value: "upcoming", label: "Upcoming first" },
  { value: "newest", label: "Newest first" },
  { value: "client", label: "Client A–Z" },
];

function statusLabel(status: AppointmentStatus) {
  const labels: Record<AppointmentStatus, string> = {
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
  appointment: TherapistAppointment,
) {
  return new Date(
    `${appointment.appointment_date}T${appointment.start_time}`,
  ).getTime();
}

export function MyAppointmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [formatFilter, setFormatFilter] =
    useState("all");
  const [serviceFilter, setServiceFilter] =
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
    queryKey: ["appointments", "mine"],
    queryFn: fetchMyAppointments,
  });

  const formatOptions = useMemo<FilterOption[]>(
    () => {
      const formats = Array.from(
        new Set(
          (data ?? [])
            .map(
              (appointment) =>
                appointment.session_format ??
                appointment.service_format,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
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
          label: formatValue(
            format,
            format,
          ),
        })),
      ];
    },
    [data],
  );

  const serviceOptions = useMemo<FilterOption[]>(
    () => {
      const services = Array.from(
        new Set(
          (data ?? [])
            .map(
              (appointment) =>
                appointment.service_name,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            ),
        ),
      ).sort();

      return [
        {
          value: "all",
          label: "All services",
        },
        ...services.map((service) => ({
          value: service,
          label: service,
        })),
      ];
    },
    [data],
  );

  const filteredAppointments = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    const now = dataUpdatedAt;

    const filtered = (data ?? []).filter(
      (appointment) => {
        const effectiveFormat =
          appointment.session_format ??
          appointment.service_format ??
          "";

        const matchesSearch =
          !normalizedSearch ||
          [
            appointment.client_name,
            appointment.service_name ?? "",
            appointment.service_category ?? "",
            appointment.appointment_date,
            appointment.start_time,
            appointment.end_time,
            effectiveFormat,
            appointment.location ?? "",
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
          effectiveFormat === formatFilter;

        const matchesService =
          serviceFilter === "all" ||
          appointment.service_name ===
            serviceFilter;

        const timestamp =
          appointmentTimestamp(appointment);

        const matchesPeriod =
          periodFilter === "all" ||
          (periodFilter === "upcoming"
            ? timestamp >= now
            : timestamp < now);

        return (
          matchesSearch &&
          matchesStatus &&
          matchesFormat &&
          matchesService &&
          matchesPeriod
        );
      },
    );

    return filtered.sort((a, b) => {
      if (sortOption === "client") {
        return a.client_name.localeCompare(
          b.client_name,
        );
      }

      if (sortOption === "newest") {
        return (
          appointmentTimestamp(b) -
          appointmentTimestamp(a)
        );
      }

      return (
        appointmentTimestamp(a) -
        appointmentTimestamp(b)
      );
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
  ]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    formatFilter !== "all" ||
    serviceFilter !== "all" ||
    periodFilter !== "upcoming" ||
    sortOption !== "upcoming";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setFormatFilter("all");
    setServiceFilter("all");
    setPeriodFilter("upcoming");
    setSortOption("upcoming");
  }

  const showState =
    isLoading ||
    isError ||
    !data?.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your schedule"
        title="My Appointments"
        description="View the sessions assigned to you, including client name, service, date, time, format and status."
      />

      {showState ? (
        <DataState
          isLoading={isLoading}
          isError={isError}
          empty={!data?.length}
          emptyTitle="No appointments assigned"
          emptyDescription="Appointments assigned to you will appear here."
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
              placeholder="Search client, service, date or location"
              label="Search my appointments"
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
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">
                        Client
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
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAppointments.map(
                      (appointment) => {
                        const effectiveFormat =
                          appointment.session_format ??
                          appointment.service_format;

                        return (
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
                            </td>

                            <td className="px-5 py-4">
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
                                {appointment.location
                                  ? ` · ${appointment.location}`
                                  : ""}
                              </div>
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
                              {appointment.service_duration_minutes ? (
                                <div className="text-slate-500">
                                  {
                                    appointment.service_duration_minutes
                                  }
                                  {" minutes"}
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
                      appointment.session_format ??
                      appointment.service_format;

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
                            <p className="mt-1 text-sm font-medium text-slate-700">
                              {appointment.service_name ||
                                "Service pending"}
                            </p>
                          </div>

                          <StatusBadge
                            tone={statusTone(
                              appointment.status,
                            )}
                          >
                            {statusLabel(
                              appointment.status,
                            )}
                          </StatusBadge>
                        </div>

                        <div className="mt-4 space-y-1 text-sm text-slate-500">
                          <p className="font-medium text-slate-900">
                            {formatDate(
                              appointment.appointment_date,
                            )}
                          </p>
                          <p>
                            {
                              appointment.start_time
                            }
                            {" to "}
                            {
                              appointment.end_time
                            }
                          </p>
                          <p>
                            {formatValue(
                              effectiveFormat,
                              "Format pending",
                            )}
                            {appointment.location
                              ? ` · ${appointment.location}`
                              : ""}
                          </p>
                          {appointment.service_category ? (
                            <p>
                              {
                                appointment.service_category
                              }
                            </p>
                          ) : null}
                        </div>
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
