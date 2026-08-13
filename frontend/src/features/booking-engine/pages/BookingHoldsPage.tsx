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
  CheckCircle2,
  Clock3,
  Trash2,
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
  deleteBookingHold,
  fetchBookingHolds,
  updateBookingHold,
  type BookingHold,
} from "../lib/bookingEngineApi";

type HoldStatus =
  BookingHold["status"];

type HoldAction = {
  status: HoldStatus;
  label: string;
  destructive?: boolean;
};

const HOLD_ACTIONS: Record<
  HoldStatus,
  HoldAction[]
> = {
  active: [
    {
      status: "payment_pending",
      label: "Mark payment pending",
    },
    {
      status: "expired",
      label: "Mark expired",
    },
    {
      status: "cancelled",
      label: "Cancel hold",
      destructive: true,
    },
  ],
  payment_pending: [
    {
      status: "payment_verified",
      label: "Mark payment verified",
    },
    {
      status: "expired",
      label: "Mark expired",
    },
    {
      status: "cancelled",
      label: "Cancel hold",
      destructive: true,
    },
  ],
  payment_verified: [
    {
      status: "converted",
      label: "Mark converted",
    },
    {
      status: "cancelled",
      label: "Cancel hold",
      destructive: true,
    },
  ],
  expired: [],
  converted: [],
  cancelled: [],
};

const statusOptions: FilterOption[] = [
  {
    value: "all",
    label: "All statuses",
  },
  {
    value: "active",
    label: "Active",
  },
  {
    value: "payment_pending",
    label: "Payment pending",
  },
  {
    value: "payment_verified",
    label: "Payment verified",
  },
  {
    value: "converted",
    label: "Converted",
  },
  {
    value: "expired",
    label: "Expired",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

function statusLabel(status: HoldStatus) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function statusTone(
  status: HoldStatus,
):
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info" {
  if (
    status === "payment_verified" ||
    status === "converted"
  ) {
    return "success";
  }

  if (
    status === "active" ||
    status === "payment_pending"
  ) {
    return "warning";
  }

  if (
    status === "expired" ||
    status === "cancelled"
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function relativeExpiry(value: string) {
  const difference =
    new Date(value).getTime() - Date.now();

  if (difference <= 0) {
    return "Expired";
  }

  const minutes = Math.ceil(
    difference / 60_000,
  );

  if (minutes < 60) {
    return `Expires in ${minutes} min`;
  }

  const hours = Math.ceil(minutes / 60);

  if (hours < 24) {
    return `Expires in ${hours} hr${
      hours === 1 ? "" : "s"
    }`;
  }

  const days = Math.ceil(hours / 24);

  return `Expires in ${days} day${
    days === 1 ? "" : "s"
  }`;
}

function paymentSummary(
  hold: BookingHold,
) {
  const amount =
    hold.advance_payment_amount ??
    hold.quoted_price_amount;

  if (amount === null) {
    return "No payment amount";
  }

  return `${hold.payment_currency || "KES"} ${amount}`;
}

export function BookingHoldsPage() {
  const queryClient = useQueryClient();
  const [renderedAt] = useState(
    () => Date.now(),
  );

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
    queryKey: ["booking-holds"],
    queryFn: fetchBookingHolds,
  });

  const updateMutation = useMutation({
    mutationFn: updateBookingHold,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["booking-holds"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBookingHold,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["booking-holds"],
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
            (hold) =>
              hold.session_format,
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

  const filteredHolds = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return (data ?? []).filter((hold) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          hold.client_name ?? "",
          hold.client_email ?? "",
          hold.client_phone ?? "",
          hold.hold_date,
          hold.start_time,
          hold.end_time,
          hold.session_format ?? "",
          hold.location ?? "",
          hold.appointment_id ?? "",
          hold.payment_policy_snapshot ??
            "",
        ].some((value) =>
          value
            .toLowerCase()
            .includes(normalizedSearch),
        );

      const matchesStatus =
        statusFilter === "all" ||
        hold.status === statusFilter;

      const matchesFormat =
        formatFilter === "all" ||
        hold.session_format ===
          formatFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFormat
      );
    });
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

  function confirmDelete(hold: BookingHold) {
    const confirmed = window.confirm(
      `Delete the booking hold for ${
        hold.client_name || "this client"
      }? This action cannot be undone.`,
    );

    if (confirmed) {
      deleteMutation.mutate(hold.id);
    }
  }

  function renderActions(hold: BookingHold) {
    const actions =
      HOLD_ACTIONS[hold.status];

    return (
      <RowActionsMenu
        label={`Actions for ${
          hold.client_name ||
          "booking hold"
        }`}
      >
        {actions.map((action) => {
          const Icon =
            action.status ===
            "payment_verified"
              ? CheckCircle2
              : action.status ===
                  "converted"
                ? CheckCircle2
                : action.status ===
                    "expired"
                  ? Clock3
                  : action.status ===
                      "cancelled"
                    ? X
                    : Ban;

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
                  id: hold.id,
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
            confirmDelete(hold)
          }
          disabled={
            deleteMutation.isPending ||
            updateMutation.isPending
          }
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete hold
        </button>
      </RowActionsMenu>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scheduling workflow"
        title="Booking Holds"
        description="Review temporary slot holds while clients complete payment or booking confirmation."
      />

      {showState ? (
        <DataState
          isLoading={isLoading}
          isError={isError}
          empty={!data?.length}
          emptyTitle="No booking holds"
          emptyDescription="Temporary holds will appear here when clients reserve appointment times."
        />
      ) : (
        <>
          <TableToolbar
            resultCount={filteredHolds.length}
            totalCount={data?.length ?? 0}
            resultLabel="hold"
            hasActiveFilters={
              hasActiveFilters
            }
            onClear={clearFilters}
          >
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search client, date, format or appointment"
              label="Search booking holds"
            />

            <FilterSelect
              label="Filter booking holds by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />

            <FilterSelect
              label="Filter booking holds by format"
              value={formatFilter}
              onChange={setFormatFilter}
              options={formatOptions}
            />
          </TableToolbar>

          {!filteredHolds.length ? (
            <DataState
              isLoading={false}
              isError={false}
              empty
              emptyTitle="No booking holds match"
              emptyDescription="Adjust the search term or clear the active filters."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">
                        Client
                      </th>
                      <th className="px-5 py-3.5">
                        Held slot
                      </th>
                      <th className="px-5 py-3.5">
                        Status
                      </th>
                      <th className="px-5 py-3.5">
                        Payment
                      </th>
                      <th className="px-5 py-3.5">
                        Expires
                      </th>
                      <th className="w-20 px-5 py-3.5 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredHolds.map(
                      (hold) => (
                        <tr
                          key={hold.id}
                          className="border-t border-slate-100 align-top transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-950">
                              {hold.client_name ||
                                "Unknown client"}
                            </div>
                            <div className="mt-1 text-slate-500">
                              {hold.client_email ||
                                "No email"}
                            </div>
                            {hold.client_phone ? (
                              <div className="text-slate-500">
                                {
                                  hold.client_phone
                                }
                              </div>
                            ) : null}
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {formatDate(
                                hold.hold_date,
                              )}
                            </div>
                            <div className="mt-1 text-slate-500">
                              {hold.start_time}
                              {" to "}
                              {hold.end_time}
                            </div>
                            <div className="text-slate-500">
                              {hold.session_format
                                ?.replace(
                                  /_/g,
                                  " ",
                                ) ||
                                "Format pending"}
                            </div>
                            {hold.location ? (
                              <div className="text-slate-500">
                                {hold.location}
                              </div>
                            ) : null}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              tone={statusTone(
                                hold.status,
                              )}
                            >
                              {statusLabel(
                                hold.status,
                              )}
                            </StatusBadge>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {paymentSummary(
                                hold,
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {hold.payment_policy_snapshot
                                ?.replace(
                                  /_/g,
                                  " ",
                                ) ||
                                "Payment policy pending"}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div
                              className={
                                new Date(
                                  hold.expires_at,
                                ).getTime() <=
                                renderedAt
                                  ? "font-semibold text-red-700"
                                  : "font-medium text-slate-900"
                              }
                            >
                              {relativeExpiry(
                                hold.expires_at,
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDateTime(
                                hold.expires_at,
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right">
                            {renderActions(hold)}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {filteredHolds.map((hold) => (
                  <article
                    key={hold.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950">
                          {hold.client_name ||
                            "Unknown client"}
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          {hold.client_email ||
                            "No email"}
                        </p>
                      </div>

                      {renderActions(hold)}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={statusTone(
                          hold.status,
                        )}
                      >
                        {statusLabel(
                          hold.status,
                        )}
                      </StatusBadge>
                      <span className="text-xs text-slate-400">
                        {relativeExpiry(
                          hold.expires_at,
                        )}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="font-medium text-slate-900">
                        {formatDate(
                          hold.hold_date,
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {hold.start_time}
                        {" to "}
                        {hold.end_time}
                      </p>
                      <p className="text-sm text-slate-500">
                        {hold.session_format
                          ?.replace(/_/g, " ") ||
                          "Format pending"}
                        {hold.location
                          ? ` · ${hold.location}`
                          : ""}
                      </p>
                    </div>

                    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-slate-900">
                        {paymentSummary(hold)}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {hold.payment_policy_snapshot
                          ?.replace(/_/g, " ") ||
                          "Payment policy pending"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
