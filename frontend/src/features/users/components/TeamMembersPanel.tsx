import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useState } from "react";

import { DataState } from "../../../components/data/DataState";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../auth/context/AuthContext";
import { apiClient } from "../../../lib/api-client";
import {
  canManageTeamMember,
  ManagedRoleOption,
  selectableRoleOptions,
} from "../lib/teamMemberAccess";

type Role = {
  id: string;
  name: string;
  description: string | null;
};

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  roles: Role[];
};

type RoleOptionsResponse = {
  roles: ManagedRoleOption[];
};

async function fetchTeamMembers() {
  const response = await apiClient.get<TeamMember[]>("/users");
  return response.data;
}

async function fetchManagedRoleOptions() {
  const response = await apiClient.get<RoleOptionsResponse>(
    "/invitations/options",
  );
  return response.data;
}

async function updateMemberAccess({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const response = await apiClient.patch<TeamMember>(
    `/users/${userId}`,
    {
      is_active: isActive,
    },
  );
  return response.data;
}

async function updateMemberRole({
  userId,
  roleName,
}: {
  userId: string;
  roleName: string;
}) {
  const response = await apiClient.patch<TeamMember>(
    `/users/${userId}/team-role`,
    {
      role_name: roleName,
    },
  );
  return response.data;
}

function mutationErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
  }

  return "The team member could not be updated. Please try again.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function TeamMembersPanel() {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canUpdateUsers = hasPermission("users.update");
  const canManageRoles = hasPermission("invitations.manage");

  const [selectedRoles, setSelectedRoles] = useState<
    Record<string, string>
  >({});

  const membersQuery = useQuery({
    queryKey: ["team-members"],
    queryFn: fetchTeamMembers,
  });

  const roleOptionsQuery = useQuery({
    queryKey: ["invitation-options"],
    queryFn: fetchManagedRoleOptions,
    enabled: canManageRoles,
  });

  const manageableRoles =
    roleOptionsQuery.data?.roles ?? [];

  const manageableRoleNames = useMemo(
    () => new Set(
      manageableRoles.map((role) => role.role_name),
    ),
    [manageableRoles],
  );

  function refreshTeamData() {
    void queryClient.invalidateQueries({
      queryKey: ["team-members"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["users"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["invitation-options"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["therapist-account-options"],
    });
  }

  const accessMutation = useMutation({
    mutationFn: updateMemberAccess,
    onSuccess: refreshTeamData,
  });

  const roleMutation = useMutation({
    mutationFn: updateMemberRole,
    onSuccess: (member) => {
      setSelectedRoles((current) => ({
        ...current,
        [member.id]: member.roles[0]?.name ?? "",
      }));
      refreshTeamData();
    },
  });

  if (
    membersQuery.isLoading
    || membersQuery.isError
    || !membersQuery.data?.length
  ) {
    return (
      <DataState
        isLoading={membersQuery.isLoading}
        isError={membersQuery.isError}
        empty={!membersQuery.data?.length}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        {membersQuery.data.map((member) => {
          const memberRoleNames = member.roles.map(
            (role) => role.name,
          );
          const currentRoleName =
            member.roles[0]?.name;
          const selectedRoleName =
            selectedRoles[member.id]
            ?? currentRoleName
            ?? "";

          const canManageMember =
            canManageTeamMember({
              actorId: user?.id,
              memberId: member.id,
              memberRoleNames,
              manageableRoleNames,
              canUpdateUsers,
            });

          const roleOptions =
            selectableRoleOptions(
              manageableRoles,
              currentRoleName,
            );

          const alternativeRoles =
            roleOptions.filter(
              (role) =>
                role.role_name !== currentRoleName,
            );

          const accessIsPending =
            accessMutation.isPending
            && accessMutation.variables?.userId
              === member.id;

          const roleIsPending =
            roleMutation.isPending
            && roleMutation.variables?.userId
              === member.id;

          return (
            <article
              key={member.id}
              className="rounded-3xl border border-[#dfe3d4] bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold text-[#253026]">
                    {member.full_name
                      ?? "Unnamed team member"}
                  </h3>
                  <p className="mt-1 break-all text-sm text-[#667064]">
                    {member.email}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {member.id === user?.id ? (
                    <span className="rounded-full bg-[#f8f7f0] px-3 py-1 text-xs font-semibold text-[#667064]">
                      Your account
                    </span>
                  ) : null}

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      member.is_active
                        ? "bg-[#edf3e5] text-[#45623b]"
                        : "bg-[#f7ece8] text-[#914f3f]"
                    }`}
                  >
                    {member.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {member.roles.length ? (
                  member.roles.map((role) => (
                    <span
                      key={role.id}
                      className="rounded-full border border-[#dfe3d4] bg-[#f8f7f0] px-3 py-1 text-xs font-medium text-[#4f5b4d]"
                    >
                      {role.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#788176]">
                    No role assigned
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-1 text-xs text-[#788176]">
                <p>
                  {member.is_verified
                    ? "Account verified"
                    : "Verification pending"}
                </p>
                <p>
                  Joined {formatDate(member.created_at)}
                </p>
              </div>

              {canManageMember ? (
                <div className="mt-5 space-y-4 border-t border-[#e7e9df] pt-5">
                  <div>
                    <p className="text-sm font-semibold text-[#34422f]">
                      Access
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#788176]">
                      Deactivation immediately blocks login,
                      protected API access, and session refresh.
                    </p>

                    <div className="mt-3">
                      <Button
                        type="button"
                        variant={
                          member.is_active
                            ? "danger"
                            : "secondary"
                        }
                        disabled={accessIsPending}
                        onClick={() => {
                          const nextActive =
                            !member.is_active;
                          const action =
                            nextActive
                              ? "restore"
                              : "remove";

                          if (
                            !window.confirm(
                              `${action === "remove" ? "Remove" : "Restore"} access for ${member.full_name ?? member.email}?`,
                            )
                          ) {
                            return;
                          }

                          accessMutation.mutate({
                            userId: member.id,
                            isActive: nextActive,
                          });
                        }}
                      >
                        {accessIsPending
                          ? "Saving..."
                          : member.is_active
                            ? "Deactivate access"
                            : "Reactivate access"}
                      </Button>
                    </div>
                  </div>

                  {canManageRoles ? (
                    <div>
                      <p className="text-sm font-semibold text-[#34422f]">
                        Role
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#788176]">
                        Assign only roles permitted by the
                        practice staffing policy.
                      </p>

                      {alternativeRoles.length ? (
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                          <label className="min-w-0 flex-1 space-y-2">
                            <span className="text-xs font-medium text-[#667064]">
                              Team role
                            </span>
                            <select
                              value={selectedRoleName}
                              onChange={(event) => {
                                const roleName =
                                  event.target.value;
                                setSelectedRoles(
                                  (current) => ({
                                    ...current,
                                    [member.id]:
                                      roleName,
                                  }),
                                );
                              }}
                              className="w-full rounded-2xl border border-[#dfe3d4] bg-white px-4 py-3 text-sm outline-none focus:border-[#56684b]"
                            >
                              {roleOptions.map(
                                (role) => (
                                  <option
                                    key={role.role_name}
                                    value={
                                      role.role_name
                                    }
                                  >
                                    {role.role_name}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <Button
                            type="button"
                            variant="secondary"
                            disabled={
                              roleIsPending
                              || !selectedRoleName
                              || selectedRoleName
                                === currentRoleName
                            }
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Change ${member.full_name ?? member.email}'s role to ${selectedRoleName}?`,
                                )
                              ) {
                                return;
                              }

                              roleMutation.mutate({
                                userId: member.id,
                                roleName:
                                  selectedRoleName,
                              });
                            }}
                          >
                            {roleIsPending
                              ? "Saving..."
                              : "Change role"}
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-[#788176]">
                          No other roles are currently
                          available for this administrator to
                          assign.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : member.id !== user?.id ? (
                <p className="mt-5 border-t border-[#e7e9df] pt-4 text-xs leading-5 text-[#788176]">
                  This account is protected by the practice
                  staffing hierarchy.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      {roleOptionsQuery.isError ? (
        <p
          className="rounded-2xl bg-[#f7ece8] px-4 py-3 text-sm text-[#7d473b]"
          role="alert"
        >
          Managed role options could not be loaded.
        </p>
      ) : null}

      {accessMutation.isError ? (
        <p
          className="rounded-2xl bg-[#f7ece8] px-4 py-3 text-sm text-[#7d473b]"
          role="alert"
        >
          {mutationErrorMessage(
            accessMutation.error,
          )}
        </p>
      ) : null}

      {roleMutation.isError ? (
        <p
          className="rounded-2xl bg-[#f7ece8] px-4 py-3 text-sm text-[#7d473b]"
          role="alert"
        >
          {mutationErrorMessage(
            roleMutation.error,
          )}
        </p>
      ) : null}
    </div>
  );
}
