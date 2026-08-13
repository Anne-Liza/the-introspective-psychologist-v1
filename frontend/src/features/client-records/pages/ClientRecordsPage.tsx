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
  Archive,
  CheckCircle2,
  CircleOff,
  UserRoundPlus,
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
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  createClientRecord,
  createClientRecordFromAppointment,
  createClientRecordFromCommerceOrder,
  fetchClientRecords,
  updateClientRecord,
  type ClientRecord,
} from "../lib/clientRecordsApi";

const statusOptions: FilterOption[] = [
  {
    value: "all",
    label: "All statuses",
  },
  {
    value: "lead",
    label: "Lead",
  },
  {
    value: "active",
    label: "Active",
  },
  {
    value: "inactive",
    label: "Inactive",
  },
  {
    value: "archived",
    label: "Archived",
  },
];

const statusLabels: Record<
  ClientRecord["status"],
  string
> = {
  lead: "Lead",
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

function statusTone(
  status: ClientRecord["status"],
):
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info" {
  if (status === "active") {
    return "success";
  }

  if (status === "lead") {
    return "warning";
  }

  if (status === "archived") {
    return "danger";
  }

  return "neutral";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function humanize(value: string) {
  if (value === "presentation_seed") {
    return "Demo data";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export function ClientRecordsPage() {
  const queryClient = useQueryClient();

  const [fullName, setFullName] =
    useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adminNotes, setAdminNotes] =
    useState("");
  const [
    appointmentId,
    setAppointmentId,
  ] = useState("");
  const [
    commerceOrderId,
    setCommerceOrderId,
  ] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [sourceFilter, setSourceFilter] =
    useState("all");

  const clientsQuery = useQuery({
    queryKey: ["client-records"],
    queryFn: fetchClientRecords,
  });

  const createMutation = useMutation({
    mutationFn: createClientRecord,
    onSuccess: () => {
      setFullName("");
      setEmail("");
      setPhone("");
      setAdminNotes("");
      queryClient.invalidateQueries({
        queryKey: ["client-records"],
      });
    },
  });

  const appointmentMutation = useMutation({
    mutationFn:
      createClientRecordFromAppointment,
    onSuccess: () => {
      setAppointmentId("");
      queryClient.invalidateQueries({
        queryKey: ["client-records"],
      });
    },
  });

  const orderMutation = useMutation({
    mutationFn:
      createClientRecordFromCommerceOrder,
    onSuccess: () => {
      setCommerceOrderId("");
      queryClient.invalidateQueries({
        queryKey: ["client-records"],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateClientRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["client-records"],
      });
    },
  });

  const sourceOptions = useMemo<
    FilterOption[]
  >(() => {
    const sources = Array.from(
      new Set(
        (clientsQuery.data ?? []).map(
          (client) => client.source,
        ),
      ),
    ).sort();

    return [
      {
        value: "all",
        label: "All sources",
      },
      ...sources.map((source) => ({
        value: source,
        label: humanize(source),
      })),
    ];
  }, [clientsQuery.data]);

  const filteredClients = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return (clientsQuery.data ?? []).filter(
      (client) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            client.full_name,
            client.email,
            client.phone ?? "",
            client.client_number,
            client.admin_notes ?? "",
            client.source,
            client.preferred_contact_method,
            ...client.links.flatMap(
              (link) => [
                link.link_type,
                link.label ?? "",
                link.linked_record_id,
              ],
            ),
          ].some((value) =>
            value
              .toLowerCase()
              .includes(normalizedSearch),
          );

        const matchesStatus =
          statusFilter === "all" ||
          client.status === statusFilter;

        const matchesSource =
          sourceFilter === "all" ||
          client.source === sourceFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesSource
        );
      },
    );
  }, [
    clientsQuery.data,
    search,
    sourceFilter,
    statusFilter,
  ]);

  const showState =
    clientsQuery.isLoading ||
    clientsQuery.isError ||
    !clientsQuery.data?.length;

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    sourceFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSourceFilter("all");
  }

  function renderActions(
    client: ClientRecord,
  ) {
    const statuses: ClientRecord["status"][] =
      [
        "lead",
        "active",
        "inactive",
        "archived",
      ];

    return (
      <RowActionsMenu
        label={`Actions for ${client.full_name}`}
      >
        {statuses
          .filter(
            (status) =>
              status !== client.status,
          )
          .map((status) => {
            const Icon =
              status === "active"
                ? CheckCircle2
                : status === "archived"
                  ? Archive
                  : status === "inactive"
                    ? CircleOff
                    : UserRoundPlus;

            return (
              <button
                type="button"
                key={status}
                className={
                  status === "archived"
                    ? destructiveRowActionClassName
                    : rowActionClassName
                }
                onClick={() =>
                  updateMutation.mutate({
                    id: client.id,
                    data: { status },
                  })
                }
                disabled={
                  updateMutation.isPending
                }
              >
                <Icon className="mr-2 h-4 w-4" />
                Mark as{" "}
                {statusLabels[
                  status
                ].toLowerCase()}
              </button>
            );
          })}
      </RowActionsMenu>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client operations"
        title="Client Records"
        description="Manage non-clinical contact details, client status and links to bookings or orders."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
            Add client manually
            <span className="ml-2 text-sm font-normal text-slate-500">
              Create a new lead
            </span>
          </summary>

          <div className="border-t border-slate-100 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={fullName}
                onChange={(event) =>
                  setFullName(
                    event.target.value,
                  )
                }
                placeholder="Full name"
              />
              <Input
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Email"
              />
              <Input
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value)
                }
                placeholder="Phone optional"
              />
              <Input
                value={adminNotes}
                onChange={(event) =>
                  setAdminNotes(
                    event.target.value,
                  )
                }
                placeholder="Non-clinical admin note optional"
              />
            </div>

            <div className="mt-4">
              <Button
                type="button"
                onClick={() =>
                  createMutation.mutate({
                    full_name: fullName,
                    email,
                    phone: phone || null,
                    status: "lead",
                    source: "manual",
                    preferred_contact_method:
                      "email",
                    admin_notes:
                      adminNotes || null,
                  })
                }
                disabled={
                  createMutation.isPending ||
                  !fullName.trim() ||
                  !email.trim()
                }
              >
                Create client
              </Button>
            </div>

            {createMutation.isError ? (
              <p
                role="alert"
                className="mt-3 text-sm font-medium text-red-600"
              >
                Client creation failed. Check
                for a duplicate email or
                invalid input.
              </p>
            ) : null}
          </div>
        </details>

        <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
            Link an existing record
            <span className="ml-2 text-sm font-normal text-slate-500">
              Appointment or order
            </span>
          </summary>

          <div className="border-t border-slate-100 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Input
                  value={appointmentId}
                  onChange={(event) =>
                    setAppointmentId(
                      event.target.value,
                    )
                  }
                  placeholder="Appointment ID"
                />
                <Button
                  type="button"
                  className="mt-3"
                  variant="secondary"
                  onClick={() =>
                    appointmentMutation.mutate({
                      appointment_id:
                        appointmentId,
                    })
                  }
                  disabled={
                    appointmentMutation.isPending ||
                    !appointmentId.trim()
                  }
                >
                  Create from appointment
                </Button>
              </div>

              <div>
                <Input
                  value={commerceOrderId}
                  onChange={(event) =>
                    setCommerceOrderId(
                      event.target.value,
                    )
                  }
                  placeholder="Store order ID"
                />
                <Button
                  type="button"
                  className="mt-3"
                  variant="secondary"
                  onClick={() =>
                    orderMutation.mutate({
                      commerce_order_id:
                        commerceOrderId,
                    })
                  }
                  disabled={
                    orderMutation.isPending ||
                    !commerceOrderId.trim()
                  }
                >
                  Create from order
                </Button>
              </div>
            </div>
          </div>
        </details>
      </div>

      {showState ? (
        <DataState
          isLoading={clientsQuery.isLoading}
          isError={clientsQuery.isError}
          empty={!clientsQuery.data?.length}
          emptyTitle="No client records"
          emptyDescription="Create a client manually or generate one from an appointment or store order."
        />
      ) : (
        <>
          <TableToolbar
            resultCount={
              filteredClients.length
            }
            totalCount={
              clientsQuery.data?.length ?? 0
            }
            resultLabel="client"
            hasActiveFilters={
              hasActiveFilters
            }
            onClear={clearFilters}
          >
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search name, email, phone or client number"
              label="Search client records"
            />

            <FilterSelect
              label="Filter clients by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />

            <FilterSelect
              label="Filter clients by source"
              value={sourceFilter}
              onChange={setSourceFilter}
              options={sourceOptions}
            />
          </TableToolbar>

          {!filteredClients.length ? (
            <DataState
              isLoading={false}
              isError={false}
              empty
              emptyTitle="No clients match"
              emptyDescription="Adjust the search term or clear the active filters."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">
                        Client
                      </th>
                      <th className="px-5 py-3.5">
                        Status
                      </th>
                      <th className="px-5 py-3.5">
                        Contact
                      </th>
                      <th className="px-5 py-3.5">
                        Connections
                      </th>
                      <th className="px-5 py-3.5">
                        Updated
                      </th>
                      <th className="w-20 px-5 py-3.5 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredClients.map(
                      (client) => (
                        <tr
                          key={client.id}
                          className="border-t border-slate-100 align-top transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-950">
                              {client.full_name}
                            </div>
                            <div className="mt-1 text-slate-500">
                              {
                                client.client_number
                              }
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                              {humanize(
                                client.source,
                              )}
                            </div>
                            {client.admin_notes ? (
                              <p className="mt-3 line-clamp-2 max-w-xs text-sm leading-6 text-slate-500">
                                {
                                  client.admin_notes
                                }
                              </p>
                            ) : null}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              tone={statusTone(
                                client.status,
                              )}
                            >
                              {
                                statusLabels[
                                  client.status
                                ]
                              }
                            </StatusBadge>
                          </td>

                          <td className="px-5 py-4">
                            <div className="text-slate-900">
                              {client.email}
                            </div>
                            {client.phone ? (
                              <div className="mt-1 text-slate-500">
                                {client.phone}
                              </div>
                            ) : null}
                            <div className="mt-2 text-xs text-slate-400">
                              Prefers{" "}
                              {humanize(
                                client.preferred_contact_method,
                              ).toLowerCase()}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {client.links.length ? (
                              <div className="space-y-1">
                                {client.links
                                  .slice(0, 3)
                                  .map((link) => (
                                    <div
                                      key={link.id}
                                      className="text-slate-500"
                                    >
                                      {humanize(
                                        link.link_type,
                                      )}
                                      {link.label
                                        ? `: ${link.label}`
                                        : ""}
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">
                                No links yet
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                            {formatDate(
                              client.updated_at,
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            {renderActions(client)}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {filteredClients.map(
                  (client) => (
                    <article
                      key={client.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-950">
                            {client.full_name}
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {client.email}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {
                              client.client_number
                            }
                          </p>
                        </div>

                        {renderActions(client)}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          tone={statusTone(
                            client.status,
                          )}
                        >
                          {
                            statusLabels[
                              client.status
                            ]
                          }
                        </StatusBadge>
                        <span className="text-xs text-slate-400">
                          {humanize(
                            client.source,
                          )}
                        </span>
                      </div>

                      {client.phone ? (
                        <p className="mt-4 text-sm text-slate-500">
                          {client.phone}
                        </p>
                      ) : null}

                      {client.links.length ? (
                        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                          {client.links
                            .slice(0, 3)
                            .map((link) => (
                              <p key={link.id}>
                                {humanize(
                                  link.link_type,
                                )}
                                {link.label
                                  ? `: ${link.label}`
                                  : ""}
                              </p>
                            ))}
                        </div>
                      ) : null}

                      <p className="mt-4 text-xs text-slate-400">
                        Updated{" "}
                        {formatDate(
                          client.updated_at,
                        )}
                      </p>
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
