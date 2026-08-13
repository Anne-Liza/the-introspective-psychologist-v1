export type Permission = {
  id: string;
  code: string;
  description?: string | null;
};

export type Role = {
  id: string;
  name: string;
  description?: string | null;
  permissions?: Permission[];
};

export type PermissionSubject = {
  roles?: Role[];
};

export function collectPermissionCodes(subject: PermissionSubject | null | undefined): Set<string> {
  return new Set(
    (subject?.roles ?? []).flatMap((role) =>
      (role.permissions ?? []).map((permission) => permission.code),
    ),
  );
}

export function hasUserPermission(
  subject: PermissionSubject | null | undefined,
  permission: string,
): boolean {
  const permissions = collectPermissionCodes(subject);
  return permissions.has("system.all") || permissions.has(permission);
}
