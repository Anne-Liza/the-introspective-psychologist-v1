import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { DataState } from "../../../components/data/DataState";
import { Input } from "../../../components/ui/Input";
import { apiClient } from "../../../lib/api-client";

type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

type Invitation = {
  id: string;
  email: string;
  role_name: string;
  status: InvitationStatus;
  delivery_status: "queued" | "sent" | "failed";
  expires_at: string;
  last_sent_at: string;
  send_count: number;
  created_at: string;
};

type InvitationRoleOption = {
  role_name: string;
  description: string | null;
  maximum_active: number | null;
  active_count: number;
  pending_count: number;
  available_slots: number | null;
};

type InvitationOptions = { roles: InvitationRoleOption[] };

const statusFilters: Array<{ label: string; value: InvitationStatus | "all" }> =
  [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Accepted", value: "accepted" },
    { label: "Expired", value: "expired" },
    { label: "Revoked", value: "revoked" },
  ];

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return "The invitation action could not be completed. Please try again.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClasses(status: InvitationStatus) {
  if (status === "pending") return "bg-[#fff4df] text-[#765524]";
  if (status === "accepted") return "bg-[#edf3e5] text-[#45623b]";
  return "bg-[#f0efeb] text-[#667064]";
}

async function fetchInvitations(filter: InvitationStatus | "all") {
  const response = await apiClient.get<Invitation[]>("/invitations", {
    params: { status: filter === "all" ? undefined : filter, limit: 100 },
  });
  return response.data;
}

async function fetchInvitationOptions() {
  const response = await apiClient.get<InvitationOptions>(
    "/invitations/options",
  );
  return response.data;
}

async function createInvitation(payload: { email: string; role_name: string }) {
  const response = await apiClient.post<Invitation>("/invitations", payload);
  return response.data;
}

async function invitationAction(payload: {
  id: string;
  action: "resend" | "revoke";
}) {
  const response = await apiClient.post<Invitation>(
    `/invitations/${payload.id}/${payload.action}`,
  );
  return response.data;
}

export function InvitationsPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<InvitationStatus | "all">("all");
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("");
  const [revokeConfirmation, setRevokeConfirmation] = useState<string | null>(
    null,
  );

  const invitationsQuery = useQuery({
    queryKey: ["invitations", filter],
    queryFn: () => fetchInvitations(filter),
  });
  const optionsQuery = useQuery({
    queryKey: ["invitation-options"],
    queryFn: fetchInvitationOptions,
    enabled: canManage,
  });

  useEffect(() => {
    if (!roleName && optionsQuery.data?.roles.length) {
      const firstAvailable = optionsQuery.data.roles.find(
        (role) => role.available_slots === null || role.available_slots > 0,
      );
      setRoleName(firstAvailable?.role_name ?? "");
    }
  }, [optionsQuery.data, roleName]);

  function refreshInvitationData() {
    void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    void queryClient.invalidateQueries({ queryKey: ["invitation-options"] });
  }

  const createMutation = useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      setEmail("");
      refreshInvitationData();
    },
  });
  const actionMutation = useMutation({
    mutationFn: invitationAction,
    onSuccess: () => {
      setRevokeConfirmation(null);
      refreshInvitationData();
    },
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!roleName) return;
    createMutation.mutate({ email, role_name: roleName });
  }

  const roles = optionsQuery.data?.roles ?? [];

  return (
    <div className="space-y-6">
      {canManage ? (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl border border-[#dfe3d4] bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#253026]">
                Invite a team member
              </h3>
              <p className="mt-1 text-sm leading-6 text-[#667064]">
                They will receive a secure, expiring link to create their own
                password.
              </p>
            </div>
            <span className="rounded-full bg-[#edf3e5] px-3 py-1 text-xs font-semibold text-[#45623b]">
              Invitation only
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.7fr)_auto] md:items-end">
            <Input
              label="Work email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Role</span>
              <select
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-[#34422f]"
                required
              >
                <option value="">Select an available role</option>
                {roles.map((role) => {
                  const full = role.available_slots === 0;
                  return (
                    <option
                      key={role.role_name}
                      value={role.role_name}
                      disabled={full}
                    >
                      {role.role_name}
                      {full ? " — capacity full" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <Button
              type="submit"
              disabled={
                createMutation.isPending || !roleName || optionsQuery.isLoading
              }
              className="bg-[#34422f] px-5 py-3 hover:bg-[#253223]"
            >
              {createMutation.isPending ? "Sending..." : "Send invitation"}
            </Button>
          </div>

          {roles.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {roles.map((role) => (
                <span
                  key={role.role_name}
                  className="rounded-full bg-[#f8f7f0] px-3 py-1 text-xs text-[#667064]"
                >
                  {role.role_name}: {role.active_count} active ·{" "}
                  {role.pending_count} pending
                  {role.available_slots === null
                    ? ""
                    : ` · ${role.available_slots} available`}
                </span>
              ))}
            </div>
          ) : null}

          {optionsQuery.isError ? (
            <p className="mt-4 text-sm text-[#914f3f]">
              Available invitation roles could not be loaded.
            </p>
          ) : null}
          {createMutation.isError ? (
            <p
              className="mt-4 rounded-2xl bg-[#f7ece8] px-4 py-3 text-sm text-[#7d473b]"
              role="alert"
            >
              {errorMessage(createMutation.error)}
            </p>
          ) : null}
          {createMutation.isSuccess ? (
            <p className="mt-4 rounded-2xl bg-[#edf3e5] px-4 py-3 text-sm text-[#365032]">
              Invitation sent. Its delivery status appears below.
            </p>
          ) : null}
        </form>
      ) : null}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[#253026]">
              Invitation history
            </h3>
            <p className="mt-1 text-sm text-[#667064]">
              Track delivery and account acceptance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter invitations">
            {statusFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === item.value
                    ? "bg-[#34422f] text-white"
                    : "border border-[#dfe3d4] bg-white text-[#667064] hover:bg-[#f8f7f0]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {invitationsQuery.isLoading ||
          invitationsQuery.isError ||
          !invitationsQuery.data?.length ? (
            <DataState
              isLoading={invitationsQuery.isLoading}
              isError={invitationsQuery.isError}
              empty={!invitationsQuery.data?.length}
            />
          ) : (
            <div className="space-y-3">
              {invitationsQuery.data.map((invitation) => (
                <article
                  key={invitation.id}
                  className="rounded-3xl border border-[#dfe3d4] bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="break-all font-semibold text-[#253026]">
                        {invitation.email}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#f8f7f0] px-3 py-1 text-xs text-[#667064]">
                          {invitation.role_name}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(invitation.status)}`}
                        >
                          {invitation.status}
                        </span>
                        <span className="rounded-full border border-[#dfe3d4] px-3 py-1 text-xs text-[#667064]">
                          Email {invitation.delivery_status}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-[#788176]">
                        Sent {formatDate(invitation.last_sent_at)} · expires{" "}
                        {formatDate(invitation.expires_at)}
                        {invitation.send_count > 1
                          ? ` · sent ${invitation.send_count} times`
                          : ""}
                      </p>
                    </div>

                    {canManage && invitation.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={actionMutation.isPending}
                          onClick={() =>
                            actionMutation.mutate({
                              id: invitation.id,
                              action: "resend",
                            })
                          }
                        >
                          Resend
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={actionMutation.isPending}
                          onClick={() => {
                            if (revokeConfirmation === invitation.id) {
                              actionMutation.mutate({
                                id: invitation.id,
                                action: "revoke",
                              });
                              return;
                            }
                            setRevokeConfirmation(invitation.id);
                          }}
                        >
                          {revokeConfirmation === invitation.id
                            ? "Confirm revoke"
                            : "Revoke"}
                        </Button>
                        {revokeConfirmation === invitation.id ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={actionMutation.isPending}
                            onClick={() => setRevokeConfirmation(null)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {actionMutation.isError ? (
          <p
            className="mt-4 rounded-2xl bg-[#f7ece8] px-4 py-3 text-sm text-[#7d473b]"
            role="alert"
          >
            {errorMessage(actionMutation.error)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
