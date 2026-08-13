import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { DataState } from "../../../components/data/DataState";
import { Input } from "../../../components/ui/Input";
import { apiClient } from "../../../lib/api-client";

type Role = {
  id: string;
  name: string;
  description: string | null;
};

type User = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  roles: Role[];
};

async function fetchUsers() {
  const response = await apiClient.get<User[]>("/users");
  return response.data;
}

async function fetchRoles() {
  const response = await apiClient.get<Role[]>("/roles");
  return response.data;
}

async function createUser(payload: { email: string; full_name: string; password: string; role_names: string[] }) {
  const response = await apiClient.post<User>("/users", payload);
  return response.data;
}

async function assignRoles(payload: { userId: string; role_names: string[] }) {
  const response = await apiClient.patch<User>(`/users/${payload.userId}/roles`, {
    role_names: payload.role_names,
  });
  return response.data;
}

function toggleRole(roleName: string, current: string[], setter: (value: string[]) => void) {
  if (current.includes(roleName)) {
    setter(current.filter((name) => name !== roleName));
    return;
  }

  setter([...current, roleName]);
}

function RoleCheckboxes({
  roles,
  selectedRoleNames,
  onChange,
}: {
  roles: Role[];
  selectedRoleNames: string[];
  onChange: (value: string[]) => void;
}) {
  if (!roles.length) {
    return <p className="text-sm text-slate-500">No roles available.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {roles.map((role) => (
        <label key={role.id} className="flex gap-3 rounded-2xl border bg-white p-4 text-sm">
          <input
            type="checkbox"
            checked={selectedRoleNames.includes(role.name)}
            onChange={() => toggleRole(role.name, selectedRoleNames, onChange)}
            className="mt-1"
          />
          <span>
            <span className="block font-medium text-slate-900">{role.name}</span>
            {role.description ? <span className="mt-1 block text-slate-500">{role.description}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [createRoleNames, setCreateRoleNames] = useState<string[]>(["Viewer"]);
  const [password, setPassword] = useState("ChangeMe123!");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>(["Viewer"]);

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });

  const selectedUserRecord = useMemo(
    () => usersQuery.data?.find((user) => user.id === selectedUser),
    [usersQuery.data, selectedUser],
  );

  useEffect(() => {
    if (!selectedUserRecord) return;
    setSelectedRoleNames(selectedUserRecord.roles.map((role) => role.name));
  }, [selectedUserRecord]);

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setEmail("");
      setFullName("");
      setPassword("ChangeMe123!");
      setCreateRoleNames(["Viewer"]);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: assignRoles,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({
      email,
      full_name: fullName,
      password,
      role_names: createRoleNames,
    });
  }

  function handleAssign(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser) return;
    roleMutation.mutate({
      userId: selectedUser,
      role_names: selectedRoleNames,
    });
  }

  const showState = usersQuery.isLoading || usersQuery.isError || !usersQuery.data?.length;
  const roles = rolesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Access control</p>
        <h2 className="text-3xl font-bold">Users</h2>
        <p className="mt-2 text-slate-600">
          Create users and assign roles without typing role names manually.
        </p>
      </div>

      <form onSubmit={handleCreate} className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Create user</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input label="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <Input label="Temporary password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Roles</p>
            <p className="mt-1 text-sm text-slate-500">Choose one or more roles for this user.</p>
          </div>

          <RoleCheckboxes roles={roles} selectedRoleNames={createRoleNames} onChange={setCreateRoleNames} />
        </div>

        <div className="mt-4">
          <Button type="submit" disabled={createMutation.isPending || !createRoleNames.length}>
            {createMutation.isPending ? "Creating..." : "Create user"}
          </Button>
        </div>

        {createMutation.isError ? (
          <p className="mt-3 text-sm text-red-600">User creation failed. Check email, password, and selected roles.</p>
        ) : null}
      </form>

      <form onSubmit={handleAssign} className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Assign roles</h3>

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">User</span>
            <select
              value={selectedUser}
              onChange={(event) => setSelectedUser(event.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm"
            >
              <option value="">Select user</option>
              {usersQuery.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name ? `${user.full_name} · ${user.email}` : user.email}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Roles</p>
              <p className="mt-1 text-sm text-slate-500">
                Selected roles will replace the user&apos;s current roles.
              </p>
            </div>

            <RoleCheckboxes roles={roles} selectedRoleNames={selectedRoleNames} onChange={setSelectedRoleNames} />
          </div>

          <Button type="submit" disabled={!selectedUser || roleMutation.isPending || !selectedRoleNames.length}>
            {roleMutation.isPending ? "Saving..." : "Save roles"}
          </Button>

          {roleMutation.isError ? (
            <p className="text-sm text-red-600">Role update failed. Confirm the selected roles are still available.</p>
          ) : null}
        </div>
      </form>

      {showState ? (
        <DataState isLoading={usersQuery.isLoading} isError={usersQuery.isError} empty={!usersQuery.data?.length} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Roles</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data?.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="p-4">
                    <div className="font-medium">{user.full_name ?? "Unnamed user"}</div>
                    <div className="text-slate-500">{user.email}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {user.roles.length ? (
                        user.roles.map((role) => (
                          <span key={role.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            {role.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500">No role</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={user.is_active ? "text-green-700" : "text-red-700"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rolesQuery.isError ? (
        <p className="text-sm text-red-600">Roles could not be loaded. Check role permissions for this account.</p>
      ) : null}
    </div>
  );
}
