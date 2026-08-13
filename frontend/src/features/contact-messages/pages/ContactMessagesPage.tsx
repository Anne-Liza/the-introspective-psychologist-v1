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
  Mail,
  MailOpen,
  Reply,
  Trash2,
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
import { apiClient } from "../../../lib/api-client";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  source: string | null;
  is_read: boolean;
  created_at: string;
};

async function fetchContactMessages() {
  const response =
    await apiClient.get<ContactMessage[]>(
      "/contact-messages",
    );

  return response.data;
}

async function updateContactMessage(payload: {
  id: string;
  is_read: boolean;
}) {
  const response =
    await apiClient.patch<ContactMessage>(
      `/contact-messages/${payload.id}`,
      {
        is_read: payload.is_read,
      },
    );

  return response.data;
}

async function deleteContactMessage(id: string) {
  await apiClient.delete(
    `/contact-messages/${id}`,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sourceLabel(
  source: string | null,
): string {
  if (!source) {
    return "Website";
  }

  if (source === "presentation_seed") {
    return "Demo data";
  }

  return source
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

const statusOptions: FilterOption[] = [
  {
    value: "all",
    label: "All statuses",
  },
  {
    value: "unread",
    label: "Unread",
  },
  {
    value: "read",
    label: "Read",
  },
];

export function ContactMessagesPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [sourceFilter, setSourceFilter] =
    useState("all");

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: fetchContactMessages,
  });

  const updateMutation = useMutation({
    mutationFn: updateContactMessage,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["contact-messages"],
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContactMessage,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["contact-messages"],
      }),
  });

  const sourceOptions = useMemo<
    FilterOption[]
  >(() => {
    const sources = Array.from(
      new Set(
        (data ?? []).map((item) =>
          sourceLabel(item.source),
        ),
      ),
    ).sort((left, right) =>
      left.localeCompare(right),
    );

    return [
      {
        value: "all",
        label: "All sources",
      },
      ...sources.map((source) => ({
        value: source,
        label: source,
      })),
    ];
  }, [data]);

  const filteredMessages = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return (data ?? []).filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          item.name,
          item.email,
          item.subject ?? "",
          item.message,
          sourceLabel(item.source),
        ].some((value) =>
          value
            .toLowerCase()
            .includes(normalizedSearch),
        );

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "read" &&
          item.is_read) ||
        (statusFilter === "unread" &&
          !item.is_read);

      const matchesSource =
        sourceFilter === "all" ||
        sourceLabel(item.source) ===
          sourceFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSource
      );
    });
  }, [
    data,
    search,
    sourceFilter,
    statusFilter,
  ]);

  const showState =
    isLoading ||
    isError ||
    !data?.length;

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    sourceFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSourceFilter("all");
  }

  function confirmDelete(
    item: ContactMessage,
  ) {
    const confirmed = window.confirm(
      `Delete the message from ${item.name}? This action cannot be undone.`,
    );

    if (confirmed) {
      deleteMutation.mutate(item.id);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title="Contact Messages"
        description="Review website inquiries, identify unread messages and manage follow-up from one place."
      />

      {showState ? (
        <DataState
          isLoading={isLoading}
          isError={isError}
          empty={!data?.length}
          emptyTitle="No contact messages"
          emptyDescription="Messages submitted through the public contact form will appear here."
        />
      ) : (
        <>
          <TableToolbar
            resultCount={
              filteredMessages.length
            }
            resultLabel="message"
            totalCount={data?.length ?? 0}
            hasActiveFilters={
              hasActiveFilters
            }
            onClear={clearFilters}
          >
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search name, email, subject or message"
              label="Search contact messages"
            />

            <FilterSelect
              label="Filter by read status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />

            <FilterSelect
              label="Filter by source"
              value={sourceFilter}
              onChange={setSourceFilter}
              options={sourceOptions}
            />
          </TableToolbar>

          {!filteredMessages.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="font-semibold text-slate-900">
                No messages match these filters
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Adjust the search term or clear the
                active filters.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">
                        Sender
                      </th>
                      <th className="px-5 py-3.5">
                        Message
                      </th>
                      <th className="px-5 py-3.5">
                        Status
                      </th>
                      <th className="px-5 py-3.5">
                        Received
                      </th>
                      <th className="w-20 px-5 py-3.5 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMessages.map(
                      (item) => (
                        <tr
                          key={item.id}
                          className={`border-t border-slate-100 align-top transition hover:bg-slate-50/70 ${
                            item.is_read
                              ? ""
                              : "bg-amber-50/30"
                          }`}
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">
                              {item.name}
                            </div>
                            <a
                              className="mt-1 block text-sm text-slate-500 hover:text-slate-900 hover:underline"
                              href={`mailto:${item.email}`}
                            >
                              {item.email}
                            </a>
                            <div className="mt-2 text-xs text-slate-400">
                              {sourceLabel(
                                item.source,
                              )}
                            </div>
                          </td>

                          <td className="max-w-xl px-5 py-4">
                            <div
                              className={
                                item.is_read
                                  ? "font-medium text-slate-700"
                                  : "font-semibold text-slate-950"
                              }
                            >
                              {item.subject ||
                                "No subject"}
                            </div>
                            <p className="mt-1 line-clamp-2 leading-6 text-slate-500">
                              {item.message}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              tone={
                                item.is_read
                                  ? "neutral"
                                  : "warning"
                              }
                            >
                              {item.is_read
                                ? "Read"
                                : "Unread"}
                            </StatusBadge>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                            {formatDate(
                              item.created_at,
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <RowActionsMenu
                              label={`Actions for ${item.name}`}
                            >
                              <button
                                type="button"
                                className={
                                  rowActionClassName
                                }
                                onClick={() =>
                                  updateMutation.mutate(
                                    {
                                      id: item.id,
                                      is_read:
                                        !item.is_read,
                                    },
                                  )
                                }
                                disabled={
                                  updateMutation.isPending
                                }
                              >
                                {item.is_read ? (
                                  <Mail className="mr-2 h-4 w-4" />
                                ) : (
                                  <MailOpen className="mr-2 h-4 w-4" />
                                )}
                                {item.is_read
                                  ? "Mark unread"
                                  : "Mark read"}
                              </button>

                              <a
                                className={
                                  rowActionClassName
                                }
                                href={`mailto:${item.email}?subject=${encodeURIComponent(
                                  `Re: ${
                                    item.subject ??
                                    "Your inquiry"
                                  }`,
                                )}`}
                              >
                                <Reply className="mr-2 h-4 w-4" />
                                Reply by email
                              </a>

                              <div className="my-1 border-t border-slate-100" />

                              <button
                                type="button"
                                className={
                                  destructiveRowActionClassName
                                }
                                onClick={() =>
                                  confirmDelete(item)
                                }
                                disabled={
                                  deleteMutation.isPending
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete message
                              </button>
                            </RowActionsMenu>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {filteredMessages.map(
                  (item) => (
                    <article
                      key={item.id}
                      className={`rounded-2xl border bg-white p-4 shadow-sm ${
                        item.is_read
                          ? "border-slate-200"
                          : "border-amber-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">
                            {item.name}
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {item.email}
                          </p>
                        </div>

                        <RowActionsMenu>
                          <button
                            type="button"
                            className={
                              rowActionClassName
                            }
                            onClick={() =>
                              updateMutation.mutate({
                                id: item.id,
                                is_read:
                                  !item.is_read,
                              })
                            }
                          >
                            {item.is_read
                              ? "Mark unread"
                              : "Mark read"}
                          </button>

                          <a
                            className={
                              rowActionClassName
                            }
                            href={`mailto:${item.email}`}
                          >
                            Reply by email
                          </a>

                          <button
                            type="button"
                            className={
                              destructiveRowActionClassName
                            }
                            onClick={() =>
                              confirmDelete(item)
                            }
                          >
                            Delete message
                          </button>
                        </RowActionsMenu>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          tone={
                            item.is_read
                              ? "neutral"
                              : "warning"
                          }
                        >
                          {item.is_read
                            ? "Read"
                            : "Unread"}
                        </StatusBadge>

                        <span className="text-xs text-slate-400">
                          {sourceLabel(
                            item.source,
                          )}
                        </span>
                      </div>

                      <p className="mt-4 font-medium text-slate-800">
                        {item.subject ||
                          "No subject"}
                      </p>

                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-500">
                        {item.message}
                      </p>

                      <p className="mt-4 text-xs text-slate-400">
                        {formatDate(
                          item.created_at,
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
